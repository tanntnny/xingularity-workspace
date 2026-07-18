import { format, parseISO } from 'date-fns'
import {
  CSSProperties,
  Fragment,
  ReactElement,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Check,
  Circle,
  Flag,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Rows3,
  SlidersHorizontal,
  Star,
  Trash2
} from 'lucide-react'
import type {
  Project,
  ProjectIconStyle,
  ProjectMilestone,
  TaskPriority
} from '../../../shared/types'
import {
  coerceFilledLucideProjectIcon,
  createRandomProjectIcon,
  PROJECT_ICON_COLORS,
  PROJECT_ICON_SYMBOLS,
  resolveProjectIconGlyph
} from '../../../shared/projectIcons'
import { NoteShapeIcon } from '../components/NoteShapeIcon'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '../components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../components/ui/dropdown-menu'
import { WorkspaceActionButton } from '../components/ui/document-workspace'
import { Field } from '../components/ui/field'
import { Input } from '../components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { SelectionMenu, type SelectionMenuOption } from '../components/ui/selection-menu'
import { Select } from '../components/ui/select'
import { TabMenu, TabMenuCountBadge, TabMenuItem } from '../components/ui/tab-menu'
import { Textarea } from '../components/ui/textarea'
import { usePersistentState } from '../hooks/usePersistentState'
import {
  buildProjectTaskRows,
  compareProjectTaskRows,
  filterProjectsForWorkspace,
  type ProjectTaskRow,
  type ProjectTaskSortDirection,
  type ProjectTaskSortKey,
  type ProjectsWorkspaceFilterMode
} from '../lib/projectTaskRows'
import { buildProjectBoardGroups, type ProjectBoardGroupBy } from '../lib/projectBoardGroups'
import { PROJECT_STATUS_META, toLocalIsoDate } from '../lib/projectStatus'
import { cn } from '../lib/utils'

export type ProjectsWorkspaceTab = 'board' | 'taskList'

interface ProjectsWorkspacePageProps {
  projects: Project[]
  favoriteProjectIds: string[]
  selectedProjectId: string | null
  activeTab: ProjectsWorkspaceTab
  filterMode: ProjectsWorkspaceFilterMode
  newProjectRequest: { token: number } | null
  newSubtaskRequest: { projectId: string; milestoneId: string; token: number } | null
  taskListCollapseAllRequest: { token: number; collapsed: boolean } | null
  projectDrawerRequest: { projectId: string; token: number } | null
  focusedMilestoneTarget: { projectId: string; milestoneId: string; token: number } | null
  onFilterModeChange: (mode: ProjectsWorkspaceFilterMode) => void
  onTaskListCollapseStateChange: (collapsed: boolean) => void
  onMilestoneContextChange: (context: { projectId: string; milestoneId: string } | null) => void
  onActiveTabChange: (tab: ProjectsWorkspaceTab) => void
  onSelectProject: (projectId: string) => void
  onCreateProject: (input: { name: string; summary: string; icon: ProjectIconStyle }) => string
  onRenameProject: (projectId: string, nextName: string) => void
  onUpdateProjectSummary: (projectId: string, nextSummary: string) => void
  onUpdateProjectIcon: (projectId: string, nextIcon: ProjectIconStyle) => void
  onToggleProjectDone: (projectId: string) => void
  onToggleProjectFavorite: (projectId: string) => void
  onOpenProjectFolder: (project: Project) => Promise<void>
  onExportProject: (project: Project) => Promise<void>
  onDeleteProject: (projectId: string) => Promise<void>
  onAddMilestone: (
    projectId: string,
    input: {
      title: string
      description?: string
      dueDate?: string
      priority?: TaskPriority
      status?: ProjectMilestone['status']
    }
  ) => void
  onRenameMilestone: (projectId: string, milestoneId: string, nextTitle: string) => void
  onUpdateMilestoneDescription: (
    projectId: string,
    milestoneId: string,
    nextDescription: string
  ) => void
  onUpdateMilestoneDueDate: (
    projectId: string,
    milestoneId: string,
    nextDueDate: string | undefined
  ) => void
  onUpdateMilestoneStatus: (
    projectId: string,
    milestoneId: string,
    nextStatus: ProjectMilestone['status']
  ) => void
  onUpdateMilestonePriority: (
    projectId: string,
    milestoneId: string,
    nextPriority: TaskPriority | undefined
  ) => void
  onRemoveMilestone: (projectId: string, milestoneId: string) => void
  onAddSubtask: (
    projectId: string,
    milestoneId: string,
    input: {
      title: string
      description?: string
      dueDate?: string
      completed?: boolean
      priority?: TaskPriority
    }
  ) => void
  onToggleSubtask: (projectId: string, milestoneId: string, subtaskId: string) => void
  onRenameSubtask: (
    projectId: string,
    milestoneId: string,
    subtaskId: string,
    nextTitle: string
  ) => void
  onUpdateSubtaskDescription: (
    projectId: string,
    milestoneId: string,
    subtaskId: string,
    nextDescription: string
  ) => void
  onUpdateSubtaskDueDate: (
    projectId: string,
    milestoneId: string,
    subtaskId: string,
    nextDueDate: string | undefined
  ) => void
  onUpdateSubtaskPriority: (
    projectId: string,
    milestoneId: string,
    subtaskId: string,
    nextPriority: TaskPriority | undefined
  ) => void
  onRemoveSubtask: (projectId: string, milestoneId: string, subtaskId: string) => void
  onSaveProject: (
    projectId: string,
    draft: { name: string; summary: string; icon: ProjectIconStyle }
  ) => void
  onSaveMilestone: (
    projectId: string,
    milestoneId: string,
    draft: {
      title: string
      description: string
      dueDate: string
      status: 'pending' | 'blocked' | 'completed'
      priority: '' | TaskPriority
    }
  ) => void
  onSaveSubtask: (
    projectId: string,
    milestoneId: string,
    subtaskId: string,
    draft: {
      title: string
      description: string
      dueDate: string
      completed: boolean
      priority: '' | TaskPriority
    }
  ) => void
}

type DrawerState =
  | { kind: 'new-project' }
  | { kind: 'project'; projectId: string }
  | { kind: 'new-milestone'; projectId: string }
  | { kind: 'milestone'; projectId: string; milestoneId: string }
  | { kind: 'new-subtask'; projectId: string; milestoneId: string }
  | { kind: 'subtask'; projectId: string; milestoneId: string; subtaskId: string }

interface ProjectDraft {
  name: string
  summary: string
  icon: ProjectIconStyle
}

interface MilestoneDraft {
  title: string
  description: string
  dueDate: string
  status: 'pending' | 'blocked' | 'completed'
  priority: '' | TaskPriority
}

interface SubtaskDraft {
  title: string
  description: string
  dueDate: string
  completed: boolean
  priority: '' | TaskPriority
}

type TaskListGroupBy = 'project' | 'dueDate'
type TaskListRowHeight = 'compact' | 'default' | 'comfortable'

interface TaskListMilestoneBlock {
  milestoneRow: ProjectTaskRow
  rows: ProjectTaskRow[]
}

type TaskListDisplayRow =
  | { kind: 'task'; row: ProjectTaskRow }
  | {
      kind: 'create-subtask'
      projectId: string
      milestoneId: string
      milestoneTitle: string
    }
  | { kind: 'create-milestone'; projectId: string; projectName: string }

interface TaskListGroup {
  key: string
  label: string
  itemCount: number
  projectIcon?: Project['icon']
  rows: TaskListDisplayRow[]
}

const PRIORITY_OPTIONS: Array<{ value: '' | TaskPriority; label: string }> = [
  { value: '', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }
]

const MILESTONE_STATUS_OPTIONS: Array<{
  value: MilestoneDraft['status']
  label: string
}> = [
  { value: 'pending', label: 'Pending' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'completed', label: 'Completed' }
]

const TASK_LIST_GROUP_BY_OPTIONS: SelectionMenuOption[] = [
  {
    value: 'project',
    label: 'Group by Project',
    icon: <FolderOpen size={14} aria-hidden="true" />
  },
  {
    value: 'dueDate',
    label: 'Group by Due Date',
    icon: <CalendarDays size={14} aria-hidden="true" />
  }
]

const BOARD_GROUP_BY_OPTIONS: SelectionMenuOption[] = [
  {
    value: 'status',
    label: 'Group by Status',
    icon: <Flag size={14} aria-hidden="true" />
  },
  {
    value: 'updatedAt',
    label: 'Group by Recent Activity',
    icon: <CalendarDays size={14} aria-hidden="true" />
  }
]

const TASK_LIST_ROW_HEIGHT_OPTIONS: Array<{ value: TaskListRowHeight; label: string }> = [
  { value: 'compact', label: 'Compact' },
  { value: 'default', label: 'Default' },
  { value: 'comfortable', label: 'Comfortable' }
]

const TASK_LIST_DATA_CELL_PADDING_CLASS: Record<TaskListRowHeight, string> = {
  compact: 'py-1',
  default: 'py-2',
  comfortable: 'py-3'
}

const TASK_LIST_GROUP_BUTTON_PADDING_CLASS: Record<TaskListRowHeight, string> = {
  compact: 'py-1.5',
  default: 'py-3',
  comfortable: 'py-4'
}

const TASK_LIST_HELPER_BUTTON_PADDING_CLASS: Record<TaskListRowHeight, string> = {
  compact: 'py-1.5',
  default: 'py-2.5',
  comfortable: 'py-3.5'
}

const TASK_LIST_STATUS_CONTROL_SIZE_CLASS: Record<TaskListRowHeight, string> = {
  compact: 'h-7 w-7',
  default: 'h-9 w-9',
  comfortable: 'h-9 w-9'
}

const TASK_LIST_ACTION_BUTTON_SIZE_CLASS: Record<TaskListRowHeight, string> = {
  compact: 'h-7 w-7',
  default: 'h-8 w-8',
  comfortable: 'h-8 w-8'
}

const TASK_LIST_PROJECT_ICON_SIZE: Record<TaskListRowHeight, number> = {
  compact: 18,
  default: 22,
  comfortable: 22
}

const TASK_LIST_GROUP_ICON_SIZE: Record<TaskListRowHeight, number> = {
  compact: 20,
  default: 24,
  comfortable: 24
}

const TASK_LIST_GROUP_ROW_BACKGROUND_COLOR =
  'color-mix(in srgb, var(--accent-soft) 34%, color-mix(in srgb, var(--panel-3) 82%, var(--panel) 18%))'
const TASK_LIST_ROW_HOVER_CLASS =
  'hover:bg-[color:color-mix(in_srgb,var(--accent-soft)_46%,var(--panel-2))]'
const TASK_LIST_GRID_STYLE: CSSProperties = {
  gridTemplateColumns: '56px minmax(0, 4fr) minmax(0, 2fr) minmax(0, 2fr) 112px 124px 72px'
}

