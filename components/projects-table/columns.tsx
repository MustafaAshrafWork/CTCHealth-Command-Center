"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { dateOnlyUTC, healthLabel } from "@/lib/health";
import { cn } from "@/lib/utils";

import {
  CATEGORY_LABEL,
  HEALTH_DOT,
  HEALTH_RANK,
  PRIORITY_CHIP,
  PRIORITY_LABEL,
  PRIORITY_RANK,
  STATUS_CHIP,
  STATUS_LABEL,
} from "./chip-maps";
import type { ProjectRow } from "./types";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(value: string): string {
  return dateFormatter.format(dateOnlyUTC(new Date(value)));
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

function SortHeader({
  label,
  sorted,
}: {
  label: string;
  sorted: false | "asc" | "desc";
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      {sorted === "asc" ? (
        <ArrowUp className="size-3.5" />
      ) : sorted === "desc" ? (
        <ArrowDown className="size-3.5" />
      ) : (
        <ArrowUpDown className="size-3.5 text-muted-foreground/50" />
      )}
    </span>
  );
}

export const columns: ColumnDef<ProjectRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        onClick={(event) => event.stopPropagation()}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        onClick={(event) => event.stopPropagation()}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    size: 3,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <button
        type="button"
        className="inline-flex items-center"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        <SortHeader label="Name" sorted={column.getIsSorted()} />
      </button>
    ),
    cell: ({ row }) => (
      <div
        className="min-w-0 truncate text-sm font-medium text-foreground"
        title={row.original.name}
      >
        {row.original.name}
      </div>
    ),
    size: 19,
  },
  {
    accessorKey: "client",
    header: ({ column }) => (
      <button
        type="button"
        className="inline-flex items-center"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        <SortHeader label="Client" sorted={column.getIsSorted()} />
      </button>
    ),
    cell: ({ row }) => (
      <span
        className="block max-w-40 truncate text-sm text-muted-foreground"
        title={row.original.client}
      >
        {row.original.client}
      </span>
    ),
    size: 12,
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => (
      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        {CATEGORY_LABEL[row.original.category] ?? row.original.category}
      </span>
    ),
    enableSorting: false,
    size: 8,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
          STATUS_CHIP[row.original.status],
        )}
      >
        {STATUS_LABEL[row.original.status] ?? row.original.status}
      </span>
    ),
    enableSorting: false,
    size: 8,
  },
  {
    accessorKey: "priority",
    header: ({ column }) => (
      <button
        type="button"
        className="inline-flex items-center"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        <SortHeader label="Priority" sorted={column.getIsSorted()} />
      </button>
    ),
    sortingFn: (rowA, rowB) =>
      PRIORITY_RANK[rowA.original.priority] -
      PRIORITY_RANK[rowB.original.priority],
    cell: ({ row }) => (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
          PRIORITY_CHIP[row.original.priority],
        )}
      >
        {PRIORITY_LABEL[row.original.priority] ?? row.original.priority}
      </span>
    ),
    size: 7,
  },
  {
    accessorKey: "ownerName",
    header: "Owner",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Avatar size="sm">
          <AvatarFallback>{initials(row.original.ownerName)}</AvatarFallback>
        </Avatar>
        <span className="truncate text-sm" title={row.original.ownerName}>
          {row.original.ownerName}
        </span>
      </div>
    ),
    enableSorting: false,
    size: 12,
  },
  {
    accessorKey: "progress",
    header: "Progress",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${row.original.progress}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {row.original.progress}%
        </span>
      </div>
    ),
    enableSorting: false,
    size: 9,
  },
  {
    accessorKey: "startDate",
    header: ({ column }) => (
      <button
        type="button"
        className="inline-flex items-center"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        <SortHeader label="Start" sorted={column.getIsSorted()} />
      </button>
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.original.startDate)}
      </span>
    ),
    size: 8,
  },
  {
    accessorKey: "endDate",
    header: ({ column }) => (
      <button
        type="button"
        className="inline-flex items-center"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        <SortHeader label="End" sorted={column.getIsSorted()} />
      </button>
    ),
    cell: ({ row }) => {
      const overdue =
        row.original.status !== "completed" &&
        dateOnlyUTC(new Date(row.original.endDate)).getTime() <
          dateOnlyUTC(new Date()).getTime();
      return (
        <span
          className={cn(
            "text-sm",
            overdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
          )}
        >
          {formatDate(row.original.endDate)}
        </span>
      );
    },
    size: 8,
  },
  {
    accessorKey: "health",
    header: ({ column }) => (
      <button
        type="button"
        className="inline-flex items-center"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        <SortHeader label="Health" sorted={column.getIsSorted()} />
      </button>
    ),
    sortingFn: (rowA, rowB) =>
      HEALTH_RANK[rowA.original.health] - HEALTH_RANK[rowB.original.health],
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1.5 text-sm">
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            HEALTH_DOT[row.original.health],
          )}
        />
        {healthLabel(row.original.health)}
      </span>
    ),
    size: 6,
  },
];
