import { afterEach, describe, expect, it } from "vitest";

import {
  milestoneInputSchema,
  projectCreateSchema,
  projectInputSchema,
  weeklyUpdateConfirmedInputSchema,
} from "../validation";

const project = {
  name: "Command Centre",
  client: "CTCHealth",
  category: "tech",
  status: "active",
  priority: "medium",
  ownerId: "owner-1",
  memberIds: [],
  startDate: new Date("2026-07-01T00:00:00.000Z"),
  endDate: new Date("2026-08-01T00:00:00.000Z"),
};

const originalSharePointAllowedHosts =
  process.env.SHAREPOINT_ALLOWED_HOSTS;

afterEach(() => {
  if (originalSharePointAllowedHosts === undefined) {
    delete process.env.SHAREPOINT_ALLOWED_HOSTS;
  } else {
    process.env.SHAREPOINT_ALLOWED_HOSTS = originalSharePointAllowedHosts;
  }
});

function sharePointLinkErrors(value: string): string[] {
  const result = projectInputSchema.safeParse({
    ...project,
    sharePointLink: value,
  });
  return result.success
    ? []
    : result.error.issues
        .filter((issue) => issue.path[0] === "sharePointLink")
        .map((issue) => issue.message);
}

describe("briefing project validation", () => {
  it("accepts manual progress boundaries for create and edit", () => {
    expect(
      projectCreateSchema.safeParse({
        ...project,
        progress: 0,
        completed: false,
        deliverables: [],
      }).success,
    ).toBe(true);
    expect(projectInputSchema.safeParse({ ...project, progress: 100 }).success).toBe(
      true,
    );
  });

  it("rejects progress outside 0 through 100", () => {
    expect(projectInputSchema.safeParse({ ...project, progress: -1 }).success).toBe(
      false,
    );
    expect(projectInputSchema.safeParse({ ...project, progress: 101 }).success).toBe(
      false,
    );
  });

  it("accepts a positive budget, a null budget, or an omitted budget", () => {
    expect(projectInputSchema.safeParse({ ...project, budget: 1_000 }).success).toBe(
      true,
    );
    expect(projectInputSchema.safeParse({ ...project, budget: null }).success).toBe(
      true,
    );
    expect(projectInputSchema.safeParse(project).success).toBe(true);
  });

  it("rejects a negative or non-finite budget", () => {
    expect(projectInputSchema.safeParse({ ...project, budget: -1 }).success).toBe(
      false,
    );
    expect(
      projectInputSchema.safeParse({ ...project, budget: Number.NaN }).success,
    ).toBe(false);
  });

  it.each(["2026-02-31", "2025-02-29", "2026-13-01", "2026-00-10"])(
    "rejects an impossible calendar date %s for startDate and endDate",
    (invalidDate) => {
      expect(
        projectInputSchema.safeParse({ ...project, startDate: invalidDate }).success,
      ).toBe(false);
      expect(
        projectInputSchema.safeParse({ ...project, endDate: invalidDate }).success,
      ).toBe(false);
    },
  );

  it("accepts a valid leap-day date", () => {
    expect(
      projectInputSchema.safeParse({
        ...project,
        startDate: "2028-02-29",
        endDate: "2028-02-29",
      }).success,
    ).toBe(true);
  });
});

describe("SharePoint link validation", () => {
  it("allows an omitted or empty optional link without an allowlist", () => {
    delete process.env.SHAREPOINT_ALLOWED_HOSTS;

    expect(projectInputSchema.safeParse(project).success).toBe(true);
    expect(
      projectInputSchema.safeParse({ ...project, sharePointLink: "   " }).success,
    ).toBe(true);
  });

  it("rejects a non-empty link when the server allowlist is not configured", () => {
    delete process.env.SHAREPOINT_ALLOWED_HOSTS;

    expect(
      sharePointLinkErrors("https://ctchealth.sharepoint.com/projects"),
    ).toContain(
      "SharePoint links are disabled until SHAREPOINT_ALLOWED_HOSTS is configured.",
    );
  });

  it("requires HTTPS even when the hostname is allowed", () => {
    process.env.SHAREPOINT_ALLOWED_HOSTS = "ctchealth.sharepoint.com";

    expect(
      sharePointLinkErrors("http://ctchealth.sharepoint.com/projects"),
    ).toContain("SharePoint link must use HTTPS.");
  });

  it("accepts an exact hostname from a comma-separated allowlist", () => {
    process.env.SHAREPOINT_ALLOWED_HOSTS =
      " first.sharepoint.com, CTCHealth.SharePoint.com ";

    expect(
      projectInputSchema.safeParse({
        ...project,
        sharePointLink: "https://ctchealth.sharepoint.com/projects/command-centre",
      }).success,
    ).toBe(true);
  });

  it.each([
    "https://files.ctchealth.sharepoint.com/projects",
    "https://ctchealth.sharepoint.com.evil.example/projects",
  ])("rejects non-exact hostname %s", (value) => {
    process.env.SHAREPOINT_ALLOWED_HOSTS = "ctchealth.sharepoint.com";

    expect(sharePointLinkErrors(value)).toContain(
      `SharePoint hostname "${new URL(value).hostname}" is not allowed. Use an approved SharePoint host.`,
    );
  });

  it("returns useful feedback for malformed URLs", () => {
    process.env.SHAREPOINT_ALLOWED_HOSTS = "ctchealth.sharepoint.com";

    expect(sharePointLinkErrors("not a URL")).toContain(
      "Enter a valid SharePoint HTTPS URL.",
    );
  });
});

describe("briefing milestone validation", () => {
  it("accepts a start/end range and the legacy due-date shape", () => {
    expect(
      milestoneInputSchema.safeParse({
        name: "Discovery",
        startDate: "2026-07-01",
        endDate: "2026-07-10",
        done: false,
        assigneeId: "owner-1",
      }).success,
    ).toBe(true);
    expect(
      milestoneInputSchema.safeParse({
        name: "Legacy marker",
        dueDate: "2026-07-10",
        done: false,
        assigneeId: "owner-1",
      }).success,
    ).toBe(true);
  });

  it("rejects an inverted date range", () => {
    expect(
      milestoneInputSchema.safeParse({
        name: "Invalid range",
        startDate: "2026-07-11",
        endDate: "2026-07-10",
        done: false,
        assigneeId: "owner-1",
      }).success,
    ).toBe(false);
  });

  it("requires an owner for standalone milestone writes", () => {
    expect(
      milestoneInputSchema.safeParse({
        name: "Discovery",
        startDate: "2026-07-01",
        endDate: "2026-07-10",
        done: false,
      }).success,
    ).toBe(false);
  });

  it("allows an initial milestone owner to default to the selected project owner", () => {
    expect(
      projectCreateSchema.safeParse({
        ...project,
        deliverables: [
          {
            name: "Discovery",
            startDate: "2026-07-01",
            endDate: "2026-07-10",
          },
        ],
      }).success,
    ).toBe(true);
  });
});

describe("confirmed weekly update validation", () => {
  const update = {
    weekOf: "2026-07-20",
    summary: "Delivery moved forward.",
    priorities: "Confirm stakeholder review.",
  };

  it("requires explicit confirmation before write", () => {
    expect(
      weeklyUpdateConfirmedInputSchema.safeParse({ ...update, confirmed: true })
        .success,
    ).toBe(true);
    expect(weeklyUpdateConfirmedInputSchema.safeParse(update).success).toBe(false);
  });
});
