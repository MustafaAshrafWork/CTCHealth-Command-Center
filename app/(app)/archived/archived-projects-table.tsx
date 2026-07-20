"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { removeProject, setArchived } from "@/lib/actions/projects";
import type { ProjectVersionRef } from "@/lib/actions/projects";
import {
  MutationStatus,
  useMutationStatus,
} from "@/components/mutation-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ArchivedProjectRow = {
  id: string;
  version: number;
  name: string;
  client: string;
  category: string;
  completed: boolean;
  archived: boolean;
  canEdit: boolean;
  ownerName: string;
  startDateLabel: string;
  endDateLabel: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  tech: "Tech",
  consultancy: "Consultancy",
  agency: "Agency",
  agents: "Agents",
};

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function ArchivedProjectsTable({
  projects,
}: {
  projects: ArchivedProjectRow[];
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const mutation = useMutationStatus();

  if (projects.length === 0) {
    return (
      <div className="grid gap-3">
        <MutationStatus value={mutation.status} />
        <div className="flex h-48 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          No completed or archived projects.
        </div>
      </div>
    );
  }

  const editableProjects = projects.filter((project) => project.canEdit);
  const allSelected =
    editableProjects.length > 0 &&
    editableProjects.every((project) => selectedIds.has(project.id));
  const someSelected = editableProjects.some((project) =>
    selectedIds.has(project.id),
  );
  const headerChecked = allSelected
    ? true
    : someSelected
      ? "indeterminate"
      : false;

  function toggleAll(checked: boolean) {
    setSelectedIds(
      checked
        ? new Set(editableProjects.map((project) => project.id))
        : new Set(),
    );
  }

  function toggleProject(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function changeArchived(
    projectsToChange: ProjectVersionRef[],
    archived: boolean,
  ) {
    if (projectsToChange.length === 0) {
      return;
    }

    mutation.saving(archived ? "Archiving…" : "Returning to active portfolio…");
    startTransition(async () => {
      try {
        const result = await setArchived(projectsToChange, archived);
        if (!result.ok) {
          toast.error(result.error);
          mutation.failed(result.error, result.code === "CONFLICT");
          if (result.code === "CONFLICT") {
            setSelectedIds(new Set());
            router.refresh();
          }
          return;
        }

        const count = result.data.count;
        toast.success(
          `${count} project${count === 1 ? "" : "s"} ${
            archived ? "archived" : "unarchived"
          }.`,
        );
        mutation.saved(
          archived
            ? `${count} project${count === 1 ? "" : "s"} archived.`
            : `${count} project${count === 1 ? "" : "s"} returned to the active portfolio.`,
        );
        setSelectedIds((current) => {
          const next = new Set(current);
          projectsToChange.forEach((project) => next.delete(project.id));
          return next;
        });
        router.refresh();
      } catch {
        const message = `Could not ${archived ? "archive" : "unarchive"} the selected projects.`;
        toast.error(message);
        mutation.failed(message);
      }
    });
  }

  function permanentlyDelete(project: ArchivedProjectRow) {
    if (!project.canEdit) {
      return;
    }

    const confirmed = window.confirm(
      `Permanently delete “${project.name}”? This deletes the project and its milestones, blockers, and weekly updates. This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    mutation.saving("Deleting permanently…");
    startTransition(async () => {
      try {
        const result = await removeProject(project.id, project.version);
        if (!result.ok) {
          toast.error(result.error);
          mutation.failed(result.error, result.code === "CONFLICT");
          if (result.code === "CONFLICT") {
            router.refresh();
          }
          return;
        }

        setSelectedIds((current) => {
          const next = new Set(current);
          next.delete(project.id);
          return next;
        });
        toast.success("Project permanently deleted.");
        mutation.saved("Project permanently deleted.");
        router.refresh();
      } catch {
        const message = "Could not permanently delete the project.";
        toast.error(message);
        mutation.failed(message);
      }
    });
  }

  const archivedCount = projects.filter((project) => project.archived).length;
  const awaitingArchiveCount = projects.length - archivedCount;
  const selectedProjects = projects.filter((project) =>
    project.canEdit && selectedIds.has(project.id),
  );
  const selectedAwaitingArchive = selectedProjects.filter(
    (project) => !project.archived && project.completed,
  );
  const selectedArchived = selectedProjects.filter(
    (project) => project.archived,
  );

  return (
    <div className="flex flex-col gap-3" aria-busy={isPending}>
      <div className="flex min-h-8 items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {awaitingArchiveCount} awaiting archive · {archivedCount} archived
          {selectedProjects.length > 0
            ? ` · ${selectedProjects.length} selected`
            : ""}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {selectedAwaitingArchive.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() =>
                changeArchived(
                  selectedAwaitingArchive.map(({ id, version }) => ({
                    id,
                    version,
                  })),
                  true,
                )
              }
            >
              <Archive data-icon="inline-start" />
              Archive ({selectedAwaitingArchive.length})
            </Button>
          ) : null}
          {selectedArchived.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() =>
                changeArchived(
                  selectedArchived.map(({ id, version }) => ({ id, version })),
                  false,
                )
              }
            >
              <RotateCcw data-icon="inline-start" />
              Unarchive ({selectedArchived.length})
            </Button>
          ) : null}
        </div>
      </div>
      <MutationStatus value={mutation.status} />

      <div className="overflow-hidden rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-muted/40">
              <TableHead className="w-10 pl-3">
                <Checkbox
                  checked={headerChecked}
                  disabled={isPending || editableProjects.length === 0}
                  aria-label="Select all editable completed and archived projects"
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                />
              </TableHead>
              <TableHead>Name / client</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-40 pr-3 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow
                key={project.id}
                className="h-10"
                data-state={selectedIds.has(project.id) ? "selected" : undefined}
              >
                <TableCell className="pl-3">
                  {project.canEdit ? (
                    <Checkbox
                      checked={selectedIds.has(project.id)}
                      disabled={isPending}
                      aria-label={`Select ${project.name}`}
                      onCheckedChange={(checked) =>
                        toggleProject(project.id, checked === true)
                      }
                    />
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="max-w-64">
                    <Link
                      href={`/projects/${project.id}`}
                      className="block truncate font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {project.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {project.client}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {categoryLabel(project.category)}
                  </span>
                </TableCell>
                <TableCell>{project.ownerName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {project.startDateLabel}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {project.endDateLabel}
                </TableCell>
                <TableCell>
                  {project.archived ? (
                    <Badge variant="secondary" className="font-normal">
                      Archived
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-emerald-300 bg-emerald-50 font-normal text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                    >
                      Completed · awaiting archive
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="pr-3 text-right">
                  {project.canEdit ? (
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          changeArchived(
                            [{ id: project.id, version: project.version }],
                            !project.archived,
                          )
                        }
                      >
                        {project.archived ? "Unarchive" : "Archive"}
                      </Button>
                      {project.archived ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={isPending}
                          aria-label={`Permanently delete ${project.name}`}
                          onClick={() => permanentlyDelete(project)}
                        >
                          <Trash2 />
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Read-only</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
