import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Puzzle, Upload, Trash2, ToggleLeft, ToggleRight,
  ShieldCheck, ShieldOff, Settings2, AlertTriangle,
  ChevronDown, ChevronUp, ExternalLink, FolderOpen,
  CheckCircle2, XCircle, Package, Store, Search,
  Star, Download, Tag, RefreshCw, Loader2,
} from 'lucide-react'
import { usePluginStore } from '@/stores/pluginStore'
import type { Plugin, PluginPermission } from '@/types'
import { cn } from '@/lib/utils'
import { backendBase } from '@/lib/backend'

const BASE = backendBase()

// ---------------------------------------------------------------------------
// Permission labels
// ---------------------------------------------------------------------------

const PERMISSION_LABELS: Record<PluginPermission, { label: string; risk: 'low' | 'medium' | 'high' }> = {
  'scan:read':         { label: 'Read scan results',        risk: 'low' },
  'scan:write':        { label: 'Create / modify scans',    risk: 'medium' },
  'findings:read':     { label: 'Read findings',            risk: 'low' },
  'findings:write':    { label: 'Create / modify findings', risk: 'medium' },
  'targets:read':      { label: 'Read targets',             risk: 'low' },
  'targets:write':     { label: 'Create / modify targets',  risk: 'medium' },
  'credentials:read':  { label: 'Read stored credentials',  risk: 'high' },
  'credentials:write': { label: 'Write credentials',        risk: 'high' },
  'hosts:read':        { label: 'Read host data',           risk: 'low' },
  'proxy:read':        { label: 'Read proxy history',       risk: 'medium' },
  'settings:read':     { label: 'Read app settings',        risk: 'medium' },
  'network:outbound':  { label: 'Make outbound network requests', risk: 'high' },
  'filesystem:read':   { label: 'Read local files',         risk: 'high' },
  'filesystem:write':  { label: 'Write local files',        risk: 'high' },
}

const RISK_COLORS = {
  low:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  high:   'text-red-400 bg-red-500/10 border-red-500/20',
}

// ---------------------------------------------------------------------------
// Marketplace types
// ---------------------------------------------------------------------------

interface MarketplacePlugin {
  id: string
  name: string
  version: string
  description: string
  author: string
  tags: string[]
  stars: number
  downloads: number
  download_url: string
  homepage: string
  requires_pro: boolean
  plugin_type: string
  permissions: string[]
}

// ---------------------------------------------------------------------------
// Permission Grant Dialog
// ---------------------------------------------------------------------------

