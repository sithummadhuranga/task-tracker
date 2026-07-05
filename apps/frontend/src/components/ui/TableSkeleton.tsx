interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

// Previews the shape of the content that's coming, rather than a generic spinner — the
// product register's stated preference for loading state on data-dense surfaces.
export function TableSkeleton({ rows = 5, columns = 3 }: TableSkeletonProps) {
  return (
    <div className="divide-y divide-border rounded-xl border border-border" aria-hidden="true">
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: columns }, (_, colIndex) => (
            <div
              key={colIndex}
              className="h-3.5 animate-pulse rounded-full bg-surface-2"
              style={{ width: colIndex === 0 ? "40%" : "18%" }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
