"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { Flag } from "@prisma/client";
import { toast } from "sonner";

import {
  MutationStatus,
  useMutationStatus,
} from "@/components/mutation-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createFlag, deleteFlag, toggleFlag } from "@/lib/actions/flags";
import { dateOnlyUTC } from "@/lib/health";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function FlagManager({
  projectId,
  flags,
  canEdit = true,
}: {
  projectId: string;
  flags: Flag[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [needs, setNeeds] = useState("");
  const [from, setFrom] = useState("");
  const [isPending, startTransition] = useTransition();
  const mutation = useMutationStatus();
  const sorted = [...flags].sort(
    (a, b) =>
      Number(a.status !== "open") - Number(b.status !== "open") ||
      b.raised.getTime() - a.raised.getTime(),
  );
  const openCount = sorted.filter((flag) => flag.status === "open").length;

  function addFlag(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) {
      return;
    }
    if (!needs.trim() || !from.trim()) {
      return;
    }

    mutation.saving("Raising blocker…");
    startTransition(async () => {
      try {
        const result = await createFlag(projectId, {
          needs,
          from,
          raised: dateOnlyUTC(new Date()),
        });
        if (!result.ok) {
          toast.error(result.error);
          mutation.failed(result.error, result.code === "CONFLICT");
          return;
        }
        setNeeds("");
        setFrom("");
        toast.success("Blocker raised.");
        mutation.saved("Blocker raised.");
        router.refresh();
      } catch {
        const message = "Could not raise the blocker.";
        toast.error(message);
        mutation.failed(message);
      }
    });
  }

  function changeStatus(flag: Flag) {
    if (!canEdit) {
      return;
    }
    mutation.saving(
      flag.status === "open" ? "Resolving blocker…" : "Reopening blocker…",
    );
    startTransition(async () => {
      try {
        const result = await toggleFlag(flag.id, flag.version);
        if (!result.ok) {
          toast.error(result.error);
          mutation.failed(result.error, result.code === "CONFLICT");
          return;
        }
        const message =
          result.data.status === "open"
            ? "Blocker reopened."
            : "Blocker resolved.";
        toast.success(message);
        mutation.saved(message);
        router.refresh();
      } catch {
        const message = "Could not update the blocker.";
        toast.error(message);
        mutation.failed(message);
      }
    });
  }

  function remove(flag: Flag) {
    if (!canEdit) {
      return;
    }
    if (!window.confirm(`Delete blocker “${flag.needs}”?`)) {
      return;
    }

    mutation.saving("Deleting blocker…");
    startTransition(async () => {
      try {
        const result = await deleteFlag(flag.id, flag.version);
        if (!result.ok) {
          toast.error(result.error);
          mutation.failed(result.error, result.code === "CONFLICT");
          return;
        }
        toast.success("Blocker deleted.");
        mutation.saved("Blocker deleted.");
        router.refresh();
      } catch {
        const message = "Could not delete the blocker.";
        toast.error(message);
        mutation.failed(message);
      }
    });
  }

  return (
    <section
      className="overflow-hidden rounded-lg border border-border bg-card"
      aria-busy={isPending}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium">Blockers and help needed</h2>
        <div className="flex items-center gap-3">
          <MutationStatus value={mutation.status} />
          <span className="text-xs text-muted-foreground">
            {openCount} open
          </span>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No blockers have been raised.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {sorted.map((flag) => (
            <li key={flag.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-sm">{flag.needs}</p>
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
              {canEdit ? (
                <div className="mt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={isPending}
                  onClick={() => remove(flag)}
                >
                  <Trash2 />
                  <span className="sr-only">Delete blocker</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => changeStatus(flag)}
                >
                  {flag.status === "open" ? "Resolve" : "Reopen"}
                </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <form
          className="grid gap-3 border-t border-border bg-muted/20 px-4 py-3"
          onSubmit={addFlag}
        >
        <div className="space-y-1">
          <Label htmlFor="flag-needs">What is needed?</Label>
          <Textarea
            id="flag-needs"
            rows={2}
            maxLength={2_000}
            value={needs}
            disabled={isPending}
            placeholder="Describe the blocker or decision needed"
            onChange={(event) => setNeeds(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1 space-y-1">
            <Label htmlFor="flag-from">Needed from</Label>
            <Input
              id="flag-from"
              maxLength={200}
              value={from}
              disabled={isPending}
              placeholder="Person, team, or TBD"
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <Button
            type="submit"
            disabled={isPending || !needs.trim() || !from.trim()}
          >
            <Plus data-icon="inline-start" />
            Raise blocker
          </Button>
        </div>
        </form>
      ) : null}
    </section>
  );
}
