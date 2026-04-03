import { create } from 'zustand'
import { backendBase } from '@/lib/backend'

const API = backendBase()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CensysStatus {
  connected: boolean
  has_credentials: boolean
  email: string | null
  quota: Record<string, unknown> | null
}

export interface CensysSoftware {
  product: string | null
  version: string | null
  vendor: string | null
}

export interface CensysService {
  port: number
  protocol: string
  service: string
  banner: string
  timestamp: string | null
  software: CensysSoftware[]
  labels: string[]
  http?: { status: number | null; title: string; headers: Record<string, string> }
  tls?: { subject_dn: string | null; issuer_dn: string | null; expires: string | null; cipher: string | null; version: string | null }
}

export interface CensysHost {
  ip: string
  services: CensysService[]
  ports: number[]
  country: string | null
  country_code: string | null
  city: string | null
  continent: string | null
  latitude: number | null
  longitude: number | null
  asn: number | null
  asn_name: string | null
  bgp_prefix: string | null
  description: string | null
  os: string | null
  os_version: string | null
  labels: string[]
  last_updated: string | null
}

export interface CensysMatch {
  ip: string
  country: string | null
  city: string | null
  ports: number[]
  services: string[]
  labels: string[]
  last_updated: string | null
}

export interface CensysSearchResult {
  total: number
  matches: CensysMatch[]
}

export interface CensysAggregateBucket {
  key: string
  count: number
}

export interface CensysAggregateResult {
  total: number
  buckets: CensysAggregateBucket[]
  field: string
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface CensysState {
  status: CensysStatus
  apiIdInput: string
  apiSecretInput: string
  connecting: boolean
  connectError: string | null

  hostQuery: string
  hostResult: CensysHost | null
  hostLoading: boolean
  hostError: string | null

  searchQuery: string
  searchResult: CensysSearchResult | null
  searchLoading: boolean
  searchError: string | null

  aggregateResult: CensysAggregateResult | null
  aggregateField: string

  activeTab: 'host' | 'search' | 'aggregate'

  setApiIdInput: (v: string) => void
  setApiSecretInput: (v: string) => void
  fetchStatus: () => Promise<void>
  connect: (id: string, secret: string) => Promise<boolean>
  disconnect: () => Promise<void>
  removeCredentials: () => Promise<void>
  setHostQuery: (q: string) => void
  viewHost: (ip: string) => Promise<void>
  setSearchQuery: (q: string) => void
  runSearch: (query: string) => Promise<void>
  runAggregate: (query: string, field?: string) => Promise<void>
  setAggregateField: (f: string) => void
  setActiveTab: (t: 'host' | 'search' | 'aggregate') => void
  clearHost: () => void
  clearSearch: () => void
}

const DEFAULT_STATUS: CensysStatus = {
  connected: false,
  has_credentials: false,
  email: null,
  quota: null,
}

export const useCensysStore = create<CensysState>((set, get) => ({
  status:          DEFAULT_STATUS,
  apiIdInput:      '',
  apiSecretInput:  '',
  connecting:      false,
  connectError:    null,

  hostQuery:   '',
  hostResult:  null,
  hostLoading: false,
  hostError:   null,

  searchQuery:   '',
  searchResult:  null,
  searchLoading: false,
  searchError:   null,

  aggregateResult: null,
  aggregateField:  'services.port',

  activeTab: 'host',

  setApiIdInput:     (v) => set({ apiIdInput: v }),
  setApiSecretInput: (v) => set({ apiSecretInput: v }),

  fetchStatus: async () => {
    try {
      const res = await fetch(`${API}/api/censys/status`)
      if (res.ok) set({ status: await res.json() })
    } catch { /* ignore */ }
  },

  connect: async (id, secret) => {
    set({ connecting: true, connectError: null })
    try {
      const res = await fetch(`${API}/api/censys/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_id: id, api_secret: secret }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        await get().fetchStatus()
        set({ connecting: false, apiIdInput: '', apiSecretInput: '' })
        return true
      } else {
        set({ connecting: false, connectError: data.detail ?? 'Connection failed' })
        return false
      }
    } catch (e) {
      set({ connecting: false, connectError: String(e) })
      return false
    }
  },

  disconnect: async () => {
    await fetch(`${API}/api/censys/disconnect`, { method: 'POST' })
    set((s) => ({ status: { ...s.status, connected: false } }))
  },

  removeCredentials: async () => {
    await fetch(`${API}/api/censys/credentials`, { method: 'DELETE' })
    set({ status: DEFAULT_STATUS, hostResult: null, searchResult: null, aggregateResult: null })
  },

  setHostQuery: (q) => set({ hostQuery: q }),

  viewHost: async (ip) => {
    const target = ip.trim()
    if (!target) return
    set({ hostLoading: true, hostError: null, hostResult: null, activeTab: 'host' })
    try {
      const res = await fetch(`${API}/api/censys/host/${encodeURIComponent(target)}`)
      if (res.ok) {
        set({ hostResult: await res.json(), hostLoading: false })
      } else {
        const err = await res.json()
        set({ hostError: err.detail ?? 'Lookup failed', hostLoading: false })
      }
    } catch (e) {
      set({ hostError: String(e), hostLoading: false })
    }
  },

  setSearchQuery: (q) => set({ searchQuery: q }),

  runSearch: async (query) => {
    if (!query.trim()) return
    set({ searchLoading: true, searchError: null, activeTab: 'search' })
    try {
      const qs = new URLSearchParams({ q: query, per_page: '100', pages: '1' })
      const res = await fetch(`${API}/api/censys/search?${qs}`)
      if (res.ok) {
        set({ searchResult: await res.json(), searchLoading: false })
      } else {
        const err = await res.json()
        set({ searchError: err.detail ?? 'Search failed', searchLoading: false })
      }
    } catch (e) {
      set({ searchError: String(e), searchLoading: false })
    }
  },

  runAggregate: async (query, field) => {
    const f = field ?? get().aggregateField
    if (!query.trim()) return
    set({ activeTab: 'aggregate' })
    try {
      const qs = new URLSearchParams({ q: query, field: f, buckets: '30' })
      const res = await fetch(`${API}/api/censys/aggregate?${qs}`)
      if (res.ok) set({ aggregateResult: await res.json() })
    } catch { /* ignore */ }
  },

  setAggregateField: (f) => set({ aggregateField: f }),
  setActiveTab: (t) => set({ activeTab: t }),
  clearHost: ()   => set({ hostResult: null, hostError: null }),
  clearSearch: () => set({ searchResult: null, searchError: null }),
}))
