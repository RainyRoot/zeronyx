import { create } from 'zustand'
import type { Tab, PageId } from '@/types'

interface NavigationState {
  tabs: Tab[]
  activeTabId: string
  openTab: (pageId: PageId, label: string, path: string) => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
}

const DEFAULT_TABS: Tab[] = [
  { id: 'dashboard', pageId: 'dashboard', label: 'Dashboard', path: '/', closeable: false }
]

export const useNavigationStore = create<NavigationState>((set, get) => ({
  tabs: DEFAULT_TABS,
  activeTabId: 'dashboard',

  openTab: (pageId, label, path) => {
    const { tabs } = get()
    const existing = tabs.find((t) => t.pageId === pageId)
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }
    const tab: Tab = { id: pageId, pageId, label, path, closeable: true }
    set({ tabs: [...tabs, tab], activeTabId: tab.id })
  },

  closeTab: (id) => {
    const { tabs, activeTabId } = get()
    const idx = tabs.findIndex((t) => t.id === id)
    if (idx === -1) return
    const next = tabs.filter((t) => t.id !== id)
    let nextActive = activeTabId
    if (activeTabId === id) {
      nextActive = next[Math.max(0, idx - 1)]?.id ?? next[0]?.id ?? ''
    }
    set({ tabs: next, activeTabId: nextActive })
  },

  setActiveTab: (id) => set({ activeTabId: id })
}))
