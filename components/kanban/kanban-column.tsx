"use client";

import { KanbanCard } from "./kanban-card";
import { useColumnDropTarget } from "./use-kanban-dnd";
import type { KanbanColumnData, ProjectStatus } from "./types";

interface KanbanColumnProps {
  column: KanbanColumnData;
  draggedId: string | null;
  pendingIds: Set<string>;
  onDrop: (payload: {
    id: string;
    fromStatus: ProjectStatus;
    toStatus: ProjectStatus;
    version: number;
  }) => void;
}

export function KanbanColumn({
  column,
  draggedId,
  pendingIds,
  onDrop,
}: KanbanColumnProps) {
  const { ref, isOver } = useColumnDropTarget(column.status, onDrop);

  return (
    <section
      ref={ref}
      className={`flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-muted/60 transition ${
        isOver ? "ring-2 ring-ring/60" : ""
      }`}
    >
      <header className="flex items-center justify-between px-3 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {column.title}
        </h2>
        <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border">
          {column.projects.length}
        </span>
      </header>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {column.projects.length === 0 ? (
          <div
            className={`flex h-full min-h-24 items-center justify-center rounded-lg border border-dashed text-center text-[11px] text-muted-foreground/70 ${
              isOver ? "border-ring/50 bg-ring/5" : "border-border"
            }`}
          >
            {isOver ? "Drop here" : "No projects"}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {column.projects.map((project) => (
              <li key={project.id}>
                <KanbanCard
                  project={project}
                  draggedId={draggedId}
                  pending={pendingIds.has(project.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}