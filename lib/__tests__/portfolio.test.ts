import { describe, expect, it } from "vitest";

import {
  isDueWithin30,
  parsePortfolioSort,
  sortPortfolioProjects,
  type PortfolioSortable,
} from "../portfolio";

const TODAY = new Date("2026-07-20T00:00:00.000Z");

function project(
  overrides: Partial<PortfolioSortable> & Pick<PortfolioSortable, "id" | "name">,
): PortfolioSortable {
  return {
    client: "CTC",
    startDate: "2026-07-01T00:00:00.000Z",
    endDate: "2026-08-01T00:00:00.000Z",
    health: "green",
    ...overrides,
  };
}

describe("parsePortfolioSort", () => {
  it("defaults missing and invalid values to priority", () => {
    expect(parsePortfolioSort(undefined)).toBe("priority");
    expect(parsePortfolioSort("health")).toBe("priority");
  });

  it.each(["priority", "start", "end", "client"] as const)(
    "accepts %s",
    (value) => expect(parsePortfolioSort(value)).toBe(value),
  );
});

describe("sortPortfolioProjects", () => {
  it("sorts priority as red, amber, then green", () => {
    const rows = [
      project({ id: "g", name: "Green", health: "green" }),
      project({ id: "r", name: "Red", health: "red" }),
      project({ id: "a", name: "Amber", health: "amber" }),
    ];

    expect(sortPortfolioProjects(rows, "priority").map((row) => row.id)).toEqual([
      "r",
      "a",
      "g",
    ]);
    expect(rows.map((row) => row.id)).toEqual(["g", "r", "a"]);
  });

  it("breaks priority ties by earliest end date", () => {
    // Same health; the name and id strings are ordered opposite to the end
    // dates, so only the end-date tie-break can produce the asserted order.
    const rows = [
      project({ id: "z-early", name: "Zzz", health: "amber", endDate: "2026-08-01" }),
      project({ id: "a-late", name: "Aaa", health: "amber", endDate: "2026-09-01" }),
    ];

    expect(sortPortfolioProjects(rows, "priority").map((row) => row.id)).toEqual([
      "z-early",
      "a-late",
    ]);
  });

  it("supports chronological start and end sorting", () => {
    const later = project({
      id: "later",
      name: "Later",
      startDate: "2026-08-01",
      endDate: "2026-09-01",
    });
    const earlier = project({
      id: "earlier",
      name: "Earlier",
      startDate: "2026-07-01",
      endDate: "2026-08-01",
    });

    expect(sortPortfolioProjects([later, earlier], "start")[0]?.id).toBe(
      "earlier",
    );
    expect(sortPortfolioProjects([later, earlier], "end")[0]?.id).toBe(
      "earlier",
    );
  });

  it("sorts client ascending and breaks ties by earliest end date", () => {
    // The name and id strings are ordered opposite to the end dates, so the
    // Beta tie can only be broken by the end-date tie-break (not name or id).
    const rows = [
      project({ id: "z-beta-early", name: "Zzz", client: "Beta", endDate: "2026-08-01" }),
      project({ id: "a-beta-late", name: "Aaa", client: "Beta", endDate: "2026-09-01" }),
      project({ id: "m-alpha", name: "Mmm", client: "Alpha", endDate: "2026-12-01" }),
    ];

    // "Alpha" < "Beta" by localeCompare, so alpha leads despite its latest end
    // date; the two "Beta" rows tie on client and break by earliest end date.
    expect(sortPortfolioProjects(rows, "client").map((row) => row.id)).toEqual([
      "m-alpha",
      "z-beta-early",
      "a-beta-late",
    ]);
  });
});

describe("isDueWithin30", () => {
  it("includes incomplete projects due from today through day 30", () => {
    expect(isDueWithin30({ completed: false, endDate: "2026-07-20" }, TODAY)).toBe(
      true,
    );
    expect(isDueWithin30({ completed: false, endDate: "2026-08-19" }, TODAY)).toBe(
      true,
    );
  });

  it("excludes overdue, beyond-30-day, and completed projects", () => {
    expect(isDueWithin30({ completed: false, endDate: "2026-07-19" }, TODAY)).toBe(
      false,
    );
    expect(isDueWithin30({ completed: false, endDate: "2026-08-20" }, TODAY)).toBe(
      false,
    );
    expect(isDueWithin30({ completed: true, endDate: "2026-07-20" }, TODAY)).toBe(
      false,
    );
  });
});
