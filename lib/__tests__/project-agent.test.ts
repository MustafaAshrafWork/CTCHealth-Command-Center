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
  });
}

describe("runProjectAgent", () => {
  it("returns a null draft for a collecting envelope", async () => {
    const result = await runWith({
      message: "What's the project name?",
      status: "collecting",
      draft: null,
    });

    expect(result).toEqual({
      message: "What's the project name?",
      draft: null,
    });
  });

  it("returns the full draft for a complete ready envelope", async () => {
    const result = await runWith({
      message: "Review and confirm.",
      status: "ready",
      draft: validDraft,
    });

    expect(result).toEqual({
      message: "Review and confirm.",
      draft: validDraft,
    });
  });

  it("rejects an inverted date range", async () => {
    await expect(
      runWith({
        message: "Review and confirm.",
        status: "ready",
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
          status: "ready",
          draft: { ...validDraft, startDate: invalidDate },
        }),
      ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });

      await expect(
        runWith({
          message: "Review and confirm.",
          status: "ready",
          draft: { ...validDraft, endDate: invalidDate },
        }),
      ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    },
  );

  it("accepts a valid leap-day date", async () => {
    const result = await runWith({
      message: "Review and confirm.",
      status: "ready",
      draft: { ...validDraft, startDate: "2028-02-29", endDate: "2028-02-29" },
    });

    expect(result.draft?.startDate).toBe("2028-02-29");
    expect(result.draft?.endDate).toBe("2028-02-29");
  });

  it("rejects an owner name outside the valid list", async () => {
    await expect(
      runWith({
        message: "Review and confirm.",
        status: "ready",
        draft: { ...validDraft, ownerName: "Someone Unlisted" },
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("rejects an invalid category", async () => {
    await expect(
      runWith({
        message: "Review and confirm.",
        status: "ready",
        draft: { ...validDraft, category: "marketing" },
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("requires riskDetails when atRisk is true", async () => {
    await expect(
      runWith({
        message: "Review and confirm.",
        status: "ready",
        draft: { ...validDraft, atRisk: true, riskDetails: null },
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("requires helpDetails when needsHelp is true", async () => {
    await expect(
      runWith({
        message: "Review and confirm.",
        status: "ready",
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
      }),
    ).rejects.toBeInstanceOf(AIProviderError);
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
