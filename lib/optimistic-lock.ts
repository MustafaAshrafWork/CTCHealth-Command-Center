// Shared guard for edit forms that use optimistic concurrency (a `version`
// column checked via `updateMany({ where: { id, version } })`).
//
// Field state in these forms is seeded once when editing starts and is
// deliberately NOT re-seeded on every prop refresh — doing so would discard
// in-progress typing. That means the `version` a form's fields are based on
// (`baseVersion`) can fall behind the latest known server version
// (`liveVersion`) while the user is still editing. This helper decides when
// that drift should be surfaced to the user, without ever silently
// overwriting or discarding their unsaved edits.

export function hasRemoteAdvanced(
  baseVersion: number | null,
  liveVersion: number | null,
): boolean {
  return (
    baseVersion !== null && liveVersion !== null && baseVersion !== liveVersion
  );
}

export function shouldShowStaleEditBanner(input: {
  baseVersion: number | null;
  liveVersion: number | null;
  dirty: boolean;
  conflict: boolean;
}): boolean {
  if (input.conflict) {
    return true;
  }
  return input.dirty && hasRemoteAdvanced(input.baseVersion, input.liveVersion);
}
