import { useEffect, useRef, useState, useMemo } from 'react'
import {
  Skull, Wifi, WifiOff, Search, ChevronRight, X,
  Play, RotateCcw, Lock, Info, AlertTriangle, Check,
} from 'lucide-react'
import { useMetasploitStore } from '@/stores/metasploitStore'
import { useProjectStore } from '@/stores/projectStore'
import { cn } from '@/lib/utils'
import type { MsfModule, MsfModuleInfo } from '@/types'

const API = 'http://127.0.0.1:8742'
const WS_BASE = 'ws://127.0.0.1:8742/ws/scan'

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const MODULE_TYPES = ['all', 'auxiliary', 'exploit', 'post', 'payload', 'encoder']

// Free tier allows auxiliary only; others get "Pro" badge
const FREE_TYPES = new Set(['auxiliary'])

const TYPE_COLORS: Record<string, string> = {
  auxiliary: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  exploit:   'bg-red-500/15 text-red-400 border-red-500/25',
  post:      'bg-purple-500/15 text-purple-400 border-purple-500/25',
  payload:   'bg-orange-500/15 text-orange-400 border-orange-500/25',
  encoder:   'bg-gray-500/15 text-gray-400 border-gray-500/25',
}

function typeBadge(t: string): string {
  return TYPE_COLORS[t.toLowerCase()] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/25'
}

// ──────────────────────────────────────────────────────────────────────────────
// Connection panel
// ──────────────────────────────────────────────────────────────────────────────