interface ProjectTaskSortState {
  key: ProjectTaskSortKey
  direction: ProjectTaskSortDirection
}

const defaultProjectTaskSort: ProjectTaskSortState = {
  key: 'dueDate',
  direction: 'asc'
}

export function ProjectsWorkspacePage({
  projects,
  favoriteProjectIds,
  selectedProjectId,
  activeTab,
  filterMode,
  newProjectRequest,
  newSubtaskRequest,
  taskListCollapseAllRequest,
  projectDrawerRequest,
  focusedMilestoneTarget,
  onFilterModeChange,
  onTaskListCollapseStateChange,
  onMilestoneContextChange,
  onActiveTabChange,
  onSelectProject,
  onCreateProject,
  onToggleProjectDone,
  onToggleProjectFavorite,
  onOpenProjectFolder,
  onExportProject,
  onDeleteProject,
  onAddMilestone,
  onRemoveMilestone,
  onAddSubtask,
  onToggleSubtask,
  onRemoveSubtask,
  onSaveProject,
  onSaveMilestone,
  onSaveSubtask
}: ProjectsWorkspacePageProps): ReactElement {
  const [drawerState, setDrawerState] = useState<DrawerState | null>(null)
  const [boardGroupBy, setBoardGroupBy] = usePersistentState<ProjectBoardGroupBy>(
    'beacon:projects-workspace:board-group-by',
    'status',
    { validate: isBoardGroupBy }
  )
  const [hideCompletedItems, setHideCompletedItems] = usePersistentState<boolean>(
    'beacon:projects-workspace:hide-completed-items',
    false,
    { validate: (value): value is boolean => typeof value === 'boolean' }
  )
  const [taskListGroupBy, setTaskListGroupBy] = useState<TaskListGroupBy>('project')
  const [taskListSort, setTaskListSort] = usePersistentState<ProjectTaskSortState>(
    'beacon:projects-workspace:task-list-sort',
    defaultProjectTaskSort,
    { validate: isProjectTaskSortState }
  )
  const [taskListRowHeight, setTaskListRowHeight] = usePersistentState<TaskListRowHeight>(
    'beacon:projects-workspace:task-list-row-height',
    'default',
    { validate: isTaskListRowHeight }
  )
  const [isTaskListViewMenuOpen, setIsTaskListViewMenuOpen] = useState(false)
  const [taskListCollapseOverrides, setTaskListCollapseOverrides] = useState<{
    scopeToken: number
    values: Record<string, boolean>
  }>({
    scopeToken: 0,
    values: {}
  })
  const [activeMilestoneToken, setActiveMilestoneToken] = useState<number | null>(null)

  const filteredProjects = useMemo(
    () => filterProjectsForWorkspace(projects, favoriteProjectIds, filterMode),
    [favoriteProjectIds, filterMode, projects]
  )
  const projectFilterOptions = useMemo(() => {
    const favoriteIds = new Set(favoriteProjectIds)
    return [
      { value: 'all' as const, label: 'All', count: projects.length },
      {
        value: 'favorites' as const,
        label: 'Favorites',
        count: projects.filter((project) => favoriteIds.has(project.id)).length
      },
      {
        value: 'active' as const,
        label: 'Active',
        count: projects.filter((project) => project.status !== 'completed').length
      },
      {
        value: 'completed' as const,
        label: 'Completed',
        count: projects.filter((project) => project.status === 'completed').length
      }
    ]
  }, [favoriteProjectIds, projects])
  const todayIso = useMemo(() => toLocalIsoDate(new Date()), [])
  const taskRows = useMemo(() => buildProjectTaskRows(filteredProjects), [filteredProjects])
  const effectiveHideCompletedItems = hideCompletedItems && activeMilestoneToken === null
  const visibleTaskRows = useMemo(
    () => (effectiveHideCompletedItems ? taskRows.filter((row) => !row.completed) : taskRows),
    [effectiveHideCompletedItems, taskRows]
  )
  const taskListGroups = useMemo(
    () => groupTaskRows(filteredProjects, visibleTaskRows, taskListGroupBy, todayIso, taskListSort),
    [filteredProjects, taskListGroupBy, taskListSort, todayIso, visibleTaskRows]
  )
  const taskListDataCellPaddingClass = TASK_LIST_DATA_CELL_PADDING_CLASS[taskListRowHeight]
  const taskListGroupButtonPaddingClass = TASK_LIST_GROUP_BUTTON_PADDING_CLASS[taskListRowHeight]
  const taskListHelperButtonPaddingClass = TASK_LIST_HELPER_BUTTON_PADDING_CLASS[taskListRowHeight]
  const taskListStatusControlSizeClass = TASK_LIST_STATUS_CONTROL_SIZE_CLASS[taskListRowHeight]
  const taskListActionButtonSizeClass = TASK_LIST_ACTION_BUTTON_SIZE_CLASS[taskListRowHeight]
  const taskListProjectIconSize = TASK_LIST_PROJECT_ICON_SIZE[taskListRowHeight]
  const taskListGroupIconSize = TASK_LIST_GROUP_ICON_SIZE[taskListRowHeight]
  const taskListCollapseScopeToken = taskListCollapseAllRequest?.token ?? 0
  const taskListCollapseBaseline = taskListCollapseAllRequest?.collapsed ?? false
  const effectiveTaskListCollapseOverrides = useMemo(
    () =>
      taskListCollapseOverrides.scopeToken === taskListCollapseScopeToken
        ? taskListCollapseOverrides.values
        : {},
    [taskListCollapseOverrides, taskListCollapseScopeToken]
  )
  const areAllTaskListGroupsCollapsed = useMemo(
    () =>
      taskListGroups.length > 0 &&
      taskListGroups.every(
        (group) => effectiveTaskListCollapseOverrides[group.key] ?? taskListCollapseBaseline
      ),
    [effectiveTaskListCollapseOverrides, taskListCollapseBaseline, taskListGroups]
  )
  const boardGroups = useMemo(
    () => buildProjectBoardGroups(filteredProjects, boardGroupBy),
    [boardGroupBy, filteredProjects]
  )

  const toggleTaskListSort = (key: ProjectTaskSortKey): void => {
    setTaskListSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    )
  }

  useEffect(() => {
    if (!newProjectRequest) {
      return
    }

    startTransition(() => {
      setDrawerState({ kind: 'new-project' })
    })
  }, [newProjectRequest])

  useEffect(() => {
    if (!projectDrawerRequest) {
      return
    }

    startTransition(() => {
      setDrawerState({ kind: 'project', projectId: projectDrawerRequest.projectId })
    })
  }, [projectDrawerRequest])

  useEffect(() => {
    if (!newSubtaskRequest) {
      return
    }

    startTransition(() => {
      setDrawerState({
        kind: 'new-subtask',
        projectId: newSubtaskRequest.projectId,
        milestoneId: newSubtaskRequest.milestoneId
      })
    })
  }, [newSubtaskRequest])

  useEffect(() => {
    if (!focusedMilestoneTarget) {
      return
    }

    startTransition(() => {
      setActiveMilestoneToken(focusedMilestoneTarget.token)
      setDrawerState({
        kind: 'milestone',
        projectId: focusedMilestoneTarget.projectId,
        milestoneId: focusedMilestoneTarget.milestoneId
      })
    })
  }, [focusedMilestoneTarget])

  useEffect(() => {
    if (activeMilestoneToken === null) {
      return
    }

    const timeout = window.setTimeout(() => {
      setActiveMilestoneToken(null)
    }, 2200)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [activeMilestoneToken])

  useEffect(() => {
    onTaskListCollapseStateChange(areAllTaskListGroupsCollapsed)
  }, [areAllTaskListGroupsCollapsed, onTaskListCollapseStateChange])

  const toggleTaskGroup = (groupKey: string): void => {
    const currentCollapsed =
      effectiveTaskListCollapseOverrides[groupKey] ?? taskListCollapseBaseline

    setTaskListCollapseOverrides((current) => ({
      scopeToken: taskListCollapseScopeToken,
      values:
        current.scopeToken === taskListCollapseScopeToken
          ? {
              ...current.values,
              [groupKey]: !currentCollapsed
            }
          : {
              [groupKey]: !currentCollapsed
            }
    }))
  }

  return (
    <div className="workspace-clear-surface flex h-full min-h-0 flex-col">
      <div
        data-testid="projects-workspace-content"
        className={cn(
          'min-h-0 flex-1',
          activeTab === 'board' ? 'flex flex-col overflow-hidden' : 'overflow-auto'
        )}
      >
        {activeTab === 'board' ? (
          <section
            data-testid="projects-board-shell"
            className="workspace-table-row-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--line)]"
          >
            <div
              data-testid="projects-board-toolbar"
              className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] bg-transparent px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <SelectionMenu
                  value={boardGroupBy}
                  onValueChange={(value) => setBoardGroupBy(value as ProjectBoardGroupBy)}
                  options={BOARD_GROUP_BY_OPTIONS}
                  selectedLabel={renderBoardGroupBySelectionLabel(boardGroupBy)}
                  variant="toolbar"
                  aria-label={`Board grouping: ${formatBoardGroupByLabel(boardGroupBy)}`}
                  title={`Board grouping: ${formatBoardGroupByLabel(boardGroupBy)}`}
                  className="min-w-[15rem]"
                  fullWidth={false}
                />
                <TabMenu
                  variant="toolbar"
                  value={filterMode}
                  onValueChange={(value) =>
                    onFilterModeChange(value as ProjectsWorkspaceFilterMode)
                  }
                  fullWidth={false}
                  withSpacer={false}
                >
                  {projectFilterOptions.map((option) => (
                    <TabMenuItem key={option.value} variant="toolbar" value={option.value}>
                      <span className="inline-flex items-center gap-2">
                        <span>{option.label}</span>
                        <TabMenuCountBadge count={option.count} />
                      </span>
                    </TabMenuItem>
                  ))}
                </TabMenu>
              </div>
              <div className="ml-auto flex shrink-0 items-center text-sm text-[var(--muted)]">
                {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-x-auto">
              <div className="grid h-full min-w-[960px] grid-cols-4">
                {boardGroups.map((group) => (
                  <section
                    key={group.key}
                    data-testid={`project-board-group:${boardGroupBy}:${group.key}`}
                    className="flex min-h-0 min-w-0 flex-col rounded-none border-r border-[var(--line)] last:border-r-0"
                  >
                    <div className="flex items-center justify-between border-b border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_20%,transparent)] px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[var(--text)]">
                          {group.label}
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          {group.projects.length}{' '}
                          {group.projects.length === 1 ? 'project' : 'projects'}
                        </div>
                      </div>
                      <Badge variant="neutral" tone={group.badgeTone}>
                        {group.badgeLabel}
                      </Badge>
                    </div>
                    <div
                      data-testid={`project-board-group-scroll:${boardGroupBy}:${group.key}`}
                      className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
                    >
                      <div className="flex flex-col gap-3">
                        {group.projects.length === 0 ? (
                          <div className="rounded-none border border-dashed border-[var(--line)] px-4 py-6 text-sm text-[var(--muted)]">
                            No projects in this group.
                          </div>
                        ) : (
                          group.projects.map((project) => {
                            const isActive =
                              drawerState?.kind === 'project' &&
                              drawerState.projectId === project.id
                            const projectProgress = Math.max(0, Math.min(100, project.progress))
                            const milestoneLabel = `${project.milestones.length} ${
                              project.milestones.length === 1 ? 'Milestone' : 'Milestones'
                            }`

                            return (
                              <article
                                key={project.id}
                                className={cn(
                                  'rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-4 shadow-sm transition-colors hover:border-[var(--accent)]',
                                  (isActive || selectedProjectId === project.id) &&
                                    'border-[var(--accent)] bg-[var(--accent-soft)]/30'
                                )}
                              >
                                <div className="flex flex-col gap-4">
                                  <div className="flex items-start gap-3">
                                    <button
                                      type="button"
                                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                                      onClick={() => {
                                        onSelectProject(project.id)
                                        onActiveTabChange('board')
                                        setDrawerState({ kind: 'project', projectId: project.id })
                                      }}
                                    >
                                      <NoteShapeIcon
                                        icon={project.icon}
                                        size={24}
                                        className="mt-0.5 shrink-0"
                                      />
                                      <div className="min-w-0 flex-1 truncate text-base font-semibold text-[var(--text)]">
                                        {project.name}
                                      </div>
                                    </button>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button
                                          type="button"
                                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--panel)] hover:text-[var(--text)]"
                                          aria-label={`Open actions for ${project.name}`}
                                        >
                                          <MoreHorizontal size={16} />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem
                                          onClick={() => {
                                            onSelectProject(project.id)
                                            setDrawerState({
                                              kind: 'project',
                                              projectId: project.id
                                            })
                                          }}
                                        >
                                          Edit project
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => void onOpenProjectFolder(project)}
                                        >
                                          {project.folderPath?.trim()
                                            ? 'Open folder'
                                            : 'Link folder'}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => void onExportProject(project)}
                                        >
                                          Export project
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => onToggleProjectDone(project.id)}
                                        >
                                          {project.status === 'completed'
                                            ? 'Reopen project'
                                            : 'Mark done'}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => onToggleProjectFavorite(project.id)}
                                        >
                                          {favoriteProjectIds.includes(project.id)
                                            ? 'Remove favorite'
                                            : 'Add favorite'}
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() => void onDeleteProject(project.id)}
                                        >
                                          Delete project
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                  <button
                                    type="button"
                                    className="flex w-full flex-col gap-4 text-left"
                                    onClick={() => {
                                      onSelectProject(project.id)
                                      onActiveTabChange('board')
                                      setDrawerState({ kind: 'project', projectId: project.id })
                                    }}
                                  >
                                    <div className="w-full text-sm text-[var(--muted)]">
                                      {project.summary || 'No summary yet.'}
                                    </div>
                                    <div
                                      className="flex w-full items-center gap-2"
                                      role="img"
                                      aria-label={`Project progress: ${projectProgress}% complete`}
                                      title={`${projectProgress}% complete`}
                                    >
                                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--panel)_78%,transparent)]">
                                        <div
                                          className="h-full rounded-full bg-[var(--accent)]"
                                          style={{ width: `${projectProgress}%` }}
                                        />
                                      </div>
                                      <span className="shrink-0 text-[10px] font-medium text-[var(--muted)]">
                                        {projectProgress}% complete
                                      </span>
                                    </div>
                                    <div className="flex w-full flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                                      <span>
                                        Updated {new Date(project.updatedAt).toLocaleDateString()}
                                      </span>
                                      <Circle
                                        size={6}
                                        fill="currentColor"
                                        stroke="none"
                                        aria-hidden="true"
                                        className="shrink-0"
                                      />
                                      <span>{PROJECT_STATUS_META[project.status].titleLabel}</span>
                                      <Circle
                                        size={6}
                                        fill="currentColor"
                                        stroke="none"
                                        aria-hidden="true"
                                        className="shrink-0"
                                      />
                                      <span>{milestoneLabel}</span>
                                    </div>
                                  </button>
                                </div>
                              </article>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="workspace-table-row-surface overflow-hidden rounded-2xl border border-[var(--line)]">
            <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] bg-transparent px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <SelectionMenu
                  value={taskListGroupBy}
                  onValueChange={(value) => setTaskListGroupBy(value as TaskListGroupBy)}
                  options={TASK_LIST_GROUP_BY_OPTIONS}
                  selectedLabel={renderTaskListGroupBySelectionLabel(taskListGroupBy)}
                  variant="toolbar"
                  aria-label={`Task list grouping: ${formatTaskListGroupByLabel(taskListGroupBy)}`}
                  title={`Task list grouping: ${formatTaskListGroupByLabel(taskListGroupBy)}`}
                  className="min-w-[13rem]"
                  fullWidth={false}
                />
                <TabMenu
                  variant="toolbar"
                  value={filterMode}
                  onValueChange={(value) =>
                    onFilterModeChange(value as ProjectsWorkspaceFilterMode)
                  }
                  fullWidth={false}
                  withSpacer={false}
                >
                  {projectFilterOptions.map((option) => (
                    <TabMenuItem key={option.value} variant="toolbar" value={option.value}>
                      <span className="inline-flex items-center gap-2">
                        <span>{option.label}</span>
                        <TabMenuCountBadge count={option.count} />
                      </span>
                    </TabMenuItem>
                  ))}
                </TabMenu>
                <WorkspaceActionButton
                  active={hideCompletedItems}
                  icon={<Rows3 size={16} />}
                  label={hideCompletedItems ? 'Show Completed' : 'Hide Completed'}
                  aria-label={hideCompletedItems ? 'Show completed items' : 'Hide completed items'}
                  aria-pressed={hideCompletedItems}
                  onClick={() => setHideCompletedItems((current) => !current)}
                />
              </div>
              <div className="ml-auto flex shrink-0 items-center">
                <Popover open={isTaskListViewMenuOpen} onOpenChange={setIsTaskListViewMenuOpen}>
                  <PopoverTrigger asChild>
                    <WorkspaceActionButton
                      active={isTaskListViewMenuOpen}
                      label="View Settings"
                      icon={<SlidersHorizontal size={16} />}
                      aria-label="Open task list view settings"
                    />
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-96 border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_86%,transparent)] p-3 text-[var(--text)] shadow-xl backdrop-blur-xl"
                  >
                    <div className="space-y-1">
                      <h2 className="text-sm font-semibold text-[var(--text)]">View Settings</h2>
                      <p className="text-xs text-[var(--muted)]">
                        Adjust how the task list is displayed.
                      </p>
                    </div>
                    <div className="mt-3 rounded-lg border border-[var(--line)]/80 bg-[color:color-mix(in_srgb,var(--panel)_72%,transparent)] p-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[var(--text)]">Row height</div>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Control the spacing for task rows in this list.
                        </p>
                      </div>
                      <div className="mt-3">
                        <SelectionMenu
                          value={taskListRowHeight}
                          onValueChange={(value) =>
                            setTaskListRowHeight(value as TaskListRowHeight)
                          }
                          options={TASK_LIST_ROW_HEIGHT_OPTIONS}
                          variant="toolbar"
                          align="end"
                          className="min-w-[10.5rem]"
                          selectedLabel={
                            TASK_LIST_ROW_HEIGHT_OPTIONS.find(
                              (option) => option.value === taskListRowHeight
                            )?.label ?? 'Default'
                          }
                          aria-label="Task list row height"
                          title="Task list row height"
                          fullWidth={false}
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div
              className="table-no-ripple-scope performance-surface-panel relative w-full overflow-auto rounded-b-2xl border"
              data-no-ripple-scope
            >
              <div className="min-w-full">
                <div
                  className="grid border-b border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_20%,transparent)]"
                  style={TASK_LIST_GRID_STYLE}
                >
                  <div className="flex h-10 items-center justify-center px-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center text-left transition-colors hover:text-[var(--text)]"
                      onClick={() => toggleTaskListSort('status')}
                      aria-label="Sort by status"
                    >
                      <Circle size={12} aria-hidden="true" />
                      <span className="sr-only">Status</span>
                    </button>
                  </div>
                  <div className="min-w-0 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    <button
                      type="button"
                      className="flex h-10 w-full items-center gap-1.5 text-left transition-colors hover:text-[var(--text)]"
                      onClick={() => toggleTaskListSort('title')}
                      aria-label="Sort by item"
                    >
                      <span className="min-w-0 flex-1">Item</span>
                      {renderTaskListSortIcon(taskListSort.key === 'title', taskListSort.direction)}
                    </button>
                  </div>
                  <div className="min-w-0 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    <button
                      type="button"
                      className="flex h-10 w-full items-center gap-1.5 text-left transition-colors hover:text-[var(--text)]"
                      onClick={() => toggleTaskListSort('project')}
                      aria-label="Sort by project"
                    >
                      <span className="min-w-0 flex-1">Project</span>
                      {renderTaskListSortIcon(
                        taskListSort.key === 'project',
                        taskListSort.direction
                      )}
                    </button>
                  </div>
                  <div className="min-w-0 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    <button
                      type="button"
                      className="flex h-10 w-full items-center gap-1.5 text-left transition-colors hover:text-[var(--text)]"
                      onClick={() => toggleTaskListSort('milestone')}
                      aria-label="Sort by milestone"
                    >
                      <span className="min-w-0 flex-1">Milestone</span>
                      {renderTaskListSortIcon(
                        taskListSort.key === 'milestone',
                        taskListSort.direction
                      )}
                    </button>
                  </div>
                  <div className="min-w-0 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    <button
                      type="button"
                      className="flex h-10 w-full items-center gap-1.5 whitespace-nowrap text-left transition-colors hover:text-[var(--text)]"
                      onClick={() => toggleTaskListSort('priority')}
                      aria-label="Sort by priority"
                    >
                      <span className="min-w-0 flex-1">Priority</span>
                      {renderTaskListSortIcon(
                        taskListSort.key === 'priority',
                        taskListSort.direction
                      )}
                    </button>
                  </div>
                  <div className="min-w-0 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    <button
                      type="button"
                      className="flex h-10 w-full items-center gap-1.5 whitespace-nowrap text-left transition-colors hover:text-[var(--text)]"
                      onClick={() => toggleTaskListSort('dueDate')}
                      aria-label="Sort by due date"
                    >
                      <span className="min-w-0 flex-1">Due Date</span>
                      {renderTaskListSortIcon(
                        taskListSort.key === 'dueDate',
                        taskListSort.direction
                      )}
                    </button>
                  </div>
                  <div className="flex h-10 items-center justify-center px-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    <MoreHorizontal size={12} aria-hidden="true" />
                    <span className="sr-only">Actions</span>
                  </div>
                </div>
                {taskListGroups.length === 0 ? (
                  <div className="py-8 text-center text-sm text-[var(--muted)]">
                    No project work matches the current filter.
                  </div>
                ) : (
                  taskListGroups.map((group) => {
                    const isCollapsed =
                      effectiveTaskListCollapseOverrides[group.key] ?? taskListCollapseBaseline

                    return (
                      <Fragment key={group.key}>
                        <div
                          className={cn(
                            'border-b border-[var(--line)] transition-colors',
                            TASK_LIST_ROW_HOVER_CLASS
                          )}
                          style={{ backgroundColor: TASK_LIST_GROUP_ROW_BACKGROUND_COLOR }}
                        >
                          <button
                            type="button"
                            className={cn(
                              'flex w-full items-center gap-3 px-4 text-left text-[var(--text)] transition-colors',
                              taskListGroupButtonPaddingClass
                            )}
                            onClick={() => toggleTaskGroup(group.key)}
                            aria-expanded={!isCollapsed}
                          >
                            {isCollapsed ? (
                              <ChevronRight size={16} className="shrink-0" />
                            ) : (
                              <ChevronDown size={16} className="shrink-0" />
                            )}
                            {group.projectIcon ? (
                              <NoteShapeIcon
                                icon={group.projectIcon}
                                size={taskListGroupIconSize}
                              />
                            ) : null}
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                              {group.label}
                            </span>
                            <span className="shrink-0 text-xs text-[var(--text)]">
                              {group.itemCount} {group.itemCount === 1 ? 'item' : 'items'}
                            </span>
                          </button>
                        </div>
                        {isCollapsed
                          ? null
                          : group.rows.map((displayRow) => {
                              if (displayRow.kind === 'create-subtask') {
                                return (
                                  <div
                                    key={`create-subtask:${displayRow.projectId}:${displayRow.milestoneId}`}
                                    className={cn(
                                      'border-b border-[var(--line)] transition-colors',
                                      TASK_LIST_ROW_HOVER_CLASS
                                    )}
                                  >
                                    <button
                                      type="button"
                                      className={cn(
                                        'flex w-full items-center gap-3 rounded-none bg-transparent px-4 text-left text-sm text-[color:color-mix(in_srgb,var(--muted)_62%,var(--panel-2))] transition-colors hover:text-[color:color-mix(in_srgb,var(--muted)_82%,var(--panel-2))]',
                                        taskListHelperButtonPaddingClass
                                      )}
                                      onClick={() => {
                                        onSelectProject(displayRow.projectId)
                                        onActiveTabChange('taskList')
                                        setDrawerState({
                                          kind: 'new-subtask',
                                          projectId: displayRow.projectId,
                                          milestoneId: displayRow.milestoneId
                                        })
                                      }}
                                      aria-label={`Add subtask to ${displayRow.milestoneTitle}`}
                                    >
                                      <Plus size={14} aria-hidden="true" />
                                      <span>Add Subtask</span>
                                    </button>
                                  </div>
                                )
                              }

                              if (displayRow.kind === 'create-milestone') {
                                return (
                                  <div
                                    key={`create-milestone:${displayRow.projectId}`}
                                    className={cn(
                                      'border-b border-[var(--line)] transition-colors',
                                      TASK_LIST_ROW_HOVER_CLASS
                                    )}
                                  >
                                    <button
                                      type="button"
                                      className={cn(
                                        'flex w-full items-center gap-3 rounded-none bg-transparent px-4 text-left text-sm text-[color:color-mix(in_srgb,var(--muted)_62%,var(--panel-2))] transition-colors hover:text-[color:color-mix(in_srgb,var(--muted)_82%,var(--panel-2))]',
                                        taskListHelperButtonPaddingClass
                                      )}
                                      onClick={() => {
                                        onSelectProject(displayRow.projectId)
                                        onActiveTabChange('taskList')
                                        setDrawerState({
                                          kind: 'new-milestone',
                                          projectId: displayRow.projectId
                                        })
                                      }}
                                      aria-label={`Add milestone to ${displayRow.projectName}`}
                                    >
                                      <Plus size={14} aria-hidden="true" />
                                      <span>Add Milestone</span>
                                    </button>
                                  </div>
                                )
                              }

                              const row = displayRow.row
                              const isMilestoneActive =
                                drawerState?.kind === 'milestone' &&
                                drawerState.projectId === row.projectId &&
                                drawerState.milestoneId === row.milestoneId
                              const isSubtaskActive =
                                drawerState?.kind === 'subtask' &&
                                drawerState.projectId === row.projectId &&
                                drawerState.milestoneId === row.milestoneId &&
                                drawerState.subtaskId === row.subtaskId

                              return (
                                <div
                                  key={row.id}
                                  className={cn(
                                    'grid items-center cursor-pointer border-b border-[var(--line)] transition-colors',
                                    TASK_LIST_ROW_HOVER_CLASS,
                                    (isMilestoneActive || isSubtaskActive) &&
                                      'bg-[var(--accent-soft)]/35',
                                    activeMilestoneToken !== null &&
                                      isRowHighlighted(row, focusedMilestoneTarget) &&
                                      'bg-[var(--accent-soft)]/35'
                                  )}
                                  style={TASK_LIST_GRID_STYLE}
                                  onClick={() => {
                                    onSelectProject(row.projectId)
                                    onActiveTabChange('taskList')
                                    setDrawerState(
                                      row.kind === 'milestone'
                                        ? {
                                            kind: 'milestone',
                                            projectId: row.projectId,
                                            milestoneId: row.milestoneId
                                          }
                                        : {
                                            kind: 'subtask',
                                            projectId: row.projectId,
                                            milestoneId: row.milestoneId,
                                            subtaskId: row.subtaskId as string
                                          }
                                    )
                                  }}
                                >
                                  <div
                                    className={cn(
                                      'flex items-center justify-center px-3',
                                      taskListDataCellPaddingClass
                                    )}
                                  >
                                    {row.kind === 'milestone' ? (
                                      renderMilestoneProgressControl(
                                        row,
                                        taskListStatusControlSizeClass
                                      )
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          onToggleSubtask(
                                            row.projectId,
                                            row.milestoneId,
                                            row.subtaskId as string
                                          )
                                        }}
                                        aria-label={
                                          row.completed
                                            ? 'Mark subtask as pending'
                                            : 'Mark subtask as complete'
                                        }
                                        title={
                                          row.completed
                                            ? 'Mark subtask as pending'
                                            : 'Mark subtask as complete'
                                        }
                                        data-testid={`project-task-list-subtask-toggle:${row.projectId}:${row.milestoneId}:${row.subtaskId as string}`}
                                        className={cn(
                                          'group relative flex shrink-0 items-center justify-center',
                                          taskListStatusControlSizeClass
                                        )}
                                      >
                                        <TaskListStatusGlyph
                                          checked={row.completed}
                                          variant="circle"
                                          ringTestId={`project-task-list-subtask-ring:${row.projectId}:${row.milestoneId}:${row.subtaskId as string}`}
                                          checkTestId={`project-task-list-subtask-check:${row.projectId}:${row.milestoneId}:${row.subtaskId as string}`}
                                          ringClassName="group-hover:border-[var(--accent)]"
                                          checkClassName="text-white"
                                          checkedCircleStyle={TASK_LIST_SUBTASK_CHECKED_STYLE}
                                          uncheckedCircleStyle={TASK_LIST_SUBTASK_UNCHECKED_STYLE}
                                        />
                                      </button>
                                    )}
                                  </div>
                                  <div
                                    className={cn(
                                      'flex min-w-0 items-center px-3 text-sm font-normal text-[var(--text)]',
                                      taskListDataCellPaddingClass
                                    )}
                                  >
                                    <div className="truncate">{row.title}</div>
                                  </div>
                                  <div
                                    className={cn(
                                      'flex min-w-0 items-center px-3 text-sm font-normal text-[var(--text)]',
                                      taskListDataCellPaddingClass
                                    )}
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      <NoteShapeIcon
                                        icon={row.projectIcon}
                                        size={taskListProjectIconSize}
                                      />
                                      <span className="truncate text-sm text-[var(--text)]">
                                        {row.projectName}
                                      </span>
                                    </div>
                                  </div>
                                  <div
                                    className={cn(
                                      'flex min-w-0 items-center px-3 text-sm font-normal text-[var(--text)]',
                                      taskListDataCellPaddingClass
                                    )}
                                  >
                                    <div className="truncate">
                                      {row.kind === 'milestone' ? '—' : row.milestoneTitle}
                                    </div>
                                  </div>
                                  <div
                                    className={cn(
                                      'flex items-center px-3 whitespace-nowrap text-sm font-normal text-[var(--text)]',
                                      taskListDataCellPaddingClass
                                    )}
                                  >
                                    {renderPriorityBadge(row.priority)}
                                  </div>
                                  <div
                                    className={cn(
                                      'flex items-center px-3 whitespace-nowrap text-sm font-normal text-[var(--text)]',
                                      taskListDataCellPaddingClass
                                    )}
                                  >
                                    {formatTaskListDueDate(row.dueDate)}
                                  </div>
                                  <div
                                    className={cn(
                                      'flex items-center justify-end px-3 text-right',
                                      taskListDataCellPaddingClass
                                    )}
                                  >
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button
                                          type="button"
                                          className={cn(
                                            'inline-flex items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--panel)] hover:text-[var(--text)]',
                                            taskListActionButtonSizeClass
                                          )}
                                          onClick={(event) => event.stopPropagation()}
                                          aria-label={`Open actions for ${row.title}`}
                                        >
                                          <MoreHorizontal size={16} />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem
                                          onClick={() => {
                                            onSelectProject(row.projectId)
                                            setDrawerState(
                                              row.kind === 'milestone'
                                                ? {
                                                    kind: 'milestone',
                                                    projectId: row.projectId,
                                                    milestoneId: row.milestoneId
                                                  }
                                                : {
                                                    kind: 'subtask',
                                                    projectId: row.projectId,
                                                    milestoneId: row.milestoneId,
                                                    subtaskId: row.subtaskId as string
                                                  }
                                            )
                                          }}
                                        >
                                          Edit {row.kind}
                                        </DropdownMenuItem>
                                        {row.kind === 'milestone' ? (
                                          <DropdownMenuItem
                                            onClick={() =>
                                              setDrawerState({
                                                kind: 'new-subtask',
                                                projectId: row.projectId,
                                                milestoneId: row.milestoneId
                                              })
                                            }
                                          >
                                            Add subtask
                                          </DropdownMenuItem>
                                        ) : (
                                          <DropdownMenuItem
                                            onClick={() =>
                                              onToggleSubtask(
                                                row.projectId,
                                                row.milestoneId,
                                                row.subtaskId as string
                                              )
                                            }
                                          >
                                            {row.completed ? 'Mark pending' : 'Mark complete'}
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() =>
                                            row.kind === 'milestone'
                                              ? onRemoveMilestone(row.projectId, row.milestoneId)
                                              : onRemoveSubtask(
                                                  row.projectId,
                                                  row.milestoneId,
                                                  row.subtaskId as string
                                                )
                                          }
                                        >
                                          Delete {row.kind}
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                              )
                            })}
                      </Fragment>
                    )
                  })
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      <ProjectsDrawer
        drawerState={drawerState}
        projects={projects}
        favoriteProjectIds={favoriteProjectIds}
        onDrawerStateChange={setDrawerState}
        onMilestoneContextChange={onMilestoneContextChange}
        onActiveTabChange={onActiveTabChange}
        onSelectProject={onSelectProject}
        onCreateProject={onCreateProject}
        onToggleProjectDone={onToggleProjectDone}
        onToggleProjectFavorite={onToggleProjectFavorite}
        onOpenProjectFolder={onOpenProjectFolder}
        onExportProject={onExportProject}
        onDeleteProject={onDeleteProject}
        onAddMilestone={onAddMilestone}
        onRemoveMilestone={onRemoveMilestone}
        onAddSubtask={onAddSubtask}
        onRemoveSubtask={onRemoveSubtask}
        onSaveProject={onSaveProject}
        onSaveMilestone={onSaveMilestone}
        onSaveSubtask={onSaveSubtask}
      />
    </div>
  )
}

