/**
 * Keyboard shortcuts reference modal.
 * Opens on pressing '?' (when not in an input).
 */

import { useEffect, useState } from 'react'
import { Keyboard, X } from 'lucide-react'

const SHORTCUTS = [
  { section: 'Navigation', items: [
    { keys: ['Ctrl', 'T'], desc: 'Open Scans (new scan)' },
    { keys: ['Ctrl', ','], desc: 'Open Settings' },
    { keys: ['Ctrl', '1',' … ','9'], desc: 'Switch to tab by index' },
    { keys: ['Alt', '←'], desc: 'Previous tab' },
    { keys: ['Alt', '→'], desc: 'Next tab' },
    { keys: ['Ctrl', 'W'], desc: 'Close active tab' },
  ]},
  { section: 'General', items: [
    { keys: ['?'], desc: 'Show keyboard shortcuts' },
    { keys: ['Esc'], desc: 'Close modals / dialogs' },
  ]},
]

export function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) return

      if (e.key === '?') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-[#16161a] border border-[#2a2a32] rounded-xl w-full max-w-md mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a32]">
          <div className="flex items-center gap-2">
            <Keyboard size={16} className="text-gray-400" />
            <h2 className="text-white font-semibold text-sm">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-600 hover:text-gray-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {SHORTCUTS.map(({ section, items }) => (
            <div key={section}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{section}</p>
              <div className="space-y-1.5">
                {items.map(({ keys, desc }) => (
                  <div key={desc} className="flex items-center justify-between gap-4">
                    <span className="text-gray-400 text-sm">{desc}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {keys.map((k, i) => (
                        k === ' … ' ? (
                          <span key={i} className="text-gray-600 text-xs">…</span>
                        ) : (
                          <kbd
                            key={i}
                            className="px-1.5 py-0.5 text-xs font-mono bg-[#0f0f11] border border-[#3a3a42] rounded text-gray-300"
                          >
                            {k}
                          </kbd>
                        )
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 pb-4 text-xs text-gray-600 text-center">
          Press <kbd className="px-1 py-0.5 bg-[#0f0f11] border border-[#3a3a42] rounded font-mono">?</kbd> to toggle
        </div>
      </div>
    </div>
  )
}
