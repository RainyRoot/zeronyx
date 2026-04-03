import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import {
  Play, Square, Trash2, RefreshCw, Copy, Check,
  ChevronRight, X, Globe, Zap, RotateCcw, ShieldOff,
  Send, AlertTriangle,
} from 'lucide-react'
import { useProxyStore, type PendingFlow, type FlowModifications } from '@/stores/proxyStore'
import { useProjectStore } from '@/stores/projectStore'
import { cn } from '@/lib/utils'
import type { ProxyRequest } from '@/types'
import { backendWsBase } from '@/lib/backend'

const WS_URL = `${backendWsBase()}/api/proxy/ws`
const PING_MS = 25_000

// ──────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ──────────────────────────────────────────────────────────────────────────────

function methodBadge(method: string): string {
  const map: Record<string, string> = {
    GET:     'bg-green-500/15 text-green-400 border-green-500/25',
    POST:    'bg-blue-500/15 text-blue-400 border-blue-500/25',
    PUT:     'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
    PATCH:   'bg-orange-500/15 text-orange-400 border-orange-500/25',
    DELETE:  'bg-red-500/15 text-red-400 border-red-500/25',
    OPTIONS: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
    HEAD:    'bg-gray-500/15 text-gray-400 border-gray-500/25',
  }
  return map[method.toUpperCase()] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/25'
}

function statusColor(code: number | null): string {
  if (!code) return 'text-gray-500'
  if (code < 300) return 'text-green-400'
  if (code < 400) return 'text-yellow-400'
  if (code < 500) return 'text-orange-400'
  return 'text-red-400'
}

function formatSize(b: number | null): string {
  if (b == null) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour12: false, fractionalSecondDigits: 3 })
}

// ──────────────────────────────────────────────────────────────────────────────
// Small reusable atoms
// ──────────────────────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }): JSX.Element {
  const [ok, setOk] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500) }}
      className="p-1 rounded hover:bg-white/10 transition-colors"
    >
      {ok ? <Check size={12} className="text-green-400" /> : <Copy size={12} className="text-gray-500" />}
    </button>
  )
}

function MethodBadge({ method }: { method: string }): JSX.Element {
  return (
    <span className={cn('text-[10px] font-bold px-1 py-0.5 rounded border font-mono uppercase', methodBadge(method))}>
      {method}
    </span>
  )
}

