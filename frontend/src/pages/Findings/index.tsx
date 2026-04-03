import { useEffect, useState, useMemo } from 'react'
import { backendBase } from '@/lib/backend'
import {
  ShieldAlert, Plus, Trash2, X, Search, Filter,
  AlertTriangle, AlertCircle, Info, CheckCircle,
  ChevronRight, Edit3, Check, KeyRound, Download,
  ShieldCheck, Shield, Copy, BrainCircuit, Loader2,
} from 'lucide-react'
import { useFindingStore } from '@/stores/findingStore'
import { useCredentialStore } from '@/stores/credentialStore'
import { useProjectStore } from '@/stores/projectStore'
import { useScanStore } from '@/stores/scanStore'
import { cn } from '@/lib/utils'
import type { Finding, FindingSeverity, FindingStatus } from '@/stores/findingStore'
import type { Credential } from '@/types'

// ---------------------------------------------------------------------------
// Severity config
// ---------------------------------------------------------------------------

const SEV_CONFIG: Record<FindingSeverity, { label: string; color: string; icon: JSX.Element; badge: string }> = {
  critical: {
    label: 'Critical',
    color: 'text-red-300',
    badge: 'bg-red-500/20 text-red-300 border-red-500/30',
    icon: <AlertTriangle size={12} className="text-red-400" />,
  },
  high: {
    label: 'High',
    color: 'text-orange-300',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    icon: <AlertCircle size={12} className="text-orange-400" />,
  },
  medium: {
    label: 'Medium',
    color: 'text-yellow-300',
    badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    icon: <AlertCircle size={12} className="text-yellow-400" />,
  },
  low: {
    label: 'Low',
    color: 'text-blue-300',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    icon: <Info size={12} className="text-blue-400" />,
  },
  info: {
    label: 'Info',
    color: 'text-gray-400',
    badge: 'bg-gray-500/15 text-gray-400 border-gray-500/25',
    icon: <Info size={12} className="text-gray-500" />,
  },
}

const STATUS_CONFIG: Record<FindingStatus, { label: string; badge: string }> = {
  open:           { label: 'Open',          badge: 'bg-red-500/15 text-red-400 border-red-500/20' },
  confirmed:      { label: 'Confirmed',     badge: 'bg-orange-500/15 text-orange-400 border-orange-500/20' },
  false_positive: { label: 'False Positive', badge: 'bg-gray-500/15 text-gray-400 border-gray-500/20' },
  resolved:       { label: 'Resolved',      badge: 'bg-green-500/15 text-green-400 border-green-500/20' },
}

const SEVERITIES: FindingSeverity[] = ['critical', 'high', 'medium', 'low', 'info']
const STATUSES: FindingStatus[]     = ['open', 'confirmed', 'false_positive', 'resolved']

