/**
 * Typed REST client for the ZeroNyx backend.
 * All methods throw an Error with a human-readable message on non-2xx responses.
 */

import type { Project, ApiPaginatedResponse, Scan, ScanDetail, NmapProfile, Credential } from '@/types'
import { backendBase } from '@/lib/backend'

const BASE = backendBase()

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => null)
    throw new Error(payload?.detail ?? `${method} ${path} → ${res.status} ${res.statusText}`)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

interface ProjectListParams {
  skip?: number
  limit?: number
  status?: string
}

interface ProjectCreatePayload {
  name: string
  description?: string | null
  scope?: string | null
}

interface ProjectUpdatePayload {
  name?: string
  description?: string | null
  scope?: string | null
  status?: string
}

import type { Target, TargetType } from '@/types'

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

interface TargetCreatePayload {
  project_id: string
  value: string
  type?: TargetType
  notes?: string | null
  tags?: string | null
}

interface TargetUpdatePayload {
  value?: string
  type?: TargetType
  notes?: string | null
  tags?: string | null
}

export const targetsApi = {
  list(projectId: string, params: { skip?: number; limit?: number } = {}): Promise<ApiPaginatedResponse<Target>> {
    const q = new URLSearchParams({ project_id: projectId })
    if (params.skip !== undefined) q.set('skip', String(params.skip))
    if (params.limit !== undefined) q.set('limit', String(params.limit))
    return request<ApiPaginatedResponse<Target>>('GET', `/api/targets?${q.toString()}`)
  },

  create(payload: TargetCreatePayload): Promise<Target> {
    return request<Target>('POST', '/api/targets', payload)
  },

  update(id: string, payload: TargetUpdatePayload): Promise<Target> {
    return request<Target>('PATCH', `/api/targets/${id}`, payload)
  },

  delete(id: string): Promise<void> {
    return request<void>('DELETE', `/api/targets/${id}`)
  },
}

// ---------------------------------------------------------------------------
// Scans
// ---------------------------------------------------------------------------

interface ScanCreatePayload {
  project_id: string
  tool: string
  target_id?: string | null
  profile?: string | null
  config?: Record<string, unknown>
}

export const scansApi = {
  list(projectId: string, params: { skip?: number; limit?: number; tool?: string } = {}): Promise<ApiPaginatedResponse<Scan>> {
    const q = new URLSearchParams({ project_id: projectId })
    if (params.skip !== undefined) q.set('skip', String(params.skip))
    if (params.limit !== undefined) q.set('limit', String(params.limit))
    if (params.tool) q.set('tool', params.tool)
    return request<ApiPaginatedResponse<Scan>>('GET', `/api/scans?${q.toString()}`)
  },

  get(id: string): Promise<ScanDetail> {
    return request<ScanDetail>('GET', `/api/scans/${id}`)
  },

  create(payload: ScanCreatePayload): Promise<Scan> {
    return request<Scan>('POST', '/api/scans', payload)
  },

  start(id: string): Promise<Scan> {
    return request<Scan>('POST', `/api/scans/${id}/start`)
  },

  cancel(id: string): Promise<Scan> {
    return request<Scan>('POST', `/api/scans/${id}/cancel`)
  },

  delete(id: string): Promise<void> {
    return request<void>('DELETE', `/api/scans/${id}`)
  },

  getProfiles(tool: string): Promise<{ tool: string; installed: boolean; profiles: NmapProfile[] }> {
    return request(`GET`, `/api/tools/${tool}/profiles`)
  },

  listTools(): Promise<{ tools: { name: string; installed: boolean; binary_path: string | null }[] }> {
    return request('GET', '/api/tools')
  },
}

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

interface CredentialCreatePayload {
  project_id: string
  service?: string | null
  username?: string | null
  password?: string | null
  hash?: string | null
  hash_type?: string | null
  verified?: boolean
}

interface CredentialUpdatePayload {
  service?: string | null
  username?: string | null
  password?: string | null
  hash?: string | null
  hash_type?: string | null
  verified?: boolean
}

interface ImportResult {
  imported: number
  skipped: number
}

