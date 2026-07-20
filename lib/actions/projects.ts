"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import type { Milestone, Person, Project, ProjectMember } from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";
import { dateOnlyUTC } from "@/lib/health";
import {
  authorizeProjectCreation,
  authorizeProjectMutation,
} from "@/lib/project-authorization";
import { sanitizePerson } from "@/lib/sanitize-person";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "@/lib/types";
import {
  idSchema,
  projectCreateSchema,
  projectInputSchema,
  projectStatusSchema,
} from "@/lib/validation";

export type ProjectInput = z.infer<typeof projectInputSchema>;

export type ProjectWithRelations = Project & {
  owner: Person;
  members: (ProjectMember & { person: Person })[];
  milestones: Milestone[];
};

type ProjectStatus = z.infer<typeof projectStatusSchema>;

const projectVersionRefSchema = z.object({
  id: idSchema,
  version: z.number().int().positive(),
});

export type ProjectVersionRef = z.infer<typeof projectVersionRefSchema>;

const PROJECT_ROUTES = [
  "/projects",
  "/board",
  "/timeline",
  "/leadership",
  "/archived",
] as const;

const projectInclude = {
  owner: true,
  members: { include: { person: true } },
  milestones: true,
} satisfies Prisma.ProjectInclude;

const CONFLICT_MESSAGE =
  "Project changed while you were editing — reload and retry.";

function revalidateProjectRoutes(): void {
  for (const route of PROJECT_ROUTES) {
    revalidatePath(route);
  }
  // Detail pages render project fields and optimistic-lock versions too.
  revalidatePath("/projects/[id]", "page");
}

function normalizeSharePointLink(
  value: string | undefined,
): string | null | undefined {
  return value === "" ? null : value;
}

function synchronizeLegacyStatus(status: ProjectStatus, completed: boolean): ProjectStatus {
  if (completed) {
    return "completed";
  }
  return status === "completed" ? "active" : status;
}

function sanitizeProjectResult(
  project: ProjectWithRelations,
): ProjectWithRelations {
  return {
    ...project,
    owner: sanitizePerson(project.owner),
    members: project.members.map((member) => ({
      ...member,
      person: sanitizePerson(member.person),
    })),
  };
}

async function assertRealPeople(
  personIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ids = Array.from(new Set(personIds));
  if (ids.length === 0) {
    return { ok: true };
  }
  const people = await db.person.findMany({
    where: { id: { in: ids } },
    select: { id: true, active: true, isDemo: true },
  });

  if (people.length !== ids.length) {
    return { ok: false, error: "Owner or member not found." };
  }

  if (people.some((person) => person.isDemo)) {
    return {
      ok: false,
      error: "Demo people cannot be assigned to real projects.",
    };
  }

  if (people.some((person) => !person.active)) {
    return {
      ok: false,
      error: "Owners, members, and milestone assignees must be active people.",
    };
  }

  return { ok: true };
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

export async function createProject(
  input: unknown,
): Promise<ActionResult<ProjectWithRelations>> {
  const session = await requireSessionResult();
  if (!session.ok) {
    return session;
  }

  const parsed = projectCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      error: parsed.error.issues[0]?.message ?? "Invalid project data.",
    };
  }

  const {
    memberIds,
    deliverables,
    startDate,
    endDate,
    progress = 0,
    completed,
    sharePointLink,
    ...rest
  } = parsed.data;
  const isCompleted = completed ?? rest.status === "completed";
  const access = await authorizeProjectCreation(rest.ownerId, session);
  if (!access.ok) {
    return access;
  }
  // The owner is never duplicated into the member list.
  const uniqueMemberIds = Array.from(new Set(memberIds)).filter(
    (personId) => personId !== rest.ownerId,
  );

  // The form defaults the owner to the session user; that self-ownership is
  // always allowed (demo included), so only check other people. Deliverable
  // assignees get the same vetting.
  const assigneeIds = deliverables.map(
    (deliverable) => deliverable.assigneeId ?? rest.ownerId,
  );
  const idsToCheck = [
    ...(rest.ownerId === session.personId ? [] : [rest.ownerId]),
    ...uniqueMemberIds,
    ...assigneeIds,
  ];
  const peopleCheck = await assertRealPeople(idsToCheck);
  if (!peopleCheck.ok) {
    return { ok: false, code: "VALIDATION", error: peopleCheck.error };
  }

  const project = await db.project.create({
    data: {
      ...rest,
      status: synchronizeLegacyStatus(rest.status, isCompleted),
      progress,
      completed: isCompleted,
      startDate: dateOnlyUTC(startDate),
      endDate: dateOnlyUTC(endDate),
      sharePointLink: normalizeSharePointLink(sharePointLink),
      isDemo: session.isDemo,
      createdById: session.personId,
      updatedById: session.personId,
      members: {
        create: uniqueMemberIds.map((personId) => ({ personId })),
      },
      milestones: {
        create: deliverables.map((deliverable) => {
          const endDate = dateOnlyUTC(
            deliverable.endDate ?? deliverable.dueDate!,
          );
          return {
            name: deliverable.name,
            startDate: dateOnlyUTC(deliverable.startDate ?? endDate),
            endDate,
            dueDate: endDate,
            done: false,
            assigneeId: deliverable.assigneeId ?? rest.ownerId,
            updatedById: session.personId,
          };
        }),
      },
    },
    include: projectInclude,
  });

  revalidateProjectRoutes();
  return { ok: true, data: sanitizeProjectResult(project) };
}

