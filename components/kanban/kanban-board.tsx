"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setProjectStatus } from "@/lib/actions/projects";
import type { KanbanCardData, KanbanColumnData, ProjectStatus } from "./types";
import { KanbanColumn } from "./kanban-column";
import { useDragMonitor } from "./use-kanban-dnd";

interface KanbanBoardProps {
  columns: KanbanColumnData[];
}

function moveToColumn(
  columns: KanbanColumnData[],
  projectId: string,
  toStatus: ProjectStatus,
): KanbanColumnData[] {
  let movedCard: KanbanCardData | undefined;
  const next: KanbanColumnData[] = columns.map((col) => {
    const found = col.projects.find((p) => p.id === projectId);
    if (!found) {
      return col;
    }
    movedCard = found;
    return { ...col, projects: col.projects.filter((p) => p.id !== projectId) };
  });

  if (!movedCard) {
    return columns;
  }

  const card: KanbanCardData = { ...movedCard, status: toStatus };
  return next.map((col) =>
    col.status === toStatus
      ? { ...col, projects: [...col.projects, card].sort(byEndDateAsc) }
      : col,
  );
}

function byEndDateAsc(a: KanbanCardData, b: KanbanCardData): number {
  return a.endDate.localeCompare(b.endDate);
}

function sortByEndDate(columns: KanbanColumnData[]): KanbanColumnData[] {
  return columns.map((col) => ({
    ...col,
    projects: [...col.projects].sort(byEndDateAsc),
  }));
}

function findCard(
  columns: KanbanColumnData[],
  projectId: string,
): KanbanCardData | undefined {
  return columns
    .flatMap((column) => column.projects)
    .find((project) => project.id === projectId);
}

function placeCard(
  columns: KanbanColumnData[],
  card: KanbanCardData,
): KanbanColumnData[] {
  const withoutCard = columns.map((column) => ({
    ...column,
    projects: column.projects.filter((project) => project.id !== card.id),
  }));

  return withoutCard.map((column) =>
    column.status === card.status
      ? {
          ...column,
          projects: [...column.projects, card].sort(byEndDateAsc),
        }
      : column,
  );
}

function patchCard(
  columns: KanbanColumnData[],
  projectId: string,
  patch: Pick<KanbanCardData, "status" | "version">,
): KanbanColumnData[] {
  const card = findCard(columns, projectId);
  return card ? placeCard(columns, { ...card, ...patch }) : columns;
}

export function KanbanBoard({ columns }: KanbanBoardProps) {
  const reconciliationKey = columns
    .flatMap((column) => column.projects)
    .map((project) => `${project.id}:${project.status}:${project.version}`)
    .join("|");

  return <KanbanBoardState key={reconciliationKey} initialColumns={columns} />;
}

function KanbanBoardState({
  initialColumns,
}: {
  initialColumns: KanbanColumnData[];
}) {
  const router = useRouter();
  const [columns, setColumns] = useState(() => sortByEndDate(initialColumns));
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const { draggedId } = useDragMonitor();

  const handleDrop = useCallback(
    async (payload: {
      id: string;
      fromStatus: ProjectStatus;
      toStatus: ProjectStatus;
      version: number;
    }) => {
      if (payload.fromStatus === payload.toStatus) {
        return;
      }
      // Duplicate-submit protection: ignore drops for a card that already has
      // a status update in flight.
      if (pendingIds.has(payload.id)) {
        return;
      }

      setPendingIds((prev) => new Set(prev).add(payload.id));

      const previousCard = findCard(columns, payload.id);
      if (!previousCard) {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(payload.id);
          return next;
        });
        return;
      }
      setColumns((prev) => moveToColumn(prev, payload.id, payload.toStatus));

      try {
        const result = await setProjectStatus(
          payload.id,
          payload.version,
          payload.toStatus,
        );

        if (!result.ok) {
          setColumns((current) => placeCard(current, previousCard));
          toast.error(result.error);
          return;
        }

        setColumns((current) =>
          patchCard(current, result.data.id, {
            status: result.data.status,
            version: result.data.version,
          }),
        );
        toast.success(`Moved to ${toStatusLabel(result.data.status)}`);
        router.refresh();
      } catch {
        setColumns((current) => placeCard(current, previousCard));
        toast.error("Could not move the project. Please retry.");
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(payload.id);
          return next;
        });
      }
    },
    [columns, pendingIds, router],
  );

  const columnElements = useMemo(
    () =>
      columns.map((column) => (
        <KanbanColumn
          key={column.status}
          column={column}
          draggedId={draggedId}
          pendingIds={pendingIds}
          onDrop={handleDrop}
        />
      )),
    [columns, draggedId, pendingIds, handleDrop],
  );

  const totalProjects = useMemo(
    () => columns.reduce((sum, c) => sum + c.projects.length, 0),
    [columns],
  );

  if (totalProjects === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        No projects yet. Create one from the Projects page.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 gap-3">{columnElements}</div>
  );
}

function toStatusLabel(status: ProjectStatus): string {
  switch (status) {
    case "planning":
      return "Planning";
    case "active":
      return "Active";
    case "on_hold":
      return "On hold";
    case "completed":
      return "Completed";
  }
}
