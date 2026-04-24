import { ReactElement, useMemo } from 'react'
import { Copy, Flag, Heart, Link, Pencil, Sparkles, Trash2 } from 'lucide-react'
import type {
  NativeMenuItemDescriptor,
  Project,
  ProjectMilestone,
  ProjectStatus,
  ProjectSubtask
} from '../../../shared/types'
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
import { WorkspacePanelSection, WorkspacePanelSectionHeader } from './ui/workspace-panel-section'
import { PROJECT_STATUS_META } from '../lib/projectStatus'
import { canUseNativeMenus, getMouseMenuPosition, showNativeMenu } from '../lib/nativeMenu'
import { cn } from '../lib/utils'
import { useStaggeredScrollReveal } from '../hooks/useStaggeredScrollReveal'

export type { Project, ProjectMilestone, ProjectSubtask, ProjectStatus }
export type ProjectListItem = Project
export type ProjectSortField = 'name' | 'updated'
export type ProjectSortDirection = 'asc' | 'desc'
export type ProjectFilterMode = 'all' | 'favorites' | 'active' | 'completed'

interface ProjectPreviewListProps {
  projects: Project[]
  favoriteProjectIds: string[]
  selectedProjectId: string | null
  filter: string
  filterMode: ProjectFilterMode
  sortField: ProjectSortField
  sortDirection: ProjectSortDirection
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
  filterMode,
  sortField,
  sortDirection,
  onSelect,
  onDelete,
  onRename,
  onDuplicate,
  onCopyLink
}: ProjectPreviewListProps): ReactElement {
  const useNativeMenus = canUseNativeMenus()
  const neutralChipClass =
    'inline-flex min-w-0 shrink-0 items-center gap-1 rounded-full border border-[var(--tag-neutral-line)] bg-[var(--tag-neutral-bg)] px-2 py-0.5 text-xs leading-[1.2] text-[var(--tag-neutral-text)]'

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

    const byFilterMode =
      filterMode === 'favorites'
        ? filteredProjects.filter((project) => favoriteProjectIds.includes(project.id))
        : filterMode === 'active'
          ? filteredProjects.filter((project) => project.status !== 'completed')
          : filterMode === 'completed'
            ? filteredProjects.filter((project) => project.status === 'completed')
            : filteredProjects

    const sorted = [...byFilterMode]
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
  }, [projects, filter, filterMode, sortField, sortDirection, favoriteProjectIds])

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
  const revealItemIds = useMemo(
    () => [
      ...favoriteProjects.map((project) => `favorite:${project.id}`),
      ...inProgressProjects.map((project) => `in-progress:${project.id}`),
      ...doneProjects.map((project) => `done:${project.id}`)
    ],
    [doneProjects, favoriteProjects, inProgressProjects]
  )
  const { containerRef, getRevealItemProps } = useStaggeredScrollReveal(revealItemIds)

  return (
    <div ref={containerRef} className="flex h-full flex-col gap-2.5 overflow-auto p-3">
      {sortedProjects.length === 0 ? (
        <div className="p-2 text-sm text-[var(--muted)]">No projects found</div>
      ) : (
        <>
          <ProjectSection
            title="Favorites"
            icon={<Heart size={16} aria-hidden="true" />}
            description={`${favoriteProjects.length} pinned projects for quick access`}
            emptyLabel="No favorite projects yet"
            projects={favoriteProjects}
            selectedProjectId={selectedProjectId}
            onSelect={onSelect}
            onDelete={onDelete}
            onRename={onRename}
            onDuplicate={onDuplicate}
            onCopyLink={onCopyLink}
            neutralChipClass={neutralChipClass}
            useNativeMenus={useNativeMenus}
            getRevealItemProps={getRevealItemProps}
            revealKeyPrefix="favorite"
          />
          <ProjectSection
            title="In-Progress Projects"
            icon={<Flag size={16} aria-hidden="true" />}
            description={`${inProgressProjects.length} active projects still moving forward`}
            emptyLabel="No in-progress projects found"
            projects={inProgressProjects}
            selectedProjectId={selectedProjectId}
            onSelect={onSelect}
            onDelete={onDelete}
            onRename={onRename}
            onDuplicate={onDuplicate}
            onCopyLink={onCopyLink}
            neutralChipClass={neutralChipClass}
            useNativeMenus={useNativeMenus}
            getRevealItemProps={getRevealItemProps}
            revealKeyPrefix="in-progress"
          />
          <ProjectSection
            title="Done Projects"
            icon={<Sparkles size={16} aria-hidden="true" />}
            description={`${doneProjects.length} completed projects kept for reference`}
            emptyLabel="No done projects found"
            projects={doneProjects}
            selectedProjectId={selectedProjectId}
            onSelect={onSelect}
            onDelete={onDelete}
            onRename={onRename}
            onDuplicate={onDuplicate}
            onCopyLink={onCopyLink}
            neutralChipClass={neutralChipClass}
            useNativeMenus={useNativeMenus}
            getRevealItemProps={getRevealItemProps}
            revealKeyPrefix="done"
          />
        </>
      )}
    </div>
  )
}

