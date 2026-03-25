/**
 * Typed REST client for the ZeroNyx backend.
 * All methods throw an Error with a human-readable message on non-2xx responses.
 */

import type { Project, ApiPaginatedResponse, Scan, ScanDetail, NmapProfile } from '@/types'

const BASE = 'http://127.0.0.1:8742'

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
