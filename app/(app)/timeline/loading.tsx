import { Skeleton } from "@/components/ui/skeleton";

export default function TimelineLoading() {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-64" />
      </header>

      <div className="overflow-hidden rounded-md border bg-card">
        <div className="flex h-10 items-center gap-3 border-b px-3">
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="divide-y divide-border/50">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex h-10 items-center gap-3 px-3">
              <Skeleton className="h-2 w-2 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-40 shrink-0" />
              <Skeleton className="h-4 max-w-md flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
