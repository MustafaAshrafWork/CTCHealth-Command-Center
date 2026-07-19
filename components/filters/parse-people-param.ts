/**
 * Parse the `people` search param into a concrete selection.
 *
 * - `people=all` → no person filter ({ isAll: true })
 * - `people=id1,id2` → those ids, dropping ids not present in `validIds`.
 *   If nothing valid remains, fall back to the session persona.
 * - absent → session persona (the "My projects" default).
 */
export function parsePeopleParam(
  param: string | undefined,
  validIds: string[],
  sessionPersonId: string,
): { ids: string[]; isAll: boolean } {
  if (param === "all") {
    return { ids: [], isAll: true };
  }

  if (!param) {
    return { ids: [sessionPersonId], isAll: false };
  }

  const validSet = new Set(validIds);
  const ids = param
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && validSet.has(s));

  if (ids.length === 0) {
    return { ids: [sessionPersonId], isAll: false };
  }

  // Deduplicate while preserving order.
  return {
    ids: Array.from(new Set(ids)),
    isAll: false,
  };
}

export function personWhereClause(ids: string[]):
  | { OR: Array<Record<string, unknown>> }
  | Record<string, unknown> {
  if (ids.length === 0) {
    return {};
  }
  return {
    OR: [
      { ownerId: { in: ids } },
      { members: { some: { personId: { in: ids } } } },
    ],
  };
}