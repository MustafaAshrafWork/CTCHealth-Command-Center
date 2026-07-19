"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { dateOnlyUTC } from "@/lib/health";

import { useCardDraggable } from "./use-kanban-dnd";
import type { KanbanCardData } from "./types";

const endDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});

const PRIORITY_STYLE: Record<KanbanCardData["priority"], string> = {
  high: "bg-red-50 text-red-700 ring-red-200",
  medium: "bg-amber-50 text-amber-700 ring-amber-200",
  low: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

const PRIORITY_LABEL: Record<KanbanCardData["priority"], string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const HEALTH_DOT: Record<KanbanCardData["health"], string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function KanbanCard({
  project,
  draggedId,
  pending,
}: {
  project: KanbanCardData;
  draggedId: string | null;
  pending: boolean;
}) {
  const router = useRouter();
  const { ref, wasDraggingRef } = useCardDraggable(project, pending);

  const handleClick = useCallback(() => {
    if (wasDraggingRef.current) {
      wasDraggingRef.current = false;
      return;
    }
    router.push(`/projects/${project.id}`);
  }, [router, project.id, wasDraggingRef]);

  const isDragging = draggedId === project.id;
  const endDate = dateOnlyUTC(new Date(project.endDate));
  const today = dateOnlyUTC(new Date());
  const overdue =
    project.status !== "completed" && endDate.getTime() < today.getTime();

  return (
    <button
      ref={ref}
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={handleClick}
      className={`group relative w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm transition hover:border-ring/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait ${isDragging || pending ? "opacity-40" : "opacity-100"}`}
    >
      <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
        {project.name}
      </h3>
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {project.client}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-1 ring-border"
            title={project.ownerName}
          >
            {getInitials(project.ownerName)}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${PRIORITY_STYLE[project.priority]}`}
          >
            {PRIORITY_LABEL[project.priority]}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`size-2 rounded-full ${HEALTH_DOT[project.health]}`}
            title={project.health}
            aria-hidden
          />
          <time
            dateTime={project.endDate}
            className={`text-[10px] ${overdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}
          >
            {endDateFormatter.format(endDate)}
          </time>
        </div>
      </div>
      </button>
  );
}