type ProjectsDrawerProps = Pick<
  ProjectsWorkspacePageProps,
  | 'projects'
  | 'favoriteProjectIds'
  | 'onMilestoneContextChange'
  | 'onActiveTabChange'
  | 'onSelectProject'
  | 'onCreateProject'
  | 'onToggleProjectDone'
  | 'onToggleProjectFavorite'
  | 'onOpenProjectFolder'
  | 'onExportProject'
  | 'onDeleteProject'
  | 'onAddMilestone'
  | 'onRemoveMilestone'
  | 'onAddSubtask'
  | 'onRemoveSubtask'
  | 'onSaveProject'
  | 'onSaveMilestone'
  | 'onSaveSubtask'
> & {
  drawerState: DrawerState | null
  onDrawerStateChange: (state: DrawerState | null) => void
}

function ProjectsDrawer({
  drawerState,
  projects,
  favoriteProjectIds,
  onDrawerStateChange,
  onMilestoneContextChange,
  onActiveTabChange,
  onSelectProject,
  onCreateProject,
  onToggleProjectDone,
  onToggleProjectFavorite,
  onOpenProjectFolder,
  onExportProject,
  onDeleteProject,
  onAddMilestone,
  onRemoveMilestone,
  onAddSubtask,
  onRemoveSubtask,
  onSaveProject,
  onSaveMilestone,
  onSaveSubtask
}: ProjectsDrawerProps): ReactElement {
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(() => createEmptyProjectDraft())
  const [milestoneDraft, setMilestoneDraft] = useState<MilestoneDraft>(createEmptyMilestoneDraft())
  const [subtaskDraft, setSubtaskDraft] = useState<SubtaskDraft>(createEmptySubtaskDraft())
  const projectDraftRef = useRef(projectDraft)
  const milestoneDraftRef = useRef(milestoneDraft)
  const subtaskDraftRef = useRef(subtaskDraft)
  const previousDrawerStateRef = useRef<DrawerState | null>(drawerState)
  const initializedDrawerKeyRef = useRef<string | null>(null)
  const suppressAutoCommitRef = useRef(false)
  const drawerStateKey = getDrawerStateKey(drawerState)

  const {
    project: drawerProject,
    milestone: drawerMilestone,
    subtask: drawerSubtask
  } = useMemo(() => resolveDrawerEntities(projects, drawerState), [projects, drawerState])

  const handleProjectDraftChange = useCallback((next: ProjectDraft): void => {
    projectDraftRef.current = next
    setProjectDraft(next)
  }, [])

  const handleMilestoneDraftChange = useCallback((next: MilestoneDraft): void => {
    milestoneDraftRef.current = next
    setMilestoneDraft(next)
  }, [])

  const handleSubtaskDraftChange = useCallback((next: SubtaskDraft): void => {
    subtaskDraftRef.current = next
    setSubtaskDraft(next)
  }, [])

  const persistProjectDraft = useCallback(
    (project: Project): void => {
      const currentProjectDraft = projectDraftRef.current
      const normalizedName = currentProjectDraft.name.trim()

      if (!normalizedName) {
        return
      }

      onSaveProject(project.id, {
        name: normalizedName,
        summary: currentProjectDraft.summary.trim(),
        icon: currentProjectDraft.icon
      })
    },
    [onSaveProject]
  )

  const persistMilestoneDraft = useCallback(
    (project: Project, milestone: ProjectMilestone): void => {
      const currentMilestoneDraft = milestoneDraftRef.current
      const normalizedTitle = currentMilestoneDraft.title.trim()

      if (!normalizedTitle) {
        return
      }

      onSaveMilestone(project.id, milestone.id, {
        title: normalizedTitle,
        description: currentMilestoneDraft.description.trim(),
        dueDate: currentMilestoneDraft.dueDate,
        status: currentMilestoneDraft.status,
        priority: currentMilestoneDraft.priority
      })
    },
    [onSaveMilestone]
  )

  const persistSubtaskDraft = useCallback(
    (
      project: Project,
      milestone: ProjectMilestone,
      subtask: ProjectMilestone['subtasks'][number]
    ): void => {
      const currentSubtaskDraft = subtaskDraftRef.current
      const normalizedTitle = currentSubtaskDraft.title.trim()

      if (!normalizedTitle) {
        return
      }

      onSaveSubtask(project.id, milestone.id, subtask.id, {
        title: normalizedTitle,
        description: currentSubtaskDraft.description.trim(),
        dueDate: currentSubtaskDraft.dueDate,
        completed: currentSubtaskDraft.completed,
        priority: currentSubtaskDraft.priority
      })
    },
    [onSaveSubtask]
  )

  const commitDrawerDraft = useCallback(
    (state: DrawerState | null): void => {
      if (!state) {
        return
      }

      const { project, milestone, subtask } = resolveDrawerEntities(projects, state)

      if (state.kind === 'new-project') {
        const currentProjectDraft = projectDraftRef.current
        const normalizedName = currentProjectDraft.name.trim()

        if (!normalizedName) {
          return
        }

        const nextProjectId = onCreateProject({
          name: normalizedName,
          summary: currentProjectDraft.summary.trim(),
          icon: currentProjectDraft.icon
        })
        onSelectProject(nextProjectId)
        onActiveTabChange('board')
        return
      }

      if (state.kind === 'project' && project) {
        persistProjectDraft(project)
        return
      }

      if (state.kind === 'new-milestone' && project) {
        const currentMilestoneDraft = milestoneDraftRef.current
        const normalizedTitle = currentMilestoneDraft.title.trim()

        if (!normalizedTitle) {
          return
        }

        onAddMilestone(project.id, {
          title: normalizedTitle,
          description: currentMilestoneDraft.description.trim(),
          dueDate: currentMilestoneDraft.dueDate || undefined,
          priority: currentMilestoneDraft.priority || undefined,
          status: currentMilestoneDraft.status
        })
        return
      }

      if (state.kind === 'milestone' && project && milestone) {
        persistMilestoneDraft(project, milestone)
        return
      }

      if (state.kind === 'new-subtask' && project && milestone) {
        const currentSubtaskDraft = subtaskDraftRef.current
        const normalizedTitle = currentSubtaskDraft.title.trim()

        if (!normalizedTitle) {
          return
        }

        onAddSubtask(project.id, milestone.id, {
          title: normalizedTitle,
          description: currentSubtaskDraft.description.trim(),
          dueDate: currentSubtaskDraft.dueDate || undefined,
          priority: currentSubtaskDraft.priority || undefined,
          completed: currentSubtaskDraft.completed
        })
        return
      }

      if (state.kind === 'subtask' && project && milestone && subtask) {
        persistSubtaskDraft(project, milestone, subtask)
      }
    },
    [
      onActiveTabChange,
      onAddMilestone,
      onAddSubtask,
      onCreateProject,
      onSelectProject,
      persistMilestoneDraft,
      persistProjectDraft,
      persistSubtaskDraft,
      projects
    ]
  )

  const transitionDrawerState = (state: DrawerState | null): void => {
    suppressAutoCommitRef.current = true
    onDrawerStateChange(state)
  }

  useEffect(() => {
    if (
      drawerProject &&
      drawerMilestone &&
      (drawerState?.kind === 'milestone' ||
        drawerState?.kind === 'new-subtask' ||
        drawerState?.kind === 'subtask')
    ) {
      onMilestoneContextChange({
        projectId: drawerProject.id,
        milestoneId: drawerMilestone.id
      })
      return
    }

    onMilestoneContextChange(null)
  }, [drawerMilestone, drawerProject, drawerState, onMilestoneContextChange])

  useEffect(() => {
    const previousDrawerState = previousDrawerStateRef.current
    const previousDrawerKey = getDrawerStateKey(previousDrawerState)

    if (previousDrawerKey !== drawerStateKey) {
      if (previousDrawerState && !suppressAutoCommitRef.current) {
        commitDrawerDraft(previousDrawerState)
      }

      suppressAutoCommitRef.current = false
      previousDrawerStateRef.current = drawerState
    }
  }, [commitDrawerDraft, drawerState, drawerStateKey])

  useEffect(() => {
    if (!drawerState) {
      initializedDrawerKeyRef.current = null
      return
    }

    if (drawerStateKey === initializedDrawerKeyRef.current) {
      return
    }

    if (drawerState.kind === 'new-project') {
      const nextProjectDraft = createEmptyProjectDraft()
      projectDraftRef.current = nextProjectDraft
      startTransition(() => {
        setProjectDraft(nextProjectDraft)
      })
      initializedDrawerKeyRef.current = drawerStateKey
      return
    }

    if (drawerState.kind === 'project' && drawerProject) {
      const nextProjectDraft = {
        name: drawerProject.name,
        summary: drawerProject.summary,
        icon: coerceFilledLucideProjectIcon(drawerProject.icon, drawerProject.id)
      }
      projectDraftRef.current = nextProjectDraft
      startTransition(() => {
        setProjectDraft(nextProjectDraft)
      })
      initializedDrawerKeyRef.current = drawerStateKey
      return
    }

    if (drawerState.kind === 'new-milestone') {
      const nextMilestoneDraft = createEmptyMilestoneDraft()
      milestoneDraftRef.current = nextMilestoneDraft
      startTransition(() => {
        setMilestoneDraft(nextMilestoneDraft)
      })
      initializedDrawerKeyRef.current = drawerStateKey
      return
    }

    if (drawerState.kind === 'milestone' && drawerMilestone) {
      const nextMilestoneDraft = {
        title: drawerMilestone.title,
        description: drawerMilestone.description ?? '',
        dueDate: drawerMilestone.dueDate ?? '',
        status:
          drawerMilestone.status === 'blocked' || drawerMilestone.status === 'completed'
            ? drawerMilestone.status
            : 'pending',
        priority: drawerMilestone.priority ?? ''
      } satisfies MilestoneDraft
      milestoneDraftRef.current = nextMilestoneDraft
      startTransition(() => {
        setMilestoneDraft(nextMilestoneDraft)
      })
      initializedDrawerKeyRef.current = drawerStateKey
      return
    }

    if (drawerState.kind === 'new-subtask') {
      const nextSubtaskDraft = createEmptySubtaskDraft()
      subtaskDraftRef.current = nextSubtaskDraft
      startTransition(() => {
        setSubtaskDraft(nextSubtaskDraft)
      })
      initializedDrawerKeyRef.current = drawerStateKey
      return
    }

    if (drawerState.kind === 'subtask' && drawerSubtask) {
      const nextSubtaskDraft = {
        title: drawerSubtask.title,
        description: drawerSubtask.description ?? '',
        dueDate: drawerSubtask.dueDate ?? '',
        completed: drawerSubtask.completed,
        priority: drawerSubtask.priority ?? ''
      } satisfies SubtaskDraft
      subtaskDraftRef.current = nextSubtaskDraft
      startTransition(() => {
        setSubtaskDraft(nextSubtaskDraft)
      })
      initializedDrawerKeyRef.current = drawerStateKey
    }
  }, [drawerMilestone, drawerProject, drawerState, drawerStateKey, drawerSubtask])

  useEffect(() => {
    if (!drawerState) {
      return
    }

    if (drawerState.kind === 'project' && !drawerProject) {
      onDrawerStateChange(null)
      return
    }

    if (drawerState.kind === 'milestone' && !drawerMilestone) {
      onDrawerStateChange(null)
      return
    }

    if (drawerState.kind === 'subtask' && !drawerSubtask) {
      onDrawerStateChange(null)
    }
  }, [drawerMilestone, drawerProject, drawerState, drawerSubtask, onDrawerStateChange])

  const handleDrawerClose = (): void => {
    commitDrawerDraft(drawerState)
    transitionDrawerState(null)
  }

  const handleProjectSave = (): void => {
    const currentProjectDraft = projectDraftRef.current
    const normalizedName = currentProjectDraft.name.trim()
    if (!normalizedName) {
      return
    }

    if (drawerState?.kind === 'new-project') {
      const nextProjectId = onCreateProject({
        name: normalizedName,
        summary: currentProjectDraft.summary.trim(),
        icon: currentProjectDraft.icon
      })
      onSelectProject(nextProjectId)
      onActiveTabChange('board')
      transitionDrawerState({ kind: 'project', projectId: nextProjectId })
      return
    }

    if (drawerState?.kind !== 'project' || !drawerProject) {
      return
    }

    persistProjectDraft(drawerProject)
    transitionDrawerState(null)
  }

  const handleMilestoneSave = (): void => {
    const currentMilestoneDraft = milestoneDraftRef.current
    const normalizedTitle = currentMilestoneDraft.title.trim()
    if (!normalizedTitle || !drawerProject) {
      return
    }

    if (drawerState?.kind === 'new-milestone') {
      onAddMilestone(drawerProject.id, {
        title: normalizedTitle,
        description: currentMilestoneDraft.description.trim(),
        dueDate: currentMilestoneDraft.dueDate || undefined,
        priority: currentMilestoneDraft.priority || undefined,
        status: currentMilestoneDraft.status
      })
      transitionDrawerState(null)
      return
    }

    if (drawerState?.kind !== 'milestone' || !drawerMilestone) {
      return
    }

    persistMilestoneDraft(drawerProject, drawerMilestone)
    transitionDrawerState(null)
  }

  const handleSubtaskSave = (): void => {
    const currentSubtaskDraft = subtaskDraftRef.current
    const normalizedTitle = currentSubtaskDraft.title.trim()
    if (!normalizedTitle || !drawerProject || !drawerMilestone) {
      return
    }

    if (drawerState?.kind === 'new-subtask') {
      onAddSubtask(drawerProject.id, drawerMilestone.id, {
        title: normalizedTitle,
        description: currentSubtaskDraft.description.trim(),
        dueDate: currentSubtaskDraft.dueDate || undefined,
        priority: currentSubtaskDraft.priority || undefined,
        completed: currentSubtaskDraft.completed
      })
      transitionDrawerState(null)
      return
    }

    if (drawerState?.kind !== 'subtask' || !drawerSubtask) {
      return
    }

    persistSubtaskDraft(drawerProject, drawerMilestone, drawerSubtask)
    transitionDrawerState(null)
  }

  return (
    <Drawer open={drawerState !== null} onOpenChange={(open) => !open && handleDrawerClose()}>
      <DrawerContent side="right">
        {drawerState?.kind === 'new-project' ? (
          <>
            <DrawerHeader>
              <DrawerTitle>New Project</DrawerTitle>
              <DrawerDescription>Create a project for the board and task list.</DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
              <ProjectForm draft={projectDraft} onChange={handleProjectDraftChange} />
            </div>
            <DrawerFooter>
              <Button onClick={handleProjectSave}>Create project</Button>
            </DrawerFooter>
          </>
        ) : null}

        {drawerState?.kind === 'project' && drawerProject ? (
          <>
            <DrawerHeader>
              <DrawerTitle>{drawerProject.name}</DrawerTitle>
              <DrawerDescription>Edit project details and workspace actions.</DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
              <div className="mb-4 flex flex-wrap gap-2">
                <Badge variant="neutral" tone={PROJECT_STATUS_META[drawerProject.status].tone}>
                  <Flag size={12} />
                  {PROJECT_STATUS_META[drawerProject.status].titleLabel}
                </Badge>
                <Badge variant="neutral" tone="info">
                  {drawerProject.progress}% complete
                </Badge>
              </div>
              <ProjectForm draft={projectDraft} onChange={handleProjectDraftChange} />
              <div className="mt-6 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void onOpenProjectFolder(drawerProject)}>
                  <FolderOpen size={14} />
                  {drawerProject.folderPath?.trim() ? 'Open Folder' : 'Link Folder'}
                </Button>
                <Button variant="outline" onClick={() => onToggleProjectFavorite(drawerProject.id)}>
                  <Star
                    size={14}
                    className={favoriteProjectIds.includes(drawerProject.id) ? 'fill-current' : ''}
                  />
                  {favoriteProjectIds.includes(drawerProject.id) ? 'Favorited' : 'Favorite'}
                </Button>
              </div>
            </div>
            <DrawerFooter>
              <Button variant="outline" onClick={() => onToggleProjectDone(drawerProject.id)}>
                {drawerProject.status === 'completed' ? 'Reopen project' : 'Mark done'}
              </Button>
              <Button variant="outline" onClick={() => void onExportProject(drawerProject)}>
                Export
              </Button>
              <Button variant="outline" onClick={() => void onDeleteProject(drawerProject.id)}>
                <Trash2 size={14} />
                Delete
              </Button>
              <Button onClick={handleProjectSave}>Save changes</Button>
            </DrawerFooter>
          </>
        ) : null}

        {drawerState?.kind === 'new-milestone' && drawerProject ? (
          <>
            <DrawerHeader>
              <DrawerTitle>New Milestone</DrawerTitle>
              <DrawerDescription>Add a milestone to {drawerProject.name}.</DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
              <MilestoneForm draft={milestoneDraft} onChange={handleMilestoneDraftChange} />
            </div>
            <DrawerFooter>
              <Button onClick={handleMilestoneSave}>Create milestone</Button>
            </DrawerFooter>
          </>
        ) : null}

        {drawerState?.kind === 'milestone' && drawerProject && drawerMilestone ? (
          <>
            <DrawerHeader>
              <DrawerTitle>{drawerMilestone.title}</DrawerTitle>
              <DrawerDescription>
                Edit milestone details for {drawerProject.name}.
              </DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
              <MilestoneForm draft={milestoneDraft} onChange={handleMilestoneDraftChange} />
              <div className="mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    persistMilestoneDraft(drawerProject, drawerMilestone)
                    transitionDrawerState({
                      kind: 'new-subtask',
                      projectId: drawerProject.id,
                      milestoneId: drawerMilestone.id
                    })
                  }}
                >
                  <Plus size={14} />
                  Add Subtask
                </Button>
              </div>
            </div>
            <DrawerFooter>
              <Button
                variant="outline"
                onClick={() => onRemoveMilestone(drawerProject.id, drawerMilestone.id)}
              >
                <Trash2 size={14} />
                Delete
              </Button>
              <Button onClick={handleMilestoneSave}>Save changes</Button>
            </DrawerFooter>
          </>
        ) : null}

        {drawerState?.kind === 'new-subtask' && drawerProject && drawerMilestone ? (
          <>
            <DrawerHeader>
              <DrawerTitle>New Subtask</DrawerTitle>
              <DrawerDescription>Add a subtask to {drawerMilestone.title}.</DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
              <SubtaskForm draft={subtaskDraft} onChange={handleSubtaskDraftChange} />
            </div>
            <DrawerFooter>
              <Button onClick={handleSubtaskSave}>Create subtask</Button>
            </DrawerFooter>
          </>
        ) : null}

        {drawerState?.kind === 'subtask' && drawerProject && drawerMilestone && drawerSubtask ? (
          <>
            <DrawerHeader>
              <DrawerTitle>{drawerSubtask.title}</DrawerTitle>
              <DrawerDescription>
                Edit subtask details for {drawerMilestone.title}.
              </DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
              <SubtaskForm draft={subtaskDraft} onChange={handleSubtaskDraftChange} />
            </div>
            <DrawerFooter>
              <Button
                variant="outline"
                onClick={() =>
                  onRemoveSubtask(drawerProject.id, drawerMilestone.id, drawerSubtask.id)
                }
              >
                <Trash2 size={14} />
                Delete
              </Button>
              <Button onClick={handleSubtaskSave}>Save changes</Button>
            </DrawerFooter>
          </>
        ) : null}
      </DrawerContent>
    </Drawer>
  )
}

