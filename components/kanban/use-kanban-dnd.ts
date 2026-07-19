"use client";

import { useEffect, useRef, useState } from "react";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

import type { KanbanCardData, ProjectStatus } from "./types";

interface DragPayload {
  id: string;
  fromStatus: ProjectStatus;
  toStatus: ProjectStatus;
  version: number;
}

export function useColumnDropTarget(
  status: ProjectStatus,
  onDrop: (payload: DragPayload) => void,
) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isOver, setIsOver] = useState(false);
  const overCount = useRef(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    return dropTargetForElements({
      element,
      canDrop: ({ source }) => {
        const data = source.data as Partial<DragPayload>;
        return data.fromStatus !== status;
      },
      onDragEnter: () => {
        overCount.current += 1;
        setIsOver(true);
      },
      onDragLeave: () => {
        overCount.current = Math.max(0, overCount.current - 1);
        if (overCount.current === 0) {
          setIsOver(false);
        }
      },
      onDrop: ({ source }) => {
        overCount.current = 0;
        setIsOver(false);
        const data = source.data as Partial<DragPayload>;
        if (data.id && data.fromStatus && typeof data.version === "number") {
          onDrop({
            id: data.id,
            fromStatus: data.fromStatus,
            toStatus: status,
            version: data.version,
          });
        }
      },
    });
  }, [status, onDrop]);

  return { ref, isOver };
}

export function useCardDraggable(project: KanbanCardData, disabled: boolean) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const wasDraggingRef = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    return draggable({
      element,
      canDrag: () => !disabled,
      getInitialData: () => ({
        id: project.id,
        fromStatus: project.status,
        version: project.version,
      }),
      onDragStart: () => {
        wasDraggingRef.current = true;
      },
      onDrop: () => {
        wasDraggingRef.current = false;
      },
    });
  }, [project.id, project.status, project.version, disabled]);

  return { ref, wasDraggingRef };
}

export function useDragMonitor(): { draggedId: string | null } {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => {
    return monitorForElements({
      onDragStart: ({ source }) => {
        const data = source.data as Partial<DragPayload>;
        if (data.id) {
          setDraggedId(data.id);
        }
      },
      onDrop: () => {
        setDraggedId(null);
      },
    });
  }, []);

  return { draggedId };
}