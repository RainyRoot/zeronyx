export type PageId =
  | 'dashboard'
  | 'targets'
  | 'scans'
  | 'findings'
  | 'reports'
  | 'settings'

export interface Tab {
  id: string
  pageId: PageId
  label: string
  path: string
  closeable: boolean
}

export type BackendStatus = 'connecting' | 'connected' | 'disconnected' | 'error'
