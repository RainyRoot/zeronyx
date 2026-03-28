import { create } from 'zustand'
import type { ProxyRequest, ProxyStatus } from '@/types'

const API = 'http://127.0.0.1:8742'

// ── Intercept pending flow (from WS or /intercept/pending) ──────────────────

export interface PendingFlow {
  flow_id: string
  method: string
  scheme: string
  host: string
  port: number
  path: string
  url: string
  headers: Record<string, string>
  body: string | null
}

// ── Replay result ─────────────────────────────────────────────────────────────

export interface ReplayResult {
  id: string
  status_code: number
  response_headers: Record<string, string>
  response_body: string | null
  content_type: string | null
  response_size: number
  duration_ms: number
}

// ── Store ──────────────────────────────────────────────────────────────────────

interface ProxyState {
  status: ProxyStatus
  requests: ProxyRequest[]
  total: number
  loading: boolean
  error: string | null
  selectedId: string | null

  // Intercept
  interceptEnabled: boolean
  interceptFilter: string
  pendingFlows: PendingFlow[]

  // Replay
  replayTarget: ProxyRequest | null   // request to replay (opens modal)
  replayResult: ReplayResult | null
  replaying: boolean

  // Actions
  fetchStatus: () => Promise<void>
  startProxy: (port: number, projectId: string) => Promise<{ ok: boolean; error?: string }>
  stopProxy: () => Promise<{ ok: boolean; error?: string }>
  fetchRequests: (projectId: string, params?: FetchParams) => Promise<void>
  clearRequests: (projectId: string) => Promise<void>
  deleteRequest: (projectId: string, requestId: string) => Promise<void>
  appendRequest: (req: ProxyRequest) => void
  setSelected: (id: string | null) => void

  // Intercept
  toggleIntercept: (enabled: boolean, filter?: string) => Promise<void>
  fetchPending: () => Promise<void>
  forwardFlow: (flowId: string, modifications?: FlowModifications) => Promise<void>
  dropFlow: (flowId: string) => Promise<void>
  appendPending: (flow: PendingFlow) => void
  removePending: (flowId: string) => void
  setInterceptFilter: (f: string) => void

  // Replay
  openReplay: (req: ProxyRequest) => void
  closeReplay: () => void
  sendReplay: (projectId: string, method: string, url: string, headers: Record<string, string>, body: string | null) => Promise<void>
}

export interface FlowModifications {
  method?: string
  path?: string
  headers?: Record<string, string>
  body?: string
}

interface FetchParams {
  skip?: number
  limit?: number
  method?: string
  host?: string
  search?: string
  statusMin?: number
  statusMax?: number
}

