"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDownIcon, UsersIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type PeopleFilterPerson = { id: string; name: string };

export function PeopleFilter({
  people,
  selectedIds,
  isAll,
  sessionPersonId,
}: {
  people: PeopleFilterPerson[];
  selectedIds: string[];
  isAll: boolean;
  sessionPersonId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const effectiveSelected = useMemo(
    () => (isAll ? people.map((p) => p.id) : selectedIds),
    [isAll, selectedIds, people],
  );

  const label = useMemo(() => {
    if (isAll || effectiveSelected.length === people.length) {
      return "All projects";
    }
    if (
      effectiveSelected.length === 1 &&
      effectiveSelected[0] === sessionPersonId
    ) {
      return "My projects";
    }
    if (effectiveSelected.length === 1) {
      const p = people.find((p) => p.id === effectiveSelected[0]);
      return p ? p.name : "1 person";
    }
    return `${effectiveSelected.length} people`;
  }, [effectiveSelected, isAll, people, sessionPersonId]);

  const update = useCallback(
    (next: { all: boolean; ids: string[] }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.all) {
        params.set("people", "all");
      } else if (next.ids.length === 1 && next.ids[0] === sessionPersonId) {
        params.delete("people");
      } else {
        params.set("people", next.ids.join(","));
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams, sessionPersonId],
  );

  const toggleAll = useCallback(() => {
    if (isAll || effectiveSelected.length === people.length) {
      update({ all: false, ids: [sessionPersonId] });
    } else {
      update({ all: true, ids: [] });
    }
  }, [effectiveSelected.length, isAll, people.length, update, sessionPersonId]);

  const togglePerson = useCallback(
    (id: string) => {
      const set = new Set(effectiveSelected);
      if (set.has(id)) {
        set.delete(id);
      } else {
        set.add(id);
      }
      const ids = people.map((p) => p.id).filter((pid) => set.has(pid));
      if (ids.length === people.length) {
        update({ all: true, ids: [] });
        return;
      }
      if (ids.length === 0) {
        update({ all: false, ids: [sessionPersonId] });
        return;
      }
      update({ all: false, ids });
    },
    [effectiveSelected, people, update, sessionPersonId],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          aria-label="Filter by people"
        >
          <UsersIcon className="size-3.5 text-muted-foreground" />
          <span>{label}</span>
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-1 p-1">
        <div
          role="button"
          tabIndex={0}
          onClick={toggleAll}
          className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
        >
          <Checkbox
            checked={isAll || effectiveSelected.length === people.length}
            className="pointer-events-none"
          />
          <span>All projects</span>
        </div>
        <div className="my-1 h-px bg-border" />
        <div className="max-h-72 overflow-auto">
          {people.map((person) => {
            const checked = effectiveSelected.includes(person.id);
            return (
              <div
                key={person.id}
                role="button"
                tabIndex={0}
                onClick={() => togglePerson(person.id)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <Checkbox checked={checked} className="pointer-events-none" />
                <span className="truncate">
                  {person.name}
                  {person.id === sessionPersonId ? (
                    <span className="ml-1 text-muted-foreground">(you)</span>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}