function ProjectForm({
  draft,
  onChange
}: {
  draft: ProjectDraft
  onChange: (next: ProjectDraft) => void
}): ReactElement {
  const icon = coerceFilledLucideProjectIcon(draft.icon, draft.name || 'project-icon')
  const iconGlyph = resolveProjectIconGlyph(icon)

  return (
    <div className="space-y-4">
      <Field label="Project name" htmlFor="project-name">
        <Input
          id="project-name"
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          placeholder="Project name"
        />
      </Field>
      <Field label="Summary" htmlFor="project-summary">
        <Textarea
          id="project-summary"
          value={draft.summary}
          onChange={(event) => onChange({ ...draft, summary: event.target.value })}
          placeholder="What is this project about?"
        />
      </Field>
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-4">
        <div className="mb-3 flex items-center gap-3">
          <NoteShapeIcon icon={icon} size={32} />
          <div>
            <div className="text-sm text-[var(--muted)]">Project icon</div>
            <div className="text-xs text-[var(--muted)]/80">Filled Lucide icons</div>
          </div>
        </div>
        <div className="space-y-4">
          <Field label="Glyph">
            <div className="flex flex-wrap gap-2">
              {PROJECT_ICON_SYMBOLS.map((glyph) => {
                const isActive = iconGlyph === glyph
                const nextIcon: ProjectIconStyle = {
                  ...icon,
                  set: 'lucide',
                  glyph,
                  shape: undefined,
                  variant: 'filled'
                }

                return (
                  <button
                    key={glyph}
                    type="button"
                    className={cn(
                      'inline-flex h-12 w-12 items-center justify-center rounded-xl border transition-colors',
                      isActive
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                        : 'border-[var(--line)] bg-[var(--panel)] hover:border-[var(--accent)]'
                    )}
                    onClick={() => onChange({ ...draft, icon: nextIcon })}
                    title={glyph}
                  >
                    <NoteShapeIcon icon={nextIcon} size={28} />
                  </button>
                )
              })}
            </div>
          </Field>
          <Field label="Background color">
            <div className="flex flex-wrap gap-2">
              {PROJECT_ICON_COLORS.map((color) => {
                const isActive = icon.color === color
                return (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      'h-8 w-8 rounded-full border-2 transition-transform',
                      isActive ? 'scale-105 border-[var(--text)]' : 'border-transparent'
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() =>
                      onChange({
                        ...draft,
                        icon: {
                          ...icon,
                          color
                        }
                      })
                    }
                    title={color}
                  />
                )
              })}
            </div>
          </Field>
          <Button
            variant="outline"
            onClick={() =>
              onChange({
                ...draft,
                icon: createRandomProjectIcon(`${draft.name}:${Date.now()}`)
              })
            }
          >
            Randomize icon
          </Button>
        </div>
      </div>
    </div>
  )
}

