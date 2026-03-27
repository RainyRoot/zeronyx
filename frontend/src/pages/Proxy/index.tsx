import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import {
  Play,
  Square,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  X,
  Globe,
} from 'lucide-react'
import { useProxyStore } from '@/stores/proxyStore'
import { useProjectStore } from '@/stores/projectStore'
import { cn } from '@/lib/utils'
import type { ProxyRequest } from '@/types'

const WS_URL = 'ws://127.0.0.1:8742/api/proxy/ws'
const PING_MS = 25_000

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function methodBadge(method: string): string {
  const m = method.toUpperCase()
  const map: Record<string, string> = {
    GET:     'bg-green-500/15 text-green-400 border-green-500/25',
    POST:    'bg-blue-500/15 text-blue-400 border-blue-500/25',
    PUT:     'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
    PATCH:   'bg-orange-500/15 text-orange-400 border-orange-500/25',
    DELETE:  'bg-red-500/15 text-red-400 border-red-500/25',
    OPTIONS: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
    HEAD:    'bg-gray-500/15 text-gray-400 border-gray-500/25',
  }
  return map[m] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/25'
}

function statusColor(code: number | null): string {
  if (!code) return 'text-gray-500'
  if (code < 300) return 'text-green-400'
  if (code < 400) return 'text-yellow-400'
  if (code < 500) return 'text-orange-400'
  return 'text-red-400'
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatTime(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleTimeString(undefined, { hour12: false, fractionalSecondDigits: 3 })
}

function truncatePath(path: string, maxLen = 60): string {
  if (path.length <= maxLen) return path
  return path.slice(0, maxLen) + '…'
}

// ──────────────────────────────────────────────────────────────────────────────
// CopyButton
// ──────────────────────────────────────────────────────────────────────────────

function CopyButton({ text, className }: { text: string; className?: string }): JSX.Element {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button onClick={copy} className={cn('p-1 rounded hover:bg-white/10 transition-colors', className)}>
      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} className="text-gray-500" />}
    </button>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// HeadersTable
// ──────────────────────────────────────────────────────────────────────────────