export async function updateProject(
  id: string,
  version: number,
  input: unknown,
): Promise<ActionResult<ProjectWithRelations>> {
  const session = await requireSessionResult();
  if (!session.ok) {
    return session;
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { ok: false, code: "VALIDATION", error: "Invalid project id." };
  }
  id = parsedId.data;

  const access = await authorizeProjectMutation(id, session);
  if (!access.ok) {
    return access;
  }

  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      error: parsed.error.issues[0]?.message ?? "Invalid project data.",
    };
  }

  const {
    memberIds,
    startDate,
    endDate,
    progress,
    completed,
    sharePointLink,
    ...rest
  } = parsed.data;
  const isCompleted = completed ?? rest.status === "completed";
  const uniqueMemberIds = Array.from(new Set(memberIds)).filter(
    (personId) => personId !== rest.ownerId,
  );

  const peopleCheck = await assertRealPeople([
    ...(rest.ownerId === session.personId ? [] : [rest.ownerId]),
    ...uniqueMemberIds,
  ]);
  if (!peopleCheck.ok) {
    return { ok: false, code: "VALIDATION", error: peopleCheck.error };
  }

  const updated = await db.$transaction(async (tx) => {
    const updateResult = await tx.project.updateMany({
      where: { id, version, ...access.projectWhere },
      data: {
        ...rest,
        status: synchronizeLegacyStatus(rest.status, isCompleted),
        ...(progress === undefined ? {} : { progress }),
        completed: isCompleted,
        startDate: dateOnlyUTC(startDate),
        endDate: dateOnlyUTC(endDate),
        sharePointLink: normalizeSharePointLink(sharePointLink),
        version: { increment: 1 },
        updatedById: session.personId,
      },
    });

    if (updateResult.count === 0) {
      return null;
    }

    await tx.projectMember.deleteMany({ where: { projectId: id } });
    if (uniqueMemberIds.length > 0) {
      await tx.projectMember.createMany({
        data: uniqueMemberIds.map((personId) => ({ projectId: id, personId })),
      });
    }

    return tx.project.findUniqueOrThrow({
      where: { id },
      include: projectInclude,
    });
  });

  if (updated === null) {
    const exists = await db.project.findUnique({
      where: { id, isDemo: session.isDemo },
      select: { id: true },
    });
    if (exists) {
      return { ok: false, code: "CONFLICT", error: CONFLICT_MESSAGE };
    }
    return { ok: false, code: "NOT_FOUND", error: "Project not found." };
  }

  revalidateProjectRoutes();
  return { ok: true, data: sanitizeProjectResult(updated) };
}

export async function setProjectStatus(
  id: string,
  version: number,
  status: unknown,
): Promise<ActionResult<{ id: string; version: number; status: ProjectStatus }>> {
  const session = await requireSessionResult();
  if (!session.ok) {
    return session;
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { ok: false, code: "VALIDATION", error: "Invalid project id." };
  }
  id = parsedId.data;

  const access = await authorizeProjectMutation(id, session);
  if (!access.ok) {
    return access;
  }

  const parsed = projectStatusSchema.safeParse(status);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION", error: "Invalid project status." };
  }

  const updateResult = await db.project.updateMany({
    where: { id, version, ...access.projectWhere },
    data: {
      status: parsed.data,
      completed: parsed.data === "completed",
      version: { increment: 1 },
      updatedById: session.personId,
    },
  });

  if (updateResult.count === 0) {
    const exists = await db.project.findUnique({
      where: { id, isDemo: session.isDemo },
      select: { id: true },
    });
    if (exists) {
      return { ok: false, code: "CONFLICT", error: CONFLICT_MESSAGE };
    }
    return { ok: false, code: "NOT_FOUND", error: "Project not found." };
  }

  revalidateProjectRoutes();
  const project = await db.project.findUniqueOrThrow({
    where: { id },
    select: { id: true, version: true },
  });
  return { ok: true, data: { ...project, status: parsed.data } };
}

