"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { Milestone, Person } from "@prisma/client";
import { toast } from "sonner";

import {
  MutationStatus,
  useMutationStatus,
} from "@/components/mutation-status";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createMilestone,
  deleteMilestone,
  updateMilestone,
} from "@/lib/actions/milestones";
import {
  buildDateAxis,
  clampPct,
  groupMonths,
  pctFor,
  type DateAxis,
  type HeaderCell,
} from "@/lib/gantt-axis";
import { dateOnlyUTC } from "@/lib/health";
import { shouldShowStaleEditBanner } from "@/lib/optimistic-lock";
import { cn } from "@/lib/utils";

import { AssigneeChip } from "./deliverables-section";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

// Shared grid template so the calendar header lines up with every milestone
// row's summary columns.
const SUMMARY_GRID =
  "grid gap-3 px-4 py-3 md:grid-cols-[minmax(11rem,1fr)_minmax(12rem,2fr)_auto] md:items-center";
const MIN_BAR_PX = 6;
// Same density threshold as the portfolio Gantt: below this, month labels
// don't have room and the header collapses to quarters.
const MONTH_LABEL_MIN_PX = 40;

function inputDate(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

type MilestoneFormState = {
  name: string;
  startDate: string;
  endDate: string;
  done: boolean;
  assigneeId: string;
  // The milestone `version` these field values are based on. Frozen
  // alongside the fields (same useState) so a live prop refresh can never
  // advance the version out from under stale, unsaved field values.
  baseVersion: number;
};

function stateFromMilestone(
  milestone: Milestone,
  ownerId: string,
): MilestoneFormState {
  return {
    name: milestone.name,
    startDate: inputDate(milestone.startDate),
    endDate: inputDate(milestone.endDate),
    done: milestone.done,
    assigneeId: milestone.assigneeId ?? ownerId,
    baseVersion: milestone.version,
  };
}

function MilestoneRow({
  milestone,
  axis,
  tierCells,
  ownerId,
  people,
  canEdit,
}: {
  milestone: Milestone;
  axis: DateAxis;
  tierCells: HeaderCell[];
  ownerId: string;
  people: Person[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<MilestoneFormState>(() =>
    stateFromMilestone(milestone, ownerId),
  );
  // Immutable snapshot of `state` as of the last seed/reload, used only to
  // detect whether the user has changed anything since then. Never
  // re-derived from props — only replaced wholesale by `reloadFromLatest`.
  const [snapshot, setSnapshot] = useState<MilestoneFormState>(state);
  const [conflict, setConflict] = useState(false);
  const [isPending, startTransition] = useTransition();
  const mutation = useMutationStatus();
  const assignee = people.find((person) => person.id === milestone.assigneeId);
  const dirty = useMemo(
    () => JSON.stringify(state) !== JSON.stringify(snapshot),
    [state, snapshot],
  );
  const showStaleBanner = shouldShowStaleEditBanner({
    baseVersion: state.baseVersion,
    liveVersion: milestone.version,
    dirty,
    conflict,
  });

  function reloadFromLatest() {
    const fresh = stateFromMilestone(milestone, ownerId);
    setState(fresh);
    setSnapshot(fresh);
    setConflict(false);
  }

  function save() {
    if (!canEdit) {
      return;
    }
    if (!state.name.trim() || !state.startDate || !state.endDate) {
      toast.error("Milestone name and dates are required.");
      mutation.failed("Milestone name and dates are required.");
      return;
    }

    mutation.saving("Saving milestone…");
    startTransition(async () => {
      try {
        const result = await updateMilestone(milestone.id, state.baseVersion, {
          name: state.name,
          startDate: dateOnlyUTC(new Date(state.startDate)),
          endDate: dateOnlyUTC(new Date(state.endDate)),
          done: state.done,
          assigneeId: state.assigneeId,
        });
        if (!result.ok) {
          toast.error(result.error);
          mutation.failed(result.error, result.code === "CONFLICT");
          if (result.code === "CONFLICT") {
            setConflict(true);
          }
          return;
        }
        toast.success("Milestone saved.");
        mutation.saved("Milestone saved.");
        // The save just committed exactly what's in `state`; resync the
        // frozen baseline to the new version so a subsequent prop refresh
        // isn't mistaken for a remote conflict against our own save.
        setConflict(false);
        const fresh = stateFromMilestone(result.data, ownerId);
        setState(fresh);
        setSnapshot(fresh);
        router.refresh();
      } catch {
        const message = "Could not save the milestone.";
        toast.error(message);
        mutation.failed(message);
      }
    });
  }

  function remove() {
    if (!canEdit) {
      return;
    }
    if (showStaleBanner) {
      toast.error(
        "This milestone changed elsewhere. Reload before deleting.",
      );
      return;
    }
    if (!window.confirm(`Delete milestone “${milestone.name}”?`)) {
      return;
    }

    mutation.saving("Deleting milestone…");
    startTransition(async () => {
      try {
        const result = await deleteMilestone(milestone.id, state.baseVersion);
        if (!result.ok) {
          toast.error(result.error);
          mutation.failed(result.error, result.code === "CONFLICT");
          if (result.code === "CONFLICT") {
            setConflict(true);
          }
          return;
        }
        toast.success("Milestone deleted.");
        mutation.saved("Milestone deleted.");
        router.refresh();
      } catch {
        const message = "Could not delete the milestone.";
        toast.error(message);
        mutation.failed(message);
      }
    });
  }

  const startMs = new Date(milestone.startDate).getTime();
  const endMs = new Date(milestone.endDate).getTime();
  const leftPct = clampPct(pctFor(startMs, axis.axisStartMs, axis.totalDays));
  const rightPct = clampPct(pctFor(endMs, axis.axisStartMs, axis.totalDays));
  const widthPct = Math.max(0, rightPct - leftPct);

  const summaryContent = (
    <>
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              milestone.done ? "bg-emerald-500" : "bg-muted-foreground/50",
            )}
            aria-hidden="true"
          />
          <span
            className={cn(
              "min-w-0 truncate text-sm font-medium",
              milestone.done && "text-muted-foreground line-through",
            )}
          >
            {milestone.name}
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              milestone.done
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-muted text-muted-foreground",
            )}
          >
            {milestone.done ? "Done" : "Open"}
          </span>
        </span>
        <span className="mt-0.5 block truncate pl-4 text-xs text-muted-foreground">
          {assignee?.name ?? "Unassigned"}
        </span>
      </span>

      <span className="relative h-2 rounded-full bg-muted" aria-hidden="true">
        {tierCells.slice(1).map((cell) => (
          <span
            key={cell.key}
            className="absolute top-0 bottom-0 border-l border-border/60"
            style={{ left: `${cell.leftPct}%` }}
          />
        ))}
        <span
          className={cn(
            "absolute top-0 h-2 rounded-full",
            milestone.done ? "bg-emerald-500" : "bg-primary",
          )}
          style={{
            left: `${leftPct}%`,
            width: `${widthPct}%`,
            minWidth: MIN_BAR_PX,
          }}
        />
      </span>

      <span className="flex items-center justify-between gap-2 text-xs tabular-nums text-muted-foreground md:justify-end">
        {dateFormatter.format(new Date(milestone.startDate))} –{" "}
        {dateFormatter.format(new Date(milestone.endDate))}
        {canEdit ? (
          <span
            aria-hidden="true"
            className="transition-transform group-open:rotate-180"
          >
            ▾
          </span>
        ) : null}
      </span>
    </>
  );

  if (!canEdit) {
    return (
      <div className="border-b border-border last:border-b-0">
        <div className={SUMMARY_GRID}>{summaryContent}</div>
      </div>
    );
  }

  return (
    <details className="group border-b border-border last:border-b-0">
      <summary
        className={cn(
          SUMMARY_GRID,
          "cursor-pointer list-none marker:content-none",
        )}
      >
        {summaryContent}
      </summary>

      <div className="grid gap-3 border-t border-border bg-muted/20 px-4 py-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_9rem_9rem_auto_auto] lg:items-end">
        {showStaleBanner ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200 sm:col-span-2 lg:col-span-5">
            <span>
              This milestone changed elsewhere. Reload to get the latest
              (your unsaved edits will be replaced).
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={reloadFromLatest}
            >
              Reload
            </Button>
          </div>
        ) : null}
        <div className="space-y-1">
          <Label htmlFor={`milestone-name-${milestone.id}`}>Name</Label>
          <Input
            id={`milestone-name-${milestone.id}`}
            value={state.name}
            disabled={isPending}
            onChange={(event) =>
              setState((prev) => ({ ...prev, name: event.target.value }))
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`milestone-start-${milestone.id}`}>Start</Label>
          <Input
            id={`milestone-start-${milestone.id}`}
            type="date"
            value={state.startDate}
            disabled={isPending}
            onChange={(event) =>
              setState((prev) => ({ ...prev, startDate: event.target.value }))
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`milestone-end-${milestone.id}`}>End</Label>
          <Input
            id={`milestone-end-${milestone.id}`}
            type="date"
            value={state.endDate}
            disabled={isPending}
            onChange={(event) =>
              setState((prev) => ({ ...prev, endDate: event.target.value }))
            }
          />
        </div>
        <div className="flex items-center gap-3 pb-1">
          <AssigneeChip
            people={people}
            value={state.assigneeId}
            disabled={isPending}
            onChange={(assigneeId) =>
              setState((prev) => ({ ...prev, assigneeId }))
            }
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={state.done}
              disabled={isPending}
              onCheckedChange={(checked) =>
                setState((prev) => ({ ...prev, done: checked === true }))
              }
            />
            Done
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={isPending}
            onClick={remove}
          >
            <Trash2 />
            <span className="sr-only">Delete milestone</span>
          </Button>
          <Button type="button" size="sm" disabled={isPending} onClick={save}>
            Save
          </Button>
        </div>
        <MutationStatus
          value={mutation.status}
          className="sm:col-span-2 lg:col-span-5"
        />
      </div>
    </details>
  );
}

