import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CreateProjectModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (name: string, description: string | null) => Promise<void>
}

export function CreateProjectModal({ open, onClose, onSubmit }: CreateProjectModalProps): JSX.Element | null {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setError(null)
      setTimeout(() => nameRef.current?.focus(), 50)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Project name is required.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await onSubmit(trimmed, description.trim() || null)
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
          <h2 className="text-sm font-semibold text-gray-100">New Engagement</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors rounded p-0.5"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-400 font-medium">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp — Internal Network"
              className={cn(
                'bg-[#111114] border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600',
                'outline-none focus:ring-1 focus:ring-red-500/50 focus:border-red-500/50 transition-colors',
                error && !name.trim() ? 'border-red-500/70' : 'border-[#2a2a32]'
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-400 font-medium">
              Description <span className="text-gray-600">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scope, objectives, client contact..."
              rows={3}
              className={cn(
                'bg-[#111114] border border-[#2a2a32] rounded-lg px-3 py-2 text-sm text-gray-100',
                'placeholder:text-gray-600 outline-none resize-none',
                'focus:ring-1 focus:ring-red-500/50 focus:border-red-500/50 transition-colors'
              )}
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Footer */}
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
              {loading ? 'Creating...' : 'Create Engagement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
