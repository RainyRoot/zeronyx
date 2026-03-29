import { cn } from '@/lib/utils'

/**
 * Loading skeleton block.
 *
 * Usage:
 *   <Skeleton className="h-4 w-32" />
 *   <Skeleton className="h-4 w-full" />
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse bg-[#1a1a22] rounded', className)}
    />
  )
}

/**
 * Pre-built table row skeleton for list pages.
 */
export function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <tr className="border-b border-[#1a1a22]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className={`h-3 ${i === 0 ? 'w-24' : i === cols - 1 ? 'w-16' : 'w-full'}`} />
        </td>
      ))}
    </tr>
  )
}

/**
 * Card skeleton.
 */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-[#111114] border border-[#2a2a32] rounded-xl p-4 space-y-2">
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 2 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  )
}
