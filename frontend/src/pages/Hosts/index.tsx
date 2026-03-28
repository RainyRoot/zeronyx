import { useEffect, useState } from 'react'
import {
  Network, Search, Plus, Trash2, X, RefreshCw,
  AlertTriangle, AlertCircle, Info, Server,
  KeyRound, Activity, ChevronRight, Sparkles, Lock,
} from 'lucide-react'
import { useHostStore } from '@/stores/hostStore'
import { useProjectStore } from '@/stores/projectStore'
import { cn } from '@/lib/utils'
import type { HostSummary, HostDetail, FindingSummary } from '@/stores/hostStore'

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

const SEV_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-500',
  medium:   'bg-yellow-500',
  low:      'bg-blue-500',
  info:     'bg-gray-500',
}

const SEV_BADGE: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-300 border-red-500/30',
  high:     'bg-orange-500/20 text-orange-300 border-orange-500/30',
  medium:   'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  low:      'bg-blue-500/20 text-blue-300 border-blue-500/30',
  info:     'bg-gray-500/15 text-gray-400 border-gray-500/25',
}

const TOOL_COLORS: Record<string, string> = {
  nmap:          'bg-green-500/15 text-green-400',
  nuclei:        'bg-red-500/15 text-red-400',
  nikto:         'bg-orange-500/15 text-orange-400',
  sqlmap:        'bg-purple-500/15 text-purple-400',
  hydra:         'bg-yellow-500/15 text-yellow-400',
  searchsploit:  'bg-pink-500/15 text-pink-400',
  metasploit:    'bg-red-800/30 text-red-300',
  gobuster:      'bg-cyan-500/15 text-cyan-400',
  ffuf:          'bg-cyan-500/15 text-cyan-400',
  manual:        'bg-gray-500/15 text-gray-400',
}

function toolBadge(tool: string): string {
  return TOOL_COLORS[tool.toLowerCase()] ?? 'bg-gray-500/15 text-gray-400'
}

