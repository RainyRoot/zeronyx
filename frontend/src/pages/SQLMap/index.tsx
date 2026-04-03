import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Database, Play, Square, RotateCcw, ChevronDown, ChevronRight,
  Download, AlertTriangle, Info, CheckCircle, X, Filter,
  Layers, Globe,
} from 'lucide-react'
import { useSqlmapStore } from '@/stores/sqlmapStore'
import { useProjectStore } from '@/stores/projectStore'
import { cn } from '@/lib/utils'
import type { ProxyRequest } from '@/types'
import type { SqlmapConfig } from '@/stores/sqlmapStore'
import { backendBase, backendWsBase } from '@/lib/backend'

const API      = backendBase()
const WS_BASE  = `${backendWsBase()}/ws/scan`

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROFILES = [
  { name: 'Quick Detection',  config: { level: 1, risk: 1, dbs: false, tables: false, dump: false, random_agent: true } },
  { name: 'Enumerate DBs',    config: { level: 2, risk: 1, dbs: true,  tables: false, dump: false, random_agent: true } },
  { name: 'Full Enumeration', config: { level: 2, risk: 2, dbs: true,  tables: true,  dump: false, random_agent: true } },
  { name: 'Form POST',        config: { level: 1, risk: 1, dbs: false, tables: false, dump: false, random_agent: true } },
  { name: 'Cookie Injection', config: { level: 1, risk: 1, technique: 'BEU', dbs: false, tables: false, dump: false, random_agent: true } },
  { name: 'Aggressive',       config: { level: 5, risk: 3, dbs: true,  tables: true,  dump: false, random_agent: true } },
]

const DBMS_OPTIONS = ['', 'MySQL', 'PostgreSQL', 'Microsoft SQL Server', 'Oracle', 'SQLite', 'MariaDB']
const METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

// ---------------------------------------------------------------------------
// Line coloriser (mirrors ScanRunner pattern)
// ---------------------------------------------------------------------------

function colorLine(line: string): string {
  if (/\[CRITICAL\]|\[ERROR\]/.test(line)) return 'text-red-400'
  if (/\[WARNING\]/.test(line))            return 'text-yellow-400'
  if (/\[INFO\].*inject|vulnerable/i.test(line)) return 'text-green-400'
  if (/\[INFO\]/.test(line))              return 'text-blue-300'
  if (/\[\*\]/.test(line))                return 'text-cyan-400'
  if (/\[PAYLOAD\]/.test(line))           return 'text-purple-400'
  return 'text-gray-300'
}

// ---------------------------------------------------------------------------
// Proxy Picker Modal
// ---------------------------------------------------------------------------

