import { create } from 'zustand'
import { backendBase } from '@/lib/backend'

const API = backendBase()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HostSummary {
  id: string
  project_id: string
  ip: string
  hostname: string | null
  os: string | null
  mac: string | null
  vendor: string | null
  state: string
  last_seen: string | null
  port_count: number
  open_port_numbers: number[]
  finding_counts: Record<string, number>
  finding_total: number
  credential_count: number
  tool_sources: string[]
  scan_count: number
}

export interface PortOut {
  id: string
  number: number
  protocol: string
  state: string
  service: string | null
  version: string | null
  banner: string | null
}

export interface FindingSummary {
  id: string
  title: string
  severity: string
  status: string
  cvss: number | null
  cve: string | null
  tool_source: string | null
  description: string | null
  created_at: string
}

export interface CredSummary {
  id: string
  service: string | null
  username: string | null
  password: string | null
  verified: boolean
}

export interface ScanSummary {
  id: string
  tool: string
  status: string
  started_at: string | null
  finished_at: string | null
}

export interface HostDetail extends HostSummary {
  os_accuracy: number | null
  ports: PortOut[]
  findings: FindingSummary[]
  credentials: CredSummary[]
  scans: ScanSummary[]
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface HostState {
  hosts: HostSummary[]
  total: number
  loading: boolean
  selectedId: string | null
  detail: HostDetail | null
  detailLoading: boolean
  search: string
  enriching: boolean
  enrichResult: string | null

  fetchHosts: (projectId: string) => Promise<void>
  fetchDetail: (hostId: string) => Promise<void>
  createHost: (projectId: string, ip: string, hostname?: string) => Promise<void>
  deleteHost: (id: string) => Promise<void>
  enrichFromShodan: (hostId: string) => Promise<void>
  setSelected: (id: string | null) => void
  setSearch: (q: string) => void
}

export const useHostStore = create<HostState>((set, get) => ({
  hosts:         [],
  total:         0,
  loading:       false,
  selectedId:    null,
  detail:        null,
  detailLoading: false,
  search:        '',
  enriching:     false,
  enrichResult:  null,

  fetchHosts: async (projectId) => {
    const { search } = get()
    set({ loading: true })
    try {
      const qs = new URLSearchParams({ project_id: projectId })
      if (search) qs.set('q', search)
      const res = await fetch(`${API}/api/hosts?${qs}`)
      if (res.ok) {
        const data = await res.json()
        set({ hosts: data.items, total: data.total, loading: false })
      } else {
        set({ loading: false })
      }
    } catch {
      set({ loading: false })
    }
  },

  fetchDetail: async (hostId) => {
    set({ detailLoading: true, detail: null })
    try {
      const res = await fetch(`${API}/api/hosts/${hostId}`)
      if (res.ok) set({ detail: await res.json(), detailLoading: false })
      else set({ detailLoading: false })
    } catch {
      set({ detailLoading: false })
    }
  },

  createHost: async (projectId, ip, hostname) => {
    try {
      const res = await fetch(`${API}/api/hosts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, ip: ip.trim(), hostname: hostname || null }),
      })
      if (res.ok) {
        const h: HostSummary = await res.json()
        set((s) => ({ hosts: [...s.hosts, h].sort((a, b) => a.ip.localeCompare(b.ip)), total: s.total + 1 }))
      }
    } catch { /* ignore */ }
  },

  deleteHost: async (id) => {
    try {
      await fetch(`${API}/api/hosts/${id}`, { method: 'DELETE' })
      set((s) => ({
        hosts: s.hosts.filter((h) => h.id !== id),
        total: s.total - 1,
        selectedId: s.selectedId === id ? null : s.selectedId,
        detail: s.detail?.id === id ? null : s.detail,
      }))
    } catch { /* ignore */ }
  },

  enrichFromShodan: async (hostId) => {
    set({ enriching: true, enrichResult: null })
    try {
      const res = await fetch(`${API}/api/hosts/${hostId}/enrich`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        const added = data.shodan_ports_added ?? 0
        set({ enrichResult: added > 0 ? `+${added} ports from Shodan` : 'No new ports found' })
        // Refresh detail
        await get().fetchDetail(hostId)
        // Update summary in list
        set((s) => ({
          hosts: s.hosts.map((h) => h.id === hostId
            ? { ...h, port_count: data.port_count, open_port_numbers: data.open_port_numbers }
            : h
          ),
        }))
      } else {
        const err = await res.json()
        set({ enrichResult: `Error: ${err.detail}` })
      }
    } catch (e) {
      set({ enrichResult: String(e) })
    }
    set({ enriching: false })
    setTimeout(() => set({ enrichResult: null }), 4000)
  },

  setSelected: (id) => {
    set({ selectedId: id })
    if (id) get().fetchDetail(id)
  },

  setSearch: (q) => set({ search: q }),
}))