export async function setProjectCompleted(
  id: string,
  version: number,
  completed: unknown,
): Promise<ActionResult<{ id: string; version: number; completed: boolean }>> {
  const session = await requireSessionResult();
  if (!session.ok) {
    return session;
  }

  const parsedId = idSchema.safeParse(id);
  const parsedCompleted = z.boolean().safeParse(completed);
  if (!parsedId.success || !parsedCompleted.success) {
    return {
      ok: false,
      code: "VALIDATION",
      error: "Invalid project completion update.",
    };
  }
  id = parsedId.data;

  const access = await authorizeProjectMutation(id, session);
  if (!access.ok) {
    return access;
  }

  const project = await db.project.findUnique({
    where: { id, isDemo: session.isDemo },
    select: { status: true },
  });
  if (!project) {
    return { ok: false, code: "NOT_FOUND", error: "Project not found." };
  }

  const updateResult = await db.project.updateMany({
    where: { id, version, ...access.projectWhere },
    data: {
      completed: parsedCompleted.data,
      status: parsedCompleted.data
        ? "completed"
        : project.status === "completed"
          ? "active"
          : project.status,
      version: { increment: 1 },
      updatedById: session.personId,
    },
  });

  if (updateResult.count === 0) {
    return { ok: false, code: "CONFLICT", error: CONFLICT_MESSAGE };
  }

  revalidateProjectRoutes();
  const updated = await db.project.findUniqueOrThrow({
    where: { id },
    select: { id: true, version: true, completed: true },
  });
  return { ok: true, data: updated };
}

export async function setArchived(
  projects: ProjectVersionRef[],
  archived: boolean,
): Promise<ActionResult<{ count: number }>> {
  const session = await requireSessionResult();
  if (!session.ok) {
    return session;
  }

  const parsedProjects = z.array(projectVersionRefSchema).min(1).safeParse(projects);
  if (!parsedProjects.success) {
    return { ok: false, code: "VALIDATION", error: "Select at least one project." };
  }

  const accessResults = await Promise.all(
    parsedProjects.data.map((project) =>
      authorizeProjectMutation(project.id, session),
    ),
  );
  const deniedAccess = accessResults.find((access) => !access.ok);
  if (deniedAccess && !deniedAccess.ok) {
    return deniedAccess;
  }

  const authorizedProjects = parsedProjects.data.map((project, index) => {
    const access = accessResults[index]!;
    if (!access.ok) {
      throw new Error("Project authorization changed unexpectedly.");
    }
    return { project, projectWhere: access.projectWhere };
  });

  const results = await Promise.all(
    authorizedProjects.map(({ project, projectWhere }) =>
      db.project.updateMany({
        where: {
          id: project.id,
          version: project.version,
          ...projectWhere,
          ...(archived ? { completed: true } : { archived: true }),
        },
        data: {
          archived,
          ...(!archived
            ? {
                completed: false,
                status: "active",
              }
            : {}),
          version: { increment: 1 },
          updatedById: session.personId,
        },
      }),
    ),
  );

  revalidateProjectRoutes();
  const succeededCount = results.reduce((count, result) => count + result.count, 0);
  const failedCount = parsedProjects.data.length - succeededCount;

  if (failedCount > 0) {
    const action = archived ? "archived" : "unarchived";
    const reason = archived
      ? "changed before this update or were not complete"
      : "changed before this update";
    return {
      ok: false,
      code: "CONFLICT",
      error:
        `${failedCount} of ${parsedProjects.data.length} projects ${reason}. ` +
        `${succeededCount} ${succeededCount === 1 ? "project was" : "projects were"} ${action}; ` +
        `reload and retry the ${failedCount} failed ${failedCount === 1 ? "project" : "projects"}.`,
    };
  }

  return { ok: true, data: { count: succeededCount } };
}

export async function removeProject(
  id: string,
  version: number,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireSessionResult();
  if (!session.ok) {
    return session;
  }

  const parsed = projectVersionRefSchema.safeParse({ id, version });
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      error: "Invalid project deletion request.",
    };
  }

  const access = await authorizeProjectMutation(parsed.data.id, session);
  if (!access.ok) {
    return access;
  }

  const project = await db.project.findUnique({
    where: { id: parsed.data.id, isDemo: session.isDemo },
    select: { archived: true },
  });
  if (!project) {
    return { ok: false, code: "NOT_FOUND", error: "Project not found." };
  }
  if (!project.archived) {
    return {
      ok: false,
      code: "VALIDATION",
      error: "Only archived projects can be permanently deleted.",
    };
  }

  const deleted = await db.project.deleteMany({
    where: {
      id: parsed.data.id,
      version: parsed.data.version,
      ...access.projectWhere,
      archived: true,
    },
  });
  if (deleted.count === 0) {
    return { ok: false, code: "CONFLICT", error: CONFLICT_MESSAGE };
  }

  revalidateProjectRoutes();
  return { ok: true, data: { id: parsed.data.id } };
}
