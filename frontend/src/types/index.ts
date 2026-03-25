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

// ---------------------------------------------------------------------------
// WebSocket message protocol
// ---------------------------------------------------------------------------

export type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

// Server → Client

export interface WsConnectedMessage {
  type: 'connected'
  scan_id: string
  timestamp: string
}

export interface WsOutputMessage {
  type: 'output'
  scan_id: string
  line: string
  timestamp: string
}

export interface WsProgressMessage {
  type: 'progress'
  scan_id: string
  percent: number
  timestamp: string
}

export interface WsErrorMessage {
  type: 'error'
  scan_id: string
  message: string
  timestamp: string
}

export interface WsDoneMessage {
  type: 'done'
  scan_id: string
  timestamp: string
}

export interface WsPingMessage {
  type: 'ping'
}

export type WsServerMessage =
  | WsConnectedMessage
  | WsOutputMessage
  | WsProgressMessage
  | WsErrorMessage
  | WsDoneMessage
  | WsPingMessage

// Client → Server

export interface WsCancelMessage {
  type: 'cancel'
  scan_id: string
}

export interface WsPongMessage {
  type: 'pong'
}

export type WsClientMessage = WsCancelMessage | WsPongMessage
