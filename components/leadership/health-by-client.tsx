import { healthLabel, type Health } from "@/lib/health";
import { cn } from "@/lib/utils";

export type ClientHealthRow = {
  client: string;
  projectCount: number;
  blockerCount: number;
  worstHealth: Health;
};

const HEALTH_DOT: Record<Health, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

export function HealthByClient({ rows }: { rows: ClientHealthRow[] }) {
  return (
    <details className="group rounded-lg border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium marker:content-none">
        <span>Health by client</span>
        <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
          {rows.length} {rows.length === 1 ? "client" : "clients"}
          <span
            aria-hidden
            className="transition-transform group-open:rotate-180"
          >
            ▾
          </span>
        </span>
      </summary>

      <div className="overflow-x-auto border-t border-border">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No active clients to show.
          </p>
        ) : (
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Client</th>
                <th className="px-4 py-2 text-right font-medium">Projects</th>
                <th className="px-4 py-2 text-right font-medium">Open blockers</th>
                <th className="px-4 py-2 font-medium">Worst health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.client}>
                  <td className="px-4 py-2.5 font-medium">{row.client}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {row.projectCount}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {row.blockerCount}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          HEALTH_DOT[row.worstHealth],
                        )}
                      />
                      {healthLabel(row.worstHealth)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </details>
  );
}
