"use server";

import { Prisma, type Flag } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { dateOnlyUTC } from "@/lib/health";
import { authorizeProjectMutation } from "@/lib/project-authorization";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "@/lib/types";
import { flagInputSchema, idSchema } from "@/lib/validation";

const CONFLICT_MESSAGE =
  "Blocker changed while you were editing — reload and retry.";

function revalidateFlagRoutes(projectId?: string): void {
  revalidatePath("/timeline");
  revalidatePath("/overview");
  revalidatePath("/leadership");
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }
}

async function requireSessionResult(): Promise<
  | { ok: true; personId: string; isDemo: boolean }
  | { ok: false; code: "UNAUTHORIZED"; error: string }
> {
  try {
    const session = await requireSession();
    return { ok: true, personId: session.personId, isDemo: session.isDemo };
  } catch {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      error: "You must be signed in to do that.",
    };
  }
}

export async function createFlag(
  projectId: string,
  input: unknown,
): Promise<ActionResult<Flag>> {
  const session = await requireSessionResult();
  if (!session.ok) {
    return session;
  }

  const parsedProjectId = idSchema.safeParse(projectId);
  const parsed = flagInputSchema.safeParse(input);
  if (!parsedProjectId.success || !parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      error: parsed.success
        ? "Invalid project id."
        : (parsed.error.issues[0]?.message ?? "Invalid blocker data."),
    };
  }
  projectId = parsedProjectId.data;

  const result = await db.$transaction(
    async (tx) => {
      const access = await authorizeProjectMutation(projectId, session, tx);
      if (!access.ok) {
        return access;
      }

      const flag = await tx.flag.create({
        data: {
          projectId,
          needs: parsed.data.needs,
          from: parsed.data.from,
          raised: dateOnlyUTC(parsed.data.raised),
          status: "open",
        },
      });
      return { ok: true as const, data: flag };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  if (!result.ok) {
    return result;
  }

  revalidateFlagRoutes(projectId);
  return result;
}

export async function toggleFlag(
  id: string,
  version: number,
): Promise<ActionResult<Flag>> {
  const session = await requireSessionResult();
  if (!session.ok) {
    return session;
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { ok: false, code: "VALIDATION", error: "Invalid blocker id." };
  }
  id = parsedId.data;

  const existing = await db.flag.findFirst({
    where: { id, project: { isDemo: session.isDemo } },
    select: { projectId: true, status: true },
  });
  if (!existing) {
    return { ok: false, code: "NOT_FOUND", error: "Blocker not found." };
  }
  const access = await authorizeProjectMutation(existing.projectId, session);
  if (!access.ok) {
    return access;
  }

  const updateResult = await db.flag.updateMany({
    where: { id, version, project: access.projectWhere },
    data: {
      status: existing.status === "open" ? "resolved" : "open",
      version: { increment: 1 },
    },
  });
  if (updateResult.count === 0) {
    return { ok: false, code: "CONFLICT", error: CONFLICT_MESSAGE };
  }

  const flag = await db.flag.findUniqueOrThrow({ where: { id } });
  revalidateFlagRoutes(flag.projectId);
  return { ok: true, data: flag };
}

export async function deleteFlag(
  id: string,
  version: number,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireSessionResult();
  if (!session.ok) {
    return session;
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { ok: false, code: "VALIDATION", error: "Invalid blocker id." };
  }
  id = parsedId.data;

  const existing = await db.flag.findFirst({
    where: { id, project: { isDemo: session.isDemo } },
    select: { projectId: true },
  });
  if (!existing) {
    return { ok: false, code: "NOT_FOUND", error: "Blocker not found." };
  }
  const access = await authorizeProjectMutation(existing.projectId, session);
  if (!access.ok) {
    return access;
  }

  const deleteResult = await db.flag.deleteMany({
    where: { id, version, project: access.projectWhere },
  });
  if (deleteResult.count === 0) {
    return { ok: false, code: "CONFLICT", error: CONFLICT_MESSAGE };
  }

  revalidateFlagRoutes(existing.projectId);
  return { ok: true, data: { id } };
}
