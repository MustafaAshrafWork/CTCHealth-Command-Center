import Link from "next/link";

import { healthLabel, type Health } from "@/lib/health";
import { cn } from "@/lib/utils";

export type ManagerProjectRow = {
  id: string;
  name: string;
  client: string;
  health: Health;
  progress: number;
  daysRemaining: number;
};

const HEALTH_DOT: Record<Health, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

function daysLabel(days: number): string {
  if (days < 0) {
    const overdue = Math.abs(days);
    return `${overdue} ${overdue === 1 ? "day" : "days"} overdue`;
  }
  if (days === 0) {
    return "Due today";
  }
  return `${days} ${days === 1 ? "day" : "days"} remaining`;
}

export function ManagerProjects({ rows }: { rows: ManagerProjectRow[] }) {
  return (
    <details className="group rounded-lg border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium marker:content-none">
        <span>Projects</span>
        <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
          {rows.length} {rows.length === 1 ? "project" : "projects"}
          <span
            aria-hidden
            className="transition-transform group-open:rotate-180"
          >
            ▾
          </span>
        </span>
      </summary>

      <div className="border-t border-border">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No active projects for this owner.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/projects/${row.id}`}
                  className="grid gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_9rem_9rem] sm:items-center"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          HEALTH_DOT[row.health],
                        )}
                      />
                      <span className="truncate text-sm font-medium">
                        {row.name}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate pl-4 text-xs text-muted-foreground">
                      {row.client} · {healthLabel(row.health)}
                    </span>
                  </span>

                  <span className="flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${row.progress}%` }}
                      />
                    </span>
                    <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                      {row.progress}%
                    </span>
                  </span>

                  <span
                    className={cn(
                      "text-xs tabular-nums text-muted-foreground sm:text-right",
                      row.daysRemaining < 0 && "font-medium text-destructive",
                    )}
                  >
                    {daysLabel(row.daysRemaining)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