function MilestoneForm({
  draft,
  onChange
}: {
  draft: MilestoneDraft
  onChange: (next: MilestoneDraft) => void
}): ReactElement {
  return (
    <div className="space-y-4">
      <Field label="Title" htmlFor="milestone-title">
        <Input
          id="milestone-title"
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
        />
      </Field>
      <Field label="Description" htmlFor="milestone-description">
        <Textarea
          id="milestone-description"
          value={draft.description}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
        />
      </Field>
      <Field label="Due date" htmlFor="milestone-due-date">
        <Input
          id="milestone-due-date"
          type="date"
          value={draft.dueDate}
          onChange={(event) => onChange({ ...draft, dueDate: event.target.value })}
        />
      </Field>
      <Field label="Status">
        <Select
          value={draft.status}
          onChange={(event) =>
            onChange({
              ...draft,
              status: event.target.value as MilestoneDraft['status']
            })
          }
        >
          {MILESTONE_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Priority">
        <Select
          value={draft.priority}
          onChange={(event) =>
            onChange({
              ...draft,
              priority: event.target.value as MilestoneDraft['priority']
            })
          }
        >
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option.value || 'none'} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  )
}

function SubtaskForm({
  draft,
  onChange
}: {
  draft: SubtaskDraft
  onChange: (next: SubtaskDraft) => void
}): ReactElement {
  return (
    <div className="space-y-4">
      <Field label="Title" htmlFor="subtask-title">
        <Input
          id="subtask-title"
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
        />
      </Field>
      <Field label="Description" htmlFor="subtask-description">
        <Textarea
          id="subtask-description"
          value={draft.description}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
        />
      </Field>
      <Field label="Due date" htmlFor="subtask-due-date">
        <Input
          id="subtask-due-date"
          type="date"
          value={draft.dueDate}
          onChange={(event) => onChange({ ...draft, dueDate: event.target.value })}
        />
      </Field>
      <Field label="Priority">
        <Select
          value={draft.priority}
          onChange={(event) =>
            onChange({
              ...draft,
              priority: event.target.value as SubtaskDraft['priority']
            })
          }
        >
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option.value || 'none'} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Completed">
        <Button
          variant={draft.completed ? 'default' : 'outline'}
          onClick={() => onChange({ ...draft, completed: !draft.completed })}
        >
          {draft.completed ? 'Completed' : 'Pending'}
        </Button>
      </Field>
    </div>
  )
}

