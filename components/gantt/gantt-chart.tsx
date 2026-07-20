"use client";

import { differenceInCalendarDays } from "date-fns";
import { Flag, Pencil } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { dateOnlyUTC, healthLabel, type Health } from "@/lib/health";
import { cn } from "@/lib/utils";

export type GanttMilestone = {
  id: string;
  name: string;
  done: boolean;
  startDate: string;
  endDate: string;
};

export type GanttRow = {
  id: string;
  name: string;
  category: string;
  client: string;
  ownerName: string;
  completed: boolean;
  startDate: string;
  endDate: string;
  progress: number;
  health: Health;
  openBlockerCount: number;
  milestones: GanttMilestone[];
};

const METADATA_COLUMNS = [
  { key: "project", label: "Project name", width: 224 },
  { key: "edit", label: "Quick edit", width: 72 },
  { key: "category", label: "Category", width: 96 },
  { key: "client", label: "Client", width: 136 },
  { key: "owner", label: "Owner", width: 144 },
] as const;
const METADATA_WIDTH = METADATA_COLUMNS.reduce(
  (total, column) => total + column.width,
  0,
);
const METADATA_GRID = METADATA_COLUMNS.map((column) => `${column.width}px`).join(
  " ",
);
const ROW_HEIGHT = 44;
const BAR_HEIGHT = 18;
const MIN_BAR_PX = 6;
const TRACK_MIN_PX = 600;

// Timescale zooms, MS Project style: each zoom fixes the px density and which
// unit the lower header tier shows. "fit" stretches the full range to the
// container and picks the unit that still has room for labels.
const ZOOM_MONTH_PX: Record<Exclude<Zoom, "fit">, number> = {
  months: 96,
  quarters: 30,
};
const MONTH_LABEL_MIN_PX = 40;

const HEALTH_BAR: Record<Health, string> = {
  green: "bg-emerald-500/80",
  amber: "bg-amber-500/80",
  red: "bg-red-500/80",
};

const HEALTH_FILL: Record<Health, string> = {
  green: "bg-emerald-700",
  amber: "bg-amber-700",
  red: "bg-red-700",
};

const HEALTH_DOT: Record<Health, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

const CATEGORY_LABEL: Record<string, string> = {
  tech: "Tech",
  consultancy: "Consultancy",
  agency: "Agency",
  agents: "Agents",
};

const monthLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
});

const dateLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

type Zoom = "fit" | "quarters" | "months";

const ZOOM_OPTIONS: { id: Zoom; label: string }[] = [
  { id: "fit", label: "Fit" },
  { id: "quarters", label: "Quarters" },
  { id: "months", label: "Months" },
];

type MonthCell = {
  startMs: number;
  widthPct: number;
  label: string;
};

type HeaderCell = {
  key: number;
  label: string;
  leftPct: number;
  widthPct: number;
};

type Axis = {
  axisStartMs: number;
  axisEndMs: number;
  totalDays: number;
  months: MonthCell[];
  today: Date;
};

function buildAxis(rows: GanttRow[]): Axis {
  const today = dateOnlyUTC(new Date());

  const milestoneTimeMs = rows.flatMap((row) =>
    row.milestones.flatMap((milestone) => [
      new Date(milestone.startDate).getTime(),
      new Date(milestone.endDate).getTime(),
    ]),
  );

  const startTimeMs = [
    ...rows.map((row) => new Date(row.startDate).getTime()),
    ...milestoneTimeMs,
    today.getTime(),
  ];
  const endTimeMs = [
    ...rows.map((row) => new Date(row.endDate).getTime()),
    ...milestoneTimeMs,
    today.getTime(),
  ];

  const minStart = new Date(Math.min(...startTimeMs));
  const maxEnd = new Date(Math.max(...endTimeMs));

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

  return { axisStartMs, axisEndMs, totalDays, months, today };
}

function pctFor(ms: number, axisStartMs: number, totalDays: number): number {
  return (
    (differenceInCalendarDays(new Date(ms), new Date(axisStartMs)) / totalDays) *
    100
  );
}

