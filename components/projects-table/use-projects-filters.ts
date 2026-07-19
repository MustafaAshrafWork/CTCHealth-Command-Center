"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  FILTER_PARAM_KEYS,
  PERSISTED_FILTER_PARAM_KEYS,
  parseFilterParams,
  type FilterParamKey,
} from "@/components/filters/parse-filter-params";

import type { ProjectRow } from "./types";

export type FilterKey = FilterParamKey;

export type ProjectFilters = {
  search: string;
  client: string[];
  owner: string[];
  category: string[];
  status: string[];
  priority: string[];
  health: string[];
};

const SEARCH_DEBOUNCE_MS = 200;

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

export function useProjectsFilters(
  rows: ProjectRow[],
  clientOptions: { value: string; label: string }[],
  ownerOptions: { value: string; label: string }[],
) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  const urlFilters = useMemo(
    () =>
      parseFilterParams(
        Object.fromEntries(
          FILTER_PARAM_KEYS.map((key) => [key, searchParams.get(key)]),
        ),
        {
          clients: clientOptions.map((option) => option.value),
          ownerIds: ownerOptions.map((option) => option.value),
        },
      ),
    [clientOptions, ownerOptions, searchParams],
  );

  const filters = useMemo<ProjectFilters>(
    () => ({ search, ...urlFilters }),
    [search, urlFilters],
  );

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
    (key: FilterKey, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const next = toggleValue(filters[key], value);
      if (next.length > 0) {
        params.set(key, next.join(","));
      } else {
        params.delete(key);
      }
      replaceParams(params);
    },
    [filters, replaceParams, searchParams],
  );

  const clearAll = useCallback(() => {
    setSearch("");
    const params = new URLSearchParams(searchParams.toString());
    for (const key of PERSISTED_FILTER_PARAM_KEYS) {
      params.delete(key);
    }
    replaceParams(params);
  }, [replaceParams, searchParams]);

  const filteredRows = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return rows.filter((row) => {
      if (query) {
        const haystack = `${row.name} ${row.client}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (filters.client.length > 0 && !filters.client.includes(row.client)) {
        return false;
      }
      if (filters.owner.length > 0 && !filters.owner.includes(row.ownerId)) {
        return false;
      }
      if (
        filters.category.length > 0 &&
        !filters.category.includes(row.category)
      ) {
        return false;
      }
      if (filters.status.length > 0 && !filters.status.includes(row.status)) {
        return false;
      }
      if (
        filters.priority.length > 0 &&
        !filters.priority.includes(row.priority)
      ) {
        return false;
      }
      if (filters.health.length > 0 && !filters.health.includes(row.health)) {
        return false;
      }
      return true;
    });
  }, [rows, debouncedSearch, filters]);

  const hasActiveUrlFilters = PERSISTED_FILTER_PARAM_KEYS.some((key) =>
    searchParams.has(key),
  );

  return {
    filters,
    setSearch,
    toggleFilter,
    clearAll,
    filteredRows,
    hasActiveUrlFilters,
  };
}