function renderPriorityBadge(priority: TaskPriority | undefined): ReactElement {
  if (!priority) {
    return <span className="text-sm text-[var(--muted)]">No priority</span>
  }

  const tone = priority === 'high' ? 'danger' : priority === 'medium' ? 'warning' : 'success'

  return (
    <Badge variant="neutral" tone={tone}>
      {capitalizeLabel(priority)}
    </Badge>
  )
}

function renderTaskListSortIcon(
  isActive: boolean,
  sortDirection: ProjectTaskSortDirection
): ReactElement {
  const Icon = !isActive ? ArrowUpDown : sortDirection === 'asc' ? ArrowUp : ArrowDown

  return <Icon size={12} aria-hidden="true" className="shrink-0" />
}

function renderMilestoneProgressControl(
  row: ProjectTaskRow,
  controlSizeClassName: string
): ReactElement {
  const progress = Math.max(0, Math.min(100, row.milestoneProgressPercent))
  const completedCount = row.milestoneCompletedSubtaskCount
  const totalCount = row.milestoneSubtaskCount
  const summary =
    totalCount > 0
      ? `${completedCount} of ${totalCount} subtasks complete`
      : row.completed
        ? 'Milestone complete'
        : 'No subtasks yet'

  return (
    <span
      role="img"
      aria-label={`Milestone progress: ${summary}`}
      title={summary}
      data-testid={`project-task-list-milestone-control:${row.projectId}:${row.milestoneId}`}
      className={cn('flex shrink-0 items-center justify-center', controlSizeClassName)}
    >
      <TaskListStatusGlyph
        checked={row.completed}
        variant="diamond"
        progress={progress}
        ringTestId={`project-task-list-milestone-ring:${row.projectId}:${row.milestoneId}`}
        checkTestId={`project-task-list-milestone-check:${row.projectId}:${row.milestoneId}`}
        glyphSizeClassName="h-4 w-4"
        checkIconSize={8}
      />
    </span>
  )
}

