import { Skeleton } from "@/components/ui/skeleton";

export default function BoardLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-3 w-56" />
      </div>
      <div className="flex h-full min-h-0 gap-3">
        {Array.from({ length: 4 }).map((_, columnIndex) => (
          <div
            key={columnIndex}
            className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-muted/60"
          >
            <header className="flex items-center justify-between px-3 py-2.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-6 rounded-full" />
            </header>
            <div className="flex flex-1 flex-col gap-2 overflow-hidden px-2 pb-2">
              {Array.from({ length: 3 }).map((__, cardIndex) => (
                <Skeleton key={cardIndex} className="h-24 shrink-0 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
