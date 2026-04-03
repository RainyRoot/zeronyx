import { create } from 'zustand'
import type { MsfModule, MsfModuleInfo, MsfStatus } from '@/types'
import { backendBase } from '@/lib/backend'

const API = backendBase()

interface MetasploitState {
  // Connection
  status: MsfStatus
  connecting: boolean
  connectError: string | null

  // Module browser
  modules: MsfModule[]
  searchQuery: string
  typeFilter: string
  searching: boolean

  // Selected module detail
  selectedModule: MsfModuleInfo | null
  loadingInfo: boolean

  // Module option values (user-edited)
  optionValues: Record<string, string>

  // Actions
  fetchStatus: () => Promise<void>
  connect: (host: string, port: number, password: string, ssl: boolean) => Promise<boolean>
  disconnect: () => Promise<void>
  searchModules: (query: string, type?: string) => Promise<void>
  loadModuleInfo: (modType: string, modName: string) => Promise<void>
  setOptionValue: (name: string, value: string) => void
  resetOptions: () => void
  setSearchQuery: (q: string) => void
  setTypeFilter: (t: string) => void
}

export const useMetasploitStore = create<MetasploitState>((set, get) => ({
  status: { connected: false, host: '127.0.0.1', port: 55553, ssl: true, version: null },
  connecting: false,
  connectError: null,

  modules: [],
  searchQuery: '',
  typeFilter: '',
  searching: false,

  selectedModule: null,
  loadingInfo: false,

  optionValues: {},

  fetchStatus: async () => {
    try {
      const res = await fetch(`${API}/api/metasploit/status`)
      if (res.ok) set({ status: await res.json() })
    } catch { /* ignore */ }
  },

  connect: async (host, port, password, ssl) => {
    set({ connecting: true, connectError: null })
    try {
      const res = await fetch(`${API}/api/metasploit/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, port, password, ssl }),
      })
      const data = await res.json()
      if (data.ok) {
        set({ connecting: false, status: { connected: true, host, port, ssl, version: null } })
        // Refresh status to get version
        await get().fetchStatus()
        return true
      } else {
        set({ connecting: false, connectError: data.error ?? 'Connection failed' })
        return false
      }
    } catch (e) {
      set({ connecting: false, connectError: String(e) })
      return false
    }
  },

  disconnect: async () => {
    await fetch(`${API}/api/metasploit/disconnect`, { method: 'POST' })
    set((s) => ({
      status: { ...s.status, connected: false, version: null },
      modules: [],
      selectedModule: null,
    }))
  },

  searchModules: async (query, type) => {
    set({ searching: true, searchQuery: query, typeFilter: type ?? '' })
    try {
      const qs = new URLSearchParams({ q: query })
      if (type) qs.set('type', type)
      const res = await fetch(`${API}/api/metasploit/search?${qs}`)
      if (res.ok) set({ modules: await res.json() })
    } catch { /* ignore */ }
    set({ searching: false })
  },

  loadModuleInfo: async (modType, modName) => {
    set({ loadingInfo: true, selectedModule: null, optionValues: {} })
    try {
      const res = await fetch(`${API}/api/metasploit/module/${modType}/${modName}`)
      if (res.ok) {
        const info: MsfModuleInfo = await res.json()
        // Pre-fill option values with defaults
        const vals: Record<string, string> = {}
        for (const [k, opt] of Object.entries(info.options)) {
          vals[k] = String(opt.default ?? '')
        }
        set({ selectedModule: info, optionValues: vals, loadingInfo: false })
      } else {
        set({ loadingInfo: false })
      }
    } catch {
      set({ loadingInfo: false })
    }
  },

  setOptionValue: (name, value) =>
    set((s) => ({ optionValues: { ...s.optionValues, [name]: value } })),

  resetOptions: () => {
    const { selectedModule } = get()
    if (!selectedModule) return
    const vals: Record<string, string> = {}
    for (const [k, opt] of Object.entries(selectedModule.options)) {
      vals[k] = String(opt.default ?? '')
    }
    set({ optionValues: vals })
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
  setTypeFilter: (t) => set({ typeFilter: t }),
}))