interface TaskListStatusGlyphProps {
  checked: boolean
  variant: 'circle' | 'diamond'
  progress?: number
  ringTestId: string
  checkTestId: string
  glyphSizeClassName?: string
  checkIconSize?: number
  ringClassName?: string
  checkClassName?: string
  checkedCircleStyle?: CSSProperties
  uncheckedCircleStyle?: CSSProperties
}

function TaskListStatusGlyph({
  checked,
  variant,
  progress = 0,
  ringTestId,
  checkTestId,
  glyphSizeClassName,
  checkIconSize = 10,
  ringClassName,
  checkClassName,
  checkedCircleStyle,
  uncheckedCircleStyle
}: TaskListStatusGlyphProps): ReactElement {
  const clampedProgress = Math.max(0, Math.min(100, progress))

  return (
    <span
      className={cn(
        'relative flex h-5 w-5 shrink-0 items-center justify-center',
        glyphSizeClassName
      )}
      aria-hidden="true"
    >
      {variant === 'diamond' ? (
        <>
          <span className="absolute inset-0 rotate-45 overflow-hidden shadow-[0_8px_20px_color-mix(in_srgb,#0f172a_14%,transparent)]">
            <span className="absolute inset-[-21%] -rotate-45">
              <span className="absolute inset-0 bg-[linear-gradient(180deg,#7dd3fc_0%,#2563eb_55%,#d946ef_100%)]" />
              <span
                className="absolute inset-0 bg-[color:color-mix(in_srgb,var(--panel-2)_78%,#0f172a_22%)]"
                style={{ clipPath: `inset(0 0 ${clampedProgress}% 0)` }}
              />
            </span>
          </span>
          <span
            data-testid={ringTestId}
            className={cn(
              'absolute inset-0 rotate-45 border-2 border-[color:color-mix(in_srgb,#67e8f9_46%,#1e293b_22%)] bg-transparent',
              ringClassName
            )}
          />
        </>
      ) : (
        <span
          data-testid={ringTestId}
          className={cn(
            checked
              ? 'absolute inset-0 rounded-full border-2 border-[var(--accent)] bg-[var(--accent)] text-[var(--primary-foreground)] shadow-[0_8px_18px_color-mix(in_srgb,var(--accent)_24%,transparent)]'
              : 'absolute inset-0 rounded-full border-2 border-[color:var(--calendar-task-text)] bg-[var(--panel)] shadow-[0_8px_18px_color-mix(in_srgb,#0f172a_14%,transparent)]',
            ringClassName
          )}
          style={checked ? checkedCircleStyle : uncheckedCircleStyle}
        />
      )}
      <span
        data-testid={checkTestId}
        className={cn(
          'pointer-events-none absolute inset-0 flex items-center justify-center drop-shadow-[0_1px_3px_rgba(8,15,30,0.45)]',
          variant === 'diamond' ? 'text-white' : 'text-[var(--primary-foreground)]',
          checkClassName
        )}
        style={{
          opacity: checked ? 1 : 0
        }}
      >
        <Check size={checkIconSize} strokeWidth={3} />
      </span>
    </span>
  )
}

const TASK_LIST_SUBTASK_BORDER_COLOR = 'color-mix(in srgb, #67e8f9 46%, #1e293b 22%)'
const TASK_LIST_SUBTASK_FILL_COLOR = 'color-mix(in srgb, #67e8f9 22%, var(--panel-2) 78%)'

const TASK_LIST_SUBTASK_CHECKED_STYLE: CSSProperties = {
  borderColor: TASK_LIST_SUBTASK_BORDER_COLOR,
  backgroundColor: TASK_LIST_SUBTASK_FILL_COLOR,
  boxShadow: '0 8px 18px color-mix(in srgb, #0f172a 14%, transparent)'
}