function clampPct(v: number): number {
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

function formatUtcDate(ms: number): string {
  return dateLabel.format(new Date(ms));
}

// Merge month cells into spans that share a group key (year or quarter).
function groupMonths(
  months: MonthCell[],
  axisStartMs: number,
  totalDays: number,
  keyOf: (d: Date) => string,
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

export function GanttChart({ rows }: { rows: GanttRow[] }) {
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [containerWidth, setContainerWidth] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const update = () => setContainerWidth(container.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const axis = useMemo(() => buildAxis(rows), [rows]);
  const { axisStartMs, axisEndMs, totalDays, months, today } = axis;

  // Track always fills the container so there is never dead space on the
  // right; zoomed-in modes overflow it and scroll horizontally.
  const availableTrack = Math.max(
    containerWidth - METADATA_WIDTH,
    TRACK_MIN_PX,
  );
  const monthCount = Math.max(months.length, 1);
  const trackWidth =
    zoom === "fit"
      ? availableTrack
      : Math.max(Math.round(monthCount * ZOOM_MONTH_PX[zoom]), availableTrack);
  const pxPerMonth = trackWidth / monthCount;

  const yearCells = useMemo(
    () =>
      groupMonths(months, axisStartMs, totalDays, (d) =>
        String(d.getUTCFullYear()),
      ),
    [months, axisStartMs, totalDays],
  );

  const quarterCells = useMemo(
    () =>
      groupMonths(
        months,
        axisStartMs,
        totalDays,
        (d) =>
          `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`,
      ),
    [months, axisStartMs, totalDays],
  );

  const useMonthTier =
    zoom === "months" || (zoom === "fit" && pxPerMonth >= MONTH_LABEL_MIN_PX);
  const tierCells: HeaderCell[] = useMonthTier
    ? months.map((m) => ({
        key: m.startMs,
        label: m.label,
        leftPct: pctFor(m.startMs, axisStartMs, totalDays),
        widthPct: m.widthPct,
      }))
    : quarterCells;

  const todayPct = clampPct(pctFor(today.getTime(), axisStartMs, totalDays));
  const todayInside =
    today.getTime() >= axisStartMs && today.getTime() <= axisEndMs;

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !todayInside) return;
    const todayLeftPx = METADATA_WIDTH + (todayPct / 100) * trackWidth;
    const target = todayLeftPx - container.clientWidth * (1 / 3);
    container.scrollLeft = Math.max(0, Math.round(target));
  }, [zoom, todayInside, todayPct, trackWidth]);

  if (rows.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        No projects to display on the timeline.
      </div>
    );
  }

  const bodyHeight = rows.length * ROW_HEIGHT;
  const labelFits = (cell: HeaderCell, minPx: number) =>
    (cell.widthPct / 100) * trackWidth >= minPx;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <div
          className="inline-flex items-center gap-0.5 rounded-md border bg-card p-0.5"
          role="group"
          aria-label="Timeline zoom"
        >
          {ZOOM_OPTIONS.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant={zoom === option.id ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs"
              aria-pressed={zoom === option.id}
              onClick={() => setZoom(option.id)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
      <div
        ref={scrollRef}
        className="overflow-auto rounded-md border bg-card max-h-[75vh] text-foreground"
        role="region"
        aria-label="Project timeline"
      >
        <div
          className="relative"
          style={{ minWidth: METADATA_WIDTH + trackWidth }}
        >
          {/* Header — two tiers: years spanning their months, then months or
              quarters depending on zoom density. */}
          <div className="sticky top-0 z-30 flex border-b bg-card">
            <div
              className="sticky left-0 z-40 grid shrink-0 self-stretch border-r bg-card text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              style={{
                width: METADATA_WIDTH,
                gridTemplateColumns: METADATA_GRID,
              }}
            >
              {METADATA_COLUMNS.map((column) => (
                <div
                  key={column.key}
                  className="flex items-center border-r px-3 last:border-r-0"
                >
                  {column.label}
                </div>
              ))}
            </div>
            <div className="shrink-0" style={{ width: trackWidth }}>
              <div className="relative h-5 border-b border-border/60">
                {yearCells.map((cell) => (
                  <div
                    key={cell.key}
                    className="absolute top-0 flex h-5 items-center border-r px-2 text-[11px] font-semibold text-muted-foreground"
                    style={{
                      left: `${cell.leftPct}%`,
                      width: `${cell.widthPct}%`,
                    }}
                  >
                    {labelFits(cell, 34) ? cell.label : null}
                  </div>
                ))}
              </div>
              <div className="relative h-6">
                {tierCells.map((cell) => (
                  <div
                    key={cell.key}
                    className="absolute top-0 flex h-6 items-center justify-center overflow-hidden border-r text-[11px] font-medium text-muted-foreground"
                    style={{
                      left: `${cell.leftPct}%`,
                      width: `${cell.widthPct}%`,
                    }}
                  >
                    {labelFits(cell, 30)
                      ? useMonthTier
                        ? cell.label
                        : cell.label.split(" ")[0]
                      : null}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="relative" style={{ height: bodyHeight }}>
            {/* Vertical grid lines at header-tier boundaries (behind rows —
                no z-index, painted first) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 bottom-0"
              style={{ left: METADATA_WIDTH, width: trackWidth }}
            >
              {tierCells.slice(1).map((cell) => (
                <div
                  key={cell.key}
                  className="absolute top-0 bottom-0 border-r border-border/60"
                  style={{ left: `${cell.leftPct}%` }}
                />
              ))}
            </div>

            {/* Today line (above bars — explicit positive z-index) */}
            {todayInside ? (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-10"
                role="img"
                aria-label={`Today, ${formatUtcDate(today.getTime())}`}
                style={{ left: METADATA_WIDTH, width: trackWidth }}
              >
                <div
                  className="absolute top-0 bottom-0"
                  style={{ left: `${todayPct}%` }}
                >
                  <div className="absolute top-0 bottom-0 -translate-x-1/2 border-l-2 border-red-500" />
                  <span className="absolute -top-px left-1 -translate-x-1/2 rounded bg-red-500 px-1 py-0.5 text-[10px] font-medium text-white">
                    Today
                  </span>
                </div>
              </div>
            ) : null}

            {rows.map((row) => {
              const startMs = new Date(row.startDate).getTime();
              const endMs = new Date(row.endDate).getTime();
              const leftPctRaw = pctFor(startMs, axisStartMs, totalDays);
              const endPctRaw = pctFor(endMs, axisStartMs, totalDays);
              const leftPct = clampPct(leftPctRaw);
              const endPct = clampPct(endPctRaw);
              const widthPct = Math.max(0, endPct - leftPct);
              const barPx = (widthPct / 100) * trackWidth;
              const showProgressLabel = barPx > 64;

              return (
                <div
                  key={row.id}
                  className="group relative flex border-t border-border/50"
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Sticky portfolio columns */}
                  <div
                    className="sticky left-0 z-20 grid h-full shrink-0 border-r bg-card group-hover:bg-muted/50"
                    style={{
                      width: METADATA_WIDTH,
                      gridTemplateColumns: METADATA_GRID,
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-2 border-r px-3">
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          HEALTH_DOT[row.health],
                        )}
                        role="img"
                        aria-label={healthLabel(row.health)}
                      />
                      <Link
                        href={`/projects/${row.id}`}
                        className="min-w-0 truncate text-sm font-medium hover:underline"
                        title={row.name}
                      >
                        {row.name}
                      </Link>
                      {row.openBlockerCount > 0 ? (
                        <span
                          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300"
                          title={`${row.openBlockerCount} open blocker${
                            row.openBlockerCount === 1 ? "" : "s"
                          }`}
                        >
                          <Flag className="size-2.5" aria-hidden="true" />
                          {row.openBlockerCount}
                          <span className="sr-only"> open blockers</span>
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-center border-r">
                      <Link
                        href={`/projects/${row.id}`}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Quick edit ${row.name}`}
                        title={`Quick edit ${row.name}`}
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                    <div className="flex min-w-0 items-center border-r px-3">
                      <span className="truncate rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {CATEGORY_LABEL[row.category] ?? row.category}
                      </span>
                    </div>
                    <div
                      className="flex min-w-0 items-center border-r px-3 text-xs text-muted-foreground"
                      title={row.client}
                    >
                      <span className="truncate">{row.client}</span>
                    </div>
                    <div
                      className="flex min-w-0 items-center px-3 text-xs text-muted-foreground"
                      title={row.ownerName}
                    >
                      <span className="truncate">{row.ownerName}</span>
                    </div>
                  </div>

                  {/* Track */}
                  <div
                    className="relative h-full shrink-0 overflow-hidden group-hover:bg-muted/30"
                    style={{ width: trackWidth }}
                  >
                    {/* Bar — always rendered, even when the project range falls
                        partly or entirely outside the axis window. Out-of-window
                        bars render as a thin clipped stub (MIN_BAR_PX) at the
                        edge they exceed. */}
                    <div
                      className={cn(
                        "absolute overflow-hidden rounded",
                        HEALTH_BAR[row.health],
                      )}
                      role="img"
                      aria-label={`${row.name}, ${formatUtcDate(startMs)} to ${formatUtcDate(endMs)}, ${row.progress}% complete, ${healthLabel(row.health)}`}
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        minWidth: MIN_BAR_PX,
                        top: (ROW_HEIGHT - BAR_HEIGHT) / 2,
                        height: BAR_HEIGHT,
                      }}
                      title={`${row.name} · ${formatUtcDate(startMs)}–${formatUtcDate(endMs)} · ${row.progress}% · ${healthLabel(row.health)}`}
                    >
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 rounded",
                          HEALTH_FILL[row.health],
                        )}
                        style={{ width: `${row.progress}%` }}
                      />
                      {showProgressLabel ? (
                        <span className="absolute inset-y-0 right-1 flex items-center text-[10px] font-medium text-white/90">
                          {row.progress}%
                        </span>
                      ) : null}
                    </div>

                    {row.milestones.map((milestone) => {
                      const startMs = new Date(milestone.startDate).getTime();
                      const dueMs = new Date(milestone.endDate).getTime();
                      const duePct = pctFor(dueMs, axisStartMs, totalDays);
                      if (duePct < 0 || duePct > 100) return null;
                      const overdue =
                        !milestone.done && dueMs < today.getTime();
                      return (
                        <div
                          key={milestone.id}
                          className={cn(
                            "absolute h-3 w-3 border bg-card",
                            milestone.done &&
                              "border-zinc-700 bg-zinc-700",
                            !milestone.done &&
                              !overdue &&
                              "border-zinc-400",
                            !milestone.done &&
                              overdue &&
                              "border-red-500",
                          )}
                          style={{
                            left: `${duePct}%`,
                            top: "50%",
                            transform:
                              "translate(-50%, -50%) rotate(45deg)",
                          }}
                          role="img"
                          aria-label={`Milestone ${milestone.name}, ${milestone.done ? "Done" : overdue ? "Open and overdue" : "Open"}, ${formatUtcDate(startMs)} to ${formatUtcDate(dueMs)}`}
                          title={`${milestone.name} · ${formatUtcDate(startMs)}–${formatUtcDate(dueMs)}`}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
