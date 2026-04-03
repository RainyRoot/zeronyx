import { useState } from 'react'
import { BookOpen, CheckCircle2, XCircle, Loader2, FolderOpen, BrainCircuit, Copy } from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'
import { exportApi } from '@/services/api'
import { cn } from '@/lib/utils'
import { backendBase } from '@/lib/backend'

const BASE_API = backendBase()

type ExportState = 'idle' | 'fetching' | 'writing' | 'done' | 'error'

interface ExportResult {
  path?: string
  fileCount?: number
  error?: string
}

// ---------------------------------------------------------------------------
// AI Report Generation component (4.7)
// ---------------------------------------------------------------------------

function AIReportCard(): JSX.Element {
  const { projects, activeProject } = useProjectStore()
  const [selectedId, setSelectedId] = useState<string>(activeProject?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!selectedId) return
    setLoading(true)
    setError(null)
    setReport(null)
    try {
      const r = await fetch(`${BASE_API}/api/ai/analyse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedId,
          context_type: 'project',
          context_id: selectedId,
          prompt_type: 'report',
        }),
      })
      if (!r.ok) {
        const data = await r.json()
        throw new Error(data.detail ?? 'Report generation failed')
      }
      const data = await r.json()
      setReport(data.response ?? '')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-[#1a1a1f] border border-[#2a2a32] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#2a2a32]">
        <div className="w-9 h-9 rounded-md bg-red-500/15 flex items-center justify-center shrink-0">
          <BrainCircuit size={18} className="text-red-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-100">AI Report Generation</p>
            <span className="text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded">PRO</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Generate an executive summary + technical pentest report using AI.
          </p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Project selector */}
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Project</label>
          <select
            value={selectedId}
            onChange={e => { setSelectedId(e.target.value); setReport(null); setError(null) }}
            disabled={loading}
            className="w-full bg-[#111114] border border-[#2a2a32] rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-red-500/50 disabled:opacity-50"
          >
            <option value="">— Select a project —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3">
            <XCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        {report && (
          <div className="relative">
            <button
              onClick={() => navigator.clipboard.writeText(report)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-300 transition-colors"
              title="Copy to clipboard"
            >
              <Copy size={13} />
            </button>
            <div className="rounded-md bg-[#111114] border border-[#2a2a32] px-4 py-3 max-h-80 overflow-y-auto">
              <pre className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed font-mono">{report}</pre>
            </div>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={!selectedId || loading}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            loading
              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
              : 'bg-red-600 hover:bg-red-500 text-white',
          )}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <BrainCircuit size={15} />}
          {loading ? 'Generating…' : 'Generate AI Report'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reports Page
// ---------------------------------------------------------------------------

export function ReportsPage(): JSX.Element {
  const { projects, activeProject } = useProjectStore()
  const [selectedId, setSelectedId] = useState<string>(activeProject?.id ?? '')
  const [exportState, setExportState] = useState<ExportState>('idle')
  const [result, setResult] = useState<ExportResult>({})

  const handleExport = async () => {
    if (!selectedId) return

    const project = projects.find((p) => p.id === selectedId)
    if (!project) return

    setExportState('fetching')
    setResult({})

    try {
      const data = await exportApi.obsidian(selectedId)

      setExportState('writing')

      const safeProjectName = project.name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60)
      const vaultName = `ZeroNyx — ${safeProjectName}`

      const writeResult = await window.exportAPI.writeVault(data.files, vaultName)

      if (writeResult.cancelled) {
        setExportState('idle')
        return
      }

      if (!writeResult.success) {
        setResult({ error: writeResult.error ?? 'Unknown write error' })
        setExportState('error')
        return
      }

      setResult({ path: writeResult.path, fileCount: data.file_count })
      setExportState('done')
    } catch (e) {
      setResult({ error: (e as Error).message })
      setExportState('error')
    }
  }

  const isRunning = exportState === 'fetching' || exportState === 'writing'

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-100 mb-1">Reports</h1>
        <p className="text-sm text-gray-500">Export engagement data and generate AI-powered reports.</p>
      </div>

      {/* AI Report Generation Card */}
      <AIReportCard />

      {/* Obsidian Export Card */}
      <div className="bg-[#1a1a1f] border border-[#2a2a32] rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#2a2a32]">
          <div className="w-9 h-9 rounded-md bg-purple-500/15 flex items-center justify-center shrink-0">
            <BookOpen size={18} className="text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-100">Obsidian Vault Export</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Generates a linked vault — Index, Targets, Scans &amp; Findings as Wikilink notes.
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Project selector */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Project</label>
            <select
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value)
                setExportState('idle')
                setResult({})
              }}
              disabled={isRunning}
              className="w-full bg-[#111114] border border-[#2a2a32] rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500/50 disabled:opacity-50"
            >
              <option value="">— Select a project —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Vault structure info */}
          <div className="rounded-md bg-[#111114] border border-[#2a2a32] px-4 py-3 space-y-1.5">
            <p className="text-xs font-medium text-gray-400 mb-2">Vault structure</p>
            {[
              ['Index.md', 'Project overview, stats, and all links'],
              ['Targets/<value>.md', 'One note per target with related scans'],
              ['Scans/<id> <tool>.md', 'Scan details, config, and raw output'],
              ['Findings/<severity>/<title>.md', 'Vulnerability notes with remediation'],
            ].map(([path, desc]) => (
              <div key={path} className="flex gap-2 text-xs">
                <span className="font-mono text-purple-300 shrink-0">{path}</span>
                <span className="text-gray-500">— {desc}</span>
              </div>
            ))}
          </div>

          {/* Result / status */}
          {exportState === 'done' && result.path && (
            <div className="flex items-start gap-2.5 rounded-md bg-green-500/10 border border-green-500/20 px-4 py-3">
              <CheckCircle2 size={16} className="text-green-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-green-300 font-medium">Export complete</p>
                <p className="text-xs text-green-400/70 mt-0.5">
                  {result.fileCount} files written to:
                </p>
                <p className="text-xs font-mono text-green-300/80 mt-1 break-all">{result.path}</p>
              </div>
            </div>
          )}

          {exportState === 'error' && result.error && (
            <div className="flex items-start gap-2.5 rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3">
              <XCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-red-300 font-medium">Export failed</p>
                <p className="text-xs text-red-400/70 mt-0.5 break-all">{result.error}</p>
              </div>
            </div>
          )}

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={!selectedId || isRunning}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              isRunning
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                : 'bg-purple-600 hover:bg-purple-500 text-white'
            )}
          >
            {isRunning ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                {exportState === 'fetching' ? 'Fetching data…' : 'Writing files…'}
              </>
            ) : (
              <>
                <FolderOpen size={15} />
                Choose Folder &amp; Export
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