function ConnectionPanel(): JSX.Element {
  const { status, connecting, connectError, connect, disconnect, fetchStatus } = useMetasploitStore()
  const [host, setHost] = useState('127.0.0.1')
  const [port, setPort] = useState(55553)
  const [password, setPassword] = useState('msf')
  const [ssl, setSsl] = useState(false)
  const [showPw, setShowPw] = useState(false)

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const handleConnect = () => connect(host, port, password, ssl)

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#2a2a32] bg-[#111114] shrink-0 flex-wrap">
      <Skull size={16} className="text-red-500 shrink-0" />
      <span className="text-sm font-semibold text-gray-200">Metasploit</span>

      {/* Status badge */}
      <div className={cn(
        'flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border',
        status.connected
          ? 'bg-green-500/10 text-green-400 border-green-500/25'
          : 'bg-gray-500/10 text-gray-500 border-gray-500/25'
      )}>
        {status.connected ? <Wifi size={11} /> : <WifiOff size={11} />}
        {status.connected ? `msfrpcd ${status.version ?? ''}` : 'Not connected'}
      </div>

      {status.connected ? null : (
        <>
          {/* Host */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Host</span>
            <input value={host} onChange={(e) => setHost(e.target.value)}
              className="w-28 bg-[#1a1a1f] border border-[#2a2a32] rounded px-2 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-red-500/50" />
          </div>
          {/* Port */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Port</span>
            <input type="number" value={port} onChange={(e) => setPort(parseInt(e.target.value) || 55553)}
              className="w-16 bg-[#1a1a1f] border border-[#2a2a32] rounded px-2 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-red-500/50" />
          </div>
          {/* Password */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Password</span>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-24 bg-[#1a1a1f] border border-[#2a2a32] rounded pl-2 pr-7 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-red-500/50"
              />
              <button onClick={() => setShowPw(!showPw)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                <Lock size={10} />
              </button>
            </div>
          </div>
          {/* SSL toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={ssl} onChange={(e) => setSsl(e.target.checked)}
              className="accent-red-500 w-3 h-3" />
            <span className="text-xs text-gray-500">SSL</span>
          </label>
        </>
      )}

      <div className="flex-1" />

      {connectError && (
        <span className="text-xs text-red-400 truncate max-w-48" title={connectError}>
          {connectError}
        </span>
      )}

      {status.connected ? (
        <button onClick={disconnect}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors">
          <WifiOff size={12} />Disconnect
        </button>
      ) : (
        <button onClick={handleConnect} disabled={connecting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-colors disabled:opacity-50">
          <Wifi size={12} />
          {connecting ? 'Connecting…' : 'Connect'}
        </button>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Module list (left panel)
// ──────────────────────────────────────────────────────────────────────────────

function ModuleList({
  modules,
  searching,
  selectedName,
  onSelect,
}: {
  modules: MsfModule[]
  searching: boolean
  selectedName: string
  onSelect: (m: MsfModule) => void
}): JSX.Element {
  return (
    <div className="overflow-auto flex-1">
      {searching ? (
        <div className="flex items-center justify-center h-24 text-gray-600 text-sm">
          Searching…
        </div>
      ) : modules.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-600">
          <Search size={24} strokeWidth={1} />
          <p className="text-xs">No modules — search to browse</p>
        </div>
      ) : (
        <table className="w-full text-xs table-fixed">
          <thead className="sticky top-0 bg-[#111114] border-b border-[#2a2a32] z-10">
            <tr className="text-gray-500">
              <th className="text-left px-3 py-2 w-20 font-medium">Type</th>
              <th className="text-left px-2 py-2 font-medium">Module</th>
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => (
              <tr
                key={m.fullname}
                onClick={() => onSelect(m)}
                className={cn(
                  'border-b border-[#1a1a22] cursor-pointer transition-colors',
                  m.fullname === selectedName
                    ? 'bg-red-500/8 border-red-500/20'
                    : 'hover:bg-white/3'
                )}
              >
                <td className="px-3 py-1.5">
                  <span className={cn('text-[10px] font-bold px-1 py-0.5 rounded border font-mono', typeBadge(m.type))}>
                    {m.type.slice(0, 3).toUpperCase()}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-300 font-mono truncate">{m.name}</span>
                    {!FREE_TYPES.has(m.type) && (
                      <span className="shrink-0 text-[9px] px-1 py-0.5 rounded border bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                        PRO
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 truncate text-[10px] mt-0.5">{m.description}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Module detail + options (right panel)
// ──────────────────────────────────────────────────────────────────────────────

function ModuleDetail({
  info,
  optionValues,
  onOptionChange,
  onReset,
  onExecute,
  executing,
}: {
  info: MsfModuleInfo
  optionValues: Record<string, string>
  onOptionChange: (k: string, v: string) => void
  onReset: () => void
  onExecute: () => void
  executing: boolean
}): JSX.Element {
  const isFree = FREE_TYPES.has(info.type)
  const requiredMissing = info.required.filter((k) => !optionValues[k]?.trim())

  const sortedOptions = useMemo(() => {
    const opts = Object.values(info.options)
    return [...opts].sort((a, b) => {
      if (a.required && !b.required) return -1
      if (!a.required && b.required) return 1
      return a.name.localeCompare(b.name)
    })
  }, [info.options])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2a2a32] bg-[#111114]">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border', typeBadge(info.type))}>
            {info.type.toUpperCase()}
          </span>
          <span className="text-xs text-gray-300 font-mono font-semibold">{info.name}</span>
          {!isFree && (
            <span className="text-[9px] px-1.5 py-0.5 rounded border bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
              PRO
            </span>
          )}
          <div className="flex-1" />
          <span className="text-[10px] text-gray-600">Rank: {info.rank}</span>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">{info.description}</p>
        {info.authors.length > 0 && (
          <p className="text-[10px] text-gray-600 mt-1">Authors: {info.authors.join(', ')}</p>
        )}
      </div>

      {/* Options */}
      <div className="flex-1 overflow-auto p-4">
        {sortedOptions.length === 0 ? (
          <p className="text-xs text-gray-600 italic">No configurable options</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#2a2a32] text-gray-500">
                <th className="text-left py-1.5 pr-3 w-36 font-medium">Option</th>
                <th className="text-left py-1.5 pr-3 font-medium">Value</th>
                <th className="text-left py-1.5 font-medium text-gray-600">Description</th>
              </tr>
            </thead>
            <tbody>
              {sortedOptions.map((opt) => (
                <tr key={opt.name} className="border-b border-[#1a1a22]">
                  <td className="py-1.5 pr-3 align-middle">
                    <div className="flex items-center gap-1">
                      <span className={cn('font-mono', opt.required ? 'text-red-300' : 'text-gray-400')}>
                        {opt.name}
                      </span>
                      {opt.required && <span className="text-red-500 text-[10px]">*</span>}
                    </div>
                  </td>
                  <td className="py-1 pr-3 align-middle">
                    <input
                      type="text"
                      value={optionValues[opt.name] ?? ''}
                      onChange={(e) => onOptionChange(opt.name, e.target.value)}
                      placeholder={String(opt.default || '')}
                      className={cn(
                        'w-full bg-[#0d0d10] border rounded px-2 py-0.5 text-xs font-mono focus:outline-none',
                        opt.required && !optionValues[opt.name]?.trim()
                          ? 'border-red-500/40 focus:border-red-500/60'
                          : 'border-[#2a2a32] focus:border-red-500/50',
                        'text-gray-200'
                      )}
                    />
                  </td>
                  <td className="py-1.5 text-gray-600 text-[10px] leading-relaxed">{opt.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 px-4 py-3 border-t border-[#2a2a32] bg-[#111114]">
        {requiredMissing.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-orange-400">
            <AlertTriangle size={12} />
            Required: {requiredMissing.join(', ')}
          </div>
        )}
        <div className="flex-1" />
        <button onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-gray-500 hover:text-gray-300 border border-[#2a2a32] hover:border-gray-600 transition-colors">
          <RotateCcw size={12} />Reset
        </button>
        <button
          onClick={onExecute}
          disabled={executing || !isFree || requiredMissing.length > 0}
          title={!isFree ? 'Pro feature — auxiliary modules only in Community' : undefined}
          className={cn(
            'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium border transition-colors',
            isFree && requiredMissing.length === 0 && !executing
              ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border-red-500/25'
              : 'bg-gray-500/10 text-gray-600 border-gray-500/20 cursor-not-allowed'
          )}>
          {!isFree ? <Lock size={12} /> : <Play size={12} />}
          {executing ? 'Running…' : !isFree ? 'Pro Only' : 'Execute'}
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Inline scan runner (replaces module detail when executing)
// ──────────────────────────────────────────────────────────────────────────────

function ScanRunner({
  scanId,
  moduleName,
  onClose,
}: {
  scanId: string
  moduleName: string
  onClose: () => void
}): JSX.Element {
  const [lines, setLines] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const [status, setStatus] = useState<'running' | 'completed' | 'failed' | 'cancelled'>('running')
  const bottomRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/${scanId}`)
    wsRef.current = ws

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'output') {
          setLines((prev) => [...prev, msg.line])
        } else if (msg.type === 'done') {
          setStatus('completed')
          setDone(true)
        } else if (msg.type === 'error') {
          setLines((prev) => [...prev, `[ERROR] ${msg.message}`])
          setStatus('failed')
          setDone(true)
        }
      } catch { /* ignore */ }
    }

    ws.onerror = () => setStatus('failed')

    return () => { ws.close() }
  }, [scanId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#2a2a32] bg-[#111114]">
        <div className={cn(
          'w-2 h-2 rounded-full',
          status === 'running' ? 'bg-yellow-400 animate-pulse' :
          status === 'completed' ? 'bg-green-400' : 'bg-red-400'
        )} />
        <span className="text-xs font-mono text-gray-300">{moduleName}</span>
        <span className={cn(
          'text-[10px] px-1.5 py-0.5 rounded border',
          status === 'running' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
          status === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
          'bg-red-500/10 text-red-400 border-red-500/20'
        )}>
          {status}
        </span>
        <div className="flex-1" />
        {done && (
          <button onClick={onClose}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 border border-[#2a2a32] rounded px-2 py-0.5 transition-colors">
            <X size={11} />Close
          </button>
        )}
      </div>

      {/* Output */}
      <div className="flex-1 overflow-auto p-3 font-mono text-xs bg-[#080810]">
        {lines.map((line, i) => (
          <div key={i} className={cn(
            'leading-relaxed',
            line.startsWith('[+]') ? 'text-green-400' :
            line.startsWith('[-]') ? 'text-red-400' :
            line.startsWith('[*]') ? 'text-blue-400' :
            line.startsWith('[!]') || line.startsWith('[ERROR]') ? 'text-orange-400' :
            'text-gray-400'
          )}>
            {line}
          </div>
        ))}
        {!done && (
          <span className="text-gray-600 animate-pulse">█</span>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Main MetasploitPage
// ──────────────────────────────────────────────────────────────────────────────

export function MetasploitPage(): JSX.Element {
  const { currentProject } = useProjectStore()
  const {
    status, modules, searching, selectedModule, loadingInfo,
    optionValues, searchQuery, typeFilter,
    searchModules, loadModuleInfo, setOptionValue, resetOptions,
    setTypeFilter,
  } = useMetasploitStore()

  const [localQuery, setLocalQuery] = useState('')
  const [activeScan, setActiveScan] = useState<{ scanId: string; name: string } | null>(null)
  const [executing, setExecuting] = useState(false)
  const [selectedName, setSelectedName] = useState('')

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!status.connected) return
    searchModules(localQuery, typeFilter === 'all' ? undefined : typeFilter || undefined)
  }

  const handleModuleSelect = async (m: MsfModule) => {
    setSelectedName(m.fullname)
    setActiveScan(null)
    await loadModuleInfo(m.type, m.name)
  }

  const handleExecute = async () => {
    if (!currentProject || !selectedModule) return
    setExecuting(true)

    try {
      // Create scan record
      const createRes = await fetch(`${API}/api/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: currentProject.id,
          tool: 'metasploit',
          profile: selectedModule.name,
          config: {
            mod_type: selectedModule.type,
            mod_name: selectedModule.name,
            options: optionValues,
          },
        }),
      })
      if (!createRes.ok) throw new Error('Failed to create scan')
      const scan = await createRes.json()

      // Start it
      const startRes = await fetch(`${API}/api/scans/${scan.id}/start`, { method: 'POST' })
      if (!startRes.ok) throw new Error('Failed to start scan')

      setActiveScan({ scanId: scan.id, name: selectedModule.fullname })
    } catch (e) {
      console.error('Execute failed:', e)
    } finally {
      setExecuting(false)
    }
  }

  // No project selected
  if (!currentProject) {
    return (
      <div className="flex flex-col h-full bg-[#0d0d10]">
        <ConnectionPanel />
        <div className="flex items-center justify-center flex-1 text-gray-500">
          Select a project to use Metasploit.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#0d0d10]">
      {/* Connection bar */}
      <ConnectionPanel />

      {!status.connected ? (
        /* ── Not connected — show setup instructions ── */
        <div className="flex items-center justify-center flex-1">
          <div className="max-w-md text-center px-6">
            <Skull size={48} strokeWidth={1} className="text-gray-700 mx-auto mb-4" />
            <h2 className="text-gray-300 font-semibold mb-2">Connect to msfrpcd</h2>
            <p className="text-gray-600 text-sm mb-4">
              Start the Metasploit RPC daemon, then connect above.
            </p>
            <div className="bg-[#111114] border border-[#2a2a32] rounded-lg p-4 text-left">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Quick start</p>
              <code className="text-xs text-green-400 font-mono block leading-relaxed">
                {`# Start msfrpcd (no SSL for local use)\nmsfrpcd -P msf -S false -a 127.0.0.1\n\n# Then connect above with:\n# Host: 127.0.0.1  Port: 55553\n# Password: msf  SSL: off`}
              </code>
            </div>
          </div>
        </div>
      ) : (
        /* ── Connected — module browser ── */
        <div className="flex flex-1 min-h-0">

          {/* Left: search + module list */}
          <div className="w-80 shrink-0 flex flex-col border-r border-[#2a2a32]">
            {/* Search bar */}
            <form onSubmit={handleSearch} className="flex items-center gap-2 p-3 border-b border-[#2a2a32]">
              <div className="relative flex-1">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  value={localQuery}
                  onChange={(e) => setLocalQuery(e.target.value)}
                  placeholder="Search modules…"
                  className="w-full bg-[#1a1a1f] border border-[#2a2a32] rounded pl-6 pr-2 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-red-500/50"
                />
              </div>
              <button type="submit"
                className="px-2 py-1.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors">
                <Search size={12} />
              </button>
            </form>

            {/* Type filter chips */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-[#2a2a32] flex-wrap">
              {MODULE_TYPES.map((t) => (
                <button key={t} onClick={() => {
                  setTypeFilter(t === 'all' ? '' : t)
                  searchModules(localQuery, t === 'all' ? undefined : t)
                }}
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[10px] border transition-colors',
                    (t === 'all' ? !typeFilter : typeFilter === t)
                      ? 'bg-red-500/15 text-red-400 border-red-500/30'
                      : 'text-gray-500 border-[#2a2a32] hover:text-gray-300 hover:border-gray-600'
                  )}>
                  {t}
                </button>
              ))}
            </div>

            {/* Result count */}
            {modules.length > 0 && (
              <div className="px-3 py-1.5 border-b border-[#2a2a32]">
                <span className="text-[10px] text-gray-600">{modules.length} modules</span>
              </div>
            )}

            <ModuleList
              modules={modules}
              searching={searching}
              selectedName={selectedName}
              onSelect={handleModuleSelect}
            />
          </div>

          {/* Right: module detail / scan runner */}
          <div className="flex-1 min-w-0 flex flex-col">
            {activeScan ? (
              <ScanRunner
                scanId={activeScan.scanId}
                moduleName={activeScan.name}
                onClose={() => setActiveScan(null)}
              />
            ) : loadingInfo ? (
              <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                Loading module info…
              </div>
            ) : selectedModule ? (
              <ModuleDetail
                info={selectedModule}
                optionValues={optionValues}
                onOptionChange={setOptionValue}
                onReset={resetOptions}
                onExecute={handleExecute}
                executing={executing}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600">
                <ChevronRight size={32} strokeWidth={1} />
                <p className="text-sm">Select a module to view options</p>
                <p className="text-xs text-gray-700">Search above to browse {modules.length > 0 ? `${modules.length} loaded modules` : 'modules'}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
