import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Play, Square, Trash2, Terminal, Server, LayoutList,
  ChevronDown, AlertCircle, CheckCircle2, Clock, Loader2,
  Crosshair, Network,
} from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'
import { useTargetStore } from '@/stores/targetStore'
import { useScanStore } from '@/stores/scanStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import { cn } from '@/lib/utils'
import type { Scan, ScanStatus, WsServerMessage, Host, Port } from '@/types'

// ---------------------------------------------------------------------------
// Status badge helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<ScanStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  pending:   { label: 'Pending',   cls: 'text-gray-400 bg-gray-500/10 border-gray-500/20',   icon: <Clock size={10} /> },
  running:   { label: 'Running',   cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20',   icon: <Loader2 size={10} className="animate-spin" /> },
  completed: { label: 'Done',      cls: 'text-green-400 bg-green-500/10 border-green-500/20', icon: <CheckCircle2 size={10} /> },
  failed:    { label: 'Failed',    cls: 'text-red-400 bg-red-500/10 border-red-500/20',       icon: <AlertCircle size={10} /> },
  cancelled: { label: 'Cancelled', cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', icon: <Square size={10} /> },
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
// Main component
// ---------------------------------------------------------------------------

export function ScansPage(): JSX.Element {
  const activeProject = useProjectStore((s) => s.activeProject)
  const { targets, fetchTargets } = useTargetStore()
  const {
    scans, isLoadingScans,
    activeScan, outputLines, results, isRunning,
    profiles, isLoadingProfiles,
    error,
    fetchScans, fetchProfiles, startScan, cancelActiveScan,
    appendOutputLine, setActiveScan, fetchResults,
    clearSession, deleteScan,
  } = useScanStore()

  // Form state
  const [selectedTargetId, setSelectedTargetId] = useState<string>('')
  const [selectedProfile, setSelectedProfile] = useState<string>('')
  const [customFlags, setCustomFlags] = useState<string>('')
  const [customPorts, setCustomPorts] = useState<string>('')
  const [resultTab, setResultTab] = useState<'hosts' | 'ports'>('hosts')

  // Output auto-scroll
  const outputRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [outputLines])

  // Load data when project changes
  useEffect(() => {
    if (!activeProject) return
    fetchTargets(activeProject.id)
    fetchScans(activeProject.id)
    fetchProfiles('nmap')
    clearSession()
  }, [activeProject, fetchTargets, fetchScans, fetchProfiles, clearSession])

  // Pre-fill flags when profile changes
  useEffect(() => {
    if (!selectedProfile) return
    const prof = profiles.find((p) => p.name === selectedProfile)
    if (prof) {
      setCustomFlags(prof.config.flags)
      setCustomPorts(prof.config.ports ?? '')
    }
  }, [selectedProfile, profiles])

  // WebSocket connection for active scan
  const handleWsMessage = useCallback((msg: WsServerMessage) => {
    if (msg.type === 'output') {
      appendOutputLine(msg.line)
    } else if (msg.type === 'done') {
      useScanStore.setState({ isRunning: false })
      if (activeScan) {
        fetchResults(activeScan.id)
        // refresh scan status
        fetchScans(activeProject?.id ?? '')
      }
    } else if (msg.type === 'error') {
      useScanStore.setState({ isRunning: false })
      appendOutputLine(`[ERROR] ${msg.message}`)
    }
  }, [activeScan, appendOutputLine, fetchResults, fetchScans, activeProject])

  useWebSocket({
    scanId: activeScan?.id ?? '',
    onMessage: handleWsMessage,
    enabled: !!activeScan && isRunning,
  })

  const handleStart = async () => {
    if (!activeProject) return
    const config: Record<string, unknown> = {
      flags: customFlags || '-sV',
    }
    if (customPorts) config.ports = customPorts
    if (selectedTargetId) {
      const t = targets.find((t) => t.id === selectedTargetId)
      if (t) config.target = t.value
    }
    try {
      await startScan(
        activeProject.id,
        selectedTargetId || null,
        'nmap',
        selectedProfile || null,
        config,
      )
    } catch (e) {
      useScanStore.setState({ error: (e as Error).message })
    }
  }

  const handleSelectScan = async (scan: Scan) => {
    clearSession()
    setActiveScan(scan)
    if (scan.status === 'completed') {
      await fetchResults(scan.id)
    }
  }

  const handleDelete = async (scan: Scan, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(`Delete scan ${scan.id.slice(0, 8)}…?`)) return
    await deleteScan(scan.id)
  }

  if (!activeProject) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-100 mb-1">Scans</h1>
        <p className="text-sm text-gray-500">Run and monitor tool scans against your targets.</p>
        <div className="mt-8 flex flex-col items-center justify-center h-48 bg-[#1a1a1f] border border-dashed border-[#2a2a32] rounded-xl">
          <Crosshair size={28} className="text-gray-700 mb-3" />
          <p className="text-sm text-gray-500">No active project.</p>
          <p className="text-xs text-gray-600 mt-1">Open a project from the Dashboard first.</p>
        </div>
      </div>
    )
  }

  const currentProfile = profiles.find((p) => p.name === selectedProfile)

  return (
    <div className="flex h-full overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* LEFT — scan config + history                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="w-72 shrink-0 border-r border-[#2a2a32] flex flex-col overflow-hidden">

        {/* Config Form */}
        <div className="p-4 border-b border-[#2a2a32]">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
            New Scan
          </h2>

          {/* Target */}
          <label className="block mb-3">
            <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Target</span>
            <div className="relative">
              <select
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
                className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs text-gray-200 appearance-none focus:outline-none focus:border-red-500/50 transition-colors"
              >
                <option value="">— ad-hoc / manual target —</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>{t.value}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
            </div>
          </label>

          {/* Profile */}
          <label className="block mb-3">
            <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Profile</span>
            <div className="relative">
              <select
                value={selectedProfile}
                onChange={(e) => setSelectedProfile(e.target.value)}
                disabled={isLoadingProfiles}
                className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs text-gray-200 appearance-none focus:outline-none focus:border-red-500/50 transition-colors disabled:opacity-50"
              >
                <option value="">— custom —</option>
                {profiles.map((p) => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
            </div>
            {currentProfile && (
              <p className="mt-1 text-[10px] text-gray-600">{currentProfile.description}</p>
            )}
          </label>

          {/* Flags */}
          <label className="block mb-3">
            <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Flags</span>
            <input
              type="text"
              value={customFlags}
              onChange={(e) => setCustomFlags(e.target.value)}
              placeholder="-sV -T4"
              className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-700 focus:outline-none focus:border-red-500/50 transition-colors"
            />
          </label>

          {/* Ports */}
          <label className="block mb-4">
            <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">
              Ports <span className="text-gray-700 normal-case">(optional)</span>
            </span>
            <input
              type="text"
              value={customPorts}
              onChange={(e) => setCustomPorts(e.target.value)}
              placeholder="22,80,443 or 1-1024"
              className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-700 focus:outline-none focus:border-red-500/50 transition-colors"
            />
          </label>

          {/* Buttons */}
          {isRunning ? (
            <button
              onClick={cancelActiveScan}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded-lg transition-colors"
            >
              <Square size={12} />
              Cancel Scan
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={!customFlags && !selectedProfile}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium bg-red-500 hover:bg-red-600 disabled:bg-red-500/30 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <Play size={12} />
              Start Scan
            </button>
          )}

          {error && (
            <p className="mt-2 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
              {error}
            </p>
          )}
        </div>

        {/* Scan History */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2.5 border-b border-[#2a2a32]">
            <span className="text-[10px] uppercase tracking-wider text-gray-600">History</span>
          </div>
          {isLoadingScans ? (
            <div className="p-4 text-xs text-gray-600 text-center">Loading…</div>
          ) : scans.length === 0 ? (
            <div className="p-4 text-xs text-gray-700 text-center">No scans yet.</div>
          ) : (
            scans.map((scan) => (
              <ScanHistoryItem
                key={scan.id}
                scan={scan}
                isActive={activeScan?.id === scan.id}
                onClick={() => handleSelectScan(scan)}
                onDelete={(e) => handleDelete(scan, e)}
              />
            ))
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* RIGHT — output + results                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header bar */}
        <div className="px-5 py-3 border-b border-[#2a2a32] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-gray-100">
              {activeScan ? `nmap · ${activeScan.id.slice(0, 8)}` : 'Scans'}
            </h1>
            {activeScan && <StatusBadge status={activeScan.status} />}
          </div>
          {activeScan?.config && (() => {
            const cfg = activeScan.config as Record<string, string>
            return (
              <span className="text-[10px] font-mono text-gray-600 truncate max-w-xs">
                {cfg.flags} {cfg.ports ? `-p ${cfg.ports}` : ''} {cfg.target ?? ''}
              </span>
            )
          })()}
        </div>

        {/* Output terminal */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div
            ref={outputRef}
            className="flex-1 overflow-y-auto bg-[#0e0e12] p-4 font-mono text-xs leading-relaxed"
          >
            {outputLines.length === 0 && !activeScan ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-700">
                <Terminal size={32} className="mb-3" />
                <p>Configure a scan and press Start.</p>
              </div>
            ) : outputLines.length === 0 && activeScan ? (
              <div className="flex items-center gap-2 text-gray-600">
                <Loader2 size={12} className="animate-spin" />
                Waiting for output…
              </div>
            ) : (
              outputLines.map((line, i) => (
                <OutputLine key={i} line={line} />
              ))
            )}
          </div>

          {/* Results tabs — only when completed */}
          {activeScan?.status === 'completed' && results && (
            <div className="shrink-0 border-t border-[#2a2a32]" style={{ maxHeight: '40%' }}>
              <div className="flex items-center gap-0 border-b border-[#2a2a32] px-4">
                <TabButton active={resultTab === 'hosts'} onClick={() => setResultTab('hosts')}>
                  <Server size={11} />
                  Hosts ({results.hosts.length})
                </TabButton>
                <TabButton active={resultTab === 'ports'} onClick={() => setResultTab('ports')}>
                  <Network size={11} />
                  Ports ({results.ports.length})
                </TabButton>
              </div>

              <div className="overflow-auto" style={{ maxHeight: 'calc(40vh - 36px)' }}>
                {resultTab === 'hosts' && <HostsTable hosts={results.hosts} />}
                {resultTab === 'ports' && <PortsTable ports={results.ports} hostMap={buildHostMap(results.hosts)} />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScanHistoryItem({
  scan, isActive, onClick, onDelete,
}: {
  scan: Scan
  isActive: boolean
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-2.5 border-b border-[#1e1e24] group hover:bg-white/[0.02] transition-colors',
        isActive && 'bg-white/[0.04]',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-gray-500">{scan.id.slice(0, 8)}…</span>
        <div className="flex items-center gap-1.5">
          <StatusBadge status={scan.status} />
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 text-gray-700 hover:text-red-400 transition-all p-0.5 rounded"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <LayoutList size={9} className="text-gray-700 shrink-0" />
        <span className="text-[10px] text-gray-600 truncate">
          {scan.profile ?? (scan.config as Record<string, string> | null)?.flags ?? 'nmap'}
        </span>
      </div>
      {scan.started_at && (
        <span className="text-[9px] text-gray-700 block mt-0.5">
          {new Date(scan.started_at).toLocaleString()}
        </span>
      )}
    </button>
  )
}

function OutputLine({ line }: { line: string }) {
  const isStderr = line.startsWith('[STDERR]')
  const isError  = line.toLowerCase().includes('[error]')
  return (
    <div className={cn(
      'whitespace-pre-wrap break-all',
      isStderr ? 'text-yellow-600' : isError ? 'text-red-400' : 'text-green-400/80',
    )}>
      {line}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-4 py-2 text-[10px] font-medium border-b-2 transition-colors',
        active
          ? 'border-red-500 text-gray-200'
          : 'border-transparent text-gray-600 hover:text-gray-400',
      )}
    >
      {children}
    </button>
  )
}

function buildHostMap(hosts: Host[]): Record<string, Host> {
  return Object.fromEntries(hosts.map((h) => [h.id, h]))
}

function HostsTable({ hosts }: { hosts: Host[] }) {
  if (hosts.length === 0) {
    return <p className="px-4 py-4 text-xs text-gray-600">No hosts discovered.</p>
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-gray-700 border-b border-[#2a2a32]">
          <th className="text-left px-4 py-2">IP</th>
          <th className="text-left px-4 py-2">Hostname</th>
          <th className="text-left px-4 py-2">OS</th>
          <th className="text-left px-4 py-2">MAC / Vendor</th>
          <th className="text-left px-4 py-2">State</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#1e1e24]">
        {hosts.map((h) => (
          <tr key={h.id} className="hover:bg-white/[0.02] transition-colors">
            <td className="px-4 py-2 font-mono text-green-400">{h.ip}</td>
            <td className="px-4 py-2 text-gray-400 font-mono">{h.hostname ?? '—'}</td>
            <td className="px-4 py-2 text-gray-400 max-w-[180px] truncate" title={h.os ?? ''}>
              {h.os ? `${h.os}${h.os_accuracy ? ` (${h.os_accuracy}%)` : ''}` : '—'}
            </td>
            <td className="px-4 py-2 text-gray-500 font-mono text-[10px]">
              {h.mac ? `${h.mac}${h.vendor ? ` · ${h.vendor}` : ''}` : '—'}
            </td>
            <td className="px-4 py-2">
              <span className={cn(
                'text-[10px] font-medium',
                h.state === 'up' ? 'text-green-400' : 'text-gray-500',
              )}>
                {h.state}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PortsTable({ ports, hostMap }: { ports: Port[]; hostMap: Record<string, Host> }) {
  if (ports.length === 0) {
    return <p className="px-4 py-4 text-xs text-gray-600">No open ports found.</p>
  }

  const sorted = [...ports].sort((a, b) => a.number - b.number)

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-gray-700 border-b border-[#2a2a32]">
          <th className="text-left px-4 py-2">Host</th>
          <th className="text-left px-4 py-2">Port</th>
          <th className="text-left px-4 py-2">Proto</th>
          <th className="text-left px-4 py-2">State</th>
          <th className="text-left px-4 py-2">Service</th>
          <th className="text-left px-4 py-2">Version</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#1e1e24]">
        {sorted.map((p) => {
          const host = hostMap[p.host_id]
          return (
            <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
              <td className="px-4 py-2 font-mono text-green-400 text-[10px]">
                {host?.ip ?? '—'}
              </td>
              <td className="px-4 py-2 font-mono font-semibold text-gray-200">{p.number}</td>
              <td className="px-4 py-2 text-gray-600 uppercase text-[10px]">{p.protocol}</td>
              <td className="px-4 py-2">
                <span className={cn(
                  'text-[10px] font-medium',
                  p.state === 'open'     ? 'text-green-400'  :
                  p.state === 'filtered' ? 'text-yellow-500' : 'text-gray-500',
                )}>
                  {p.state}
                </span>
              </td>
              <td className="px-4 py-2 text-blue-400/80">{p.service ?? '—'}</td>
              <td className="px-4 py-2 text-gray-500 text-[10px] max-w-[200px] truncate" title={p.version ?? ''}>
                {p.version ?? '—'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
