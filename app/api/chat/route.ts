import { z } from "zod";

import { createProject } from "@/lib/actions/projects";
import { GeminiProvider } from "@/lib/ai/gemini";
import {
  buildCreateProjectInput,
  projectDraftSchema,
  runProjectAgent,
} from "@/lib/ai/project-agent";
import { AIProviderError } from "@/lib/ai/provider";
import { db } from "@/lib/db";
import { dateOnlyUTC } from "@/lib/health";
import { requireSession } from "@/lib/session";

// Confirmation writes through Prisma/SQLite, which requires the Node runtime.
export const runtime = "nodejs";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2_000),
});

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
  try {
    await requireSession();
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

  // Applies to every browser POST (chat and confirm alike) so neither the
  // paid Gemini call nor the write path is reachable cross-origin.
  if (!originIsValid(request)) {
    return Response.json(
      { ok: false, error: "Invalid request origin." },
      { status: 403 },
    );
  }

  if (parsed.data.action === "confirm") {
    const { draft } = parsed.data;

    // Never trust a client- or model-supplied id: resolve the owner name to
    // an active owner server-side, right before the write.
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
      const status =
        result.code === "VALIDATION"
          ? 400
          : result.code === "UNAUTHORIZED"
            ? 403
            : result.code === "NOT_FOUND"
              ? 404
              : result.code === "CONFLICT"
                ? 409
                : 500;
      return Response.json({ ok: false, error: result.error }, { status });
    }

    return Response.json({
      ok: true,
      project: { id: result.data.id, name: result.data.name },
    });
  }

  const owners = await fetchOwnerCandidates();

  try {
    const provider = new GeminiProvider();
    const turn = await runProjectAgent(provider, {
      messages: parsed.data.messages,
      ownerNames: owners.map((owner) => owner.name),
      today: todayDateOnly(),
    });
    return Response.json({ ok: true, message: turn.message, draft: turn.draft });
  } catch (error) {
    if (error instanceof AIProviderError) {
      const status = error.code === "NOT_CONFIGURED" ? 503 : 502;
      return Response.json({ ok: false, error: error.message }, { status });
    }
    return Response.json(
      { ok: false, error: "Something went wrong. Please try again." },
      { status: 502 },
    );
  }
}
