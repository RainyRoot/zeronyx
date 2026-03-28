import { create } from 'zustand'

const API = 'http://127.0.0.1:8742'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShodanStatus {
  connected: boolean
  has_key: boolean
  plan: string | null
  query_credits: number | null
  scan_credits: number | null
}

export interface ShodanService {
  port: number
  transport: string
  product: string | null
  version: string | null
  cpe: string[]
  banner: string
  timestamp: string
  vulns: string[]
  http?: { title: string | null; server: string | null; status: number | null }
  ssl?: { subject: Record<string, string>; issuer: Record<string, string>; expires: string | null; cipher: string | null }
}

export interface ShodanVuln {
  cve: string
  cvss: number | null
  summary: string
  port: number | null
}

export interface ShodanHost {
  ip: string
  org: string | null
  isp: string | null
  asn: string | null
  country: string | null
  country_code: string | null
  city: string | null
  region: string | null
  latitude: number | null
  longitude: number | null
  os: string | null
  hostnames: string[]
  domains: string[]
  tags: string[]
  ports: number[]
  vulns: string[]
  last_update: string | null
  services: ShodanService[]
  all_vulns: ShodanVuln[]
}

export interface ShodanMatch {
  ip: string
  port: number
  transport: string
  org: string | null
  isp: string | null
  country: string | null
  city: string | null
  hostnames: string[]
  os: string | null
  product: string | null
  version: string | null
  banner: string
  timestamp: string
  vulns: string[]
  tags: string[]
}

export interface ShodanSearchResult {
  total: number
  matches: ShodanMatch[]
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface ShodanState {
  status: ShodanStatus
  apiKeyInput: string
  connecting: boolean
  connectError: string | null

  // Host lookup
  hostQuery: string
  hostResult: ShodanHost | null
  hostLoading: boolean
  hostError: string | null

  // Search
  searchQuery: string
  searchResult: ShodanSearchResult | null
  searchLoading: boolean
  searchError: string | null
  searchPage: number

  // Count (free)
  countResult: number | null

  // Tab
  activeTab: 'host' | 'search'

  // Actions
  setApiKeyInput: (v: string) => void
  fetchStatus: () => Promise<void>
  connect: (key: string) => Promise<boolean>
  disconnect: () => Promise<void>
  removeKey: () => Promise<void>
  setHostQuery: (q: string) => void
  lookupHost: (ip: string) => Promise<void>
  setSearchQuery: (q: string) => void
  runSearch: (query: string, page?: number) => Promise<void>
  runCount: (query: string) => Promise<void>
  setActiveTab: (t: 'host' | 'search') => void
  clearHost: () => void
  clearSearch: () => void
}

const DEFAULT_STATUS: ShodanStatus = {
  connected: false,
  has_key: false,
  plan: null,
  query_credits: null,
  scan_credits: null,
}

export const useShodanStore = create<ShodanState>((set, get) => ({
  status:        DEFAULT_STATUS,
  apiKeyInput:   '',
  connecting:    false,
  connectError:  null,

  hostQuery:   '',
  hostResult:  null,
  hostLoading: false,
  hostError:   null,

  searchQuery:   '',
  searchResult:  null,
  searchLoading: false,
  searchError:   null,
  searchPage:    1,

  countResult: null,
  activeTab:   'host',

  setApiKeyInput: (v) => set({ apiKeyInput: v }),

  fetchStatus: async () => {
    try {
      const res = await fetch(`${API}/api/shodan/status`)
      if (res.ok) set({ status: await res.json() })
    } catch { /* ignore */ }
  },

  connect: async (key) => {
    set({ connecting: true, connectError: null })
    try {
      const res = await fetch(`${API}/api/shodan/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: key }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        await get().fetchStatus()
        set({ connecting: false, apiKeyInput: '' })
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
    await fetch(`${API}/api/shodan/disconnect`, { method: 'POST' })
    set((s) => ({ status: { ...s.status, connected: false } }))
  },

  removeKey: async () => {
    await fetch(`${API}/api/shodan/key`, { method: 'DELETE' })
    set({ status: DEFAULT_STATUS, hostResult: null, searchResult: null })
  },

  setHostQuery: (q) => set({ hostQuery: q }),

  lookupHost: async (ip) => {
    const target = ip.trim()
    if (!target) return
    set({ hostLoading: true, hostError: null, hostResult: null, activeTab: 'host' })
    try {
      const res = await fetch(`${API}/api/shodan/host/${encodeURIComponent(target)}`)
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

  runSearch: async (query, page = 1) => {
    if (!query.trim()) return
    set({ searchLoading: true, searchError: null, searchPage: page, activeTab: 'search' })
    try {
      const qs = new URLSearchParams({ q: query, page: String(page), limit: '100' })
      const res = await fetch(`${API}/api/shodan/search?${qs}`)
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

  runCount: async (query) => {
    if (!query.trim()) return
    try {
      const res = await fetch(`${API}/api/shodan/count?q=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data = await res.json()
        set({ countResult: data.total ?? null })
      }
    } catch { /* ignore */ }
  },

  setActiveTab: (t) => set({ activeTab: t }),
  clearHost: ()   => set({ hostResult: null, hostError: null }),
  clearSearch: () => set({ searchResult: null, searchError: null }),
}))
