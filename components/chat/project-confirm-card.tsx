import type { ProjectDraft } from "@/lib/ai/project-agent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const CATEGORY_LABELS: Record<ProjectDraft["category"], string> = {
  tech: "Tech",
  consultancy: "Consultancy",
  agency: "Agency",
  agents: "Agents",
};

function formatBudget(
  budget: number | null,
  currency: ProjectDraft["currency"],
): string {
  if (budget === null) {
    return "Not set";
  }
  return `${budget.toLocaleString()} ${currency}`;
}

export function ProjectConfirmCard({
  draft,
  pending,
  onConfirm,
  onKeepEditing,
}: {
  draft: ProjectDraft;
  pending: boolean;
  onConfirm: () => void;
  onKeepEditing: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/35 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-foreground">{draft.name}</p>
        <Badge variant="outline">{CATEGORY_LABELS[draft.category]}</Badge>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <dt>Owner</dt>
        <dd className="text-foreground">{draft.ownerName}</dd>
        <dt>Client</dt>
        <dd className="text-foreground">{draft.client}</dd>
        <dt>Start date</dt>
        <dd className="text-foreground">{draft.startDate}</dd>
        <dt>End date</dt>
        <dd className="text-foreground">{draft.endDate}</dd>
        <dt>Budget</dt>
        <dd className="text-foreground">
          {formatBudget(draft.budget, draft.currency)}
        </dd>
      </dl>

      <div className="flex flex-col gap-1 text-xs">
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">At risk: </span>
          {draft.atRisk ? draft.riskDetails : "No"}
        </p>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Needs help: </span>
          {draft.needsHelp ? draft.helpDetails : "No"}
        </p>
      </div>

      <p className="text-xs font-medium text-muted-foreground">
        Nothing is saved until you confirm.
      </p>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={onKeepEditing}
        >
          Keep editing
        </Button>
        <Button type="button" size="sm" disabled={pending} onClick={onConfirm}>
          {pending ? "Creating…" : "Confirm"}
        </Button>
      </div>
    </div>
  );
}
