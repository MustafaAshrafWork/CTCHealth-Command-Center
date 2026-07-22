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

function ProjectSummaryBody({ draft }: { draft: ProjectDraft }) {
  return (
    <>
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
    </>
  );
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
      <ProjectSummaryBody draft={draft} />

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

export function ProjectEditCard({
  draft,
  pending,
  onConfirm,
  onCancel,
}: {
  draft: ProjectDraft;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/35 p-3 text-sm">
      <p className="text-xs font-medium text-muted-foreground">
        Proposed changes — review before saving
      </p>
      <ProjectSummaryBody draft={draft} />

      <p className="text-xs font-medium text-muted-foreground">
        Nothing is changed until you confirm.
      </p>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="button" size="sm" disabled={pending} onClick={onConfirm}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

export function ProjectIdeaCard({
  idea,
  pending,
  onConfirm,
  onCancel,
}: {
  idea: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/35 p-3 text-sm">
      <p className="text-xs font-medium text-muted-foreground">
        Add this to the Ideas tab?
      </p>
      <p className="whitespace-pre-wrap text-foreground">{idea}</p>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="button" size="sm" disabled={pending} onClick={onConfirm}>
          {pending ? "Adding…" : "Add idea"}
        </Button>
      </div>
    </div>
  );
}

export function ProjectDeleteCard({
  pending,
  onConfirm,
  onCancel,
}: {
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
      <p className="font-medium text-foreground">Delete this project?</p>
      <p className="text-xs text-muted-foreground">
        An active project is archived (reversible). A project that is already
        archived is permanently deleted. Nothing happens until you confirm.
      </p>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? "Working…" : "Delete project"}
        </Button>
      </div>
    </div>
  );
}
