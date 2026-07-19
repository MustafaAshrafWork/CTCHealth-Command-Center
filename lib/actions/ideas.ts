"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "@/lib/types";
import { ideaSchema } from "@/lib/validation";

export async function createIdea(
  text: unknown,
): Promise<ActionResult<{ id: string }>> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      error: "You must be signed in to do that.",
    };
  }

  const parsed = ideaSchema.safeParse(text);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      error: parsed.error.issues[0]?.message ?? "Invalid idea.",
    };
  }

  const idea = await db.idea.create({
    data: { text: parsed.data, authorId: session.personId },
  });

  revalidatePath("/ideas");
  return { ok: true, data: { id: idea.id } };
}
