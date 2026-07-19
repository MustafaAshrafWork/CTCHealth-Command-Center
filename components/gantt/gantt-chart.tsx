"use client";

import { differenceInCalendarDays } from "date-fns";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { dateOnlyUTC, healthLabel, type Health } from "@/lib/health";
import { cn } from "@/lib/utils";

export type GanttMilestone = {
  id: string;
  name: string;
  done: boolean;
  dueDate: string;
};

export type GanttRow = {
  id: string;
  name: string;
  client: string;
  ownerName: string;
  status: string;
  startDate: string;
  endDate: string;
  progress: number;
  health: Health;
  milestones: GanttMilestone[];
};

const LEFT_COL_WIDTH = 260;
const ROW_HEIGHT = 40;
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
    row.milestones.map((milestone) => new Date(milestone.dueDate).getTime()),
  );

  const startTimeMs = [
    ...rows.map((row) => new Date(row.startDate).getTime()),
    ...milestoneTimeMs,
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
  const axisEndMs = Date.UTC(maxEnd.getUTCFullYear(), maxEnd.getUTCMonth() + 1, 1);

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
    containerWidth - LEFT_COL_WIDTH,
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
    const todayLeftPx = LEFT_COL_WIDTH + (todayPct / 100) * trackWidth;
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
        <div className="inline-flex items-center gap-0.5 rounded-md border bg-card p-0.5">
          {ZOOM_OPTIONS.map((option) => (
            <Button
              key={option.id}
              variant={zoom === option.id ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs"
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
          style={{ minWidth: LEFT_COL_WIDTH + trackWidth }}
        >
          {/* Header — two tiers: years spanning their months, then months or
              quarters depending on zoom density. */}
          <div className="sticky top-0 z-30 flex border-b bg-card">
            <div
              className="sticky left-0 z-40 flex shrink-0 items-center self-stretch border-r bg-card px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
              style={{ width: LEFT_COL_WIDTH }}
            >
              Project
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
              className="pointer-events-none absolute top-0 bottom-0"
              style={{ left: LEFT_COL_WIDTH, width: trackWidth }}
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
                style={{ left: LEFT_COL_WIDTH, width: trackWidth }}
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
                  {/* Sticky left column */}
                  <div
                    className="sticky left-0 z-20 flex h-full shrink-0 items-center gap-2 border-r bg-card px-3 group-hover:bg-muted/50"
                    style={{ width: LEFT_COL_WIDTH }}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        HEALTH_DOT[row.health],
                      )}
                      aria-label={healthLabel(row.health)}
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/projects/${row.id}`}
                        className="block truncate text-sm font-medium hover:underline"
                        title={row.name}
                      >
                        {row.name}
                      </Link>
                      <div
                        className="truncate text-[11px] text-muted-foreground"
                        title={`${row.client} · ${row.ownerName}`}
                      >
                        {row.client}
                      </div>
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
                      const dueMs = new Date(milestone.dueDate).getTime();
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
                          title={`${milestone.name} · ${formatUtcDate(dueMs)}`}
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
