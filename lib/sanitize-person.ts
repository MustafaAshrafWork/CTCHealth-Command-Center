import type { Person } from "@prisma/client";

// Person rows cross into client-component props on several pages; strip the
// credential hash so it never rides along in the serialized RSC payload.
export function sanitizePerson<T extends Person>(person: T): T {
  return { ...person, passwordHash: null };
}
