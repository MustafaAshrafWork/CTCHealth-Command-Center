"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import {
  generatePassword,
  hashPassword,
  verifyPassword,
} from "@/lib/password";
import {
  createSession,
  destroySession,
  requireSession,
} from "@/lib/session";
import type { ActionResult } from "@/lib/types";
import {
  changePasswordSchema,
  loginSchema,
  personNameSchema,
} from "@/lib/validation";

const SIGN_IN_REQUIRED = "You must be signed in to do that.";

async function requireSessionResult(): Promise<
  | { ok: true; personId: string }
  | { ok: false; code: "UNAUTHORIZED"; error: string }
> {
  try {
    const session = await requireSession();
    return { ok: true, personId: session.personId };
  } catch {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      error: SIGN_IN_REQUIRED,
    };
  }
}

export async function loginAs(
  personId: unknown,
  password: unknown,
): Promise<ActionResult<never>> {
  const parsed = loginSchema.safeParse({ personId, password });
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION", error: "Invalid password." };
  }

  const person = await db.person.findUnique({
    where: { id: parsed.data.personId },
    select: {
      id: true,
      name: true,
      active: true,
      canLogin: true,
      passwordHash: true,
    },
  });

  if (!person || !person.canLogin || !person.active) {
    return { ok: false, code: "UNAUTHORIZED", error: "Invalid password." };
  }

  if (person.passwordHash === null) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      error: "No password set — contact Mustafa.",
    };
  }

  if (!(await verifyPassword(parsed.data.password, person.passwordHash))) {
    return { ok: false, code: "UNAUTHORIZED", error: "Invalid password." };
  }

  await createSession({ id: person.id, name: person.name });
  redirect("/projects");
}

export async function createPerson(
  name: unknown,
): Promise<
  ActionResult<{ id: string; name: string; temporaryPassword: string }>
> {
  const session = await requireSessionResult();
  if (!session.ok) {
    return session;
  }

  const parsed = personNameSchema.safeParse(name);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION", error: "Enter a valid name." };
  }

  const admin = await db.person.findUnique({
    where: { id: session.personId },
    select: { active: true, isAdmin: true },
  });
  if (!admin?.active || !admin.isAdmin) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      error: "Only an administrator can add users.",
    };
  }

  const temporaryPassword = generatePassword();
  const passwordHash = await hashPassword(temporaryPassword);

  try {
    const person = await db.person.create({
      data: {
        name: parsed.data,
        canLogin: true,
        active: true,
        passwordHash,
        mustChangePassword: true,
      },
      select: { id: true, name: true },
    });

    revalidatePath("/login");
    return {
      ok: true,
      data: { ...person, temporaryPassword },
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        code: "VALIDATION",
        error: "Name already exists.",
      };
    }

    return {
      ok: false,
      code: "ERROR",
      error: "Could not add the user. Try again.",
    };
  }
}

export async function changePassword(
  input: unknown,
): Promise<ActionResult<null>> {
  const session = await requireSessionResult();
  if (!session.ok) {
    return session;
  }

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      error:
        parsed.error.issues[0]?.message ?? "Enter valid password details.",
    };
  }

  const person = await db.person.findUnique({
    where: { id: session.personId },
    select: { passwordHash: true, active: true, canLogin: true },
  });
  if (!person || !person.active || !person.canLogin) {
    return { ok: false, code: "UNAUTHORIZED", error: SIGN_IN_REQUIRED };
  }
  if (person.passwordHash === null) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      error: "No password set — contact Mustafa.",
    };
  }
  if (
    !(await verifyPassword(
      parsed.data.currentPassword,
      person.passwordHash,
    ))
  ) {
    return { ok: false, code: "UNAUTHORIZED", error: "Invalid password." };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.person.update({
    where: { id: session.personId },
    data: { passwordHash, mustChangePassword: false },
  });

  revalidatePath("/projects");
  return { ok: true, data: null };
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
