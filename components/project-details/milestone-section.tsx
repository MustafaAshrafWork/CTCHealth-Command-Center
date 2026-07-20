"use client";

import { useState, useTransition } from "react";
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
import { dateOnlyUTC } from "@/lib/health";
import { cn } from "@/lib/utils";

import { AssigneeChip } from "./deliverables-section";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function inputDate(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function rangeStyle(
  startDate: Date | string,
  endDate: Date | string,
  projectStartDate: Date | string,
  projectEndDate: Date | string,
): { left: string; width: string } {
  const projectStart = new Date(projectStartDate).getTime();
  const projectEnd = new Date(projectEndDate).getTime();
  const span = Math.max(1, projectEnd - projectStart);
  const start = Math.max(
    0,
    Math.min(100, ((new Date(startDate).getTime() - projectStart) / span) * 100),
  );
  const end = Math.max(
    start,
    Math.min(100, ((new Date(endDate).getTime() - projectStart) / span) * 100),
  );

  return {
    left: `${start}%`,
    width: `${Math.max(1.5, end - start)}%`,
  };
}

function MilestoneRow({
  milestone,
  projectStartDate,
  projectEndDate,
  ownerId,
  people,
  canEdit,
}: {
  milestone: Milestone;
  projectStartDate: Date | string;
  projectEndDate: Date | string;
  ownerId: string;
  people: Person[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(milestone.name);
  const [startDate, setStartDate] = useState(inputDate(milestone.startDate));
  const [endDate, setEndDate] = useState(inputDate(milestone.endDate));
  const [done, setDone] = useState(milestone.done);
  const [assigneeId, setAssigneeId] = useState(
    milestone.assigneeId ?? ownerId,
  );
  const [isPending, startTransition] = useTransition();
  const mutation = useMutationStatus();
  const assignee = people.find((person) => person.id === milestone.assigneeId);

  function save() {
    if (!canEdit) {
      return;
    }
    if (!name.trim() || !startDate || !endDate) {
      toast.error("Milestone name and dates are required.");
      mutation.failed("Milestone name and dates are required.");
      return;
    }

    mutation.saving("Saving milestone…");
    startTransition(async () => {
      try {
        const result = await updateMilestone(milestone.id, milestone.version, {
          name,
          startDate: dateOnlyUTC(new Date(startDate)),
          endDate: dateOnlyUTC(new Date(endDate)),
          done,
          assigneeId,
        });
        if (!result.ok) {
          toast.error(result.error);
          mutation.failed(result.error, result.code === "CONFLICT");
          return;
        }
        toast.success("Milestone saved.");
        mutation.saved("Milestone saved.");
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
    if (!window.confirm(`Delete milestone “${milestone.name}”?`)) {
      return;
    }

    mutation.saving("Deleting milestone…");
    startTransition(async () => {
      try {
        const result = await deleteMilestone(milestone.id, milestone.version);
        if (!result.ok) {
          toast.error(result.error);
          mutation.failed(result.error, result.code === "CONFLICT");
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

  const summaryClassName =
    "grid gap-3 px-4 py-3 md:grid-cols-[minmax(11rem,1fr)_minmax(12rem,2fr)_auto] md:items-center";
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
        <span
          className={cn(
            "absolute top-0 h-2 rounded-full",
            milestone.done ? "bg-emerald-500" : "bg-primary",
          )}
          style={rangeStyle(
            milestone.startDate,
            milestone.endDate,
            projectStartDate,
            projectEndDate,
          )}
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
        <div className={summaryClassName}>{summaryContent}</div>
      </div>
    );
  }

  return (
    <details className="group border-b border-border last:border-b-0">
      <summary
        className={cn(
          summaryClassName,
          "cursor-pointer list-none marker:content-none",
        )}
      >
        {summaryContent}
      </summary>

      <div className="grid gap-3 border-t border-border bg-muted/20 px-4 py-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_9rem_9rem_auto_auto] lg:items-end">
        <div className="space-y-1">
          <Label htmlFor={`milestone-name-${milestone.id}`}>Name</Label>
          <Input
            id={`milestone-name-${milestone.id}`}
            value={name}
            disabled={isPending}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`milestone-start-${milestone.id}`}>Start</Label>
          <Input
            id={`milestone-start-${milestone.id}`}
            type="date"
            value={startDate}
            disabled={isPending}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`milestone-end-${milestone.id}`}>End</Label>
          <Input
            id={`milestone-end-${milestone.id}`}
            type="date"
            value={endDate}
            disabled={isPending}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 pb-1">
          <AssigneeChip
            people={people}
            value={assigneeId}
            disabled={isPending}
            onChange={setAssigneeId}
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={done}
              disabled={isPending}
              onCheckedChange={(checked) => setDone(checked === true)}
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
          {sorted.map((milestone) => (
            <MilestoneRow
              key={milestone.id}
              milestone={milestone}
              projectStartDate={projectStartDate}
              projectEndDate={projectEndDate}
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
