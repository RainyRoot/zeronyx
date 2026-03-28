import { useEffect, useState, useCallback } from 'react'
import {
  CheckCircle2, XCircle, RefreshCw, Save, AlertCircle,
  Terminal, Folder, Clock, Info, BrainCircuit, BookOpen, Download,
  KeyRound, ShieldCheck, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUpdateState } from '@/components/ui/update-banner'
import { useLicenseStore } from '@/stores/licenseStore'
import { UpgradeButton } from '@/components/common/UpgradeButton'

const BASE = 'http://127.0.0.1:8742'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserSettings {
  theme: string
  tool_paths: Record<string, string>
  scan_timeout: number
  data_dir: string
  version: string
  env: string
  obsidian_vault_path?: string
  obsidian_auto_sync?: boolean
}

interface ToolHealth {
  name: string
  installed: boolean
  binary_path: string | null
  custom_path: string | null
}

interface ToolHealthResponse {
  tools: ToolHealth[]
  installed_count: number
  total_count: number
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SettingsPage(): JSX.Element {
  const fetchLicense = useLicenseStore((s) => s.fetch)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [toolHealth, setToolHealth] = useState<ToolHealthResponse | null>(null)
  const [isLoadingHealth, setIsLoadingHealth] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Editable form state
  const [scanTimeout, setScanTimeout] = useState(600)
  const [toolPaths, setToolPaths] = useState<Record<string, string>>({})
  const [obsidianVaultPath, setObsidianVaultPath] = useState('')
  const [obsidianAutoSync, setObsidianAutoSync] = useState(false)

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/settings`)
      if (res.ok) {
        const data: UserSettings = await res.json()
        setSettings(data)
        setScanTimeout(data.scan_timeout)
        setToolPaths(data.tool_paths ?? {})
        setObsidianVaultPath(data.obsidian_vault_path ?? '')
        setObsidianAutoSync(data.obsidian_auto_sync ?? false)
      }
    } catch { /* ignore */ }
  }, [])

  const fetchToolHealth = useCallback(async () => {
    setIsLoadingHealth(true)
    try {
      const res = await fetch(`${BASE}/api/settings/tools/health`)
      if (res.ok) {
        const data: ToolHealthResponse = await res.json()
        setToolHealth(data)
      }
    } catch { /* ignore */ }
    setIsLoadingHealth(false)
  }, [])

  useEffect(() => {
    fetchSettings()
    fetchToolHealth()
    fetchLicense()
  }, [fetchSettings, fetchToolHealth, fetchLicense])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const res = await fetch(`${BASE}/api/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scan_timeout: scanTimeout,
          tool_paths: toolPaths,
          obsidian_vault_path: obsidianVaultPath,
          obsidian_auto_sync: obsidianAutoSync,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail ?? 'Save failed')
      }
      const updated: UserSettings = await res.json()
      setSettings(updated)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (e) {
      setSaveError((e as Error).message)
    }
    setIsSaving(false)
  }

  const handleRedetect = async () => {
    setIsLoadingHealth(true)
    try {
      const res = await fetch(`${BASE}/api/settings/tools/detect`, { method: 'POST' })
      if (res.ok) {
        const data: ToolHealthResponse = await res.json()
        setToolHealth(data)
      }
    } catch { /* ignore */ }
    setIsLoadingHealth(false)
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-100 mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-8">Configure tool paths, scan defaults, and application preferences.</p>

      <div className="space-y-6">

        {/* ---- Tool Health ------------------------------------------- */}
        <Section
          icon={<Terminal size={15} />}
          title="Tool Health"
          action={
            <button
              onClick={handleRedetect}
              disabled={isLoadingHealth}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={isLoadingHealth ? 'animate-spin' : ''} />
              Re-detect
            </button>
          }
        >
          {toolHealth ? (
            <>
              <p className="text-xs text-gray-500 mb-3">
                {toolHealth.installed_count} / {toolHealth.total_count} tools found on PATH.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {toolHealth.tools.map((tool) => (
                  <ToolHealthRow key={tool.name} tool={tool} />
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-600">Loading…</p>
          )}
        </Section>

        {/* ---- Tool Path Overrides ----------------------------------- */}
        <Section icon={<Folder size={15} />} title="Tool Path Overrides">
          <p className="text-xs text-gray-500 mb-3">
            Override auto-detected binary paths. Leave empty to use PATH detection.
          </p>
          <div className="space-y-2">
            {(toolHealth?.tools ?? []).map((tool) => (
              <div key={tool.name} className="flex items-center gap-3">
                <span className="text-xs font-mono text-gray-400 w-24 shrink-0">{tool.name}</span>
                <input
                  type="text"
                  value={toolPaths[tool.name] ?? ''}
                  onChange={(e) => setToolPaths((prev) => ({
                    ...prev,
                    [tool.name]: e.target.value,
                  }))}
                  placeholder={tool.binary_path ?? `auto-detect`}
                  className="flex-1 bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-1.5 text-xs font-mono text-gray-200 placeholder-gray-700 focus:outline-none focus:border-red-500/50 transition-colors"
                />
              </div>
            ))}
            {!toolHealth && (
              <p className="text-xs text-gray-700">Connect to backend to load tools.</p>
            )}
          </div>
        </Section>

        {/* ---- Scan Defaults ----------------------------------------- */}
        <Section icon={<Clock size={15} />} title="Scan Defaults">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-28">Timeout (seconds)</span>
              <input
                type="number"
                min={30}
                max={7200}
                value={scanTimeout}
                onChange={(e) => setScanTimeout(Number(e.target.value))}
                className="w-28 bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-red-500/50 transition-colors"
              />
            </label>
            <span className="text-xs text-gray-600">
              {scanTimeout >= 3600
                ? `${(scanTimeout / 3600).toFixed(1)}h`
                : `${Math.floor(scanTimeout / 60)}m ${scanTimeout % 60}s`}
            </span>
          </div>
        </Section>

        {/* ---- Obsidian Auto-Sync ----------------------------------- */}
        <Section icon={<BookOpen size={15} />} title="Obsidian Auto-Sync">
          <p className="text-xs text-gray-500 mb-3">
            Automatically write scan notes as Markdown into an Obsidian vault after each scan completes.
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-400 w-28 shrink-0">Vault Path</label>
              <input
                type="text"
                value={obsidianVaultPath}
                onChange={(e) => setObsidianVaultPath(e.target.value)}
                placeholder="/path/to/your/ObsidianVault"
                className="flex-1 bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-1.5 text-xs font-mono text-gray-200 placeholder-gray-700 focus:outline-none focus:border-red-500/50 transition-colors"
              />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={obsidianAutoSync}
                onChange={(e) => setObsidianAutoSync(e.target.checked)}
                className="accent-red-500"
              />
              <span className="text-xs text-gray-300">Auto-sync after each scan</span>
              <span className="text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded">PRO</span>
            </label>
          </div>
        </Section>

        {/* ---- AI Link ----------------------------------------------- */}
        <Section icon={<BrainCircuit size={15} />} title="AI Settings">
          <p className="text-xs text-gray-500">
            Configure AI provider (Ollama, OpenAI, Anthropic) and API keys in the{' '}
            <span className="text-red-400 font-medium">AI Analysis</span> page.
          </p>
        </Section>

        {/* ---- Save -------------------------------------------------- */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-red-500 hover:bg-red-600 disabled:bg-red-500/40 text-white rounded-lg transition-colors"
          >
            <Save size={12} />
            {isSaving ? 'Saving…' : 'Save Settings'}
          </button>
          {saveSuccess && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle2 size={12} />
              Saved
            </span>
          )}
          {saveError && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <AlertCircle size={12} />
              {saveError}
            </span>
          )}
        </div>

        {/* ---- License ---------------------------------------------- */}
        <LicenseSection />

        {/* ---- About + Updater --------------------------------------- */}
        {settings && (
          <Section icon={<Info size={15} />} title="About">
            <dl className="space-y-1.5 text-xs mb-4">
              <AboutRow label="Version">{settings.version}</AboutRow>
              <AboutRow label="Environment">{settings.env}</AboutRow>
              <AboutRow label="Data Directory">
                <span className="font-mono text-gray-400 break-all">{settings.data_dir}</span>
              </AboutRow>
            </dl>
            <UpdateSection />
          </Section>
        )}

      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function UpdateSection() {
  const { state, checkForUpdates } = useUpdateState()
  const [checking, setChecking] = useState(false)
  const [checkedMsg, setCheckedMsg] = useState<string | null>(null)

  const handleCheck = async () => {
    setChecking(true)
    setCheckedMsg(null)
    await checkForUpdates()
    setChecking(false)
    setCheckedMsg('Check started — you will be notified if an update is available.')
    setTimeout(() => setCheckedMsg(null), 4000)
  }

  return (
    <div className="border-t border-[#2a2a32] pt-4 flex items-center justify-between gap-4">
      <div className="text-xs">
        {state.type === 'idle' && (
          <span className="text-gray-600">Auto-update enabled. Updates are checked on startup.</span>
        )}
        {state.type === 'available' && (
          <span className="text-blue-400">v{state.version} — downloading update…</span>
        )}
        {state.type === 'downloading' && (
          <span className="text-blue-400">Downloading update… {state.percent}%</span>
        )}
        {state.type === 'ready' && (
          <span className="text-emerald-400">v{state.version} ready! Restart to install.</span>
        )}
        {checkedMsg && !['available','downloading','ready'].includes(state.type) && (
          <span className="text-gray-500">{checkedMsg}</span>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        {state.type === 'ready' ? (
          <button
            onClick={() => window.updaterAPI?.installUpdate()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw size={12} />
            Restart & Install
          </button>
        ) : (
          <button
            onClick={handleCheck}
            disabled={checking || state.type === 'downloading'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#0f0f11] border border-[#2a2a32] text-gray-400 hover:text-gray-200 hover:border-[#3a3a42] disabled:opacity-40 rounded-lg transition-colors"
          >
            <Download size={12} className={checking ? 'animate-bounce' : ''} />
            Check for Updates
          </button>
        )}
      </div>
    </div>
  )
}

function Section({
  icon, title, action, children,
}: {
  icon: React.ReactNode
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-[#1a1a1f] border border-[#2a2a32] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-200">
          <span className="text-gray-500">{icon}</span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function ToolHealthRow({ tool }: { tool: ToolHealth }) {
  return (
    <div className={cn(
      'flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs',
      tool.installed
        ? 'bg-green-500/5 border-green-500/15 text-gray-300'
        : 'bg-red-500/5 border-red-500/15 text-gray-500',
    )}>
      {tool.installed
        ? <CheckCircle2 size={12} className="text-green-400 shrink-0" />
        : <XCircle      size={12} className="text-red-500/70 shrink-0" />
      }
      <span className="font-mono font-medium">{tool.name}</span>
      {tool.installed && tool.binary_path && (
        <span className="text-gray-600 truncate text-[10px] ml-auto" title={tool.binary_path}>
          {tool.binary_path.split('/').pop()}
        </span>
      )}
      {!tool.installed && (
        <span className="text-[10px] text-gray-700 ml-auto">not found</span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// License section
// ---------------------------------------------------------------------------

function LicenseSection() {
  const { status, loading, error, activate, deactivate } = useLicenseStore()
  const [keyInput, setKeyInput] = useState('')
  const [activating, setActivating] = useState(false)
  const [activateError, setActivateError] = useState<string | null>(null)
  const [activateSuccess, setActivateSuccess] = useState(false)

  const handleActivate = async () => {
    if (!keyInput.trim()) return
    setActivating(true)
    setActivateError(null)
    setActivateSuccess(false)
    try {
      await activate(keyInput.trim())
      setActivateSuccess(true)
      setKeyInput('')
      setTimeout(() => setActivateSuccess(false), 4000)
    } catch (e) {
      setActivateError((e as Error).message)
    }
    setActivating(false)
  }

  const handleDeactivate = async () => {
    await deactivate()
  }

  const tier = status?.tier ?? 'community'
  const tierLabel = tier === 'enterprise' ? 'Enterprise' : tier === 'pro' ? 'Pro' : 'Community'
  const tierColor =
    tier === 'enterprise'
      ? 'text-yellow-300 bg-yellow-500/10 border-yellow-500/25'
      : tier === 'pro'
      ? 'text-purple-300 bg-purple-500/10 border-purple-500/25'
      : 'text-gray-400 bg-gray-500/10 border-gray-500/20'

  return (
    <Section icon={<KeyRound size={15} />} title="License">
      {/* Current status */}
      <div className="flex items-center gap-3 mb-5">
        <span className={cn('flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border', tierColor)}>
          {tier === 'pro' || tier === 'enterprise'
            ? <ShieldCheck size={11} />
            : <Zap size={11} />}
          ZeroNyx {tierLabel}
        </span>
        {status?.activated && status.email && (
          <span className="text-xs text-gray-500">{status.email}</span>
        )}
        {status?.is_expired && (
          <span className="text-xs text-red-400 font-medium">License expired</span>
        )}
        {status?.expires_at && !status.is_expired && (
          <span className="text-xs text-gray-600">
            Expires {new Date(status.expires_at).toLocaleDateString()}
          </span>
        )}
        {status?.activated && !status.expires_at && (
          <span className="text-xs text-gray-600">Perpetual</span>
        )}
      </div>

      {/* Features unlocked */}
      {status?.activated && status.features.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {status.features.map((f) => (
            <span
              key={f}
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300"
            >
              {f}
            </span>
          ))}
        </div>
      )}

      {/* Activate input */}
      {!status?.activated && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500">
              Enter your Pro license key to unlock AI analysis, chain automation, plugin marketplace, and advanced reporting.
            </p>
            <UpgradeButton size="sm" label="Get Pro" className="shrink-0 ml-4" />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
              placeholder="Paste your license key here…"
              className="flex-1 bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-1.5 text-xs font-mono text-gray-200 placeholder-gray-700 focus:outline-none focus:border-purple-500/50 transition-colors"
            />
            <button
              onClick={handleActivate}
              disabled={activating || loading || !keyInput.trim()}
              className="px-4 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg transition-colors"
            >
              {activating ? 'Activating…' : 'Activate'}
            </button>
          </div>
          {activateError && (
            <p className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle size={11} /> {activateError}
            </p>
          )}
          {activateSuccess && (
            <p className="flex items-center gap-1.5 text-xs text-green-400">
              <CheckCircle2 size={11} /> License activated successfully!
            </p>
          )}
        </div>
      )}

      {/* Deactivate */}
      {status?.activated && (
        <div className="flex items-center justify-between border-t border-[#2a2a32] pt-4 mt-2">
          <div className="text-xs text-gray-600 font-mono truncate max-w-xs" title={status.machine_id}>
            Machine: {status.machine_id.slice(0, 16)}…
          </div>
          <button
            onClick={handleDeactivate}
            disabled={loading}
            className="text-xs text-gray-600 hover:text-red-400 transition-colors disabled:opacity-40"
          >
            Deactivate
          </button>
        </div>
      )}

      {error && !activateError && (
        <p className="text-xs text-red-400 mt-2">{error}</p>
      )}
    </Section>
  )
}

function AboutRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <span className="text-gray-600 w-32 shrink-0">{label}</span>
      <span className="text-gray-300">{children}</span>
    </div>
  )
}
