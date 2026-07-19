"use client";

import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Archive,
  History,
  Kanban,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Calendar,
} from "lucide-react";

import { PERSISTED_FILTER_PARAM_KEYS } from "@/components/filters/parse-filter-params";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: ListChecks },
  { href: "/board", label: "Board", icon: Kanban },
  { href: "/timeline", label: "Timeline", icon: Calendar },
  { href: "/ideas", label: "Ideas", icon: Lightbulb },
  { href: "/archived", label: "Archived", icon: Archive },
  { href: "/changelog", label: "Changelog", icon: History },
] as const;

function NavigationLinks({
  pathname,
  filterQuery,
}: {
  pathname: string;
  filterQuery: string;
}) {
  return NAV_ITEMS.map(({ href, label, icon: Icon }) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    const filteredHref = filterQuery ? `${href}?${filterQuery}` : href;
    return (
      <Link
        key={href}
        href={filteredHref}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          active &&
            "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
        )}
      >
        <Icon className="size-4" />
        {label}
      </Link>
    );
  });
}

function FilteredNavigation({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams();
  const filters = new URLSearchParams();

  for (const key of PERSISTED_FILTER_PARAM_KEYS) {
    for (const value of searchParams.getAll(key)) {
      filters.append(key, value);
    }
  }

  return (
    <NavigationLinks pathname={pathname} filterQuery={filters.toString()} />
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-sidebar">
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
      <nav className="flex flex-col gap-0.5 px-2">
        <Suspense
          fallback={<NavigationLinks pathname={pathname} filterQuery="" />}
        >
          <FilteredNavigation pathname={pathname} />
        </Suspense>
      </nav>
    </aside>
  );
}
