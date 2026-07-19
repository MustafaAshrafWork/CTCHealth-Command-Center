"use client";

import { useState, useTransition, type ReactNode } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { createIdea } from "@/lib/actions/ideas";

const MAX_LENGTH = 2_000;

export function IdeaDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Enter an idea before submitting.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await createIdea(trimmed);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Idea submitted — thank you!");
      setText("");
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setText("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit your ideas</DialogTitle>
          <DialogDescription>
            Suggest a feature, flag a problem, or share feedback with the team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Textarea
            autoFocus
            rows={5}
            maxLength={MAX_LENGTH}
            value={text}
            disabled={isPending}
            aria-invalid={Boolean(error)}
            placeholder="What should we build or fix next?"
            onChange={(event) => setText(event.target.value)}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {error ? <p className="text-destructive">{error}</p> : <span />}
            <span>
              {text.length}/{MAX_LENGTH}
            </span>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" disabled={isPending} onClick={submit}>
            Submit idea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
