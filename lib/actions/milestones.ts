"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type Milestone } from "@prisma/client";

import { db } from "@/lib/db";
import { dateOnlyUTC } from "@/lib/health";
import { authorizeProjectMutation } from "@/lib/project-authorization";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "@/lib/types";
import { idSchema, milestoneInputSchema } from "@/lib/validation";

const PROJECT_ROUTES = [
  "/projects",
  "/board",
  "/timeline",
  "/leadership",
  "/archived",
] as const;

const CONFLICT_MESSAGE =
  "Project changed while you were editing — reload and retry.";

function revalidateProjectRoutes(): void {
  for (const route of PROJECT_ROUTES) {
    revalidatePath(route);
  }
  // Detail pages render milestones and optimistic-lock versions too.
  revalidatePath("/projects/[id]", "page");
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

async function checkAssignee(
  assigneeId: string,
  client: Pick<Prisma.TransactionClient, "person"> = db,
): Promise<{ ok: true } | { ok: false; code: "NOT_FOUND" | "VALIDATION"; error: string }> {
  const assignee = await client.person.findUnique({
    where: { id: assigneeId },
    select: { active: true, isDemo: true },
  });

  if (!assignee || assignee.isDemo) {
    return { ok: false, code: "NOT_FOUND", error: "Assignee not found." };
  }

  if (!assignee.active) {
    return {
      ok: false,
      code: "VALIDATION",
      error: "Assignee must be an active person.",
    };
  }

  return { ok: true };
}

export async function createMilestone(
  projectId: string,
  input: unknown,
): Promise<ActionResult<Milestone>> {
  const session = await requireSessionResult();
  if (!session.ok) {
    return session;
  }

  const parsedProjectId = idSchema.safeParse(projectId);
  if (!parsedProjectId.success) {
    return { ok: false, code: "VALIDATION", error: "Invalid project id." };
  }
  projectId = parsedProjectId.data;

  const parsed = milestoneInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      error: parsed.error.issues[0]?.message ?? "Invalid milestone data.",
    };
  }

  const endDate = dateOnlyUTC(parsed.data.endDate ?? parsed.data.dueDate!);
  const result = await db.$transaction(
    async (tx) => {
      const assigneeCheck = await checkAssignee(parsed.data.assigneeId, tx);
      if (!assigneeCheck.ok) {
        return assigneeCheck;
      }

      const access = await authorizeProjectMutation(projectId, session, tx);
      if (!access.ok) {
        return access;
      }

      const milestone = await tx.milestone.create({
        data: {
          projectId,
          name: parsed.data.name,
          startDate: dateOnlyUTC(parsed.data.startDate ?? endDate),
          endDate,
          dueDate: endDate,
          done: parsed.data.done,
          assigneeId: parsed.data.assigneeId,
          updatedById: session.personId,
        },
      });
      return { ok: true as const, data: milestone };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  if (!result.ok) {
    return result;
  }

  revalidateProjectRoutes();
  return result;
}

export async function updateMilestone(
  id: string,
  version: number,
  input: unknown,
): Promise<ActionResult<Milestone>> {
  const session = await requireSessionResult();
  if (!session.ok) {
    return session;
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { ok: false, code: "VALIDATION", error: "Invalid milestone id." };
  }
  id = parsedId.data;

  const existing = await db.milestone.findFirst({
    where: { id, project: { isDemo: session.isDemo } },
    select: { projectId: true },
  });
  if (!existing) {
    return { ok: false, code: "NOT_FOUND", error: "Milestone not found." };
  }
  const access = await authorizeProjectMutation(existing.projectId, session);
  if (!access.ok) {
    return access;
  }

  const parsed = milestoneInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      error: parsed.error.issues[0]?.message ?? "Invalid milestone data.",
    };
  }

  const assigneeCheck = await checkAssignee(parsed.data.assigneeId);
  if (!assigneeCheck.ok) {
    return assigneeCheck;
  }

  const endDate = dateOnlyUTC(parsed.data.endDate ?? parsed.data.dueDate!);
  const updateResult = await db.milestone.updateMany({
    where: { id, version, project: access.projectWhere },
    data: {
      name: parsed.data.name,
      startDate: dateOnlyUTC(parsed.data.startDate ?? endDate),
      endDate,
      dueDate: endDate,
      done: parsed.data.done,
      assigneeId: parsed.data.assigneeId,
      version: { increment: 1 },
      updatedById: session.personId,
    },
  });

  if (updateResult.count === 0) {
    const exists = await db.milestone.findFirst({
      where: { id, project: { isDemo: session.isDemo } },
      select: { id: true },
    });
    if (exists) {
      return { ok: false, code: "CONFLICT", error: CONFLICT_MESSAGE };
    }
    return { ok: false, code: "NOT_FOUND", error: "Milestone not found." };
  }

  const milestone = await db.milestone.findUniqueOrThrow({ where: { id } });
  revalidateProjectRoutes();
  return { ok: true, data: milestone };
}

export async function deleteMilestone(
  id: string,
  version: number,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireSessionResult();
  if (!session.ok) {
    return session;
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { ok: false, code: "VALIDATION", error: "Invalid milestone id." };
  }
  id = parsedId.data;

  const milestone = await db.milestone.findFirst({
    where: { id, project: { isDemo: session.isDemo } },
    select: { projectId: true },
  });
  if (!milestone) {
    return { ok: false, code: "NOT_FOUND", error: "Milestone not found." };
  }
  const access = await authorizeProjectMutation(milestone.projectId, session);
  if (!access.ok) {
    return access;
  }
  const deleteResult = await db.milestone.deleteMany({
    where: { id, version, project: access.projectWhere },
  });

  if (deleteResult.count === 0) {
    return { ok: false, code: "CONFLICT", error: CONFLICT_MESSAGE };
  }

  revalidateProjectRoutes();
  return { ok: true, data: { id } };
}