const TASK_LIST_SUBTASK_UNCHECKED_STYLE: CSSProperties = {
  borderColor: TASK_LIST_SUBTASK_BORDER_COLOR,
  backgroundColor: 'transparent',
  boxShadow: '0 8px 18px color-mix(in srgb, #0f172a 14%, transparent)'
}

function formatTaskListDueDate(value: string | undefined): string {
  if (!value) {
    return 'No due date'
  }

  return format(parseISO(value), 'MMM d, yyyy')
}

function isProjectTaskSortState(value: unknown): value is ProjectTaskSortState {
  return (
    typeof value === 'object' &&
    value !== null &&
    ((value as { key?: unknown }).key === 'status' ||
      (value as { key?: unknown }).key === 'title' ||
      (value as { key?: unknown }).key === 'project' ||
      (value as { key?: unknown }).key === 'milestone' ||
      (value as { key?: unknown }).key === 'priority' ||
      (value as { key?: unknown }).key === 'dueDate') &&
    ((value as { direction?: unknown }).direction === 'asc' ||
      (value as { direction?: unknown }).direction === 'desc')
  )
}

function isTaskListRowHeight(value: unknown): value is TaskListRowHeight {
  return value === 'compact' || value === 'default' || value === 'comfortable'
}

function isBoardGroupBy(value: unknown): value is ProjectBoardGroupBy {
  return value === 'status' || value === 'updatedAt'
}

function formatBoardGroupByLabel(value: ProjectBoardGroupBy): string {
  const option = BOARD_GROUP_BY_OPTIONS.find((item) => item.value === value)
  return typeof option?.label === 'string' ? option.label : value
}

function renderBoardGroupBySelectionLabel(value: ProjectBoardGroupBy): ReactElement | string {
  const option = BOARD_GROUP_BY_OPTIONS.find((item) => item.value === value)
  if (!option) {
    return value
  }

  return (
    <span className="inline-flex items-center gap-2">
      {option.icon ? <span className="shrink-0 text-[var(--muted)]">{option.icon}</span> : null}
      <span>{option.label}</span>
    </span>
  )
}

function formatTaskListGroupByLabel(value: TaskListGroupBy): string {
  const option = TASK_LIST_GROUP_BY_OPTIONS.find((item) => item.value === value)
  return typeof option?.label === 'string' ? option.label : value
}

function renderTaskListGroupBySelectionLabel(value: TaskListGroupBy): ReactElement | string {
  const option = TASK_LIST_GROUP_BY_OPTIONS.find((item) => item.value === value)
  if (!option) {
    return value
  }

  return (
    <span className="inline-flex items-center gap-2">
      {option.icon ? <span className="shrink-0 text-[var(--muted)]">{option.icon}</span> : null}
      <span>{option.label}</span>
    </span>
  )
}

function groupTaskRows(
  projects: Project[],
  rows: ProjectTaskRow[],
  groupBy: TaskListGroupBy,
  todayIso: string,
  sort: ProjectTaskSortState
): TaskListGroup[] {
  const milestoneBlocks = buildMilestoneBlocks(rows, sort).sort((left, right) =>
    compareProjectTaskRows(left.milestoneRow, right.milestoneRow, sort.key, sort.direction)
  )
  if (groupBy === 'project') {
    return groupTaskRowsByProject(projects, milestoneBlocks)
  }

  return groupTaskRowsByDueDate(milestoneBlocks, todayIso)
}

function groupTaskRowsByProject(
  projects: Project[],
  milestoneBlocks: TaskListMilestoneBlock[]
): TaskListGroup[] {
  const groups = new Map<string, TaskListGroup>()

  projects.forEach((project) => {
    groups.set(`project:${project.id}`, {
      key: `project:${project.id}`,
      label: project.name,
      itemCount: 0,
      projectIcon: project.icon,
      rows: []
    })
  })

  milestoneBlocks.forEach((block) => {
    const groupKey = `project:${block.milestoneRow.projectId}`
    const group = groups.get(groupKey)
    if (!group) {
      return
    }

    group.rows.push(...createTaskListDisplayRows(block))
    group.itemCount += block.rows.length
  })

  return Array.from(groups.values()).map((group) => ({
    ...group,
    rows: [
      ...group.rows,
      {
        kind: 'create-milestone',
        projectId: group.key.slice('project:'.length),
        projectName: group.label
      }
    ]
  }))
}

function groupTaskRowsByDueDate(
  milestoneBlocks: TaskListMilestoneBlock[],
  todayIso: string
): TaskListGroup[] {
  const groups = new Map<string, TaskListGroup>()

  milestoneBlocks.forEach((block) => {
    const descriptor = getDueDateGroupDescriptor(block.milestoneRow.dueDate, todayIso)
    const existing = groups.get(descriptor.key)

    if (existing) {
      existing.rows.push(...createTaskListDisplayRows(block))
      existing.itemCount += block.rows.length
      return
    }

    groups.set(descriptor.key, {
      key: descriptor.key,
      label: descriptor.label,
      itemCount: block.rows.length,
      rows: createTaskListDisplayRows(block)
    })
  })

  return Array.from(groups.values())
}

function createTaskListDisplayRows(block: TaskListMilestoneBlock): TaskListDisplayRow[] {
  return [
    ...block.rows.map((row) => ({ kind: 'task', row }) as const),
    {
      kind: 'create-subtask',
      projectId: block.milestoneRow.projectId,
      milestoneId: block.milestoneRow.milestoneId,
      milestoneTitle: block.milestoneRow.milestoneTitle
    }
  ]
}

function buildMilestoneBlocks(
  rows: ProjectTaskRow[],
  sort: ProjectTaskSortState
): TaskListMilestoneBlock[] {
  const blocks = new Map<
    string,
    {
      milestoneRow: ProjectTaskRow | null
      seedRow: ProjectTaskRow | null
      subtasks: ProjectTaskRow[]
    }
  >()

  rows.forEach((row) => {
    const existing = blocks.get(row.milestoneId)

    if (row.kind === 'milestone') {
      if (existing) {
        existing.milestoneRow = row
        existing.seedRow = existing.seedRow ?? row
        return
      }

      blocks.set(row.milestoneId, {
        milestoneRow: row,
        seedRow: row,
        subtasks: []
      })
      return
    }

    if (existing) {
      existing.seedRow = existing.seedRow ?? row
      existing.subtasks.push(row)
      return
    }

    blocks.set(row.milestoneId, {
      milestoneRow: null,
      seedRow: row,
      subtasks: [row]
    })
  })

  return Array.from(blocks.values())
    .map((block) => {
      const milestoneRow =
        block.milestoneRow ?? (block.seedRow ? createMilestoneAnchorRow(block.seedRow) : null)

      if (!milestoneRow) {
        return null
      }

      const subtasks = [...block.subtasks].sort((left, right) =>
        compareProjectTaskRows(left, right, sort.key, sort.direction)
      )

      return {
        milestoneRow,
        rows: [milestoneRow, ...subtasks]
      }
    })
    .filter((block): block is TaskListMilestoneBlock => Boolean(block))
}

function createMilestoneAnchorRow(row: ProjectTaskRow): ProjectTaskRow {
  return {
    ...row,
    id: `milestone-anchor:${row.projectId}:${row.milestoneId}`,
    kind: 'milestone',
    title: row.milestoneTitle,
    completed:
      row.milestoneStatus === 'completed' ||
      (row.milestoneSubtaskCount > 0 &&
        row.milestoneCompletedSubtaskCount === row.milestoneSubtaskCount),
    priority: row.milestonePriority,
    dueDate: row.milestoneDueDate,
    subtaskId: undefined
  }
}

function getDueDateGroupDescriptor(
  dueDate: string | undefined,
  todayIso: string
): { key: string; label: string } {
  if (!dueDate) {
    return { key: 'due:none', label: 'No Due Date' }
  }

  if (dueDate < todayIso) {
    return { key: 'due:overdue', label: 'Overdue' }
  }

  if (dueDate === todayIso) {
    return { key: 'due:today', label: 'Due Today' }
  }

  const today = new Date(`${todayIso}T00:00:00`)
  const due = new Date(`${dueDate}T00:00:00`)
  const dayDiff = Math.round((due.getTime() - today.getTime()) / 86_400_000)

  if (dayDiff === 1) {
    return { key: 'due:tomorrow', label: 'Due Tomorrow' }
  }

  if (dayDiff <= 7) {
    return { key: 'due:this-week', label: 'Due This Week' }
  }

  return { key: 'due:later', label: 'Due Later' }
}

function getDrawerStateKey(state: DrawerState | null): string | null {
  if (!state) {
    return null
  }

  switch (state.kind) {
    case 'new-project':
      return 'new-project'
    case 'project':
      return `project:${state.projectId}`
    case 'new-milestone':
      return `new-milestone:${state.projectId}`
    case 'milestone':
      return `milestone:${state.projectId}:${state.milestoneId}`
    case 'new-subtask':
      return `new-subtask:${state.projectId}:${state.milestoneId}`
    case 'subtask':
      return `subtask:${state.projectId}:${state.milestoneId}:${state.subtaskId}`
  }
}

function resolveDrawerEntities(
  projects: Project[],
  state: DrawerState | null
): {
  project: Project | null
  milestone: ProjectMilestone | null
  subtask: ProjectMilestone['subtasks'][number] | null
} {
  if (!state || state.kind === 'new-project') {
    return { project: null, milestone: null, subtask: null }
  }

  const project = projects.find((candidate) => candidate.id === state.projectId) ?? null

  if (!project || state.kind === 'project' || state.kind === 'new-milestone') {
    return { project, milestone: null, subtask: null }
  }

  const milestone =
    project.milestones.find((candidate) => candidate.id === state.milestoneId) ?? null

  if (!milestone || state.kind === 'milestone' || state.kind === 'new-subtask') {
    return { project, milestone, subtask: null }
  }

  const subtask = milestone.subtasks.find((candidate) => candidate.id === state.subtaskId) ?? null

  return { project, milestone, subtask }
}

function createEmptyProjectDraft(): ProjectDraft {
  return {
    name: '',
    summary: '',
    icon: createRandomProjectIcon('new-project')
  }
}

function createEmptyMilestoneDraft(): MilestoneDraft {
  return {
    title: '',
    description: '',
    dueDate: '',
    status: 'pending',
    priority: ''
  }
}

function createEmptySubtaskDraft(): SubtaskDraft {
  return {
    title: '',
    description: '',
    dueDate: '',
    completed: false,
    priority: ''
  }
}

function capitalizeLabel(value: string): string {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function isRowHighlighted(
  row: ProjectTaskRow,
  focusedMilestoneTarget: { projectId: string; milestoneId: string; token: number } | null
): boolean {
  if (!focusedMilestoneTarget) {
    return false
  }

  return (
    row.projectId === focusedMilestoneTarget.projectId &&
    row.milestoneId === focusedMilestoneTarget.milestoneId
  )
}
