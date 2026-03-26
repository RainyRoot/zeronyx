import { useState, useRef, useCallback } from 'react'
import { X, Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TargetType } from '@/types'
import type { BulkEntry } from '@/stores/targetStore'

// ---------------------------------------------------------------------------
// Type detection (mirrors AddTargetModal)
// ---------------------------------------------------------------------------

function detectType(value: string): TargetType {
  const v = value.trim()
  if (!v) return 'ip'
  if (v.includes('://')) return 'url'
  if (v.includes('/')) return 'cidr'
  if (/^[\d.:]+$/.test(v) && (v.includes('.') || v.includes(':'))) return 'ip'
  return 'domain'
}

// ---------------------------------------------------------------------------
// CIDR host-count helper
// ---------------------------------------------------------------------------

function cidrHostCount(cidr: string): number | null {
  const m = cidr.match(/\/(\d+)$/)
  if (!m) return null
  const prefix = parseInt(m[1], 10)
  if (prefix < 0 || prefix > 32) return null
  return prefix === 32 ? 1 : 2 ** (32 - prefix) - 2
}

// ---------------------------------------------------------------------------
// Parse raw text → entries
// ---------------------------------------------------------------------------

interface ParsedEntry extends BulkEntry {
  raw: string
  warning: string | null
}

function parseLines(text: string, existingValues: Set<string>): ParsedEntry[] {
  return text
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((raw) => {
      // Support simple CSV: value,notes  or  value,,tags
      const parts = raw.split(/\t|(?<=\S),(?=\S)/)
      const value   = parts[0]?.trim() ?? ''
      const notes   = parts[1]?.trim() || null
      const tagsPart = parts[2]?.trim() || null
      const type    = detectType(value)
      let warning: string | null = null

      if (!value) {
        warning = 'Empty value'
      } else if (existingValues.has(value)) {
        warning = 'Already in scope'
      } else if (type === 'cidr') {
        const count = cidrHostCount(value)
        if (count === null) warning = 'Invalid CIDR'
        else if (count > 65534) warning = `Large range (${count.toLocaleString()} hosts)`
      }

      return { raw, value, type, notes, tags: tagsPart, warning }
    })
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

interface BulkImportModalProps {
  open: boolean
  existingValues: string[]
  onClose: () => void
  onImport: (entries: BulkEntry[]) => Promise<{ added: number; failed: number }>
}

const TYPE_BADGE: Record<TargetType, string> = {
  ip:     'text-blue-400 border-blue-500/30',
  cidr:   'text-orange-400 border-orange-500/30',
  domain: 'text-purple-400 border-purple-500/30',
  url:    'text-cyan-400 border-cyan-500/30',
}

export function BulkImportModal({ open, existingValues, onClose, onImport }: BulkImportModalProps): JSX.Element | null {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ added: number; failed: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const existingSet = new Set(existingValues)
  const entries = text.trim() ? parseLines(text, existingSet) : []
  const valid   = entries.filter((e) => e.value && !['Empty value', 'Already in scope', 'Invalid CIDR'].includes(e.warning ?? ''))
  const hasWarnings = entries.some((e) => e.warning)

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      // Strip CSV header if first line looks like one
      const lines = content.split('\n')
      const first  = lines[0].toLowerCase()
      if (first.includes('value') || first.includes('target') || first.includes('host')) {
        setText(lines.slice(1).join('\n'))
      } else {
        setText(content)
      }
    }
    reader.readAsText(file)
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleImport = async () => {
    if (valid.length === 0) return
    setLoading(true)
    try {
      const res = await onImport(valid)
      setResult(res)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setText('')
    setResult(null)
    onClose()
  }

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={handleBackdrop}
    >
      <div className="w-full max-w-2xl bg-[#1a1a1f] border border-[#2a2a32] rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a32] shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-100">Bulk Import Targets</h2>
            <p className="text-[10px] text-gray-600 mt-0.5">
              One per line · CSV (value,notes,tags) · or drag &amp; drop a .txt / .csv file
            </p>
          </div>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-300 transition-colors rounded p-0.5">
            <X size={16} />
          </button>
        </div>

        {result ? (
          /* ---- Result screen ---- */
          <div className="flex flex-col items-center justify-center flex-1 p-8 gap-4">
            <CheckCircle2 size={36} className="text-green-500" />
            <p className="text-sm font-semibold text-gray-100">Import complete</p>
            <div className="flex gap-4 text-xs text-gray-400">
              <span className="text-green-400 font-medium">{result.added} added</span>
              {result.failed > 0 && (
                <span className="text-red-400 font-medium">{result.failed} failed</span>
              )}
            </div>
            <button
              onClick={handleClose}
              className="mt-2 px-4 py-1.5 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* ---- Input area ---- */}
            <div className="p-4 border-b border-[#2a2a32] shrink-0">
              <div
                className="relative"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`192.168.1.1\n10.0.0.0/24\nexample.com\nhttps://app.example.com\n\nOr paste CSV: value,notes,tags`}
                  rows={6}
                  className="w-full bg-[#111114] border border-[#2a2a32] rounded-lg px-3 py-2.5 text-xs font-mono text-gray-200 placeholder-gray-700 focus:outline-none focus:border-red-500/40 resize-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 text-[10px] text-gray-600 hover:text-gray-300 border border-[#2a2a32] hover:border-[#3a3a44] rounded transition-colors"
                >
                  <Upload size={10} />
                  Upload file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFile(file)
                    e.target.value = ''
                  }}
                />
              </div>
            </div>

            {/* ---- Preview table ---- */}
            {entries.length > 0 && (
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2a32] text-[10px] uppercase tracking-wider text-gray-600 shrink-0">
                  <span>Preview — {entries.length} parsed</span>
                  <div className="flex gap-3">
                    <span className="text-green-500/80">{valid.length} valid</span>
                    {hasWarnings && (
                      <span className="text-yellow-500/80">{entries.length - valid.length} skipped</span>
                    )}
                  </div>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-gray-700 border-b border-[#2a2a32]">
                      <th className="text-left px-4 py-2">Type</th>
                      <th className="text-left px-4 py-2">Value</th>
                      <th className="text-left px-4 py-2">Notes</th>
                      <th className="text-left px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e1e24]">
                    {entries.map((e, i) => (
                      <tr key={i} className={cn(
                        'transition-colors',
                        e.warning ? 'opacity-50' : 'hover:bg-white/[0.02]',
                      )}>
                        <td className="px-4 py-2">
                          <span className={cn(
                            'text-[9px] font-medium border rounded px-1.5 py-0.5 uppercase',
                            TYPE_BADGE[e.type],
                          )}>
                            {e.type}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono text-gray-300">
                          {e.value}
                          {e.type === 'cidr' && (() => {
                            const n = cidrHostCount(e.value)
                            return n !== null && (
                              <span className="ml-1.5 text-[9px] text-gray-600">{n.toLocaleString()} hosts</span>
                            )
                          })()}
                        </td>
                        <td className="px-4 py-2 text-gray-600 text-[10px]">{e.notes ?? '—'}</td>
                        <td className="px-4 py-2">
                          {e.warning ? (
                            <span className="flex items-center gap-1 text-[9px] text-yellow-600">
                              <AlertCircle size={9} />
                              {e.warning}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[9px] text-green-600">
                              <CheckCircle2 size={9} />
                              OK
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ---- Footer ---- */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#2a2a32] shrink-0">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={valid.length === 0 || loading}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  valid.length > 0 && !loading
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed',
                )}
              >
                {loading && <Loader2 size={11} className="animate-spin" />}
                Import {valid.length > 0 ? `${valid.length} target${valid.length !== 1 ? 's' : ''}` : '—'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
