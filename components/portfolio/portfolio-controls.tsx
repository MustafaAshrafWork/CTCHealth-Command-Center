"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  CircleAlert,
  FolderKanban,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PortfolioSort } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

export const PORTFOLIO_ATTENTION_VALUES = [
  "active",
  "critical",
  "risk",
  "due30",
] as const;

export type PortfolioAttention =
  (typeof PORTFOLIO_ATTENTION_VALUES)[number];

type Option = { value: string; label: string };

type PortfolioCounts = {
  active: number;
  critical: number;
  risk: number;
  due30: number;
};

const SORT_OPTIONS: { value: PortfolioSort; label: string }[] = [
  { value: "priority", label: "Priority" },
  { value: "start", label: "Start date" },
  { value: "end", label: "End date" },
  { value: "client", label: "Client" },
];

const ALL_CLIENTS_VALUE = "__portfolio_all_clients__";

const ATTENTION_CARDS: {
  value: PortfolioAttention;
  label: string;
  icon: typeof FolderKanban;
  activeClassName: string;
  hoverClassName: string;
}[] = [
  {
    value: "active",
    label: "Active",
    icon: FolderKanban,
    activeClassName: "border-foreground/30 bg-foreground text-background",
    hoverClassName: "hover:bg-foreground/90",
  },
  {
    value: "critical",
    label: "Critical",
    icon: CircleAlert,
    activeClassName:
      "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/60 dark:text-red-100",
    hoverClassName: "hover:bg-red-100 dark:hover:bg-red-950/80",
  },
  {
    value: "risk",
    label: "At risk",
    icon: AlertTriangle,
    activeClassName:
      "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100",
    hoverClassName: "hover:bg-amber-100 dark:hover:bg-amber-950/80",
  },
  {
    value: "due30",
    label: "Due ≤30 days",
    icon: CalendarClock,
    activeClassName:
      "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-100",
    hoverClassName: "hover:bg-blue-100 dark:hover:bg-blue-950/80",
  },
];

function updateParam(
  current: URLSearchParams,
  key: string,
  value: string | null,
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  if (value) {
    next.set(key, value);
  } else {
    next.delete(key);
  }
  return next;
}

export function PortfolioControls({
  attention,
  category,
  categoryOptions,
  client,
  clientOptions,
  counts,
  owner,
  ownerOptions,
  showCompleted,
  sort,
}: {
  attention: PortfolioAttention;
  category: string | null;
  categoryOptions: Option[];
  client: string | null;
  clientOptions: Option[];
  counts: PortfolioCounts;
  owner: string | null;
  ownerOptions: Option[];
  showCompleted: boolean;
  sort: PortfolioSort;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasActiveControls = Boolean(
    client ||
      owner ||
      category ||
      attention !== "active" ||
      sort !== "priority" ||
      !showCompleted,
  );

  function replaceParam(key: string, value: string | null) {
    const next = updateParam(searchParams, key, value);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {ATTENTION_CARDS.map((card) => {
          const Icon = card.icon;
          const selected = attention === card.value;
          return (
            <button
              key={card.value}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                replaceParam(
                  "attention",
                  card.value === "active" ? null : card.value,
                )
              }
              className={cn(
                "flex min-h-20 items-center justify-between rounded-lg border bg-card px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                // Hover lightens only when unselected. A selected card carries
                // its own (sometimes dark) background, so the generic light-gray
                // hover must not wash over it and hide the text.
                !selected && "hover:bg-muted/60",
                selected && card.activeClassName,
                selected && card.hoverClassName,
              )}
            >
              <span>
                <span className="block text-2xl font-semibold tabular-nums">
                  {counts[card.value]}
                </span>
                <span
                  className={cn(
                    "block text-sm text-muted-foreground",
                    selected && "text-current opacity-75",
                  )}
                >
                  {card.label}
                </span>
              </span>
              <Icon className="size-5 opacity-60" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 rounded-lg border bg-card px-3 py-2.5">
        <div className="grid gap-1.5">
          <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Filter
          </span>
          <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Client
            <Select
              value={client ?? ALL_CLIENTS_VALUE}
              onValueChange={(value) =>
                replaceParam(
                  "client",
                  value === ALL_CLIENTS_VALUE ? null : value,
                )
              }
            >
              <SelectTrigger className="w-48" aria-label="Filter by client">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CLIENTS_VALUE}>All clients</SelectItem>
                {clientOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Owner
            <Select
              value={owner ?? "all"}
              onValueChange={(value) =>
                replaceParam("owner", value === "all" ? null : value)
              }
            >
              <SelectTrigger className="w-48" aria-label="Filter by owner">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All owners</SelectItem>
                {ownerOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Category
            <Select
              value={category ?? "all"}
              onValueChange={(value) =>
                replaceParam("category", value === "all" ? null : value)
              }
            >
              <SelectTrigger className="w-44" aria-label="Filter by category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categoryOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <div className="grid gap-1 text-xs font-medium text-muted-foreground">
            <span>Completed</span>
            <label className="flex h-8 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm font-normal text-foreground">
              <Checkbox
                checked={showCompleted}
                onCheckedChange={(checked) =>
                  replaceParam("completed", checked === true ? null : "hide")
                }
              />
              Show completed
            </label>
          </div>
          </div>
        </div>

        <div className="flex items-end gap-2">
          {hasActiveControls ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const next = new URLSearchParams(searchParams.toString());
                next.delete("client");
                next.delete("owner");
                next.delete("category");
                next.delete("attention");
                next.delete("sort");
                next.delete("completed");
                const query = next.toString();
                router.replace(query ? `${pathname}?${query}` : pathname, {
                  scroll: false,
                });
              }}
            >
              Clear
            </Button>
          ) : null}
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Sort by
            <Select
              value={sort}
              onValueChange={(value) =>
                replaceParam("sort", value === "priority" ? null : value)
              }
            >
              <SelectTrigger className="w-44" aria-label="Sort projects by">
                {/* Static prefix keeps the collapsed control reading as an
                    ordering ("Sort by: Client"), never a second Client filter.
                    SelectValue must stay — it is the popover's anchor ref.
                    Wrapping both in one flex child stops the trigger's
                    justify-between from flinging the arrow to the far edge. */}
                <span className="flex items-center gap-1 truncate">
                  <span className="text-muted-foreground">Sort by:</span>
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
      </div>
    </div>
  );
}
