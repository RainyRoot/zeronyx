/**
 * UpgradeButton — opens Stripe Checkout in the default browser.
 * Used throughout the app to gate Pro features.
 */
import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { backendBase } from '@/lib/backend'

declare global {
  interface Window {
    electronAPI?: {
      openExternal: (url: string) => void
    }
  }
}

const BASE = backendBase()

interface Props {
  tier?: 'pro' | 'enterprise'
  label?: string
  className?: string
  size?: 'sm' | 'md'
}

export function UpgradeButton({
  tier = 'pro',
  label = 'Upgrade to Pro',
  className,
  size = 'md',
}: Props) {
  const handleClick = async () => {
    try {
      const res = await fetch(`${BASE}/api/payments/checkout-url/${tier}`)
      if (res.ok) {
        const { url } = await res.json()
        // Open in system browser (Electron / web)
        if (window.electronAPI?.openExternal) {
          window.electronAPI.openExternal(url)
        } else {
          window.open(url, '_blank', 'noopener,noreferrer')
        }
      }
    } catch {
      // fallback: open the generic pricing page
      window.open('https://zeronyx.io/#pricing', '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex items-center gap-1.5 font-semibold bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white rounded-lg transition-all',
        size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-4 py-2 text-xs',
        className,
      )}
    >
      <Zap size={size === 'sm' ? 10 : 12} />
      {label}
    </button>
  )
}

/** Inline Pro badge that doubles as an upgrade CTA */
export function ProGate({
  feature,
  children,
}: {
  feature: string
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <div className="opacity-40 pointer-events-none select-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-[#0f0f11]/60 backdrop-blur-[1px] rounded-lg">
        <div className="flex flex-col items-center gap-2 p-4 text-center">
          <span className="text-xs text-gray-400">
            <span className="font-semibold text-purple-300">{feature}</span> requires Pro
          </span>
          <UpgradeButton size="sm" />
        </div>
      </div>
    </div>
  )
}
