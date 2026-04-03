/**
 * AI Analysis Page — Phase 4
 *
 * Tabs:
 *  - Settings  : Provider configuration + connection test  (4.1)
 *  - Analyse   : Run analysis (scan / finding / host / project) (4.2–4.4, 4.7)
 *  - History   : Browse stored AI analyses
 */

import { useCallback, useEffect, useState } from 'react'
import {
  BrainCircuit, Sparkles, History, Settings2,
  CheckCircle2, XCircle, Loader2,
  RefreshCw, Copy, Trash2, ShieldCheck, Zap,
  FileText, AlertTriangle, Eye,
} from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'
import { cn } from '@/lib/utils'
import type { AIAnalysis, AISettings } from '@/types'
import { backendBase } from '@/lib/backend'

const BASE = backendBase()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'settings' | 'analyse' | 'history'
type AnalyseContextType = 'scan' | 'finding' | 'host' | 'project'
type PromptType = 'analyse' | 'false_positive' | 'exploits' | 'report'

interface AnalyseOption {
  context_type: AnalyseContextType
  prompt_type: PromptType
  label: string
  description: string
  icon: JSX.Element
}

const ANALYSE_OPTIONS: AnalyseOption[] = [
  {
    context_type: 'scan',
    prompt_type: 'analyse',
    label: 'Analyse Scan',
    description: 'Attack surface summary, key risks, recommended next steps.',
    icon: <Sparkles size={14} />,
  },
  {
    context_type: 'finding',
    prompt_type: 'false_positive',
    label: 'False Positive Check',
    description: 'Evaluate a finding for true/false positive with confidence reasoning.',
    icon: <ShieldCheck size={14} />,
  },
  {
    context_type: 'host',
    prompt_type: 'exploits',
    label: 'Suggest Exploits',
    description: 'Attack paths and CVE candidates for a specific host.',
    icon: <Zap size={14} />,
  },
  {
    context_type: 'project',
    prompt_type: 'report',
    label: 'Generate Report',
    description: 'Full pentest report — executive summary + technical findings.',
    icon: <FileText size={14} />,
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROVIDER_LABELS: Record<string, string> = {
  ollama: 'Ollama (Local)',
  openai: 'OpenAI',
  anthropic: 'Anthropic / Claude',
}

function MarkdownText({ text }: { text: string }): JSX.Element {
  // Very lightweight Markdown renderer — just headings + bold + lists
  const lines = text.split('\n')
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('### '))
          return <h3 key={i} className="text-xs font-semibold text-gray-200 mt-3 mb-1">{line.slice(4)}</h3>
        if (line.startsWith('## '))
          return <h2 key={i} className="text-sm font-semibold text-gray-100 mt-4 mb-1">{line.slice(3)}</h2>
        if (line.startsWith('# '))
          return <h1 key={i} className="text-base font-bold text-gray-100 mt-4 mb-1">{line.slice(2)}</h1>
        if (line.startsWith('- ') || line.startsWith('* '))
          return <div key={i} className="flex gap-2 text-xs text-gray-300"><span className="text-gray-600 mt-0.5">•</span><span>{line.slice(2)}</span></div>
        if (line.startsWith('---'))
          return <hr key={i} className="border-[#2a2a32] my-2" />
        if (line === '')
          return <div key={i} className="h-1" />
        return <p key={i} className="text-xs text-gray-300 leading-relaxed">{line}</p>
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settings Tab
// ---------------------------------------------------------------------------

function SettingsTab(): JSX.Element {
  const [cfg, setCfg] = useState<AISettings>({
    provider: 'ollama',
    ollama_url: 'http://localhost:11434',
    ollama_model: 'llama3.2',
    openai_api_key: '',
    openai_model: 'gpt-4o',
    anthropic_api_key: '',
    anthropic_model: 'claude-opus-4-6',
    sanitize_before_cloud: true,
    enabled: true,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    fetch(`${BASE}/api/ai/settings`)
      .then(r => r.json())
      .then(setCfg)
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const r = await fetch(`${BASE}/api/ai/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      })
      if (r.ok) {
        const data = await r.json()
        setCfg(data)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await fetch(`${BASE}/api/ai/test`, { method: 'POST' })
      const data = await r.json()
      setTestResult({ success: data.success, message: data.message })
    } catch (e) {
      setTestResult({ success: false, message: String(e) })
    } finally {
      setTesting(false)
    }
  }

  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-start gap-4">
      <label className="text-xs text-gray-500 w-36 shrink-0 pt-1.5">{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  )

  const Input = ({ value, onChange, placeholder, type = 'text' }: {
    value: string; onChange: (v: string) => void; placeholder?: string; type?: string
  }) => (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-red-500/50 placeholder-gray-700 transition-colors"
    />
  )

  return (
    <div className="max-w-2xl space-y-5">
      {/* Enabled */}
      <div className="flex items-center gap-3 p-4 bg-[#1a1a1f] border border-[#2a2a32] rounded-xl">
        <input type="checkbox" id="ai-enabled" checked={cfg.enabled}
          onChange={e => setCfg(p => ({ ...p, enabled: e.target.checked }))}
          className="accent-red-500" />
        <label htmlFor="ai-enabled" className="text-sm text-gray-200 cursor-pointer">
          AI Features Enabled
        </label>
        <span className="text-xs text-gray-500 ml-auto">Disable to suppress all AI prompts</span>
      </div>

      {/* Provider */}
      <div className="p-4 bg-[#1a1a1f] border border-[#2a2a32] rounded-xl space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Provider</h3>
        <F label="AI Provider">
          <select
            value={cfg.provider}
            onChange={e => setCfg(p => ({ ...p, provider: e.target.value as AISettings['provider'] }))}
            className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-red-500/50 transition-colors"
          >
            {Object.entries(PROVIDER_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </F>

        {/* Ollama */}
        {cfg.provider === 'ollama' && <>
          <F label="Ollama URL"><Input value={cfg.ollama_url} onChange={v => setCfg(p => ({ ...p, ollama_url: v }))} placeholder="http://localhost:11434" /></F>
          <F label="Model"><Input value={cfg.ollama_model} onChange={v => setCfg(p => ({ ...p, ollama_model: v }))} placeholder="llama3.2" /></F>
        </>}

        {/* OpenAI */}
        {cfg.provider === 'openai' && <>
          <F label="API Key"><Input type="password" value={cfg.openai_api_key} onChange={v => setCfg(p => ({ ...p, openai_api_key: v }))} placeholder="sk-..." /></F>
          <F label="Model"><Input value={cfg.openai_model} onChange={v => setCfg(p => ({ ...p, openai_model: v }))} placeholder="gpt-4o" /></F>
        </>}

        {/* Anthropic */}
        {cfg.provider === 'anthropic' && <>
          <F label="API Key"><Input type="password" value={cfg.anthropic_api_key} onChange={v => setCfg(p => ({ ...p, anthropic_api_key: v }))} placeholder="sk-ant-..." /></F>
          <F label="Model"><Input value={cfg.anthropic_model} onChange={v => setCfg(p => ({ ...p, anthropic_model: v }))} placeholder="claude-opus-4-6" /></F>
        </>}
      </div>

      {/* Privacy */}
      {cfg.provider !== 'ollama' && (
        <div className="p-4 bg-[#1a1a1f] border border-[#2a2a32] rounded-xl space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Privacy</h3>
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="sanitize"
              checked={cfg.sanitize_before_cloud}
              onChange={e => setCfg(p => ({ ...p, sanitize_before_cloud: e.target.checked }))}
              className="accent-red-500 mt-0.5"
            />
            <div>
              <label htmlFor="sanitize" className="text-xs text-gray-200 cursor-pointer block">
                Sanitize before sending to cloud
              </label>
              <p className="text-xs text-gray-600 mt-0.5">
                Replace IPs and hostnames with tokens (e.g. [IP-1], [HOST-2]) before sending data to {cfg.provider}. Restored in the response.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Test + Save */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleTest}
          disabled={testing}
          className="flex items-center gap-2 px-4 py-2 text-xs bg-[#1a1a1f] border border-[#2a2a32] hover:border-gray-500 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
        >
          {testing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Test Connection
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-40"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 size={12} /> Saved</span>}
      </div>

      {testResult && (
        <div className={cn(
          'flex items-start gap-2 p-3 rounded-lg text-xs border',
          testResult.success
            ? 'bg-green-500/5 border-green-500/20 text-green-300'
            : 'bg-red-500/5 border-red-500/20 text-red-300',
        )}>
          {testResult.success ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> : <XCircle size={13} className="shrink-0 mt-0.5" />}
          <span className="font-mono">{testResult.message}</span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Analyse Tab (4.2 – 4.4, 4.7)
// ---------------------------------------------------------------------------

function AnalyseTab(): JSX.Element {
  const { activeProject } = useProjectStore()
  const [selected, setSelected] = useState<AnalyseOption>(ANALYSE_OPTIONS[0])
  const [contextId, setContextId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AIAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  const needsContextId = selected.context_type !== 'project'

  const handleRun = async () => {
    if (!activeProject) { setError('Select a project first'); return }
    if (needsContextId && !contextId.trim()) { setError('Enter the context ID'); return }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const r = await fetch(`${BASE}/api/ai/analyse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: activeProject.id,
          context_type: selected.context_type,
          context_id: needsContextId ? contextId.trim() : activeProject.id,
          prompt_type: selected.prompt_type,
        }),
      })
      if (!r.ok) {
        const data = await r.json()
        throw new Error(data.detail ?? 'AI analysis failed')
      }
      setResult(await r.json())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    if (result?.response) navigator.clipboard.writeText(result.response)
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Left: options */}
      <div className="w-56 shrink-0 space-y-2">
        <p className="text-xs text-gray-500 mb-3">Choose analysis type:</p>
        {ANALYSE_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            onClick={() => { setSelected(opt); setResult(null); setError(null) }}
            className={cn(
              'w-full text-left px-3 py-2.5 rounded-lg border transition-colors',
              selected.label === opt.label
                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : 'bg-[#1a1a1f] border-[#2a2a32] text-gray-300 hover:border-gray-500',
            )}
          >
            <div className="flex items-center gap-2 text-xs font-medium mb-0.5">
              <span className={selected.label === opt.label ? 'text-red-400' : 'text-gray-500'}>{opt.icon}</span>
              {opt.label}
            </div>
            <p className="text-[10px] text-gray-500 leading-snug">{opt.description}</p>
          </button>
        ))}
      </div>

      {/* Right: input + result */}
      <div className="flex-1 flex flex-col gap-3 min-h-0">
        {!activeProject && (
          <div className="flex items-center gap-2 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg text-xs text-yellow-300">
            <AlertTriangle size={12} />
            No project selected. Open a project from the Dashboard.
          </div>
        )}

        {needsContextId && (
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              {selected.context_type === 'scan' ? 'Scan ID' :
               selected.context_type === 'finding' ? 'Finding ID' : 'Host ID'}
            </label>
            <input
              value={contextId}
              onChange={e => setContextId(e.target.value)}
              placeholder={`Paste the ${selected.context_type} UUID here`}
              className="w-full bg-[#16161a] border border-[#2a2a32] rounded-lg px-3 py-1.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-red-500/50 placeholder-gray-700 transition-colors"
            />
            <p className="text-[10px] text-gray-600 mt-1">
              Find the ID in the {selected.context_type === 'scan' ? 'Scan History' : 'Findings'} page.
            </p>
          </div>
        )}

        {selected.context_type === 'project' && activeProject && (
          <div className="p-3 bg-[#1a1a1f] border border-[#2a2a32] rounded-lg text-xs text-gray-400">
            Analysing project: <span className="text-gray-200 font-medium">{activeProject.name}</span>
          </div>
        )}

        <button
          onClick={handleRun}
          disabled={loading || !activeProject}
          className="self-start flex items-center gap-2 px-4 py-2 text-xs bg-red-500 hover:bg-red-600 disabled:bg-red-500/30 text-white rounded-lg transition-colors"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <BrainCircuit size={12} />}
          {loading ? 'Analysing…' : `Run ${selected.label}`}
        </button>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/5 border border-red-500/20 rounded-lg text-xs text-red-300">
            <XCircle size={12} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {result && (
          <div className="flex-1 overflow-hidden flex flex-col bg-[#1a1a1f] border border-[#2a2a32] rounded-xl">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2a2a32]">
              <div className="flex items-center gap-2">
                <BrainCircuit size={13} className="text-red-400" />
                <span className="text-xs font-medium text-gray-200">{selected.label}</span>
                <span className="text-[10px] text-gray-600 font-mono">
                  {result.provider} / {result.model}
                  {result.tokens_used ? ` · ${result.tokens_used} tokens` : ''}
                  {result.sanitized ? ' · sanitized' : ''}
                </span>
              </div>
              <button onClick={copyToClipboard} className="text-gray-500 hover:text-gray-300 transition-colors">
                <Copy size={12} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <MarkdownText text={result.response ?? ''} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// History Tab
// ---------------------------------------------------------------------------

function HistoryTab(): JSX.Element {
  const { activeProject } = useProjectStore()
  const [analyses, setAnalyses] = useState<AIAnalysis[]>([])
  const [selected, setSelected] = useState<AIAnalysis | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchHistory = useCallback(async () => {
    if (!activeProject) return
    setLoading(true)
    try {
      const r = await fetch(`${BASE}/api/ai/analyses?project_id=${activeProject.id}`)
      if (r.ok) setAnalyses(await r.json())
    } finally {
      setLoading(false)
    }
  }, [activeProject])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const handleDelete = async (id: string) => {
    await fetch(`${BASE}/api/ai/analyses/${id}`, { method: 'DELETE' })
    setAnalyses(p => p.filter(a => a.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const PROMPT_LABELS: Record<string, string> = {
    analyse: 'Scan Analysis',
    false_positive: 'False Positive Check',
    exploits: 'Exploit Suggestions',
    report: 'Report',
  }

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* List */}
      <div className="w-72 shrink-0 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">{analyses.length} analyses</span>
          <button onClick={fetchHistory} disabled={loading} className="text-gray-500 hover:text-gray-300">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {analyses.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-8">No analyses yet.</p>
          )}
          {analyses.map((a) => (
            <div
              key={a.id}
              onClick={() => setSelected(a)}
              className={cn(
                'group flex items-start gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors',
                selected?.id === a.id
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-[#1a1a1f] border-[#2a2a32] hover:border-gray-500',
              )}
            >
              <BrainCircuit size={12} className="text-gray-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-200 font-medium truncate">
                  {PROMPT_LABELS[a.prompt_type ?? ''] ?? a.prompt_type ?? 'Analysis'}
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                  {a.context_type} · {a.provider}/{a.model}
                </div>
                <div className="text-[10px] text-gray-600">{a.created_at.slice(0, 16)}</div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); handleDelete(a.id) }}
                className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600">
            <Eye size={24} className="mb-2" />
            <p className="text-xs">Select an analysis to view</p>
          </div>
        ) : (
          <div className="bg-[#1a1a1f] border border-[#2a2a32] rounded-xl">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#2a2a32]">
              <BrainCircuit size={13} className="text-red-400" />
              <span className="text-xs font-medium text-gray-200">
                {PROMPT_LABELS[selected.prompt_type ?? ''] ?? selected.prompt_type}
              </span>
              <span className="text-[10px] text-gray-600 ml-auto font-mono">
                {selected.provider}/{selected.model}
                {selected.tokens_used ? ` · ${selected.tokens_used} tokens` : ''}
                {selected.sanitized ? ' · sanitized' : ''}
              </span>
            </div>
            <div className="p-4">
              <MarkdownText text={selected.response ?? ''} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function AIPage(): JSX.Element {
  const [tab, setTab] = useState<Tab>('settings')

  const TABS: { id: Tab; label: string; icon: JSX.Element }[] = [
    { id: 'settings', label: 'Settings', icon: <Settings2 size={13} /> },
    { id: 'analyse', label: 'Analyse', icon: <Sparkles size={13} /> },
    { id: 'history', label: 'History', icon: <History size={13} /> },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2a2a32] shrink-0">
        <BrainCircuit size={16} className="text-red-400" />
        <h1 className="text-sm font-semibold text-gray-100">AI Analysis</h1>
        <span className="text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded">PRO</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[#2a2a32] shrink-0 px-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-xs border-b-2 transition-colors -mb-px',
              tab === t.id
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-gray-500 hover:text-gray-300',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {tab === 'settings' && <SettingsTab />}
        {tab === 'analyse' && <AnalyseTab />}
        {tab === 'history' && <HistoryTab />}
      </div>
    </div>
  )
}