function HeadersTable({ headers }: { headers: Record<string, string> | null }): JSX.Element {
  if (!headers || !Object.keys(headers).length)
    return <p className="text-gray-600 text-xs italic">No headers</p>
  return (
    <table className="w-full text-xs font-mono">
      <tbody>
        {Object.entries(headers).map(([k, v]) => (
          <tr key={k} className="border-b border-[#2a2a32]/40">
            <td className="py-0.5 pr-3 text-blue-300 whitespace-nowrap align-top w-1/3">{k}</td>
            <td className="py-0.5 text-gray-300 break-all">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function BodyViewer({ body, contentType }: { body: string | null; contentType?: string | null }): JSX.Element {
  if (!body) return <p className="text-gray-600 text-xs italic">Empty body</p>
  if (body.startsWith('base64:'))
    return <p className="text-xs text-gray-500 italic">Binary content (base64) <CopyBtn text={body.slice(7)} /></p>
  const ct = contentType?.toLowerCase() ?? ''
  if (ct.includes('json')) {
    try {
      return (
        <pre className="text-xs text-gray-200 font-mono whitespace-pre-wrap break-all leading-relaxed">
          {JSON.stringify(JSON.parse(body), null, 2)}
        </pre>
      )
    } catch { /* fall through */ }
  }
  return <pre className="text-xs text-gray-200 font-mono whitespace-pre-wrap break-all leading-relaxed">{body}</pre>
}

// ──────────────────────────────────────────────────────────────────────────────
// Inspector (right panel — captured request detail)
// ──────────────────────────────────────────────────────────────────────────────

type ITab = 'req-h' | 'req-b' | 'res-h' | 'res-b'

function Inspector({ request, onReplay }: { request: ProxyRequest; onReplay: () => void }): JSX.Element {
  const [tab, setTab] = useState<ITab>('req-h')
  const TABS: { id: ITab; label: string }[] = [
    { id: 'req-h', label: 'Req Headers' },
    { id: 'req-b', label: 'Req Body' },
    { id: 'res-h', label: 'Res Headers' },
    { id: 'res-b', label: 'Res Body' },
  ]
  return (
    <div className="flex flex-col h-full">
      {/* URL bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2a2a32] bg-[#111114] shrink-0">
        <MethodBadge method={request.method} />
        <span className={cn('text-xs font-bold font-mono', statusColor(request.status_code))}>
          {request.status_code ?? '—'}
        </span>
        <span className="text-gray-400 text-xs font-mono flex-1 truncate">{request.url}</span>
        <CopyBtn text={request.url} />
        {/* Replay button */}
        <button
          onClick={onReplay}
          title="Replay / edit & resend"
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20 transition-colors"
        >
          <RotateCcw size={11} />
          Replay
        </button>
        {request.tags?.includes('replay') && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border bg-orange-500/10 text-orange-400 border-orange-500/20">
            replayed
          </span>
        )}
      </div>
      {/* Tabs */}
      <div className="flex border-b border-[#2a2a32] bg-[#0d0d10] shrink-0">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('px-3 py-1.5 text-xs transition-colors',
              tab === t.id ? 'text-red-400 border-b border-red-500' : 'text-gray-500 hover:text-gray-300'
            )}>
            {t.label}
          </button>
        ))}
      </div>
      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {tab === 'req-h' && <HeadersTable headers={request.request_headers} />}
        {tab === 'req-b' && <BodyViewer body={request.request_body} contentType={request.request_headers?.['content-type']} />}
        {tab === 'res-h' && <HeadersTable headers={request.response_headers} />}
        {tab === 'res-b' && <BodyViewer body={request.response_body} contentType={request.content_type} />}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Replay Modal
// ──────────────────────────────────────────────────────────────────────────────

function ReplayModal(): JSX.Element | null {
  const { replayTarget, replayResult, replaying, sendReplay, closeReplay } = useProxyStore()
  const { currentProject } = useProjectStore()
  const [method, setMethod] = useState('')
  const [url, setUrl] = useState('')
  const [headersRaw, setHeadersRaw] = useState('')
  const [body, setBody] = useState('')
  const [resTab, setResTab] = useState<'body' | 'headers'>('body')

  useEffect(() => {
    if (!replayTarget) return
    setMethod(replayTarget.method)
    setUrl(replayTarget.url)
    const hdrs = replayTarget.request_headers ?? {}
    setHeadersRaw(Object.entries(hdrs).map(([k, v]) => `${k}: ${v}`).join('\n'))
    setBody(replayTarget.request_body ?? '')
    setResTab('body')
  }, [replayTarget])

  if (!replayTarget) return null

  const parseHeaders = (): Record<string, string> => {
    const out: Record<string, string> = {}
    headersRaw.split('\n').forEach((line) => {
      const idx = line.indexOf(':')
      if (idx > 0) {
        out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
      }
    })
    return out
  }

  const handleSend = () => {
    if (!currentProject) return
    sendReplay(currentProject.id, method, url, parseHeaders(), body || null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#111114] border border-[#2a2a32] rounded-xl shadow-2xl w-[900px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2a2a32]">
          <RotateCcw size={15} className="text-orange-400" />
          <span className="text-sm font-semibold text-gray-200">Replay Request</span>
          <div className="flex-1" />
          <button onClick={closeReplay} className="text-gray-600 hover:text-gray-300"><X size={16} /></button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left: editor */}
          <div className="w-1/2 flex flex-col border-r border-[#2a2a32] p-3 gap-3 overflow-auto">
            {/* Method + URL */}
            <div className="flex gap-2">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="bg-[#1a1a1f] border border-[#2a2a32] rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-red-500/50"
              >
                {['GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD'].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                className="flex-1 bg-[#1a1a1f] border border-[#2a2a32] rounded px-2 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-red-500/50"
              />
            </div>

            {/* Headers */}
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Headers (one per line, Key: Value)</p>
              <textarea
                value={headersRaw}
                onChange={(e) => setHeadersRaw(e.target.value)}
                rows={6}
                className="w-full bg-[#0d0d10] border border-[#2a2a32] rounded px-2 py-1.5 text-xs text-gray-300 font-mono resize-none focus:outline-none focus:border-red-500/50"
              />
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Body</p>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="flex-1 min-h-[80px] w-full bg-[#0d0d10] border border-[#2a2a32] rounded px-2 py-1.5 text-xs text-gray-300 font-mono resize-none focus:outline-none focus:border-red-500/50"
              />
            </div>

            <button
              onClick={handleSend}
              disabled={replaying || !url}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 border border-orange-500/20 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Send size={13} />
              {replaying ? 'Sending…' : 'Send'}
            </button>
          </div>

          {/* Right: response */}
          <div className="w-1/2 flex flex-col">
            {!replayResult ? (
              <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                {replaying ? 'Waiting for response…' : 'Hit Send to see the response'}
              </div>
            ) : (
              <>
                {/* Status bar */}
                <div className="flex items-center gap-3 px-3 py-2 border-b border-[#2a2a32] bg-[#111114]">
                  <span className={cn('text-sm font-bold font-mono', statusColor(replayResult.status_code))}>
                    {replayResult.status_code}
                  </span>
                  <span className="text-xs text-gray-500">{formatSize(replayResult.response_size)}</span>
                  <span className="text-xs text-gray-500">{formatDuration(replayResult.duration_ms)}</span>
                  <div className="flex-1" />
                  <CopyBtn text={replayResult.response_body ?? ''} />
                </div>
                {/* Tabs */}
                <div className="flex border-b border-[#2a2a32]">
                  {(['body', 'headers'] as const).map((t) => (
                    <button key={t} onClick={() => setResTab(t)}
                      className={cn('px-3 py-1.5 text-xs transition-colors capitalize',
                        resTab === t ? 'text-red-400 border-b border-red-500' : 'text-gray-500 hover:text-gray-300'
                      )}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-auto p-3">
                  {resTab === 'body' && (
                    <BodyViewer body={replayResult.response_body} contentType={replayResult.content_type} />
                  )}
                  {resTab === 'headers' && (
                    <HeadersTable headers={replayResult.response_headers} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Intercept Flow Editor (modal over pending flows panel)
// ──────────────────────────────────────────────────────────────────────────────

function InterceptEditor({
  flow,
  onForward,
  onDrop,
  onClose,
}: {
  flow: PendingFlow
  onForward: (mods: FlowModifications) => void
  onDrop: () => void
  onClose: () => void
}): JSX.Element {
  const [method, setMethod] = useState(flow.method)
  const [path, setPath] = useState(flow.path)
  const [headersRaw, setHeadersRaw] = useState(
    Object.entries(flow.headers).map(([k, v]) => `${k}: ${v}`).join('\n')
  )
  const [body, setBody] = useState(flow.body ?? '')

  const parseHeaders = (): Record<string, string> => {
    const out: Record<string, string> = {}
    headersRaw.split('\n').forEach((line) => {
      const idx = line.indexOf(':')
      if (idx > 0) out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    })
    return out
  }

  const handleForward = () => {
    const mods: FlowModifications = {}
    if (method !== flow.method) mods.method = method
    if (path !== flow.path) mods.path = path
    const newHeaders = parseHeaders()
    mods.headers = newHeaders
    if (body !== (flow.body ?? '')) mods.body = body
    onForward(Object.keys(mods).length > 0 ? mods : {})
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#111114] border border-[#2a2a32] rounded-xl shadow-2xl w-[700px] max-h-[80vh] flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2a2a32]">
          <Zap size={14} className="text-yellow-400" />
          <span className="text-sm font-semibold text-gray-200">Intercept Editor</span>
          <span className="text-xs text-gray-500 font-mono truncate flex-1">{flow.url}</span>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
          {/* Method + Path */}
          <div className="flex gap-2">
            <select value={method} onChange={(e) => setMethod(e.target.value)}
              className="bg-[#1a1a1f] border border-[#2a2a32] rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-yellow-500/50">
              {['GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD'].map((m) => <option key={m}>{m}</option>)}
            </select>
            <div className="text-xs text-gray-500 flex items-center px-2 bg-[#0d0d10] border border-[#2a2a32] rounded font-mono">
              {flow.scheme}://{flow.host}{flow.port !== 80 && flow.port !== 443 ? `:${flow.port}` : ''}
            </div>
            <input value={path} onChange={(e) => setPath(e.target.value)}
              className="flex-1 bg-[#1a1a1f] border border-[#2a2a32] rounded px-2 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-yellow-500/50" />
          </div>
          {/* Headers */}
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Headers</p>
            <textarea value={headersRaw} onChange={(e) => setHeadersRaw(e.target.value)} rows={7}
              className="w-full bg-[#0d0d10] border border-[#2a2a32] rounded px-2 py-1.5 text-xs text-gray-300 font-mono resize-none focus:outline-none focus:border-yellow-500/50" />
          </div>
          {/* Body */}
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Body</p>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5}
              className="w-full bg-[#0d0d10] border border-[#2a2a32] rounded px-2 py-1.5 text-xs text-gray-300 font-mono resize-none focus:outline-none focus:border-yellow-500/50" />
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-3 border-t border-[#2a2a32]">
          <button onClick={handleForward}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/20 text-xs font-medium transition-colors">
            <ChevronRight size={13} />Forward
          </button>
          <button onClick={onDrop}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20 text-xs font-medium transition-colors">
            <X size={13} />Drop
          </button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Pending Intercept Panel (bottom strip)
// ──────────────────────────────────────────────────────────────────────────────

function PendingPanel(): JSX.Element | null {
  const { pendingFlows, forwardFlow, dropFlow } = useProxyStore()
  const [editing, setEditing] = useState<PendingFlow | null>(null)

  if (!pendingFlows.length) return null

  return (
    <>
      {editing && (
        <InterceptEditor
          flow={editing}
          onClose={() => setEditing(null)}
          onForward={(mods) => { forwardFlow(editing.flow_id, mods); setEditing(null) }}
          onDrop={() => { dropFlow(editing.flow_id); setEditing(null) }}
        />
      )}
      <div className="border-t border-yellow-500/30 bg-yellow-500/5 shrink-0">
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-yellow-500/20">
          <AlertTriangle size={13} className="text-yellow-400" />
          <span className="text-xs font-semibold text-yellow-300">
            {pendingFlows.length} flow{pendingFlows.length > 1 ? 's' : ''} intercepted
          </span>
          <span className="text-xs text-yellow-600">— click to edit, or Forward / Drop</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <tbody>
              {pendingFlows.map((f) => (
                <tr key={f.flow_id}
                  className="border-b border-yellow-500/10 hover:bg-yellow-500/5 cursor-pointer"
                  onClick={() => setEditing(f)}>
                  <td className="px-3 py-1.5"><MethodBadge method={f.method} /></td>
                  <td className="px-2 py-1.5 text-gray-300 font-mono truncate max-w-[400px]">{f.url}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => forwardFlow(f.flow_id)}
                        className="px-2 py-0.5 rounded text-[10px] bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/20 transition-colors">
                        Forward
                      </button>
                      <button onClick={() => dropFlow(f.flow_id)}
                        className="px-2 py-0.5 rounded text-[10px] bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20 transition-colors">
                        Drop
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Main ProxyPage
// ──────────────────────────────────────────────────────────────────────────────

const METHODS = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']

export function ProxyPage(): JSX.Element {
  const { currentProject } = useProjectStore()
  const {
    status, requests, total, loading, selectedId,
    interceptEnabled, interceptFilter,
    replayTarget,
    fetchStatus, startProxy, stopProxy,
    fetchRequests, clearRequests, appendRequest, setSelected,
    toggleIntercept, appendPending, removePending, setInterceptFilter,
    openReplay,
  } = useProxyStore()

  const [port, setPort] = useState(8080)
  const [methodFilter, setMethodFilter] = useState('ALL')
  const [searchFilter, setSearchFilter] = useState('')
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const projectId = currentProject?.id ?? null

  const toast = useCallback((msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  useEffect(() => {
    if (!projectId) return
    fetchRequests(projectId)
  }, [projectId, fetchRequests])

  // WebSocket — live traffic + intercept events
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws
      ws.onopen = () => {
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'pong' }))
        }, PING_MS)
      }
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          if (msg.type === 'proxy_request') {
            appendRequest(msg as ProxyRequest)
          } else if (msg.type === 'intercept_request') {
            appendPending(msg as PendingFlow)
          } else if (msg.type === 'intercept_forwarded' || msg.type === 'intercept_dropped') {
            removePending(msg.flow_id)
          }
        } catch { /* ignore */ }
      }
      ws.onclose = () => {
        if (pingRef.current) clearInterval(pingRef.current)
        setTimeout(connect, 3000)
      }
    }
    connect()
    return () => { wsRef.current?.close(); if (pingRef.current) clearInterval(pingRef.current) }
  }, [projectId, appendRequest, appendPending, removePending])

  const filtered = useMemo(() => {
    let list = requests
    if (methodFilter !== 'ALL') list = list.filter((r) => r.method === methodFilter)
    if (searchFilter) {
      const q = searchFilter.toLowerCase()
      list = list.filter((r) => r.url.toLowerCase().includes(q) || r.host.toLowerCase().includes(q))
    }
    return list
  }, [requests, methodFilter, searchFilter])

  const selected = useMemo(() => requests.find((r) => r.id === selectedId) ?? null, [requests, selectedId])

  const handleToggle = async () => {
    if (!projectId) return
    if (status.running) {
      const res = await stopProxy()
      if (!res.ok) toast(res.error ?? 'Failed to stop proxy')
    } else {
      setStarting(true)
      const res = await startProxy(port, projectId)
      setStarting(false)
      if (!res.ok) toast(res.error ?? 'Failed to start proxy')
      else toast(`Proxy listening on 127.0.0.1:${port}`)
    }
  }

  const handleInterceptToggle = () => {
    toggleIntercept(!interceptEnabled, interceptFilter)
  }

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Select a project to use the proxy.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#0d0d10] relative">

      {/* Replay modal */}
      {replayTarget && <ReplayModal />}

      {/* Toast */}
      {toastMsg && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a1f] border border-[#2a2a32] text-gray-200 text-xs px-4 py-2 rounded-lg shadow-xl">
          {toastMsg}
        </div>
      )}

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#2a2a32] bg-[#111114] shrink-0">
        <Globe size={16} className="text-red-500 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">HTTP Proxy</span>

        {/* Status indicator */}
        <div className={cn(
          'flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border',
          status.running ? 'bg-green-500/10 text-green-400 border-green-500/25'
            : 'bg-gray-500/10 text-gray-500 border-gray-500/25'
        )}>
          <span className={cn('w-1.5 h-1.5 rounded-full', status.running ? 'bg-green-400 animate-pulse' : 'bg-gray-600')} />
          {status.running ? `Listening :${status.port}` : 'Stopped'}
        </div>

        <div className="flex-1" />

        {/* Port input */}
        {!status.running && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Port</span>
            <input type="number" value={port} min={1024} max={65535}
              onChange={(e) => setPort(parseInt(e.target.value) || 8080)}
              className="w-16 bg-[#1a1a1f] border border-[#2a2a32] rounded px-2 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-red-500/50" />
          </div>
        )}

        {/* Intercept toggle — only when proxy is running */}
        {status.running && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Filter (URL substring)"
              value={interceptFilter}
              onChange={(e) => setInterceptFilter(e.target.value)}
              className="w-36 bg-[#1a1a1f] border border-[#2a2a32] rounded px-2 py-0.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-yellow-500/50"
            />
            <button
              onClick={handleInterceptToggle}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                interceptEnabled
                  ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25 hover:bg-yellow-500/25'
                  : 'bg-gray-500/10 text-gray-500 border-gray-500/20 hover:text-gray-300 hover:border-gray-500/40'
              )}
            >
              <Zap size={12} />
              {interceptEnabled ? 'Intercept ON' : 'Intercept'}
            </button>
          </div>
        )}

        <button onClick={handleToggle} disabled={starting}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
            status.running
              ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border-red-500/25'
              : 'bg-green-500/15 text-green-400 hover:bg-green-500/25 border-green-500/25'
          )}>
          {status.running ? <Square size={13} /> : <Play size={13} />}
          {starting ? 'Starting…' : status.running ? 'Stop' : 'Start'}
        </button>

        <button onClick={() => projectId && fetchRequests(projectId)} disabled={loading}
          className="p-1.5 rounded hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors" title="Refresh">
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
        </button>

        <button onClick={() => projectId && clearRequests(projectId)}
          className="p-1.5 rounded hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors" title="Clear traffic">
          <Trash2 size={14} />
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#2a2a32] bg-[#0f0f12] shrink-0">
        <div className="flex items-center gap-1">
          {METHODS.map((m) => (
            <button key={m} onClick={() => setMethodFilter(m)}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-medium border transition-colors',
                methodFilter === m
                  ? 'bg-red-500/15 text-red-400 border-red-500/30'
                  : 'bg-transparent text-gray-500 border-[#2a2a32] hover:text-gray-300 hover:border-gray-600'
              )}>
              {m}
            </button>
          ))}
        </div>
        <div className="w-px h-4 bg-[#2a2a32] mx-1" />
        <div className="flex-1 relative">
          <input type="text" placeholder="Search URL or host…" value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-[#1a1a1f] border border-[#2a2a32] rounded px-2 py-0.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-red-500/50" />
          {searchFilter && (
            <button onClick={() => setSearchFilter('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
              <X size={11} />
            </button>
          )}
        </div>
        <span className="text-xs text-gray-600 whitespace-nowrap">{filtered.length}/{total}</span>
      </div>

      {/* ── Main content ── */}
      <div className="flex flex-1 min-h-0">

        {/* Traffic table */}
        <div className={cn('flex flex-col border-r border-[#2a2a32] overflow-hidden', selected ? 'w-1/2' : 'flex-1')}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600">
              <Globe size={32} strokeWidth={1} />
              {status.running
                ? <p className="text-sm">Waiting for traffic…</p>
                : <p className="text-sm">Start the proxy to capture HTTP/S traffic</p>}
              {status.running && (
                <p className="text-xs text-gray-700">
                  Browser proxy → <span className="text-gray-500 font-mono">127.0.0.1:{status.port}</span>
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-auto flex-1">
              <table className="w-full text-xs table-fixed">
                <thead className="sticky top-0 bg-[#111114] border-b border-[#2a2a32] z-10">
                  <tr className="text-gray-500">
                    <th className="text-left px-3 py-2 w-16 font-medium">Method</th>
                    <th className="text-left px-2 py-2 w-12 font-medium">Status</th>
                    <th className="text-left px-2 py-2 font-medium">Host</th>
                    <th className="text-left px-2 py-2 font-medium">Path</th>
                    <th className="text-right px-2 py-2 w-16 font-medium">Size</th>
                    <th className="text-right px-2 py-2 w-16 font-medium">Time</th>
                    <th className="text-right px-3 py-2 w-20 font-medium">Clock</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((req) => (
                    <tr key={req.id}
                      onClick={() => setSelected(req.id === selectedId ? null : req.id)}
                      className={cn(
                        'border-b border-[#1a1a22] cursor-pointer transition-colors',
                        req.id === selectedId ? 'bg-red-500/8 border-red-500/20' : 'hover:bg-white/3'
                      )}>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1">
                          <MethodBadge method={req.method} />
                          {req.tags?.includes('replay') && (
                            <RotateCcw size={9} className="text-orange-400" title="Replayed" />
                          )}
                        </div>
                      </td>
                      <td className={cn('px-2 py-1.5 font-mono font-semibold', statusColor(req.status_code))}>
                        {req.status_code ?? '—'}
                      </td>
                      <td className="px-2 py-1.5 text-gray-300 font-mono truncate max-w-0">
                        <span className="truncate block">
                          {req.scheme === 'https' && <span className="text-green-500 mr-0.5 text-[9px]">🔒</span>}
                          {req.host}{req.port !== 80 && req.port !== 443 && <span className="text-gray-600">:{req.port}</span>}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-gray-400 font-mono truncate max-w-0">
                        <span className="truncate block">{req.path.length > 60 ? req.path.slice(0, 60) + '…' : req.path}</span>
                      </td>
                      <td className="px-2 py-1.5 text-gray-500 text-right">{formatSize(req.response_size)}</td>
                      <td className="px-2 py-1.5 text-gray-500 text-right">{formatDuration(req.duration_ms)}</td>
                      <td className="px-3 py-1.5 text-gray-600 text-right font-mono">{formatTime(req.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Inspector panel */}
        {selected && (
          <div className="w-1/2 flex flex-col bg-[#0d0d10] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#2a2a32] bg-[#111114]">
              <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                <ChevronRight size={12} className="text-red-500" />Inspector
              </span>
              <button onClick={() => setSelected(null)} className="text-gray-600 hover:text-gray-300">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <Inspector request={selected} onReplay={() => openReplay(selected)} />
            </div>
          </div>
        )}
      </div>

      {/* ── Intercept pending panel ── */}
      <PendingPanel />

      {/* ── mitmproxy CA hint ── */}
      {status.running && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-t border-[#2a2a32] bg-[#111114] shrink-0">
          <ShieldOff size={11} className="text-gray-600" />
          <span className="text-[10px] text-gray-600">
            HTTPS intercept: install mitmproxy CA from{' '}
            <span className="text-gray-500 font-mono">http://mitm.it</span>
            {' '}while proxied to{' '}
            <span className="text-gray-500 font-mono">127.0.0.1:{status.port}</span>
          </span>
        </div>
      )}
    </div>
  )
}
