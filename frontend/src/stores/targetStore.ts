import { create } from 'zustand'
import { targetsApi } from '@/services/api'
import type { Target, TargetType } from '@/types'

interface TargetState {
  targets: Target[]
  isLoading: boolean
  error: string | null
  projectId: string | null

  fetchTargets: (projectId: string) => Promise<void>
  addTarget: (projectId: string, value: string, type?: TargetType, notes?: string | null) => Promise<Target>
  removeTarget: (id: string) => Promise<void>
  clear: () => void
}

export const useTargetStore = create<TargetState>((set) => ({
  targets: [],
  isLoading: false,
  error: null,
  projectId: null,

  fetchTargets: async (projectId) => {
    set({ isLoading: true, error: null, projectId })
    try {
      const res = await targetsApi.list(projectId, { limit: 500 })
      set({ targets: res.items, isLoading: false })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false })
    }
  },

  addTarget: async (projectId, value, type, notes) => {
    const target = await targetsApi.create({ project_id: projectId, value, type, notes })
    set((s) => ({ targets: [...s.targets, target] }))
    return target
  },

  removeTarget: async (id) => {
    await targetsApi.delete(id)
    set((s) => ({ targets: s.targets.filter((t) => t.id !== id) }))
  },

  clear: () => set({ targets: [], projectId: null, error: null }),
}))
