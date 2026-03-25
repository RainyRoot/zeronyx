import { Trash2, FolderOpen, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Project } from '@/types'

interface ProjectCardProps {
  project: Project
  isActive: boolean
  onOpen: (project: Project) => void
  onDelete: (project: Project) => void
}

const STATUS_CONFIG: Record<Project['status'], { label: string; dot: string; badge: string }> = {
  active: {
    label: 'Active',
    dot: 'bg-green-500',
    badge: 'text-green-400 bg-green-500/10 border-green-500/20',
  },
  completed: {
    label: 'Completed',
    dot: 'bg-blue-500',
    badge: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  },
  archived: {
    label: 'Archived',
    dot: 'bg-gray-500',
    badge: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
  },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function ProjectCard({ project, isActive, onOpen, onDelete }: ProjectCardProps): JSX.Element {
  const status = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.active

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(project)
  }

  return (
    <div
      onClick={() => onOpen(project)}
      className={cn(
        'group relative flex flex-col bg-[#1a1a1f] border rounded-xl p-5 cursor-pointer',
        'transition-all duration-150 hover:border-[#3a3a45] hover:bg-[#1e1e24]',
        isActive
          ? 'border-red-500/40 ring-1 ring-red-500/20'
          : 'border-[#2a2a32]'
      )}
    >
      {/* Active indicator */}
      {isActive && (
        <span className="absolute top-3 right-3 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-1.5 py-0.5 font-medium select-none">
          Active
        </span>
      )}

      {/* Status badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className={cn('flex items-center gap-1.5 text-[10px] font-medium border rounded px-1.5 py-0.5', status.badge)}>
          <span className={cn('inline-block w-1.5 h-1.5 rounded-full', status.dot)} />
          {status.label}
        </span>
      </div>

      {/* Name */}
      <h3 className="text-sm font-semibold text-gray-100 leading-snug mb-1 pr-8 line-clamp-2">
        {project.name}
      </h3>

      {/* Description */}
      {project.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">
          {project.description}
        </p>
      )}

      {/* Footer */}
      <div className="mt-auto pt-4 flex items-center justify-between">
        <span className="flex items-center gap-1 text-[10px] text-gray-600">
          <Calendar size={10} />
          {formatDate(project.created_at)}
        </span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onOpen(project) }}
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-gray-100 hover:bg-white/5 rounded transition-colors"
            title="Open project"
          >
            <FolderOpen size={11} />
            Open
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
            title="Delete project"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  )
}
