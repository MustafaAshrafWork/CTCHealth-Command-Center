"use client";

import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setArchived } from "@/lib/actions/projects";
import type { ProjectVersionRef } from "@/lib/actions/projects";
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

  if (projects.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        No archived projects.
      </div>
    );
  }

  const allSelected = projects.every((project) => selectedIds.has(project.id));
  const someSelected = projects.some((project) => selectedIds.has(project.id));
  const headerChecked = allSelected
    ? true
    : someSelected
      ? "indeterminate"
      : false;

  function toggleAll(checked: boolean) {
    setSelectedIds(
      checked ? new Set(projects.map((project) => project.id)) : new Set(),
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

  function unarchive(projectsToUnarchive: ProjectVersionRef[]) {
    startTransition(async () => {
      try {
        const result = await setArchived(projectsToUnarchive, false);
        if (!result.ok) {
          toast.error(result.error);
          if (result.code === "CONFLICT") {
            setSelectedIds(new Set());
            router.refresh();
          }
          return;
        }

        const count = result.data.count;
        toast.success(
          `${count} project${count === 1 ? "" : "s"} unarchived.`,
        );
        setSelectedIds((current) => {
          const next = new Set(current);
          projectsToUnarchive.forEach((project) => next.delete(project.id));
          return next;
        });
        router.refresh();
      } catch {
        toast.error("Could not unarchive the selected projects.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3" aria-busy={isPending}>
      <div className="flex min-h-8 items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {projects.length} archived project{projects.length === 1 ? "" : "s"}
          {selectedIds.size > 0 ? ` · ${selectedIds.size} selected` : ""}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending || selectedIds.size === 0}
          onClick={() =>
            unarchive(
              projects
                .filter((project) => selectedIds.has(project.id))
                .map(({ id, version }) => ({ id, version })),
            )
          }
        >
          <RotateCcw data-icon="inline-start" />
          Unarchive selected
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-muted/40">
              <TableHead className="w-10 pl-3">
                <Checkbox
                  checked={headerChecked}
                  disabled={isPending}
                  aria-label="Select all archived projects"
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                />
              </TableHead>
              <TableHead>Name / client</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-28 pr-3 text-right">Action</TableHead>
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
                  <Checkbox
                    checked={selectedIds.has(project.id)}
                    disabled={isPending}
                    aria-label={`Select ${project.name}`}
                    onCheckedChange={(checked) =>
                      toggleProject(project.id, checked === true)
                    }
                  />
                </TableCell>
                <TableCell>
                  <div className="max-w-64">
                    <p className="truncate font-medium text-foreground">
                      {project.name}
                    </p>
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
                  <Badge variant="secondary" className="font-normal">
                    Archived
                  </Badge>
                </TableCell>
                <TableCell className="pr-3 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      unarchive([{ id: project.id, version: project.version }])
                    }
                  >
                    Unarchive
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
