import { Skeleton } from "@/components/ui/skeleton";

export default function ArchivedLoading() {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex min-h-8 items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-36" />
        </div>
        <div className="overflow-hidden rounded-md border bg-card">
          <div className="flex h-10 items-center gap-4 border-b bg-muted/40 px-3">
            <Skeleton className="h-4 w-4 rounded-sm" />
            <Skeleton className="h-4 flex-1" />
          </div>
          <div className="divide-y">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex h-10 items-center gap-4 px-3">
                <Skeleton className="h-4 w-4 rounded-sm" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
