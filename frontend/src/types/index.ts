export type PageId =
  | 'dashboard'
  | 'targets'
  | 'scans'
  | 'history'
  | 'findings'
  | 'proxy'
  | 'metasploit'
  | 'sqlmap'
  | 'shodan'
  | 'censys'
  | 'hosts'
  | 'ai'
  | 'chains'
  | 'reports'
  | 'terminal'
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

/** Generic scan profile — tool-specific config fields live in `config`. */
export interface ScanProfile {
  name: string
  description: string
  config: Record<string, unknown>
}

/** @deprecated Use ScanProfile */
export type NmapProfile = ScanProfile

/** A registered tool with its install status. */
export interface ToolInfo {
  name: string
  installed: boolean
  binary_path: string | null
}

/** One exploit/shellcode entry from searchsploit parsed results */
export interface SearchSploitExploit {
  edb_id: string
  title: string
  date: string
  type: string
  platform: string
  path: string
  cve: string | null
  severity: string
}

/** One found credential from hydra parsed results */
export interface HydraCredential {
  host: string
  port: number
  service: string
  username: string
  password: string
}

/** One entry from gobuster parsed results */
export interface GobusterPath {
  path?: string
  subdomain?: string
  vhost?: string
  status?: number
  size?: number | null
  redirect?: string | null
}

// ---------------------------------------------------------------------------
// Hosts & Ports (from scan results, returned by future endpoints)
// ---------------------------------------------------------------------------

export interface Credential {
  id: string
  project_id: string
  source_scan: string | null
  service: string | null
  username: string | null
  password: string | null
  hash: string | null
  hash_type: string | null
  verified: boolean
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Proxy
// ---------------------------------------------------------------------------

export interface ProxyRequest {
  id: string
  project_id: string
  method: string
  scheme: string
  host: string
  port: number
  path: string
  url: string
  request_headers: Record<string, string> | null
  request_body: string | null
  status_code: number | null
  response_headers: Record<string, string> | null
  response_body: string | null
  content_type: string | null
  response_size: number | null
  duration_ms: number | null
  timestamp: string
  tags: string[] | null
  notes: string | null
}

export interface ProxyStatus {
  running: boolean
  port: number
  project_id: string | null
}

// ---------------------------------------------------------------------------
// Metasploit
// ---------------------------------------------------------------------------

export interface MsfModule {
  type: string
  name: string
  fullname: string
  rank: number
  description: string
  references: string[]
}

export interface MsfModuleOption {
  name: string
  type: string
  required: boolean
  default: string
  description: string
  current: string
}

export interface MsfModuleInfo {
  type: string
  name: string
  fullname: string
  description: string
  authors: string[]
  references: string[]
  rank: string
  options: Record<string, MsfModuleOption>
  required: string[]
}

export interface MsfStatus {
  connected: boolean
  host: string
  port: number
  ssl: boolean
  version: string | null
}

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

// ---------------------------------------------------------------------------
// AI Analysis
// ---------------------------------------------------------------------------

export interface AIAnalysis {
  id: string
  project_id: string
  context_type: string
  context_id: string | null
  provider: string | null
  model: string | null
  prompt_type: string | null
  response: string | null
  tokens_used: number | null
  sanitized: boolean
  created_at: string
}

export interface AISettings {
  provider: 'ollama' | 'openai' | 'anthropic'
  ollama_url: string
  ollama_model: string
  openai_api_key: string
  openai_model: string
  anthropic_api_key: string
  anthropic_model: string
  sanitize_before_cloud: boolean
  enabled: boolean
}

// ---------------------------------------------------------------------------
// Chains
// ---------------------------------------------------------------------------

export interface ChainStep {
  id: string
  type: 'scan' | 'notify'
  tool?: string
  label?: string
  config: Record<string, unknown>
  depends_on?: string
  condition?: string
  continue_on_error?: boolean
}

export interface Chain {
  id: string
  project_id: string
  name: string
  description: string | null
  steps: ChainStep[]
  trigger_on: string
  enabled: boolean
  last_run: string | null
  last_status: string | null
  created_at: string
}

export interface ChainRun {
  id: string
  chain_id: string
  project_id: string
  status: string
  step_results: Record<string, unknown>
  error: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}
