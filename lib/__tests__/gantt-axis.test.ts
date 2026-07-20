import { describe, expect, it } from "vitest";

import { buildDateAxis, clampPct, groupMonths, pctFor } from "../gantt-axis";

describe("buildDateAxis - month-bound expansion", () => {
  it("expands to the first day of the earliest month through the first day after the latest month", () => {
    const axis = buildDateAxis([
      "2026-07-05T00:00:00.000Z",
      "2026-08-20T00:00:00.000Z",
    ]);

    expect(axis.axisStartMs).toBe(Date.UTC(2026, 6, 1));
    expect(axis.axisEndMs).toBe(Date.UTC(2026, 8, 1));
    expect(axis.totalDays).toBe(62); // July (31) + August (31)
    expect(axis.months).toHaveLength(2);
    expect(axis.months[0]).toMatchObject({
      startMs: Date.UTC(2026, 6, 1),
      label: "Jul",
      widthPct: 50,
    });
    expect(axis.months[1]).toMatchObject({
      startMs: Date.UTC(2026, 7, 1),
      label: "Aug",
      widthPct: 50,
    });
  });
});

describe("buildDateAxis - leap year / month widths", () => {
  it("gives a leap-year February a wider share than a non-leap February over the same Jan–Mar span", () => {
    const leapAxis = buildDateAxis(["2028-01-15", "2028-03-15"]);
    const nonLeapAxis = buildDateAxis(["2027-01-15", "2027-03-15"]);

    expect(leapAxis.totalDays).toBe(91); // 31 + 29 + 31
    expect(nonLeapAxis.totalDays).toBe(90); // 31 + 28 + 31

    const leapFeb = leapAxis.months.find((m) => m.label === "Feb")!;
    const nonLeapFeb = nonLeapAxis.months.find((m) => m.label === "Feb")!;

    expect(leapFeb.widthPct).toBeCloseTo(31.868131868131865, 10);
    expect(nonLeapFeb.widthPct).toBeCloseTo(31.11111111111111, 10);
    expect(leapFeb.widthPct).toBeGreaterThan(nonLeapFeb.widthPct);
  });
});

describe("groupMonths - quarter grouping across years", () => {
  it("merges months into quarter cells and splits a group at a year boundary", () => {
    const axis = buildDateAxis(["2026-12-10", "2027-02-10"]);
    const quarterCells = groupMonths(
      axis.months,
      axis.axisStartMs,
      axis.totalDays,
      (d) => `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`,
    );

    expect(quarterCells).toHaveLength(2);
    expect(quarterCells[0].label).toBe("Q4 2026");
    expect(quarterCells[1].label).toBe("Q1 2027");
    expect(quarterCells[0].leftPct).toBeCloseTo(0, 10);
    expect(quarterCells[0].widthPct).toBeCloseTo(34.44444444444444, 10);
    expect(quarterCells[1].leftPct).toBeCloseTo(34.44444444444444, 10);
    expect(quarterCells[1].widthPct).toBeCloseTo(65.55555555555556, 10);
    expect(quarterCells[0].widthPct + quarterCells[1].widthPct).toBeCloseTo(
      100,
      10,
    );
  });
});

describe("UTC stability", () => {
  it("builds an identical axis regardless of whether an instant is given as a Date, an ISO string, or epoch ms", () => {
    const asIso = "2026-03-10T00:00:00.000Z";
    const asDate = new Date(Date.UTC(2026, 2, 10));
    const asMs = Date.UTC(2026, 2, 10);

    const axisFromIso = buildDateAxis([asIso]);
    const axisFromDate = buildDateAxis([asDate]);
    const axisFromMs = buildDateAxis([asMs]);

    expect(axisFromIso).toEqual(axisFromDate);
    expect(axisFromDate).toEqual(axisFromMs);
  });

  it("computes a stable, non-drifting percentage for a date inside the axis", () => {
    const axis = buildDateAxis(["2026-07-01", "2026-07-31"]);
    const pct = pctFor(Date.UTC(2026, 6, 15), axis.axisStartMs, axis.totalDays);

    expect(pct).toBeCloseTo(45.16129032258064, 10);
  });
});

describe("clampPct", () => {
  it("clamps below 0 and above 100, and passes in-range values through unchanged", () => {
    expect(clampPct(-15)).toBe(0);
    expect(clampPct(115)).toBe(100);
    expect(clampPct(0)).toBe(0);
    expect(clampPct(100)).toBe(100);
    expect(clampPct(42.5)).toBe(42.5);
  });
});

describe("buildDateAxis - same-month / same-day inputs", () => {
  it("builds a single-month axis when every input falls on the same day", () => {
    const axis = buildDateAxis([
      "2026-07-15",
      "2026-07-15",
      "2026-07-15",
    ]);

    expect(axis.axisStartMs).toBe(Date.UTC(2026, 6, 1));
    expect(axis.axisEndMs).toBe(Date.UTC(2026, 7, 1));
    expect(axis.totalDays).toBe(31);
    expect(axis.months).toHaveLength(1);
    expect(axis.months[0]).toMatchObject({ label: "Jul", widthPct: 100 });

    const pct = pctFor(Date.UTC(2026, 6, 15), axis.axisStartMs, axis.totalDays);
    expect(pct).toBeCloseTo(45.16129032258064, 10);
    expect(clampPct(pct)).toBeCloseTo(pct, 10);
  });
});
