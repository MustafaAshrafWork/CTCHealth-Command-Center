import { Skeleton } from "@/components/ui/skeleton";

export default function IdeasLoading() {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-8 w-36" />
      </header>

      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-border px-4 py-3">
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
