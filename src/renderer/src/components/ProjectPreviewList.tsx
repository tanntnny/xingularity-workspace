import { ReactElement, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, Flag, Link, Pencil, Trash2 } from 'lucide-react'
import { Project, ProjectMilestone, ProjectStatus, ProjectSubtask } from '../../../shared/types'
import { NoteShapeIcon } from './NoteShapeIcon'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuDestructiveItem,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
  isDeleteShortcut
} from './ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu'

// Re-export types for components that need them
export type { Project, ProjectMilestone, ProjectSubtask, ProjectStatus }

// Legacy alias for backward compatibility
export type ProjectListItem = Project

type ProjectSortField = 'name' | 'updated'
type ProjectSortDirection = 'asc' | 'desc'

const actionButtonClass =
  'inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)]'

interface ProjectPreviewListProps {
  projects: Project[]
  favoriteProjectIds: string[]
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
  favoriteProjectIds,
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

  const favoriteProjectIdSet = useMemo(() => new Set(favoriteProjectIds), [favoriteProjectIds])
  const favoriteProjects = useMemo(
    () => sortedProjects.filter((project) => favoriteProjectIdSet.has(project.id)),
    [sortedProjects, favoriteProjectIdSet]
  )
  const nonFavoriteProjects = useMemo(
    () => sortedProjects.filter((project) => !favoriteProjectIdSet.has(project.id)),
    [sortedProjects, favoriteProjectIdSet]
  )
  const inProgressProjects = useMemo(
    () => nonFavoriteProjects.filter((project) => project.status !== 'completed'),
    [nonFavoriteProjects]
  )
  const doneProjects = useMemo(
    () => nonFavoriteProjects.filter((project) => project.status === 'completed'),
    [nonFavoriteProjects]
  )

  const selectSortField = (field: ProjectSortField): void => {
    setSortField(field)
    setSortDirection(field === 'name' ? 'asc' : 'desc')
  }

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-auto p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={actionButtonClass}>
              Sort: {formatProjectSortLabel(sortField, sortDirection)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup
              value={sortField}
              onValueChange={(value) => selectSortField(value as ProjectSortField)}
            >
              <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="updated">Updated</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
              }
            >
              {sortDirection === 'asc' ? (
                <ArrowUp size={12} aria-hidden="true" />
              ) : (
                <ArrowDown size={12} aria-hidden="true" />
              )}
              Direction: {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {sortedProjects.length === 0 ? (
        <div className="p-2 text-sm text-[var(--muted)]">No projects found</div>
      ) : (
        <>
          <ProjectSection
            title="Favorites"
            emptyLabel="No favorite projects yet"
            projects={favoriteProjects}
            selectedProjectId={selectedProjectId}
            onSelect={onSelect}
            onDelete={onDelete}
            onRename={onRename}
            onDuplicate={onDuplicate}
            onCopyLink={onCopyLink}
            neutralChipClass={neutralChipClass}
          />
          <ProjectSection
            title="In-Progress Projects"
            emptyLabel="No in-progress projects found"
            projects={inProgressProjects}
            selectedProjectId={selectedProjectId}
            onSelect={onSelect}
            onDelete={onDelete}
            onRename={onRename}
            onDuplicate={onDuplicate}
            onCopyLink={onCopyLink}
            neutralChipClass={neutralChipClass}
          />
          <ProjectSection
            title="Done Projects"
            emptyLabel="No done projects found"
            projects={doneProjects}
            selectedProjectId={selectedProjectId}
            onSelect={onSelect}
            onDelete={onDelete}
            onRename={onRename}
            onDuplicate={onDuplicate}
            onCopyLink={onCopyLink}
            neutralChipClass={neutralChipClass}
          />
        </>
      )}
    </div>
  )
}

function formatProjectSortLabel(field: ProjectSortField, direction: ProjectSortDirection): string {
  return `${field === 'name' ? 'Name' : 'Updated'} ${direction === 'asc' ? '↑' : '↓'}`
}

function ProjectSection({
  title,
  emptyLabel,
  projects,
  selectedProjectId,
  onSelect,
  onDelete,
  onRename,
  onDuplicate,
  onCopyLink,
  neutralChipClass
}: {
  title: string
  emptyLabel: string
  projects: Project[]
  selectedProjectId: string | null
  onSelect: (projectId: string) => void
  onDelete?: (projectId: string) => void
  onRename?: (projectId: string) => void
  onDuplicate?: (projectId: string) => void
  onCopyLink?: (projectId: string) => void
  neutralChipClass: string
}): ReactElement {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
      {projects.length === 0 ? (
        <div className="p-2 text-sm text-[var(--muted)]">{emptyLabel}</div>
      ) : (
        projects.map((project) => {
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
                  onKeyDown={(event) => {
                    if (!onDelete || !isDeleteShortcut(event)) {
                      return
                    }
                    event.preventDefault()
                    onDelete(project.id)
                  }}
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
                    <ContextMenuDestructiveItem onClick={() => onDelete(project.id)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                      <ContextMenuShortcut keys={['cmd', 'backspace']} />
                    </ContextMenuDestructiveItem>
                  </>
                )}
              </ContextMenuContent>
            </ContextMenu>
          )
        })
      )}
    </section>
  )
}
