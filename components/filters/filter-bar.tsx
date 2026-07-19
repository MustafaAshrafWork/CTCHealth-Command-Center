"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { FilterDropdown, type FilterOption } from "./filter-dropdown";
import {
  PERSISTED_FILTER_PARAM_KEYS,
  parseFilterParam,
  type FilterParamKey,
} from "./parse-filter-params";
import { Button } from "@/components/ui/button";

export type FilterBarItem = {
  key: FilterParamKey;
  label: string;
  options: FilterOption[];
  selected: string[];
  searchable?: boolean;
};

export function FilterBar({ filters }: { filters: FilterBarItem[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const replaceParams = useCallback(
    (params: URLSearchParams) => {
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router],
  );

  const toggleFilter = useCallback(
    (filter: FilterBarItem, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const current = parseFilterParam(
        params.get(filter.key),
        filter.options.map((option) => option.value),
      );
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];

      if (next.length > 0) {
        params.set(filter.key, next.join(","));
      } else {
        params.delete(filter.key);
      }
      replaceParams(params);
    },
    [replaceParams, searchParams],
  );

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of PERSISTED_FILTER_PARAM_KEYS) {
      params.delete(key);
    }
    replaceParams(params);
  }, [replaceParams, searchParams]);

  const hasActiveFilters = PERSISTED_FILTER_PARAM_KEYS.some((key) =>
    searchParams.has(key),
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <FilterDropdown
          key={filter.key}
          label={filter.label}
          options={filter.options}
          selected={filter.selected}
          searchable={filter.searchable}
          onToggle={(value) => toggleFilter(filter, value)}
        />
      ))}
      {hasActiveFilters ? (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          Clear all
        </Button>
      ) : null}
    </div>
  );
}
