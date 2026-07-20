import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { db } from "@/lib/db";
import type { Session } from "@/lib/types";

const COOKIE_NAME = "cc_session";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const DEV_SECRET_FALLBACK = "ctchealth-command-center-dev-secret-do-not-use-in-prod";

let warnedAboutFallbackSecret = false;

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET is required in production and must be set before using sessions.",
      );
    }

    if (!warnedAboutFallbackSecret) {
      console.warn(
        "SESSION_SECRET is not set — using an insecure development fallback secret.",
      );
      warnedAboutFallbackSecret = true;
    }
    return new TextEncoder().encode(DEV_SECRET_FALLBACK);
  }

  return new TextEncoder().encode(secret);
}

export async function createSession(person: {
  id: string;
  name: string;
  isDemo: boolean;
}): Promise<void> {
  const token = await new SignJWT({
    personId: person.id,
    name: person.name,
    isDemo: person.isDemo,
  } satisfies Session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const secretKey = getSecretKey();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (
      typeof payload.personId !== "string" ||
      typeof payload.name !== "string"
    ) {
      return null;
    }
    const isDemo = typeof payload.isDemo === "boolean" ? payload.isDemo : false;
    return { personId: payload.personId, name: payload.name, isDemo };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }

  // Sessions last up to 30 days, so every protected read/write must re-check
  // that the account has not been deactivated since the cookie was issued.
  const actor = await db.person.findUnique({
    where: { id: session.personId },
    select: { active: true, canLogin: true, isDemo: true },
  });
  if (
    !actor?.active ||
    !actor.canLogin ||
    actor.isDemo !== session.isDemo
  ) {
    throw new Error("UNAUTHORIZED");
  }

  return session;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
