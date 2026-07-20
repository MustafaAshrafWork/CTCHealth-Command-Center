import type { Prisma } from "@prisma/client";

import { db } from "./db";

export type ProjectMutationSession = {
  personId: string;
  isDemo: boolean;
};

export type ProjectMutationAccess =
  | { ok: true; projectWhere: ProjectMutationWhere }
  | { ok: false; code: "NOT_FOUND" | "UNAUTHORIZED"; error: string };

export type ProjectCreationAccess =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "UNAUTHORIZED"; error: string };

export type ProjectMutationWhere = {
  isDemo: boolean;
  ownerId?: string;
};

type AuthorizationClient = Pick<Prisma.TransactionClient, "person" | "project">;

/**
 * Local POC authorization for project-owned records.
 *
 * Real records may be changed only by the current project owner or an active
 * administrator. The isolated demo account may change demo records so the
 * read/write walkthrough remains usable even though demo projects deliberately
 * retain real-looking owner names.
 */
export async function authorizeProjectMutation(
  projectId: string,
  session: ProjectMutationSession,
  client: AuthorizationClient = db,
): Promise<ProjectMutationAccess> {
  const [project, actor] = await Promise.all([
    client.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true, isDemo: true },
    }),
    client.person.findUnique({
      where: { id: session.personId },
      select: { active: true, canLogin: true, isAdmin: true, isDemo: true },
    }),
  ]);

  if (
    !actor?.active ||
    !actor.canLogin ||
    actor.isDemo !== session.isDemo
  ) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      error: "Your account is not allowed to change projects.",
    };
  }

  if (!project || project.isDemo !== session.isDemo) {
    return { ok: false, code: "NOT_FOUND", error: "Project not found." };
  }

  if (session.isDemo) {
    return { ok: true, projectWhere: { isDemo: true } };
  }

  if (!actor.isAdmin && project.ownerId !== session.personId) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      error: "Only the project owner or an administrator can change this project.",
    };
  }

  return {
    ok: true,
    projectWhere: actor.isAdmin
      ? { isDemo: false }
      : { isDemo: false, ownerId: session.personId },
  };
}

export async function authorizeProjectCreation(
  _ownerId: string,
  session: ProjectMutationSession,
): Promise<ProjectCreationAccess> {
  const actor = await db.person.findUnique({
    where: { id: session.personId },
    select: { active: true, canLogin: true, isAdmin: true, isDemo: true },
  });

  if (
    !actor?.active ||
    !actor.canLogin ||
    actor.isDemo !== session.isDemo
  ) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      error: "Your account is not allowed to create projects.",
    };
  }

  // Pilot scope: every active, login-enabled manager may create a project
  // for any owner in their real/demo partition. `assertRealPeople` still
  // vets the target owner's active/real status before the write happens.
  return { ok: true };
}
