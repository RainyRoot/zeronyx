import { useEffect, useState } from 'react'
import { Plus, Folder, CheckCircle, Archive } from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { CreateProjectModal } from '@/components/projects/CreateProjectModal'
import type { Project } from '@/types'

export function DashboardPage(): JSX.Element {
  const { projects, activeProject, isLoading, error, fetchProjects, createProject, deleteProject, setActiveProject } =
    useProjectStore()
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const handleCreate = async (name: string, description: string | null) => {
    const project = await createProject({ name, description })
    setActiveProject(project)
  }

  const handleOpen = (project: Project) => {
    setActiveProject(project)
  }

  const handleDelete = async (project: Project) => {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return
    await deleteProject(project.id)
  }

  const stats = [
    {
      label: 'Total Projects',
      value: projects.length,
      icon: <Folder size={16} className="text-gray-600" />,
    },
    {
      label: 'Active',
      value: projects.filter((p) => p.status === 'active').length,
      icon: <div className="w-2 h-2 rounded-full bg-green-500" />,
    },
    {
      label: 'Completed',
      value: projects.filter((p) => p.status === 'completed').length,
      icon: <CheckCircle size={16} className="text-blue-500/60" />,
    },
    {
      label: 'Archived',
      value: projects.filter((p) => p.status === 'archived').length,
      icon: <Archive size={16} className="text-gray-600" />,
    },
  ]

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your penetration testing engagements.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
        >
          <Plus size={14} />
          New Engagement
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 bg-[#1a1a1f] border border-[#2a2a32] rounded-xl px-4 py-3"
          >
            <span className="flex items-center justify-center w-6 h-6 shrink-0">{s.icon}</span>
            <div>
              <p className="text-lg font-bold text-gray-100 leading-none">{s.value}</p>
              <p className="text-[10px] text-gray-600 mt-0.5 uppercase tracking-wider">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
          {error}
        </div>
      )}

      {/* Project grid */}
      {isLoading && projects.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-gray-600">
          Loading projects...
        </div>
      ) : projects.length === 0 ? (
        <EmptyState onNew={() => setModalOpen(true)} />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isActive={activeProject?.id === project.id}
              onOpen={handleOpen}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <CreateProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-64 bg-[#1a1a1f] border border-dashed border-[#2a2a32] rounded-xl">
      <Folder size={32} className="text-gray-700 mb-3" />
      <p className="text-sm font-medium text-gray-400">No engagements yet</p>
      <p className="text-xs text-gray-600 mt-1 mb-4">Create your first project to get started.</p>
      <button
        onClick={onNew}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
      >
        <Plus size={12} />
        New Engagement
      </button>
    </div>
  )
}
