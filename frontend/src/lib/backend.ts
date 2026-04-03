/**
 * Runtime-resolved backend base URLs.
 *
 * In Electron (dev + production) the backend subprocess runs on 127.0.0.1:8742.
 * In Docker/web mode the frontend is served by the same FastAPI server, so we
 * use window.location.origin so that all fetch/WebSocket calls go to the same
 * host regardless of which IP or domain the container is reached on.
 */

function isElectron(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
}

export function backendBase(): string {
  if (isElectron()) return 'http://127.0.0.1:8742'
  return window.location.origin
}

export function backendWsBase(): string {
  if (isElectron()) return 'ws://127.0.0.1:8742'
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}`
}
