import { create } from 'zustand'

const API = 'http://127.0.0.1:8742'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type FindingStatus   = 'open' | 'confirmed' | 'false_positive' | 'resolved'

export interface Finding {
  id: string
  project_id: string
  scan_id: string | null
  host_id: string | null
  title: string
  severity: FindingSeverity
  cvss: number | null
  cve: string | null
  description: string | null
  remediation: string | null
  tool_source: string | null
  status: FindingStatus
  created_at: string
  updated_at: string
  host_ip: string | null
  scan_tool: string | null
}

export interface FindingStats {
  total: number
  by_severity: Record<string, number>
  by_tool: Record<string, number>
  by_status: Record<string, number>
}

export interface FindingFilters {
  severity: string
  tool: string
  status: string
  search: string
}

interface FindingState {
  findings: Finding[]
  total: number
  loading: boolean
  stats: FindingStats | null
  selectedId: string | null
  filters: FindingFilters

  fetchFindings: (projectId: string) => Promise<void>
  fetchStats: (projectId: string) => Promise<void>
  createFinding: (payload: {
    project_id: string
    title: string
    severity: string
    cvss?: number | null
    cve?: string | null
    description?: string | null
    remediation?: string | null
    tool_source?: string | null
  }) => Promise<Finding | null>
  updateFinding: (id: string, patch: Partial<Pick<Finding, 'title' | 'severity' | 'status' | 'cvss' | 'cve' | 'description' | 'remediation'>>) => Promise<void>
  deleteFinding: (id: string) => Promise<void>
  setFilter: <K extends keyof FindingFilters>(key: K, value: FindingFilters[K]) => void
  setSelected: (id: string | null) => void
  clearFilters: () => void
}

const EMPTY_FILTERS: FindingFilters = { severity: '', tool: '', status: '', search: '' }

export const useFindingStore = create<FindingState>((set, get) => ({
  findings:  [],
  total:     0,
  loading:   false,
  stats:     null,
  selectedId: null,
  filters:   { ...EMPTY_FILTERS },

  fetchFindings: async (projectId) => {
    const { filters } = get()
    set({ loading: true })
    try {
      const qs = new URLSearchParams({ project_id: projectId, limit: '500' })
      if (filters.severity) qs.set('severity', filters.severity)
      if (filters.tool)     qs.set('tool', filters.tool)
      if (filters.status)   qs.set('status', filters.status)
      if (filters.search)   qs.set('q', filters.search)

      const res = await fetch(`${API}/api/findings?${qs}`)
      if (res.ok) {
        const data = await res.json()
        set({ findings: data.items, total: data.total, loading: false })
      } else {
        set({ loading: false })
      }
    } catch {
      set({ loading: false })
    }
  },

  fetchStats: async (projectId) => {
    try {
      const res = await fetch(`${API}/api/findings/stats?project_id=${projectId}`)
      if (res.ok) set({ stats: await res.json() })
    } catch { /* ignore */ }
  },

  createFinding: async (payload) => {
    try {
      const res = await fetch(`${API}/api/findings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const f: Finding = await res.json()
        set((s) => ({ findings: [f, ...s.findings], total: s.total + 1 }))
        return f
      }
    } catch { /* ignore */ }
    return null
  },

  updateFinding: async (id, patch) => {
    try {
      const res = await fetch(`${API}/api/findings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (res.ok) {
        const updated: Finding = await res.json()
        set((s) => ({
          findings: s.findings.map((f) => f.id === id ? updated : f),
        }))
      }
    } catch { /* ignore */ }
  },

  deleteFinding: async (id) => {
    try {
      await fetch(`${API}/api/findings/${id}`, { method: 'DELETE' })
      set((s) => ({
        findings: s.findings.filter((f) => f.id !== id),
        total: s.total - 1,
        selectedId: s.selectedId === id ? null : s.selectedId,
      }))
    } catch { /* ignore */ }
  },

  setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),

  setSelected: (id) => set({ selectedId: id }),

  clearFilters: () => set({ filters: { ...EMPTY_FILTERS } }),
}))