function SevBadge({ sev }: { sev: string }): JSX.Element {
  const cfg = SEV_CONFIG[sev as FindingSeverity] ?? SEV_CONFIG.info
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold', cfg.badge)}>
      {cfg.label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }): JSX.Element {
  const cfg = STATUS_CONFIG[status as FindingStatus] ?? STATUS_CONFIG.open
  return (
    <span className={cn('inline-block px-1.5 py-0.5 rounded border text-[10px]', cfg.badge)}>
      {cfg.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Stats bar
// ---------------------------------------------------------------------------

function StatsBar({ projectId }: { projectId: string }): JSX.Element {
  const { stats, fetchStats, filters, setFilter } = useFindingStore()

  useEffect(() => { fetchStats(projectId) }, [projectId, fetchStats])

  if (!stats) return <div />

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#2a2a32] bg-[#111114] shrink-0 flex-wrap">
      {SEVERITIES.map((sev) => {
        const count = stats.by_severity[sev] ?? 0
        const active = filters.severity === sev
        return (
          <button
            key={sev}
            onClick={() => setFilter('severity', active ? '' : sev)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium transition-colors',
              active
                ? SEV_CONFIG[sev].badge + ' opacity-100'
                : 'bg-transparent border-[#2a2a32] text-gray-500 hover:text-gray-200 hover:border-gray-500'
            )}
          >
            {SEV_CONFIG[sev].icon}
            <span>{SEV_CONFIG[sev].label}</span>
            <span className={cn('font-mono text-[11px]', active ? '' : 'text-gray-600')}>{count}</span>
          </button>
        )
      })}

      <div className="w-px h-4 bg-[#2a2a32] mx-1" />

      <span className="text-xs text-gray-500">
        {stats.total} total
        {filters.severity || filters.tool || filters.status || filters.search
          ? <button onClick={() => useFindingStore.getState().clearFilters()} className="ml-2 text-red-400/70 hover:text-red-400">× clear</button>
          : null
        }
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add Finding modal
// ---------------------------------------------------------------------------

function AddFindingModal({
  projectId,
  onClose,
}: { projectId: string; onClose: () => void }): JSX.Element {
  const { createFinding, fetchStats } = useFindingStore()
  const [title, setTitle]       = useState('')
  const [severity, setSeverity] = useState<FindingSeverity>('medium')
  const [cve, setCve]           = useState('')
  const [description, setDesc]  = useState('')
  const [remediation, setRem]   = useState('')
  const [saving, setSaving]     = useState(false)

  const handleSubmit = async () => {
    if (!title.trim()) return
    setSaving(true)
    await createFinding({
      project_id:  projectId,
      title:       title.trim(),
      severity,
      cve:         cve.trim() || null,
      description: description.trim() || null,
      remediation: remediation.trim() || null,
    })
    await fetchStats(projectId)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[520px] bg-[#16161b] border border-[#2a2a32] rounded-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2a2a32]">
          <span className="text-sm font-semibold text-gray-200">Add Finding</span>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={15} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. SQL Injection in login form"
              className="w-full bg-[#1a1a1f] border border-[#2a2a32] rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-red-500/50 placeholder-gray-600" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Severity</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value as FindingSeverity)}
                className="w-full bg-[#1a1a1f] border border-[#2a2a32] rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-red-500/50">
                {SEVERITIES.map((s) => <option key={s} value={s}>{SEV_CONFIG[s].label}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">CVE</label>
              <input value={cve} onChange={(e) => setCve(e.target.value)}
                placeholder="CVE-2024-12345"
                className="w-full bg-[#1a1a1f] border border-[#2a2a32] rounded px-3 py-1.5 text-sm text-gray-200 font-mono focus:outline-none focus:border-red-500/50 placeholder-gray-600" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Description</label>
            <textarea value={description} onChange={(e) => setDesc(e.target.value)} rows={3}
              className="w-full bg-[#1a1a1f] border border-[#2a2a32] rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-red-500/50 resize-none placeholder-gray-600"
              placeholder="What was found and why it matters…" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Remediation</label>
            <textarea value={remediation} onChange={(e) => setRem(e.target.value)} rows={2}
              className="w-full bg-[#1a1a1f] border border-[#2a2a32] rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-red-500/50 resize-none placeholder-gray-600"
              placeholder="How to fix it…" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#2a2a32]">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={saving || !title.trim()}
            className="px-4 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded transition-colors disabled:opacity-40">
            {saving ? 'Saving…' : 'Add Finding'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Finding detail panel
// ---------------------------------------------------------------------------

const BASE_API = backendBase()

function DetailPanel({ finding, onClose }: { finding: Finding; onClose: () => void }): JSX.Element {
  const { updateFinding, deleteFinding, fetchStats } = useFindingStore()
  const [editingStatus, setEditingStatus] = useState(false)
  const [aiLoading, setAiLoading]         = useState<string | null>(null)  // 'analyse' | 'fp'
  const [aiResult, setAiResult]           = useState<{ type: string; text: string } | null>(null)
  const [aiError, setAiError]             = useState<string | null>(null)

  const runAI = async (promptType: 'analyse' | 'false_positive') => {
    setAiLoading(promptType)
    setAiResult(null)
    setAiError(null)
    try {
      const r = await fetch(`${BASE_API}/api/ai/analyse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: finding.project_id,
          context_type: 'finding',
          context_id: finding.id,
          prompt_type: promptType,
        }),
      })
      if (!r.ok) {
        const data = await r.json()
        throw new Error(data.detail ?? 'AI failed')
      }
      const data = await r.json()
      setAiResult({ type: promptType, text: data.response ?? '' })
    } catch (e) {
      setAiError((e as Error).message)
    } finally {
      setAiLoading(null)
    }
  }

  const handleStatusChange = async (status: FindingStatus) => {
    await updateFinding(finding.id, { status })
    await fetchStats(finding.project_id)
    setEditingStatus(false)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this finding?')) return
    await deleteFinding(finding.id)
    await fetchStats(finding.project_id)
    onClose()
  }

  const cfg = SEV_CONFIG[finding.severity as FindingSeverity] ?? SEV_CONFIG.info

  return (
    <div className="flex flex-col h-full border-l border-[#2a2a32] bg-[#111114]">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-[#2a2a32] shrink-0">
        <div className="flex-1 pr-3 space-y-1">
          <h3 className="text-sm font-semibold text-gray-100 leading-snug">{finding.title}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <SevBadge sev={finding.severity} />
            <StatusBadge status={finding.status} />
            {finding.tool_source && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e1e24] border border-[#2a2a32] text-gray-500 font-mono">{finding.tool_source}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={handleDelete} className="p-1.5 rounded text-gray-600 hover:text-red-400 transition-colors" title="Delete">
            <Trash2 size={13} />
          </button>
          <button onClick={onClose} className="p-1.5 rounded text-gray-600 hover:text-gray-300 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Metadata */}
        <div className="space-y-1.5 text-xs">
          {finding.cvss != null && (
            <div className="flex gap-2">
              <span className="text-gray-600 w-20 shrink-0">CVSS</span>
              <span className={cn('font-semibold', finding.cvss >= 9 ? 'text-red-300' : finding.cvss >= 7 ? 'text-orange-300' : 'text-yellow-300')}>
                {finding.cvss.toFixed(1)}
              </span>
            </div>
          )}
          {finding.cve && (
            <div className="flex gap-2">
              <span className="text-gray-600 w-20 shrink-0">CVE</span>
              <span className="text-red-300 font-mono">{finding.cve}</span>
            </div>
          )}
          {finding.host_ip && (
            <div className="flex gap-2">
              <span className="text-gray-600 w-20 shrink-0">Host</span>
              <span className="text-gray-300 font-mono">{finding.host_ip}</span>
            </div>
          )}
          {finding.scan_id && (
            <div className="flex gap-2">
              <span className="text-gray-600 w-20 shrink-0">Scan</span>
              <span className="text-gray-500 font-mono">{finding.scan_id.slice(0, 8)}</span>
            </div>
          )}
          <div className="flex gap-2">
            <span className="text-gray-600 w-20 shrink-0">Found</span>
            <span className="text-gray-500">{finding.created_at.slice(0, 10)}</span>
          </div>
        </div>

        {/* Status editor */}
        <div>
          <div className="text-xs text-gray-500 mb-1.5">Status</div>
          {editingStatus ? (
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className={cn(
                    'px-2 py-1 rounded border text-[11px] transition-colors',
                    s === finding.status
                      ? STATUS_CONFIG[s].badge
                      : 'border-[#2a2a32] text-gray-500 hover:text-gray-200'
                  )}
                >
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
              <button onClick={() => setEditingStatus(false)} className="text-[11px] text-gray-600 hover:text-gray-400 ml-1">cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setEditingStatus(true)}
              className="flex items-center gap-1.5 group"
            >
              <StatusBadge status={finding.status} />
              <Edit3 size={10} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
            </button>
          )}
        </div>

        {/* Description */}
        {finding.description && (
          <div>
            <div className="text-xs text-gray-500 mb-1.5 font-medium">Description</div>
            <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{finding.description}</p>
          </div>
        )}

        {/* Remediation */}
        {finding.remediation && (
          <div>
            <div className="text-xs text-gray-500 mb-1.5 font-medium">Remediation</div>
            <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{finding.remediation}</p>
          </div>
        )}

        {/* AI Actions (4.2 / 4.4) */}
        <div className="border-t border-[#2a2a32] pt-3 space-y-2">
          <div className="text-xs text-gray-500 font-medium mb-2 flex items-center gap-1.5">
            <BrainCircuit size={11} className="text-red-400/70" />
            AI Analysis
            <span className="text-[9px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1 py-0.5 rounded">PRO</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => runAI('analyse')}
              disabled={aiLoading !== null}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 rounded-lg transition-colors disabled:opacity-40"
            >
              {aiLoading === 'analyse' ? <Loader2 size={10} className="animate-spin" /> : <BrainCircuit size={10} />}
              Analyse Finding
            </button>
            <button
              onClick={() => runAI('false_positive')}
              disabled={aiLoading !== null}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 text-yellow-300 rounded-lg transition-colors disabled:opacity-40"
            >
              {aiLoading === 'false_positive' ? <Loader2 size={10} className="animate-spin" /> : <ShieldCheck size={10} />}
              False Positive?
            </button>
          </div>
          {aiError && (
            <p className="text-[10px] text-red-400 font-mono">{aiError}</p>
          )}
          {aiResult && (
            <div className="bg-[#111114] border border-[#2a2a32] rounded-lg p-3 max-h-48 overflow-y-auto">
              <div className="text-[10px] text-gray-600 mb-1.5">
                {aiResult.type === 'false_positive' ? 'False Positive Check' : 'Analysis'}
              </div>
              <p className="text-[11px] text-gray-300 whitespace-pre-wrap leading-relaxed">{aiResult.text}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Findings table
// ---------------------------------------------------------------------------

function FindingsTable({
  findings,
  selectedId,
  onSelect,
  loading,
}: {
  findings: Finding[]
  selectedId: string | null
  onSelect: (id: string) => void
  loading: boolean
}): JSX.Element {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
        Loading…
      </div>
    )
  }
  if (findings.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-600">
        <ShieldAlert size={28} strokeWidth={1} />
        <p className="text-sm">No findings. Run scans to auto-populate, or add manually.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-[#111114] border-b border-[#2a2a32]">
          <tr>
            {['Severity', 'Finding', 'Tool', 'CVE', 'Status', 'Date'].map((h) => (
              <th key={h} className="text-left px-4 py-2 text-gray-500 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {findings.map((f) => (
            <tr
              key={f.id}
              onClick={() => onSelect(f.id)}
              className={cn(
                'border-b border-[#1e1e24] cursor-pointer transition-colors',
                f.id === selectedId
                  ? 'bg-red-500/[0.07] border-l-2 border-l-red-500/50'
                  : 'hover:bg-white/[0.03]'
              )}
            >
              <td className="px-4 py-2.5"><SevBadge sev={f.severity} /></td>
              <td className="px-4 py-2.5 max-w-xs">
                <div className="text-gray-200 truncate">{f.title}</div>
                {f.host_ip && <div className="text-gray-600 font-mono text-[10px]">{f.host_ip}</div>}
              </td>
              <td className="px-4 py-2.5 text-gray-500 font-mono">{f.tool_source ?? '—'}</td>
              <td className="px-4 py-2.5 text-red-400 font-mono">{f.cve ?? '—'}</td>
              <td className="px-4 py-2.5"><StatusBadge status={f.status} /></td>
              <td className="px-4 py-2.5 text-gray-600 tabular-nums">{f.created_at.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Vulnerabilities tab
// ---------------------------------------------------------------------------

function VulnerabilitiesTab({ projectId }: { projectId: string }): JSX.Element {
  const {
    findings, total, loading, selectedId,
    filters, setFilter, fetchFindings, setSelected,
  } = useFindingStore()
  const [showAdd, setShowAdd] = useState(false)

  // Fetch whenever project or filters change
  useEffect(() => { fetchFindings(projectId) }, [projectId, fetchFindings, filters])

  const selected = findings.find((f) => f.id === selectedId) ?? null

  // Unique tools for filter dropdown
  const tools = useMemo(() => {
    const set = new Set<string>()
    findings.forEach((f) => { if (f.tool_source) set.add(f.tool_source) })
    return Array.from(set).sort()
  }, [findings])

  return (
    <>
      {showAdd && (
        <AddFindingModal
          projectId={projectId}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Filters row */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#2a2a32] shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5 bg-[#1a1a1f] border border-[#2a2a32] rounded px-2.5 py-1.5 flex-1 max-w-xs">
          <Search size={12} className="text-gray-500 shrink-0" />
          <input
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            placeholder="Search title, CVE…"
            className="flex-1 bg-transparent text-xs text-gray-200 outline-none placeholder-gray-600"
          />
          {filters.search && (
            <button onClick={() => setFilter('search', '')} className="text-gray-600 hover:text-gray-400">
              <X size={10} />
            </button>
          )}
        </div>

        {/* Tool filter */}
        <select
          value={filters.tool}
          onChange={(e) => setFilter('tool', e.target.value)}
          className="bg-[#1a1a1f] border border-[#2a2a32] rounded px-2 py-1.5 text-xs text-gray-400 outline-none focus:border-red-500/50"
        >
          <option value="">All tools</option>
          {tools.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Status filter */}
        <select
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
          className="bg-[#1a1a1f] border border-[#2a2a32] rounded px-2 py-1.5 text-xs text-gray-400 outline-none focus:border-red-500/50"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
        </select>

        <span className="text-xs text-gray-600 ml-auto">{total} finding{total !== 1 ? 's' : ''}</span>

        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-xs text-white font-medium transition-colors"
        >
          <Plus size={12} />
          Add
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        <FindingsTable
          findings={findings}
          selectedId={selectedId}
          onSelect={setSelected}
          loading={loading}
        />

        {selected && (
          <div className="w-80 shrink-0">
            <DetailPanel finding={selected} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Credentials tab (existing store, reused component)
// ---------------------------------------------------------------------------

const SERVICE_COLORS: Record<string, string> = {
  ssh: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
  ftp: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20',
  smb: 'bg-orange-500/15 text-orange-300 border-orange-500/20',
  rdp: 'bg-purple-500/15 text-purple-300 border-purple-500/20',
  mysql: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20',
  postgres: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20',
  telnet: 'bg-red-500/15 text-red-300 border-red-500/20',
  vnc: 'bg-pink-500/15 text-pink-300 border-pink-500/20',
  'http-get': 'bg-green-500/15 text-green-300 border-green-500/20',
  'http-post-form': 'bg-green-500/15 text-green-300 border-green-500/20',
}
const svcBadge = (s: string | null) =>
  s ? (SERVICE_COLORS[s.toLowerCase()] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/20') : 'bg-gray-500/15 text-gray-400 border-gray-500/20'

function CopyBtn({ text }: { text: string }): JSX.Element {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="p-1 rounded text-gray-600 hover:text-gray-300 transition-colors">
      {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
    </button>
  )
}

function CredentialsTab({ projectId }: { projectId: string }): JSX.Element {
  const { credentials, isLoading, fetchCredentials, toggleVerified, deleteCredential } = useCredentialStore()
  const { scans, fetchScans } = useScanStore()
  const { importFromScan } = useCredentialStore()
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [search, setSearch] = useState('')
  const [svcFilter, setSvcFilter] = useState<string | null>(null)
  const [addState, setAddState] = useState({ service: '', username: '', password: '', hash: '', hashType: '' })
  const [importScanId, setImportScanId] = useState('')
  const [importMsg, setImportMsg] = useState<string | null>(null)

  useEffect(() => { fetchCredentials(projectId); fetchScans(projectId) }, [projectId, fetchCredentials, fetchScans])

  const services = useMemo(() => {
    const s = new Set<string>()
    credentials.forEach((c) => { if (c.service) s.add(c.service) })
    return Array.from(s).sort()
  }, [credentials])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return credentials.filter((c) => {
      if (svcFilter && c.service !== svcFilter) return false
      if (!q) return true
      return c.username?.toLowerCase().includes(q) || c.password?.toLowerCase().includes(q) || c.service?.toLowerCase().includes(q)
    })
  }, [credentials, search, svcFilter])

  const hydraScans = useMemo(() => scans.filter((s) => s.tool === 'hydra' && s.status === 'completed'), [scans])

  const handleAdd = async () => {
    if (!addState.username && !addState.hash) return
    await useCredentialStore.getState().addCredential({
      project_id: projectId,
      service: addState.service || null,
      username: addState.username || null,
      password: addState.password || null,
      hash: addState.hash || null,
      hash_type: addState.hashType || null,
    })
    await fetchCredentials(projectId)
    setShowAdd(false)
    setAddState({ service: '', username: '', password: '', hash: '', hashType: '' })
  }

  const handleImport = async () => {
    if (!importScanId) return
    const res = await importFromScan(importScanId, projectId)
    setImportMsg(res.imported > 0 ? `${res.imported} imported.` : 'Nothing new.')
    setShowImport(false)
    setTimeout(() => setImportMsg(null), 3000)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-[440px] bg-[#16161b] border border-[#2a2a32] rounded-lg shadow-xl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2a2a32]">
              <span className="text-sm font-semibold text-gray-200">Add Credential</span>
              <button onClick={() => setShowAdd(false)} className="text-gray-500 hover:text-gray-300"><X size={15} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {[
                ['Service', 'service', 'ssh, ftp, smb…'],
                ['Username', 'username', 'admin'],
                ['Password', 'password', 'plaintext password'],
                ['Hash', 'hash', 'NTLM / MD5 hash'],
                ['Hash Type', 'hashType', 'ntlm, md5…'],
              ].map(([label, key, ph]) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                  <input value={(addState as Record<string, string>)[key]}
                    onChange={(e) => setAddState((s) => ({ ...s, [key]: e.target.value }))}
                    placeholder={ph}
                    className="w-full bg-[#111114] border border-[#2a2a32] rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-red-500/40" />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#2a2a32]">
              <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded">Cancel</button>
              <button onClick={handleAdd} className="px-4 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-[420px] bg-[#16161b] border border-[#2a2a32] rounded-lg shadow-xl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2a2a32]">
              <span className="text-sm font-semibold text-gray-200">Import from Hydra Scan</span>
              <button onClick={() => setShowImport(false)} className="text-gray-500 hover:text-gray-300"><X size={15} /></button>
            </div>
            <div className="px-5 py-4">
              {hydraScans.length === 0
                ? <p className="text-sm text-gray-500">No completed Hydra scans found.</p>
                : (
                  <select value={importScanId} onChange={(e) => setImportScanId(e.target.value)}
                    className="w-full bg-[#111114] border border-[#2a2a32] rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-red-500/40">
                    <option value="">— Choose scan —</option>
                    {hydraScans.map((s) => (
                      <option key={s.id} value={s.id}>{s.id.slice(0, 8)} — {s.profile ?? 'custom'} — {s.created_at.slice(0, 10)}</option>
                    ))}
                  </select>
                )
              }
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#2a2a32]">
              <button onClick={() => setShowImport(false)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded">Cancel</button>
              <button onClick={handleImport} disabled={!importScanId} className="px-4 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded disabled:opacity-40">Import</button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#2a2a32] shrink-0 flex-wrap">
        <span className="text-xs text-gray-500">{credentials.length} total · {credentials.filter((c) => c.verified).length} verified</span>
        {importMsg && <span className="text-xs text-green-400">{importMsg}</span>}
        <div className="flex-1" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="bg-[#1a1a1f] border border-[#2a2a32] rounded px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-red-500/40 w-40" />
        <div className="flex items-center gap-1">
          <button onClick={() => setSvcFilter(null)} className={cn('px-2 py-1 rounded text-xs', svcFilter === null ? 'bg-red-500/20 text-red-300' : 'text-gray-500 hover:text-gray-300')}>All</button>
          {services.map((s) => (
            <button key={s} onClick={() => setSvcFilter(s === svcFilter ? null : s)}
              className={cn('px-2 py-1 rounded text-xs', svcFilter === s ? 'bg-red-500/20 text-red-300' : 'text-gray-500 hover:text-gray-300')}>{s}</button>
          ))}
        </div>
        <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-gray-300 bg-white/5 hover:bg-white/10 border border-[#2a2a32] transition-colors">
          <Download size={12} />Import
        </button>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-red-600 hover:bg-red-500 text-white transition-colors">
          <Plus size={12} />Add
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-24 text-sm text-gray-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-600">
            <KeyRound size={22} strokeWidth={1} />
            <p className="text-sm">{credentials.length === 0 ? 'No credentials yet.' : 'No matches.'}</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#111114] border-b border-[#2a2a32]">
              <tr>{['Service', 'Username', 'Password', '✓', 'Added', ''].map((h) => (
                <th key={h} className="text-left px-4 py-2 text-gray-500 font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.map((c: Credential) => (
                <tr key={c.id} className="border-b border-[#2a2a32] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-2.5">
                    {c.service
                      ? <span className={cn('px-1.5 py-0.5 rounded border text-[10px] font-mono', svcBadge(c.service))}>{c.service}</span>
                      : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-2.5"><div className="flex items-center gap-1"><span className="text-green-300 font-mono">{c.username ?? '—'}</span>{c.username && <CopyBtn text={c.username} />}</div></td>
                  <td className="px-4 py-2.5">
                    {c.password
                      ? <div className="flex items-center gap-1"><span className="text-yellow-300 font-mono">{c.password}</span><CopyBtn text={c.password} /></div>
                      : c.hash ? <span className="text-gray-500 font-mono text-[10px]">[hash]</span>
                      : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => toggleVerified(c.id, !c.verified)}>
                      {c.verified ? <ShieldCheck size={14} className="text-green-400" /> : <Shield size={14} className="text-gray-600 hover:text-gray-400" />}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 tabular-nums">{c.created_at.slice(0, 10)}</td>
                  <td className="px-4 py-2.5"><button onClick={() => deleteCredential(c.id)} className="p-1 text-gray-600 hover:text-red-400 rounded"><Trash2 size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function FindingsPage(): JSX.Element {
  const { activeProject } = useProjectStore()
  const [tab, setTab] = useState<'vulns' | 'creds'>('vulns')
  const { fetchFindings, fetchStats } = useFindingStore()

  useEffect(() => {
    if (activeProject) { fetchFindings(activeProject.id); fetchStats(activeProject.id) }
  }, [activeProject, fetchFindings, fetchStats])

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-600">
        <ShieldAlert size={28} strokeWidth={1} />
        <p className="text-sm">Select a project to view findings</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header + tabs */}
      <div className="flex items-center border-b border-[#2a2a32] px-4 shrink-0 bg-[#111114]">
        <ShieldAlert size={15} className="text-red-500 mr-2.5 shrink-0" />
        <span className="text-sm font-semibold text-gray-200 mr-4">Findings</span>
        <div className="flex items-center gap-0">
          {([['vulns', 'Vulnerabilities'], ['creds', 'Credentials']] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-3 text-xs font-medium border-b-2 -mb-px transition-colors',
                tab === t
                  ? 'border-red-500 text-gray-200'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'vulns' ? (
        <>
          <StatsBar projectId={activeProject.id} />
          <div className="flex flex-col flex-1 overflow-hidden">
            <VulnerabilitiesTab projectId={activeProject.id} />
          </div>
        </>
      ) : (
        <CredentialsTab projectId={activeProject.id} />
      )}
    </div>
  )
}
