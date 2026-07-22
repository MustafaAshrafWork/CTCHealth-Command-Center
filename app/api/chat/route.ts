import { z } from "zod";

import { createIdea } from "@/lib/actions/ideas";
import {
  archiveProject,
  createProject,
  removeProject,
  updateProject,
} from "@/lib/actions/projects";
import { GeminiProvider } from "@/lib/ai/gemini";
import {
  buildCreateProjectInput,
  buildEditProjectInput,
  projectDraftSchema,
  runProjectAgent,
  type ProjectSummary,
} from "@/lib/ai/project-agent";
import { AIProviderError } from "@/lib/ai/provider";
import { db } from "@/lib/db";
import { dateOnlyUTC } from "@/lib/health";
import { requireSession } from "@/lib/session";
import type { Session } from "@/lib/types";

// Confirmation writes through Prisma/SQLite, which requires the Node runtime.
export const runtime = "nodejs";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2_000),
});

const idSchema = z.string().trim().min(1).max(64);

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("chat"),
    messages: z.array(chatMessageSchema).min(1).max(24),
  }),
  z.object({
    action: z.literal("confirm"),
    confirmed: z.literal(true),
    draft: projectDraftSchema,
  }),
  z.object({
    action: z.literal("confirm-edit"),
    confirmed: z.literal(true),
    projectId: idSchema,
    draft: projectDraftSchema,
  }),
  z.object({
    action: z.literal("confirm-delete"),
    confirmed: z.literal(true),
    projectId: idSchema,
  }),
  z.object({
    action: z.literal("confirm-idea"),
    confirmed: z.literal(true),
    idea: z.string().trim().min(1).max(2_000),
  }),
]);

function todayDateOnly(): string {
  return dateOnlyUTC(new Date()).toISOString().slice(0, 10);
}

function fetchOwnerCandidates() {
  // Only active, login-enabled, real people may own a project created here.
  return db.person.findMany({
    where: { active: true, canLogin: true, isDemo: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

// Every project the signed-in user can already see, in the same isDemo
// partition the rest of the app uses, summarised for the AI to reason over.
async function fetchProjectContext(
  session: Session,
): Promise<ProjectSummary[]> {
  const projects = await db.project.findMany({
    where: { isDemo: session.isDemo },
    include: {
      owner: { select: { name: true } },
      members: { select: { person: { select: { name: true } } } },
    },
    orderBy: { endDate: "asc" },
  });

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    client: project.client,
    category: project.category,
    status: project.status,
    ownerName: project.owner.name,
    memberNames: project.members.map((member) => member.person.name),
    startDate: project.startDate.toISOString().slice(0, 10),
    endDate: project.endDate.toISOString().slice(0, 10),
    budget: project.budget,
    currency: project.currency,
    progress: project.progress,
    archived: project.archived,
    completed: project.completed,
    notes: project.notes,
  }));
}

function statusForCode(code: string): number {
  switch (code) {
    case "VALIDATION":
      return 400;
    case "UNAUTHORIZED":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    default:
      return 500;
  }
}

function originIsValid(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  let session: Session;
  try {
    session = await requireSession();
  } catch {
    return Response.json(
      { ok: false, error: "You must be signed in to do that." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  // Applies to every browser POST so neither the paid Gemini call nor any write
  // path is reachable cross-origin.
  if (!originIsValid(request)) {
    return Response.json(
      { ok: false, error: "Invalid request origin." },
      { status: 403 },
    );
  }

  if (parsed.data.action === "confirm") {
    const { draft } = parsed.data;

    // Never trust a client- or model-supplied id: resolve the owner name to an
    // active owner server-side, right before the write.
    const owners = await fetchOwnerCandidates();
    const owner = owners.find((candidate) => candidate.name === draft.ownerName);
    if (!owner) {
      return Response.json(
        { ok: false, error: "The selected owner is no longer available." },
        { status: 404 },
      );
    }

    const result = await createProject(buildCreateProjectInput(draft, owner.id));
    if (!result.ok) {
      return Response.json(
        { ok: false, error: result.error },
        { status: statusForCode(result.code) },
      );
    }

    return Response.json({
      ok: true,
      project: { id: result.data.id, name: result.data.name },
    });
  }

  if (parsed.data.action === "confirm-edit") {
    const { projectId, draft } = parsed.data;

    const owners = await fetchOwnerCandidates();
    const owner = owners.find((candidate) => candidate.name === draft.ownerName);
    if (!owner) {
      return Response.json(
        { ok: false, error: "The selected owner is no longer available." },
        { status: 404 },
      );
    }

    // Read the project's current state (and version) right before the write, so
    // the edit preserves fields the AI draft does not describe and the
    // optimistic lock uses a fresh version.
    const current = await db.project.findFirst({
      where: { id: projectId, isDemo: session.isDemo },
      include: { members: { select: { personId: true } } },
    });
    if (!current) {
      return Response.json(
        { ok: false, error: "Project not found." },
        { status: 404 },
      );
    }

    const result = await updateProject(
      projectId,
      current.version,
      buildEditProjectInput(draft, owner.id, {
        status: current.status,
        priority: current.priority,
        progress: current.progress,
        completed: current.completed,
        memberIds: current.members.map((member) => member.personId),
        notes: current.notes,
      }),
    );
    if (!result.ok) {
      return Response.json(
        { ok: false, error: result.error },
        { status: statusForCode(result.code) },
      );
    }

    return Response.json({
      ok: true,
      project: { id: result.data.id, name: result.data.name },
    });
  }

  if (parsed.data.action === "confirm-delete") {
    const { projectId } = parsed.data;

    const current = await db.project.findFirst({
      where: { id: projectId, isDemo: session.isDemo },
      select: { id: true, name: true, version: true, archived: true },
    });
    if (!current) {
      return Response.json(
        { ok: false, error: "Project not found." },
        { status: 404 },
      );
    }

    // Only archived projects can be permanently removed. An active project is
    // archived instead (reversible) so the destructive path stays safe.
    const result = current.archived
      ? await removeProject(projectId, current.version)
      : await archiveProject(projectId, current.version);

    if (!result.ok) {
      return Response.json(
        { ok: false, error: result.error },
        { status: statusForCode(result.code) },
      );
    }

    return Response.json({
      ok: true,
      deleted: current.archived,
      project: { id: current.id, name: current.name },
    });
  }

  if (parsed.data.action === "confirm-idea") {
    const result = await createIdea(parsed.data.idea);
    if (!result.ok) {
      return Response.json(
        { ok: false, error: result.error },
        { status: statusForCode(result.code) },
      );
    }
    return Response.json({ ok: true, ideaId: result.data.id });
  }

  const [owners, projects] = await Promise.all([
    fetchOwnerCandidates(),
    fetchProjectContext(session),
  ]);

  try {
    const provider = new GeminiProvider();
    const turn = await runProjectAgent(provider, {
      messages: parsed.data.messages,
      ownerNames: owners.map((owner) => owner.name),
      today: todayDateOnly(),
      projects,
    });
    return Response.json({ ok: true, turn });
  } catch (error) {
    if (error instanceof AIProviderError) {
      const status =
        error.code === "NOT_CONFIGURED"
          ? 503
          : error.code === "RATE_LIMITED"
            ? 429
            : 502;
      return Response.json({ ok: false, error: error.message }, { status });
    }
    return Response.json(
      { ok: false, error: "Something went wrong. Please try again." },
      { status: 502 },
    );
  }
}
