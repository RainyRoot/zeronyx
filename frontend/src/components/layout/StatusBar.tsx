import { Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BackendStatus } from '@/types'

interface StatusBarProps {
  backendStatus: BackendStatus
  projectName?: string
}

export function StatusBar({ backendStatus, projectName }: StatusBarProps): JSX.Element {
  return (
    <div className="flex items-center justify-between h-6 px-3 bg-[#0d0d0f] border-t border-[#2a2a32] shrink-0 text-[10px] text-gray-500 select-none">
      {/* Left */}
      <div className="flex items-center gap-3">
        <StatusIndicator status={backendStatus} />
        {projectName && (
          <span className="text-gray-400">
            <span className="text-gray-600 mr-1">Project:</span>
            {projectName}
          </span>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <span className="text-gray-700">ZeroNyx v0.5.0</span>
        <span className="text-gray-700 cursor-default" title="Press ? for keyboard shortcuts">?</span>
      </div>
    </div>
  )
}

function StatusIndicator({ status }: { status: BackendStatus }): JSX.Element {
  const config: Record<BackendStatus, { color: string; label: string }> = {
    connected: { color: 'text-green-500', label: 'Backend connected' },
    connecting: { color: 'text-yellow-500 animate-pulse', label: 'Connecting...' },
    disconnected: { color: 'text-gray-600', label: 'Backend offline' },
    error: { color: 'text-red-500', label: 'Backend error' }
  }
  const { color, label } = config[status]
  return (
    <span className={cn('flex items-center gap-1', color)}>
      <Circle size={6} fill="currentColor" />
      <span>{label}</span>
    </span>
  )
}
