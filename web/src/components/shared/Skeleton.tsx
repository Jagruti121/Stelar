/**
 * LoadingSkeleton — animated shimmer placeholders.
 * Usage: <Skeleton className="h-4 w-32" />
 *        <Skeleton.Card /> for a full card placeholder.
 */


import { cn } from '@/utils/cn';

interface SkeletonProps {
  className?: string;
}

function Skeleton({ className }: SkeletonProps): React.ReactElement {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}

/** A pre-built card skeleton for page-level loading states. */
function SkeletonCard(): React.ReactElement {
  return (
    <div className="card animate-pulse space-y-4" aria-busy="true" aria-label="Loading…">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-3/5" />
    </div>
  );
}

/** A table row skeleton. */
function SkeletonRow({ cols = 4 }: { cols?: number }): React.ReactElement {
  return (
    <tr className="border-b border-[--border]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

/** Full-page loading overlay used on initial app load. */
function SkeletonPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-[--surface] flex items-center justify-center" role="status">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-[--primary] animate-pulse" />
        <p className="text-sm text-[--text-muted] animate-pulse">Loading STELLAR…</p>
      </div>
    </div>
  );
}

Skeleton.Card = SkeletonCard;
Skeleton.Row = SkeletonRow;
Skeleton.Page = SkeletonPage;

export { Skeleton };
