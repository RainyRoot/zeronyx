import { create } from 'zustand'
import { scansApi } from '@/services/api'
import type { Scan, NmapProfile, Host, Port } from '@/types'

interface ScanResults {
  hosts: Host[]
  ports: Port[]
}

interface ScanState {
  // Scan history for active project
  scans: Scan[]
  isLoadingScans: boolean

  // Currently active scan session
  activeScan: Scan | null
  outputLines: string[]
  results: ScanResults | null
  isRunning: boolean

  // Profiles cache
  profiles: NmapProfile[]
  isLoadingProfiles: boolean

  // Errors
  error: string | null

  // Actions
  fetchScans: (projectId: string) => Promise<void>
  fetchProfiles: (tool: string) => Promise<void>
  startScan: (projectId: string, targetId: string | null, tool: string, profile: string | null, config: Record<string, unknown>) => Promise<Scan>
  cancelActiveScan: () => Promise<void>
  appendOutputLine: (line: string) => void
  setActiveScan: (scan: Scan | null) => void
  fetchResults: (scanId: string) => Promise<void>
  clearSession: () => void
  deleteScan: (id: string) => Promise<void>
}

export const useScanStore = create<ScanState>((set, get) => ({
  scans: [],
  isLoadingScans: false,
  activeScan: null,
  outputLines: [],
  results: null,
  isRunning: false,
  profiles: [],
  isLoadingProfiles: false,
  error: null,

  fetchScans: async (projectId) => {
    set({ isLoadingScans: true, error: null })
    try {
      const res = await scansApi.list(projectId, { limit: 100 })
      set({ scans: res.items, isLoadingScans: false })
    } catch (e) {
      set({ error: (e as Error).message, isLoadingScans: false })
    }
  },

  fetchProfiles: async (tool) => {
    set({ isLoadingProfiles: true })
    try {
      const res = await scansApi.getProfiles(tool)
      set({ profiles: res.profiles, isLoadingProfiles: false })
    } catch {
      set({ isLoadingProfiles: false })
    }
  },

  startScan: async (projectId, targetId, tool, profile, config) => {
    set({ error: null, outputLines: [], results: null })
    const scan = await scansApi.create({ project_id: projectId, tool, target_id: targetId, profile, config })
    const started = await scansApi.start(scan.id)
    set((s) => ({
      activeScan: started,
      isRunning: true,
      scans: [started, ...s.scans],
    }))
    return started
  },

  cancelActiveScan: async () => {
    const { activeScan } = get()
    if (!activeScan) return
    try {
      const updated = await scansApi.cancel(activeScan.id)
      set((s) => ({
        activeScan: updated,
        isRunning: false,
        scans: s.scans.map((sc) => sc.id === updated.id ? updated : sc),
      }))
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  appendOutputLine: (line) => {
    set((s) => ({ outputLines: [...s.outputLines, line] }))
  },

  setActiveScan: (scan) => {
    set({ activeScan: scan })
  },

  fetchResults: async (scanId) => {
    try {
      const res = await fetch(`http://127.0.0.1:8742/api/scans/${scanId}/results`)
      if (res.ok) {
        const data = await res.json() as { hosts: Host[]; ports: Port[] }
        set({ results: data })
      }
    } catch {
      // ignore
    }
  },

  clearSession: () => {
    set({ activeScan: null, outputLines: [], results: null, isRunning: false, error: null })
  },

  deleteScan: async (id) => {
    await scansApi.delete(id)
    set((s) => ({
      scans: s.scans.filter((sc) => sc.id !== id),
      activeScan: s.activeScan?.id === id ? null : s.activeScan,
    }))
  },
}))
