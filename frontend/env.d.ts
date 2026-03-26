/// <reference types="vite/client" />

interface Window {
  api: {
    getBackendPort: () => Promise<number>
  }
  terminalAPI: {
    spawn: (id: string, cols: number, rows: number) => Promise<{ success: boolean; error?: string }>
    write: (id: string, data: string) => void
    resize: (id: string, cols: number, rows: number) => void
    kill: (id: string) => void
    onData: (id: string, callback: (data: string) => void) => () => void
    onExit: (id: string, callback: (code: number) => void) => () => void
  }
}