function HeadersTable({ headers }: { headers: Record<string, string> | null }): JSX.Element {
  if (!headers || Object.keys(headers).length === 0) {
    return <p className="text-gray-600 text-xs italic">No headers</p>
  }
  return (
    <table className="w-full text-xs font-mono">
      <tbody>
        {Object.entries(headers).map(([k, v]) => (
          <tr key={k} className="border-b border-[#2a2a32]/50">
            <td className="py-0.5 pr-3 text-blue-300 whitespace-nowrap align-top w-1/3">{k}</td>
            <td className="py-0.5 text-gray-300 break-all">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// BodyViewer
// ──────────────────────────────────────────────────────────────────────────────

function BodyViewer({ body, contentType }: { body: string | null; contentType?: string | null }): JSX.Element {
  if (!body) return <p className="text-gray-600 text-xs italic">Empty body</p>

  const isBase64 = body.startsWith('base64:')
  if (isBase64) {
    return (
      <div className="text-xs text-gray-500 italic">
        Binary content ({body.length - 7} base64 chars) —{' '}
        <CopyButton text={body.slice(7)} className="inline-flex" />
      </div>
    )
  }

  // Try to pretty-print JSON
  const ct = contentType?.toLowerCase() ?? ''
  if (ct.includes('json')) {
    try {
      const parsed = JSON.parse(body)
      return (
        <pre className="text-xs text-gray-200 font-mono whitespace-pre-wrap break-all leading-relaxed">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      )
    } catch {
      // fall through to raw
    }
  }

  return (
    <pre className="text-xs text-gray-200 font-mono whitespace-pre-wrap break-all leading-relaxed">
      {body}
    </pre>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Inspector panel
// ──────────────────────────────────────────────────────────────────────────────

type InspectorTab = 'req-headers' | 'req-body' | 'res-headers' | 'res-body'

function Inspector({ request }: { request: ProxyRequest }): JSX.Element {
  const [tab, setTab] = useState<InspectorTab>('req-headers')

  const tabs: { id: InspectorTab; label: string }[] = [
    { id: 'req-headers', label: 'Req Headers' },
    { id: 'req-body',    label: 'Req Body' },
    { id: 'res-headers', label: 'Res Headers' },
    { id: 'res-body',    label: 'Res Body' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* URL bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2a2a32] bg-[#111114]">
        <span className={cn(
          'text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono uppercase',
          methodBadge(request.method)
        )}>
          {request.method}
        </span>
        <span className={cn('text-xs font-bold', statusColor(request.status_code))}>
          {request.status_code ?? '—'}
        </span>
        <span className="text-gray-400 text-xs font-mono flex-1 truncate">{request.url}</span>
        <CopyButton text={request.url} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#2a2a32] bg-[#0d0d10]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3 py-1.5 text-xs transition-colors',
              tab === t.id
                ? 'text-red-400 border-b border-red-500'
                : 'text-gray-500 hover:text-gray-300'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {tab === 'req-headers' && <HeadersTable headers={request.request_headers} />}
        {tab === 'req-body' && (
          <BodyViewer body={request.request_body} contentType={request.request_headers?.['content-type']} />
        )}
        {tab === 'res-headers' && <HeadersTable headers={request.response_headers} />}
        {tab === 'res-body' && (
          <BodyViewer body={request.response_body} contentType={request.content_type} />
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Main ProxyPage
// ──────────────────────────────────────────────────────────────────────────────

const METHODS = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']

export function ProxyPage(): JSX.Element {
  const { currentProject } = useProjectStore()
  const {
    status,
    requests,
    total,
    loading,
    selectedId,
    fetchStatus,
    startProxy,
    stopProxy,
    fetchRequests,
    clearRequests,
    appendRequest,
    setSelected,
  } = useProxyStore()

  const [port, setPort] = useState(8080)
  const [methodFilter, setMethodFilter] = useState('ALL')
  const [searchFilter, setSearchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const projectId = currentProject?.id ?? null

  // Show toast helper
  const toast = useCallback((msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }, [])

  // Initial load
  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    if (!projectId) return
    fetchRequests(projectId)
  }, [projectId, fetchRequests])

  // WebSocket for live traffic
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
          if (msg.type === 'proxy_request' && msg.project_id === projectId) {
            // We get a summary; fetch full details lazily or use the summary directly
            appendRequest(msg as ProxyRequest)
          }
        } catch {
          // ignore
        }
      }

      ws.onclose = () => {
        if (pingRef.current) clearInterval(pingRef.current)
        // reconnect after 3s
        setTimeout(connect, 3000)
      }
    }

    connect()
    return () => {
      wsRef.current?.close()
      if (pingRef.current) clearInterval(pingRef.current)
    }
  }, [projectId, appendRequest])

  // Filter requests client-side for instant response
  const filtered = useMemo(() => {
    let list = requests
    if (methodFilter !== 'ALL') {
      list = list.filter((r) => r.method === methodFilter)
    }
    if (searchFilter) {
      const q = searchFilter.toLowerCase()
      list = list.filter((r) => r.url.toLowerCase().includes(q) || r.host.toLowerCase().includes(q))
    }
    if (statusFilter) {
      const n = parseInt(statusFilter, 10)
      if (!isNaN(n)) list = list.filter((r) => r.status_code != null && Math.floor(r.status_code / 100) === Math.floor(n / 100))
    }
    return list
  }, [requests, methodFilter, searchFilter, statusFilter])

  const selected = useMemo(
    () => requests.find((r) => r.id === selectedId) ?? null,
    [requests, selectedId]
  )

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

  const handleClear = async () => {
    if (!projectId) return
    await clearRequests(projectId)
  }

  const handleRefresh = async () => {
    if (!projectId) return
    await fetchRequests(projectId, {
      method: methodFilter !== 'ALL' ? methodFilter : undefined,
      search: searchFilter || undefined,
    })
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
          status.running
            ? 'bg-green-500/10 text-green-400 border-green-500/25'
            : 'bg-gray-500/10 text-gray-500 border-gray-500/25'
        )}>
          <span className={cn(
            'w-1.5 h-1.5 rounded-full',
            status.running ? 'bg-green-400 animate-pulse' : 'bg-gray-600'
          )} />
          {status.running ? `Listening :${status.port}` : 'Stopped'}
        </div>

        <div className="flex-1" />

        {/* Port input */}
        {!status.running && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Port</span>
            <input
              type="number"
              value={port}
              min={1024}
              max={65535}
              onChange={(e) => setPort(parseInt(e.target.value) || 8080)}
              className="w-16 bg-[#1a1a1f] border border-[#2a2a32] rounded px-2 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-red-500/50"
            />
          </div>
        )}

        <button
          onClick={handleToggle}
          disabled={starting}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            status.running
              ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/25'
              : 'bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/25'
          )}
        >
          {status.running ? <Square size={13} /> : <Play size={13} />}
          {starting ? 'Starting…' : status.running ? 'Stop' : 'Start'}
        </button>

        <button
          onClick={handleRefresh}
          disabled={loading}
          className="p-1.5 rounded hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
        </button>

        <button
          onClick={handleClear}
          className="p-1.5 rounded hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors"
          title="Clear all traffic"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#2a2a32] bg-[#0f0f12] shrink-0">
        {/* Method chips */}
        <div className="flex items-center gap-1">
          {METHODS.map((m) => (
            <button
              key={m}
              onClick={() => setMethodFilter(m)}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-medium border transition-colors',
                methodFilter === m
                  ? 'bg-red-500/15 text-red-400 border-red-500/30'
                  : 'bg-transparent text-gray-500 border-[#2a2a32] hover:text-gray-300 hover:border-gray-600'
              )}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-[#2a2a32] mx-1" />

        {/* Status filter */}
        <input
          type="text"
          placeholder="Status (e.g. 2xx)"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-28 bg-[#1a1a1f] border border-[#2a2a32] rounded px-2 py-0.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-red-500/50"
        />

        {/* URL search */}
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search URL or host…"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-[#1a1a1f] border border-[#2a2a32] rounded px-2 py-0.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-red-500/50"
          />
          {searchFilter && (
            <button
              onClick={() => setSearchFilter('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
            >
              <X size={11} />
            </button>
          )}
        </div>

        <span className="text-xs text-gray-600 whitespace-nowrap">
          {filtered.length}/{total}
        </span>
      </div>

      {/* ── Main content: traffic list + inspector ── */}
      <div className="flex flex-1 min-h-0">

        {/* Traffic table */}
        <div className={cn(
          'flex flex-col border-r border-[#2a2a32] overflow-hidden',
          selected ? 'w-1/2' : 'flex-1'
        )}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600">
              <Globe size={32} strokeWidth={1} />
              {status.running ? (
                <p className="text-sm">Waiting for traffic…</p>
              ) : (
                <p className="text-sm">Start the proxy to capture HTTP/S traffic</p>
              )}
              {status.running && (
                <p className="text-xs text-gray-700">
                  Set your browser proxy to{' '}
                  <span className="text-gray-500 font-mono">127.0.0.1:{status.port}</span>
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
                    <tr
                      key={req.id}
                      onClick={() => setSelected(req.id === selectedId ? null : req.id)}
                      className={cn(
                        'border-b border-[#1a1a22] cursor-pointer transition-colors',
                        req.id === selectedId
                          ? 'bg-red-500/8 border-red-500/20'
                          : 'hover:bg-white/3'
                      )}
                    >
                      {/* Method */}
                      <td className="px-3 py-1.5">
                        <span className={cn(
                          'text-[10px] font-bold px-1 py-0.5 rounded border font-mono',
                          methodBadge(req.method)
                        )}>
                          {req.method}
                        </span>
                      </td>

                      {/* Status */}
                      <td className={cn('px-2 py-1.5 font-mono font-semibold', statusColor(req.status_code))}>
                        {req.status_code ?? '—'}
                      </td>

                      {/* Host */}
                      <td className="px-2 py-1.5 text-gray-300 font-mono truncate max-w-0">
                        <span className="truncate block">
                          {req.scheme === 'https' && (
                            <span className="text-green-500 mr-0.5">🔒</span>
                          )}
                          {req.host}
                          {req.port !== 80 && req.port !== 443 && (
                            <span className="text-gray-600">:{req.port}</span>
                          )}
                        </span>
                      </td>

                      {/* Path */}
                      <td className="px-2 py-1.5 text-gray-400 font-mono truncate max-w-0">
                        <span className="truncate block">{truncatePath(req.path)}</span>
                      </td>

                      {/* Size */}
                      <td className="px-2 py-1.5 text-gray-500 text-right">{formatSize(req.response_size)}</td>

                      {/* Duration */}
                      <td className="px-2 py-1.5 text-gray-500 text-right">{formatDuration(req.duration_ms)}</td>

                      {/* Timestamp */}
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
                <ChevronRight size={12} className="text-red-500" />
                Inspector
              </span>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-600 hover:text-gray-300 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <Inspector request={selected} />
            </div>
          </div>
        )}
      </div>

      {/* ── mitmproxy CA hint bar (when proxy is running) ── */}
      {status.running && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-t border-[#2a2a32] bg-[#111114] shrink-0">
          <span className="text-[10px] text-gray-600">
            To intercept HTTPS: install the mitmproxy CA cert from{' '}
            <span className="text-gray-500 font-mono">http://mitm.it</span>
            {' '}while your browser proxy points to{' '}
            <span className="text-gray-500 font-mono">127.0.0.1:{status.port}</span>
          </span>
        </div>
      )}
    </div>
  )
}
