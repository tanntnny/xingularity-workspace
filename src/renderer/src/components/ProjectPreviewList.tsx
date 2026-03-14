import { ReactElement, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, Flag, Link, Pencil, Trash2 } from 'lucide-react'
import { Project, ProjectMilestone, ProjectStatus, ProjectSubtask } from '../../../shared/types'
import { NoteShapeIcon } from './NoteShapeIcon'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from './ui/context-menu'

// Re-export types for components that need them
export type { Project, ProjectMilestone, ProjectSubtask, ProjectStatus }

// Legacy alias for backward compatibility
export type ProjectListItem = Project

type ProjectSortField = 'name' | 'updated'
type ProjectSortDirection = 'asc' | 'desc'

interface ProjectPreviewListProps {
  projects: Project[]
  selectedProjectId: string | null
  filter: string
  onSelect: (projectId: string) => void
  onDelete?: (projectId: string) => void
  onRename?: (projectId: string) => void
  onDuplicate?: (projectId: string) => void
  onCopyLink?: (projectId: string) => void
}

export function ProjectPreviewList({
  projects,
  selectedProjectId,
  filter,
  onSelect,
  onDelete,
  onRename,
  onDuplicate,
  onCopyLink
}: ProjectPreviewListProps): ReactElement {
  const neutralChipClass =
    'inline-flex min-w-0 shrink-0 items-center gap-1 rounded-full border border-[var(--tag-neutral-line)] bg-[var(--tag-neutral-bg)] px-2 py-0.5 text-xs leading-[1.2] text-[var(--tag-neutral-text)]'

  const [sortField, setSortField] = useState<ProjectSortField>('name')
  const [sortDirection, setSortDirection] = useState<ProjectSortDirection>('asc')

  const sortedProjects = useMemo(() => {
    const query = filter.trim().toLowerCase()
    const filteredProjects =
      query.length === 0
        ? projects
        : projects.filter((project) => {
            return (
              project.name.toLowerCase().includes(query) ||
              project.summary.toLowerCase().includes(query)
            )
          })

    const sorted = [...filteredProjects]
    if (sortField === 'updated') {
      sorted.sort((a, b) =>
        sortDirection === 'asc'
          ? a.updatedAt.localeCompare(b.updatedAt)
          : b.updatedAt.localeCompare(a.updatedAt)
      )
      return sorted
    }

    sorted.sort((a, b) =>
      sortDirection === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    )
    return sorted
  }, [projects, filter, sortField, sortDirection])

  const toggleSort = (field: ProjectSortField): void => {
    if (sortField === field) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortField(field)
    setSortDirection(field === 'name' ? 'asc' : 'desc')
  }

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-auto p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Sort
        </span>
        <button
          type="button"
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            sortField === 'name'
              ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--text)]'
              : 'border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--accent)]'
          }`}
          onClick={() => toggleSort('name')}
        >
          {sortField === 'name' && sortDirection === 'desc' ? (
            <ArrowDown size={12} aria-hidden="true" />
          ) : (
            <ArrowUp size={12} aria-hidden="true" />
          )}
          Name
        </button>
        <button
          type="button"
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            sortField === 'updated'
              ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--text)]'
              : 'border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--accent)]'
          }`}
          onClick={() => toggleSort('updated')}
        >
          {sortField === 'updated' && sortDirection === 'asc' ? (
            <ArrowUp size={12} aria-hidden="true" />
          ) : (
            <ArrowDown size={12} aria-hidden="true" />
          )}
          Updated
        </button>
      </div>

      <h2 className="text-lg font-semibold text-[var(--text)]">All Projects</h2>

      {sortedProjects.length === 0 ? (
        <div className="p-2 text-sm text-[var(--muted)]">No projects found</div>
      ) : (
        sortedProjects.map((project) => {
          const updatedLabel = new Date(project.updatedAt).toLocaleDateString()
          const milestoneCount = project.milestones.length

          return (
            <ContextMenu key={project.id}>
              <ContextMenuTrigger asChild>
                <button
                  type="button"
                  className={`flex w-full flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    selectedProjectId === project.id
                      ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
                      : 'border-[var(--line)] bg-[var(--panel-2)] hover:border-[var(--accent)]'
                  }`}
                  onClick={() => onSelect(project.id)}
                >
                  <div className="flex min-w-0 items-center gap-1">
                    <NoteShapeIcon icon={project.icon} size={16} className="shrink-0" />
                    <div className="truncate text-lg font-bold">{project.name}</div>
                  </div>
                  <div className="line-clamp-2 text-sm text-[var(--muted)]">{project.summary}</div>
                  <div className="flex min-w-0 items-center gap-1 overflow-hidden text-xs text-[var(--muted)]">
                    <span className={neutralChipClass}>
                      <Flag size={12} aria-hidden="true" />
                      {milestoneCount} milestones
                    </span>
                    <span className={neutralChipClass}>{updatedLabel}</span>
                  </div>
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent>
                {onRename && (
                  <ContextMenuItem onClick={() => onRename(project.id)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Rename
                  </ContextMenuItem>
                )}
                {onDuplicate && (
                  <ContextMenuItem onClick={() => onDuplicate(project.id)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicate
                  </ContextMenuItem>
                )}
                {onCopyLink && (
                  <ContextMenuItem onClick={() => onCopyLink(project.id)}>
                    <Link className="mr-2 h-4 w-4" />
                    Copy link
                  </ContextMenuItem>
                )}
                {onDelete && (
                  <>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() => onDelete(project.id)}
                      className="text-[var(--danger)] focus:text-[var(--danger)]"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </ContextMenuItem>
                  </>
                )}
              </ContextMenuContent>
            </ContextMenu>
          )
        })
      )}
    </div>
  )
}
