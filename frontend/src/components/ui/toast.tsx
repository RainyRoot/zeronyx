/**
 * Minimal toast notification system.
 *
 * Usage:
 *   import { toast } from '@/components/ui/toast'
 *   toast.success('Scan started')
 *   toast.error('Connection failed')
 *   toast.info('Plugin installed')
 *
 * Add <Toaster /> once in AppShell to render notifications.
 */

import { create } from 'zustand'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastVariant = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
}

interface ToastStore {
  toasts: ToastItem[]
  add: (message: string, variant: ToastVariant) => void
  remove: (id: string) => void
}

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (message, variant) => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 4000)
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (message: string) => useToastStore.getState().add(message, 'success'),
  error: (message: string) => useToastStore.getState().add(message, 'error'),
  info: (message: string) => useToastStore.getState().add(message, 'info'),
}

const VARIANT_STYLES: Record<ToastVariant, { border: string; icon: typeof CheckCircle2; iconClass: string }> = {
  success: { border: 'border-emerald-500/30', icon: CheckCircle2, iconClass: 'text-emerald-400' },
  error:   { border: 'border-red-500/30',     icon: XCircle,       iconClass: 'text-red-400' },
  info:    { border: 'border-blue-500/30',     icon: Info,          iconClass: 'text-blue-400' },
}

function ToastItem({ item }: { item: ToastItem }) {
  const remove = useToastStore((s) => s.remove)
  const { border, icon: Icon, iconClass } = VARIANT_STYLES[item.variant]

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 px-3 py-2.5 bg-[#1a1a22] border rounded-lg shadow-xl text-sm text-gray-200',
        'animate-in slide-in-from-right-4 fade-in duration-200',
        border
      )}
    >
      <Icon size={15} className={cn('shrink-0 mt-0.5', iconClass)} />
      <span className="flex-1 leading-snug">{item.message}</span>
      <button
        onClick={() => remove(item.id)}
        className="text-gray-600 hover:text-gray-300 transition-colors"
      >
        <X size={13} />
      </button>
    </div>
  )
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-8 right-4 z-[9999] flex flex-col gap-2 w-80 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem item={t} />
        </div>
      ))}
    </div>
  )
}
