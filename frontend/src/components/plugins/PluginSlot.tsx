/**
 * PluginSlot — renders all active plugins registered for a given UI slot.
 *
 * Each plugin's frontend bundle is loaded dynamically via a <script> tag
 * and expected to register itself via `window.__zeronyx_plugins[pluginId]`.
 * The registered component receives the slot context as props.
 */

import React, { useEffect, useRef, useState } from 'react'
import type { PluginUiSlot } from '@/types'
import { usePluginStore } from '@/stores/pluginStore'
import { backendBase } from '@/lib/backend'

const BASE = backendBase()

interface PluginComponentProps {
  pluginId: string
  slot: PluginUiSlot
  context?: Record<string, unknown>
}

/** Dynamically loaded plugin React component. */
function DynamicPluginComponent({ pluginId, slot, context = {} }: PluginComponentProps) {
  const [Component, setComponent] = useState<React.ComponentType<Record<string, unknown>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true

    const win = window as unknown as Record<string, unknown>
    const registry = (win.__zeronyx_plugins ?? {}) as Record<string, Record<string, unknown>>

    if (registry[pluginId]?.[slot]) {
      setComponent(() => registry[pluginId][slot] as React.ComponentType<Record<string, unknown>>)
      return
    }

    // Load the bundle
    const script = document.createElement('script')
    script.src = `${BASE}/api/plugins/${pluginId}/frontend-bundle`
    script.async = true
    script.onload = () => {
      const reg = ((window as unknown as Record<string, unknown>).__zeronyx_plugins ?? {}) as Record<string, Record<string, unknown>>
      const comp = reg[pluginId]?.[slot]
      if (comp) {
        setComponent(() => comp as React.ComponentType<Record<string, unknown>>)
      } else {
        setError(`Plugin ${pluginId} did not register slot "${slot}"`)
      }
    }
    script.onerror = () => setError(`Failed to load plugin bundle for ${pluginId}`)
    document.head.appendChild(script)

    return () => {
      // Don't remove script — keep loaded for other slots
    }
  }, [pluginId, slot])

  if (error) {
    return (
      <div className="text-xs text-red-400 px-2 py-1 bg-red-500/10 rounded border border-red-500/20">
        Plugin error: {error}
      </div>
    )
  }

  if (!Component) return null

  return (
    <React.Suspense fallback={null}>
      <Component pluginId={pluginId} slot={slot} {...context} />
    </React.Suspense>
  )
}

// ---------------------------------------------------------------------------
// Public PluginSlot component
// ---------------------------------------------------------------------------

interface PluginSlotProps {
  slot: PluginUiSlot
  context?: Record<string, unknown>
  className?: string
}

/**
 * Drop this anywhere in the UI to render all plugins registered for `slot`.
 *
 * Example usage:
 *   <PluginSlot slot="scan_result_panel" context={{ scanId: scan.id }} />
 */
export function PluginSlot({ slot, context, className }: PluginSlotProps) {
  const getSlotPlugins = usePluginStore((s) => s.getSlotPlugins)
  const plugins = getSlotPlugins(slot)

  if (plugins.length === 0) return null

  return (
    <div className={className}>
      {plugins.map((plugin) => (
        <DynamicPluginComponent
          key={plugin.id}
          pluginId={plugin.id}
          slot={slot}
          context={context}
        />
      ))}
    </div>
  )
}
