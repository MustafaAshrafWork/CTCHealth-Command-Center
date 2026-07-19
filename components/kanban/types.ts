import type { Health } from "@/lib/health";

export type ProjectStatus = "planning" | "active" | "on_hold" | "completed";

export interface KanbanCardData {
  id: string;
  name: string;
  client: string;
  status: ProjectStatus;
  priority: "high" | "medium" | "low";
  endDate: string;
  version: number;
  health: Health;
  ownerName: string;
}

export interface KanbanColumnData {
  status: ProjectStatus;
  title: string;
  projects: KanbanCardData[];
}

export const COLUMN_ORDER: ProjectStatus[] = [
  "planning",
  "active",
  "on_hold",
  "completed",
];

export const COLUMN_TITLE: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
};