export function MilestoneSection({
  projectId,
  projectStartDate,
  projectEndDate,
  ownerId,
  people,
  milestones,
  canEdit = true,
}: {
  projectId: string;
  projectStartDate: Date | string;
  projectEndDate: Date | string;
  ownerId: string;
  people: Person[];
  milestones: Milestone[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(inputDate(projectStartDate));
  const [endDate, setEndDate] = useState(inputDate(projectEndDate));
  const [assigneeId, setAssigneeId] = useState(ownerId);
  const [isPending, startTransition] = useTransition();
  const mutation = useMutationStatus();
  const sorted = [...milestones].sort(
    (a, b) =>
      a.startDate.getTime() - b.startDate.getTime() ||
      a.endDate.getTime() - b.endDate.getTime() ||
      a.name.localeCompare(b.name),
  );

  // Calendar axis spans the project range plus every milestone's own dates
  // (so a milestone scheduled outside the project window still shows), but
  // deliberately excludes "today" — this is a static plan view, not a
  // status-vs-now view like the portfolio Gantt.
  const axis = useMemo(() => {
    const values: (Date | string | number)[] = [
      projectStartDate,
      projectEndDate,
      ...milestones.flatMap((milestone) => [
        milestone.startDate,
        milestone.endDate,
      ]),
    ];
    return buildDateAxis(values);
  }, [projectStartDate, projectEndDate, milestones]);

  const [timelineWidth, setTimelineWidth] = useState(0);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const hasMilestones = sorted.length > 0;

  useLayoutEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const update = () => setTimelineWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
    // Re-attach whenever the timeline header mounts/unmounts (milestones
    // transition to/from empty), since the ref only exists while it's shown.
  }, [hasMilestones]);

  const monthCount = Math.max(axis.months.length, 1);
  const useMonthTier = timelineWidth / monthCount >= MONTH_LABEL_MIN_PX;
  const tierCells: HeaderCell[] = useMemo(
    () =>
      useMonthTier
        ? axis.months.map((m) => ({
            key: m.startMs,
            label: m.label,
            leftPct: pctFor(m.startMs, axis.axisStartMs, axis.totalDays),
            widthPct: m.widthPct,
          }))
        : groupMonths(axis.months, axis.axisStartMs, axis.totalDays, (d) =>
            `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`,
          ),
    [axis, useMonthTier],
  );

  function add() {
    if (!canEdit) {
      return;
    }
    if (!name.trim() || !startDate || !endDate) {
      toast.error("Milestone name and dates are required.");
      mutation.failed("Milestone name and dates are required.");
      return;
    }

    mutation.saving("Adding milestone…");
    startTransition(async () => {
      try {
        const result = await createMilestone(projectId, {
          name,
          startDate: dateOnlyUTC(new Date(startDate)),
          endDate: dateOnlyUTC(new Date(endDate)),
          done: false,
          assigneeId,
        });
        if (!result.ok) {
          toast.error(result.error);
          mutation.failed(result.error, result.code === "CONFLICT");
          return;
        }
        setName("");
        toast.success("Milestone added.");
        mutation.saved("Milestone added.");
        router.refresh();
      } catch {
        const message = "Could not add the milestone.";
        toast.error(message);
        mutation.failed(message);
      }
    });
  }

  return (
    <section
      className="overflow-hidden rounded-lg border border-border bg-card"
      aria-busy={isPending}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium">Milestones</h2>
        <span className="text-xs text-muted-foreground">
          {sorted.filter((milestone) => milestone.done).length}/{sorted.length} done
        </span>
      </div>

      {sorted.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No milestones yet.
        </p>
      ) : (
        <div>
          <div
            className={cn(
              SUMMARY_GRID,
              "border-b border-border bg-muted/20 py-2",
            )}
          >
            <span className="hidden md:block" aria-hidden="true" />
            <div ref={timelineRef} className="relative h-5">
              {tierCells.map((cell) => (
                <div
                  key={cell.key}
                  className="absolute top-0 flex h-5 items-center overflow-hidden border-l border-border/60 pl-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground first:border-l-0"
                  style={{
                    left: `${cell.leftPct}%`,
                    width: `${cell.widthPct}%`,
                  }}
                >
                  {cell.label}
                </div>
              ))}
            </div>
            <span className="hidden text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:block">
              Dates
            </span>
          </div>
          {sorted.map((milestone) => (
            <MilestoneRow
              key={milestone.id}
              milestone={milestone}
              axis={axis}
              tierCells={tierCells}
              ownerId={ownerId}
              people={people}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}

      {canEdit ? (
      <div className="grid gap-2 border-t border-border bg-muted/20 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_9rem_9rem_auto_auto] sm:items-center">
        <Input
          value={name}
          placeholder="Add a milestone"
          disabled={isPending}
          aria-label="New milestone name"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <Input
          type="date"
          value={startDate}
          disabled={isPending}
          aria-label="New milestone start date"
          onChange={(event) => setStartDate(event.target.value)}
        />
        <Input
          type="date"
          value={endDate}
          disabled={isPending}
          aria-label="New milestone end date"
          onChange={(event) => setEndDate(event.target.value)}
        />
        <AssigneeChip
          people={people}
          value={assigneeId}
          disabled={isPending}
          onChange={setAssigneeId}
        />
        <Button
          type="button"
          size="icon"
          disabled={isPending || !name.trim() || !startDate || !endDate}
          onClick={add}
        >
          <Plus />
          <span className="sr-only">Add milestone</span>
        </Button>
        <MutationStatus
          value={mutation.status}
          className="sm:col-span-5"
        />
      </div>
      ) : null}
    </section>
  );
}
