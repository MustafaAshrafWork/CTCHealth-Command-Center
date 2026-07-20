import { describe, expect, it } from "vitest";

import { hasRemoteAdvanced, shouldShowStaleEditBanner } from "../optimistic-lock";

// Mirrors the server's `updateMany({ where: { id, version } })` optimistic
// lock: an update only applies if the submitted version still matches the
// record's current version, otherwise the record is left untouched. This
// documents the invariant the client guard in details-tab.tsx and
// milestone-section.tsx relies on: a save built on a stale `baseVersion` can
// never silently clobber a concurrent edit, only be rejected.
function simulateOptimisticUpdate(
  record: { version: number },
  submittedVersion: number,
): { applied: boolean; version: number } {
  if (record.version !== submittedVersion) {
    return { applied: false, version: record.version };
  }
  return { applied: true, version: record.version + 1 };
}

describe("hasRemoteAdvanced", () => {
  it("is false when versions match", () => {
    expect(hasRemoteAdvanced(3, 3)).toBe(false);
  });

  it("is true when the live version has moved past the base version", () => {
    expect(hasRemoteAdvanced(3, 4)).toBe(true);
  });

  it("is false for a brand-new record with no version yet (create mode)", () => {
    expect(hasRemoteAdvanced(null, null)).toBe(false);
    expect(hasRemoteAdvanced(null, 3)).toBe(false);
  });
});

describe("shouldShowStaleEditBanner", () => {
  it("does not warn when nothing changed and the form is untouched", () => {
    expect(
      shouldShowStaleEditBanner({
        baseVersion: 1,
        liveVersion: 1,
        dirty: false,
        conflict: false,
      }),
    ).toBe(false);
  });

  it("does not warn about remote drift while the form is clean (no edits to lose)", () => {
    expect(
      shouldShowStaleEditBanner({
        baseVersion: 1,
        liveVersion: 2,
        dirty: false,
        conflict: false,
      }),
    ).toBe(false);
  });

  it("warns when the record advanced remotely while the user has unsaved edits", () => {
    expect(
      shouldShowStaleEditBanner({
        baseVersion: 1,
        liveVersion: 2,
        dirty: true,
        conflict: false,
      }),
    ).toBe(true);
  });

  it("does not warn for a dirty form whose base is still current", () => {
    expect(
      shouldShowStaleEditBanner({
        baseVersion: 2,
        liveVersion: 2,
        dirty: true,
        conflict: false,
      }),
    ).toBe(false);
  });

  it("always warns once the server reports a CONFLICT, regardless of dirty/version state", () => {
    expect(
      shouldShowStaleEditBanner({
        baseVersion: 2,
        liveVersion: 2,
        dirty: false,
        conflict: true,
      }),
    ).toBe(true);
  });
});

describe("two-user stale refresh — project record", () => {
  it("flags (does not clobber) when User B's stale project edit meets User A's saved change", () => {
    // Both users load the project at version 1.
    const project = { version: 1 };
    const userBBaseVersion = 1;

    // User A saves first; the project record advances to version 2.
    const userASave = simulateOptimisticUpdate(project, 1);
    expect(userASave.applied).toBe(true);
    project.version = userASave.version; // version 2

    // User B never re-seeded their form (still editing, still dirty), so
    // their baseVersion is still 1 while the live prop now reports 2 — this
    // is exactly what should raise the reload banner instead of saving.
    expect(
      shouldShowStaleEditBanner({
        baseVersion: userBBaseVersion,
        liveVersion: project.version,
        dirty: true,
        conflict: false,
      }),
    ).toBe(true);

    // Even if User B submits anyway, the optimistic lock rejects it — the
    // update never applies against the now-stale version, so User A's save
    // is never clobbered.
    const userBSave = simulateOptimisticUpdate(project, userBBaseVersion);
    expect(userBSave.applied).toBe(false);
    expect(project.version).toBe(2);
  });
});

describe("two-user stale refresh — milestone record", () => {
  it("flags (does not clobber) when User B's stale milestone edit meets User A's saved change", () => {
    // Both users load the milestone at version 1.
    const milestone = { version: 1 };
    const userBBaseVersion = 1;

    // User A saves first; the milestone advances to version 2.
    const userASave = simulateOptimisticUpdate(milestone, 1);
    expect(userASave.applied).toBe(true);
    milestone.version = userASave.version; // version 2

    // User B's row was never re-keyed/re-seeded, so their baseVersion is
    // still 1 while the live prop now reports 2.
    expect(
      shouldShowStaleEditBanner({
        baseVersion: userBBaseVersion,
        liveVersion: milestone.version,
        dirty: true,
        conflict: false,
      }),
    ).toBe(true);

    // A submit built on the stale baseVersion is rejected, not applied.
    const userBSave = simulateOptimisticUpdate(milestone, userBBaseVersion);
    expect(userBSave.applied).toBe(false);
    expect(milestone.version).toBe(2);

    // The rejected save surfaces as a CONFLICT result, which the guard also
    // treats as a reason to show the banner.
    expect(
      shouldShowStaleEditBanner({
        baseVersion: userBBaseVersion,
        liveVersion: milestone.version,
        dirty: true,
        conflict: true,
      }),
    ).toBe(true);
  });
});
