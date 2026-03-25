import { useEffect, useRef, useCallback } from 'react'
import type { WsServerMessage, WsClientMessage, WsStatus } from '@/types'

const BACKEND_WS_BASE = 'ws://127.0.0.1:8742'
const MAX_RETRIES = 10
const BASE_DELAY_MS = 1_000
const MAX_DELAY_MS = 30_000

export interface UseWebSocketOptions {
  scanId: string
  onMessage: (msg: WsServerMessage) => void
  onStatusChange?: (status: WsStatus) => void
  /** Set to false to skip connecting entirely (e.g. when scan is not yet running) */
  enabled?: boolean
}

export interface UseWebSocketReturn {
  send: (msg: WsClientMessage) => void
}

/**
 * Persistent WebSocket hook for a single scan stream.
 *
 * - Auto-reconnects with exponential backoff (up to MAX_RETRIES).
 * - Responds to server `ping` with `pong` automatically.
 * - Cleans up the socket and any pending timers on unmount.
 */
export function useWebSocket({
  scanId,
  onMessage,
  onStatusChange,
  enabled = true,
}: UseWebSocketOptions): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null)
  const retriesRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const enabledRef = useRef(enabled)

  // Keep callback refs stable so closures always call the latest version
  const onMessageRef = useRef(onMessage)
  const onStatusRef = useRef(onStatusChange)
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])
  useEffect(() => {
    onStatusRef.current = onStatusChange
  }, [onStatusChange])
  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  const setStatus = useCallback((s: WsStatus) => {
    onStatusRef.current?.(s)
  }, [])

  const connect = useCallback(() => {
    if (!enabledRef.current) return

    setStatus('connecting')
    const url = `${BACKEND_WS_BASE}/ws/scan/${encodeURIComponent(scanId)}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      retriesRef.current = 0
      setStatus('connected')
    }

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as WsServerMessage
        if (msg.type === 'ping') {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong' }))
          }
          return
        }
        onMessageRef.current(msg)
      } catch {
        // Ignore malformed frames
      }
    }

    ws.onerror = () => {
      setStatus('error')
    }

    ws.onclose = () => {
      wsRef.current = null
      if (!enabledRef.current) return
      if (retriesRef.current >= MAX_RETRIES) {
        setStatus('disconnected')
        return
      }
      const delay = Math.min(BASE_DELAY_MS * 2 ** retriesRef.current, MAX_DELAY_MS)
      retriesRef.current++
      timerRef.current = setTimeout(connect, delay)
    }
  }, [scanId, setStatus])

  const send = useCallback((msg: WsClientMessage) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }, [])

  useEffect(() => {
    if (enabled) {
      connect()
    }
    return () => {
      enabledRef.current = false
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      const ws = wsRef.current
      if (ws) {
        ws.onclose = null // suppress reconnect on intentional teardown
        ws.close()
        wsRef.current = null
      }
    }
  }, [enabled, connect])

  return { send }
}
