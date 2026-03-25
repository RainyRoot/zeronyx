/// <reference types="vite/client" />

interface Window {
  api: {
    getBackendPort: () => Promise<number>
  }
}