function ProjectSection({
  title,
  icon,
  description,
  emptyLabel,
  projects,
  selectedProjectId,
  onSelect,
  onDelete,
  onRename,
  onDuplicate,
  onCopyLink,
  neutralChipClass,
  useNativeMenus,
  getRevealItemProps,
  revealKeyPrefix
}: {
  title: string
  icon: ReactElement
  description: string
  emptyLabel: string
  projects: Project[]
  selectedProjectId: string | null
  onSelect: (projectId: string) => void
  onDelete?: (projectId: string) => void
  onRename?: (projectId: string) => void
  onDuplicate?: (projectId: string) => void
  onCopyLink?: (projectId: string) => void
  neutralChipClass: string
  useNativeMenus: boolean
  getRevealItemProps: (itemId: string) => {
    ref: (node: HTMLElement | null) => void
    className: string
    style: React.CSSProperties
  }
  revealKeyPrefix: string
}): ReactElement {
  return (
    <WorkspacePanelSection>
      <WorkspacePanelSectionHeader icon={icon} heading={title} description={description} />
      {projects.length === 0 ? (
        <div className="p-2 text-sm text-[var(--muted)]">{emptyLabel}</div>
      ) : (
        projects.map((project) => {
          const revealProps = getRevealItemProps(`${revealKeyPrefix}:${project.id}`)
          const updatedLabel = new Date(project.updatedAt).toLocaleDateString()
          const milestoneCount = project.milestones.length
          const menuItems: NativeMenuItemDescriptor[] = [
            ...(onRename ? [{ id: 'rename', label: 'Rename' }] : []),
            ...(onDuplicate ? [{ id: 'duplicate', label: 'Duplicate' }] : []),
            ...(onCopyLink ? [{ id: 'copy-link', label: 'Copy link' }] : []),
            ...(onDelete
              ? [
                  { type: 'separator' as const },
                  { id: 'delete', label: 'Delete', accelerator: 'Command+Backspace' }
                ]
              : [])
          ]

          const handleNativeContextMenu = async (
            event: React.MouseEvent<HTMLButtonElement>
          ): Promise<void> => {
            event.preventDefault()
            const actionId = await showNativeMenu(menuItems, getMouseMenuPosition(event))

            if (!actionId) {
              return
            }
            if (actionId === 'rename' && onRename) {
              onRename(project.id)
              return
            }
            if (actionId === 'duplicate' && onDuplicate) {
              onDuplicate(project.id)
              return
            }
            if (actionId === 'copy-link' && onCopyLink) {
              onCopyLink(project.id)
              return
            }
            if (actionId === 'delete' && onDelete) {
              onDelete(project.id)
            }
          }

          const projectButton = (
            <button
              type="button"
              ref={revealProps.ref}
              className={`${revealProps.className} flex w-full flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                selectedProjectId === project.id
                  ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
                  : 'workspace-subtle-control border-[var(--line)]'
              }`}
              style={revealProps.style}
              onClick={() => onSelect(project.id)}
              onContextMenu={
                useNativeMenus ? (event) => void handleNativeContextMenu(event) : undefined
              }
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
              <div className="flex min-w-0 items-center gap-1 overflow-hidden text-xs text-[var(--muted)]">
                <span
                  className={cn(neutralChipClass, PROJECT_STATUS_META[project.status].className)}
                >
                  <Flag size={12} aria-hidden="true" />
                  {PROJECT_STATUS_META[project.status].label}
                </span>
                <span className={neutralChipClass}>
                  <Flag size={12} aria-hidden="true" />
                  {milestoneCount} milestones
                </span>
                <span className={neutralChipClass}>{updatedLabel}</span>
              </div>
            </button>
          )

          return useNativeMenus ? (
            <div key={project.id}>{projectButton}</div>
          ) : (
            <ContextMenu key={project.id}>
              <ContextMenuTrigger asChild>{projectButton}</ContextMenuTrigger>
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
    </WorkspacePanelSection>
  )
}
