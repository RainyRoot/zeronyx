import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom API exposed to renderer via context bridge
const api = {
  getBackendPort: (): Promise<number> => ipcRenderer.invoke('backend:getPort')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (for non-contextIsolated environments, shouldn't happen in prod)
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
