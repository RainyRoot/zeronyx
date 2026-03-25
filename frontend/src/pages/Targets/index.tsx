import { useEffect, useState } from 'react'
import { Plus, Crosshair, Trash2, Globe, Network, Server, Link } from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'
import { useTargetStore } from '@/stores/targetStore'
import { AddTargetModal } from '@/components/targets/AddTargetModal'
import { cn } from '@/lib/utils'
import type { Target, TargetType } from '@/types'

// ---------------------------------------------------------------------------
// Type badge config
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<TargetType, { label: string; badge: string; icon: React.ReactNode }> = {
  ip:     { label: 'IP',     badge: 'text-blue-400 bg-blue-500/10 border-blue-500/20',   icon: <Server  size={10} /> },
  cidr:   { label: 'CIDR',   badge: 'text-orange-400 bg-orange-500/10 border-orange-500/20', icon: <Network size={10} /> },
  domain: { label: 'Domain', badge: 'text-purple-400 bg-purple-500/10 border-purple-500/20', icon: <Globe   size={10} /> },
  url:    { label: 'URL',    badge: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',   icon: <Link    size={10} /> },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TargetsPage(): JSX.Element {
  const activeProject = useProjectStore((s) => s.activeProject)
  const { targets, isLoading, error, fetchTargets, addTarget, removeTarget } = useTargetStore()
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (activeProject) fetchTargets(activeProject.id)
  }, [activeProject, fetchTargets])

  const handleAdd = async (value: string, type: TargetType, notes: string | null) => {
    if (!activeProject) return
    await addTarget(activeProject.id, value, type, notes)
  }

  const handleDelete = async (target: Target) => {
    if (!window.confirm(`Remove "${target.value}" from scope?`)) return
    await removeTarget(target.id)
  }

  // ---- No active project guard ----
  if (!activeProject) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-100 mb-1">Targets</h1>
        <p className="text-sm text-gray-500">Manage hosts, domains, and CIDRs in scope.</p>
        <div className="mt-8 flex flex-col items-center justify-center h-48 bg-[#1a1a1f] border border-dashed border-[#2a2a32] rounded-xl">
          <Crosshair size={28} className="text-gray-700 mb-3" />
          <p className="text-sm text-gray-500">No active project.</p>
          <p className="text-xs text-gray-600 mt-1">Open a project from the Dashboard first.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Targets</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Scope for <span className="text-gray-300">{activeProject.name}</span>
            {targets.length > 0 && (
              <span className="ml-2 text-gray-600">· {targets.length} target{targets.length !== 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
        >
          <Plus size={14} />
          Add Target
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
          {error}
        </div>
      )}

      {/* Scope summary pills */}
      {targets.length > 0 && <ScopeSummary targets={targets} />}

      {/* Target table */}
      {isLoading && targets.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-600">
          Loading targets...
        </div>
      ) : targets.length === 0 ? (
        <EmptyState onAdd={() => setModalOpen(true)} />
      ) : (
        <div className="mt-4 bg-[#1a1a1f] border border-[#2a2a32] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a32] text-[10px] uppercase tracking-wider text-gray-600">
                <th className="text-left px-4 py-3 w-24">Type</th>
                <th className="text-left px-4 py-3">Value</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Notes</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a32]">
              {targets.map((target) => (
                <TargetRow key={target.id} target={target} onDelete={handleDelete} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddTargetModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleAdd}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TargetRow({ target, onDelete }: { target: Target; onDelete: (t: Target) => void }): JSX.Element {
  const cfg = TYPE_CONFIG[target.type] ?? TYPE_CONFIG.url

  return (
    <tr className="group hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium border rounded px-1.5 py-0.5', cfg.badge)}>
          {cfg.icon}
          {cfg.label}
        </span>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-gray-200">{target.value}</td>
      <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell max-w-xs truncate">
        {target.notes ?? <span className="text-gray-700">—</span>}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={() => onDelete(target)}
          className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-1 rounded"
          title="Remove target"
        >
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  )
}

function ScopeSummary({ targets }: { targets: Target[] }): JSX.Element {
  const counts = targets.reduce<Record<TargetType, number>>(
    (acc, t) => { acc[t.type] = (acc[t.type] ?? 0) + 1; return acc },
    {} as Record<TargetType, number>
  )

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {(Object.entries(counts) as [TargetType, number][]).map(([type, count]) => {
        const cfg = TYPE_CONFIG[type]
        return (
          <span
            key={type}
            className={cn('inline-flex items-center gap-1 text-[10px] font-medium border rounded-full px-2.5 py-1', cfg.badge)}
          >
            {cfg.icon}
            {count} {cfg.label}{count !== 1 ? 's' : ''}
          </span>
        )
      })}
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }): JSX.Element {
  return (
    <div className="mt-4 flex flex-col items-center justify-center h-52 bg-[#1a1a1f] border border-dashed border-[#2a2a32] rounded-xl">
      <Crosshair size={28} className="text-gray-700 mb-3" />
      <p className="text-sm font-medium text-gray-400">No targets in scope</p>
      <p className="text-xs text-gray-600 mt-1 mb-4">Add IPs, CIDRs, domains, or URLs to define the engagement scope.</p>
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
      >
        <Plus size={12} />
        Add Target
      </button>
    </div>
  )
}
