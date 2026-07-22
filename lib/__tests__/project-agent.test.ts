import { describe, expect, it, vi } from "vitest";

import type { AIProvider } from "../ai/provider";
import { AIProviderError } from "../ai/provider";
import { buildCreateProjectInput, runProjectAgent } from "../ai/project-agent";

const OWNER_NAMES = ["Jane Doe", "Other Owner"];
const TODAY = "2026-07-20";

const validDraft = {
  name: "Website Revamp",
  ownerName: "Jane Doe",
  client: "Acme Corp",
  category: "tech" as const,
  startDate: "2026-08-01",
  endDate: "2026-09-01",
  budget: 5000,
  currency: "CHF" as const,
  atRisk: true,
  riskDetails: "Tight timeline",
  needsHelp: true,
  helpDetails: "Design support from Sam",
};

function stubProvider(text: string): AIProvider {
  return { generate: vi.fn().mockResolvedValue({ text }) };
}

function envelope(body: unknown): string {
  return JSON.stringify(body);
}

async function runWith(body: unknown) {
  return runProjectAgent(stubProvider(envelope(body)), {
    messages: [{ role: "user", content: "hi" }],
    ownerNames: OWNER_NAMES,
    today: TODAY,
    projects: [],
  });
}

describe("runProjectAgent", () => {
  it("returns just a message for an answer envelope", async () => {
    const result = await runWith({
      message: "What's the project name?",
      action: "answer",
      targetProjectId: null,
      draft: null,
    });

    expect(result).toEqual({
      action: "answer",
      message: "What's the project name?",
    });
  });

  it("returns the full draft for a complete create envelope", async () => {
    const result = await runWith({
      message: "Review and confirm.",
      action: "create",
      targetProjectId: null,
      draft: validDraft,
    });

    expect(result).toEqual({
      action: "create",
      message: "Review and confirm.",
      draft: validDraft,
    });
  });

  it("rejects an inverted date range", async () => {
    await expect(
      runWith({
        message: "Review and confirm.",
        action: "create",
        targetProjectId: null,
        draft: { ...validDraft, startDate: "2026-09-02", endDate: "2026-09-01" },
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it.each(["2026-02-31", "2025-02-29", "2026-13-01", "2026-00-10"])(
    "rejects an impossible calendar date %s in the draft instead of normalizing it",
    async (invalidDate) => {
      await expect(
        runWith({
          message: "Review and confirm.",
          action: "create",
        targetProjectId: null,
          draft: { ...validDraft, startDate: invalidDate },
        }),
      ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });

      await expect(
        runWith({
          message: "Review and confirm.",
          action: "create",
        targetProjectId: null,
          draft: { ...validDraft, endDate: invalidDate },
        }),
      ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    },
  );

  it("accepts a valid leap-day date", async () => {
    const result = await runWith({
      message: "Review and confirm.",
      action: "create",
        targetProjectId: null,
      draft: { ...validDraft, startDate: "2028-02-29", endDate: "2028-02-29" },
    });

    expect(result.action).toBe("create");
    if (result.action !== "create") {
      throw new Error("expected a create draft");
    }
    expect(result.draft.startDate).toBe("2028-02-29");
    expect(result.draft.endDate).toBe("2028-02-29");
  });

  it("rejects an owner name outside the valid list", async () => {
    await expect(
      runWith({
        message: "Review and confirm.",
        action: "create",
        targetProjectId: null,
        draft: { ...validDraft, ownerName: "Someone Unlisted" },
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("rejects an invalid category", async () => {
    await expect(
      runWith({
        message: "Review and confirm.",
        action: "create",
        targetProjectId: null,
        draft: { ...validDraft, category: "marketing" },
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("requires riskDetails when atRisk is true", async () => {
    await expect(
      runWith({
        message: "Review and confirm.",
        action: "create",
        targetProjectId: null,
        draft: { ...validDraft, atRisk: true, riskDetails: null },
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("requires helpDetails when needsHelp is true", async () => {
    await expect(
      runWith({
        message: "Review and confirm.",
        action: "create",
        targetProjectId: null,
        draft: { ...validDraft, needsHelp: true, helpDetails: null },
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("rejects malformed JSON instead of inventing a draft", async () => {
    await expect(
      runProjectAgent(stubProvider("not json"), {
        messages: [{ role: "user", content: "hi" }],
        ownerNames: OWNER_NAMES,
        today: TODAY,
        projects: [],
      }),
    ).rejects.toBeInstanceOf(AIProviderError);
  });

  it("rejects an edit that targets a project not in context", async () => {
    await expect(
      runWith({
        action: "edit",
        message: "Updating.",
        targetProjectId: "does-not-exist",
        draft: validDraft,
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});

describe("runProjectAgent with project context", () => {
  const SAMPLE = {
    id: "proj-1",
    name: "Ejada Webinar",
    client: "Ejada",
    category: "consultancy",
    status: "planning",
    ownerName: "Jane Doe",
    memberNames: ["Sam"],
    startDate: "2026-07-21",
    endDate: "2026-07-28",
    budget: 9000,
    currency: "CHF",
    progress: 0,
    archived: false,
    completed: false,
    notes: "Initial project intake",
  };

  function runWithProjects(body: unknown) {
    return runProjectAgent(stubProvider(envelope(body)), {
      messages: [{ role: "user", content: "hi" }],
      ownerNames: OWNER_NAMES,
      today: TODAY,
      projects: [SAMPLE],
    });
  }

  it("returns an answer turn for a read question", async () => {
    const result = await runWithProjects({
      action: "answer",
      message: "You have 1 project: Ejada Webinar.",
      targetProjectId: null,
      draft: null,
    });
    expect(result).toEqual({
      action: "answer",
      message: "You have 1 project: Ejada Webinar.",
    });
  });

  it("returns an edit turn for a known project", async () => {
    const result = await runWithProjects({
      action: "edit",
      message: "Review the changes.",
      targetProjectId: "proj-1",
      draft: validDraft,
    });
    expect(result).toEqual({
      action: "edit",
      message: "Review the changes.",
      targetProjectId: "proj-1",
      draft: validDraft,
    });
  });

  it("returns a delete turn for a known project", async () => {
    const result = await runWithProjects({
      action: "delete",
      message: "Confirm to delete.",
      targetProjectId: "proj-1",
      draft: null,
    });
    expect(result).toEqual({
      action: "delete",
      message: "Confirm to delete.",
      targetProjectId: "proj-1",
    });
  });

  it("returns a suggest-idea turn for an unsupported request", async () => {
    const result = await runWithProjects({
      action: "suggest-idea",
      message: "I can't do that, but I can log it as an idea.",
      idea: "Add a dark mode to the dashboard.",
      targetProjectId: null,
      draft: null,
    });
    expect(result).toEqual({
      action: "suggest-idea",
      message: "I can't do that, but I can log it as an idea.",
      idea: "Add a dark mode to the dashboard.",
    });
  });
});

describe("buildCreateProjectInput", () => {
  it("maps a draft to the exact createProject input shape", () => {
    expect(buildCreateProjectInput(validDraft, "owner-123")).toEqual({
      name: "Website Revamp",
      client: "Acme Corp",
      category: "tech",
      ownerId: "owner-123",
      startDate: "2026-08-01",
      endDate: "2026-09-01",
      budget: 5000,
      currency: "CHF",
      status: "planning",
      priority: "medium",
      memberIds: [],
      progress: 0,
      completed: false,
      deliverables: [],
      notes:
        "Initial project intake\nAt risk: yes — Tight timeline\nNeeds help: yes — Design support from Sam",
    });
  });

  it("records plain no-risk/no-help answers", () => {
    const draft = {
      ...validDraft,
      atRisk: false,
      riskDetails: null,
      needsHelp: false,
      helpDetails: null,
    };

    expect(buildCreateProjectInput(draft, "owner-123").notes).toBe(
      "Initial project intake\nAt risk: no\nNeeds help: no",
    );
  });
});
