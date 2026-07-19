import { describe, expect, it } from "vitest";

import { assertProjectSeedAllowed } from "./seed-guard";

describe("assertProjectSeedAllowed", () => {
  it("allows project seeding into an empty database", () => {
    expect(() => assertProjectSeedAllowed(0, undefined)).not.toThrow();
  });

  it("blocks replacement when projects exist without the destructive flag", () => {
    expect(() => assertProjectSeedAllowed(3, undefined)).toThrow(
      /Seed aborted: found 3 existing projects.*SEED_DESTRUCTIVE=1/,
    );
  });

  it("allows explicit destructive replacement", () => {
    expect(() => assertProjectSeedAllowed(3, "1")).not.toThrow();
  });
});
