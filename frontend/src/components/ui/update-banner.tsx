/**
 * Update notification banner.
 * Shows when a new ZeroNyx version has been downloaded and is ready to install.
 */

import { useEffect, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'

type UpdateState =
  | { type: 'idle' }
  | { type: 'available'; version: string }
  | { type: 'downloading'; percent: number }
  | { type: 'ready'; version: string }

declare global {
  interface Window {
    updaterAPI?: {
      checkForUpdates: () => Promise<unknown>
      installUpdate: () => void
      onChecking: (cb: () => void) => () => void
      onAvailable: (cb: (info: { version: string }) => void) => () => void
      onProgress: (cb: (p: { percent: number }) => void) => () => void
      onDownloaded: (cb: (info: { version: string }) => void) => () => void
      onError: (cb: (e: { message: string }) => void) => () => void
      onNotAvailable: (cb: (info: { version: string }) => void) => () => void
    }
  }
}

export function useUpdateState(): { state: UpdateState; checkForUpdates: () => void } {
  const [state, setState] = useState<UpdateState>({ type: 'idle' })

  useEffect(() => {
    const api = window.updaterAPI
    if (!api) return

    const cleanups: (() => void)[] = [
      api.onAvailable((info) => setState({ type: 'available', version: info.version })),
      api.onProgress((p) => setState({ type: 'downloading', percent: Math.round(p.percent) })),
      api.onDownloaded((info) => setState({ type: 'ready', version: info.version })),
      api.onError(() => setState({ type: 'idle' })),
      api.onNotAvailable(() => setState({ type: 'idle' })),
    ]

    return () => cleanups.forEach((fn) => fn())
  }, [])

  const checkForUpdates = () => window.updaterAPI?.checkForUpdates()

  return { state, checkForUpdates }
}

export function UpdateBanner() {
  const { state } = useUpdateState()

  if (state.type === 'idle') return null

  if (state.type === 'available') {
    return (
      <div className="flex items-center gap-2 text-[10px] text-blue-400">
        <Download size={11} />
        <span>v{state.version} downloading…</span>
      </div>
    )
  }

  if (state.type === 'downloading') {
    return (
      <div className="flex items-center gap-2 text-[10px] text-blue-400">
        <Download size={11} className="animate-bounce" />
        <span>{state.percent}%</span>
      </div>
    )
  }

  if (state.type === 'ready') {
    return (
      <button
        onClick={() => window.updaterAPI?.installUpdate()}
        className="flex items-center gap-1.5 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
        title={`v${state.version} ready — click to install and restart`}
      >
        <RefreshCw size={11} />
        <span>Restart to update v{state.version}</span>
      </button>
    )
  }

  return null
}
