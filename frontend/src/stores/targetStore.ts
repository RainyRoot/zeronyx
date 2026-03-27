import { create } from 'zustand'
import { targetsApi } from '@/services/api'
import type { Target, TargetType } from '@/types'

export interface BulkEntry {
  value: string
  type: TargetType
  notes: string | null
  tags: string | null
}

interface TargetState {
  targets: Target[]
  isLoading: boolean
  error: string | null
  projectId: string | null

  fetchTargets: (projectId: string) => Promise<void>
  addTarget: (projectId: string, value: string, type?: TargetType, notes?: string | null, tags?: string | null) => Promise<Target>
  bulkAddTargets: (projectId: string, entries: BulkEntry[]) => Promise<{ added: number; failed: number }>
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

  addTarget: async (projectId, value, type, notes, tags) => {
    const target = await targetsApi.create({ project_id: projectId, value, type, notes, tags })
    set((s) => ({ targets: [...s.targets, target] }))
    return target
  },

  bulkAddTargets: async (projectId, entries) => {
    let added = 0
    let failed = 0
    const created: Target[] = []
    for (const entry of entries) {
      try {
        const t = await targetsApi.create({
          project_id: projectId,
          value: entry.value,
          type: entry.type,
          notes: entry.notes,
          tags: entry.tags,
        })
        created.push(t)
        added++
      } catch {
        failed++
      }
    }
    set((s) => ({ targets: [...s.targets, ...created] }))
    return { added, failed }
  },

  removeTarget: async (id) => {
    await targetsApi.delete(id)
    set((s) => ({ targets: s.targets.filter((t) => t.id !== id) }))
  },

  clear: () => set({ targets: [], projectId: null, error: null }),
}))
