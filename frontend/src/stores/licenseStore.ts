import { create } from 'zustand'
import { backendBase } from '@/lib/backend'

const BASE = backendBase()

export interface LicenseStatus {
  activated: boolean
  tier: 'community' | 'pro' | 'enterprise'
  email: string
  key_id: string
  features: string[]
  machine_id: string
  issued_at: string | null
  expires_at: string | null
  is_expired: boolean
}

interface LicenseStore {
  status: LicenseStatus | null
  loading: boolean
  error: string | null

  fetch: () => Promise<void>
  activate: (key: string) => Promise<void>
  deactivate: () => Promise<void>
}

const DEFAULT_COMMUNITY: LicenseStatus = {
  activated: false,
  tier: 'community',
  email: '',
  key_id: '',
  features: [],
  machine_id: '',
  issued_at: null,
  expires_at: null,
  is_expired: false,
}

export const useLicenseStore = create<LicenseStore>((set) => ({
  status: null,
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${BASE}/api/license/status`)
      if (!res.ok) throw new Error('Failed to fetch license status')
      const data: LicenseStatus = await res.json()
      set({ status: data })
    } catch {
      set({ status: DEFAULT_COMMUNITY })
    } finally {
      set({ loading: false })
    }
  },

  activate: async (key: string) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${BASE}/api/license/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail ?? 'Activation failed')
      }
      const data: LicenseStatus = await res.json()
      set({ status: data })
    } catch (e) {
      set({ error: (e as Error).message })
      throw e
    } finally {
      set({ loading: false })
    }
  },

  deactivate: async () => {
    set({ loading: true, error: null })
    try {
      await fetch(`${BASE}/api/license/deactivate`, { method: 'DELETE' })
      set({ status: DEFAULT_COMMUNITY })
    } finally {
      set({ loading: false })
    }
  },
}))

// Convenience selectors
export const useIsPro = () => {
  const tier = useLicenseStore((s) => s.status?.tier)
  return tier === 'pro' || tier === 'enterprise'
}

export const useHasFeature = (feature: string) => {
  const status = useLicenseStore((s) => s.status)
  if (!status?.activated) return false
  return status.features.includes(feature) || status.tier === 'enterprise'
}
