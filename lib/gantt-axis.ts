import { differenceInCalendarDays } from "date-fns";

// Shared pure date-axis math for Gantt-style calendar views. Extracted from
// the portfolio Gantt chart so other timeline UIs (e.g. the milestone
// drill-down) can build a real UTC calendar axis without duplicating the
// month-boundary logic.

export type MonthCell = {
  startMs: number;
  widthPct: number;
  label: string;
};

export type HeaderCell = {
  key: number;
  label: string;
  leftPct: number;
  widthPct: number;
};

export type DateAxis = {
  axisStartMs: number;
  axisEndMs: number;
  totalDays: number;
  months: MonthCell[];
};

const monthLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
});

// Builds a UTC month-aligned axis spanning from the first day of the
// earliest month to the first day after the latest month among `values`.
export function buildDateAxis(
  values: readonly (Date | string | number)[],
): DateAxis {
  const timesMs = values.map((value) => new Date(value).getTime());
  const minStart = new Date(Math.min(...timesMs));
  const maxEnd = new Date(Math.max(...timesMs));

  const axisStartMs = Date.UTC(
    minStart.getUTCFullYear(),
    minStart.getUTCMonth(),
    1,
  );
  const axisEndMs = Date.UTC(
    maxEnd.getUTCFullYear(),
    maxEnd.getUTCMonth() + 1,
    1,
  );

  const totalDays = differenceInCalendarDays(
    new Date(axisEndMs),
    new Date(axisStartMs),
  );

  const months: MonthCell[] = [];
  let year = new Date(axisStartMs).getUTCFullYear();
  let month = new Date(axisStartMs).getUTCMonth();
  let cursor = axisStartMs;
  while (cursor < axisEndMs) {
    const nextYear = month + 1 === 12 ? year + 1 : year;
    const nextMonth = month + 1 === 12 ? 0 : month + 1;
    const nextMs = Date.UTC(nextYear, nextMonth, 1);
    const widthPct =
      (differenceInCalendarDays(new Date(nextMs), new Date(cursor)) /
        totalDays) *
      100;
    months.push({
      startMs: cursor,
      widthPct,
      label: monthLabel.format(new Date(cursor)),
    });
    year = nextYear;
    month = nextMonth;
    cursor = nextMs;
  }

  return { axisStartMs, axisEndMs, totalDays, months };
}

export function pctFor(
  ms: number,
  axisStartMs: number,
  totalDays: number,
): number {
  return (
    (differenceInCalendarDays(new Date(ms), new Date(axisStartMs)) /
      totalDays) *
    100
  );
}

export function clampPct(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

// Merge month cells into spans that share a group key (e.g. year, or
// "Q{n} {year}").
export function groupMonths(
  months: MonthCell[],
  axisStartMs: number,
  totalDays: number,
  keyOf: (date: Date) => string,
): HeaderCell[] {
  const cells: HeaderCell[] = [];
  let currentKey: string | null = null;
  for (const m of months) {
    const key = keyOf(new Date(m.startMs));
    const last = cells[cells.length - 1];
    if (last && key === currentKey) {
      last.widthPct += m.widthPct;
    } else {
      cells.push({
        key: m.startMs,
        label: key,
        leftPct: pctFor(m.startMs, axisStartMs, totalDays),
        widthPct: m.widthPct,
      });
      currentKey = key;
    }
  }
  return cells;
}
