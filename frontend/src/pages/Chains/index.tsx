/**
 * Chains Page — Phase 4.5/4.6
 *
 * Automated workflow engine.  Two tabs:
 *  - Templates  : Built-in standard chains — click to instantiate (4.6)
 *  - My Chains  : Create, edit, run custom chains (4.5)
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Workflow, Play, Plus, Trash2, RefreshCw, CheckCircle2,
  XCircle, Loader2, ChevronRight, Clock, AlertTriangle,
  Zap, Globe, Network, Server, Database,
} from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'
import { cn } from '@/lib/utils'
import type { Chain, ChainRun } from '@/types'
import { backendBase } from '@/lib/backend'

const BASE = backendBase()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Template {
  name: string
  description: string
  trigger_on: string
  steps: Array<{ id: string; type: string; tool?: string; label?: string; config: Record<string, unknown> }>
}

type Tab = 'templates' | 'chains'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TOOL_ICONS: Record<string, JSX.Element> = {
  nmap:         <Network size={11} />,
  gobuster:     <Globe size={11} />,
  nikto:        <Globe size={11} />,
  nuclei:       <Zap size={11} />,
  hydra:        <Server size={11} />,
  sqlmap:       <Database size={11} />,
  searchsploit: <Database size={11} />,
}

const STATUS_STYLE: Record<string, string> = {
  success:   'text-green-400',
  completed: 'text-green-400',
  failed:    'text-red-400',
  running:   'text-yellow-400',
  pending:   'text-gray-500',
}

function StatusDot({ status }: { status: string }): JSX.Element {
  return (
    <span className={cn('text-[10px] font-mono', STATUS_STYLE[status] ?? 'text-gray-500')}>
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Templates Tab
// ---------------------------------------------------------------------------

function TemplatesTab({ onInstantiate }: { onInstantiate: () => void }): JSX.Element {
  const { activeProject } = useProjectStore()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [instantiating, setInstantiating] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${BASE}/api/chains/templates`)
      .then(r => r.json())
      .then(d => setTemplates(d.templates ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleInstantiate = async (name: string) => {
    if (!activeProject) return
    setInstantiating(name)
    try {
      const r = await fetch(
        `${BASE}/api/chains/from-template?project_id=${activeProject.id}&template_name=${encodeURIComponent(name)}`,
        { method: 'POST' },
      )
      if (r.ok) {
        setDone(name)
        setTimeout(() => setDone(null), 3000)
        onInstantiate()
      }
    } finally {
      setInstantiating(null)
    }
  }

  if (loading) return <p className="text-xs text-gray-600 py-4">Loading templates…</p>

  return (
    <div className="space-y-3 max-w-2xl">
      {!activeProject && (
        <div className="flex items-center gap-2 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg text-xs text-yellow-300">
          <AlertTriangle size={12} />
          Select a project first to add a chain.
        </div>
      )}

      {templates.map((tmpl) => (
        <div key={tmpl.name} className="bg-[#1a1a1f] border border-[#2a2a32] rounded-xl p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Workflow size={13} className="text-red-400" />
                <span className="text-sm font-semibold text-gray-100">{tmpl.name}</span>
              </div>
              <p className="text-xs text-gray-500">{tmpl.description}</p>
            </div>
            <button
              onClick={() => handleInstantiate(tmpl.name)}
              disabled={!activeProject || instantiating === tmpl.name}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 rounded-lg transition-colors disabled:opacity-40"
            >
              {instantiating === tmpl.name
                ? <Loader2 size={11} className="animate-spin" />
                : done === tmpl.name
                ? <CheckCircle2 size={11} />
                : <Plus size={11} />}
              {done === tmpl.name ? 'Added!' : 'Add to Project'}
            </button>
          </div>

          {/* Steps */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {tmpl.steps.map((step, i) => (
              <div key={step.id} className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-[#111114] border border-[#2a2a32] rounded text-[10px] text-gray-400">
                  <span className="text-gray-600">{TOOL_ICONS[step.tool ?? ''] ?? <Workflow size={11} />}</span>
                  {step.label ?? step.tool ?? step.type}
                </div>
                {i < tmpl.steps.length - 1 && (
                  <ChevronRight size={10} className="text-gray-700" />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// My Chains Tab
// ---------------------------------------------------------------------------

function ChainsTab(): JSX.Element {
  const { activeProject } = useProjectStore()
  const [chains, setChains] = useState<Chain[]>([])
  const [selected, setSelected] = useState<Chain | null>(null)
  const [runs, setRuns] = useState<ChainRun[]>([])
  const [running, setRunning] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchChains = useCallback(async () => {
    if (!activeProject) return
    setLoading(true)
    try {
      const r = await fetch(`${BASE}/api/chains?project_id=${activeProject.id}`)
      if (r.ok) setChains(await r.json())
    } finally {
      setLoading(false)
    }
  }, [activeProject])

  const fetchRuns = useCallback(async (chainId: string) => {
    const r = await fetch(`${BASE}/api/chains/${chainId}/runs`)
    if (r.ok) setRuns(await r.json())
  }, [])

  useEffect(() => { fetchChains() }, [fetchChains])

  const handleSelect = async (chain: Chain) => {
    setSelected(chain)
    setRuns([])
    await fetchRuns(chain.id)
  }

  const handleRun = async (chain: Chain) => {
    setRunning(chain.id)
    try {
      const r = await fetch(`${BASE}/api/chains/${chain.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (r.ok) {
        setTimeout(() => {
          fetchRuns(chain.id)
          setRunning(null)
        }, 1000)
      }
    } catch {
      setRunning(null)
    }
  }

  const handleDelete = async (id: string) => {
    await fetch(`${BASE}/api/chains/${id}`, { method: 'DELETE' })
    setChains(p => p.filter(c => c.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const toggleEnabled = async (chain: Chain) => {
    const r = await fetch(`${BASE}/api/chains/${chain.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !chain.enabled }),
    })
    if (r.ok) {
      const updated = await r.json()
      setChains(p => p.map(c => c.id === updated.id ? updated : c))
    }
  }

  if (!activeProject) {
    return (
      <div className="flex items-center gap-2 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg text-xs text-yellow-300">
        <AlertTriangle size={12} />
        Select a project first.
      </div>
    )
  }

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* Chain list */}
      <div className="w-64 shrink-0 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">{chains.length} chains</span>
          <button onClick={fetchChains} disabled={loading} className="text-gray-500 hover:text-gray-300">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {chains.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-8">
              No chains yet. Add one from Templates.
            </p>
          )}
          {chains.map((c) => (
            <div
              key={c.id}
              onClick={() => handleSelect(c)}
              className={cn(
                'group flex items-start gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors',
                selected?.id === c.id
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-[#1a1a1f] border-[#2a2a32] hover:border-gray-500',
              )}
            >
              <Workflow size={12} className={cn('mt-0.5 shrink-0', c.enabled ? 'text-red-400' : 'text-gray-600')} />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-200 font-medium truncate">{c.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-600">{c.steps.length} steps</span>
                  {c.last_status && <StatusDot status={c.last_status} />}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={e => { e.stopPropagation(); handleRun(c) }}
                  disabled={running === c.id || !c.enabled}
                  className="text-green-400 hover:text-green-300 disabled:opacity-40"
                  title="Run chain"
                >
                  {running === c.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(c.id) }}
                  className="text-gray-600 hover:text-red-400"
                  title="Delete chain"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chain detail */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600">
            <Workflow size={28} className="mb-2" />
            <p className="text-xs">Select a chain</p>
          </div>
        ) : (
          <>
            {/* Chain header */}
            <div className="bg-[#1a1a1f] border border-[#2a2a32] rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-sm font-semibold text-gray-100">{selected.name}</h2>
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded border',
                      selected.enabled
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-gray-500/10 text-gray-500 border-gray-500/20',
                    )}>
                      {selected.enabled ? 'enabled' : 'disabled'}
                    </span>
                  </div>
                  {selected.description && (
                    <p className="text-xs text-gray-500">{selected.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleEnabled(selected)}
                    className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 border border-[#2a2a32] rounded transition-colors"
                  >
                    {selected.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleRun(selected)}
                    disabled={running === selected.id || !selected.enabled}
                    className="flex items-center gap-1.5 text-xs bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                  >
                    {running === selected.id
                      ? <Loader2 size={11} className="animate-spin" />
                      : <Play size={11} />}
                    Run
                  </button>
                </div>
              </div>

              {/* Steps */}
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                {selected.steps.map((step, i) => (
                  <div key={step.id} className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-[#111114] border border-[#2a2a32] rounded text-[10px] text-gray-400">
                      <span className="text-gray-600">{TOOL_ICONS[step.tool ?? ''] ?? <Workflow size={11} />}</span>
                      {step.label ?? step.tool ?? step.type}
                    </div>
                    {i < selected.steps.length - 1 && (
                      <ChevronRight size={10} className="text-gray-700" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Run history */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Run History</h3>
              {runs.length === 0 ? (
                <p className="text-xs text-gray-600">No runs yet.</p>
              ) : (
                <div className="space-y-2">
                  {runs.map((run) => (
                    <div key={run.id} className="bg-[#1a1a1f] border border-[#2a2a32] rounded-lg px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {run.status === 'completed' ? <CheckCircle2 size={12} className="text-green-400" /> :
                           run.status === 'failed'    ? <XCircle size={12} className="text-red-400" /> :
                           run.status === 'running'   ? <Loader2 size={12} className="animate-spin text-yellow-400" /> :
                                                        <Clock size={12} className="text-gray-500" />}
                          <StatusDot status={run.status} />
                          <span className="text-[10px] text-gray-600 font-mono">{run.id.slice(0, 8)}</span>
                        </div>
                        <span className="text-[10px] text-gray-600">{run.started_at?.slice(0, 16)}</span>
                      </div>
                      {run.error && (
                        <p className="text-[10px] text-red-400 mt-1 font-mono truncate">{run.error}</p>
                      )}
                      {Object.keys(run.step_results).length > 0 && (
                        <div className="flex gap-2 flex-wrap mt-1.5">
                          {Object.entries(run.step_results).map(([stepId, result]: [string, unknown]) => {
                            const r = result as { status?: string; scan_id?: string }
                            return (
                              <span key={stepId} className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded font-mono',
                                r.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                                r.status === 'failed'    ? 'bg-red-500/10 text-red-400' :
                                                           'bg-gray-500/10 text-gray-500',
                              )}>
                                {stepId}: {r.status}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function ChainsPage(): JSX.Element {
  const [tab, setTab] = useState<Tab>('templates')

  const TABS: { id: Tab; label: string }[] = [
    { id: 'templates', label: 'Templates' },
    { id: 'chains', label: 'My Chains' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2a2a32] shrink-0">
        <Workflow size={16} className="text-red-400" />
        <h1 className="text-sm font-semibold text-gray-100">Chain Automation</h1>
        <span className="text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded">PRO</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#2a2a32] shrink-0 px-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3 py-2.5 text-xs border-b-2 transition-colors -mb-px',
              tab === t.id
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-gray-500 hover:text-gray-300',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {tab === 'templates' && <TemplatesTab onInstantiate={() => setTab('chains')} />}
        {tab === 'chains' && <ChainsTab />}
      </div>
    </div>
  )
}
