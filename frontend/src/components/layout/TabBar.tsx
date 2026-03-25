import { X } from 'lucide-react'
import { useNavigationStore } from '@/stores/navigationStore'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { Tab } from '@/types'

export function TabBar(): JSX.Element {
  const { tabs, activeTabId, closeTab, setActiveTab } = useNavigationStore()
  const navigate = useNavigate()

  const handleSelect = (tab: Tab) => {
    setActiveTab(tab.id)
    navigate(tab.path)
  }

  const handleClose = (e: React.MouseEvent, tab: Tab) => {
    e.stopPropagation()
    const { tabs: current, activeTabId: current_active } = useNavigationStore.getState()
    const idx = current.findIndex((t) => t.id === tab.id)
    closeTab(tab.id)
    if (current_active === tab.id) {
      const remaining = current.filter((t) => t.id !== tab.id)
      const next = remaining[Math.max(0, idx - 1)] ?? remaining[0]
      if (next) navigate(next.path)
    }
  }

  return (
    <div className="flex items-center h-9 bg-[#111114] border-b border-[#2a2a32] overflow-x-auto shrink-0 scrollbar-none">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => handleSelect(tab)}
          className={cn(
            'group flex items-center gap-1.5 h-full px-3 text-xs cursor-pointer border-r border-[#2a2a32] shrink-0 select-none transition-colors',
            tab.id === activeTabId
              ? 'bg-[#1a1a1f] text-gray-100 border-t-2 border-t-red-500'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
          )}
        >
          <span className="max-w-[120px] truncate">{tab.label}</span>
          {tab.closeable && (
            <button
              onClick={(e) => handleClose(e, tab)}
              className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity ml-0.5 rounded"
              aria-label={`Close ${tab.label}`}
            >
              <X size={12} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
