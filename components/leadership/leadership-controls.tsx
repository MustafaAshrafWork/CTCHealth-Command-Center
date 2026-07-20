"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OwnerOption = {
  id: string;
  name: string;
};

const SORT_OPTIONS = [
  { value: "priority", label: "Priority" },
  { value: "start", label: "Start date" },
  { value: "end", label: "End date" },
  { value: "client", label: "Client" },
] as const;

export function LeadershipControls({
  owners,
  ownerId,
  sort,
}: {
  owners: OwnerOption[];
  ownerId: string;
  sort: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function replaceParam(key: "owner" | "sort", value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (
      (key === "owner" && value === "all") ||
      (key === "sort" && value === "priority")
    ) {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <label
          htmlFor="leadership-owner"
          className="block text-xs font-medium text-muted-foreground"
        >
          View
        </label>
        <Select
          value={ownerId}
          onValueChange={(value) => replaceParam("owner", value)}
        >
          <SelectTrigger id="leadership-owner" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            {owners.map((owner) => (
              <SelectItem key={owner.id} value={owner.id}>
                {owner.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="leadership-sort"
          className="block text-xs font-medium text-muted-foreground"
        >
          Sort projects
        </label>
        <Select
          value={sort}
          onValueChange={(value) => replaceParam("sort", value)}
        >
          <SelectTrigger id="leadership-sort" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