function ProxyPickerModal({
  projectId,
  onClose,
  onPick,
}: {
  projectId: string
  onClose: () => void
  onPick: (req: ProxyRequest) => void
}): JSX.Element {
  const { proxyRequests, loadingProxy, fetchProxyRequests } = useSqlmapStore()
  const [filter, setFilter] = useState('')

  useEffect(() => { fetchProxyRequests(projectId) }, [projectId, fetchProxyRequests])

  const visible = proxyRequests.filter((r) => {
    const q = filter.toLowerCase()
    return !q || r.url.toLowerCase().includes(q) || r.method.toLowerCase().includes(q)
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#16161b] border border-[#2a2a32] rounded-lg shadow-2xl w-[700px] max-h-[520px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a32] shrink-0">
          <div className="flex items-center gap-2">
            <Globe size={15} className="text-cyan-400" />
            <span className="text-sm font-semibold text-gray-200">Import from Proxy</span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X size={15} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2.5 border-b border-[#2a2a32] shrink-0">
          <div className="flex items-center gap-2 bg-[#1a1a1f] border border-[#2a2a32] rounded px-2.5 py-1.5">
            <Filter size={12} className="text-gray-500 shrink-0" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by URL or method…"
              className="flex-1 bg-transparent text-xs text-gray-200 outline-none placeholder-gray-600"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loadingProxy ? (
            <div className="flex items-center justify-center h-24 text-gray-600 text-xs">Loading…</div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 gap-2 text-gray-600">
              <Globe size={20} />
              <span className="text-xs">No proxy requests found. Start the proxy and capture some traffic first.</span>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#16161b] border-b border-[#2a2a32]">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium w-16">Method</th>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">URL</th>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium w-16">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((req) => (
                  <tr
                    key={req.id}
                    onClick={() => onPick(req)}
                    className="border-b border-[#1e1e24] hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2">
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold',
                        req.method === 'GET'  ? 'bg-blue-500/15 text-blue-400'   :
                        req.method === 'POST' ? 'bg-green-500/15 text-green-400' :
                        'bg-gray-500/15 text-gray-400'
                      )}>
                        {req.method}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-300 font-mono truncate max-w-[420px]">
                      {req.url}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {req.status_code ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Config panel
// ---------------------------------------------------------------------------

function ConfigPanel({ onRun, running }: { onRun: () => void; running: boolean }): JSX.Element {
  const { config, setConfigField, applyProfile, importFromProxyRequest } = useSqlmapStore()
  const { activeProject } = useProjectStore()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showProxy, setShowProxy] = useState(false)

  const handleProfile = (p: typeof PROFILES[0]) => applyProfile(p.config)

  const fieldClass = 'w-full bg-[#1a1a1f] border border-[#2a2a32] rounded px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-red-500/50 placeholder-gray-600'
  const labelClass = 'text-xs text-gray-500 mb-1 block'
  const checkClass = 'accent-red-500 w-3.5 h-3.5 shrink-0'

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-4">

        {/* Profiles */}
        <div>
          <label className={labelClass}>Quick Profile</label>
          <div className="flex flex-wrap gap-1.5">
            {PROFILES.map((p) => (
              <button
                key={p.name}
                onClick={() => handleProfile(p)}
                className="px-2 py-0.5 rounded text-[11px] bg-[#1e1e24] border border-[#2a2a32] text-gray-400 hover:text-gray-200 hover:border-red-500/40 transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Target URL */}
        <div>
          <label className={labelClass}>Target URL *</label>
          <input
            value={config.url}
            onChange={(e) => setConfigField('url', e.target.value)}
            placeholder="http://target.com/page?id=1"
            className={fieldClass}
          />
        </div>

        {/* Method */}
        <div>
          <label className={labelClass}>Method</label>
          <select
            value={config.method}
            onChange={(e) => setConfigField('method', e.target.value)}
            className={fieldClass}
          >
            {METHOD_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* POST Data */}
        <div>
          <label className={labelClass}>POST Data</label>
          <textarea
            value={config.data}
            onChange={(e) => setConfigField('data', e.target.value)}
            placeholder="user=foo&pass=bar"
            rows={2}
            className={cn(fieldClass, 'resize-none font-mono')}
          />
        </div>

        {/* Cookie */}
        <div>
          <label className={labelClass}>Cookie</label>
          <input
            value={config.cookie}
            onChange={(e) => setConfigField('cookie', e.target.value)}
            placeholder="PHPSESSID=abc123; auth=token"
            className={cn(fieldClass, 'font-mono')}
          />
        </div>

        {/* Import from Proxy */}
        {activeProject && (
          <ImportFromProxyButton
            projectId={activeProject.id}
            onPick={importFromProxyRequest}
          />
        )}

        {/* Enumeration flags */}
        <div>
          <label className={labelClass}>Enumerate</label>
          <div className="flex gap-4">
            {([['dbs', '--dbs'], ['tables', '--tables'], ['dump', '--dump']] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config[key] as boolean}
                  onChange={(e) => setConfigField(key, e.target.checked)}
                  className={checkClass}
                />
                <span className="text-xs text-gray-400 font-mono">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Level / Risk */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Level <span className="text-gray-600">(1–5)</span></label>
            <input
              type="number" min={1} max={5}
              value={config.level}
              onChange={(e) => setConfigField('level', parseInt(e.target.value) || 1)}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Risk <span className="text-gray-600">(1–3)</span></label>
            <input
              type="number" min={1} max={3}
              value={config.risk}
              onChange={(e) => setConfigField('risk', parseInt(e.target.value) || 1)}
              className={fieldClass}
            />
          </div>
        </div>

        {/* Advanced toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors w-full"
        >
          {showAdvanced ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          Advanced options
        </button>

        {showAdvanced && (
          <div className="space-y-3 pl-1 border-l border-[#2a2a32]">
            {/* DBMS */}
            <div>
              <label className={labelClass}>Target DBMS</label>
              <select
                value={config.dbms}
                onChange={(e) => setConfigField('dbms', e.target.value)}
                className={fieldClass}
              >
                {DBMS_OPTIONS.map((d) => <option key={d} value={d}>{d || '— auto detect —'}</option>)}
              </select>
            </div>

            {/* Technique */}
            <div>
              <label className={labelClass}>Technique <span className="text-gray-600">BEUSTQ</span></label>
              <input
                value={config.technique}
                onChange={(e) => setConfigField('technique', e.target.value.toUpperCase())}
                placeholder="e.g. BEU"
                className={cn(fieldClass, 'font-mono uppercase')}
                maxLength={6}
              />
            </div>

            {/* Additional headers */}
            <div>
              <label className={labelClass}>Extra Headers <span className="text-gray-600">(one per line)</span></label>
              <textarea
                value={config.headers}
                onChange={(e) => setConfigField('headers', e.target.value)}
                placeholder={'X-Forwarded-For: 127.0.0.1\nReferer: http://target.com/'}
                rows={3}
                className={cn(fieldClass, 'resize-none font-mono text-[11px]')}
              />
            </div>

            {/* Threads / Timeout */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Threads</label>
                <input
                  type="number" min={1} max={10}
                  value={config.threads}
                  onChange={(e) => setConfigField('threads', parseInt(e.target.value) || 1)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Timeout (s)</label>
                <input
                  type="number" min={5}
                  value={config.timeout}
                  onChange={(e) => setConfigField('timeout', parseInt(e.target.value) || 30)}
                  className={fieldClass}
                />
              </div>
            </div>

            {/* Random agent */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.randomAgent}
                onChange={(e) => setConfigField('randomAgent', e.target.checked)}
                className={checkClass}
              />
              <span className="text-xs text-gray-400">Random User-Agent</span>
            </label>

            {/* Proxy */}
            <button
              onClick={() => setShowProxy(!showProxy)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300"
            >
              {showProxy ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Proxy settings
            </button>
            {showProxy && (
              <div>
                <label className={labelClass}>HTTP Proxy URL</label>
                <input
                  value={config.proxy}
                  onChange={(e) => setConfigField('proxy', e.target.value)}
                  placeholder="http://127.0.0.1:8080"
                  className={cn(fieldClass, 'font-mono')}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Run button */}
      <div className="p-4 mt-auto border-t border-[#2a2a32] shrink-0">
        <button
          onClick={onRun}
          disabled={running || !config.url.trim()}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2 rounded text-sm font-semibold transition-colors',
            running || !config.url.trim()
              ? 'bg-gray-700/40 text-gray-600 cursor-not-allowed'
              : 'bg-red-600 hover:bg-red-500 text-white'
          )}
        >
          {running ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Running…
            </>
          ) : (
            <>
              <Play size={14} />
              Run SQLMap
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Import from Proxy Button (inline helper)
// ---------------------------------------------------------------------------

function ImportFromProxyButton({
  projectId,
  onPick,
}: {
  projectId: string
  onPick: (req: ProxyRequest) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded border border-dashed border-[#2a2a32] text-xs text-gray-500 hover:text-gray-300 hover:border-red-500/40 transition-colors w-full justify-center"
      >
        <Download size={12} />
        Import from Proxy request
      </button>
      {open && (
        <ProxyPickerModal
          projectId={projectId}
          onClose={() => setOpen(false)}
          onPick={(req) => { onPick(req); setOpen(false) }}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Results panel
// ---------------------------------------------------------------------------

function ResultsPanel(): JSX.Element {
  const { scanId, scanning, scanStatus, outputLines, parsed, resetScan, setScanStatus, appendLine, setParsed } = useSqlmapStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [tab, setTab] = useState<'output' | 'findings'>('output')

  // Auto-scroll
  useEffect(() => {
    if (tab === 'output') bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [outputLines, tab])

  // WS connection
  useEffect(() => {
    if (!scanId) return

    const ws = new WebSocket(`${WS_BASE}/${scanId}`)
    wsRef.current = ws

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'output' && msg.line) {
          appendLine(msg.line)
        } else if (msg.type === 'result') {
          if (msg.parsed) setParsed(msg.parsed)
          setScanStatus('completed')
        } else if (msg.type === 'status') {
          setScanStatus(msg.status)
        }
      } catch { /* ignore */ }
    }

    ws.onerror = () => setScanStatus('failed')
    ws.onclose = () => {
      if (scanStatus !== 'completed' && scanStatus !== 'cancelled') {
        setScanStatus('completed')
      }
    }

    return () => { ws.close(); wsRef.current = null }
  }, [scanId]) // eslint-disable-line

  if (!scanId && !scanning) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600">
        <Database size={32} strokeWidth={1} />
        <p className="text-sm">Configure a target and click <span className="text-gray-400 font-semibold">Run SQLMap</span></p>
        <p className="text-xs">Output and findings will appear here</p>
      </div>
    )
  }

  const statusColor =
    scanStatus === 'completed'  ? 'text-green-400'  :
    scanStatus === 'failed'     ? 'text-red-400'     :
    scanStatus === 'cancelled'  ? 'text-yellow-400'  :
    'text-blue-400'

  const injections = parsed?.injections ?? []
  const databases  = parsed?.databases  ?? []
  const tables     = parsed?.tables     ?? []

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-[#2a2a32] px-4 shrink-0">
        {(['output', 'findings'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors capitalize',
              tab === t
                ? 'border-red-500 text-gray-200'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            )}
          >
            {t === 'findings' ? `Findings${injections.length ? ` (${injections.length})` : ''}` : 'Output'}
          </button>
        ))}

        {/* Status + controls */}
        <div className="ml-auto flex items-center gap-3">
          {scanStatus && (
            <span className={cn('text-xs', statusColor)}>
              {scanning ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  Running
                </span>
              ) : scanStatus}
            </span>
          )}
          {!scanning && scanId && (
            <button
              onClick={resetScan}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              <RotateCcw size={11} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'output' ? (
        <div className="flex-1 overflow-y-auto font-mono text-[11px] leading-5 p-3 bg-[#0e0e12]">
          {outputLines.map((line, i) => (
            <div key={i} className={cn('whitespace-pre-wrap', colorLine(line))}>
              {line}
            </div>
          ))}
          {scanning && (
            <div className="flex items-center gap-1.5 text-gray-600 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-pulse" />
              waiting for output…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      ) : (
        <FindingsTab injections={injections} databases={databases} tables={tables} parsed={parsed} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Findings tab
// ---------------------------------------------------------------------------

function FindingsTab({
  injections,
  databases,
  tables,
  parsed,
}: {
  injections: ReturnType<typeof useSqlmapStore.getState>['parsed'] extends null ? never : NonNullable<ReturnType<typeof useSqlmapStore.getState>['parsed']>['injections']
  databases: string[]
  tables: string[]
  parsed: ReturnType<typeof useSqlmapStore.getState>['parsed']
}): JSX.Element {
  if (!parsed && injections.length === 0 && databases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-2 text-gray-600 text-xs">
        <Info size={20} />
        No findings yet — run a scan first
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* DBMS info */}
      {parsed?.dbms && (
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
          <Info size={12} />
          Back-end DBMS: <span className="font-semibold ml-1">{parsed.dbms}</span>
          {parsed.current_db && <span className="text-blue-400 ml-2">— Current DB: {parsed.current_db}</span>}
        </div>
      )}

      {/* Injections */}
      {injections.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-1.5">
            <AlertTriangle size={12} />
            Injectable Parameters ({injections.length})
          </h3>
          <div className="space-y-2">
            {injections.map((inj, i) => (
              <div key={i} className="rounded border border-red-500/20 bg-red-500/5 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-semibold text-red-300">{inj.parameter}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/25">HIGH</span>
                </div>
                <p className="text-xs text-gray-400">{inj.technique}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Databases */}
      {databases.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-cyan-400 mb-2 flex items-center gap-1.5">
            <Database size={12} />
            Databases ({databases.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {databases.map((db) => (
              <span key={db} className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300 font-mono">
                {db}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tables */}
      {tables.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-purple-400 mb-2 flex items-center gap-1.5">
            <Layers size={12} />
            Tables ({tables.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {tables.map((t) => (
              <span key={t} className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 font-mono">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* No injections found */}
      {parsed && injections.length === 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-green-500/10 border border-green-500/20 text-xs text-green-300">
          <CheckCircle size={12} />
          No injectable parameters detected
        </div>
      )}

      {/* Warnings */}
      {parsed && parsed.warnings.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-yellow-400 mb-2 flex items-center gap-1.5">
            <AlertTriangle size={12} />
            Warnings
          </h3>
          <div className="space-y-1">
            {parsed.warnings.map((w, i) => (
              <p key={i} className="text-xs text-yellow-400/70 font-mono">{w}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function SQLMapPage(): JSX.Element {
  const { activeProject } = useProjectStore()
  const { scanning, runScan, config } = useSqlmapStore()

  const handleRun = useCallback(async () => {
    if (!activeProject) return
    await runScan(activeProject.id)
  }, [activeProject, runScan])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#2a2a32] bg-[#111114] shrink-0">
        <Database size={16} className="text-red-500 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">SQLMap</span>
        <span className="text-xs text-gray-600">SQL Injection Scanner</span>

        {config.url && (
          <span className="ml-auto text-xs text-gray-500 font-mono truncate max-w-[400px]">
            {config.url}
          </span>
        )}
      </div>

      {!activeProject ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-gray-600">
          <Database size={28} strokeWidth={1} />
          <p className="text-sm">Select a project to get started</p>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left — config */}
          <div className="w-72 shrink-0 border-r border-[#2a2a32] flex flex-col overflow-hidden">
            <ConfigPanel onRun={handleRun} running={scanning} />
          </div>

          {/* Right — output + findings */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <ResultsPanel />
          </div>
        </div>
      )}
    </div>
  )
}

export default SQLMapPage
