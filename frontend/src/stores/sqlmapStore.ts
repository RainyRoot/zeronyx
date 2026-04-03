import { create } from 'zustand'
import type { ProxyRequest } from '@/types'
import { backendBase } from '@/lib/backend'

const API = backendBase()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SqlmapInjection {
  parameter: string
  technique: string
  severity: string
  title: string
  description: string
}

export interface SqlmapParsed {
  target: string
  dbms: string | null
  current_db: string | null
  injections: SqlmapInjection[]
  databases: string[]
  tables: string[]
  warnings: string[]
}

export interface SqlmapConfig {
  url: string
  data: string
  cookie: string
  method: string
  headers: string
  level: number
  risk: number
  dbms: string
  technique: string
  dbs: boolean
  tables: boolean
  dump: boolean
  proxy: string
  threads: number
  timeout: number
  randomAgent: boolean
}

interface SqlmapState {
  // Scan config
  config: SqlmapConfig

  // Scan state
  scanId: string | null
  scanning: boolean
  scanStatus: string | null
  outputLines: string[]
  parsed: SqlmapParsed | null

  // Proxy import
  proxyRequests: ProxyRequest[]
  loadingProxy: boolean

  // Actions
  setConfigField: <K extends keyof SqlmapConfig>(key: K, value: SqlmapConfig[K]) => void
  applyProfile: (profile: Record<string, unknown>) => void
  importFromProxyRequest: (req: ProxyRequest) => void
  fetchProxyRequests: (projectId: string) => Promise<void>
  runScan: (projectId: string) => Promise<string | null>
  appendLine: (line: string) => void
  setParsed: (parsed: SqlmapParsed) => void
  setScanStatus: (status: string) => void
  resetScan: () => void
}

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: SqlmapConfig = {
  url:         '',
  data:        '',
  cookie:      '',
  method:      'GET',
  headers:     '',
  level:       1,
  risk:        1,
  dbms:        '',
  technique:   '',
  dbs:         false,
  tables:      false,
  dump:        false,
  proxy:       '',
  threads:     1,
  timeout:     30,
  randomAgent: true,
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSqlmapStore = create<SqlmapState>((set, get) => ({
  config:       { ...DEFAULT_CONFIG },
  scanId:       null,
  scanning:     false,
  scanStatus:   null,
  outputLines:  [],
  parsed:       null,
  proxyRequests: [],
  loadingProxy: false,

  setConfigField: (key, value) =>
    set((s) => ({ config: { ...s.config, [key]: value } })),

  applyProfile: (profile) => {
    const map: Partial<Record<keyof SqlmapConfig, unknown>> = {
      level:       profile.level,
      risk:        profile.risk,
      dbms:        profile.dbms,
      technique:   profile.technique,
      dbs:         profile.dbs,
      tables:      profile.tables,
      dump:        profile.dump,
      randomAgent: profile.random_agent,
    }
    set((s) => {
      const next = { ...s.config }
      for (const [k, v] of Object.entries(map)) {
        if (v !== undefined) (next as Record<string, unknown>)[k] = v
      }
      return { config: next }
    })
  },

  importFromProxyRequest: (req) => {
    const { config } = get()
    // Extract cookie from request headers
    let cookie = config.cookie
    try {
      const hdrs = typeof req.request_headers === 'string'
        ? JSON.parse(req.request_headers)
        : req.request_headers ?? {}
      const cookieVal = (hdrs as Record<string, string>)['Cookie'] ??
                        (hdrs as Record<string, string>)['cookie'] ?? ''
      if (cookieVal) cookie = cookieVal
    } catch { /* ignore */ }

    set((s) => ({
      config: {
        ...s.config,
        url:    req.url,
        method: req.method,
        data:   req.request_body ?? '',
        cookie,
      },
    }))
  },

  fetchProxyRequests: async (projectId) => {
    set({ loadingProxy: true })
    try {
      const res = await fetch(`${API}/api/proxy/requests/${projectId}?limit=200`)
      if (res.ok) {
        const data = await res.json()
        set({ proxyRequests: data.items ?? [] })
      }
    } catch { /* ignore */ }
    set({ loadingProxy: false })
  },

  runScan: async (projectId) => {
    const { config } = get()
    if (!config.url.trim()) return null

    set({ scanning: true, scanId: null, outputLines: [], parsed: null, scanStatus: 'pending' })

    try {
      // Build backend config (snake_case)
      const backendConfig: Record<string, unknown> = {
        url:          config.url.trim(),
        level:        config.level,
        risk:         config.risk,
        random_agent: config.randomAgent,
        timeout:      config.timeout,
        threads:      config.threads,
      }
      if (config.data)      backendConfig.data      = config.data
      if (config.cookie)    backendConfig.cookie    = config.cookie
      if (config.headers)   backendConfig.headers   = config.headers
      if (config.method && config.method !== 'GET') backendConfig.method = config.method
      if (config.dbms)      backendConfig.dbms      = config.dbms
      if (config.technique) backendConfig.technique = config.technique
      if (config.dbs)       backendConfig.dbs       = true
      if (config.tables)    backendConfig.tables    = true
      if (config.dump)      backendConfig.dump      = true
      if (config.proxy)     backendConfig.proxy     = config.proxy

      const createRes = await fetch(`${API}/api/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          tool:       'sqlmap',
          config:     backendConfig,
        }),
      })
      if (!createRes.ok) {
        set({ scanning: false, scanStatus: 'failed' })
        return null
      }
      const scan = await createRes.json()
      const scanId: string = scan.id
      set({ scanId })

      // Start the scan
      const startRes = await fetch(`${API}/api/scans/${scanId}/start`, { method: 'POST' })
      if (!startRes.ok) {
        set({ scanning: false, scanStatus: 'failed' })
        return null
      }

      return scanId
    } catch {
      set({ scanning: false, scanStatus: 'failed' })
      return null
    }
  },

  appendLine: (line) =>
    set((s) => ({ outputLines: [...s.outputLines, line] })),

  setParsed: (parsed) => set({ parsed }),

  setScanStatus: (status) => {
    const done = status === 'completed' || status === 'failed' || status === 'cancelled'
    set({ scanStatus: status, ...(done ? { scanning: false } : {}) })
  },

  resetScan: () =>
    set({ scanId: null, scanning: false, scanStatus: null, outputLines: [], parsed: null }),
}))
