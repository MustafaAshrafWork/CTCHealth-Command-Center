import { describe, expect, it } from "vitest";

import {
  computeHealth,
  dateOnlyUTC,
  deriveProgress,
  healthLabel,
} from "../health";

const TODAY = new Date("2026-07-19T00:00:00.000Z");

function project(
  daysFromToday: number,
  progress: number,
  completed = false,
) {
  const endDate = new Date(TODAY);
  endDate.setUTCDate(endDate.getUTCDate() + daysFromToday);

  return { completed, endDate, progress };
}

describe("computeHealth", () => {
  it("returns green for a completed project even when it is overdue", () => {
    expect(computeHealth(project(-10, 0, true), TODAY)).toBe("green");
  });

  it("returns red for an unfinished overdue project", () => {
    expect(computeHealth(project(-1, 100), TODAY)).toBe("red");
  });

  it("returns green when the end date is today and progress is at least 80", () => {
    expect(computeHealth(project(0, 100), TODAY)).toBe("green");
  });

  it("returns green with one day left and progress is at least 80", () => {
    expect(computeHealth(project(1, 100), TODAY)).toBe("green");
  });

  it("returns red with exactly 14 days left and progress 79", () => {
    expect(computeHealth(project(14, 79), TODAY)).toBe("red");
  });

  it("returns green with exactly 14 days left and progress 80", () => {
    expect(computeHealth(project(14, 80), TODAY)).toBe("green");
  });

  it("returns amber with exactly 30 days left and progress 49", () => {
    expect(computeHealth(project(30, 49), TODAY)).toBe("amber");
  });

  it("returns green with exactly 30 days left and progress 50", () => {
    expect(computeHealth(project(30, 50), TODAY)).toBe("green");
  });

  it("returns green with 31 days left regardless of progress", () => {
    expect(computeHealth(project(31, 0), TODAY)).toBe("green");
  });

  it("treats 23:00 UTC and 00:00 UTC on the same date equally", () => {
    const atMidnight = new Date("2026-07-19T00:00:00.000Z");
    const lateSameDay = new Date("2026-07-19T23:00:00.000Z");

    expect(dateOnlyUTC(lateSameDay)).toEqual(atMidnight);
    expect(
      computeHealth(
        { completed: false, endDate: atMidnight, progress: 100 },
        lateSameDay,
      ),
    ).toBe("green");
  });
});

describe("deriveProgress", () => {
  it("returns 0 when there are no deliverables", () => {
    expect(deriveProgress(0, 0)).toBe(0);
  });

  it("returns 25 for 1 of 4 done", () => {
    expect(deriveProgress(1, 4)).toBe(25);
  });

  it("returns 100 when all deliverables are done", () => {
    expect(deriveProgress(4, 4)).toBe(100);
  });

  it("rounds to the nearest whole percent", () => {
    expect(deriveProgress(1, 3)).toBe(33);
    expect(deriveProgress(2, 3)).toBe(67);
  });
});

describe("healthLabel", () => {
  it("returns a readable label for each health state", () => {
    expect(healthLabel("green")).toBe("On track");
    expect(healthLabel("amber")).toBe("At risk");
    expect(healthLabel("red")).toBe("Critical");
  });
});
