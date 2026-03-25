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
// Domain models (mirror backend Pydantic responses)
// ---------------------------------------------------------------------------

export interface Project {
  id: string
  name: string
  description: string | null
  scope: string | null
  status: 'active' | 'archived' | 'completed'
  created_at: string
  updated_at: string
}

export interface ApiPaginatedResponse<T> {
  items: T[]
  total: number
  skip: number
  limit: number
}

export type TargetType = 'ip' | 'domain' | 'cidr' | 'url'

export interface Target {
  id: string
  project_id: string
  value: string
  type: TargetType
  notes: string | null
  tags: string | null
  created_at: string
  updated_at: string
}

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

// ---------------------------------------------------------------------------
// Scans
// ---------------------------------------------------------------------------

export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface Scan {
  id: string
  project_id: string
  target_id: string | null
  tool: string
  profile: string | null
  config: Record<string, unknown> | null
  status: ScanStatus
  started_at: string | null
  finished_at: string | null
  error: string | null
  created_at: string
  updated_at: string
}

export interface ScanDetail extends Scan {
  raw_output: string | null
  parsed: Record<string, unknown> | null
}

export interface NmapProfile {
  name: string
  description: string
  config: { flags: string; ports?: string }
}

// ---------------------------------------------------------------------------
// Hosts & Ports (from scan results, returned by future endpoints)
// ---------------------------------------------------------------------------

export interface Host {
  id: string
  project_id: string
  ip: string
  hostname: string | null
  os: string | null
  os_accuracy: number | null
  mac: string | null
  vendor: string | null
  state: string
  last_seen: string | null
}

export interface Port {
  id: string
  host_id: string
  number: number
  protocol: string
  state: string
  service: string | null
  version: string | null
  banner: string | null
}
