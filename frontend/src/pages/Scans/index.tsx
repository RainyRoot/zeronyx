import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Play, Square, Trash2, Terminal, Server, LayoutList,
  ChevronDown, AlertCircle, CheckCircle2, Clock, Loader2,
  Crosshair, Network, Globe, Search, FolderOpen, Zap,
} from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'
import { useTargetStore } from '@/stores/targetStore'
import { useScanStore } from '@/stores/scanStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import { cn } from '@/lib/utils'
import type { Scan, ScanStatus, WsServerMessage, Host, Port, GobusterPath } from '@/types'

// ---------------------------------------------------------------------------
// Tool definitions — controls the selector bar and which form is rendered
// ---------------------------------------------------------------------------

interface ToolMeta {
  id: string
  label: string
  shortLabel: string
  description: string
  /** Tailwind color token used for badge/accent, e.g. 'blue' */
  color: string
  icon: React.ReactNode
  phase: 2 | 3 | 4
  available: boolean
}

const TOOLS: ToolMeta[] = [
  {
    id: 'nmap',
    label: 'Nmap',
    shortLabel: 'nmap',
    description: 'Network scanner — host discovery, port scanning, service detection',
    color: 'blue',
    icon: <Network size={12} />,
    phase: 2,
    available: true,
  },
  {
    id: 'gobuster',
    label: 'Gobuster',
    shortLabel: 'gobuster',
    description: 'Directory, DNS & vhost brute force',
    color: 'orange',
    icon: <FolderOpen size={12} />,
    phase: 2,
    available: true,
  },
  {
    id: 'nuclei',
    label: 'Nuclei',
    shortLabel: 'nuclei',
    description: 'Template-based vulnerability scanner',
    color: 'red',
    icon: <Zap size={12} />,
    phase: 2,
    available: false,
  },
  {
    id: 'nikto',
    label: 'Nikto',
    shortLabel: 'nikto',
    description: 'Web server vulnerability scanner',
    color: 'yellow',
    icon: <Globe size={12} />,
    phase: 2,
    available: false,
  },
  {
    id: 'hydra',
    label: 'Hydra',
    shortLabel: 'hydra',
    description: 'Credential brute force — SSH, FTP, HTTP, and more',
    color: 'purple',
    icon: <Server size={12} />,
    phase: 2,
    available: false,
  },
  {
    id: 'searchsploit',
    label: 'SearchSploit',
    shortLabel: 'sploit',
    description: 'Exploit-DB lookup and search',
    color: 'green',
    icon: <Search size={12} />,
    phase: 2,
    available: false,
  },
]

// ---------------------------------------------------------------------------
// Tool color helpers
// ---------------------------------------------------------------------------

