import { format, parseISO } from 'date-fns'
import { Fragment, ReactElement, useEffect, useMemo, useState } from 'react'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import MuiCheckbox from '@mui/material/Checkbox'
import LinearProgress from '@mui/material/LinearProgress'
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Circle,
  Flag,
  FolderOpen,
  MoreHorizontal,
  Plus,
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
import { Field } from '../components/ui/field'
import { Input } from '../components/ui/input'
import { SelectionMenu, type SelectionMenuOption } from '../components/ui/selection-menu'
import { Select } from '../components/ui/select'
import { TabMenu, TabMenuItem } from '../components/ui/tab-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  SortableTableHead,
  TableRow
} from '../components/ui/table'
import { Textarea } from '../components/ui/textarea'
import { usePersistentState } from '../hooks/usePersistentState'
import {
  buildProjectTaskRows,
  compareProjectTaskRows,
  PROJECTS_WORKSPACE_FILTER_OPTIONS,
  filterProjectsForWorkspace,
  type ProjectTaskRow,
  type ProjectTaskSortDirection,
  type ProjectTaskSortKey,
  type ProjectsWorkspaceFilterMode
} from '../lib/projectTaskRows'
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
  newMilestoneRequest: { projectId: string; token: number } | null
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

const BOARD_COLUMNS: Array<{ status: Project['status']; title: string }> = [
  { status: 'on-track', title: 'On Track' },
  { status: 'at-risk', title: 'At Risk' },
  { status: 'blocked', title: 'Blocked' },
  { status: 'completed', title: 'Completed' }
]

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
  newMilestoneRequest,
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
  onRenameProject,
  onUpdateProjectSummary,
  onUpdateProjectIcon,
  onToggleProjectDone,
  onToggleProjectFavorite,
  onOpenProjectFolder,
  onExportProject,
  onDeleteProject,
  onAddMilestone,
  onRenameMilestone,
  onUpdateMilestoneDescription,
  onUpdateMilestoneDueDate,
  onUpdateMilestoneStatus,
  onUpdateMilestonePriority,
  onRemoveMilestone,
  onAddSubtask,
  onToggleSubtask,
  onRenameSubtask,
  onUpdateSubtaskDescription,
  onUpdateSubtaskDueDate,
  onUpdateSubtaskPriority,
  onRemoveSubtask
}: ProjectsWorkspacePageProps): ReactElement {
  const [drawerState, setDrawerState] = useState<DrawerState | null>(null)
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(() => createEmptyProjectDraft())
  const [milestoneDraft, setMilestoneDraft] = useState<MilestoneDraft>(createEmptyMilestoneDraft())
  const [subtaskDraft, setSubtaskDraft] = useState<SubtaskDraft>(createEmptySubtaskDraft())
  const [hideCompletedItems, setHideCompletedItems] = useState(false)
  const [taskListGroupBy, setTaskListGroupBy] = useState<TaskListGroupBy>('project')
  const [taskListSort, setTaskListSort] = usePersistentState<ProjectTaskSortState>(
    'beacon:projects-workspace:task-list-sort',
    defaultProjectTaskSort,
    { validate: isProjectTaskSortState }
  )
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
  const todayIso = useMemo(() => toLocalIsoDate(new Date()), [])
  const taskRows = useMemo(() => buildProjectTaskRows(filteredProjects), [filteredProjects])
  const visibleTaskRows = useMemo(
    () => (hideCompletedItems ? taskRows.filter((row) => !row.completed) : taskRows),
    [hideCompletedItems, taskRows]
  )
  const taskListGroups = useMemo(
    () => groupTaskRows(filteredProjects, visibleTaskRows, taskListGroupBy, todayIso, taskListSort),
    [filteredProjects, taskListGroupBy, taskListSort, todayIso, visibleTaskRows]
  )
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
  const boardColumns = useMemo(
    () =>
      BOARD_COLUMNS.map((column) => ({
        ...column,
        projects: filteredProjects
          .filter((project) => project.status === column.status)
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      })),
    [filteredProjects]
  )

  const toggleTaskListSort = (key: ProjectTaskSortKey): void => {
    setTaskListSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    )
  }

  const drawerProject =
    drawerState?.kind === 'project' || drawerState?.kind === 'new-milestone'
      ? (projects.find((project) => project.id === drawerState.projectId) ?? null)
      : drawerState?.kind === 'milestone' ||
          drawerState?.kind === 'new-subtask' ||
          drawerState?.kind === 'subtask'
        ? (projects.find((project) => project.id === drawerState.projectId) ?? null)
        : null

  const drawerMilestone =
    drawerProject &&
    (drawerState?.kind === 'milestone' ||
      drawerState?.kind === 'new-subtask' ||
      drawerState?.kind === 'subtask')
      ? (drawerProject.milestones.find((milestone) => milestone.id === drawerState.milestoneId) ??
        null)
      : null

  const drawerSubtask =
    drawerMilestone && drawerState?.kind === 'subtask'
      ? (drawerMilestone.subtasks.find((subtask) => subtask.id === drawerState.subtaskId) ?? null)
      : null

  useEffect(() => {
    if (!newProjectRequest) {
      return
    }

    setDrawerState({ kind: 'new-project' })
  }, [newProjectRequest])

  useEffect(() => {
    if (!projectDrawerRequest) {
      return
    }

    setDrawerState({ kind: 'project', projectId: projectDrawerRequest.projectId })
  }, [projectDrawerRequest])

  useEffect(() => {
    if (!newMilestoneRequest) {
      return
    }

    setDrawerState({ kind: 'new-milestone', projectId: newMilestoneRequest.projectId })
  }, [newMilestoneRequest])

  useEffect(() => {
    if (!newSubtaskRequest) {
      return
    }

    setDrawerState({
      kind: 'new-subtask',
      projectId: newSubtaskRequest.projectId,
      milestoneId: newSubtaskRequest.milestoneId
    })
  }, [newSubtaskRequest])

  useEffect(() => {
    if (!focusedMilestoneTarget) {
      return
    }

    setHideCompletedItems(false)
    setActiveMilestoneToken(focusedMilestoneTarget.token)
    setDrawerState({
      kind: 'milestone',
      projectId: focusedMilestoneTarget.projectId,
      milestoneId: focusedMilestoneTarget.milestoneId
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
    onTaskListCollapseStateChange(areAllTaskListGroupsCollapsed)
  }, [areAllTaskListGroupsCollapsed, onTaskListCollapseStateChange])

  useEffect(() => {
    if (!drawerState) {
      return
    }

    if (drawerState.kind === 'new-project') {
      setProjectDraft(createEmptyProjectDraft())
      return
    }

    if (drawerState.kind === 'project' && drawerProject) {
      setProjectDraft({
        name: drawerProject.name,
        summary: drawerProject.summary,
        icon: coerceFilledLucideProjectIcon(drawerProject.icon, drawerProject.id)
      })
      return
    }

    if (drawerState.kind === 'new-milestone') {
      setMilestoneDraft(createEmptyMilestoneDraft())
      return
    }

    if (drawerState.kind === 'milestone' && drawerMilestone) {
      setMilestoneDraft({
        title: drawerMilestone.title,
        description: drawerMilestone.description ?? '',
        dueDate: drawerMilestone.dueDate ?? '',
        status:
          drawerMilestone.status === 'blocked' || drawerMilestone.status === 'completed'
            ? drawerMilestone.status
            : 'pending',
        priority: drawerMilestone.priority ?? ''
      })
      return
    }

    if (drawerState.kind === 'new-subtask') {
      setSubtaskDraft(createEmptySubtaskDraft())
      return
    }

    if (drawerState.kind === 'subtask' && drawerSubtask) {
      setSubtaskDraft({
        title: drawerSubtask.title,
        description: drawerSubtask.description ?? '',
        dueDate: drawerSubtask.dueDate ?? '',
        completed: drawerSubtask.completed,
        priority: drawerSubtask.priority ?? ''
      })
    }
  }, [drawerMilestone, drawerProject, drawerState, drawerSubtask])

  useEffect(() => {
    if (!drawerState) {
      return
    }

    if (drawerState.kind === 'project' && !drawerProject) {
      setDrawerState(null)
      return
    }

    if (drawerState.kind === 'milestone' && !drawerMilestone) {
      setDrawerState(null)
      return
    }

    if (drawerState.kind === 'subtask' && !drawerSubtask) {
      setDrawerState(null)
    }
  }, [drawerMilestone, drawerProject, drawerState, drawerSubtask])

  const handleProjectSave = (): void => {
    const normalizedName = projectDraft.name.trim()
    if (!normalizedName) {
      return
    }

    if (drawerState?.kind === 'new-project') {
      const nextProjectId = onCreateProject({
        name: normalizedName,
        summary: projectDraft.summary.trim(),
        icon: projectDraft.icon
      })
      onSelectProject(nextProjectId)
      setDrawerState({ kind: 'project', projectId: nextProjectId })
      onActiveTabChange('board')
      return
    }

    if (drawerState?.kind !== 'project' || !drawerProject) {
      return
    }

    onRenameProject(drawerProject.id, normalizedName)
    onUpdateProjectSummary(drawerProject.id, projectDraft.summary.trim())
    onUpdateProjectIcon(drawerProject.id, projectDraft.icon)
    setDrawerState(null)
  }

  const handleMilestoneSave = (): void => {
    const normalizedTitle = milestoneDraft.title.trim()
    if (!normalizedTitle || !drawerProject) {
      return
    }

    if (drawerState?.kind === 'new-milestone') {
      onAddMilestone(drawerProject.id, {
        title: normalizedTitle,
        description: milestoneDraft.description.trim(),
        dueDate: milestoneDraft.dueDate || undefined,
        priority: milestoneDraft.priority || undefined,
        status: milestoneDraft.status
      })
      setDrawerState(null)
      return
    }

    if (drawerState?.kind !== 'milestone' || !drawerMilestone) {
      return
    }

    onRenameMilestone(drawerProject.id, drawerMilestone.id, normalizedTitle)
    onUpdateMilestoneDescription(
      drawerProject.id,
      drawerMilestone.id,
      milestoneDraft.description.trim()
    )
    onUpdateMilestoneDueDate(
      drawerProject.id,
      drawerMilestone.id,
      milestoneDraft.dueDate || undefined
    )
    onUpdateMilestoneStatus(drawerProject.id, drawerMilestone.id, milestoneDraft.status)
    onUpdateMilestonePriority(
      drawerProject.id,
      drawerMilestone.id,
      milestoneDraft.priority || undefined
    )
    setDrawerState(null)
  }

  const handleSubtaskSave = (): void => {
    const normalizedTitle = subtaskDraft.title.trim()
    if (!normalizedTitle || !drawerProject || !drawerMilestone) {
      return
    }

    if (drawerState?.kind === 'new-subtask') {
      onAddSubtask(drawerProject.id, drawerMilestone.id, {
        title: normalizedTitle,
        description: subtaskDraft.description.trim(),
        dueDate: subtaskDraft.dueDate || undefined,
        priority: subtaskDraft.priority || undefined,
        completed: subtaskDraft.completed
      })
      setDrawerState(null)
      return
    }

    if (drawerState?.kind !== 'subtask' || !drawerSubtask) {
      return
    }

    onRenameSubtask(drawerProject.id, drawerMilestone.id, drawerSubtask.id, normalizedTitle)
    onUpdateSubtaskDescription(
      drawerProject.id,
      drawerMilestone.id,
      drawerSubtask.id,
      subtaskDraft.description.trim()
    )
    onUpdateSubtaskDueDate(
      drawerProject.id,
      drawerMilestone.id,
      drawerSubtask.id,
      subtaskDraft.dueDate || undefined
    )
    onUpdateSubtaskPriority(
      drawerProject.id,
      drawerMilestone.id,
      drawerSubtask.id,
      subtaskDraft.priority || undefined
    )

    if (drawerSubtask.completed !== subtaskDraft.completed) {
      onToggleSubtask(drawerProject.id, drawerMilestone.id, drawerSubtask.id)
    }

    setDrawerState(null)
  }

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
    <div className="workspace-clear-surface flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-auto px-8 py-6">
        {activeTab === 'board' ? (
          <>
            <div className="mb-4 text-right">
              <div className="inline-flex text-sm text-[var(--muted)]">
                {filteredProjects.length} projects
              </div>
            </div>
            <div className="grid min-h-full gap-4 xl:grid-cols-4">
              {boardColumns.map((column) => (
                <section
                  key={column.status}
                  className="flex min-h-[24rem] flex-col rounded-2xl border border-[var(--line)] bg-[var(--panel)]/60"
                >
                  <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--text)]">{column.title}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {column.projects.length} projects
                      </div>
                    </div>
                    <Badge variant="neutral" tone={PROJECT_STATUS_META[column.status].tone}>
                      {PROJECT_STATUS_META[column.status].titleLabel}
                    </Badge>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    {column.projects.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-sm text-[var(--muted)]">
                        No projects in this column.
                      </div>
                    ) : (
                      column.projects.map((project) => {
                        const isActive =
                          drawerState?.kind === 'project' && drawerState.projectId === project.id

                        return (
                          <article
                            key={project.id}
                            className={cn(
                              'rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-4 shadow-sm transition-colors hover:border-[var(--accent)]',
                              (isActive || selectedProjectId === project.id) &&
                                'border-[var(--accent)] bg-[var(--accent-soft)]/30'
                            )}
                          >
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
                                <NoteShapeIcon icon={project.icon} size={24} className="mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-base font-semibold text-[var(--text)]">
                                    {project.name}
                                  </div>
                                  <div className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
                                    {project.summary || 'No summary yet.'}
                                  </div>
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
                                      setDrawerState({ kind: 'project', projectId: project.id })
                                    }}
                                  >
                                    Edit project
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => void onOpenProjectFolder(project)}
                                  >
                                    {project.folderPath?.trim() ? 'Open folder' : 'Link folder'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => void onExportProject(project)}>
                                    Export project
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onToggleProjectDone(project.id)}>
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

                            <div className="mt-4 flex flex-wrap gap-2">
                              <Badge
                                variant="neutral"
                                tone={PROJECT_STATUS_META[project.status].tone}
                              >
                                <Flag size={12} />
                                {PROJECT_STATUS_META[project.status].titleLabel}
                              </Badge>
                              <Badge variant="neutral" tone="info">
                                {project.progress}% complete
                              </Badge>
                              <Badge variant="neutral" tone="neutral">
                                {project.milestones.length} milestones
                              </Badge>
                            </div>

                            <div className="mt-4 text-xs text-[var(--muted)]">
                              Updated {new Date(project.updatedAt).toLocaleDateString()}
                            </div>
                          </article>
                        )
                      })
                    )}
                  </div>
                </section>
              ))}
            </div>
          </>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_12%,transparent)]">
            <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_20%,transparent)] px-4 py-3">
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
                  {PROJECTS_WORKSPACE_FILTER_OPTIONS.map((option) => (
                    <TabMenuItem key={option.value} variant="toolbar" value={option.value}>
                      {option.label}
                    </TabMenuItem>
                  ))}
                </TabMenu>
                <TabMenu
                  variant="toolbar"
                  value={hideCompletedItems ? 'hidden' : 'shown'}
                  onValueChange={(value) => setHideCompletedItems(value === 'hidden')}
                  fullWidth={false}
                  withSpacer={false}
                >
                  <TabMenuItem variant="toolbar" value="shown">
                    Show Completed
                  </TabMenuItem>
                  <TabMenuItem variant="toolbar" value="hidden">
                    Hide Completed
                  </TabMenuItem>
                </TabMenu>
              </div>
            </div>
            <Table className="projects-task-list-table table-fixed">
              <colgroup>
                <col style={{ width: '56px' }} />
                <col />
                <col />
                <col />
                <col style={{ width: '112px' }} />
                <col style={{ width: '124px' }} />
                <col style={{ width: '72px' }} />
              </colgroup>
              <TableHeader className="bg-[color:color-mix(in_srgb,var(--panel)_20%,transparent)]">
                <TableRow>
                  <SortableTableHead
                    className="w-[56px] border-r-0 text-center"
                    isActive={taskListSort.key === 'status'}
                    sortDirection={taskListSort.direction}
                    onToggleSort={() => toggleTaskListSort('status')}
                  >
                    <span className="inline-flex items-center justify-center">
                      <Circle size={12} aria-hidden="true" />
                      <span className="sr-only">Status</span>
                    </span>
                  </SortableTableHead>
                  <SortableTableHead
                    className="border-r-0"
                    isActive={taskListSort.key === 'title'}
                    sortDirection={taskListSort.direction}
                    onToggleSort={() => toggleTaskListSort('title')}
                  >
                    Item
                  </SortableTableHead>
                  <SortableTableHead
                    className="border-r-0"
                    isActive={taskListSort.key === 'project'}
                    sortDirection={taskListSort.direction}
                    onToggleSort={() => toggleTaskListSort('project')}
                  >
                    Project
                  </SortableTableHead>
                  <SortableTableHead
                    className="border-r-0"
                    isActive={taskListSort.key === 'milestone'}
                    sortDirection={taskListSort.direction}
                    onToggleSort={() => toggleTaskListSort('milestone')}
                  >
                    Milestone
                  </SortableTableHead>
                  <SortableTableHead
                    className="w-[112px] whitespace-nowrap border-r-0"
                    isActive={taskListSort.key === 'priority'}
                    sortDirection={taskListSort.direction}
                    onToggleSort={() => toggleTaskListSort('priority')}
                  >
                    Priority
                  </SortableTableHead>
                  <SortableTableHead
                    className="w-[124px] whitespace-nowrap border-r-0"
                    isActive={taskListSort.key === 'dueDate'}
                    sortDirection={taskListSort.direction}
                    onToggleSort={() => toggleTaskListSort('dueDate')}
                  >
                    Due Date
                  </SortableTableHead>
                  <TableHead className="w-[72px] border-r-0 text-center">
                    <span className="inline-flex items-center justify-center">
                      <MoreHorizontal size={12} aria-hidden="true" />
                      <span className="sr-only">Actions</span>
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taskListGroups.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="border-r-0 py-8 text-center text-sm text-[var(--muted)]"
                    >
                      No project work matches the current filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  taskListGroups.map((group) => {
                    const isCollapsed =
                      effectiveTaskListCollapseOverrides[group.key] ?? taskListCollapseBaseline

                    return (
                      <Fragment key={group.key}>
                        <TableRow className="hover:bg-transparent">
                          <TableCell
                            colSpan={7}
                            className="border-r-0 border-y border-[var(--accent-line)] bg-[color:color-mix(in_srgb,var(--accent)_16%,transparent)] px-4 py-0 text-[var(--accent)]"
                          >
                            <button
                              type="button"
                              className="flex w-full items-center gap-3 py-3 text-left text-[var(--accent)] transition-colors hover:text-[var(--text)]"
                              onClick={() => toggleTaskGroup(group.key)}
                              aria-expanded={!isCollapsed}
                            >
                              {isCollapsed ? (
                                <ChevronRight size={16} className="shrink-0" />
                              ) : (
                                <ChevronDown size={16} className="shrink-0" />
                              )}
                              {group.projectIcon ? (
                                <NoteShapeIcon icon={group.projectIcon} size={24} />
                              ) : null}
                              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                                {group.label}
                              </span>
                              <span className="shrink-0 text-xs text-[var(--muted)]">
                                {group.itemCount} {group.itemCount === 1 ? 'item' : 'items'}
                              </span>
                            </button>
                          </TableCell>
                        </TableRow>
                        {isCollapsed
                          ? null
                          : group.rows.map((displayRow) => {
                              if (displayRow.kind === 'create-subtask') {
                                return (
                                  <TableRow
                                    key={`create-subtask:${displayRow.projectId}:${displayRow.milestoneId}`}
                                  >
                                    <TableCell colSpan={7} className="border-r-0 p-0">
                                      <button
                                        type="button"
                                        className="flex w-full items-center gap-3 rounded-none border border-[var(--accent-line)] bg-[color:color-mix(in_srgb,var(--accent)_8%,transparent)] px-4 py-2.5 text-left text-sm text-[var(--accent)] transition-colors hover:bg-[color:color-mix(in_srgb,var(--accent)_14%,transparent)] hover:text-[var(--text)]"
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
                                        <span className="font-medium">Add Subtask</span>
                                      </button>
                                    </TableCell>
                                  </TableRow>
                                )
                              }

                              if (displayRow.kind === 'create-milestone') {
                                return (
                                  <TableRow key={`create-milestone:${displayRow.projectId}`}>
                                    <TableCell colSpan={7} className="border-r-0 p-0">
                                      <button
                                        type="button"
                                        className="flex w-full items-center gap-3 rounded-none border border-[var(--accent-line)] bg-[color:color-mix(in_srgb,var(--accent)_8%,transparent)] px-4 py-2.5 text-left text-sm text-[var(--accent)] transition-colors hover:bg-[color:color-mix(in_srgb,var(--accent)_14%,transparent)] hover:text-[var(--text)]"
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
                                        <span className="font-medium">Add Milestone</span>
                                      </button>
                                    </TableCell>
                                  </TableRow>
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
                                <TableRow
                                  key={row.id}
                                  className={cn(
                                    'cursor-pointer transition-colors hover:bg-[var(--panel-2)]/70',
                                    (isMilestoneActive || isSubtaskActive) &&
                                      'bg-[var(--accent-soft)]/35',
                                    activeMilestoneToken !== null &&
                                      isRowHighlighted(row, focusedMilestoneTarget) &&
                                      'bg-[var(--accent-soft)]/35'
                                  )}
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
                                  <TableCell className="border-r-0">
                                    {row.kind === 'milestone' ? (
                                      renderMilestoneProgressControl(row)
                                    ) : (
                                      <MuiCheckbox
                                        checked={row.completed}
                                        disableRipple
                                        icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                                        checkedIcon={<CheckBoxIcon fontSize="small" />}
                                        onClick={(event) => event.stopPropagation()}
                                        onChange={() =>
                                          onToggleSubtask(
                                            row.projectId,
                                            row.milestoneId,
                                            row.subtaskId as string
                                          )
                                        }
                                        inputProps={{
                                          'aria-label': row.completed
                                            ? 'Mark subtask as pending'
                                            : 'Mark subtask as complete'
                                        }}
                                        sx={{
                                          p: '4px',
                                          color: 'var(--line-strong)',
                                          '&.Mui-checked': {
                                            color: 'var(--accent)'
                                          },
                                          '&:hover': {
                                            backgroundColor: 'transparent',
                                            color: 'var(--accent)'
                                          },
                                          '& .MuiSvgIcon-root': {
                                            fontSize: 22,
                                            transition:
                                              'transform 180ms ease, color 180ms ease, opacity 180ms ease'
                                          }
                                        }}
                                      />
                                    )}
                                  </TableCell>
                                  <TableCell className="border-r-0">
                                    <div
                                      className={cn(
                                        'truncate font-medium text-[var(--text)]',
                                        row.completed &&
                                          'text-[color:color-mix(in_srgb,var(--text)_58%,var(--muted))]'
                                      )}
                                    >
                                      {row.title}
                                    </div>
                                  </TableCell>
                                  <TableCell className="border-r-0">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <NoteShapeIcon icon={row.projectIcon} size={22} />
                                      <span className="truncate text-sm text-[var(--text)]">
                                        {row.projectName}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="border-r-0 text-sm text-[var(--muted)]">
                                    {row.kind === 'milestone' ? '—' : row.milestoneTitle}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap border-r-0">
                                    {renderPriorityBadge(row.priority)}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap border-r-0 text-sm text-[var(--muted)]">
                                    {formatTaskListDueDate(row.dueDate)}
                                  </TableCell>
                                  <TableCell className="border-r-0 text-right">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button
                                          type="button"
                                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--panel)] hover:text-[var(--text)]"
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
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                      </Fragment>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </section>
        )}
      </div>

      <Drawer open={drawerState !== null} onOpenChange={(open) => !open && setDrawerState(null)}>
        <DrawerContent side="right">
          {drawerState?.kind === 'new-project' ? (
            <>
              <DrawerHeader>
                <DrawerTitle>New Project</DrawerTitle>
                <DrawerDescription>Create a project for the board and task list.</DrawerDescription>
              </DrawerHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
                <ProjectForm draft={projectDraft} onChange={setProjectDraft} />
              </div>
              <DrawerFooter>
                <Button variant="outline" onClick={() => setDrawerState(null)}>
                  Cancel
                </Button>
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
                <ProjectForm draft={projectDraft} onChange={setProjectDraft} />
                <div className="mt-6 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void onOpenProjectFolder(drawerProject)}>
                    <FolderOpen size={14} />
                    {drawerProject.folderPath?.trim() ? 'Open Folder' : 'Link Folder'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onToggleProjectFavorite(drawerProject.id)}
                  >
                    <Star
                      size={14}
                      className={
                        favoriteProjectIds.includes(drawerProject.id) ? 'fill-current' : ''
                      }
                    />
                    {favoriteProjectIds.includes(drawerProject.id) ? 'Favorited' : 'Favorite'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setDrawerState({ kind: 'new-milestone', projectId: drawerProject.id })
                    }
                  >
                    <Plus size={14} />
                    Add Milestone
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
                <MilestoneForm draft={milestoneDraft} onChange={setMilestoneDraft} />
              </div>
              <DrawerFooter>
                <Button variant="outline" onClick={() => setDrawerState(null)}>
                  Cancel
                </Button>
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
                <MilestoneForm draft={milestoneDraft} onChange={setMilestoneDraft} />
                <div className="mt-6">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setDrawerState({
                        kind: 'new-subtask',
                        projectId: drawerProject.id,
                        milestoneId: drawerMilestone.id
                      })
                    }
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
                <SubtaskForm draft={subtaskDraft} onChange={setSubtaskDraft} />
              </div>
              <DrawerFooter>
                <Button variant="outline" onClick={() => setDrawerState(null)}>
                  Cancel
                </Button>
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
                <SubtaskForm draft={subtaskDraft} onChange={setSubtaskDraft} />
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
    </div>
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
                      'inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors',
                      isActive
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                        : 'border-[var(--line)] bg-[var(--panel)] hover:border-[var(--accent)]'
                    )}
                    onClick={() => onChange({ ...draft, icon: nextIcon })}
                    title={glyph}
                  >
                    <NoteShapeIcon icon={nextIcon} size={22} />
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

function renderMilestoneProgressControl(row: ProjectTaskRow): ReactElement {
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
      className="relative inline-flex h-9 w-7 shrink-0 items-center justify-center"
    >
      <span className="absolute left-1/2 top-1/2 h-[22px] w-[14px] -translate-x-1/2 -translate-y-1/2 rotate-45 overflow-hidden border border-[color:color-mix(in_srgb,#67e8f9_50%,#1e293b_20%)] bg-[color:color-mix(in_srgb,var(--panel)_74%,#0f172a_26%)] shadow-[0_8px_20px_color-mix(in_srgb,#0f172a_14%,transparent)]">
        <LinearProgress
          variant="determinate"
          value={progress}
          aria-hidden="true"
          sx={{
            position: 'absolute',
            inset: 0,
            width: '160%',
            height: '100%',
            left: '-30%',
            backgroundColor: 'color-mix(in_srgb, var(--panel-2) 78%, #0f172a 22%)',
            borderRadius: 0,
            transform: 'rotate(-90deg)',
            transformOrigin: 'center',
            '& .MuiLinearProgress-bar': {
              borderRadius: 0,
              backgroundImage:
                'linear-gradient(180deg, #7dd3fc 0%, #2563eb 55%, #d946ef 100%)'
            }
          }}
        />
      </span>
      <CheckRoundedIcon
        sx={{
          position: 'relative',
          zIndex: 1,
          fontSize: 13,
          color: '#ffffff',
          filter: 'drop-shadow(0 1px 3px rgba(8,15,30,0.45))',
          transition: 'transform 180ms ease, opacity 180ms ease',
          transform: row.completed ? 'scale(1)' : 'scale(0.5)',
          opacity: row.completed ? 1 : 0
        }}
      />
    </span>
  )
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
