import { create } from 'zustand'
import { projectsApi } from '@/services/api'
import type { Project } from '@/types'

interface ProjectState {
  projects: Project[]
  activeProject: Project | null
  isLoading: boolean
  error: string | null

  fetchProjects: () => Promise<void>
  createProject: (payload: { name: string; description?: string | null }) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
  setActiveProject: (project: Project | null) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  activeProject: null,
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await projectsApi.list({ limit: 500 })
      set({ projects: res.items, isLoading: false })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false })
    }
  },

  createProject: async (payload) => {
    const project = await projectsApi.create(payload)
    set((s) => ({ projects: [project, ...s.projects] }))
    return project
  },

  deleteProject: async (id) => {
    await projectsApi.delete(id)
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      activeProject: s.activeProject?.id === id ? null : s.activeProject,
    }))
  },

  setActiveProject: (project) => set({ activeProject: project }),
}))
