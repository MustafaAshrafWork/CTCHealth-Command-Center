export function HeadlineSummary({
  critical,
  atRisk,
  dueWithin30Days,
  scopeLabel,
}: {
  critical: number;
  atRisk: number;
  dueWithin30Days: number;
  scopeLabel: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-card px-5 py-5">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {scopeLabel}
      </p>
      <p className="mt-2 max-w-3xl text-xl font-semibold tracking-tight sm:text-2xl">
        {critical} critical, {atRisk} at risk and {dueWithin30Days} due within
        30 days.
      </p>
    </section>
  );
}
