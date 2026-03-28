import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom API exposed to renderer via context bridge
const api = {
  getBackendPort: (): Promise<number> => ipcRenderer.invoke('backend:getPort')
}

// Terminal PTY bridge — exposed to renderer via window.terminalAPI
const terminalAPI = {
  spawn: (id: string, cols: number, rows: number): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('terminal:spawn', { id, cols, rows }),

  write: (id: string, data: string): void =>
    ipcRenderer.send('terminal:write', { id, data }),

  resize: (id: string, cols: number, rows: number): void =>
    ipcRenderer.send('terminal:resize', { id, cols, rows }),

  kill: (id: string): void =>
    ipcRenderer.send('terminal:kill', { id }),

  onData: (id: string, callback: (data: string) => void): (() => void) => {
    const channel = `terminal:data:${id}`
    const handler = (_evt: Electron.IpcRendererEvent, data: string) => callback(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },

  onExit: (id: string, callback: (code: number) => void): (() => void) => {
    const channel = `terminal:exit:${id}`
    const handler = (_evt: Electron.IpcRendererEvent, code: number) => callback(code)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
}

// Obsidian vault export bridge
const exportAPI = {
  writeVault: (
    files: Record<string, string>,
    defaultName: string
  ): Promise<{ success: boolean; path?: string; cancelled?: boolean; error?: string }> =>
    ipcRenderer.invoke('export:writeVault', { files, defaultName }),
}

// Auto-updater bridge
const updaterAPI = {
  checkForUpdates: (): Promise<{ ok?: boolean; dev?: boolean; inProgress?: boolean; error?: string }> =>
    ipcRenderer.invoke('updater:check'),

  installUpdate: (): void =>
    ipcRenderer.invoke('updater:install'),

  onChecking: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on('updater:checking', handler)
    return () => ipcRenderer.removeListener('updater:checking', handler)
  },

  onAvailable: (callback: (info: { version: string; releaseNotes: string; releaseDate: string }) => void): (() => void) => {
    const handler = (_evt: Electron.IpcRendererEvent, info: { version: string; releaseNotes: string; releaseDate: string }) => callback(info)
    ipcRenderer.on('updater:available', handler)
    return () => ipcRenderer.removeListener('updater:available', handler)
  },

  onNotAvailable: (callback: (info: { version: string }) => void): (() => void) => {
    const handler = (_evt: Electron.IpcRendererEvent, info: { version: string }) => callback(info)
    ipcRenderer.on('updater:not-available', handler)
    return () => ipcRenderer.removeListener('updater:not-available', handler)
  },

  onProgress: (callback: (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void): (() => void) => {
    const handler = (_evt: Electron.IpcRendererEvent, progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => callback(progress)
    ipcRenderer.on('updater:progress', handler)
    return () => ipcRenderer.removeListener('updater:progress', handler)
  },

  onDownloaded: (callback: (info: { version: string }) => void): (() => void) => {
    const handler = (_evt: Electron.IpcRendererEvent, info: { version: string }) => callback(info)
    ipcRenderer.on('updater:downloaded', handler)
    return () => ipcRenderer.removeListener('updater:downloaded', handler)
  },

  onError: (callback: (err: { message: string }) => void): (() => void) => {
    const handler = (_evt: Electron.IpcRendererEvent, err: { message: string }) => callback(err)
    ipcRenderer.on('updater:error', handler)
    return () => ipcRenderer.removeListener('updater:error', handler)
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('terminalAPI', terminalAPI)
    contextBridge.exposeInMainWorld('exportAPI', exportAPI)
    contextBridge.exposeInMainWorld('updaterAPI', updaterAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (for non-contextIsolated environments, shouldn't happen in prod)
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
  // @ts-ignore
  window.terminalAPI = terminalAPI
  // @ts-ignore
  window.exportAPI = exportAPI
  // @ts-ignore
  window.updaterAPI = updaterAPI
}
