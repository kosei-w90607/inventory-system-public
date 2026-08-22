import { Skeleton } from "@/components/ui/skeleton";

export function ListSkeleton({ rows = 6, columns = 8 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2 rounded-md border p-3" role="status" aria-label="一覧を読み込み中">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-2" data-slot="list-skeleton-row">
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton key={column} className="h-8 min-w-20 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
