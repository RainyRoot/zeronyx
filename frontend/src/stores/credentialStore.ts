import { create } from 'zustand'
import { credentialsApi } from '@/services/api'
import type { Credential } from '@/types'

interface CredentialState {
  credentials: Credential[]
  isLoading: boolean
  error: string | null

  fetchCredentials: (projectId: string) => Promise<void>
  addCredential: (payload: {
    project_id: string
    service?: string | null
    username?: string | null
    password?: string | null
    hash?: string | null
    hash_type?: string | null
  }) => Promise<Credential>
  toggleVerified: (id: string, verified: boolean) => Promise<void>
  deleteCredential: (id: string) => Promise<void>
  importFromScan: (scanId: string, projectId: string) => Promise<{ imported: number; skipped: number }>
}

export const useCredentialStore = create<CredentialState>((set, get) => ({
  credentials: [],
  isLoading: false,
  error: null,

  fetchCredentials: async (projectId) => {
    set({ isLoading: true, error: null })
    try {
      const res = await credentialsApi.list(projectId, { limit: 1000 })
      set({ credentials: res.items, isLoading: false })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false })
    }
  },

  addCredential: async (payload) => {
    const cred = await credentialsApi.create(payload)
    set((s) => ({ credentials: [cred, ...s.credentials] }))
    return cred
  },

  toggleVerified: async (id, verified) => {
    const updated = await credentialsApi.update(id, { verified })
    set((s) => ({
      credentials: s.credentials.map((c) => (c.id === id ? updated : c)),
    }))
  },

  deleteCredential: async (id) => {
    await credentialsApi.delete(id)
    set((s) => ({ credentials: s.credentials.filter((c) => c.id !== id) }))
  },

  importFromScan: async (scanId, projectId) => {
    const result = await credentialsApi.importFromScan(scanId, projectId)
    if (result.imported > 0) {
      await get().fetchCredentials(projectId)
    }
    return result
  },
}))
