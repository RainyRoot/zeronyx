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

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('terminalAPI', terminalAPI)
    contextBridge.exposeInMainWorld('exportAPI', exportAPI)
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
}