function PermissionDialog({
  plugin,
  onConfirm,
  onCancel,
}: {
  plugin: Plugin
  onConfirm: () => void
  onCancel: () => void
}) {
  const hasHighRisk = plugin.permissions.some(
    (p) => PERMISSION_LABELS[p as PluginPermission]?.risk === 'high'
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#16161a] border border-[#2a2a32] rounded-xl w-full max-w-md mx-4 shadow-2xl">
        <div className="p-6 border-b border-[#2a2a32]">
          <div className="flex items-center gap-3 mb-1">
            <ShieldCheck size={20} className="text-yellow-400" />
            <h2 className="text-white font-semibold text-base">Grant Plugin Permissions</h2>
          </div>
          <p className="text-gray-400 text-sm">
            <span className="text-white font-medium">{plugin.name}</span> v{plugin.version} by {plugin.author}
          </p>
        </div>

        <div className="p-6 space-y-3">
          {hasHighRisk && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>This plugin requests high-risk permissions. Only install from trusted sources.</span>
            </div>
          )}

          <p className="text-gray-400 text-sm">This plugin requires the following permissions:</p>

          {plugin.permissions.length === 0 ? (
            <p className="text-gray-500 text-sm italic">No special permissions required.</p>
          ) : (
            <ul className="space-y-1.5">
              {plugin.permissions.map((perm) => {
                const info = PERMISSION_LABELS[perm as PluginPermission]
                const risk = info?.risk ?? 'medium'
                return (
                  <li key={perm} className="flex items-center justify-between gap-2">
                    <span className="text-gray-300 text-sm">{info?.label ?? perm}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${RISK_COLORS[risk]}`}>
                      {risk}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm text-gray-400 border border-[#2a2a32] rounded-lg hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors font-medium"
          >
            Grant & Enable
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Plugin settings panel
// ---------------------------------------------------------------------------

function PluginSettingsPanel({ plugin }: { plugin: Plugin }) {
  const { updateSettings } = usePluginStore()
  const [values, setValues] = useState<Record<string, unknown>>(plugin.settings_values ?? {})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const hasSettings = Object.keys(plugin.settings).length > 0
  if (!hasSettings) return <p className="text-gray-500 text-sm italic">No configurable settings.</p>

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSettings(plugin.id, values)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {Object.entries(plugin.settings).map(([key, schema]) => (
        <div key={key}>
          <label className="block text-xs text-gray-400 mb-1">
            {schema.label}
            {schema.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          {schema.type === 'boolean' ? (
            <input
              type="checkbox"
              checked={Boolean(values[key] ?? schema.default ?? false)}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.checked }))}
              className="w-4 h-4 accent-red-500"
            />
          ) : schema.type === 'select' ? (
            <select
              value={String(values[key] ?? schema.default ?? '')}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              className="w-full px-3 py-1.5 text-sm bg-[#0f0f11] border border-[#2a2a32] rounded-lg text-gray-200 focus:outline-none focus:border-red-500/50"
            >
              {(schema.options ?? []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <input
              type={schema.secret ? 'password' : 'text'}
              value={String(values[key] ?? schema.default ?? '')}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              placeholder={schema.description}
              className="w-full px-3 py-1.5 text-sm bg-[#0f0f11] border border-[#2a2a32] rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:border-red-500/50"
            />
          )}
          {schema.description && schema.type !== 'string' && (
            <p className="text-xs text-gray-600 mt-0.5">{schema.description}</p>
          )}
        </div>
      ))}

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-1.5 text-sm bg-red-600/80 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg transition-colors"
      >
        {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Plugin card
// ---------------------------------------------------------------------------

function PluginCard({ plugin }: { plugin: Plugin }) {
  const { toggle, grantPermissions, uninstall } = usePluginStore()
  const [expanded, setExpanded] = useState(false)
  const [showPermDialog, setShowPermDialog] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleToggle = () => toggle(plugin.id, !plugin.enabled)
  const handleGrantPerms = () => {
    if (!plugin.permissions_granted) {
      setShowPermDialog(true)
    } else {
      grantPermissions(plugin.id, false)
    }
  }

  const statusColor = plugin.error
    ? 'border-red-500/30'
    : plugin.enabled && plugin.permissions_granted
    ? 'border-emerald-500/20'
    : 'border-[#2a2a32]'

  return (
    <>
      {showPermDialog && (
        <PermissionDialog
          plugin={plugin}
          onConfirm={() => {
            grantPermissions(plugin.id, true)
            setShowPermDialog(false)
          }}
          onCancel={() => setShowPermDialog(false)}
        />
      )}

      <div className={`bg-[#111114] border ${statusColor} rounded-xl overflow-hidden transition-colors`}>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-[#1a1a22] border border-[#2a2a32] flex items-center justify-center shrink-0">
                <Puzzle size={16} className="text-gray-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-medium text-sm">{plugin.name}</span>
                  <span className="text-xs text-gray-600 font-mono">v{plugin.version}</span>
                  {plugin.enabled && plugin.permissions_granted && (
                    <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                      Active
                    </span>
                  )}
                  {plugin.error && (
                    <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <XCircle size={10} /> Error
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-xs mt-0.5 truncate">{plugin.description}</p>
                <p className="text-gray-600 text-xs">by {plugin.author}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleGrantPerms}
                title={plugin.permissions_granted ? 'Revoke permissions' : 'Grant permissions'}
                className={`p-1.5 rounded-lg transition-colors ${
                  plugin.permissions_granted
                    ? 'text-emerald-400 hover:bg-emerald-500/10'
                    : 'text-gray-600 hover:text-yellow-400 hover:bg-yellow-500/10'
                }`}
              >
                {plugin.permissions_granted ? <ShieldCheck size={15} /> : <ShieldOff size={15} />}
              </button>

              <button
                onClick={handleToggle}
                title={plugin.enabled ? 'Disable plugin' : 'Enable plugin'}
                className={`p-1.5 rounded-lg transition-colors ${
                  plugin.enabled
                    ? 'text-emerald-400 hover:bg-white/5'
                    : 'text-gray-600 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                {plugin.enabled ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
              </button>

              <button
                onClick={() => setExpanded((v) => !v)}
                title="Settings"
                className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors"
              >
                <Settings2 size={15} />
              </button>

              {confirmDelete ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => uninstall(plugin.id)}
                    className="px-2 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-500"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1 text-xs text-gray-400 rounded-lg hover:bg-white/5"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  title="Uninstall"
                  className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              )}

              <button
                onClick={() => setExpanded((v) => !v)}
                className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors"
              >
                {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            </div>
          </div>

          {plugin.error && (
            <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
              {plugin.error}
            </div>
          )}
        </div>

        {expanded && (
          <div className="border-t border-[#2a2a32] p-4 space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-gray-600">Plugin ID</span>
              <span className="text-gray-400 font-mono">{plugin.id}</span>
              <span className="text-gray-600">Type</span>
              <span className="text-gray-400">{plugin.plugin_type}</span>
              <span className="text-gray-600">UI Slots</span>
              <span className="text-gray-400">{plugin.ui_slots.join(', ') || '—'}</span>
              <span className="text-gray-600">Hooks</span>
              <span className="text-gray-400">{plugin.hooks.join(', ') || '—'}</span>
            </div>

            {plugin.permissions.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5 font-medium">Permissions</p>
                <div className="flex flex-wrap gap-1.5">
                  {plugin.permissions.map((perm) => {
                    const info = PERMISSION_LABELS[perm as PluginPermission]
                    const risk = info?.risk ?? 'medium'
                    return (
                      <span
                        key={perm}
                        className={`text-xs px-2 py-0.5 rounded-full border ${RISK_COLORS[risk]}`}
                      >
                        {info?.label ?? perm}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium">Settings</p>
              <PluginSettingsPanel plugin={plugin} />
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Install area
// ---------------------------------------------------------------------------

function InstallArea() {
  const { installFile, installDir, loading } = usePluginStore()
  const [dirPath, setDirPath] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError(null)
    try {
      await installFile(file)
    } catch (err) {
      setError(String(err))
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleInstallDir = async () => {
    if (!dirPath.trim()) return
    setError(null)
    try {
      await installDir(dirPath.trim())
      setDirPath('')
    } catch (err) {
      setError(String(err))
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileInput.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-red-500/50 bg-red-500/5'
            : 'border-[#2a2a32] hover:border-[#3a3a42] hover:bg-white/[0.02]'
        }`}
      >
        <Upload size={24} className="mx-auto mb-2 text-gray-600" />
        <p className="text-sm text-gray-400">Drop a <span className="text-gray-300 font-medium">.zeronyx-plugin</span> file here</p>
        <p className="text-xs text-gray-600 mt-1">or click to browse</p>
        <input
          ref={fileInput}
          type="file"
          accept=".zeronyx-plugin"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-[#0f0f11] border border-[#2a2a32] rounded-lg px-3 py-2">
          <FolderOpen size={14} className="text-gray-600 shrink-0" />
          <input
            type="text"
            value={dirPath}
            onChange={(e) => setDirPath(e.target.value)}
            placeholder="Local plugin directory path (dev mode)"
            className="flex-1 bg-transparent text-sm text-gray-300 placeholder-gray-600 focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && handleInstallDir()}
          />
        </div>
        <button
          onClick={handleInstallDir}
          disabled={!dirPath.trim() || loading}
          className="px-3 py-2 text-sm bg-[#1a1a22] border border-[#2a2a32] text-gray-400 hover:text-gray-200 hover:border-[#3a3a42] disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
        >
          Install Dir
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Marketplace tab
// ---------------------------------------------------------------------------

function MarketplaceTab({ installedIds }: { installedIds: Set<string> }) {
  const [plugins, setPlugins] = useState<MarketplacePlugin[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [installError, setInstallError] = useState<string | null>(null)
  const [installSuccess, setInstallSuccess] = useState<string | null>(null)
  const { fetchPlugins } = usePluginStore()

  const PER_PAGE = 20

  const fetchMarketplace = useCallback(async (pg: number, q: string, tag: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pg), per_page: String(PER_PAGE) })
      if (q) params.set('q', q)
      if (tag) params.set('tag', tag)
      const res = await fetch(`${BASE}/api/marketplace?${params}`)
      if (!res.ok) throw new Error('Failed to load marketplace')
      const data = await res.json()
      setPlugins(data.plugins ?? [])
      setTotal(data.total ?? 0)
    } catch { /* silent — marketplace may be unavailable offline */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetch(`${BASE}/api/marketplace/tags`)
      .then((r) => r.json())
      .then((d) => setTags(d.tags ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchMarketplace(page, query, activeTag)
  }, [page, query, activeTag, fetchMarketplace])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetch(`${BASE}/api/marketplace/refresh`, { method: 'POST' })
    await fetchMarketplace(page, query, activeTag)
    setRefreshing(false)
  }

  const handleInstall = async (plugin: MarketplacePlugin) => {
    setInstallingId(plugin.id)
    setInstallError(null)
    setInstallSuccess(null)
    try {
      const res = await fetch(`${BASE}/api/marketplace/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ download_url: plugin.download_url }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail ?? 'Installation failed')
      }
      setInstallSuccess(plugin.id)
      fetchPlugins()
      setTimeout(() => setInstallSuccess(null), 3000)
    } catch (e) {
      setInstallError((e as Error).message)
    }
    setInstallingId(null)
  }

  return (
    <div className="space-y-4">
      {/* Search + controls */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-[#111114] border border-[#2a2a32] rounded-lg px-3 py-2 focus-within:border-red-500/40 transition-colors">
          <Search size={14} className="text-gray-600 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
            placeholder="Search plugins…"
            className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none"
          />
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh registry"
          className="p-2 rounded-lg border border-[#2a2a32] text-gray-600 hover:text-gray-300 hover:border-[#3a3a42] disabled:opacity-40 transition-colors"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tag filters */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => { setActiveTag(''); setPage(1) }}
            className={cn(
              'text-[11px] px-2.5 py-1 rounded-full border transition-colors',
              !activeTag
                ? 'bg-red-500/15 border-red-500/30 text-red-300'
                : 'border-[#2a2a32] text-gray-500 hover:text-gray-300 hover:border-[#3a3a42]',
            )}
          >
            All
          </button>
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => { setActiveTag(t === activeTag ? '' : t); setPage(1) }}
              className={cn(
                'flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-colors',
                activeTag === t
                  ? 'bg-red-500/15 border-red-500/30 text-red-300'
                  : 'border-[#2a2a32] text-gray-500 hover:text-gray-300 hover:border-[#3a3a42]',
              )}
            >
              <Tag size={9} />{t}
            </button>
          ))}
        </div>
      )}

      {installError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          {installError}
        </div>
      )}

      {/* Plugin grid */}
      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#111114] border border-[#2a2a32] rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-[#2a2a32] rounded w-1/3 mb-2" />
              <div className="h-3 bg-[#2a2a32] rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : plugins.length === 0 ? (
        <div className="text-center py-16">
          <Store size={40} className="mx-auto mb-3 text-gray-700" />
          <p className="text-gray-500 text-sm font-medium">
            {query || activeTag ? 'No plugins match your search' : 'Marketplace unavailable'}
          </p>
          <p className="text-gray-600 text-xs mt-1">
            {query || activeTag
              ? 'Try a different search or clear the filters.'
              : 'Check your internet connection or try refreshing.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {plugins.map((mp) => {
            const isInstalled = installedIds.has(mp.id)
            const isInstalling = installingId === mp.id
            const justInstalled = installSuccess === mp.id

            return (
              <div
                key={mp.id}
                className="bg-[#111114] border border-[#2a2a32] hover:border-[#3a3a42] rounded-xl p-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#1a1a22] border border-[#2a2a32] flex items-center justify-center shrink-0">
                      <Store size={15} className="text-purple-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-medium text-sm">{mp.name}</span>
                        <span className="text-xs text-gray-600 font-mono">v{mp.version}</span>
                        {mp.requires_pro && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-purple-500/15 border border-purple-500/25 text-purple-300 rounded">PRO</span>
                        )}
                        {isInstalled && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded flex items-center gap-1">
                            <CheckCircle2 size={9} /> Installed
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs mt-0.5">{mp.description}</p>
                      <p className="text-gray-600 text-xs">by {mp.author}</p>

                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1 text-[11px] text-gray-600">
                          <Star size={10} className="text-yellow-600" /> {mp.stars.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-gray-600">
                          <Download size={10} /> {mp.downloads.toLocaleString()}
                        </span>
                        {mp.tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            onClick={() => { setActiveTag(t); setPage(1) }}
                            className="text-[10px] px-1.5 py-0.5 rounded-full border border-[#2a2a32] text-gray-600 hover:text-gray-400 cursor-pointer transition-colors"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {mp.homepage && (
                      <a
                        href={mp.homepage}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors"
                        title="View source"
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                    {justInstalled ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400 px-3 py-1.5">
                        <CheckCircle2 size={12} /> Done
                      </span>
                    ) : (
                      <button
                        onClick={() => handleInstall(mp)}
                        disabled={isInstalled || isInstalling}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors',
                          isInstalled
                            ? 'bg-[#1a1a22] border border-[#2a2a32] text-gray-600 cursor-default'
                            : 'bg-red-600/80 hover:bg-red-600 text-white disabled:opacity-50',
                        )}
                      >
                        {isInstalling ? (
                          <><Loader2 size={11} className="animate-spin" /> Installing…</>
                        ) : isInstalled ? (
                          <><CheckCircle2 size={11} /> Installed</>
                        ) : (
                          <><Download size={11} /> Install</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {total > PER_PAGE && (
        <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
          <span>{total} plugins total</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-[#2a2a32] hover:border-[#3a3a42] disabled:opacity-40 transition-colors"
            >
              Prev
            </button>
            <span className="px-3 py-1.5">Page {page} / {Math.ceil(total / PER_PAGE)}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(total / PER_PAGE)}
              className="px-3 py-1.5 rounded-lg border border-[#2a2a32] hover:border-[#3a3a42] disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type Tab = 'installed' | 'marketplace'

export default function PluginsPage() {
  const { plugins, loading, error, fetchPlugins } = usePluginStore()
  const [tab, setTab] = useState<Tab>('installed')

  useEffect(() => {
    fetchPlugins()
  }, [])

  const active = plugins.filter((p) => p.enabled && p.permissions_granted)
  const inactive = plugins.filter((p) => !p.enabled || !p.permissions_granted)
  const installedIds = new Set(plugins.map((p) => p.id))

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Puzzle size={20} className="text-red-400" />
            <h1 className="text-white font-semibold text-lg">Plugins</h1>
            {plugins.length > 0 && (
              <span className="text-xs text-gray-600 bg-[#1a1a22] border border-[#2a2a32] px-2 py-0.5 rounded-full">
                {plugins.length} installed
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm">
            Extend ZeroNyx with community and custom plugins.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <CheckCircle2 size={12} className="text-emerald-400" />
            {active.length} active
          </span>
          <span className="flex items-center gap-1">
            <XCircle size={12} className="text-gray-500" />
            {inactive.length} inactive
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[#2a2a32]">
        {([
          { id: 'installed', label: 'Installed', icon: <Puzzle size={13} /> },
          { id: 'marketplace', label: 'Marketplace', icon: <Store size={13} /> },
        ] as { id: Tab; label: string; icon: React.ReactNode }[]).map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === id
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-gray-500 hover:text-gray-300',
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'installed' && (
        <>
          {/* Install */}
          <div className="bg-[#111114] border border-[#2a2a32] rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <Package size={14} className="text-gray-500" />
              Install Plugin
            </h2>
            <InstallArea />
          </div>

          {/* Plugin list */}
          {loading && plugins.length === 0 && (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="bg-[#111114] border border-[#2a2a32] rounded-xl p-4 animate-pulse">
                  <div className="h-4 bg-[#2a2a32] rounded w-1/3 mb-2" />
                  <div className="h-3 bg-[#2a2a32] rounded w-2/3" />
                </div>
              ))}
            </div>
          )}

          {!loading && plugins.length === 0 && (
            <div className="text-center py-16">
              <Puzzle size={40} className="mx-auto mb-3 text-gray-700" />
              <p className="text-gray-500 text-sm font-medium">No plugins installed</p>
              <p className="text-gray-600 text-xs mt-1">
                Install a plugin from a <code className="text-gray-500">.zeronyx-plugin</code> file,{' '}
                local directory, or browse the{' '}
                <button onClick={() => setTab('marketplace')} className="text-red-400 hover:underline">
                  Marketplace
                </button>.
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {plugins.length > 0 && (
            <div className="space-y-3">
              {plugins.map((plugin) => (
                <PluginCard key={plugin.id} plugin={plugin} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'marketplace' && (
        <MarketplaceTab installedIds={installedIds} />
      )}
    </div>
  )
}
