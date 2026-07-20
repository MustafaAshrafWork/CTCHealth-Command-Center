"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createWeeklyUpdateConfirmed } from "@/lib/actions/weekly-updates";
import { dateOnlyUTC } from "@/lib/health";

const MAX_SUMMARY = 20_000;
const MAX_PRIORITIES = 10_000;
const MAX_TRANSCRIPT = 100_000;

type Step = "form" | "confirm";

const weekFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function currentWeekMondayInputValue(): string {
  const today = dateOnlyUTC(new Date());
  const day = today.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setUTCDate(monday.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function isMondayInput(value: string): boolean {
  return Boolean(value) && dateOnlyUTC(new Date(value)).getUTCDay() === 1;
}

export function WeeklyUpdateCompose({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [weekOf, setWeekOf] = useState(() => currentWeekMondayInputValue());
  const [summary, setSummary] = useState("");
  const [priorities, setPriorities] = useState("");
  const [rawTranscript, setRawTranscript] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setWeekOf(currentWeekMondayInputValue());
    setSummary("");
    setPriorities("");
    setRawTranscript("");
    setFormError(null);
    setStep("form");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      resetForm();
    }
  }

  function goToConfirm() {
    if (!weekOf) {
      setFormError("Week of is required.");
      return;
    }
    if (!isMondayInput(weekOf)) {
      setFormError("Week of must be a Monday.");
      return;
    }
    if (!summary.trim()) {
      setFormError("Enter this week's narrative before continuing.");
      return;
    }
    if (!priorities.trim()) {
      setFormError("Enter this week's focus before continuing.");
      return;
    }
    setFormError(null);
    setStep("confirm");
  }

  function confirmSave() {
    setFormError(null);
    startTransition(async () => {
      const result = await createWeeklyUpdateConfirmed(projectId, {
        weekOf: dateOnlyUTC(new Date(weekOf)),
        summary,
        priorities,
        rawTranscript: rawTranscript.trim() ? rawTranscript : undefined,
        confirmed: true,
      });
      if (!result.ok) {
        toast.error(result.error);
        setFormError(result.error);
        setStep("form");
        return;
      }
      toast.success("Weekly update saved.");
      setOpen(false);
      resetForm();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <Plus data-icon="inline-start" />
          Log weekly update
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "form" ? "Weekly update" : "Confirm weekly update"}
          </DialogTitle>
          <DialogDescription>
            {step === "form"
              ? "Record this project's weekly reflection. You'll review it before it's saved."
              : "This creates the confirmed weekly update for this project, owner, and week. Review it below before saving."}
          </DialogDescription>
        </DialogHeader>

        {formError ? (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        {step === "form" ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="weekly-update-week-of">Week of</Label>
              <Input
                id="weekly-update-week-of"
                type="date"
                value={weekOf}
                disabled={isPending}
                onChange={(event) => setWeekOf(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">Must be a Monday.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="weekly-update-summary">Weekly narrative</Label>
              <Textarea
                id="weekly-update-summary"
                rows={5}
                maxLength={MAX_SUMMARY}
                value={summary}
                disabled={isPending}
                placeholder="What happened this week? Progress, decisions, risks…"
                onChange={(event) => setSummary(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="weekly-update-priorities">Focus this week</Label>
              <Textarea
                id="weekly-update-priorities"
                rows={4}
                maxLength={MAX_PRIORITIES}
                value={priorities}
                disabled={isPending}
                placeholder="What's the priority for the coming week?"
                onChange={(event) => setPriorities(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="weekly-update-transcript">Notes (optional)</Label>
              <Textarea
                id="weekly-update-transcript"
                rows={4}
                maxLength={MAX_TRANSCRIPT}
                value={rawTranscript}
                disabled={isPending}
                placeholder="Meeting notes, transcript, or other context worth keeping on record"
                onChange={(event) => setRawTranscript(event.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                Week of
              </p>
              <p className="mt-1 text-sm">
                {weekFormatter.format(dateOnlyUTC(new Date(weekOf)))}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                Weekly narrative
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                {summary}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                Focus this week
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                {priorities}
              </p>
            </div>
            {rawTranscript.trim() ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  Notes
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                  {rawTranscript}
                </p>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {step === "form" ? (
            <>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="button" disabled={isPending} onClick={goToConfirm}>
                Review &amp; save
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setStep("form")}
              >
                Back to edit
              </Button>
              <Button type="button" disabled={isPending} onClick={confirmSave}>
                Confirm &amp; save
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
