"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import type { Person } from "@prisma/client";

import {
  MutationStatus,
  useMutationStatus,
} from "@/components/mutation-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createProject, updateProject } from "@/lib/actions/projects";
import type { ProjectWithRelations } from "@/lib/actions/projects";
import { dateOnlyUTC } from "@/lib/health";
import { shouldShowStaleEditBanner } from "@/lib/optimistic-lock";
import { projectCreateSchema, projectInputSchema } from "@/lib/validation";

import { AssigneeChip } from "./deliverables-section";
import { OwnerPicker } from "./people-picker";

const CATEGORY_OPTIONS = [
  { value: "tech", label: "Tech" },
  { value: "consultancy", label: "Consultancy" },
  { value: "agency", label: "Agency" },
  { value: "agents", label: "Agents" },
] as const;

type DeliverableDraft = {
  name: string;
  startDate: string;
  endDate: string;
  assigneeId: string;
};

type FormState = {
  name: string;
  client: string;
  category: string;
  ownerId: string;
  progress: number;
  budget: string;
  completed: boolean;
  startDate: string;
  endDate: string;
  sharePointLink: string;
  deliverables: DeliverableDraft[];
  // The project `version` these field values are based on. Frozen alongside
  // the fields (same useState) so a live prop refresh can never advance the
  // version out from under stale, unsaved field values.
  baseVersion: number | null;
};

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function toDateInputValue(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return value.toISOString().slice(0, 10);
}

function defaultState(currentPersonId?: string): FormState {
  const today = todayInputValue();
  return {
    name: "",
    client: "",
    category: "tech",
    ownerId: currentPersonId ?? "",
    progress: 0,
    budget: "",
    completed: false,
    startDate: today,
    endDate: today,
    sharePointLink: "",
    deliverables: [],
    baseVersion: null,
  };
}

function stateFromProject(project: ProjectWithRelations): FormState {
  return {
    name: project.name,
    client: project.client,
    category: project.category,
    ownerId: project.ownerId,
    progress: project.progress,
    budget: project.budget === null ? "" : String(project.budget),
    completed: project.completed,
    startDate: toDateInputValue(project.startDate),
    endDate: toDateInputValue(project.endDate),
    sharePointLink: project.sharePointLink ?? "",
    deliverables: [],
    baseVersion: project.version,
  };
}

function mapIssues(
  issues: { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in map)) {
      map[key] = issue.message;
    }
  }
  return map;
}

