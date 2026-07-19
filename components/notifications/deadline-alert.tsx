"use client";

import Link from "next/link";
import { ChevronDown, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";

import { healthLabel, type Health } from "@/lib/health";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type DeadlineAlertItem = {
  id: string;
  name: string;
  endDateLabel: string;
  health: Health;
  timing: "overdue" | "due-soon";
};

type DeadlineAlertProps = {
  personId: string;
  overdueCount: number;
  dueSoonCount: number;
  items: DeadlineAlertItem[];
};

const HEALTH_DOT: Record<Health, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

const DEADLINE_STORAGE_EVENT = "deadline-alert-storage";

function subscribeToDeadlineStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(DEADLINE_STORAGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(DEADLINE_STORAGE_EVENT, onStoreChange);
  };
}

export function DeadlineAlert({
  personId,
  overdueCount,
  dueSoonCount,
  items,
}: DeadlineAlertProps) {
  const [dismissedWithoutStorage, setDismissedWithoutStorage] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const summary = `⚠ ${overdueCount} overdue · ${dueSoonCount} due within 7 days`;
  const toastStorageKey = `deadline-alert:toast:${personId}`;
  const dismissedStorageKey = `deadline-alert:dismissed:${personId}`;
  const getDismissedSnapshot = useCallback(() => {
    try {
      return sessionStorage.getItem(dismissedStorageKey) === "1";
    } catch {
      return false;
    }
  }, [dismissedStorageKey]);
  const isDismissed = useSyncExternalStore(
    subscribeToDeadlineStorage,
    getDismissedSnapshot,
    () => true,
  );

  useEffect(() => {
    try {
      if (sessionStorage.getItem(toastStorageKey) !== "1") {
        sessionStorage.setItem(toastStorageKey, "1");
        toast.warning(summary);
      }
    } catch {
      toast.warning(summary);
    }
  }, [summary, toastStorageKey]);

  function dismiss() {
    try {
      sessionStorage.setItem(dismissedStorageKey, "1");
      window.dispatchEvent(new Event(DEADLINE_STORAGE_EVENT));
    } catch {
      setDismissedWithoutStorage(true);
    }
  }

  if (isDismissed || dismissedWithoutStorage) {
    return null;
  }

  return (
    <section
      className="shrink-0 border-b border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
      aria-label="Project deadline alerts"
    >
      <div className="flex min-h-10 items-center gap-2 px-4 py-1.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
          aria-expanded={isExpanded}
          aria-controls="deadline-alert-items"
          onClick={() => setIsExpanded((expanded) => !expanded)}
        >
          <span className="truncate">{summary}</span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 transition-transform",
              isExpanded && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-amber-950 hover:bg-amber-100 hover:text-amber-950 dark:text-amber-100 dark:hover:bg-amber-900/60 dark:hover:text-amber-50"
          onClick={dismiss}
        >
          <X />
          <span className="sr-only">Dismiss deadline alerts</span>
        </Button>
      </div>

      {isExpanded ? (
        <ul
          id="deadline-alert-items"
          className="border-t border-amber-200/80 px-4 py-2 dark:border-amber-900"
        >
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={{ pathname: "/projects", query: { project: item.id } }}
                className="flex min-h-8 items-center gap-2 rounded-md px-2 text-sm hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 dark:hover:bg-amber-900/60"
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    HEALTH_DOT[item.health],
                  )}
                  aria-label={healthLabel(item.health)}
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {item.name}
                </span>
                <span className="shrink-0 text-xs text-amber-800 dark:text-amber-200">
                  {item.timing === "overdue" ? "Overdue" : "Due"} ·{" "}
                  {item.endDateLabel}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
