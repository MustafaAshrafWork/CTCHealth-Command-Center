import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findProject: vi.fn(),
  findPerson: vi.fn(),
}));

vi.mock("../db", () => ({
  db: {
    project: { findUnique: mocks.findProject },
    person: { findUnique: mocks.findPerson },
  },
}));

import {
  authorizeProjectCreation,
  authorizeProjectMutation,
} from "../project-authorization";

const realSession = { personId: "owner-1", isDemo: false };

describe("project mutation authorization", () => {
  beforeEach(() => {
    mocks.findProject.mockReset();
    mocks.findPerson.mockReset();
  });

  it("allows an active owner to change their project", async () => {
    mocks.findProject.mockResolvedValue({ ownerId: "owner-1", isDemo: false });
    mocks.findPerson.mockResolvedValue({
      active: true,
      canLogin: true,
      isAdmin: false,
      isDemo: false,
    });

    await expect(
      authorizeProjectMutation("project-1", realSession),
    ).resolves.toEqual({
      ok: true,
      projectWhere: { isDemo: false, ownerId: "owner-1" },
    });
  });

  it("allows an active administrator to change another owner's project", async () => {
    mocks.findProject.mockResolvedValue({ ownerId: "owner-2", isDemo: false });
    mocks.findPerson.mockResolvedValue({
      active: true,
      canLogin: true,
      isAdmin: true,
      isDemo: false,
    });

    await expect(
      authorizeProjectMutation("project-1", realSession),
    ).resolves.toEqual({
      ok: true,
      projectWhere: { isDemo: false },
    });
  });

  it("limits demo mutations to the demo partition in the write predicate", async () => {
    mocks.findProject.mockResolvedValue({ ownerId: "owner-2", isDemo: true });
    mocks.findPerson.mockResolvedValue({
      active: true,
      canLogin: true,
      isAdmin: false,
      isDemo: true,
    });

    await expect(
      authorizeProjectMutation("project-1", {
        personId: "demo-1",
        isDemo: true,
      }),
    ).resolves.toEqual({
      ok: true,
      projectWhere: { isDemo: true },
    });
  });

  it("denies an active non-owner", async () => {
    mocks.findProject.mockResolvedValue({ ownerId: "owner-2", isDemo: false });
    mocks.findPerson.mockResolvedValue({
      active: true,
      canLogin: true,
      isAdmin: false,
      isDemo: false,
    });

    const result = await authorizeProjectMutation("project-1", realSession);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNAUTHORIZED");
  });

  it("denies a deactivated owner even with a valid session payload", async () => {
    mocks.findProject.mockResolvedValue({ ownerId: "owner-1", isDemo: false });
    mocks.findPerson.mockResolvedValue({
      active: false,
      canLogin: true,
      isAdmin: false,
      isDemo: false,
    });

    const result = await authorizeProjectMutation("project-1", realSession);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNAUTHORIZED");
  });

  it("keeps real and demo records isolated", async () => {
    mocks.findProject.mockResolvedValue({ ownerId: "owner-1", isDemo: true });
    mocks.findPerson.mockResolvedValue({
      active: true,
      canLogin: true,
      isAdmin: true,
      isDemo: false,
    });

    const result = await authorizeProjectMutation("project-1", realSession);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });
});

describe("project creation authorization", () => {
  beforeEach(() => {
    mocks.findProject.mockReset();
    mocks.findPerson.mockReset();
  });

  it("allows an active person to create a self-owned project", async () => {
    mocks.findPerson.mockResolvedValue({
      active: true,
      canLogin: true,
      isAdmin: false,
      isDemo: false,
    });

    await expect(
      authorizeProjectCreation("owner-1", realSession),
    ).resolves.toEqual({ ok: true });
  });

  it("allows a non-admin manager to create a project for another owner", async () => {
    mocks.findPerson.mockResolvedValue({
      active: true,
      canLogin: true,
      isAdmin: false,
      isDemo: false,
    });

    await expect(
      authorizeProjectCreation("owner-2", realSession),
    ).resolves.toEqual({ ok: true });
  });

  it("does not let an inactive person use the self-owner shortcut", async () => {
    mocks.findPerson.mockResolvedValue({
      active: false,
      canLogin: true,
      isAdmin: false,
      isDemo: false,
    });

    const result = await authorizeProjectCreation("owner-1", realSession);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNAUTHORIZED");
  });
});
