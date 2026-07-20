"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Archive,
  Calendar,
  ChartNoAxesCombined,
  Menu,
} from "lucide-react";

import { PERSISTED_FILTER_PARAM_KEYS } from "@/components/filters/parse-filter-params";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV_PERSISTED_PARAM_KEYS = [
  ...PERSISTED_FILTER_PARAM_KEYS,
  "sort",
] as const;

const PRIMARY_NAV_ITEMS = [
  { href: "/timeline", label: "Timeline", icon: Calendar },
  { href: "/leadership", label: "Leadership", icon: ChartNoAxesCombined },
] as const;

const SECONDARY_NAV_ITEMS = [
  { href: "/archived", label: "Archived", icon: Archive },
] as const;

type NavigationItem =
  | (typeof PRIMARY_NAV_ITEMS)[number]
  | (typeof SECONDARY_NAV_ITEMS)[number];

function NavigationLinks({
  items,
  pathname,
  filterQuery,
  secondary = false,
  onNavigate,
}: {
  items: readonly NavigationItem[];
  pathname: string;
  filterQuery: string;
  secondary?: boolean;
  onNavigate?: () => void;
}) {
  return items.map(({ href, label, icon: Icon }) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    const filteredHref = filterQuery ? `${href}?${filterQuery}` : href;
    return (
      <Link
        key={href}
        href={filteredHref}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          secondary && "py-1 text-xs text-sidebar-foreground/55",
          active &&
            "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
        )}
      >
        <Icon
          className={secondary ? "size-3.5" : "size-4"}
          aria-hidden="true"
        />
        {label}
      </Link>
    );
  });
}

function NavigationGroups({
  pathname,
  filterQuery,
  onNavigate,
}: {
  pathname: string;
  filterQuery: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-0.5">
        <NavigationLinks
          items={PRIMARY_NAV_ITEMS}
          pathname={pathname}
          filterQuery={filterQuery}
          onNavigate={onNavigate}
        />
      </div>
      <div className="mt-auto border-t border-border/70 pt-2">
        <p className="px-2.5 pb-1 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
          Records
        </p>
        <NavigationLinks
          items={SECONDARY_NAV_ITEMS}
          pathname={pathname}
          filterQuery={filterQuery}
          secondary
          onNavigate={onNavigate}
        />
      </div>
    </>
  );
}

function FilteredNavigation({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const searchParams = useSearchParams();
  const filters = new URLSearchParams();

  for (const key of NAV_PERSISTED_PARAM_KEYS) {
    for (const value of searchParams.getAll(key)) {
      filters.append(key, value);
    }
  }

  return (
    <NavigationGroups
      pathname={pathname}
      filterQuery={filters.toString()}
      onNavigate={onNavigate}
    />
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
      <div className="flex h-14 items-center px-4">
        <Image
          src="/logos/logo-on-light.png"
          alt="ctcHealth"
          width={2737}
          height={1042}
          className="h-7 w-auto"
          priority
        />
      </div>
      <nav
        aria-label="Primary navigation"
        className="flex min-h-0 flex-1 flex-col gap-0.5 px-2 pb-3"
      >
        <Suspense
          fallback={<NavigationGroups pathname={pathname} filterQuery="" />}
        >
          <FilteredNavigation pathname={pathname} />
        </Suspense>
      </nav>
    </aside>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[min(18rem,calc(100vw-2rem))] gap-0 bg-sidebar p-0"
      >
        <SheetHeader className="border-b border-border pr-12">
          <Image
            src="/logos/logo-on-light.png"
            alt="ctcHealth"
            width={2737}
            height={1042}
            className="h-7 w-auto self-start"
          />
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Navigate the ctcHealth Command Center.
          </SheetDescription>
        </SheetHeader>
        <nav
          aria-label="Mobile navigation"
          className="flex min-h-0 flex-1 flex-col px-2 py-3"
        >
          <Suspense
            fallback={
              <NavigationGroups
                pathname={pathname}
                filterQuery=""
                onNavigate={() => setOpen(false)}
              />
            }
          >
            <FilteredNavigation
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
          </Suspense>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
