import { Skeleton } from "@/components/ui/skeleton";

export default function ChangelogLoading() {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </header>
      <Skeleton className="h-4 w-72" />

      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
