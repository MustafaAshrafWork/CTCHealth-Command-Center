"use server";

import { Prisma, type WeeklyUpdate } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { dateOnlyUTC } from "@/lib/health";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "@/lib/types";
import { idSchema, weeklyUpdateConfirmedInputSchema } from "@/lib/validation";

function revalidateWeeklyUpdateRoutes(projectId: string): void {
  revalidatePath("/timeline");
  revalidatePath("/overview");
  revalidatePath("/leadership");
  revalidatePath(`/projects/${projectId}`);
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

export async function createWeeklyUpdateConfirmed(
  projectId: string,
  input: unknown,
): Promise<ActionResult<WeeklyUpdate>> {
  const session = await requireSessionResult();
  if (!session.ok) {
    return session;
  }

  const parsedProjectId = idSchema.safeParse(projectId);
  const parsed = weeklyUpdateConfirmedInputSchema.safeParse(input);
  if (!parsedProjectId.success || !parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      error: parsed.success
        ? "Invalid project id."
        : (parsed.error.issues[0]?.message ?? "Invalid weekly update."),
    };
  }
  projectId = parsedProjectId.data;

  const weekOf = dateOnlyUTC(parsed.data.weekOf);
  if (weekOf.getUTCDay() !== 1) {
    return {
      ok: false,
      code: "VALIDATION",
      error: "Week of must be a Monday.",
    };
  }

  try {
    const result = await db.$transaction(
      async (tx) => {
        const project = await tx.project.findUnique({
          where: { id: projectId, isDemo: session.isDemo },
          select: { ownerId: true },
        });
        if (!project) {
          return {
            ok: false as const,
            code: "NOT_FOUND" as const,
            error: "Project not found.",
          };
        }
        if (!session.isDemo && project.ownerId !== session.personId) {
          return {
            ok: false as const,
            code: "UNAUTHORIZED" as const,
            error: "Only the project owner can confirm its weekly update.",
          };
        }

        const weeklyUpdate = await tx.weeklyUpdate.create({
          data: {
            projectId,
            ownerId: session.isDemo ? project.ownerId : session.personId,
            weekOf,
            summary: parsed.data.summary,
            priorities: parsed.data.priorities,
            rawTranscript: parsed.data.rawTranscript,
          },
        });
        return { ok: true as const, data: weeklyUpdate };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if (!result.ok) {
      return result;
    }

    revalidateWeeklyUpdateRoutes(projectId);
    return result;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        code: "CONFLICT",
        error: "A weekly update already exists for this project owner and week.",
      };
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return {
        ok: false,
        code: "CONFLICT",
        error: "Project ownership changed while saving — reload and retry.",
      };
    }
    return {
      ok: false,
      code: "ERROR",
      error: "Could not save the weekly update.",
    };
  }
}