function FindingDots({ counts }: { counts: Record<string, number> }): JSX.Element {
  const order = ['critical', 'high', 'medium', 'low', 'info']
  return (
    <div className="flex items-center gap-1">
      {order.map((sev) => {
        const n = counts[sev] ?? 0
        if (!n) return null
        return (
          <div key={sev} className="flex items-center gap-0.5" title={`${n} ${sev}`}>
            <span className={cn('w-1.5 h-1.5 rounded-full', SEV_DOT[sev])} />
            <span className="text-[10px] text-gray-600">{n}</span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add Host modal
// ---------------------------------------------------------------------------

function AddHostModal({
  projectId,
  onClose,
}: { projectId: string; onClose: () => void }): JSX.Element {
  const { createHost, fetchHosts } = useHostStore()
  const [ip, setIp]               = useState('')
  const [hostname, setHostname]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState<string | null>(null)

  const handleAdd = async () => {
    if (!ip.trim()) return
    setSaving(true)
    try {
      await createHost(projectId, ip, hostname || undefined)
      onClose()
    } catch (e) {
      setErr((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[420px] bg-[#16161b] border border-[#2a2a32] rounded-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2a2a32]">
          <span className="text-sm font-semibold text-gray-200">Add Host</span>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={15} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">IP Address *</label>
            <input value={ip} onChange={(e) => setIp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="192.168.1.1"
              className="w-full bg-[#1a1a1f] border border-[#2a2a32] rounded px-3 py-1.5 text-sm text-gray-200 font-mono focus:outline-none focus:border-red-500/50 placeholder-gray-600" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Hostname <span className="text-gray-600">(optional)</span></label>
            <input value={hostname} onChange={(e) => setHostname(e.target.value)}
              placeholder="host.example.com"
              className="w-full bg-[#1a1a1f] border border-[#2a2a32] rounded px-3 py-1.5 text-sm text-gray-200 font-mono focus:outline-none focus:border-red-500/50 placeholder-gray-600" />
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#2a2a32]">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded">Cancel</button>
          <button onClick={handleAdd} disabled={saving || !ip.trim()}
            className="px-4 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded disabled:opacity-40">
            {saving ? 'Adding…' : 'Add Host'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Host list item
// ---------------------------------------------------------------------------

function HostRow({
  host,
  selected,
  onClick,
}: { host: HostSummary; selected: boolean; onClick: () => void }): JSX.Element {
  return (
    <div
      onClick={onClick}
      className={cn(
        'px-4 py-3 border-b border-[#1e1e24] cursor-pointer transition-colors',
        selected ? 'bg-red-500/[0.07] border-l-2 border-l-red-500/50' : 'hover:bg-white/[0.03]'
      )}
    >
      {/* IP + hostname */}
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono text-sm text-gray-100">{host.ip}</span>
        {host.hostname && <span className="text-xs text-gray-500 truncate">{host.hostname}</span>}
        <span className={cn(
          'ml-auto text-[10px] px-1.5 py-0.5 rounded border',
          host.state === 'up' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
          host.state === 'down' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
          'bg-gray-500/10 text-gray-500 border-gray-500/20'
        )}>{host.state}</span>
      </div>

      {/* OS */}
      {host.os && <div className="text-xs text-gray-500 mb-1.5 truncate">{host.os}</div>}

      {/* Port pills (first 8) */}
      {host.open_port_numbers.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {host.open_port_numbers.slice(0, 8).map((p) => (
            <span key={p} className="px-1.5 py-0.5 rounded bg-[#1e1e24] text-[10px] text-gray-400 font-mono border border-[#2a2a32]">{p}</span>
          ))}
          {host.open_port_numbers.length > 8 && (
            <span className="text-[10px] text-gray-600">+{host.open_port_numbers.length - 8}</span>
          )}
        </div>
      )}

      {/* Bottom row: finding dots + tool badges */}
      <div className="flex items-center gap-2">
        <FindingDots counts={host.finding_counts} />
        {host.finding_total === 0 && <span className="text-[10px] text-gray-600">no findings</span>}
        <div className="ml-auto flex gap-1 flex-wrap justify-end">
          {host.tool_sources.slice(0, 4).map((t) => (
            <span key={t} className={cn('px-1.5 py-0.5 rounded text-[10px] font-mono', toolBadge(t))}>{t}</span>
          ))}
          {host.credential_count > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/15 text-yellow-400 flex items-center gap-1">
              <KeyRound size={9} />{host.credential_count}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Host detail panel
// ---------------------------------------------------------------------------

function PortsSection({ ports }: { ports: HostDetail['ports'] }): JSX.Element {
  const open = ports.filter((p) => p.state === 'open')
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <Server size={11} />Ports ({open.length})
      </h4>
      {open.length === 0 ? (
        <p className="text-xs text-gray-600">No open ports recorded</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#2a2a32]">
              {['Port', 'Proto', 'Service', 'Version'].map((h) => (
                <th key={h} className="text-left py-1 pr-3 text-gray-600 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {open.map((p) => (
              <tr key={p.id} className="border-b border-[#1e1e24]">
                <td className="py-1.5 pr-3 font-mono text-cyan-400">{p.number}</td>
                <td className="py-1.5 pr-3 text-gray-600">{p.protocol}</td>
                <td className="py-1.5 pr-3 text-gray-300">{p.service ?? '—'}</td>
                <td className="py-1.5 text-gray-500 truncate max-w-[160px]">{p.version ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function FindingsSection({ findings }: { findings: FindingSummary[] }): JSX.Element {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <AlertTriangle size={11} />Findings ({findings.length})
      </h4>
      {findings.length === 0 ? (
        <p className="text-xs text-gray-600">No findings for this host</p>
      ) : (
        <div className="space-y-1.5">
          {findings.map((f) => (
            <div key={f.id} className={cn(
              'flex items-start gap-2 px-2.5 py-2 rounded border',
              SEV_BADGE[f.severity] ?? SEV_BADGE.info
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full mt-1 shrink-0', SEV_DOT[f.severity] ?? 'bg-gray-500')} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium leading-snug truncate">{f.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {f.tool_source && (
                    <span className={cn('text-[10px] px-1 py-0.5 rounded font-mono', toolBadge(f.tool_source))}>{f.tool_source}</span>
                  )}
                  {f.cve && <span className="text-[10px] text-red-400 font-mono">{f.cve}</span>}
                  <span className="text-[10px] text-gray-600 ml-auto">{f.created_at.slice(0, 10)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ScansSection({ scans }: { scans: HostDetail['scans'] }): JSX.Element {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <Activity size={11} />Tool History ({scans.length})
      </h4>
      {scans.length === 0 ? (
        <p className="text-xs text-gray-600">No scan history</p>
      ) : (
        <div className="space-y-1">
          {scans.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-xs">
              <span className={cn('px-1.5 py-0.5 rounded font-mono', toolBadge(s.tool))}>{s.tool}</span>
              <span className={cn(
                'text-[10px] px-1 py-0.5 rounded',
                s.status === 'completed' ? 'text-green-400' :
                s.status === 'running'   ? 'text-blue-400' :
                s.status === 'failed'    ? 'text-red-400'  : 'text-gray-500'
              )}>{s.status}</span>
              <span className="text-gray-600 ml-auto">{(s.started_at ?? s.finished_at ?? '').slice(0, 10)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CredsSection({ creds }: { creds: HostDetail['credentials'] }): JSX.Element {
  if (creds.length === 0) return <div />
  return (
    <div>
      <h4 className="text-xs font-semibold text-yellow-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <KeyRound size={11} />Credentials ({creds.length})
      </h4>
      <div className="space-y-1">
        {creds.map((c) => (
          <div key={c.id} className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-yellow-500/5 border border-yellow-500/15">
            {c.service && <span className="text-yellow-400 font-mono">{c.service}</span>}
            {c.username && <span className="text-green-300 font-mono">{c.username}</span>}
            {c.password && <span className="text-yellow-300 font-mono">{c.password}</span>}
            {c.verified && <Lock size={10} className="text-green-400 ml-auto" />}
          </div>
        ))}
      </div>
    </div>
  )
}

function DetailPanel({
  host,
  detail,
  loading,
  onClose,
}: {
  host: HostSummary
  detail: HostDetail | null
  loading: boolean
  onClose: () => void
}): JSX.Element {
  const { deleteHost, enrichFromShodan, enriching, enrichResult } = useHostStore()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDelete = async () => {
    await deleteHost(host.id)
    onClose()
  }

  return (
    <div className="flex flex-col h-full border-l border-[#2a2a32]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2a2a32] bg-[#111114] shrink-0">
        <div className="flex items-start justify-between mb-1">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-semibold text-gray-100">{host.ip}</span>
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded border',
                host.state === 'up' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-gray-500/10 text-gray-500 border-gray-500/20'
              )}>{host.state}</span>
            </div>
            {host.hostname && <p className="text-xs text-gray-500 mt-0.5">{host.hostname}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Shodan enrich */}
            <button
              onClick={() => enrichFromShodan(host.id)}
              disabled={enriching}
              title="Enrich with Shodan data"
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] border border-[#2a2a32] text-gray-500 hover:text-cyan-400 hover:border-cyan-500/30 transition-colors disabled:opacity-40"
            >
              {enriching
                ? <span className="w-3 h-3 border border-gray-600 border-t-cyan-500 rounded-full animate-spin" />
                : <Sparkles size={11} />
              }
              Enrich
            </button>
            {confirmDelete ? (
              <>
                <button onClick={handleDelete} className="px-2 py-1 rounded text-[11px] bg-red-600 text-white hover:bg-red-500">Confirm</button>
                <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 rounded text-[11px] text-gray-500 hover:text-gray-300">Cancel</button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="p-1.5 rounded text-gray-600 hover:text-red-400 transition-colors">
                <Trash2 size={13} />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded text-gray-600 hover:text-gray-300">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Enrich result */}
        {enrichResult && (
          <p className={cn('text-xs mt-1', enrichResult.startsWith('Error') ? 'text-red-400' : 'text-cyan-400')}>
            {enrichResult}
          </p>
        )}

        {/* Quick stats */}
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
          {host.os && <span>{host.os}</span>}
          {host.port_count > 0 && <span>{host.port_count} open ports</span>}
          {host.finding_total > 0 && (
            <span className="flex items-center gap-1">
              <FindingDots counts={host.finding_counts} />
              {host.finding_total} findings
            </span>
          )}
          {host.scan_count > 0 && <span>{host.scan_count} scans</span>}
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-xs">
          <span className="w-4 h-4 border-2 border-gray-600 border-t-red-500 rounded-full animate-spin mr-2" />
          Loading…
        </div>
      ) : detail ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <PortsSection ports={detail.ports} />
          <FindingsSection findings={detail.findings} />
          <CredsSection creds={detail.credentials} />
          <ScansSection scans={detail.scans} />
          {host.last_seen && (
            <p className="text-[10px] text-gray-600">Last seen: {host.last_seen.slice(0, 10)}</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function HostsPage(): JSX.Element {
  const { activeProject } = useProjectStore()
  const {
    hosts, total, loading, selectedId, detail, detailLoading,
    search, fetchHosts, setSelected, setSearch,
  } = useHostStore()
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    if (activeProject) fetchHosts(activeProject.id)
  }, [activeProject, fetchHosts, search])

  const selectedHost = hosts.find((h) => h.id === selectedId) ?? null

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-600">
        <Network size={28} strokeWidth={1} />
        <p className="text-sm">Select a project to view hosts</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {showAdd && (
        <AddHostModal projectId={activeProject.id} onClose={() => { setShowAdd(false); fetchHosts(activeProject.id) }} />
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#2a2a32] bg-[#111114] shrink-0">
        <Network size={15} className="text-red-500 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Hosts</span>
        {/* PRO badge */}
        <span className="flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/30 text-yellow-400">
          <Sparkles size={9} />PRO
        </span>
        <span className="text-xs text-gray-600">Cross-tool correlation view</span>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#1a1a1f] border border-[#2a2a32] rounded px-2.5 py-1.5">
            <Search size={12} className="text-gray-500 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search IP, hostname, OS…"
              className="bg-transparent text-xs text-gray-200 outline-none placeholder-gray-600 w-40"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-gray-600 hover:text-gray-400"><X size={10} /></button>
            )}
          </div>
          <button onClick={() => fetchHosts(activeProject.id)} title="Refresh"
            className="p-1.5 rounded border border-[#2a2a32] text-gray-500 hover:text-gray-300 transition-colors">
            <RefreshCw size={13} />
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-xs text-white font-medium transition-colors"
          >
            <Plus size={12} />Add Host
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Host list */}
        <div className={cn(
          'flex flex-col border-r border-[#2a2a32] overflow-hidden shrink-0',
          selectedHost ? 'w-72' : 'w-full'
        )}>
          {/* Summary bar */}
          <div className="px-4 py-1.5 border-b border-[#2a2a32] bg-[#0e0e12] text-xs text-gray-600 shrink-0">
            {total} host{total !== 1 ? 's' : ''}
            {total > 0 && ` · ${hosts.reduce((s, h) => s + h.port_count, 0)} open ports · ${hosts.reduce((s, h) => s + h.finding_total, 0)} findings`}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-gray-600 text-xs">Loading…</div>
            ) : hosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-600">
                <Network size={28} strokeWidth={1} />
                <p className="text-sm">No hosts yet</p>
                <p className="text-xs">Run Nmap scans or add manually</p>
              </div>
            ) : (
              hosts.map((h) => (
                <HostRow
                  key={h.id}
                  host={h}
                  selected={h.id === selectedId}
                  onClick={() => setSelected(h.id === selectedId ? null : h.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selectedHost && (
          <div className="flex-1 overflow-hidden">
            <DetailPanel
              host={selectedHost}
              detail={detail}
              loading={detailLoading}
              onClose={() => setSelected(null)}
            />
          </div>
        )}

        {/* Empty state when nothing selected */}
        {!selectedHost && hosts.length > 0 && (
          <div className="flex-1 hidden lg:flex flex-col items-center justify-center gap-2 text-gray-600">
            <ChevronRight size={20} />
            <p className="text-sm">Select a host to see correlated data</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default HostsPage
