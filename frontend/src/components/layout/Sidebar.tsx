import {
  LayoutDashboard,
  Crosshair,
  Activity,
  ShieldAlert,
  FileBarChart,
  Settings,
  SquareTerminal,
  History,
  Globe,
  Skull,
  Database,
  Eye,
  type LucideIcon
} from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useNavigationStore } from '@/stores/navigationStore'
import { useNavigate, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { PageId } from '@/types'

interface NavItem {
  pageId: PageId
  icon: LucideIcon
  label: string
  path: string
}

const NAV_ITEMS: NavItem[] = [
  { pageId: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { pageId: 'targets', icon: Crosshair, label: 'Targets', path: '/targets' },
  { pageId: 'scans', icon: Activity, label: 'Scans', path: '/scans' },
  { pageId: 'history', icon: History, label: 'History', path: '/history' },
  { pageId: 'findings', icon: ShieldAlert, label: 'Findings', path: '/findings' },
  { pageId: 'proxy', icon: Globe, label: 'Proxy', path: '/proxy' },
  { pageId: 'metasploit', icon: Skull, label: 'Metasploit', path: '/metasploit' },
  { pageId: 'sqlmap', icon: Database, label: 'SQLMap', path: '/sqlmap' },
  { pageId: 'shodan', icon: Eye, label: 'Shodan', path: '/shodan' },
  { pageId: 'reports', icon: FileBarChart, label: 'Reports', path: '/reports' },
  { pageId: 'terminal', icon: SquareTerminal, label: 'Terminal', path: '/terminal' },
]

const BOTTOM_ITEMS: NavItem[] = [
  { pageId: 'settings', icon: Settings, label: 'Settings', path: '/settings' }
]

export function Sidebar(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const { openTab, setActiveTab, tabs } = useNavigationStore()

  const handleNav = (item: NavItem) => {
    openTab(item.pageId, item.label, item.path)
    const existing = tabs.find((t) => t.pageId === item.pageId)
    if (existing) setActiveTab(existing.id)
    navigate(item.path)
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <Tooltip.Provider delayDuration={300}>
      <aside className="flex flex-col w-12 h-full bg-[#111114] border-r border-[#2a2a32] shrink-0">
        {/* Logo */}
        <div className="flex items-center justify-center h-12 border-b border-[#2a2a32] shrink-0">
          <span className="text-red-500 font-black text-lg leading-none select-none">Z</span>
        </div>

        {/* Main nav */}
        <nav className="flex flex-col gap-0.5 p-1 flex-1">
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.pageId}
              item={item}
              active={isActive(item.path)}
              onClick={() => handleNav(item)}
            />
          ))}
        </nav>

        {/* Bottom nav */}
        <nav className="flex flex-col gap-0.5 p-1 border-t border-[#2a2a32]">
          {BOTTOM_ITEMS.map((item) => (
            <NavButton
              key={item.pageId}
              item={item}
              active={isActive(item.path)}
              onClick={() => handleNav(item)}
            />
          ))}
        </nav>
      </aside>
    </Tooltip.Provider>
  )
}

function NavButton({
  item,
  active,
  onClick
}: {
  item: NavItem
  active: boolean
  onClick: () => void
}): JSX.Element {
  const Icon = item.icon
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          onClick={onClick}
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-md transition-colors',
            active
              ? 'bg-red-500/15 text-red-400'
              : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'
          )}
          aria-label={item.label}
        >
          <Icon size={18} strokeWidth={1.75} />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={8}
          className="bg-[#1a1a1f] border border-[#2a2a32] text-gray-200 text-xs px-2 py-1 rounded-md shadow-lg select-none"
        >
          {item.label}
          <Tooltip.Arrow className="fill-[#2a2a32]" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
