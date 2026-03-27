import { create } from 'zustand'
import type { ProxyRequest, ProxyStatus } from '@/types'

const API = 'http://127.0.0.1:8742'

interface ProxyState {
  // Proxy daemon status
  status: ProxyStatus
  // Traffic log
  requests: ProxyRequest[]
  total: number
  loading: boolean
  error: string | null
  // Selected request for inspector
  selectedId: string | null

  // Actions
  fetchStatus: () => Promise<void>
  startProxy: (port: number, projectId: string) => Promise<{ ok: boolean; error?: string }>
  stopProxy: () => Promise<{ ok: boolean; error?: string }>
  fetchRequests: (projectId: string, params?: FetchParams) => Promise<void>
  clearRequests: (projectId: string) => Promise<void>
  deleteRequest: (projectId: string, requestId: string) => Promise<void>
  appendRequest: (req: ProxyRequest) => void
  setSelected: (id: string | null) => void
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

  fetchStatus: async () => {
    try {
      const res = await fetch(`${API}/api/proxy/status`)
      if (res.ok) set({ status: await res.json() })
    } catch {
      // ignore — backend may not be up yet
    }
  },

  startProxy: async (port, projectId) => {
    try {
      const res = await fetch(`${API}/api/proxy/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port, project_id: projectId }),
      })
      const data = await res.json()
      if (data.ok) {
        set({ status: { running: true, port, project_id: projectId } })
      }
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
        set((s) => ({ status: { ...s.status, running: false } }))
      }
      return data
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  },

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

  appendRequest: (req) => {
    set((s) => ({
      requests: [req, ...s.requests].slice(0, 1000),
      total: s.total + 1,
    }))
  },

  setSelected: (id) => set({ selectedId: id }),
}))
