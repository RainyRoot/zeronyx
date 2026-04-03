import { useCallback, useEffect, useRef, useState } from 'react'
import { backendBase } from '@/lib/backend'
import {
  Play, Square, Trash2, Terminal, Server, LayoutList,
  ChevronDown, AlertCircle, CheckCircle2, Clock, Loader2,
  Crosshair, Network, Globe, Search, FolderOpen, Zap,
  BrainCircuit, Copy,
} from 'lucide-react'

const BASE_API = backendBase()
import { useProjectStore } from '@/stores/projectStore'
import { useTargetStore } from '@/stores/targetStore'
import { useScanStore } from '@/stores/scanStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import { cn } from '@/lib/utils'
import type { Scan, ScanStatus, WsServerMessage, Host, Port, GobusterPath, HydraCredential, SearchSploitExploit } from '@/types'

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
    available: true,
  },
  {
    id: 'nikto',
    label: 'Nikto',
    shortLabel: 'nikto',
    description: 'Web server vulnerability scanner',
    color: 'yellow',
    icon: <Globe size={12} />,
    phase: 2,
    available: true,
  },
  {
    id: 'hydra',
    label: 'Hydra',
    shortLabel: 'hydra',
    description: 'Credential brute force — SSH, FTP, HTTP, and more',
    color: 'purple',
    icon: <Server size={12} />,
    phase: 2,
    available: true,
  },
  {
    id: 'searchsploit',
    label: 'SearchSploit',
    shortLabel: 'sploit',
    description: 'Exploit-DB lookup and search',
    color: 'green',
    icon: <Search size={12} />,
    phase: 2,
    available: true,
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

// ---------------------------------------------------------------------------
// Nuclei form
// ---------------------------------------------------------------------------

const SEVERITY_LEVELS = ['critical', 'high', 'medium', 'low', 'info'] as const
type SeverityLevel = typeof SEVERITY_LEVELS[number]

const SEV_STYLE: Record<SeverityLevel, string> = {
  critical: 'text-red-400 border-red-500/50 bg-red-500/10',
  high:     'text-orange-400 border-orange-500/50 bg-orange-500/10',
  medium:   'text-yellow-400 border-yellow-500/50 bg-yellow-500/10',
  low:      'text-blue-400 border-blue-500/50 bg-blue-500/10',
  info:     'text-gray-400 border-gray-500/30 bg-gray-500/10',
}

interface NucleiFormProps {
  targets: { id: string; value: string }[]
  selectedTargetId: string
  onTargetChange: (v: string) => void
  profiles: { name: string; description: string; config: Record<string, unknown> }[]
  isLoadingProfiles: boolean
  selectedProfile: string
  onProfileChange: (v: string) => void
  url: string
  onUrlChange: (v: string) => void
  severities: SeverityLevel[]
  onSeveritiesChange: (v: SeverityLevel[]) => void
  tags: string
  onTagsChange: (v: string) => void
  templates: string
  onTemplatesChange: (v: string) => void
  threads: string
  onThreadsChange: (v: string) => void
}

function NucleiForm({
  targets, selectedTargetId, onTargetChange,
  profiles, isLoadingProfiles, selectedProfile, onProfileChange,
  url, onUrlChange, severities, onSeveritiesChange,
  tags, onTagsChange, templates, onTemplatesChange,
  threads, onThreadsChange,
}: NucleiFormProps) {
  const currentProfile = profiles.find((p) => p.name === selectedProfile)

  useEffect(() => {
    if (currentProfile?.config) {
      const c = currentProfile.config as Record<string, string>
      if (c.severity) {
        onSeveritiesChange(c.severity.split(',') as SeverityLevel[])
      } else {
        onSeveritiesChange([])
      }
      if (c.tags != null) onTagsChange(c.tags)
      if (c.threads) onThreadsChange(String(c.threads))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfile])

  // Auto-fill URL from target
  useEffect(() => {
    if (selectedTargetId && !url) {
      const t = targets.find((t) => t.id === selectedTargetId)
      if (t) {
        const val = t.value
        onUrlChange(val.startsWith('http') ? val : `http://${val}`)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTargetId])

  const toggleSeverity = (sev: SeverityLevel) => {
    if (severities.includes(sev)) {
      onSeveritiesChange(severities.filter((s) => s !== sev))
    } else {
      // Keep in severity order
      const next = SEVERITY_LEVELS.filter((s) => s === sev || severities.includes(s))
      onSeveritiesChange(next)
    }
  }

  return (
    <div className="space-y-3">
      {/* Target */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Target</span>
        <div className="relative">
          <select
            value={selectedTargetId}
            onChange={(e) => onTargetChange(e.target.value)}
            className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs text-gray-200 appearance-none focus:outline-none focus:border-red-500/50 transition-colors"
          >
            <option value="">— manual entry below —</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>{t.value}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
        </div>
      </label>
      {/* URL */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">URL</span>
        <input
          type="text"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="http://example.com"
          className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-700 focus:outline-none focus:border-red-500/50 transition-colors"
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
            className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs text-gray-200 appearance-none focus:outline-none focus:border-red-500/50 transition-colors disabled:opacity-50"
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
      {/* Severity filter */}
      <div>
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">
          Severity <span className="text-gray-700 normal-case">(all if none selected)</span>
        </span>
        <div className="flex flex-wrap gap-1">
          {SEVERITY_LEVELS.map((sev) => {
            const active = severities.includes(sev)
            return (
              <button
                key={sev}
                onClick={() => toggleSeverity(sev)}
                className={cn(
                  'px-2 py-0.5 text-[10px] font-medium rounded border transition-colors',
                  active ? SEV_STYLE[sev] : 'text-gray-700 border-[#2a2a32] hover:text-gray-500',
                )}
              >
                {sev}
              </button>
            )
          })}
        </div>
      </div>
      {/* Tags */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">
          Tags <span className="text-gray-700 normal-case">(optional)</span>
        </span>
        <input
          type="text"
          value={tags}
          onChange={(e) => onTagsChange(e.target.value)}
          placeholder="cve,rce,sqli"
          className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-700 focus:outline-none focus:border-red-500/50 transition-colors"
        />
      </label>
      {/* Custom templates */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">
          Templates <span className="text-gray-700 normal-case">(optional path)</span>
        </span>
        <input
          type="text"
          value={templates}
          onChange={(e) => onTemplatesChange(e.target.value)}
          placeholder="~/nuclei-templates/cves/"
          className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-700 focus:outline-none focus:border-red-500/50 transition-colors"
        />
      </label>
      {/* Threads */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Threads</span>
        <input
          type="number"
          min={1}
          max={100}
          value={threads}
          onChange={(e) => onThreadsChange(e.target.value)}
          className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-red-500/50 transition-colors"
        />
      </label>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Nuclei results panel
// ---------------------------------------------------------------------------

interface NucleiVuln {
  template_id: string
  name: string
  severity: string
  host: string
  matched_at: string
  tags: string[]
  description: string
  cve: string | null
}

const SEV_BADGE: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/30',
  high:     'text-orange-400 bg-orange-500/10 border-orange-500/30',
  medium:   'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  low:      'text-blue-400 bg-blue-500/10 border-blue-500/30',
  info:     'text-gray-400 bg-gray-500/10 border-gray-500/20',
}

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={cn(
      'inline-flex text-[9px] font-medium border rounded px-1.5 py-0.5 uppercase tracking-wider',
      SEV_BADGE[severity] ?? SEV_BADGE.info,
    )}>
      {severity}
    </span>
  )
}

function NucleiResultsPanel({ parsed }: { parsed: Record<string, unknown> }) {
  const vulns = (parsed.vulnerabilities as NucleiVuln[]) ?? []
  const total = (parsed.total_found as number) ?? vulns.length
  const [selected, setSelected] = useState<NucleiVuln | null>(null)

  // Severity counts for header summary
  const counts = vulns.reduce<Record<string, number>>((acc, v) => {
    acc[v.severity] = (acc[v.severity] ?? 0) + 1
    return acc
  }, {})

  if (vulns.length === 0) {
    return (
      <div className="shrink-0 border-t border-[#2a2a32] px-4 py-4 flex items-center gap-2 text-xs text-gray-600">
        <CheckCircle2 size={12} className="text-green-500/60" />
        No vulnerabilities found.
      </div>
    )
  }

  return (
    <div className="shrink-0 border-t border-[#2a2a32] flex" style={{ maxHeight: '45%' }}>
      {/* Left: findings list */}
      <div className="flex flex-col border-r border-[#2a2a32]" style={{ width: '55%' }}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[#2a2a32] shrink-0">
          <Zap size={11} className="text-red-400" />
          <span className="text-[10px] font-medium text-gray-300">Findings ({total})</span>
          <div className="flex gap-1 ml-auto">
            {(['critical', 'high', 'medium', 'low', 'info'] as const).map((sev) =>
              counts[sev] ? (
                <span key={sev} className={cn('text-[9px] font-medium border rounded px-1 py-0.5', SEV_BADGE[sev])}>
                  {counts[sev]}
                </span>
              ) : null,
            )}
          </div>
        </div>
        {/* Table */}
        <div className="overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-gray-700 border-b border-[#2a2a32]">
                <th className="text-left px-3 py-1.5">Severity</th>
                <th className="text-left px-3 py-1.5">Name</th>
                <th className="text-left px-3 py-1.5">CVE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e24]">
              {vulns.map((v, i) => (
                <tr
                  key={i}
                  onClick={() => setSelected(selected?.template_id === v.template_id && selected?.matched_at === v.matched_at ? null : v)}
                  className={cn(
                    'cursor-pointer hover:bg-white/[0.03] transition-colors',
                    selected === v && 'bg-white/[0.05]',
                  )}
                >
                  <td className="px-3 py-1.5"><SeverityBadge severity={v.severity} /></td>
                  <td className="px-3 py-1.5 text-gray-300 truncate max-w-[160px]" title={v.name}>{v.name}</td>
                  <td className="px-3 py-1.5 font-mono text-[9px] text-gray-600">{v.cve ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Right: detail panel */}
      <div className="flex-1 overflow-y-auto p-3">
        {selected ? (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold text-gray-200 leading-tight">{selected.name}</p>
              <SeverityBadge severity={selected.severity} />
            </div>
            {selected.cve && (
              <p className="text-[10px] font-mono text-blue-400">{selected.cve}</p>
            )}
            <div className="space-y-1">
              <p className="text-[9px] uppercase tracking-wider text-gray-700">Template</p>
              <p className="text-[10px] font-mono text-gray-500">{selected.template_id}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] uppercase tracking-wider text-gray-700">Matched at</p>
              <p className="text-[10px] font-mono text-orange-400/80 break-all">{selected.matched_at}</p>
            </div>
            {selected.description && (
              <div className="space-y-1">
                <p className="text-[9px] uppercase tracking-wider text-gray-700">Description</p>
                <p className="text-[10px] text-gray-500 leading-relaxed">{selected.description}</p>
              </div>
            )}
            {selected.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {selected.tags.map((tag, i) => (
                  <span key={i} className="text-[9px] text-gray-700 border border-[#2a2a32] rounded px-1 py-0.5">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-[10px] text-gray-700">
            Click a finding to see details
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Nikto form
// ---------------------------------------------------------------------------

// Nikto tuning option definitions (subset most relevant for web audits)
const NIKTO_TUNING_OPTIONS = [
  { id: '2', label: 'Misconfig',   title: 'Misconfiguration / default files' },
  { id: '3', label: 'Disclosure',  title: 'Information disclosure' },
  { id: '4', label: 'Injection',   title: 'XSS / script injection' },
  { id: '9', label: 'SQL',         title: 'SQL injection' },
  { id: 'a', label: 'Auth Bypass', title: 'Authentication bypass' },
  { id: 'b', label: 'Soft ID',     title: 'Software identification' },
] as const

interface NiktoFormProps {
  targets: { id: string; value: string }[]
  selectedTargetId: string
  onTargetChange: (v: string) => void
  profiles: { name: string; description: string; config: Record<string, unknown> }[]
  isLoadingProfiles: boolean
  selectedProfile: string
  onProfileChange: (v: string) => void
  url: string
  onUrlChange: (v: string) => void
  tuning: string[]
  onTuningChange: (v: string[]) => void
  ssl: boolean
  onSslChange: (v: boolean) => void
  timeout: string
  onTimeoutChange: (v: string) => void
  maxtime: string
  onMaxtimeChange: (v: string) => void
}

function NiktoForm({
  targets, selectedTargetId, onTargetChange,
  profiles, isLoadingProfiles, selectedProfile, onProfileChange,
  url, onUrlChange, tuning, onTuningChange,
  ssl, onSslChange, timeout, onTimeoutChange,
  maxtime, onMaxtimeChange,
}: NiktoFormProps) {
  const currentProfile = profiles.find((p) => p.name === selectedProfile)

  useEffect(() => {
    if (currentProfile?.config) {
      const c = currentProfile.config as Record<string, unknown>
      if (typeof c.tuning === 'string') {
        onTuningChange(c.tuning.split(''))
      } else {
        onTuningChange([])
      }
      if (typeof c.ssl === 'boolean') onSslChange(c.ssl)
      if (c.timeout) onTimeoutChange(String(c.timeout))
      if (c.maxtime) onMaxtimeChange(String(c.maxtime))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfile])

  // Auto-fill URL from target
  useEffect(() => {
    if (selectedTargetId && !url) {
      const t = targets.find((t) => t.id === selectedTargetId)
      if (t) {
        const val = t.value
        onUrlChange(val.startsWith('http') ? val : `http://${val}`)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTargetId])

  const toggleTuning = (id: string) => {
    if (tuning.includes(id)) {
      onTuningChange(tuning.filter((t) => t !== id))
    } else {
      onTuningChange([...tuning, id])
    }
  }

  return (
    <div className="space-y-3">
      {/* Target */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Target</span>
        <div className="relative">
          <select
            value={selectedTargetId}
            onChange={(e) => onTargetChange(e.target.value)}
            className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs text-gray-200 appearance-none focus:outline-none focus:border-yellow-500/50 transition-colors"
          >
            <option value="">— manual entry below —</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>{t.value}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
        </div>
      </label>
      {/* URL */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">URL</span>
        <input
          type="text"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="http://example.com"
          className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-700 focus:outline-none focus:border-yellow-500/50 transition-colors"
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
            className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs text-gray-200 appearance-none focus:outline-none focus:border-yellow-500/50 transition-colors disabled:opacity-50"
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
      {/* Tuning */}
      <div>
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">
          Tuning <span className="text-gray-700 normal-case">(all if none selected)</span>
        </span>
        <div className="flex flex-wrap gap-1">
          {NIKTO_TUNING_OPTIONS.map((opt) => {
            const active = tuning.includes(opt.id)
            return (
              <button
                key={opt.id}
                title={opt.title}
                onClick={() => toggleTuning(opt.id)}
                className={cn(
                  'px-2 py-0.5 text-[10px] font-medium rounded border transition-colors',
                  active
                    ? 'text-yellow-300 border-yellow-500/50 bg-yellow-500/10'
                    : 'text-gray-700 border-[#2a2a32] hover:text-gray-500',
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
      {/* SSL toggle + timeout row */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div
            onClick={() => onSslChange(!ssl)}
            className={cn(
              'w-8 h-4 rounded-full transition-colors relative',
              ssl ? 'bg-yellow-500/40' : 'bg-[#2a2a32]',
            )}
          >
            <div className={cn(
              'absolute top-0.5 w-3 h-3 rounded-full transition-transform',
              ssl ? 'translate-x-4 bg-yellow-400' : 'translate-x-0.5 bg-gray-600',
            )} />
          </div>
          <span className="text-[10px] text-gray-600">Force SSL</span>
        </label>
        <label className="flex-1 block">
          <span className="text-[10px] text-gray-600 block mb-0.5">Timeout (s)</span>
          <input
            type="number"
            min={1}
            max={60}
            value={timeout}
            onChange={(e) => onTimeoutChange(e.target.value)}
            className="w-full bg-[#16161a] border border-[#2a2a32] rounded px-2 py-1 text-xs font-mono text-gray-200 focus:outline-none focus:border-yellow-500/50 transition-colors"
          />
        </label>
      </div>
      {/* Max time */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">
          Max scan time <span className="text-gray-700 normal-case">(optional, e.g. 5m)</span>
        </span>
        <input
          type="text"
          value={maxtime}
          onChange={(e) => onMaxtimeChange(e.target.value)}
          placeholder="5m"
          className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-700 focus:outline-none focus:border-yellow-500/50 transition-colors"
        />
      </label>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Nikto results panel
// ---------------------------------------------------------------------------

interface NiktoFinding {
  path: string | null
  osvdb: string | null
  cve: string | null
  description: string
  severity: string
}

const NIKTO_SEV_BADGE: Record<string, string> = {
  high:   'text-orange-400 bg-orange-500/10 border-orange-500/30',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  low:    'text-blue-400 bg-blue-500/10 border-blue-500/30',
  info:   'text-gray-400 bg-gray-500/10 border-gray-500/20',
}

function NiktoResultsPanel({ parsed }: { parsed: Record<string, unknown> }) {
  const findings = (parsed.findings as NiktoFinding[]) ?? []
  const total = (parsed.total_found as number) ?? findings.length
  const server = parsed.server as string | null
  const ip = parsed.ip as string | null
  const [selected, setSelected] = useState<NiktoFinding | null>(null)

  if (findings.length === 0) {
    return (
      <div className="shrink-0 border-t border-[#2a2a32] px-4 py-4 flex items-center gap-2 text-xs text-gray-600">
        <CheckCircle2 size={12} className="text-green-500/60" />
        No issues found.
      </div>
    )
  }

  return (
    <div className="shrink-0 border-t border-[#2a2a32] flex" style={{ maxHeight: '45%' }}>
      {/* List */}
      <div className="flex flex-col border-r border-[#2a2a32]" style={{ width: '55%' }}>
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[#2a2a32] shrink-0">
          <Globe size={11} className="text-yellow-400" />
          <span className="text-[10px] font-medium text-gray-300">Nikto Findings ({total})</span>
          {server && (
            <span className="ml-auto text-[9px] font-mono text-gray-700 truncate max-w-[120px]" title={server}>
              {server}
            </span>
          )}
          {ip && <span className="text-[9px] font-mono text-gray-700">{ip}</span>}
        </div>
        <div className="overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-gray-700 border-b border-[#2a2a32]">
                <th className="text-left px-3 py-1.5">Sev</th>
                <th className="text-left px-3 py-1.5">Path / Issue</th>
                <th className="text-left px-3 py-1.5">Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e24]">
              {findings.map((f, i) => (
                <tr
                  key={i}
                  onClick={() => setSelected(selected === f ? null : f)}
                  className={cn(
                    'cursor-pointer hover:bg-white/[0.03] transition-colors',
                    selected === f && 'bg-white/[0.05]',
                  )}
                >
                  <td className="px-3 py-1.5">
                    <span className={cn(
                      'inline-flex text-[9px] font-medium border rounded px-1 py-0.5 uppercase',
                      NIKTO_SEV_BADGE[f.severity] ?? NIKTO_SEV_BADGE.info,
                    )}>
                      {f.severity}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-gray-400 truncate max-w-[120px]" title={f.path ?? f.description}>
                    {f.path ? (
                      <span className="font-mono text-yellow-400/80">{f.path}</span>
                    ) : (
                      <span className="text-gray-500 italic">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-[9px] font-mono text-gray-700">
                    {f.osvdb ? `OSVDB-${f.osvdb}` : f.cve ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Detail */}
      <div className="flex-1 overflow-y-auto p-3">
        {selected ? (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <span className={cn(
                'inline-flex text-[9px] font-medium border rounded px-1.5 py-0.5 uppercase',
                NIKTO_SEV_BADGE[selected.severity] ?? NIKTO_SEV_BADGE.info,
              )}>
                {selected.severity}
              </span>
              {selected.osvdb && (
                <span className="text-[9px] font-mono text-gray-700">OSVDB-{selected.osvdb}</span>
              )}
            </div>
            {selected.path && (
              <div>
                <p className="text-[9px] uppercase tracking-wider text-gray-700">Path</p>
                <p className="text-[10px] font-mono text-yellow-400/80 break-all">{selected.path}</p>
              </div>
            )}
            {selected.cve && (
              <div>
                <p className="text-[9px] uppercase tracking-wider text-gray-700">CVE</p>
                <p className="text-[10px] font-mono text-blue-400">{selected.cve}</p>
              </div>
            )}
            <div>
              <p className="text-[9px] uppercase tracking-wider text-gray-700 mb-1">Description</p>
              <p className="text-[10px] text-gray-400 leading-relaxed">{selected.description}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-[10px] text-gray-700">
            Click a finding to see details
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hydra form
// ---------------------------------------------------------------------------

const HYDRA_SERVICES = [
  { id: 'ssh',            label: 'SSH' },
  { id: 'ftp',            label: 'FTP' },
  { id: 'telnet',         label: 'Telnet' },
  { id: 'http-get',       label: 'HTTP GET' },
  { id: 'http-post-form', label: 'HTTP POST' },
  { id: 'smb',            label: 'SMB' },
  { id: 'rdp',            label: 'RDP' },
  { id: 'mysql',          label: 'MySQL' },
  { id: 'postgres',       label: 'PgSQL' },
  { id: 'vnc',            label: 'VNC' },
] as const

interface HydraFormProps {
  targets: { id: string; value: string }[]
  selectedTargetId: string
  onTargetChange: (v: string) => void
  profiles: { name: string; description: string; config: Record<string, unknown> }[]
  isLoadingProfiles: boolean
  selectedProfile: string
  onProfileChange: (v: string) => void
  host: string
  onHostChange: (v: string) => void
  service: string
  onServiceChange: (v: string) => void
  username: string
  onUsernameChange: (v: string) => void
  userlist: string
  onUserlistChange: (v: string) => void
  passlist: string
  onPasslistChange: (v: string) => void
  threads: string
  onThreadsChange: (v: string) => void
  stopOnFirst: boolean
  onStopOnFirstChange: (v: boolean) => void
  httpPath: string
  onHttpPathChange: (v: string) => void
}

function HydraForm({
  targets, selectedTargetId, onTargetChange,
  profiles, isLoadingProfiles, selectedProfile, onProfileChange,
  host, onHostChange, service, onServiceChange,
  username, onUsernameChange, userlist, onUserlistChange,
  passlist, onPasslistChange, threads, onThreadsChange,
  stopOnFirst, onStopOnFirstChange, httpPath, onHttpPathChange,
}: HydraFormProps) {
  const currentProfile = profiles.find((p) => p.name === selectedProfile)

  useEffect(() => {
    if (currentProfile?.config) {
      const c = currentProfile.config as Record<string, unknown>
      if (c.service)   onServiceChange(String(c.service))
      if (c.userlist)  onUserlistChange(String(c.userlist))
      if (c.username)  onUsernameChange(String(c.username))
      if (c.passlist)  onPasslistChange(String(c.passlist))
      if (c.threads)   onThreadsChange(String(c.threads))
      if (typeof c.stop_on_first === 'boolean') onStopOnFirstChange(c.stop_on_first)
      if (c.http_path) onHttpPathChange(String(c.http_path))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfile])

  // Auto-fill host from target
  useEffect(() => {
    if (selectedTargetId && !host) {
      const t = targets.find((t) => t.id === selectedTargetId)
      if (t) {
        onHostChange(t.value.replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTargetId])

  const isHttp = service === 'http-get' || service === 'http-post-form'

  return (
    <div className="space-y-3">
      {/* Rate-limit warning */}
      <div className="flex items-start gap-2 px-2.5 py-2 bg-purple-500/5 border border-purple-500/20 rounded-lg">
        <AlertCircle size={10} className="text-purple-400 shrink-0 mt-0.5" />
        <p className="text-[9px] text-purple-400/80 leading-relaxed">
          Only use against systems you are authorized to test. Brute-force attacks may trigger account lockouts.
        </p>
      </div>

      {/* Target selector */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Target</span>
        <div className="relative">
          <select
            value={selectedTargetId}
            onChange={(e) => onTargetChange(e.target.value)}
            className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs text-gray-200 appearance-none focus:outline-none focus:border-purple-500/50 transition-colors"
          >
            <option value="">— manual entry below —</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>{t.value}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
        </div>
      </label>

      {/* Host */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Host / IP</span>
        <input
          type="text"
          value={host}
          onChange={(e) => onHostChange(e.target.value)}
          placeholder="192.168.1.1"
          className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-700 focus:outline-none focus:border-purple-500/50 transition-colors"
        />
      </label>

      {/* Service */}
      <div>
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Service</span>
        <div className="flex flex-wrap gap-1">
          {HYDRA_SERVICES.map((s) => (
            <button
              key={s.id}
              onClick={() => onServiceChange(s.id)}
              className={cn(
                'px-2 py-0.5 text-[10px] font-medium rounded border transition-colors',
                service === s.id
                  ? 'text-purple-300 border-purple-500/50 bg-purple-500/10'
                  : 'text-gray-700 border-[#2a2a32] hover:text-gray-500',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Profile */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Profile</span>
        <div className="relative">
          <select
            value={selectedProfile}
            onChange={(e) => onProfileChange(e.target.value)}
            disabled={isLoadingProfiles}
            className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs text-gray-200 appearance-none focus:outline-none focus:border-purple-500/50 transition-colors disabled:opacity-50"
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

      {/* Username / userlist */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">
          Username <span className="text-gray-700 normal-case">(or leave blank for list)</span>
        </span>
        <input
          type="text"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          placeholder="admin"
          className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-700 focus:outline-none focus:border-purple-500/50 transition-colors"
        />
      </label>
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">
          Username list <span className="text-gray-700 normal-case">(optional path)</span>
        </span>
        <input
          type="text"
          value={userlist}
          onChange={(e) => onUserlistChange(e.target.value)}
          placeholder="/usr/share/wordlists/metasploit/unix_users.txt"
          className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-700 focus:outline-none focus:border-purple-500/50 transition-colors"
        />
      </label>

      {/* Password list */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Password list</span>
        <input
          type="text"
          value={passlist}
          onChange={(e) => onPasslistChange(e.target.value)}
          placeholder="/usr/share/wordlists/rockyou.txt"
          className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-700 focus:outline-none focus:border-purple-500/50 transition-colors"
        />
      </label>

      {/* HTTP path — only for http services */}
      {isHttp && (
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">HTTP path</span>
          <input
            type="text"
            value={httpPath}
            onChange={(e) => onHttpPathChange(e.target.value)}
            placeholder="/login"
            className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-700 focus:outline-none focus:border-purple-500/50 transition-colors"
          />
        </label>
      )}

      {/* Threads + stop toggle */}
      <div className="flex items-end gap-3">
        <label className="flex-1 block">
          <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Threads</span>
          <input
            type="number"
            min={1}
            max={64}
            value={threads}
            onChange={(e) => onThreadsChange(e.target.value)}
            className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-purple-500/50 transition-colors"
          />
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none mb-2">
          <div
            onClick={() => onStopOnFirstChange(!stopOnFirst)}
            className={cn(
              'w-8 h-4 rounded-full transition-colors relative',
              stopOnFirst ? 'bg-purple-500/40' : 'bg-[#2a2a32]',
            )}
          >
            <div className={cn(
              'absolute top-0.5 w-3 h-3 rounded-full transition-transform',
              stopOnFirst ? 'translate-x-4 bg-purple-400' : 'translate-x-0.5 bg-gray-600',
            )} />
          </div>
          <span className="text-[10px] text-gray-600">Stop on hit</span>
        </label>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hydra results panel
// ---------------------------------------------------------------------------

function HydraResultsPanel({ parsed }: { parsed: Record<string, unknown> }) {
  const creds = (parsed.credentials as HydraCredential[]) ?? []
  const total = (parsed.total_found as number) ?? creds.length

  if (creds.length === 0) {
    return (
      <div className="shrink-0 border-t border-[#2a2a32] px-4 py-4 flex items-center gap-2 text-xs text-gray-600">
        <CheckCircle2 size={12} className="text-gray-600/60" />
        No credentials found.
      </div>
    )
  }

  return (
    <div className="shrink-0 border-t border-[#2a2a32]" style={{ maxHeight: '40%' }}>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#2a2a32]">
        <Server size={11} className="text-purple-400" />
        <span className="text-[10px] font-medium text-gray-300">Credentials Found ({total})</span>
      </div>
      <div className="overflow-auto" style={{ maxHeight: 'calc(40vh - 36px)' }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-gray-700 border-b border-[#2a2a32]">
              <th className="text-left px-4 py-2">Service</th>
              <th className="text-left px-4 py-2">Host</th>
              <th className="text-left px-4 py-2">Username</th>
              <th className="text-left px-4 py-2">Password</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e1e24]">
            {creds.map((c, i) => (
              <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-2">
                  <span className="text-[9px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/30 rounded px-1.5 py-0.5">
                    {c.service}:{c.port}
                  </span>
                </td>
                <td className="px-4 py-2 font-mono text-gray-400 text-[10px]">{c.host}</td>
                <td className="px-4 py-2 font-mono text-green-400/90 font-medium">{c.username}</td>
                <td className="px-4 py-2 font-mono text-yellow-400/90 font-medium">{c.password}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SearchSploit form
// ---------------------------------------------------------------------------

const SPLOIT_SEV_BADGE: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/30',
  high:     'text-orange-400 bg-orange-500/10 border-orange-500/30',
  medium:   'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  low:      'text-blue-400 bg-blue-500/10 border-blue-500/30',
  info:     'text-gray-400 bg-gray-500/10 border-gray-500/20',
}

interface SearchSploitFormProps {
  profiles: { name: string; description: string; config: Record<string, unknown> }[]
  isLoadingProfiles: boolean
  selectedProfile: string
  onProfileChange: (v: string) => void
  query: string
  onQueryChange: (v: string) => void
  titleOnly: boolean
  onTitleOnlyChange: (v: boolean) => void
  resultType: string
  onResultTypeChange: (v: string) => void
}

const SPLOIT_RESULT_TYPES = [
  { id: 'all',       label: 'All' },
  { id: 'exploits',  label: 'Exploits' },
  { id: 'shellcode', label: 'Shellcode' },
] as const

function SearchSploitForm({
  profiles, isLoadingProfiles, selectedProfile, onProfileChange,
  query, onQueryChange, titleOnly, onTitleOnlyChange,
  resultType, onResultTypeChange,
}: SearchSploitFormProps) {
  const currentProfile = profiles.find((p) => p.name === selectedProfile)

  useEffect(() => {
    if (currentProfile?.config) {
      const c = currentProfile.config as Record<string, unknown>
      if (typeof c.title_only === 'boolean') onTitleOnlyChange(c.title_only)
      if (c.type) onResultTypeChange(String(c.type))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfile])

  return (
    <div className="space-y-3">
      {/* Query */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Search query</span>
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Apache 2.4.49 or CVE-2021-41773"
          className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-700 focus:outline-none focus:border-green-500/50 transition-colors"
        />
        <p className="mt-1 text-[9px] text-gray-700">Multiple terms are AND-ed. Searches local Exploit-DB copy.</p>
      </label>

      {/* Profile */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Profile</span>
        <div className="relative">
          <select
            value={selectedProfile}
            onChange={(e) => onProfileChange(e.target.value)}
            disabled={isLoadingProfiles}
            className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-2 text-xs text-gray-200 appearance-none focus:outline-none focus:border-green-500/50 transition-colors disabled:opacity-50"
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

      {/* Result type */}
      <div>
        <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Type</span>
        <div className="flex gap-1">
          {SPLOIT_RESULT_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => onResultTypeChange(t.id)}
              className={cn(
                'flex-1 py-1.5 text-[10px] font-medium rounded border transition-colors',
                resultType === t.id
                  ? 'bg-green-500/20 border-green-500/50 text-green-300'
                  : 'bg-transparent border-[#2a2a32] text-gray-600 hover:text-gray-400',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Title-only toggle */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <div
          onClick={() => onTitleOnlyChange(!titleOnly)}
          className={cn(
            'w-8 h-4 rounded-full transition-colors relative',
            titleOnly ? 'bg-green-500/40' : 'bg-[#2a2a32]',
          )}
        >
          <div className={cn(
            'absolute top-0.5 w-3 h-3 rounded-full transition-transform',
            titleOnly ? 'translate-x-4 bg-green-400' : 'translate-x-0.5 bg-gray-600',
          )} />
        </div>
        <span className="text-[10px] text-gray-600">Title search only</span>
      </label>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SearchSploit results panel
// ---------------------------------------------------------------------------

function SearchSploitResultsPanel({ parsed }: { parsed: Record<string, unknown> }) {
  const exploits   = (parsed.exploits   as SearchSploitExploit[]) ?? []
  const shellcodes = (parsed.shellcodes as SearchSploitExploit[]) ?? []
  const query      = (parsed.query      as string) ?? ''
  const total      = (parsed.total_found as number) ?? (exploits.length + shellcodes.length)
  const [tab, setTab] = useState<'exploits' | 'shellcode'>('exploits')
  const [selected, setSelected] = useState<SearchSploitExploit | null>(null)

  const rows = tab === 'exploits' ? exploits : shellcodes

  if (exploits.length === 0 && shellcodes.length === 0) {
    return (
      <div className="shrink-0 border-t border-[#2a2a32] px-4 py-4 flex items-center gap-2 text-xs text-gray-600">
        <CheckCircle2 size={12} className="text-gray-600/60" />
        No exploits found{query ? ` for "${query}"` : ''}.
      </div>
    )
  }

  return (
    <div className="shrink-0 border-t border-[#2a2a32] flex" style={{ maxHeight: '48%' }}>
      {/* Left: list */}
      <div className="flex flex-col border-r border-[#2a2a32]" style={{ width: '55%' }}>
        {/* Tabs */}
        <div className="flex items-center gap-0 border-b border-[#2a2a32] px-3 shrink-0">
          <TabButton active={tab === 'exploits'} onClick={() => setTab('exploits')}>
            <Search size={10} /> Exploits ({exploits.length})
          </TabButton>
          {shellcodes.length > 0 && (
            <TabButton active={tab === 'shellcode'} onClick={() => setTab('shellcode')}>
              Shellcode ({shellcodes.length})
            </TabButton>
          )}
          <span className="ml-auto text-[9px] text-gray-700 pr-2">{total} total</span>
        </div>
        {/* Table */}
        <div className="overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-gray-700 border-b border-[#2a2a32]">
                <th className="text-left px-3 py-1.5">Sev</th>
                <th className="text-left px-3 py-1.5">EDB-ID</th>
                <th className="text-left px-3 py-1.5">Title</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e24]">
              {rows.map((e, i) => (
                <tr
                  key={i}
                  onClick={() => setSelected(selected === e ? null : e)}
                  className={cn(
                    'cursor-pointer hover:bg-white/[0.03] transition-colors',
                    selected === e && 'bg-white/[0.05]',
                  )}
                >
                  <td className="px-3 py-1.5">
                    <span className={cn(
                      'inline-flex text-[9px] font-medium border rounded px-1 py-0.5 uppercase',
                      SPLOIT_SEV_BADGE[e.severity] ?? SPLOIT_SEV_BADGE.info,
                    )}>
                      {e.severity}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-green-400/80 text-[9px]">{e.edb_id}</td>
                  <td className="px-3 py-1.5 text-gray-400 truncate max-w-[180px]" title={e.title}>{e.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Right: detail */}
      <div className="flex-1 overflow-y-auto p-3">
        {selected ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className={cn(
                'inline-flex text-[9px] font-medium border rounded px-1.5 py-0.5 uppercase shrink-0',
                SPLOIT_SEV_BADGE[selected.severity] ?? SPLOIT_SEV_BADGE.info,
              )}>
                {selected.severity}
              </span>
              <p className="text-[10px] font-semibold text-gray-200 leading-tight">{selected.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-gray-700">EDB-ID</p>
                <p className="text-[10px] font-mono text-green-400">{selected.edb_id}</p>
              </div>
              {selected.cve && (
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-gray-700">CVE</p>
                  <p className="text-[10px] font-mono text-blue-400">{selected.cve}</p>
                </div>
              )}
              <div>
                <p className="text-[9px] uppercase tracking-wider text-gray-700">Type</p>
                <p className="text-[10px] text-gray-400">{selected.type}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-gray-700">Platform</p>
                <p className="text-[10px] text-gray-400">{selected.platform}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-gray-700">Date</p>
                <p className="text-[10px] text-gray-500">{selected.date}</p>
              </div>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-gray-700 mb-0.5">Path</p>
              <p className="text-[9px] font-mono text-gray-600 break-all leading-relaxed">{selected.path}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-[10px] text-gray-700">
            Click an exploit to see details
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Nmap → SearchSploit auto-lookup panel
// ---------------------------------------------------------------------------

function NmapAutoLookupPanel({
  ports,
  onSearch,
}: {
  ports: Port[]
  onSearch: (query: string) => void
}) {
  // Extract unique service+version strings from ports that have version info
  const serviceQueries = [...new Set(
    ports
      .filter((p) => p.service && p.state === 'open')
      .map((p) => {
        const svc = p.service ?? ''
        const ver = p.version ?? ''
        // Build a short but meaningful query: "apache 2.4.49" style
        const combined = [svc, ver].filter(Boolean).join(' ').trim()
        // Trim version to first two components to avoid over-specific queries
        const simplified = combined.replace(/(\d+\.\d+)\.\S+/g, '$1')
        return simplified
      })
      .filter(Boolean)
  )].slice(0, 8) // cap at 8 to avoid cluttering

  if (serviceQueries.length === 0) return null

  return (
    <div className="shrink-0 border-t border-[#2a2a32] px-4 py-2.5">
      <div className="flex items-center gap-2 mb-2">
        <Search size={10} className="text-green-500/70" />
        <span className="text-[10px] font-medium text-gray-500">SearchSploit Auto-Lookup</span>
        <button
          onClick={() => onSearch(serviceQueries.join(' '))}
          className="ml-auto text-[9px] text-green-500/70 hover:text-green-400 border border-green-500/20 hover:border-green-500/40 rounded px-1.5 py-0.5 transition-colors"
        >
          Search All
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {serviceQueries.map((q, i) => (
          <button
            key={i}
            onClick={() => onSearch(q)}
            className="text-[9px] font-mono text-gray-500 hover:text-green-400 bg-[#16161a] hover:bg-green-500/5 border border-[#2a2a32] hover:border-green-500/30 rounded px-2 py-0.5 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Coming soon placeholder
// ---------------------------------------------------------------------------

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

  // ---- nikto form state ----
  const [niktoTargetId, setNiktoTargetId] = useState('')
  const [niktoProfile, setNiktoProfile] = useState('')
  const [niktoUrl, setNiktoUrl] = useState('')
  const [niktoTuning, setNiktoTuning] = useState<string[]>([])
  const [niktoSsl, setNiktoSsl] = useState(false)
  const [niktoTimeout, setNiktoTimeout] = useState('10')
  const [niktoMaxtime, setNiktoMaxtime] = useState('')

  // ---- searchsploit form state ----
  const [sploitProfile, setSploitProfile] = useState('')
  const [sploitQuery, setSploitQuery] = useState('')
  const [sploitTitleOnly, setSploitTitleOnly] = useState(false)
  const [sploitResultType, setSploitResultType] = useState('all')

  // ---- hydra form state ----
  const [hydraTargetId, setHydraTargetId] = useState('')
  const [hydraProfile, setHydraProfile] = useState('')
  const [hydraHost, setHydraHost] = useState('')
  const [hydraService, setHydraService] = useState('ssh')
  const [hydraUsername, setHydraUsername] = useState('')
  const [hydraUserlist, setHydraUserlist] = useState('')
  const [hydraPasslist, setHydraPasslist] = useState('')
  const [hydraThreads, setHydraThreads] = useState('16')
  const [hydraStopOnFirst, setHydraStopOnFirst] = useState(true)
  const [hydraHttpPath, setHydraHttpPath] = useState('/')

  // ---- nuclei form state ----
  const [nucleiTargetId, setNucleiTargetId] = useState('')
  const [nucleiProfile, setNucleiProfile] = useState('')
  const [nucleiUrl, setNucleiUrl] = useState('')
  const [nucleiSeverities, setNucleiSeverities] = useState<SeverityLevel[]>([])
  const [nucleiTags, setNucleiTags] = useState('')
  const [nucleiTemplates, setNucleiTemplates] = useState('')
  const [nucleiThreads, setNucleiThreads] = useState('25')

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
    } else if (selectedTool === 'nuclei') {
      config = {
        url: nucleiUrl,
        threads: parseInt(nucleiThreads, 10) || 25,
      }
      if (nucleiSeverities.length > 0) config.severity = nucleiSeverities.join(',')
      if (nucleiTags) config.tags = nucleiTags
      if (nucleiTemplates) config.templates = nucleiTemplates
      if (nucleiTargetId) targetId = nucleiTargetId
    } else if (selectedTool === 'nikto') {
      config = { url: niktoUrl, timeout: parseInt(niktoTimeout, 10) || 10 }
      if (niktoTuning.length > 0) config.tuning = niktoTuning.join('')
      if (niktoSsl) config.ssl = true
      if (niktoMaxtime) config.maxtime = niktoMaxtime
      if (niktoTargetId) targetId = niktoTargetId
    } else if (selectedTool === 'hydra') {
      config = {
        host: hydraHost,
        service: hydraService,
        threads: parseInt(hydraThreads, 10) || 16,
        stop_on_first: hydraStopOnFirst,
      }
      if (hydraUsername) config.username = hydraUsername
      if (hydraUserlist) config.userlist = hydraUserlist
      if (hydraPasslist) config.passlist = hydraPasslist
      if (hydraHttpPath && (hydraService === 'http-get' || hydraService === 'http-post-form')) {
        config.http_path = hydraHttpPath
      }
      if (hydraTargetId) targetId = hydraTargetId
    } else if (selectedTool === 'searchsploit') {
      config = {
        query: sploitQuery,
        title_only: sploitTitleOnly,
        type: sploitResultType,
      }
    }

    const activeProfile =
      selectedTool === 'nmap'     ? nmapProfile
      : selectedTool === 'gobuster' ? gobusterProfile
      : selectedTool === 'nuclei'   ? nucleiProfile
      : selectedTool === 'nikto'    ? niktoProfile
      : selectedTool === 'hydra'        ? hydraProfile
      : selectedTool === 'searchsploit' ? sploitProfile
      : null

    try {
      await startScan(
        activeProject.id,
        targetId,
        selectedTool,
        activeProfile || null,
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

  // Auto-lookup: called from NmapAutoLookupPanel — fires a SearchSploit scan immediately
  const handleAutoLookup = async (query: string) => {
    if (!activeProject) return
    try {
      await startScan(activeProject.id, null, 'searchsploit', null, {
        query,
        title_only: true,
        type: 'exploits',
      })
    } catch (e) {
      useScanStore.setState({ error: (e as Error).message })
    }
  }

  // ---- Can start? ----
  const canStart = (() => {
    if (isRunning) return false
    if (selectedTool === 'nmap') return !!(nmapFlags || nmapProfile)
    if (selectedTool === 'gobuster') return !!(gobusterUrl && gobusterWordlist)
    if (selectedTool === 'nuclei') return !!nucleiUrl
    if (selectedTool === 'nikto') return !!niktoUrl
    if (selectedTool === 'hydra') return !!(hydraHost && hydraPasslist)
    if (selectedTool === 'searchsploit') return !!sploitQuery.trim()
    return false
  })()

  const startBtnCls = cn(
    'w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-white rounded-lg transition-colors',
    canStart ? `bg-opacity-90 hover:bg-opacity-100` : 'opacity-30 cursor-not-allowed',
    selectedTool === 'nmap'     && (canStart ? 'bg-blue-600 hover:bg-blue-500'     : 'bg-blue-600'),
    selectedTool === 'gobuster' && (canStart ? 'bg-orange-600 hover:bg-orange-500' : 'bg-orange-600'),
    selectedTool === 'nuclei'   && (canStart ? 'bg-red-700 hover:bg-red-600'         : 'bg-red-700'),
    selectedTool === 'nikto'    && (canStart ? 'bg-yellow-700 hover:bg-yellow-600'   : 'bg-yellow-700'),
    selectedTool === 'hydra'        && (canStart ? 'bg-purple-700 hover:bg-purple-600'  : 'bg-purple-700'),
    selectedTool === 'searchsploit' && (canStart ? 'bg-green-800 hover:bg-green-700'   : 'bg-green-800'),
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
          {selectedTool === 'nuclei' && (
            <NucleiForm
              targets={targets}
              selectedTargetId={nucleiTargetId}
              onTargetChange={setNucleiTargetId}
              profiles={profiles}
              isLoadingProfiles={isLoadingProfiles}
              selectedProfile={nucleiProfile}
              onProfileChange={setNucleiProfile}
              url={nucleiUrl}
              onUrlChange={setNucleiUrl}
              severities={nucleiSeverities}
              onSeveritiesChange={setNucleiSeverities}
              tags={nucleiTags}
              onTagsChange={setNucleiTags}
              templates={nucleiTemplates}
              onTemplatesChange={setNucleiTemplates}
              threads={nucleiThreads}
              onThreadsChange={setNucleiThreads}
            />
          )}
          {selectedTool === 'nikto' && (
            <NiktoForm
              targets={targets}
              selectedTargetId={niktoTargetId}
              onTargetChange={setNiktoTargetId}
              profiles={profiles}
              isLoadingProfiles={isLoadingProfiles}
              selectedProfile={niktoProfile}
              onProfileChange={setNiktoProfile}
              url={niktoUrl}
              onUrlChange={setNiktoUrl}
              tuning={niktoTuning}
              onTuningChange={setNiktoTuning}
              ssl={niktoSsl}
              onSslChange={setNiktoSsl}
              timeout={niktoTimeout}
              onTimeoutChange={setNiktoTimeout}
              maxtime={niktoMaxtime}
              onMaxtimeChange={setNiktoMaxtime}
            />
          )}
          {selectedTool === 'hydra' && (
            <HydraForm
              targets={targets}
              selectedTargetId={hydraTargetId}
              onTargetChange={setHydraTargetId}
              profiles={profiles}
              isLoadingProfiles={isLoadingProfiles}
              selectedProfile={hydraProfile}
              onProfileChange={setHydraProfile}
              host={hydraHost}
              onHostChange={setHydraHost}
              service={hydraService}
              onServiceChange={setHydraService}
              username={hydraUsername}
              onUsernameChange={setHydraUsername}
              userlist={hydraUserlist}
              onUserlistChange={setHydraUserlist}
              passlist={hydraPasslist}
              onPasslistChange={setHydraPasslist}
              threads={hydraThreads}
              onThreadsChange={setHydraThreads}
              stopOnFirst={hydraStopOnFirst}
              onStopOnFirstChange={setHydraStopOnFirst}
              httpPath={hydraHttpPath}
              onHttpPathChange={setHydraHttpPath}
            />
          )}
          {selectedTool === 'searchsploit' && (
            <SearchSploitForm
              profiles={profiles}
              isLoadingProfiles={isLoadingProfiles}
              selectedProfile={sploitProfile}
              onProfileChange={setSploitProfile}
              query={sploitQuery}
              onQueryChange={setSploitQuery}
              titleOnly={sploitTitleOnly}
              onTitleOnlyChange={setSploitTitleOnly}
              resultType={sploitResultType}
              onResultTypeChange={setSploitResultType}
            />
          )}
          {!['nmap', 'gobuster', 'nuclei', 'nikto', 'hydra', 'searchsploit'].includes(selectedTool) && (
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
                <>
                  <NmapResultsPanel hosts={results.hosts} ports={results.ports} />
                  <NmapAutoLookupPanel ports={results.ports} onSearch={handleAutoLookup} />
                </>
              )}
              {activeScan.tool === 'gobuster' && results.parsed && (
                <GobusterResultsPanel parsed={results.parsed} />
              )}
              {activeScan.tool === 'nuclei' && results.parsed && (
                <NucleiResultsPanel parsed={results.parsed} />
              )}
              {activeScan.tool === 'nikto' && results.parsed && (
                <NiktoResultsPanel parsed={results.parsed} />
              )}
              {activeScan.tool === 'hydra' && results.parsed && (
                <HydraResultsPanel parsed={results.parsed} />
              )}
              {activeScan.tool === 'searchsploit' && results.parsed && (
                <SearchSploitResultsPanel parsed={results.parsed} />
              )}
              {/* AI Scan Analysis (4.2) */}
              <AIScanAnalysisPanel
                scanId={activeScan.id}
                projectId={activeScan.project_id}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AI Scan Analysis Panel (4.2)
// ---------------------------------------------------------------------------

function AIScanAnalysisPanel({ scanId, projectId }: { scanId: string; projectId: string }): JSX.Element {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const handleAnalyse = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setOpen(true)
    try {
      const r = await fetch(`${BASE_API}/api/ai/analyse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          context_type: 'scan',
          context_id: scanId,
          prompt_type: 'analyse',
        }),
      })
      if (!r.ok) {
        const data = await r.json()
        throw new Error(data.detail ?? 'AI failed')
      }
      const data = await r.json()
      setResult(data.response ?? '')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-t border-[#2a2a32] mx-4 pt-3 pb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <BrainCircuit size={13} className="text-red-400/70" />
          <span className="text-xs text-gray-500 font-medium">AI Analysis</span>
          <span className="text-[9px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1 py-0.5 rounded">PRO</span>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <button onClick={() => navigator.clipboard.writeText(result)} className="text-gray-600 hover:text-gray-400 transition-colors">
              <Copy size={11} />
            </button>
          )}
          <button
            onClick={handleAnalyse}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 rounded-lg transition-colors disabled:opacity-40"
          >
            {loading ? <Loader2 size={10} className="animate-spin" /> : <BrainCircuit size={10} />}
            {loading ? 'Analysing…' : 'Analyse with AI'}
          </button>
        </div>
      </div>
      {error && <p className="text-[10px] text-red-400 font-mono">{error}</p>}
      {open && result && (
        <div className="bg-[#111114] border border-[#2a2a32] rounded-lg p-3 max-h-56 overflow-y-auto">
          <pre className="text-[11px] text-gray-300 whitespace-pre-wrap leading-relaxed">{result}</pre>
        </div>
      )}
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
