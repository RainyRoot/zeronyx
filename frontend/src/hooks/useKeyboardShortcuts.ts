/**
 * Global keyboard shortcuts for ZeroNyx.
 *
 * Ctrl/Cmd+W   — close active tab
 * Ctrl/Cmd+T   — open Scans page (new scan)
 * Ctrl/Cmd+K   — focus global search (future)
 * Ctrl/Cmd+,   — open Settings
 * Ctrl/Cmd+1…9 — switch to tab by index
 * Alt+←/→      — navigate tabs left/right
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNavigationStore } from '@/stores/navigationStore'

export function useKeyboardShortcuts() {
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey

      // Don't intercept shortcuts when typing in inputs
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      const { tabs, activeTabId, closeTab, setActiveTab, openTab } = useNavigationStore.getState()

      // Ctrl+W — close current tab
      if (mod && e.key === 'w') {
        e.preventDefault()
        const active = tabs.find((t) => t.id === activeTabId)
        if (active?.closeable) {
          const idx = tabs.findIndex((t) => t.id === active.id)
          closeTab(active.id)
          const remaining = tabs.filter((t) => t.id !== active.id)
          const next = remaining[Math.max(0, idx - 1)] ?? remaining[0]
          if (next) {
            setActiveTab(next.id)
            navigate(next.path)
          }
        }
        return
      }

      // Ctrl+T — open Scans (new scan)
      if (mod && e.key === 't') {
        e.preventDefault()
        openTab('scans', 'Scans', '/scans')
        navigate('/scans')
        return
      }

      // Ctrl+, — open Settings
      if (mod && e.key === ',') {
        e.preventDefault()
        openTab('settings', 'Settings', '/settings')
        navigate('/settings')
        return
      }

      // Ctrl+1…9 — switch to tab by index
      if (mod && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const idx = parseInt(e.key, 10) - 1
        const tab = tabs[idx]
        if (tab) {
          setActiveTab(tab.id)
          navigate(tab.path)
        }
        return
      }

      // Alt+← — previous tab
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault()
        const idx = tabs.findIndex((t) => t.id === activeTabId)
        const prev = tabs[idx - 1]
        if (prev) {
          setActiveTab(prev.id)
          navigate(prev.path)
        }
        return
      }

      // Alt+→ — next tab
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault()
        const idx = tabs.findIndex((t) => t.id === activeTabId)
        const next = tabs[idx + 1]
        if (next) {
          setActiveTab(next.id)
          navigate(next.path)
        }
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])
}