export const credentialsApi = {
  list(
    projectId: string,
    params: { skip?: number; limit?: number; service?: string; verified?: boolean } = {}
  ): Promise<ApiPaginatedResponse<Credential>> {
    const q = new URLSearchParams({ project_id: projectId })
    if (params.skip !== undefined) q.set('skip', String(params.skip))
    if (params.limit !== undefined) q.set('limit', String(params.limit))
    if (params.service) q.set('service', params.service)
    if (params.verified !== undefined) q.set('verified', String(params.verified))
    return request<ApiPaginatedResponse<Credential>>('GET', `/api/credentials?${q.toString()}`)
  },

  create(payload: CredentialCreatePayload): Promise<Credential> {
    return request<Credential>('POST', '/api/credentials', payload)
  },

  update(id: string, payload: CredentialUpdatePayload): Promise<Credential> {
    return request<Credential>('PATCH', `/api/credentials/${id}`, payload)
  },

  delete(id: string): Promise<void> {
    return request<void>('DELETE', `/api/credentials/${id}`)
  },

  importFromScan(scanId: string, projectId: string): Promise<ImportResult> {
    return request<ImportResult>('POST', `/api/credentials/import/${scanId}?project_id=${projectId}`)
  },
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export interface ObsidianExportResponse {
  project_name: string
  file_count: number
  files: Record<string, string>
}

export const exportApi = {
  obsidian(projectId: string): Promise<ObsidianExportResponse> {
    return request<ObsidianExportResponse>('GET', `/api/projects/${projectId}/export/obsidian`)
  },
}

export const projectsApi = {
  list(params: ProjectListParams = {}): Promise<ApiPaginatedResponse<Project>> {
    const q = new URLSearchParams()
    if (params.skip !== undefined) q.set('skip', String(params.skip))
    if (params.limit !== undefined) q.set('limit', String(params.limit))
    if (params.status) q.set('status', params.status)
    const qs = q.size ? `?${q.toString()}` : ''
    return request<ApiPaginatedResponse<Project>>('GET', `/api/projects${qs}`)
  },

  get(id: string): Promise<Project> {
    return request<Project>('GET', `/api/projects/${id}`)
  },

  create(payload: ProjectCreatePayload): Promise<Project> {
    return request<Project>('POST', '/api/projects', payload)
  },

  update(id: string, payload: ProjectUpdatePayload): Promise<Project> {
    return request<Project>('PATCH', `/api/projects/${id}`, payload)
  },

  delete(id: string): Promise<void> {
    return request<void>('DELETE', `/api/projects/${id}`)
  },
}

// ---------------------------------------------------------------------------
// Plugins
// ---------------------------------------------------------------------------

import type { Plugin } from '@/types'

export const pluginsApi = {
  list(): Promise<Plugin[]> {
    return request<Plugin[]>('GET', '/api/plugins')
  },

  get(id: string): Promise<Plugin> {
    return request<Plugin>('GET', `/api/plugins/${id}`)
  },

  installDir(path: string): Promise<Plugin> {
    return request<Plugin>('POST', '/api/plugins/install-dir', { path })
  },

  uninstall(id: string): Promise<void> {
    return request<void>('DELETE', `/api/plugins/${id}`)
  },

  toggle(id: string, enabled: boolean): Promise<Plugin> {
    return request<Plugin>('PATCH', `/api/plugins/${id}/toggle`, { enabled })
  },

  grantPermissions(id: string, granted: boolean): Promise<Plugin> {
    return request<Plugin>('PATCH', `/api/plugins/${id}/permissions`, { granted })
  },

  updateSettings(id: string, values: Record<string, unknown>): Promise<Plugin> {
    return request<Plugin>('PATCH', `/api/plugins/${id}/settings`, { values })
  },

  installFromFile(file: File): Promise<Plugin> {
    const form = new FormData()
    form.append('file', file)
    return fetch(`${backendBase()}/api/plugins/install`, { method: 'POST', body: form })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => null)
          throw new Error(payload?.detail ?? `Install failed: ${res.status}`)
        }
        return res.json() as Promise<Plugin>
      })
  },
}