const TOOL_COLORS: Record<string, { badge: string; accent: string }> = {
  nmap:        { badge: 'text-blue-400 bg-blue-500/10 border-blue-500/30',   accent: 'border-blue-500' },
  gobuster:    { badge: 'text-orange-400 bg-orange-500/10 border-orange-500/30', accent: 'border-orange-500' },
  nuclei:      { badge: 'text-red-400 bg-red-500/10 border-red-500/30',     accent: 'border-red-500' },
  nikto:       { badge: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', accent: 'border-yellow-500' },
  hydra:       { badge: 'text-purple-400 bg-purple-500/10 border-purple-500/30', accent: 'border-purple-500' },
  searchsploit:{ badge: 'text-green-400 bg-green-500/10 border-green-500/30', accent: 'border-green-500' },
}

function toolColor(toolId: string) {
  return TOOL_COLORS[toolId] ?? { badge: 'text-gray-400 bg-gray-500/10 border-gray-500/30', accent: 'border-gray-500' }
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<ScanStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  pending:   { label: 'Pending',   cls: 'text-gray-400 bg-gray-500/10 border-gray-500/20',    icon: <Clock size={10} /> },
  running:   { label: 'Running',   cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20',    icon: <Loader2 size={10} className="animate-spin" /> },
  completed: { label: 'Done',      cls: 'text-green-400 bg-green-500/10 border-green-500/20', icon: <CheckCircle2 size={10} /> },
  failed:    { label: 'Failed',    cls: 'text-red-400 bg-red-500/10 border-red-500/20',       icon: <AlertCircle size={10} /> },
  cancelled: { label: 'Cancelled', cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', icon: <Square size={10} /> },
}

function StatusBadge({ status }: { status: ScanStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium border rounded px-1.5 py-0.5', cfg.cls)}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

function ToolBadge({ tool }: { tool: string }) {
  const { badge } = toolColor(tool)
  return (
    <span className={cn('inline-flex items-center text-[9px] font-mono font-medium border rounded px-1.5 py-0.5', badge)}>
      {tool}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Tool selector bar
// ---------------------------------------------------------------------------

function ToolSelector({
  selectedTool,
  onSelect,
}: {
  selectedTool: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="px-4 pt-3 pb-0">
      <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-2">Tool</span>
      <div className="flex flex-wrap gap-1.5">
        {TOOLS.map((t) => {
          const isActive = selectedTool === t.id
          const { accent } = toolColor(t.id)
          return (
            <button
              key={t.id}
              onClick={() => t.available && onSelect(t.id)}
              title={t.available ? t.description : `Coming in Phase 2`}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border transition-all',
                isActive
                  ? cn('text-white border-l-2', accent, 'bg-white/[0.06]')
                  : t.available
                    ? 'text-gray-500 border-[#2a2a32] hover:text-gray-300 hover:border-[#3a3a44] bg-transparent'
                    : 'text-gray-700 border-[#1e1e24] cursor-not-allowed opacity-50',
              )}
            >
              {t.icon}
              {t.shortLabel}
              {!t.available && (
                <span className="text-[8px] text-gray-700 ml-0.5">soon</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Per-tool config forms
// ---------------------------------------------------------------------------

interface NmapFormProps {
  targets: { id: string; value: string }[]
  selectedTargetId: string
  onTargetChange: (v: string) => void
  profiles: { name: string; description: string; config: Record<string, unknown> }[]
  isLoadingProfiles: boolean
  selectedProfile: string
  onProfileChange: (v: string) => void
  flags: string
  onFlagsChange: (v: string) => void
  ports: string
  onPortsChange: (v: string) => void
}

function NmapForm({
  targets, selectedTargetId, onTargetChange,
  profiles, isLoadingProfiles, selectedProfile, onProfileChange,
  flags, onFlagsChange, ports, onPortsChange,
}: NmapFormProps) {
  const currentProfile = profiles.find((p) => p.name === selectedProfile)
  const profileConfig = currentProfile?.config as { flags?: string; ports?: string } | undefined

  // Keep flags in sync with profile selection
  useEffect(() => {
    if (profileConfig) {
      onFlagsChange(profileConfig.flags ?? '')
      onPortsChange(profileConfig.ports ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfile])

  return (
    <div className="space-y-3">
      {/* Target */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Target</span>
        <div className="relative">
          <select
            value={selectedTargetId}
            onChange={(e) => onTargetChange(e.target.value)}
            className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs text-gray-200 appearance-none focus:outline-none focus:border-blue-500/50 transition-colors"
          >
            <option value="">— ad-hoc / manual target —</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>{t.value}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
        </div>
      </label>
      {/* Profile */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Profile</span>
        <div className="relative">
          <select
            value={selectedProfile}
            onChange={(e) => onProfileChange(e.target.value)}
            disabled={isLoadingProfiles}
            className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs text-gray-200 appearance-none focus:outline-none focus:border-blue-500/50 transition-colors disabled:opacity-50"
          >
            <option value="">— custom —</option>
            {profiles.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
        </div>
        {currentProfile && (
          <p className="mt-1 text-[10px] text-gray-600">{currentProfile.description}</p>
        )}
      </label>
      {/* Flags */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Flags</span>
        <input
          type="text"
          value={flags}
          onChange={(e) => onFlagsChange(e.target.value)}
          placeholder="-sV -T4"
          className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-700 focus:outline-none focus:border-blue-500/50 transition-colors"
        />
      </label>
      {/* Ports */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">
          Ports <span className="text-gray-700 normal-case">(optional)</span>
        </span>
        <input
          type="text"
          value={ports}
          onChange={(e) => onPortsChange(e.target.value)}
          placeholder="22,80,443 or 1-1024"
          className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-700 focus:outline-none focus:border-blue-500/50 transition-colors"
        />
      </label>
    </div>
  )
}

interface GobusterFormProps {
  targets: { id: string; value: string }[]
  selectedTargetId: string
  onTargetChange: (v: string) => void
  profiles: { name: string; description: string; config: Record<string, unknown> }[]
  isLoadingProfiles: boolean
  selectedProfile: string
  onProfileChange: (v: string) => void
  mode: string
  onModeChange: (v: string) => void
  urlOrDomain: string
  onUrlChange: (v: string) => void
  wordlist: string
  onWordlistChange: (v: string) => void
  extensions: string
  onExtensionsChange: (v: string) => void
  threads: string
  onThreadsChange: (v: string) => void
}

const GOBUSTER_MODES = [
  { id: 'dir',   label: 'Dir',   title: 'Directory & file brute force' },
  { id: 'dns',   label: 'DNS',   title: 'Subdomain discovery' },
  { id: 'vhost', label: 'VHost', title: 'Virtual host brute force' },
]

function GobusterForm({
  targets, selectedTargetId, onTargetChange,
  profiles, isLoadingProfiles, selectedProfile, onProfileChange,
  mode, onModeChange, urlOrDomain, onUrlChange,
  wordlist, onWordlistChange, extensions, onExtensionsChange,
  threads, onThreadsChange,
}: GobusterFormProps) {
  const currentProfile = profiles.find((p) => p.name === selectedProfile)

  // Sync form fields when profile changes
  useEffect(() => {
    if (currentProfile?.config) {
      const c = currentProfile.config as Record<string, string>
      if (c.mode) onModeChange(c.mode)
      if (c.wordlist) onWordlistChange(c.wordlist)
      if (c.extensions != null) onExtensionsChange(c.extensions)
      if (c.threads) onThreadsChange(String(c.threads))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfile])

  // Auto-fill URL from target
  useEffect(() => {
    if (selectedTargetId) {
      const t = targets.find((t) => t.id === selectedTargetId)
      if (t && !urlOrDomain) {
        const val = t.value
        if (mode === 'dns') {
          onUrlChange(val.replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
        } else {
          onUrlChange(val.startsWith('http') ? val : `http://${val}`)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTargetId, mode])

  const urlLabel = mode === 'dns' ? 'Domain' : 'URL'
  const urlPlaceholder = mode === 'dns' ? 'example.com' : 'http://example.com'

  return (
    <div className="space-y-3">
      {/* Mode */}
      <div>
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Mode</span>
        <div className="flex gap-1">
          {GOBUSTER_MODES.map((m) => (
            <button
              key={m.id}
              title={m.title}
              onClick={() => onModeChange(m.id)}
              className={cn(
                'flex-1 py-1.5 text-[10px] font-medium rounded border transition-colors',
                mode === m.id
                  ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                  : 'bg-transparent border-[#2a2a32] text-gray-600 hover:text-gray-400',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {/* Target selector */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Target</span>
        <div className="relative">
          <select
            value={selectedTargetId}
            onChange={(e) => onTargetChange(e.target.value)}
            className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs text-gray-200 appearance-none focus:outline-none focus:border-orange-500/50 transition-colors"
          >
            <option value="">— manual entry below —</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>{t.value}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
        </div>
      </label>
      {/* URL / Domain */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">{urlLabel}</span>
        <input
          type="text"
          value={urlOrDomain}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder={urlPlaceholder}
          className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-700 focus:outline-none focus:border-orange-500/50 transition-colors"
        />
      </label>
      {/* Profile */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Profile</span>
        <div className="relative">
          <select
            value={selectedProfile}
            onChange={(e) => onProfileChange(e.target.value)}
            disabled={isLoadingProfiles}
            className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs text-gray-200 appearance-none focus:outline-none focus:border-orange-500/50 transition-colors disabled:opacity-50"
          >
            <option value="">— custom —</option>
            {profiles.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
        </div>
        {currentProfile && (
          <p className="mt-1 text-[10px] text-gray-600">{currentProfile.description}</p>
        )}
      </label>
      {/* Wordlist */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Wordlist</span>
        <input
          type="text"
          value={wordlist}
          onChange={(e) => onWordlistChange(e.target.value)}
          placeholder="/usr/share/wordlists/dirb/common.txt"
          className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-700 focus:outline-none focus:border-orange-500/50 transition-colors"
        />
      </label>
      {/* Extensions — only for dir mode */}
      {mode === 'dir' && (
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">
            Extensions <span className="text-gray-700 normal-case">(optional)</span>
          </span>
          <input
            type="text"
            value={extensions}
            onChange={(e) => onExtensionsChange(e.target.value)}
            placeholder=".php,.html,.txt"
            className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-700 focus:outline-none focus:border-orange-500/50 transition-colors"
          />
        </label>
      )}
      {/* Threads */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Threads</span>
        <input
          type="number"
          min={1}
          max={100}
          value={threads}
          onChange={(e) => onThreadsChange(e.target.value)}
          className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-orange-500/50 transition-colors"
        />
      </label>
    </div>
  )
}

function ComingSoonForm({ tool }: { tool: string }) {
  const meta = TOOLS.find((t) => t.id === tool)
  return (
    <div className="flex flex-col items-center justify-center h-32 text-center gap-2 px-4">
      <div className="text-2xl opacity-30">
        {meta?.icon}
      </div>
      <p className="text-xs text-gray-500 font-medium">{meta?.label} — Coming Soon</p>
      <p className="text-[10px] text-gray-700">{meta?.description}</p>
      <p className="text-[9px] text-gray-800 mt-1">Implemented in Phase 2</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Results panels
// ---------------------------------------------------------------------------

function NmapResultsPanel({ hosts, ports }: { hosts: Host[]; ports: Port[] }) {
  const [tab, setTab] = useState<'hosts' | 'ports'>('hosts')
  const hostMap = Object.fromEntries(hosts.map((h) => [h.id, h]))
  return (
    <div className="shrink-0 border-t border-[#2a2a32]" style={{ maxHeight: '40%' }}>
      <div className="flex items-center gap-0 border-b border-[#2a2a32] px-4">
        <TabButton active={tab === 'hosts'} onClick={() => setTab('hosts')}>
          <Server size={11} /> Hosts ({hosts.length})
        </TabButton>
        <TabButton active={tab === 'ports'} onClick={() => setTab('ports')}>
          <Network size={11} /> Ports ({ports.length})
        </TabButton>
      </div>
      <div className="overflow-auto" style={{ maxHeight: 'calc(40vh - 36px)' }}>
        {tab === 'hosts' && <HostsTable hosts={hosts} />}
        {tab === 'ports' && <PortsTable ports={ports} hostMap={hostMap} />}
      </div>
    </div>
  )
}

function GobusterResultsPanel({ parsed }: { parsed: Record<string, unknown> }) {
  const mode = (parsed.mode as string) ?? 'dir'
  const paths = (parsed.paths as GobusterPath[]) ?? []
  const totalFound = (parsed.total_found as number) ?? paths.length

  const statusColor = (status?: number) => {
    if (!status) return 'text-gray-500'
    if (status < 300) return 'text-green-400'
    if (status < 400) return 'text-blue-400'
    if (status === 401 || status === 403) return 'text-yellow-500'
    return 'text-gray-500'
  }

  if (paths.length === 0) {
    return (
      <div className="shrink-0 border-t border-[#2a2a32] px-4 py-4">
        <p className="text-xs text-gray-600">No results found.</p>
      </div>
    )
  }

  return (
    <div className="shrink-0 border-t border-[#2a2a32]" style={{ maxHeight: '40%' }}>
      <div className="flex items-center justify-between px-4 border-b border-[#2a2a32] py-2">
        <div className="flex items-center gap-2">
          <FolderOpen size={11} className="text-orange-400" />
          <span className="text-[10px] font-medium text-gray-300">
            {mode === 'dns' ? 'Subdomains' : mode === 'vhost' ? 'Virtual Hosts' : 'Paths'} ({totalFound})
          </span>
        </div>
      </div>
      <div className="overflow-auto" style={{ maxHeight: 'calc(40vh - 36px)' }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-gray-700 border-b border-[#2a2a32]">
              {mode === 'dir' && (
                <>
                  <th className="text-left px-4 py-2">Path</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Size</th>
                  <th className="text-left px-4 py-2">Redirect</th>
                </>
              )}
              {mode === 'dns' && <th className="text-left px-4 py-2">Subdomain</th>}
              {mode === 'vhost' && (
                <>
                  <th className="text-left px-4 py-2">VHost</th>
                  <th className="text-left px-4 py-2">Status</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e1e24]">
            {paths.map((entry, i) => (
              <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                {mode === 'dir' && (
                  <>
                    <td className="px-4 py-2 font-mono text-orange-300/90">{entry.path ?? '—'}</td>
                    <td className={cn('px-4 py-2 font-mono font-semibold', statusColor(entry.status))}>
                      {entry.status ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-[10px]">
                      {entry.size != null ? `${entry.size}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-blue-400/70 text-[10px] font-mono truncate max-w-[160px]">
                      {entry.redirect ?? '—'}
                    </td>
                  </>
                )}
                {mode === 'dns' && (
                  <td className="px-4 py-2 font-mono text-orange-300/90">{entry.subdomain ?? '—'}</td>
                )}
                {mode === 'vhost' && (
                  <>
                    <td className="px-4 py-2 font-mono text-orange-300/90">{entry.vhost ?? '—'}</td>
                    <td className={cn('px-4 py-2 font-mono font-semibold', statusColor(entry.status))}>
                      {entry.status ?? '—'}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ScansPage(): JSX.Element {
  const activeProject = useProjectStore((s) => s.activeProject)
  const { targets, fetchTargets } = useTargetStore()
  const {
    scans, isLoadingScans,
    activeScan, outputLines, results, isRunning,
    profiles, isLoadingProfiles,
    error, selectedTool,
    fetchScans, fetchProfiles, startScan, cancelActiveScan,
    appendOutputLine, setActiveScan, fetchResults,
    clearSession, deleteScan, setSelectedTool,
  } = useScanStore()

  // ---- nmap form state ----
  const [nmapTargetId, setNmapTargetId] = useState('')
  const [nmapProfile, setNmapProfile] = useState('')
  const [nmapFlags, setNmapFlags] = useState('-sV')
  const [nmapPorts, setNmapPorts] = useState('')

  // ---- gobuster form state ----
  const [gobusterTargetId, setGobusterTargetId] = useState('')
  const [gobusterProfile, setGobusterProfile] = useState('')
  const [gobusterMode, setGobusterMode] = useState('dir')
  const [gobusterUrl, setGobusterUrl] = useState('')
  const [gobusterWordlist, setGobusterWordlist] = useState('/usr/share/wordlists/dirb/common.txt')
  const [gobusterExtensions, setGobusterExtensions] = useState('')
  const [gobusterThreads, setGobusterThreads] = useState('10')

  const outputRef = useRef<HTMLDivElement>(null)

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [outputLines])

  // Load data when project changes
  useEffect(() => {
    if (!activeProject) return
    fetchTargets(activeProject.id)
    fetchScans(activeProject.id)
    clearSession()
  }, [activeProject, fetchTargets, fetchScans, clearSession])

  // Reload profiles when tool changes
  useEffect(() => {
    const meta = TOOLS.find((t) => t.id === selectedTool)
    if (meta?.available) {
      fetchProfiles(selectedTool)
    }
  }, [selectedTool, fetchProfiles])

  // WebSocket for active scan
  const handleWsMessage = useCallback((msg: WsServerMessage) => {
    if (msg.type === 'output') {
      appendOutputLine(msg.line)
    } else if (msg.type === 'done') {
      useScanStore.setState({ isRunning: false })
      if (activeScan) {
        fetchResults(activeScan.id, activeScan.tool)
        fetchScans(activeProject?.id ?? '')
      }
    } else if (msg.type === 'error') {
      useScanStore.setState({ isRunning: false })
      appendOutputLine(`[ERROR] ${msg.message}`)
    }
  }, [activeScan, appendOutputLine, fetchResults, fetchScans, activeProject])

  useWebSocket({
    scanId: activeScan?.id ?? '',
    onMessage: handleWsMessage,
    enabled: !!activeScan && isRunning,
  })

  // ---- Start scan ----
  const handleStart = async () => {
    if (!activeProject) return
    let config: Record<string, unknown> = {}
    let targetId: string | null = null

    if (selectedTool === 'nmap') {
      config = { flags: nmapFlags || '-sV' }
      if (nmapPorts) config.ports = nmapPorts
      if (nmapTargetId) {
        const t = targets.find((t) => t.id === nmapTargetId)
        if (t) config.target = t.value
        targetId = nmapTargetId
      }
    } else if (selectedTool === 'gobuster') {
      config = {
        mode: gobusterMode,
        wordlist: gobusterWordlist,
        threads: parseInt(gobusterThreads, 10) || 10,
      }
      if (gobusterMode === 'dir' || gobusterMode === 'vhost') {
        config.url = gobusterUrl
      } else {
        config.domain = gobusterUrl
      }
      if (gobusterExtensions) config.extensions = gobusterExtensions
      if (gobusterTargetId) targetId = gobusterTargetId
    }

    try {
      await startScan(
        activeProject.id,
        targetId,
        selectedTool,
        (selectedTool === 'nmap' ? nmapProfile : gobusterProfile) || null,
        config,
      )
    } catch (e) {
      useScanStore.setState({ error: (e as Error).message })
    }
  }

  const handleSelectScan = async (scan: Scan) => {
    clearSession()
    setActiveScan(scan)
    // Switch tool selector to match the scan
    setSelectedTool(scan.tool)
    if (scan.status === 'completed') {
      await fetchResults(scan.id, scan.tool)
    }
  }

  const handleDelete = async (scan: Scan, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(`Delete scan ${scan.id.slice(0, 8)}…?`)) return
    await deleteScan(scan.id)
  }

  const handleToolChange = (tool: string) => {
    setSelectedTool(tool)
    clearSession()
  }

  // ---- Can start? ----
  const canStart = (() => {
    if (isRunning) return false
    if (selectedTool === 'nmap') return !!(nmapFlags || nmapProfile)
    if (selectedTool === 'gobuster') return !!(gobusterUrl && gobusterWordlist)
    return false
  })()

  const startBtnCls = cn(
    'w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-white rounded-lg transition-colors',
    canStart ? `bg-opacity-90 hover:bg-opacity-100` : 'opacity-30 cursor-not-allowed',
    selectedTool === 'nmap'     && (canStart ? 'bg-blue-600 hover:bg-blue-500'     : 'bg-blue-600'),
    selectedTool === 'gobuster' && (canStart ? 'bg-orange-600 hover:bg-orange-500' : 'bg-orange-600'),
  )

  // ---- No active project ----
  if (!activeProject) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-100 mb-1">Scans</h1>
        <p className="text-sm text-gray-500">Run and monitor tool scans against your targets.</p>
        <div className="mt-8 flex flex-col items-center justify-center h-48 bg-[#1a1a1f] border border-dashed border-[#2a2a32] rounded-xl">
          <Crosshair size={28} className="text-gray-700 mb-3" />
          <p className="text-sm text-gray-500">No active project.</p>
          <p className="text-xs text-gray-600 mt-1">Open a project from the Dashboard first.</p>
        </div>
      </div>
    )
  }

  const activeTool = TOOLS.find((t) => t.id === selectedTool)

  return (
    <div className="flex h-full overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* LEFT — tool selector + config form + history                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="w-72 shrink-0 border-r border-[#2a2a32] flex flex-col overflow-hidden">

        {/* Tool selector */}
        <ToolSelector selectedTool={selectedTool} onSelect={handleToolChange} />

        {/* Config form */}
        <div className="p-4 pt-3 border-b border-[#2a2a32] overflow-y-auto">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
            New {activeTool?.label} Scan
          </h2>

          {selectedTool === 'nmap' && (
            <NmapForm
              targets={targets}
              selectedTargetId={nmapTargetId}
              onTargetChange={setNmapTargetId}
              profiles={profiles}
              isLoadingProfiles={isLoadingProfiles}
              selectedProfile={nmapProfile}
              onProfileChange={setNmapProfile}
              flags={nmapFlags}
              onFlagsChange={setNmapFlags}
              ports={nmapPorts}
              onPortsChange={setNmapPorts}
            />
          )}
          {selectedTool === 'gobuster' && (
            <GobusterForm
              targets={targets}
              selectedTargetId={gobusterTargetId}
              onTargetChange={setGobusterTargetId}
              profiles={profiles}
              isLoadingProfiles={isLoadingProfiles}
              selectedProfile={gobusterProfile}
              onProfileChange={setGobusterProfile}
              mode={gobusterMode}
              onModeChange={setGobusterMode}
              urlOrDomain={gobusterUrl}
              onUrlChange={setGobusterUrl}
              wordlist={gobusterWordlist}
              onWordlistChange={setGobusterWordlist}
              extensions={gobusterExtensions}
              onExtensionsChange={setGobusterExtensions}
              threads={gobusterThreads}
              onThreadsChange={setGobusterThreads}
            />
          )}
          {!['nmap', 'gobuster'].includes(selectedTool) && (
            <ComingSoonForm tool={selectedTool} />
          )}

          {/* Action button */}
          <div className="mt-4">
            {isRunning ? (
              <button
                onClick={cancelActiveScan}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded-lg transition-colors"
              >
                <Square size={12} />
                Cancel Scan
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={!canStart}
                className={startBtnCls}
              >
                <Play size={12} />
                Start {activeTool?.label} Scan
              </button>
            )}

            {error && (
              <p className="mt-2 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Scan History */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2.5 border-b border-[#2a2a32] flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-gray-600">History</span>
            <span className="text-[9px] text-gray-700">{scans.length} scans</span>
          </div>
          {isLoadingScans ? (
            <div className="p-4 text-xs text-gray-600 text-center">Loading…</div>
          ) : scans.length === 0 ? (
            <div className="p-4 text-xs text-gray-700 text-center">No scans yet.</div>
          ) : (
            scans.map((scan) => (
              <ScanHistoryItem
                key={scan.id}
                scan={scan}
                isActive={activeScan?.id === scan.id}
                onClick={() => handleSelectScan(scan)}
                onDelete={(e) => handleDelete(scan, e)}
              />
            ))
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* RIGHT — header + output + results                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 py-3 border-b border-[#2a2a32] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-sm font-semibold text-gray-100">
              {activeScan
                ? `${activeScan.tool} · ${activeScan.id.slice(0, 8)}`
                : 'Scans'}
            </h1>
            {activeScan && <ToolBadge tool={activeScan.tool} />}
            {activeScan && <StatusBadge status={activeScan.status} />}
          </div>
          {activeScan?.config && (() => {
            const cfg = activeScan.config as Record<string, string>
            const summary = activeScan.tool === 'gobuster'
              ? `${cfg.mode ?? 'dir'} ${cfg.url ?? cfg.domain ?? ''} ${cfg.wordlist ? '·' + cfg.wordlist.split('/').pop() : ''}`
              : `${cfg.flags ?? ''} ${cfg.ports ? `-p ${cfg.ports}` : ''} ${cfg.target ?? ''}`
            return (
              <span className="text-[10px] font-mono text-gray-600 truncate max-w-xs" title={summary}>
                {summary}
              </span>
            )
          })()}
        </div>

        {/* Output */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div
            ref={outputRef}
            className="flex-1 overflow-y-auto bg-[#0e0e12] p-4 font-mono text-xs leading-relaxed"
          >
            {outputLines.length === 0 && !activeScan ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-700">
                <Terminal size={32} className="mb-3" />
                <p>Select a tool and press Start.</p>
              </div>
            ) : outputLines.length === 0 && activeScan ? (
              <div className="flex items-center gap-2 text-gray-600">
                <Loader2 size={12} className="animate-spin" />
                Waiting for output…
              </div>
            ) : (
              outputLines.map((line, i) => (
                <OutputLine key={i} line={line} tool={activeScan?.tool ?? ''} />
              ))
            )}
          </div>

          {/* Results — tool-specific */}
          {activeScan?.status === 'completed' && results && (
            <>
              {activeScan.tool === 'nmap' && results.hosts.length + results.ports.length > 0 && (
                <NmapResultsPanel hosts={results.hosts} ports={results.ports} />
              )}
              {activeScan.tool === 'gobuster' && results.parsed && (
                <GobusterResultsPanel parsed={results.parsed} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScanHistoryItem({
  scan, isActive, onClick, onDelete,
}: {
  scan: Scan
  isActive: boolean
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-2.5 border-b border-[#1e1e24] group hover:bg-white/[0.02] transition-colors',
        isActive && 'bg-white/[0.04]',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ToolBadge tool={scan.tool} />
          <span className="text-[10px] font-mono text-gray-600">{scan.id.slice(0, 8)}…</span>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusBadge status={scan.status} />
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 text-gray-700 hover:text-red-400 transition-all p-0.5 rounded"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <LayoutList size={9} className="text-gray-700 shrink-0" />
        <span className="text-[10px] text-gray-600 truncate">
          {scan.profile ?? (() => {
            const cfg = scan.config as Record<string, string> | null
            if (!cfg) return scan.tool
            if (scan.tool === 'gobuster') return `${cfg.mode ?? 'dir'} ${cfg.url ?? cfg.domain ?? ''}`
            return cfg.flags ?? scan.tool
          })()}
        </span>
      </div>
      {scan.started_at && (
        <span className="text-[9px] text-gray-700 block mt-0.5">
          {new Date(scan.started_at).toLocaleString()}
        </span>
      )}
    </button>
  )
}

function OutputLine({ line, tool }: { line: string; tool: string }) {
  const isStderr = line.startsWith('[STDERR]')
  const isError  = line.toLowerCase().includes('[error]')
  // Gobuster found lines get a special color
  const isFound  = tool === 'gobuster' && line.match(/^\/(.*)\(Status:/)
  return (
    <div className={cn(
      'whitespace-pre-wrap break-all',
      isStderr ? 'text-yellow-600'  :
      isError  ? 'text-red-400'     :
      isFound  ? 'text-orange-400'  :
      'text-green-400/80',
    )}>
      {line}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-4 py-2 text-[10px] font-medium border-b-2 transition-colors',
        active
          ? 'border-blue-500 text-gray-200'
          : 'border-transparent text-gray-600 hover:text-gray-400',
      )}
    >
      {children}
    </button>
  )
}

function HostsTable({ hosts }: { hosts: Host[] }) {
  if (hosts.length === 0) {
    return <p className="px-4 py-4 text-xs text-gray-600">No hosts discovered.</p>
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-gray-700 border-b border-[#2a2a32]">
          <th className="text-left px-4 py-2">IP</th>
          <th className="text-left px-4 py-2">Hostname</th>
          <th className="text-left px-4 py-2">OS</th>
          <th className="text-left px-4 py-2">MAC / Vendor</th>
          <th className="text-left px-4 py-2">State</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#1e1e24]">
        {hosts.map((h) => (
          <tr key={h.id} className="hover:bg-white/[0.02] transition-colors">
            <td className="px-4 py-2 font-mono text-green-400">{h.ip}</td>
            <td className="px-4 py-2 text-gray-400 font-mono">{h.hostname ?? '—'}</td>
            <td className="px-4 py-2 text-gray-400 max-w-[180px] truncate" title={h.os ?? ''}>
              {h.os ? `${h.os}${h.os_accuracy ? ` (${h.os_accuracy}%)` : ''}` : '—'}
            </td>
            <td className="px-4 py-2 text-gray-500 font-mono text-[10px]">
              {h.mac ? `${h.mac}${h.vendor ? ` · ${h.vendor}` : ''}` : '—'}
            </td>
            <td className="px-4 py-2">
              <span className={cn('text-[10px] font-medium', h.state === 'up' ? 'text-green-400' : 'text-gray-500')}>
                {h.state}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PortsTable({ ports, hostMap }: { ports: Port[]; hostMap: Record<string, Host> }) {
  if (ports.length === 0) {
    return <p className="px-4 py-4 text-xs text-gray-600">No open ports found.</p>
  }
  const sorted = [...ports].sort((a, b) => a.number - b.number)
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-gray-700 border-b border-[#2a2a32]">
          <th className="text-left px-4 py-2">Host</th>
          <th className="text-left px-4 py-2">Port</th>
          <th className="text-left px-4 py-2">Proto</th>
          <th className="text-left px-4 py-2">State</th>
          <th className="text-left px-4 py-2">Service</th>
          <th className="text-left px-4 py-2">Version</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#1e1e24]">
        {sorted.map((p) => {
          const host = hostMap[p.host_id]
          return (
            <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
              <td className="px-4 py-2 font-mono text-green-400 text-[10px]">{host?.ip ?? '—'}</td>
              <td className="px-4 py-2 font-mono font-semibold text-gray-200">{p.number}</td>
              <td className="px-4 py-2 text-gray-600 uppercase text-[10px]">{p.protocol}</td>
              <td className="px-4 py-2">
                <span className={cn(
                  'text-[10px] font-medium',
                  p.state === 'open'     ? 'text-green-400'  :
                  p.state === 'filtered' ? 'text-yellow-500' : 'text-gray-500',
                )}>
                  {p.state}
                </span>
              </td>
              <td className="px-4 py-2 text-blue-400/80">{p.service ?? '—'}</td>
              <td className="px-4 py-2 text-gray-500 text-[10px] max-w-[200px] truncate" title={p.version ?? ''}>
                {p.version ?? '—'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
