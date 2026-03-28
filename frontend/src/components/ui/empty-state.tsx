import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

/**
 * Consistent empty state for pages with no data.
 *
 * Usage:
 *   <EmptyState
 *     icon={ShieldAlert}
 *     title="No findings yet"
 *     description="Run a scan to discover vulnerabilities."
 *     action={<button>New Scan</button>}
 *   />
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-20 px-8 text-center', className)}>
      <div className="w-14 h-14 rounded-2xl bg-[#1a1a22] border border-[#2a2a32] flex items-center justify-center mb-4">
        <Icon size={24} className="text-gray-600" />
      </div>
      <p className="text-gray-300 font-medium text-sm mb-1">{title}</p>
      {description && <p className="text-gray-600 text-xs max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
