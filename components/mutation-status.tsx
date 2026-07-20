"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

export type MutationStatusValue = {
  kind: "idle" | "saving" | "saved" | "error" | "conflict";
  message: string;
};

const IDLE_STATUS: MutationStatusValue = { kind: "idle", message: "" };

export function useMutationStatus() {
  const [status, setStatus] = useState<MutationStatusValue>(IDLE_STATUS);

  return {
    status,
    saving(message = "Saving…") {
      setStatus({ kind: "saving", message });
    },
    saved(message = "Saved.") {
      setStatus({ kind: "saved", message });
    },
    failed(message: string, conflict = false) {
      setStatus({ kind: conflict ? "conflict" : "error", message });
    },
    reset() {
      setStatus(IDLE_STATUS);
    },
  };
}

export function MutationStatus({
  value,
  className,
}: {
  value: MutationStatusValue;
  className?: string;
}) {
  const isFailure = value.kind === "error" || value.kind === "conflict";

  return (
    <p
      role={isFailure ? "alert" : "status"}
      aria-live={isFailure ? "assertive" : "polite"}
      aria-atomic="true"
      className={cn(
        "min-h-5 text-xs",
        value.kind === "saving" && "text-muted-foreground",
        value.kind === "saved" && "text-emerald-700 dark:text-emerald-300",
        isFailure && "text-destructive",
        className,
      )}
    >
      {value.kind === "conflict" ? "Conflict: " : ""}
      {value.message}
    </p>
  );
}
