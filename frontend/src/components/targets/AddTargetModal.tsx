import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TargetType } from '@/types'

interface AddTargetModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (value: string, type: TargetType, notes: string | null, tags: string | null) => Promise<void>
}

const TARGET_TYPES: { value: TargetType; label: string; example: string }[] = [
  { value: 'ip',     label: 'IP Address', example: '192.168.1.1' },
  { value: 'cidr',   label: 'CIDR Range',  example: '10.0.0.0/24' },
  { value: 'domain', label: 'Domain',      example: 'example.com' },
  { value: 'url',    label: 'URL',         example: 'https://example.com' },
]

function detectType(value: string): TargetType {
  const v = value.trim()
  if (!v) return 'ip'
  if (v.includes('://')) return 'url'
  if (v.includes('/')) return 'cidr'
  // IPv4 / IPv6 heuristic
  if (/^[\d.:]+$/.test(v) && (v.includes('.') || v.includes(':'))) return 'ip'
  return 'domain'
}

export function AddTargetModal({ open, onClose, onSubmit }: AddTargetModalProps): JSX.Element | null {
  const [value, setValue] = useState('')
  const [type, setType] = useState<TargetType>('ip')
  const [typeOverridden, setTypeOverridden] = useState(false)
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setValue('')
      setType('ip')
      setTypeOverridden(false)
      setNotes('')
      setTags('')
      setError(null)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const handleValueChange = (v: string) => {
    setValue(v)
    if (!typeOverridden) setType(detectType(v))
  }

  const handleTypeClick = (t: TargetType) => {
    setType(t)
    setTypeOverridden(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) { setError('Target value is required.'); return }
    setLoading(true)
    setError(null)
    try {
      await onSubmit(trimmed, type, notes.trim() || null, tags.trim() || null)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={handleBackdrop}
    >
      <div className="w-full max-w-md bg-[#1a1a1f] border border-[#2a2a32] rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a32]">
          <h2 className="text-sm font-semibold text-gray-100">Add Target</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors rounded p-0.5">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          {/* Value */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-400 font-medium">
              Target <span className="text-red-500">*</span>
            </label>
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => handleValueChange(e.target.value)}
              placeholder="IP, CIDR, domain or URL"
              className={cn(
                'bg-[#111114] border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600',
                'outline-none focus:ring-1 focus:ring-red-500/50 focus:border-red-500/50 transition-colors',
                error && !value.trim() ? 'border-red-500/70' : 'border-[#2a2a32]'
              )}
            />
          </div>

          {/* Type selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-400 font-medium">
              Type
              <span className="ml-1.5 text-gray-600 font-normal">(auto-detected)</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {TARGET_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => handleTypeClick(t.value)}
                  className={cn(
                    'flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg border text-[10px] transition-colors',
                    type === t.value
                      ? 'border-red-500/50 bg-red-500/10 text-red-400'
                      : 'border-[#2a2a32] text-gray-500 hover:border-[#3a3a45] hover:text-gray-300'
                  )}
                >
                  <span className="font-medium">{t.label}</span>
                  <span className="text-gray-600 font-mono text-[9px]">{t.example}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-400 font-medium">
              Notes <span className="text-gray-600">(optional)</span>
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Primary web server, in-scope per rules of engagement"
              className={cn(
                'bg-[#111114] border border-[#2a2a32] rounded-lg px-3 py-2 text-sm text-gray-100',
                'placeholder:text-gray-600 outline-none',
                'focus:ring-1 focus:ring-red-500/50 focus:border-red-500/50 transition-colors'
              )}
            />
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-400 font-medium">
              Tags <span className="text-gray-600">(optional, comma-separated)</span>
            </label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. web, dmz, critical"
              className={cn(
                'bg-[#111114] border border-[#2a2a32] rounded-lg px-3 py-2 text-sm text-gray-100',
                'placeholder:text-gray-600 outline-none',
                'focus:ring-1 focus:ring-red-500/50 focus:border-red-500/50 transition-colors'
              )}
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                'px-4 py-1.5 text-xs font-medium rounded-lg transition-colors',
                'bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {loading ? 'Adding...' : 'Add Target'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
