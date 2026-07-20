export type WeeklyUpdateItem = {
  id: string;
  weekOf: Date | string;
  summary: string;
  priorities: string;
  createdDate: Date | string;
  ownerName: string;
};

const weekFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function UpdateContent({ update }: { update: WeeklyUpdateItem }) {
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(14rem,1fr)]">
      <div>
        <h3 className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
          Weekly narrative
        </h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
          {update.summary}
        </p>
      </div>
      <div className="rounded-md bg-muted/40 p-3">
        <h3 className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
          Focus this week
        </h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
          {update.priorities}
        </p>
      </div>
    </div>
  );
}

export function WeeklyUpdateHistory({
  updates,
}: {
  updates: WeeklyUpdateItem[];
}) {
  const sorted = [...updates].sort(
    (a, b) =>
      new Date(b.weekOf).getTime() - new Date(a.weekOf).getTime() ||
      new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime(),
  );
  const [latest, ...earlier] = sorted;

  if (!latest) {
    return (
      <section className="rounded-lg border border-border bg-card">
        <h2 className="border-b border-border px-4 py-3 text-sm font-medium">
          Weekly reflection
        </h2>
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No weekly reflection has been recorded for this project yet.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Latest weekly reflection</h2>
          <p className="text-xs text-muted-foreground">
            Week of {weekFormatter.format(new Date(latest.weekOf))} ·{" "}
            {latest.ownerName}
          </p>
        </div>
      </div>
      <div className="px-4 py-4">
        <UpdateContent update={latest} />
      </div>

      {earlier.length > 0 ? (
        <details className="group border-t border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium marker:content-none">
            <span>Earlier reflections</span>
            <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
              {earlier.length} earlier
              <span
                aria-hidden
                className="transition-transform group-open:rotate-180"
              >
                ▾
              </span>
            </span>
          </summary>
          <ul className="divide-y divide-border border-t border-border">
            {earlier.map((update) => (
              <li key={update.id} className="px-4 py-4">
                <p className="mb-3 text-xs font-medium text-muted-foreground">
                  Week of {weekFormatter.format(new Date(update.weekOf))} ·{" "}
                  {update.ownerName}
                </p>
                <UpdateContent update={update} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
