import Link from "next/link";

import { Badge } from "@/components/ui/badge";

export type LeadershipFlag = {
  id: string;
  needs: string;
  from: string;
  raised: Date | string;
  status: string;
  project: {
    id: string;
    name: string;
    client: string;
  };
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function BlockersPanel({
  flags,
  includeResolved,
}: {
  flags: LeadershipFlag[];
  includeResolved: boolean;
}) {
  return (
    <details className="group rounded-lg border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium marker:content-none">
        <span>{includeResolved ? "Blockers and history" : "Open blockers"}</span>
        <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
          {flags.length} {flags.length === 1 ? "flag" : "flags"}
          <span
            aria-hidden
            className="transition-transform group-open:rotate-180"
          >
            ▾
          </span>
        </span>
      </summary>

      <div className="border-t border-border">
        {flags.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {includeResolved
              ? "No blockers have been raised for this owner."
              : "No open blockers across the portfolio."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {flags.map((flag) => (
              <li key={flag.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{flag.needs}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      From {flag.from || "TBD"} · Raised{" "}
                      {dateFormatter.format(new Date(flag.raised))}
                    </p>
                  </div>
                  <Badge
                    variant={flag.status === "open" ? "destructive" : "secondary"}
                  >
                    {flag.status === "open" ? "Open" : "Resolved"}
                  </Badge>
                </div>
                <Link
                  href={`/projects/${flag.project.id}`}
                  className="mt-2 inline-block text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {flag.project.name} · {flag.project.client}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
