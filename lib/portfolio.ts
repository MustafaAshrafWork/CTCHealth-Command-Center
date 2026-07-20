import { dateOnlyUTC, type Health } from "./health";

export const PORTFOLIO_SORT_VALUES = [
  "priority",
  "start",
  "end",
  "client",
] as const;

export type PortfolioSort = (typeof PORTFOLIO_SORT_VALUES)[number];

export type PortfolioSortable = {
  id: string;
  name: string;
  client: string;
  startDate: Date | string;
  endDate: Date | string;
  health: Health;
};

const HEALTH_RANK: Record<Health, number> = {
  red: 0,
  amber: 1,
  green: 2,
};

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;

function firstValue(
  value: string | string[] | null | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : (value ?? undefined);
}

export function parsePortfolioSort(
  value: string | string[] | null | undefined,
): PortfolioSort {
  const candidate = firstValue(value);
  return PORTFOLIO_SORT_VALUES.includes(candidate as PortfolioSort)
    ? (candidate as PortfolioSort)
    : "priority";
}

// Mirrors the prototype's safeTime: invalid/missing dates sort LAST (Infinity)
// instead of poisoning the comparison with NaN.
function safeTime(value: Date | string): number {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Infinity : time;
}

export function comparePortfolioRows(
  a: PortfolioSortable,
  b: PortfolioSortable,
  sort: PortfolioSort,
): number {
  // Ultimate stability backstop, applied ONLY after the prototype's own
  // tie-breaks: it never changes the client's intended ordering, it just keeps
  // truly identical rows from flickering between renders. It also guarantees the
  // comparator never returns NaN (Infinity - Infinity is falsy, so it falls
  // through to this term).
  const stableById = a.id.localeCompare(b.id, "en");

  if (sort === "priority") {
    return (
      HEALTH_RANK[a.health] - HEALTH_RANK[b.health] ||
      safeTime(a.endDate) - safeTime(b.endDate) ||
      stableById
    );
  }

  if (sort === "client") {
    return (
      a.client.localeCompare(b.client) ||
      safeTime(a.endDate) - safeTime(b.endDate) ||
      stableById
    );
  }

  if (sort === "start") {
    return safeTime(a.startDate) - safeTime(b.startDate) || stableById;
  }

  // sort === "end"
  return safeTime(a.endDate) - safeTime(b.endDate) || stableById;
}

export function sortPortfolioRows<T extends PortfolioSortable>(
  rows: readonly T[],
  sort: PortfolioSort,
): T[] {
  return [...rows].sort((a, b) => comparePortfolioRows(a, b, sort));
}

export const sortPortfolioProjects = sortPortfolioRows;

export function isDueWithin30Days(
  project: { completed: boolean; endDate: Date | string },
  today: Date = new Date(),
): boolean {
  if (project.completed) {
    return false;
  }

  const endDate = dateOnlyUTC(new Date(project.endDate));
  const normalizedToday = dateOnlyUTC(today);
  const daysLeft =
    (endDate.getTime() - normalizedToday.getTime()) / MILLISECONDS_PER_DAY;

  return daysLeft >= 0 && daysLeft <= 30;
}

export const isDueWithin30 = isDueWithin30Days;
