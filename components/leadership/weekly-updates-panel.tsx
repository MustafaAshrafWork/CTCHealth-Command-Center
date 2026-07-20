"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export type LeadershipWeeklyUpdate = {
  id: string;
  weekOf: Date | string;
  summary: string;
  priorities: string;
  ownerName: string;
  project: {
    id: string;
    name: string;
    client: string;
    completed: boolean;
    archived: boolean;
  };
};

const weekFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function WeeklyUpdatesPanel({
  updates,
}: {
  updates: LeadershipWeeklyUpdate[];
}) {
  const [query, setQuery] = useState("");
  const visibleUpdates = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("en");
    if (!normalizedQuery) {
      return updates;
    }

    return updates.filter((update) =>
      [
        update.project.name,
        update.project.client,
        update.ownerName,
        update.summary,
        update.priorities,
      ].some((value) => value.toLocaleLowerCase("en").includes(normalizedQuery)),
    );
  }, [query, updates]);

  return (
    <details className="group rounded-lg border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium marker:content-none">
        <span>Weekly reflections</span>
        <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
          {updates.length} {updates.length === 1 ? "update" : "updates"}
          <span
            aria-hidden
            className="transition-transform group-open:rotate-180"
          >
            ▾
          </span>
        </span>
      </summary>

      <div className="border-t border-border">
        {updates.length > 0 ? (
          <div className="border-b border-border px-4 py-3">
            <Input
              type="search"
              value={query}
              placeholder="Search project, owner, narrative, or priorities"
              aria-label="Search weekly reflections"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        ) : null}
        {visibleUpdates.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {updates.length === 0
              ? "No weekly reflections have been recorded for this scope."
              : "No weekly reflections match that search."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visibleUpdates.map((update) => (
              <li key={update.id} className="px-4 py-3">
                <details className="group/update">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 marker:content-none">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {update.project.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {update.project.client} · {update.ownerName} · Week of{" "}
                        {weekFormatter.format(new Date(update.weekOf))}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {update.project.completed ? (
                        <Badge variant="secondary">Completed</Badge>
                      ) : null}
                      {update.project.archived ? (
                        <Badge variant="secondary">Archived</Badge>
                      ) : null}
                      <span
                        aria-hidden
                        className="text-xs text-muted-foreground transition-transform group-open/update:rotate-180"
                      >
                        ▾
                      </span>
                    </span>
                  </summary>

                  <div className="mt-3 grid gap-3 border-t border-border pt-3 md:grid-cols-[minmax(0,2fr)_minmax(14rem,1fr)]">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                        Narrative
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                        {update.summary}
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/40 p-3">
                      <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                        Priorities
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                        {update.priorities}
                      </p>
                    </div>
                    <Link
                      href={`/projects/${update.project.id}`}
                      className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline md:col-span-2"
                    >
                      Open project detail
                    </Link>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
