import { useEffect, useState, useCallback } from 'react'
import {
  CheckCircle2, XCircle, RefreshCw, Save, AlertCircle,
  Terminal, Folder, Clock, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [toolHealth, setToolHealth] = useState<ToolHealthResponse | null>(null)
  const [isLoadingHealth, setIsLoadingHealth] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Editable form state
  const [scanTimeout, setScanTimeout] = useState(600)
  const [toolPaths, setToolPaths] = useState<Record<string, string>>({})

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/settings`)
      if (res.ok) {
        const data: UserSettings = await res.json()
        setSettings(data)
        setScanTimeout(data.scan_timeout)
        setToolPaths(data.tool_paths ?? {})
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
  }, [fetchSettings, fetchToolHealth])

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

        {/* ---- About ------------------------------------------------- */}
        {settings && (
          <Section icon={<Info size={15} />} title="About">
            <dl className="space-y-1.5 text-xs">
              <AboutRow label="Version">{settings.version}</AboutRow>
              <AboutRow label="Environment">{settings.env}</AboutRow>
              <AboutRow label="Data Directory">
                <span className="font-mono text-gray-400 break-all">{settings.data_dir}</span>
              </AboutRow>
            </dl>
          </Section>
        )}

      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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

function AboutRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <span className="text-gray-600 w-32 shrink-0">{label}</span>
      <span className="text-gray-300">{children}</span>
    </div>
  )
}
