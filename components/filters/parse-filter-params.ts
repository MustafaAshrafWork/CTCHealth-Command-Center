export const FILTER_PARAM_KEYS = [
  "client",
  "status",
  "priority",
  "health",
  "category",
  "owner",
] as const;

export const PERSISTED_FILTER_PARAM_KEYS = [
  "people",
  ...FILTER_PARAM_KEYS,
] as const;

export type FilterParamKey = (typeof FILTER_PARAM_KEYS)[number];
export type FilterSearchParamValue =
  | string
  | string[]
  | null
  | undefined;

export type FilterSearchParams = Partial<
  Record<FilterParamKey | "people", FilterSearchParamValue>
>;

export type ParsedFilterParams = Record<FilterParamKey, string[]>;

export const STATUS_FILTER_OPTIONS = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
] as const;

export const PRIORITY_FILTER_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const;

export const HEALTH_FILTER_OPTIONS = [
  { value: "green", label: "On track" },
  { value: "amber", label: "At risk" },
  { value: "red", label: "Critical" },
] as const;

export const CATEGORY_FILTER_OPTIONS = [
  { value: "tech", label: "Tech" },
  { value: "consultancy", label: "Consultancy" },
  { value: "agency", label: "Agency" },
  { value: "agents", label: "Agents" },
] as const;

function optionValues(options: readonly { value: string }[]): string[] {
  return options.map((option) => option.value);
}

export function firstSearchParam(
  value: FilterSearchParamValue,
): string | undefined {
  return Array.isArray(value) ? value[0] : (value ?? undefined);
}

export function parseFilterParam(
  param: FilterSearchParamValue,
  validValues: readonly string[],
): string[] {
  const validSet = new Set(validValues);
  const values = (Array.isArray(param) ? param : [param])
    .flatMap((value) => value?.split(",") ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && validSet.has(value));

  return Array.from(new Set(values));
}

export function parseFilterParams(
  params: FilterSearchParams,
  validValues: {
    clients?: readonly string[];
    ownerIds?: readonly string[];
  } = {},
): ParsedFilterParams {
  return {
    client: parseFilterParam(params.client, validValues.clients ?? []),
    status: parseFilterParam(
      params.status,
      optionValues(STATUS_FILTER_OPTIONS),
    ),
    priority: parseFilterParam(
      params.priority,
      optionValues(PRIORITY_FILTER_OPTIONS),
    ),
    health: parseFilterParam(
      params.health,
      optionValues(HEALTH_FILTER_OPTIONS),
    ),
    category: parseFilterParam(
      params.category,
      optionValues(CATEGORY_FILTER_OPTIONS),
    ),
    owner: parseFilterParam(params.owner, validValues.ownerIds ?? []),
  };
}