export function DetailsTab({
  project,
  people,
  currentPersonId,
  mode,
  canEdit = true,
  canChooseOwner = true,
  onClose,
}: {
  project: ProjectWithRelations | null;
  people: Person[];
  currentPersonId?: string;
  mode: "new" | "edit";
  canEdit?: boolean;
  canChooseOwner?: boolean;
  onClose: () => void;
}) {
  const [state, setState] = useState<FormState>(() =>
    project ? stateFromProject(project) : defaultState(currentPersonId),
  );
  // Immutable snapshot of `state` as of the last seed/reload, used only to
  // detect whether the user has typed anything since then. Never re-derived
  // from props — only replaced wholesale by `reloadFromLatest`.
  const [snapshot, setSnapshot] = useState<FormState>(state);
  const [conflict, setConflict] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [resetSignal, setResetSignal] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const mutation = useMutationStatus();
  const formDisabled = isPending || !canEdit;
  const dirty = useMemo(
    () => JSON.stringify(state) !== JSON.stringify(snapshot),
    [state, snapshot],
  );
  const showStaleBanner = shouldShowStaleEditBanner({
    baseVersion: state.baseVersion,
    liveVersion: project?.version ?? null,
    dirty,
    conflict,
  });

  useEffect(() => {
    if (resetSignal > 0) {
      nameRef.current?.focus();
    }
  }, [resetSignal]);

  function reloadFromLatest() {
    if (!project) {
      return;
    }
    const fresh = stateFromProject(project);
    setState(fresh);
    setSnapshot(fresh);
    setConflict(false);
    setErrors({});
  }

  function buildPayload(values: FormState) {
    return {
      name: values.name,
      client: values.client,
      category: values.category,
      // Legacy-only fields stay stable while the visible form follows the
      // briefing data model.
      status: project?.status ?? "planning",
      priority: project?.priority ?? "medium",
      ownerId: values.ownerId,
      memberIds:
        project?.members.map((member) => member.personId) ?? [],
      progress: values.progress,
      budget: values.budget.trim() === "" ? null : Number(values.budget),
      completed: values.completed,
      startDate: dateOnlyUTC(new Date(values.startDate)),
      endDate: dateOnlyUTC(new Date(values.endDate)),
      sharePointLink: values.sharePointLink,
      // Deliverables are only collected at creation; the detail page's
      // deliverables section owns them afterwards.
      ...(mode === "new"
        ? {
            deliverables: values.deliverables.map((deliverable) => ({
              name: deliverable.name,
              startDate: deliverable.startDate
                ? dateOnlyUTC(new Date(deliverable.startDate))
                : "",
              endDate: deliverable.endDate
                ? dateOnlyUTC(new Date(deliverable.endDate))
                : "",
              ...(deliverable.assigneeId
                ? { assigneeId: deliverable.assigneeId }
                : {}),
            })),
          }
        : {}),
      // Legacy notes stay untouched; WeeklyUpdates is the visible qualitative
      // record required by the briefing.
    };
  }

  function submit(addAnother: boolean) {
    if (!canEdit) {
      return;
    }

    const schema = mode === "new" ? projectCreateSchema : projectInputSchema;
    const parsed = schema.safeParse(buildPayload(state));
    if (!parsed.success) {
      setErrors(mapIssues(parsed.error.issues));
      mutation.failed("Review the highlighted fields before saving.");
      return;
    }
    setErrors({});

    mutation.saving(mode === "new" ? "Creating project…" : "Saving project…");
    startTransition(async () => {
      try {
        const result =
          mode === "new"
            ? await createProject(parsed.data)
            : await updateProject(project!.id, state.baseVersion!, parsed.data);

        if (!result.ok) {
          toast.error(result.error);
          mutation.failed(result.error, result.code === "CONFLICT");
          if (result.code === "CONFLICT") {
            setConflict(true);
          }
          return;
        }

        const successMessage =
          mode === "new" ? "Project created." : "Project saved.";
        toast.success(successMessage);
        mutation.saved(successMessage);

        if (mode === "new" && addAnother) {
          setState(defaultState(currentPersonId));
          setErrors({});
          setResetSignal((count) => count + 1);
          return;
        }

        if (mode === "new") {
          // Land on the new project's page so milestones can be added.
          router.push(`/projects/${result.data.id}`);
          return;
        }

        // The save just committed exactly what's in `state`; resync the
        // frozen baseline to the new version so a subsequent prop refresh
        // (e.g. from router.refresh() below) isn't mistaken for a remote
        // conflict against our own successful save.
        setConflict(false);
        const savedState: FormState = {
          ...state,
          baseVersion: result.data.version,
        };
        setState(savedState);
        setSnapshot(savedState);
        onClose();
      } catch {
        const message =
          mode === "new"
            ? "Could not create the project."
            : "Could not save the project.";
        toast.error(message);
        mutation.failed(message);
      }
    });
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      aria-busy={isPending}
      onSubmit={(event) => {
        event.preventDefault();
        submit(false);
      }}
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {mode === "edit" && project?.archived ? (
          <Badge variant="secondary">Archived</Badge>
        ) : null}

        {showStaleBanner ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <span>
              This record changed elsewhere. Reload to get the latest (your
              unsaved edits will be replaced).
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

        <div className="space-y-1.5">
          <Label htmlFor="project-name">Name</Label>
          <Input
            id="project-name"
            ref={nameRef}
            autoFocus
            value={state.name}
            disabled={formDisabled}
            aria-invalid={Boolean(errors.name)}
            onChange={(event) =>
              setState((prev) => ({ ...prev, name: event.target.value }))
            }
          />
          {errors.name ? (
            <p className="text-xs text-destructive">{errors.name}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="project-client">Client</Label>
          <Input
            id="project-client"
            value={state.client}
            disabled={formDisabled}
            aria-invalid={Boolean(errors.client)}
            onChange={(event) =>
              setState((prev) => ({ ...prev, client: event.target.value }))
            }
          />
          {errors.client ? (
            <p className="text-xs text-destructive">{errors.client}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select
            value={state.category}
            disabled={formDisabled}
            onValueChange={(value) =>
              setState((prev) => ({ ...prev, category: value }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Owner</Label>
          {canChooseOwner && canEdit ? (
            <OwnerPicker
              people={people}
              value={state.ownerId}
              invalid={Boolean(errors.ownerId)}
              onChange={(ownerId) =>
                setState((prev) => ({
                  ...prev,
                  ownerId,
                  deliverables: prev.deliverables.map((deliverable) =>
                    deliverable.assigneeId
                      ? deliverable
                      : { ...deliverable, assigneeId: ownerId },
                  ),
                }))
              }
            />
          ) : (
            <Input
              value={
                people.find((person) => person.id === state.ownerId)?.name ??
                "Current user"
              }
              disabled
              aria-label="Project owner"
            />
          )}
          {errors.ownerId ? (
            <p className="text-xs text-destructive">{errors.ownerId}</p>
          ) : null}
        </div>

        {mode === "new" ? (
          <div className="space-y-1.5">
            <Label>Milestones</Label>
            <div className="space-y-2">
              {state.deliverables.map((deliverable, index) => (
                <div
                  key={index}
                  className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-[minmax(0,1fr)_8.5rem_8.5rem_auto_auto] sm:items-center"
                >
                  <Input
                    value={deliverable.name}
                    placeholder="Milestone name"
                    disabled={formDisabled}
                    onChange={(event) =>
                      setState((prev) => ({
                        ...prev,
                        deliverables: prev.deliverables.map((item, i) =>
                          i === index
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      }))
                    }
                  />
                  <Input
                    type="date"
                    aria-label="Milestone start date"
                    value={deliverable.startDate}
                    disabled={formDisabled}
                    onChange={(event) =>
                      setState((prev) => ({
                        ...prev,
                        deliverables: prev.deliverables.map((item, i) =>
                          i === index
                            ? { ...item, startDate: event.target.value }
                            : item,
                        ),
                      }))
                    }
                  />
                  <Input
                    type="date"
                    aria-label="Milestone end date"
                    value={deliverable.endDate}
                    disabled={formDisabled}
                    onChange={(event) =>
                      setState((prev) => ({
                        ...prev,
                        deliverables: prev.deliverables.map((item, i) =>
                          i === index
                            ? { ...item, endDate: event.target.value }
                            : item,
                        ),
                      }))
                    }
                  />
                  <AssigneeChip
                    people={people}
                    value={deliverable.assigneeId}
                    disabled={formDisabled}
                    onChange={(assigneeId) =>
                      setState((prev) => ({
                        ...prev,
                        deliverables: prev.deliverables.map((item, i) =>
                          i === index ? { ...item, assigneeId } : item,
                        ),
                      }))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove deliverable"
                    disabled={formDisabled}
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        deliverables: prev.deliverables.filter(
                          (_, i) => i !== index,
                        ),
                      }))
                    }
                  >
                    <X />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={formDisabled}
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    deliverables: [
                      ...prev.deliverables,
                      {
                        name: "",
                        startDate: prev.startDate,
                        endDate: prev.endDate,
                        assigneeId: prev.ownerId,
                      },
                    ],
                  }))
                }
              >
                <Plus data-icon="inline-start" />
                Add milestone
              </Button>
            </div>
            {errors.deliverables ? (
              <p className="text-xs text-destructive">
                Every milestone needs a name and a valid date range.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="project-start">Start date</Label>
            <Input
              id="project-start"
              type="date"
              value={state.startDate}
              disabled={formDisabled}
              aria-invalid={Boolean(errors.startDate)}
              onChange={(event) =>
                setState((prev) => ({ ...prev, startDate: event.target.value }))
              }
            />
            {errors.startDate ? (
              <p className="text-xs text-destructive">{errors.startDate}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-end">End date</Label>
            <Input
              id="project-end"
              type="date"
              value={state.endDate}
              disabled={formDisabled}
              aria-invalid={Boolean(errors.endDate)}
              onChange={(event) =>
                setState((prev) => ({ ...prev, endDate: event.target.value }))
              }
            />
            {errors.endDate ? (
              <p className="text-xs text-destructive">{errors.endDate}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="project-progress">Progress</Label>
          <div className="flex items-center gap-2">
            <Input
              id="project-progress"
              type="number"
              min={0}
              max={100}
              step={1}
              value={state.progress}
              disabled={formDisabled}
              aria-invalid={Boolean(errors.progress)}
              onChange={(event) =>
                setState((prev) => ({
                  ...prev,
                  progress: Number(event.target.value),
                }))
              }
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          {errors.progress ? (
            <p className="text-xs text-destructive">{errors.progress}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Set manually by the project owner; milestones do not calculate it.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="project-budget">Budget (CHF)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="project-budget"
              type="number"
              min={0}
              step="0.01"
              placeholder="Unknown"
              value={state.budget}
              disabled={formDisabled}
              aria-invalid={Boolean(errors.budget)}
              onChange={(event) =>
                setState((prev) => ({ ...prev, budget: event.target.value }))
              }
            />
            <span className="text-sm text-muted-foreground">CHF</span>
          </div>
          {errors.budget ? (
            <p className="text-xs text-destructive">{errors.budget}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="project-sharepoint-link">SharePoint folder</Label>
          <Input
            id="project-sharepoint-link"
            type="url"
            placeholder="https://…"
            value={state.sharePointLink}
            disabled={formDisabled}
            aria-invalid={Boolean(errors.sharePointLink)}
            onChange={(event) =>
              setState((prev) => ({
                ...prev,
                sharePointLink: event.target.value,
              }))
            }
          />
          {errors.sharePointLink ? (
            <p className="text-xs text-destructive">
              {errors.sharePointLink}
            </p>
          ) : null}
        </div>

        <label
          htmlFor="project-completed"
          className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3"
        >
          <Checkbox
            id="project-completed"
            checked={state.completed}
            disabled={formDisabled}
            onCheckedChange={(checked) =>
              setState((prev) => ({ ...prev, completed: checked === true }))
            }
          />
          <span>
            <span className="block text-sm font-medium">Project completed</span>
            <span className="block text-xs text-muted-foreground">
              Completed projects are always shown as on track and can be archived.
            </span>
          </span>
        </label>

      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-muted/30 px-4 py-3">
        <MutationStatus value={mutation.status} className="min-w-0 flex-1" />
        {canEdit ? (
          <div className="flex justify-end gap-2">
            {mode === "new" ? (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => submit(true)}
              >
                Save and add another
              </Button>
            ) : null}
            <Button type="submit" disabled={isPending}>
              {mode === "new" ? "Create project" : "Save changes"}
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Read-only</span>
        )}
      </div>
    </form>
  );
}
