import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clock, Search, X, RotateCcw, Trash2,
  CheckCircle2, AlertCircle, Square, Loader2,
  Network, FolderOpen, Zap, Globe, Server, Search as SearchIcon,
  Activity,
} from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'
import { useScanStore } from '@/stores/scanStore'
import { scansApi } from '@/services/api'
import { cn } from '@/lib/utils'
import type { Scan, ScanStatus } from '@/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOOL_COLORS: Record<string, { badge: string; icon: React.ReactNode }> = {
  nmap:         { badge: 'text-blue-400 bg-blue-500/10 border-blue-500/20',       icon: <Network    size={10} /> },
  gobuster:     { badge: 'text-orange-400 bg-orange-500/10 border-orange-500/20', icon: <FolderOpen size={10} /> },
  nuclei:       { badge: 'text-red-400 bg-red-500/10 border-red-500/20',          icon: <Zap        size={10} /> },
  nikto:        { badge: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', icon: <Globe      size={10} /> },
  hydra:        { badge: 'text-purple-400 bg-purple-500/10 border-purple-500/20', icon: <Server     size={10} /> },
  searchsploit: { badge: 'text-green-400 bg-green-500/10 border-green-500/20',    icon: <SearchIcon size={10} /> },
}

const STATUS_CONFIG: Record<ScanStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  pending:   { label: 'Pending',   cls: 'text-gray-400 bg-gray-500/10 border-gray-500/20',      icon: <Clock      size={10} /> },
  running:   { label: 'Running',   cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20',      icon: <Loader2    size={10} className="animate-spin" /> },
  completed: { label: 'Done',      cls: 'text-green-400 bg-green-500/10 border-green-500/20',   icon: <CheckCircle2 size={10} /> },
  failed:    { label: 'Failed',    cls: 'text-red-400 bg-red-500/10 border-red-500/20',         icon: <AlertCircle  size={10} /> },
  cancelled: { label: 'Cancelled', cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',icon: <Square       size={10} /> },
}

const ALL_STATUSES: ScanStatus[] = ['completed', 'running', 'failed', 'cancelled', 'pending']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt) return '—'
  const start = new Date(startedAt).getTime()
  const end   = finishedAt ? new Date(finishedAt).getTime() : Date.now()
  const secs  = Math.round((end - start) / 1000)
  if (secs < 60)  return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function scanSummary(scan: Scan): string {
  const cfg = scan.config as Record<string, string> | null
  if (!cfg) return scan.profile ?? scan.tool
  if (scan.tool === 'nmap')         return `${cfg.flags ?? ''} ${cfg.target ?? ''}`.trim()
  if (scan.tool === 'gobuster')     return `${cfg.mode ?? 'dir'} ${cfg.url ?? cfg.domain ?? ''}`
  if (scan.tool === 'nuclei')       return cfg.url ?? ''
  if (scan.tool === 'nikto')        return cfg.url ?? ''
  if (scan.tool === 'hydra')        return `${cfg.service ?? ''} ${cfg.host ?? cfg.target ?? ''}`
  if (scan.tool === 'searchsploit') return cfg.query ?? ''
  return scan.profile ?? ''
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ToolBadge({ tool }: { tool: string }) {
  const cfg = TOOL_COLORS[tool] ?? { badge: 'text-gray-400 bg-gray-500/10 border-gray-500/20', icon: null }
  return (
    <span className={cn('inline-flex items-center gap-1 text-[9px] font-mono font-medium border rounded px-1.5 py-0.5', cfg.badge)}>
      {cfg.icon}
      {tool}
    </span>
  )
}

function StatusBadge({ status }: { status: ScanStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium border rounded px-1.5 py-0.5', cfg.cls)}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Stats bar
// ---------------------------------------------------------------------------

function StatsBar({ scans }: { scans: Scan[] }) {
  const byStatus = scans.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1
    return acc
  }, {})
  const byTool = scans.reduce<Record<string, number>>((acc, s) => {
    acc[s.tool] = (acc[s.tool] ?? 0) + 1
    return acc
  }, {})
  const tools = Object.entries(byTool).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div className="flex flex-wrap items-center gap-4 mb-5 p-4 bg-[#1a1a1f] border border-[#2a2a32] rounded-xl text-xs">
      <div className="flex items-center gap-1.5 text-gray-400">
        <Activity size={13} className="text-gray-600" />
        <span className="text-gray-200 font-semibold">{scans.length}</span>
        <span className="text-gray-600">total</span>
      </div>
      <div className="w-px h-4 bg-[#2a2a32]" />
      {/* Status counts */}
      {byStatus.completed && (
        <span className="text-green-400">{byStatus.completed} done</span>
      )}
      {byStatus.failed && (
        <span className="text-red-400">{byStatus.failed} failed</span>
      )}
      {byStatus.cancelled && (
        <span className="text-yellow-400">{byStatus.cancelled} cancelled</span>
      )}
      {(byStatus.completed || byStatus.failed || byStatus.cancelled) && (
        <div className="w-px h-4 bg-[#2a2a32]" />
      )}
      {/* Tool breakdown */}
      {tools.map(([tool, count]) => {
        const cfg = TOOL_COLORS[tool]
        return cfg ? (
          <span key={tool} className={cn('inline-flex items-center gap-1', cfg.badge.split(' ')[0])}>
            {cfg.icon}
            <span className="text-gray-500">{count}×</span>
            <span>{tool}</span>
          </span>
        ) : null
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function HistoryPage(): JSX.Element {
  const navigate = useNavigate()
  const activeProject = useProjectStore((s) => s.activeProject)
  const { startScan, setSelectedTool, setActiveScan } = useScanStore()

  const [scans, setScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rerunning, setRerunning] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [toolFilter, setToolFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<ScanStatus[]>([])

  const loadScans = async (projectId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await scansApi.list(projectId, { limit: 500 })
      // Sort newest first
      setScans(res.items.slice().sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeProject) loadScans(activeProject.id)
  }, [activeProject])

  const availableTools = useMemo(() => [...new Set(scans.map((s) => s.tool))].sort(), [scans])

  const filtered = useMemo(() => {
    return scans.filter((s) => {
      if (toolFilter.length > 0 && !toolFilter.includes(s.tool)) return false
      if (statusFilter.length > 0 && !statusFilter.includes(s.status)) return false
      if (search) {
        const q = search.toLowerCase()
        const sum = scanSummary(s).toLowerCase()
        return (
          s.tool.includes(q) ||
          s.id.includes(q) ||
          sum.includes(q) ||
          (s.profile?.toLowerCase().includes(q) ?? false)
        )
      }
      return true
    })
  }, [scans, toolFilter, statusFilter, search])

  const toggleTool = (tool: string) =>
    setToolFilter((prev) => prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool])

  const toggleStatus = (s: ScanStatus) =>
    setStatusFilter((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])

  const handleRerun = async (scan: Scan) => {
    if (!activeProject) return
    setRerunning(scan.id)
    try {
      await startScan(
        activeProject.id,
        scan.target_id,
        scan.tool,
        scan.profile,
        (scan.config as Record<string, unknown>) ?? {},
      )
      setSelectedTool(scan.tool)
      navigate('/scans')
    } catch (e) {
      setError((e as Error).message)
      setRerunning(null)
    }
  }

  const handleDelete = async (scan: Scan) => {
    if (!window.confirm(`Delete scan ${scan.id.slice(0, 8)}…?`)) return
    try {
      await scansApi.delete(scan.id)
      setScans((prev) => prev.filter((s) => s.id !== scan.id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const handleOpen = (scan: Scan) => {
    setSelectedTool(scan.tool)
    setActiveScan(scan)
    navigate('/scans')
  }

  const clearFilters = () => {
    setSearch('')
    setToolFilter([])
    setStatusFilter([])
  }
  const hasFilters = search || toolFilter.length > 0 || statusFilter.length > 0

  // ---- No project ----
  if (!activeProject) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-100 mb-1">Scan History</h1>
        <p className="text-sm text-gray-500">Timeline of all scans across this project.</p>
        <div className="mt-8 flex flex-col items-center justify-center h-48 bg-[#1a1a1f] border border-dashed border-[#2a2a32] rounded-xl">
          <Clock size={28} className="text-gray-700 mb-3" />
          <p className="text-sm text-gray-500">No active project.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Scan History</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            <span className="text-gray-300">{activeProject.name}</span>
            {scans.length > 0 && <span className="ml-2 text-gray-600">· {scans.length} scans</span>}
          </p>
        </div>
        <button
          onClick={() => activeProject && loadScans(activeProject.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 border border-[#2a2a32] hover:border-[#3a3a44] rounded-lg transition-colors"
        >
          <RotateCcw size={11} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats */}
      {scans.length > 0 && <StatsBar scans={scans} />}

      {/* Filter bar */}
      {scans.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Search */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search scans…"
              className="pl-7 pr-7 py-1.5 text-xs bg-[#16161a] border border-[#2a2a32] rounded-lg text-gray-200 placeholder-gray-700 focus:outline-none focus:border-[#3a3a44] w-44 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                <X size={10} />
              </button>
            )}
          </div>

          {/* Tool filter chips */}
          <div className="flex gap-1 flex-wrap">
            {availableTools.map((tool) => {
              const active = toolFilter.includes(tool)
              const cfg = TOOL_COLORS[tool]
              return (
                <button
                  key={tool}
                  onClick={() => toggleTool(tool)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono font-medium rounded border transition-colors',
                    active && cfg
                      ? cfg.badge
                      : 'text-gray-600 border-[#2a2a32] hover:text-gray-400',
                  )}
                >
                  {cfg?.icon}
                  {tool}
                </button>
              )
            })}
          </div>

          {/* Status filter */}
          <div className="flex gap-1">
            {ALL_STATUSES.filter((s) => scans.some((sc) => sc.status === s)).map((s) => {
              const cfg = STATUS_CONFIG[s]
              const active = statusFilter.includes(s)
              return (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={cn(
                    'px-2 py-0.5 text-[9px] font-medium rounded border transition-colors',
                    active ? cfg.cls : 'text-gray-700 border-[#2a2a32] hover:text-gray-500',
                  )}
                >
                  {cfg.label}
                </button>
              )
            })}
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
            >
              <X size={10} />
              Clear
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40 gap-2 text-sm text-gray-600">
          <Loader2 size={14} className="animate-spin" />
          Loading…
        </div>
      ) : scans.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-52 bg-[#1a1a1f] border border-dashed border-[#2a2a32] rounded-xl">
          <Clock size={28} className="text-gray-700 mb-3" />
          <p className="text-sm font-medium text-gray-400">No scans yet</p>
          <p className="text-xs text-gray-600 mt-1">Run a scan from the Scans page to see results here.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center h-24 text-xs text-gray-600">
          No scans match your filters.
        </div>
      ) : (
        <div className="bg-[#1a1a1f] border border-[#2a2a32] rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#2a2a32] text-[10px] uppercase tracking-wider text-gray-600">
                <th className="text-left px-4 py-3">Tool</th>
                <th className="text-left px-4 py-3">ID</th>
                <th className="text-left px-4 py-3">Summary</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Duration</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Started</th>
                <th className="px-4 py-3 w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e24]">
              {filtered.map((scan) => (
                <ScanRow
                  key={scan.id}
                  scan={scan}
                  isRerunning={rerunning === scan.id}
                  onClick={() => handleOpen(scan)}
                  onRerun={() => handleRerun(scan)}
                  onDelete={() => handleDelete(scan)}
                />
              ))}
            </tbody>
          </table>
          {filtered.length < scans.length && (
            <div className="px-4 py-2 border-t border-[#2a2a32] text-[10px] text-gray-700">
              Showing {filtered.length} of {scans.length} scans
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function ScanRow({
  scan, isRerunning, onClick, onRerun, onDelete,
}: {
  scan: Scan
  isRerunning: boolean
  onClick: () => void
  onRerun: () => void
  onDelete: () => void
}) {
  const summary = scanSummary(scan)

  return (
    <tr
      onClick={onClick}
      className="group hover:bg-white/[0.025] cursor-pointer transition-colors"
    >
      <td className="px-4 py-2.5">
        <ToolBadge tool={scan.tool} />
      </td>
      <td className="px-4 py-2.5 font-mono text-[10px] text-gray-600">
        {scan.id.slice(0, 8)}
      </td>
      <td className="px-4 py-2.5 text-gray-400 max-w-xs truncate" title={summary}>
        {scan.profile && (
          <span className="text-gray-600 mr-1.5">[{scan.profile}]</span>
        )}
        <span className="font-mono text-[10px]">{summary || '—'}</span>
      </td>
      <td className="px-4 py-2.5">
        <StatusBadge status={scan.status} />
        {scan.status === 'failed' && scan.error && (
          <p className="text-[9px] text-red-400/70 mt-0.5 truncate max-w-[160px]" title={scan.error}>
            {scan.error}
          </p>
        )}
      </td>
      <td className="px-4 py-2.5 text-gray-600 text-[10px] hidden md:table-cell font-mono">
        {formatDuration(scan.started_at, scan.finished_at)}
      </td>
      <td className="px-4 py-2.5 text-gray-600 text-[10px] hidden lg:table-cell">
        {formatTime(scan.started_at ?? scan.created_at)}
      </td>
      <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onRerun}
            disabled={isRerunning}
            title="Re-run with same config"
            className="p-1.5 text-gray-600 hover:text-green-400 transition-colors rounded disabled:opacity-40"
          >
            {isRerunning
              ? <Loader2 size={12} className="animate-spin" />
              : <RotateCcw size={12} />
            }
          </button>
          <button
            onClick={onDelete}
            title="Delete scan"
            className="p-1.5 text-gray-600 hover:text-red-400 transition-colors rounded"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </tr>
  )
}