export const useProxyStore = create<ProxyState>((set, get) => ({
  status: { running: false, port: 8080, project_id: null },
  requests: [],
  total: 0,
  loading: false,
  error: null,
  selectedId: null,

  interceptEnabled: false,
  interceptFilter: '',
  pendingFlows: [],

  replayTarget: null,
  replayResult: null,
  replaying: false,

  // ── Status & lifecycle ─────────────────────────────────────────────────────

  fetchStatus: async () => {
    try {
      const res = await fetch(`${API}/api/proxy/status`)
      if (res.ok) {
        const data = await res.json()
        set({
          status: data,
          interceptEnabled: data.intercept_enabled ?? false,
          interceptFilter: data.intercept_filter ?? '',
        })
      }
    } catch { /* ignore */ }
  },

  startProxy: async (port, projectId) => {
    try {
      const res = await fetch(`${API}/api/proxy/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port, project_id: projectId }),
      })
      const data = await res.json()
      if (data.ok) set({ status: { running: true, port, project_id: projectId } })
      return data
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  },

  stopProxy: async () => {
    try {
      const res = await fetch(`${API}/api/proxy/stop`, { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        set((s) => ({
          status: { ...s.status, running: false },
          interceptEnabled: false,
          pendingFlows: [],
        }))
      }
      return data
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  },

  // ── Traffic ────────────────────────────────────────────────────────────────

  fetchRequests: async (projectId, params = {}) => {
    set({ loading: true, error: null })
    try {
      const qs = new URLSearchParams()
      if (params.skip != null) qs.set('skip', String(params.skip))
      if (params.limit != null) qs.set('limit', String(params.limit))
      if (params.method) qs.set('method', params.method)
      if (params.host) qs.set('host', params.host)
      if (params.search) qs.set('search', params.search)
      if (params.statusMin != null) qs.set('status_min', String(params.statusMin))
      if (params.statusMax != null) qs.set('status_max', String(params.statusMax))
      const res = await fetch(`${API}/api/proxy/requests/${projectId}?${qs}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      set({ requests: data.items, total: data.total, loading: false })
    } catch (e) {
      set({ loading: false, error: String(e) })
    }
  },

  clearRequests: async (projectId) => {
    await fetch(`${API}/api/proxy/requests/${projectId}`, { method: 'DELETE' })
    set({ requests: [], total: 0, selectedId: null })
  },

  deleteRequest: async (projectId, requestId) => {
    await fetch(`${API}/api/proxy/requests/${projectId}/${requestId}`, { method: 'DELETE' })
    set((s) => ({
      requests: s.requests.filter((r) => r.id !== requestId),
      total: Math.max(0, s.total - 1),
      selectedId: s.selectedId === requestId ? null : s.selectedId,
    }))
  },

  appendRequest: (req) =>
    set((s) => ({
      requests: [req, ...s.requests].slice(0, 1000),
      total: s.total + 1,
    })),

  setSelected: (id) => set({ selectedId: id }),

  // ── Intercept ──────────────────────────────────────────────────────────────

  toggleIntercept: async (enabled, filter = '') => {
    try {
      await fetch(`${API}/api/proxy/intercept/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, filter }),
      })
      set({ interceptEnabled: enabled, interceptFilter: filter })
      if (!enabled) set({ pendingFlows: [] })
    } catch { /* ignore */ }
  },

  fetchPending: async () => {
    try {
      const res = await fetch(`${API}/api/proxy/intercept/pending`)
      if (res.ok) set({ pendingFlows: await res.json() })
    } catch { /* ignore */ }
  },

  forwardFlow: async (flowId, modifications) => {
    await fetch(`${API}/api/proxy/intercept/${flowId}/forward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modifications: modifications ?? null }),
    })
    set((s) => ({ pendingFlows: s.pendingFlows.filter((f) => f.flow_id !== flowId) }))
  },

  dropFlow: async (flowId) => {
    await fetch(`${API}/api/proxy/intercept/${flowId}/drop`, { method: 'POST' })
    set((s) => ({ pendingFlows: s.pendingFlows.filter((f) => f.flow_id !== flowId) }))
  },

  appendPending: (flow) =>
    set((s) => ({
      pendingFlows: [flow, ...s.pendingFlows].slice(0, 50),
    })),

  removePending: (flowId) =>
    set((s) => ({ pendingFlows: s.pendingFlows.filter((f) => f.flow_id !== flowId) })),

  setInterceptFilter: (f) => set({ interceptFilter: f }),

  // ── Replay ─────────────────────────────────────────────────────────────────

  openReplay: (req) => set({ replayTarget: req, replayResult: null }),
  closeReplay: () => set({ replayTarget: null, replayResult: null }),

  sendReplay: async (projectId, method, url, headers, body) => {
    set({ replaying: true, replayResult: null })
    try {
      const res = await fetch(`${API}/api/proxy/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, method, url, headers, body }),
      })
      const data = await res.json()
      if (data.ok) {
        set({ replayResult: data, replaying: false })
      } else {
        set({ replaying: false, error: data.error ?? 'Replay failed' })
      }
    } catch (e) {
      set({ replaying: false, error: String(e) })
    }
  },
}))
