import { create } from 'zustand'
import { pluginsApi } from '@/services/api'
import type { Plugin, PluginUiSlot } from '@/types'

interface PluginStore {
  plugins: Plugin[]
  loading: boolean
  error: string | null

  fetchPlugins: () => Promise<void>
  installFile: (file: File) => Promise<void>
  installDir: (path: string) => Promise<void>
  uninstall: (id: string) => Promise<void>
  toggle: (id: string, enabled: boolean) => Promise<void>
  grantPermissions: (id: string, granted: boolean) => Promise<void>
  updateSettings: (id: string, values: Record<string, unknown>) => Promise<void>

  // Helpers
  getSlotPlugins: (slot: PluginUiSlot) => Plugin[]
  activePlugins: () => Plugin[]
}

export const usePluginStore = create<PluginStore>((set, get) => ({
  plugins: [],
  loading: false,
  error: null,

  fetchPlugins: async () => {
    set({ loading: true, error: null })
    try {
      const plugins = await pluginsApi.list()
      set({ plugins, loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  installFile: async (file: File) => {
    set({ loading: true, error: null })
    try {
      const plugin = await pluginsApi.installFromFile(file)
      set((s) => ({ plugins: [...s.plugins.filter((p) => p.id !== plugin.id), plugin], loading: false }))
    } catch (err) {
      set({ error: String(err), loading: false })
      throw err
    }
  },

  installDir: async (path: string) => {
    set({ loading: true, error: null })
    try {
      const plugin = await pluginsApi.installDir(path)
      set((s) => ({ plugins: [...s.plugins.filter((p) => p.id !== plugin.id), plugin], loading: false }))
    } catch (err) {
      set({ error: String(err), loading: false })
      throw err
    }
  },

  uninstall: async (id: string) => {
    await pluginsApi.uninstall(id)
    set((s) => ({ plugins: s.plugins.filter((p) => p.id !== id) }))
  },

  toggle: async (id: string, enabled: boolean) => {
    const updated = await pluginsApi.toggle(id, enabled)
    set((s) => ({ plugins: s.plugins.map((p) => (p.id === id ? updated : p)) }))
  },

  grantPermissions: async (id: string, granted: boolean) => {
    const updated = await pluginsApi.grantPermissions(id, granted)
    set((s) => ({ plugins: s.plugins.map((p) => (p.id === id ? updated : p)) }))
  },

  updateSettings: async (id: string, values: Record<string, unknown>) => {
    const updated = await pluginsApi.updateSettings(id, values)
    set((s) => ({ plugins: s.plugins.map((p) => (p.id === id ? updated : p)) }))
  },

  getSlotPlugins: (slot: PluginUiSlot) =>
    get().plugins.filter(
      (p) => p.enabled && p.permissions_granted && p.ui_slots.includes(slot)
    ),

  activePlugins: () =>
    get().plugins.filter((p) => p.enabled && p.permissions_granted),
}))
