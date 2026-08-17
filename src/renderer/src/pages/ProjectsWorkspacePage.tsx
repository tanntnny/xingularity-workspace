import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactElement,
  type SyntheticEvent
} from 'react'
import type {
  CalendarTask,
  Project,
  ProjectIconStyle,
  ProjectMilestone,
  ProjectPropertiesPatch,
  TaskStatus
} from '../../../shared/types'
import { normalizeTag } from '../../../shared/noteTags'
import { NoteShapeIcon } from '../components/NoteShapeIcon'
import { ProjectIconPicker } from '../components/ProjectIconPicker'
import { TaskStatusIcon } from '../components/TaskStatusIcon'
import { MilestoneCompletenessIcon } from '../components/MilestoneCompletenessIcon'
import { TaskTagSummary } from '../components/TaskTagSummary'
import { TaskContextMenu } from '../components/TaskContextMenu'
import { ProjectMilestoneContextMenu } from '../components/ProjectContextMenus'
import { InlineEditableText } from '../components/InlineEditableText'
import { TASK_STATUS_META, getTaskStatus } from '../lib/taskStatus'
import { formatCalendarTaskScheduleLabel } from '../lib/calendarTaskScheduleLabel'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/button'
import { DatePickerISO } from '../components/ui/date-picker'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { TagChip } from '../components/TagChip'
import {
  WorkspaceHeaderSecondaryActionsRight,
  WorkspaceHeaderActionDivider,
  WorkspaceIconButton,
  WorkspacePanelStack
} from '../components/ui/document-workspace'
import { CollapsibleWorkspacePanelSection } from '../components/ui/workspace-panel-section'
import { WorkspacePropertyRow } from '../components/ui/workspace-property-row'
import { WorkspaceListRail, WorkspaceListRailItem } from '../components/ui/workspace-list-rail'
import { EmptyState } from '../components/ui/empty-state'
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group'
import { SelectiveChip, type SelectiveChipOption } from '../components/ui/selective-chip'
import {
  filterProjectsForWorkspace,
  PROJECTS_WORKSPACE_FILTER_OPTIONS,
  type ProjectsWorkspaceFilterMode
} from '../lib/projectTaskRows'
import {
  Archive,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Star,
  Trash2,
  X
} from '../components/ui/icons'
import { APP_PAGE_ICONS } from '../lib/pageIcons'
import {
  getProjectDirectTasks,
  getProjectMilestoneProgress,
  getProjectMilestoneTasks
} from '../lib/projectMilestones'

export type { ProjectsWorkspaceFilterMode } from '../lib/projectTaskRows'

const TASK_STATUS_CHIP_OPTIONS: readonly SelectiveChipOption[] = (
  Object.keys(TASK_STATUS_META) as TaskStatus[]
).map((value) => {
  const meta = TASK_STATUS_META[value]
  return {
    value,
    label: meta.label,
    icon: <TaskStatusIcon status={value} size={18} />,
    tone: meta.tone
  }
})

interface ProjectsWorkspacePageProps {
  projects: Project[]
  tasks: CalendarTask[]
  favoriteProjectIds: string[]
  selectedProjectId: string | null
  filterMode: ProjectsWorkspaceFilterMode
  onFilterModeChange: (mode: ProjectsWorkspaceFilterMode) => void
  onCreateTask: (
    projectId: string | undefined,
    title: string,
    milestoneId?: string
  ) => Promise<CalendarTask>
  onCreateMilestone: (projectId: string, title: string) => Promise<ProjectMilestone>
  onUpdateMilestone: (projectId: string, milestoneId: string, title: string) => void
  onDeleteMilestone: (projectId: string, milestoneId: string) => Promise<void>
  onUpdateProject: (
    projectId: string,
    draft: { name: string; description: string; icon: ProjectIconStyle }
  ) => void
  onUpdateProjectProperties: (projectId: string, patch: ProjectPropertiesPatch) => void
  onUpdateTask: (taskId: string, patch: Partial<CalendarTask>) => void
  onDeleteTask: (taskId: string) => void
  onOpenTask: (taskId: string) => void
}

export function ProjectsWorkspacePage({
  projects,
  tasks,
  favoriteProjectIds,
  selectedProjectId,
  filterMode,
  onFilterModeChange,
  onCreateTask,
  onCreateMilestone,
  onUpdateMilestone,
  onDeleteMilestone,
  onUpdateProject,
  onUpdateProjectProperties,
  onUpdateTask,
  onDeleteTask,
  onOpenTask
}: ProjectsWorkspacePageProps): ReactElement {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null)
  const [milestoneEditToken, setMilestoneEditToken] = useState(0)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [isCreatingMilestone, setIsCreatingMilestone] = useState(false)
  const [expandedMilestoneIds, setExpandedMilestoneIds] = useState<Set<string>>(() => new Set())

  const visibleProjects = useMemo(
    () => filterProjectsForWorkspace(projects, favoriteProjectIds, filterMode),
    [favoriteProjectIds, filterMode, projects]
  )

  const selectedProject =
    visibleProjects.find((project) => project.id === selectedProjectId) ??
    visibleProjects[0] ??
    null

  const projectTasks = selectedProject ? getProjectDirectTasks(tasks, selectedProject.id) : []
  const projectMilestones = selectedProject?.milestones ?? []
  useEffect(() => {
    setExpandedMilestoneIds(new Set())
    setEditingMilestoneId(null)
  }, [selectedProject?.id])

  const handleCreateTask = async (): Promise<void> => {
    if (!selectedProject || isCreatingTask) return

    setIsCreatingTask(true)
    try {
      const task = await onCreateTask(selectedProject.id, 'New Task')
      setSelectedTaskId(task.id)
      onOpenTask(task.id)
    } catch {
      // The parent reports persistence errors.
    } finally {
      setIsCreatingTask(false)
    }
  }

  const handleCreateMilestone = async (): Promise<void> => {
    if (!selectedProject || isCreatingMilestone) return

    setIsCreatingMilestone(true)
    try {
      const milestone = await onCreateMilestone(selectedProject.id, 'New Milestone')
      setExpandedMilestoneIds((current) => new Set(current).add(milestone.id))
      requestMilestoneEdit(milestone.id)
    } catch {
      // The parent reports persistence errors.
    } finally {
      setIsCreatingMilestone(false)
    }
  }

  const requestMilestoneEdit = (milestoneId: string): void => {
    setEditingMilestoneId(milestoneId)
    setMilestoneEditToken((current) => current + 1)
  }

  const updateMilestone = (milestoneId: string, title: string): void => {
    if (selectedProject) {
      onUpdateMilestone(selectedProject.id, milestoneId, title)
    }
    setEditingMilestoneId((current) => (current === milestoneId ? null : current))
  }

  const handleCreateMilestoneTask = async (milestoneId: string): Promise<void> => {
    if (!selectedProject || isCreatingTask) return

    setIsCreatingTask(true)
    try {
      const task = await onCreateTask(selectedProject.id, 'New Task', milestoneId)
      setExpandedMilestoneIds((current) => new Set(current).add(milestoneId))
      setSelectedTaskId(task.id)
      onOpenTask(task.id)
    } catch {
      // The parent reports persistence errors.
    } finally {
      setIsCreatingTask(false)
    }
  }

  const toggleMilestone = (milestoneId: string): void => {
    setExpandedMilestoneIds((current) => {
      const next = new Set(current)
      if (next.has(milestoneId)) next.delete(milestoneId)
      else next.add(milestoneId)
      return next
    })
  }

  const requestDeleteMilestone = (milestoneId: string): boolean => {
    if (!selectedProject) {
      return false
    }

    const milestone = projectMilestones.find((item) => item.id === milestoneId)
    const childTaskCount = milestone
      ? getProjectMilestoneTasks(tasks, selectedProject.id, milestone.id).length
      : 0
    if (
      childTaskCount > 0 &&
      !window.confirm(
        `Delete milestone "${milestone?.title ?? 'this milestone'}" and move its ${childTaskCount} ${childTaskCount === 1 ? 'task' : 'tasks'} to the project?`
      )
    ) {
      return false
    }

    void onDeleteMilestone(selectedProject.id, milestoneId)
    setEditingMilestoneId((current) => (current === milestoneId ? null : current))
    return true
  }

  const toolbar = (
    <div className="flex min-w-max items-center gap-2">
      <ToggleGroup
        type="single"
        value={filterMode}
        onValueChange={(value) => {
          if (value) onFilterModeChange(value as ProjectsWorkspaceFilterMode)
        }}
        variant="outline"
        size="sm"
        aria-label="Project filter"
        data-testid="project-filter"
      >
        {PROJECTS_WORKSPACE_FILTER_OPTIONS.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )

  return (
    <div className="flex min-h-full min-w-0 flex-col bg-transparent">
      <WorkspaceHeaderSecondaryActionsRight>{toolbar}</WorkspaceHeaderSecondaryActionsRight>
      <div className="min-h-full w-full">
        {selectedProject ? (
          <div className="w-full space-y-3">
            <ProjectDetails
              key={selectedProject.id}
              project={selectedProject}
              onUpdateProject={onUpdateProject}
              onUpdateProperties={(patch) => onUpdateProjectProperties(selectedProject.id, patch)}
              dataTestId="project-main-detail-panel"
              testIdPrefix="project-main-detail"
            />
            <ProjectMilestones
              projectId={selectedProject.id}
              milestones={projectMilestones}
              tasks={tasks}
              expandedMilestoneIds={expandedMilestoneIds}
              isCreatingMilestone={isCreatingMilestone}
              isCreatingTask={isCreatingTask}
              selectedTaskId={selectedTaskId}
              editingMilestoneId={editingMilestoneId}
              milestoneEditToken={milestoneEditToken}
              onCreateMilestone={handleCreateMilestone}
              onCreateTask={handleCreateMilestoneTask}
              onToggleMilestone={toggleMilestone}
              onEditMilestone={requestMilestoneEdit}
              onUpdateMilestone={updateMilestone}
              onOpenTask={(taskId) => {
                setSelectedTaskId(taskId)
                onOpenTask(taskId)
              }}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
              onDeleteMilestone={requestDeleteMilestone}
            />
            <ProjectTasks
              tasks={projectTasks}
              onCreateTask={handleCreateTask}
              isCreatingTask={isCreatingTask}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
              onOpenTask={(taskId) => {
                setSelectedTaskId(taskId)
                onOpenTask(taskId)
              }}
              selectedTaskId={selectedTaskId}
            />
          </div>
        ) : (
          <EmptyState
            icon={APP_PAGE_ICONS.projects}
            title="No project selected"
            description="Create a project to start organizing tasks."
          />
        )}
      </div>
    </div>
  )
}

export function ProjectsWorkspaceRightPanel({
  projects,
  favoriteProjectIds,
  selectedProjectId,
  filterMode,
  onSelectProject,
  onToggleProjectFavorite,
  onToggleProjectArchive,
  onUpdateProjectProperties
}: {
  projects: Project[]
  favoriteProjectIds: string[]
  selectedProjectId: string | null
  filterMode: ProjectsWorkspaceFilterMode
  onSelectProject?: (projectId: string) => void
  onToggleProjectFavorite: (projectId: string) => void
  onToggleProjectArchive: (projectId: string) => void
  onUpdateProjectProperties: (projectId: string, patch: ProjectPropertiesPatch) => void
}): ReactElement {
  const visibleProjects = useMemo(
    () => filterProjectsForWorkspace(projects, favoriteProjectIds, filterMode),
    [favoriteProjectIds, filterMode, projects]
  )

  const selectedProject =
    visibleProjects.find((project) => project.id === selectedProjectId) ??
    visibleProjects[0] ??
    null

  return (
    <WorkspacePanelStack>
      <CollapsibleWorkspacePanelSection
        data-testid="projects-list-panel"
        className="shrink-0"
        heading="Project list"
      >
        <WorkspaceListRail
          aria-label="Projects"
          data-testid="projects-workspace-sidebar"
          className="h-auto min-h-0 p-3"
        >
          {visibleProjects.map((project) => (
            <WorkspaceListRailItem
              key={project.id}
              active={project.id === selectedProject?.id}
              data-testid={`projects-sidebar-item:${project.id}`}
              onClick={() => onSelectProject?.(project.id)}
              leading={<NoteShapeIcon icon={project.icon} size="1.25em" aria-hidden="true" />}
              trailing={
                favoriteProjectIds.includes(project.id) ? (
                  <Star size={13} className="text-warning" aria-hidden="true" />
                ) : null
              }
            >
              {project.name}
            </WorkspaceListRailItem>
          ))}
        </WorkspaceListRail>
      </CollapsibleWorkspacePanelSection>
      <ProjectPropertiesPanel
        key={selectedProject?.id ?? 'empty-project-properties'}
        project={selectedProject}
        favorite={selectedProject ? favoriteProjectIds.includes(selectedProject.id) : false}
        onToggleFavorite={() => {
          if (selectedProject) onToggleProjectFavorite(selectedProject.id)
        }}
        onToggleArchive={() => {
          if (selectedProject) onToggleProjectArchive(selectedProject.id)
        }}
        onUpdateProperties={(patch) => {
          if (selectedProject) onUpdateProjectProperties(selectedProject.id, patch)
        }}
      />
    </WorkspacePanelStack>
  )
}

export function ProjectsWorkspaceHeaderActions({
  project,
  onDelete
}: {
  project: Project | null
  onDelete: () => void
}): ReactElement | null {
  if (!project) {
    return null
  }

  return (
    <>
      <WorkspaceHeaderActionDivider />
      <WorkspaceIconButton
        type="button"
        onClick={onDelete}
        data-testid="project-workspace-header-actions"
        aria-label="Delete project"
        title="Delete project"
        icon={<Trash2 size={18} />}
      />
    </>
  )
}

function ProjectDetails({
  project,
  onUpdateProject,
  onUpdateProperties,
  dataTestId,
  testIdPrefix
}: {
  project: Project | null
  onUpdateProject: (
    projectId: string,
    draft: { name: string; description: string; icon: ProjectIconStyle }
  ) => void
  onUpdateProperties: (patch: ProjectPropertiesPatch) => void
  dataTestId: string
  testIdPrefix: string
}): ReactElement {
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? project?.summary ?? '')
  const [tagInput, setTagInput] = useState('')
  const [resourceInput, setResourceInput] = useState('')

  if (!project) {
    return (
      <CollapsibleWorkspacePanelSection
        data-testid={dataTestId}
        heading="Project properties"
        description="Select a project to edit its details."
      >
        <EmptyState
          icon={APP_PAGE_ICONS.projects}
          title="No project selected"
          description="Create a project to see its properties."
        />
      </CollapsibleWorkspacePanelSection>
    )
  }

  const projectDraft = {
    name: name.trim() || project.name,
    description: description.trim(),
    icon: project.icon
  }
  const tags = project.tags ?? []
  const resources = project.resources ?? []
  const addValue = (field: 'tags' | 'resources', rawValue: string): void => {
    const value = field === 'tags' ? normalizeTag(rawValue) : rawValue.trim()
    if (!value) return

    const values = field === 'tags' ? tags : resources
    if (values.includes(value)) return

    onUpdateProperties({ [field]: [...values, value] })
    if (field === 'tags') setTagInput('')
    else setResourceInput('')
  }

  return (
    <div data-testid={dataTestId}>
      <div className="space-y-3" data-testid={`${testIdPrefix}-header`}>
        <div className="flex items-center gap-3" data-testid={`${testIdPrefix}-icon-row`}>
          <ProjectIconPicker
            icon={project.icon}
            onChange={(icon) => onUpdateProject(project.id, { ...projectDraft, icon })}
            testId={`${testIdPrefix}-icon-trigger`}
          />
        </div>
        <Input
          data-testid={`${testIdPrefix}-name-row`}
          id={`${testIdPrefix}-name`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => onUpdateProject(project.id, projectDraft)}
          className="h-auto border-0 bg-transparent px-0 text-3xl font-semibold shadow-none focus-visible:ring-0"
          aria-label="Project name"
        />
        <Textarea
          data-testid={`${testIdPrefix}-description-row`}
          id={`${testIdPrefix}-description`}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          onBlur={() => onUpdateProject(project.id, projectDraft)}
          className="min-h-20 resize-y text-base shadow-none focus-visible:ring-0"
          aria-label="Project description"
          placeholder="Describe this project"
        />
        <div className="grid gap-2" data-testid={`${testIdPrefix}-properties`}>
          <WorkspacePropertyRow label="Tags" testId={`${testIdPrefix}-tags-row`}>
            <ProjectChipEditor
              values={tags}
              inputValue={tagInput}
              label="Add tag"
              inputPlaceholder="tag name"
              onInputChange={setTagInput}
              onAdd={(value) => addValue('tags', value)}
              onRemove={(value) =>
                onUpdateProperties({ tags: tags.filter((tag) => tag !== value) })
              }
            />
          </WorkspacePropertyRow>
          <WorkspacePropertyRow label="Resources" testId={`${testIdPrefix}-resources-row`}>
            <ProjectChipEditor
              values={resources}
              inputValue={resourceInput}
              label="Add resource"
              inputPlaceholder="resource name"
              onInputChange={setResourceInput}
              onAdd={(value) => addValue('resources', value)}
              onRemove={(value) =>
                onUpdateProperties({
                  resources: resources.filter((resource) => resource !== value)
                })
              }
            />
          </WorkspacePropertyRow>
        </div>
      </div>
    </div>
  )
}

function ProjectPropertiesPanel({
  project,
  favorite,
  onToggleFavorite,
  onToggleArchive,
  onUpdateProperties
}: {
  project: Project | null
  favorite: boolean
  onToggleFavorite: () => void
  onToggleArchive: () => void
  onUpdateProperties: (patch: ProjectPropertiesPatch) => void
}): ReactElement {
  if (!project) {
    return (
      <CollapsibleWorkspacePanelSection
        data-testid="project-properties-panel"
        heading="Project properties"
      />
    )
  }

  return (
    <CollapsibleWorkspacePanelSection
      data-testid="project-properties-panel"
      heading="Project properties"
    >
      <div data-testid="project-property-rows">
        <WorkspacePropertyRow label="Favorite" testId="project-property-favorite">
          <Button
            type="button"
            variant={favorite ? 'secondary' : 'outline'}
            size="sm"
            data-testid="project-favorite-button"
            className="h-7 rounded-[var(--radius-button-pill)] text-xs"
            aria-label={favorite ? 'Remove project favorite' : 'Add project favorite'}
            aria-pressed={favorite}
            onClick={onToggleFavorite}
          >
            <Star
              aria-hidden="true"
              className={favorite ? 'text-warning' : 'text-muted-foreground'}
            />
            <span>{favorite ? 'Favorite' : 'Not favorite'}</span>
          </Button>
        </WorkspacePropertyRow>
        <WorkspacePropertyRow label="Archive" testId="project-property-archive">
          <Button
            type="button"
            variant={project.state === 'archived' ? 'secondary' : 'outline'}
            size="sm"
            data-testid="project-archive-button"
            className="h-7 rounded-[var(--radius-button-pill)] text-xs"
            aria-label={project.state === 'archived' ? 'Unarchive project' : 'Archive project'}
            aria-pressed={project.state === 'archived'}
            onClick={onToggleArchive}
          >
            <Archive
              aria-hidden="true"
              className={project.state === 'archived' ? 'text-primary' : 'text-muted-foreground'}
            />
            <span>{project.state === 'archived' ? 'Archived' : 'Not archived'}</span>
          </Button>
        </WorkspacePropertyRow>
        <WorkspacePropertyRow label="Start Date" testId="project-property-start-date">
          <ProjectDateValue
            value={project.startDate}
            placeholder="Set start date"
            ariaLabel="Start date"
            onChange={(value) => {
              if (value && project.endDate && value > project.endDate) return
              onUpdateProperties({ startDate: value || null })
            }}
            onClear={() => onUpdateProperties({ startDate: null })}
          />
        </WorkspacePropertyRow>
        <WorkspacePropertyRow label="End Date" testId="project-property-end-date">
          <ProjectDateValue
            value={project.endDate}
            placeholder="Set end date"
            ariaLabel="End date"
            onChange={(value) => {
              if (value && project.startDate && value < project.startDate) return
              onUpdateProperties({ endDate: value || null })
            }}
            onClear={() => onUpdateProperties({ endDate: null })}
          />
        </WorkspacePropertyRow>
      </div>
    </CollapsibleWorkspacePanelSection>
  )
}

function ProjectDateValue({
  value,
  placeholder,
  ariaLabel,
  onChange,
  onClear
}: {
  value?: string
  placeholder: string
  ariaLabel: string
  onChange: (value: string) => void
  onClear: () => void
}): ReactElement {
  return (
    <div className="flex w-max min-w-full shrink-0 flex-nowrap items-center gap-1.5">
      <DatePickerISO
        value={value ?? ''}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="h-7 max-w-full border-border text-xs"
      />
      {value ? (
        <WorkspaceIconButton
          aria-label={`Clear ${ariaLabel.toLowerCase()}`}
          title={`Clear ${ariaLabel.toLowerCase()}`}
          icon={<X size={14} />}
          className="h-7 w-7"
          onClick={onClear}
        />
      ) : null}
    </div>
  )
}

function ProjectChipEditor({
  values,
  inputValue,
  label,
  inputPlaceholder,
  onInputChange,
  onAdd,
  onRemove
}: {
  values: string[]
  inputValue: string
  label: string
  inputPlaceholder: string
  onInputChange: (value: string) => void
  onAdd: (value: string) => void
  onRemove: (value: string) => void
}): ReactElement {
  const [isAdding, setIsAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!isAdding) return

    const frameId = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frameId)
  }, [isAdding])

  const handleAdd = (): void => {
    const value = inputValue.trim()
    if (!value) return

    onAdd(value)
    setIsAdding(true)
  }

  const closeInput = (): void => {
    setIsAdding(false)
    onInputChange('')
  }

  return (
    <div className="flex w-max min-w-full shrink-0 flex-nowrap items-center gap-1.5">
      {values.map((value) => (
        <TagChip key={value} tag={value} onRemove={() => onRemove(value)} />
      ))}
      {isAdding ? (
        <div className="inline-flex items-center gap-1.5">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.stopPropagation()
                handleAdd()
              } else if (event.key === 'Escape') {
                event.preventDefault()
                closeInput()
              }
            }}
            onBlur={closeInput}
            placeholder={inputPlaceholder}
            aria-label={label}
            autoFocus
            className="h-7 w-32 rounded-md border border-primary bg-card px-2 py-0.5 text-xs text-foreground caret-primary"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="inline-flex size-7 items-center justify-center rounded-md border border-dashed border-border bg-card p-1 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={label}
          aria-label={label}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

function ProjectMilestones({
  projectId,
  milestones,
  tasks,
  expandedMilestoneIds,
  isCreatingMilestone,
  isCreatingTask,
  selectedTaskId,
  editingMilestoneId,
  milestoneEditToken,
  onCreateMilestone,
  onCreateTask,
  onToggleMilestone,
  onEditMilestone,
  onUpdateMilestone,
  onOpenTask,
  onUpdateTask,
  onDeleteTask,
  onDeleteMilestone
}: {
  projectId: string
  milestones: ProjectMilestone[]
  tasks: CalendarTask[]
  expandedMilestoneIds: Set<string>
  isCreatingMilestone: boolean
  isCreatingTask: boolean
  selectedTaskId: string | null
  editingMilestoneId: string | null
  milestoneEditToken: number
  onCreateMilestone: () => void
  onCreateTask: (milestoneId: string) => void
  onToggleMilestone: (milestoneId: string) => void
  onEditMilestone: (milestoneId: string) => void
  onUpdateMilestone: (milestoneId: string, title: string) => void
  onOpenTask: (taskId: string) => void
  onUpdateTask: (taskId: string, patch: Partial<CalendarTask>) => void
  onDeleteTask: (taskId: string) => void
  onDeleteMilestone: (milestoneId: string) => boolean
}): ReactElement {
  return (
    <section aria-labelledby="project-milestones-heading" className="space-y-3">
      <div className="flex items-center justify-between border-t border-border pt-3">
        <h2 id="project-milestones-heading" className="text-sm font-medium text-muted-foreground">
          Project Milestones
        </h2>
        <span className="text-xs text-muted-foreground">
          {milestones.length} {milestones.length === 1 ? 'milestone' : 'milestones'}
        </span>
      </div>
      {milestones.length > 0 ? (
        <ul className="list-none" data-testid="project-milestones">
          {milestones.map((milestone) => (
            <ProjectMilestoneRow
              key={milestone.id}
              projectId={projectId}
              milestone={milestone}
              tasks={tasks}
              expanded={expandedMilestoneIds.has(milestone.id)}
              editToken={editingMilestoneId === milestone.id ? milestoneEditToken : 0}
              selectedTaskId={selectedTaskId}
              isCreatingTask={isCreatingTask}
              onCreateTask={onCreateTask}
              onToggle={() => onToggleMilestone(milestone.id)}
              onEdit={() => onEditMilestone(milestone.id)}
              onUpdateMilestone={onUpdateMilestone}
              onOpenTask={onOpenTask}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
              onDeleteMilestone={() => onDeleteMilestone(milestone.id)}
            />
          ))}
        </ul>
      ) : null}
      <div className="py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start px-2 text-muted-foreground hover:bg-transparent hover:text-foreground"
          onClick={onCreateMilestone}
          disabled={isCreatingMilestone}
          aria-label="Add new milestone"
        >
          <Plus size={14} /> {isCreatingMilestone ? 'Adding…' : 'Add new milestone'}
        </Button>
      </div>
    </section>
  )
}

function ProjectMilestoneRow({
  projectId,
  milestone,
  tasks,
  expanded,
  editToken,
  selectedTaskId,
  isCreatingTask,
  onCreateTask,
  onToggle,
  onEdit,
  onUpdateMilestone,
  onOpenTask,
  onUpdateTask,
  onDeleteTask,
  onDeleteMilestone
}: {
  projectId: string
  milestone: ProjectMilestone
  tasks: CalendarTask[]
  expanded: boolean
  editToken: number
  selectedTaskId: string | null
  isCreatingTask: boolean
  onCreateTask: (milestoneId: string) => void
  onToggle: () => void
  onEdit: () => void
  onUpdateMilestone: (milestoneId: string, title: string) => void
  onOpenTask: (taskId: string) => void
  onUpdateTask: (taskId: string, patch: Partial<CalendarTask>) => void
  onDeleteTask: (taskId: string) => void
  onDeleteMilestone: () => void
}): ReactElement {
  const milestoneTasks = getProjectMilestoneTasks(tasks, projectId, milestone.id)
  const progress = getProjectMilestoneProgress(milestoneTasks)
  const completionPercent =
    progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0

  const stopRowInteraction = (event: SyntheticEvent): void => {
    event.stopPropagation()
  }

  const handleRowClick = (event: MouseEvent<HTMLDivElement>): void => {
    const target = event.target
    if (
      target instanceof Element &&
      target.closest('button,input,textarea,select,a,[role="menuitem"]')
    ) {
      return
    }

    onToggle()
  }

  return (
    <li data-testid={`project-milestone-row:${milestone.id}`}>
      <ProjectMilestoneContextMenu
        milestone={milestone}
        expanded={expanded}
        isCreatingTask={isCreatingTask}
        onCreateTask={() => onCreateTask(milestone.id)}
        onEdit={onEdit}
        onToggle={onToggle}
        onDelete={onDeleteMilestone}
      >
        <div
          className="group relative cursor-pointer rounded-[var(--radius-button)] border border-transparent px-2 py-1 transition-colors motion-reduce:transition-none hover:border-border hover:bg-accent"
          data-expanded={expanded}
          data-testid={`project-milestone-open:${milestone.id}`}
          onClick={handleRowClick}
        >
          <div className="relative flex items-center gap-2">
            <div className="shrink-0 px-1">
              <MilestoneCompletenessIcon
                completed={progress.isComplete}
                size={18}
                dataTestId={`project-milestone-icon:${milestone.id}`}
              />
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-1 px-1 py-1 text-left">
              <div className="min-w-0" onClick={stopRowInteraction}>
                <InlineEditableText
                  value={milestone.title}
                  onCommit={(title) => onUpdateMilestone(milestone.id, title)}
                  displayClassName="block max-w-full truncate text-base font-semibold text-foreground hover:text-primary"
                  inputClassName="h-8 w-full rounded-[var(--radius-button)] border border-ring bg-card px-2 text-base font-semibold text-foreground"
                  title={`Edit milestone: ${milestone.title}`}
                  editToken={editToken}
                />
              </div>
              <div className="flex shrink-0 items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-[var(--radius-button)]"
                  onPointerDown={stopRowInteraction}
                  onClick={(event) => {
                    stopRowInteraction(event)
                    onToggle()
                  }}
                  aria-label={`${expanded ? 'Collapse' : 'Expand'} milestone: ${milestone.title}`}
                  aria-expanded={expanded}
                  aria-controls={`project-milestone-content:${milestone.id}`}
                  data-testid={`project-milestone-toggle:${milestone.id}`}
                >
                  <ChevronRight
                    aria-hidden="true"
                    className={cn('motion-state-chevron size-3.5', expanded && 'rotate-90')}
                  />
                </Button>
              </div>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {progress.total} Tasks
              </span>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {completionPercent}%
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-[var(--radius-button)] text-muted-foreground hover:bg-card hover:text-foreground focus-visible:bg-card"
                onPointerDown={stopRowInteraction}
                onClick={(event) => {
                  stopRowInteraction(event)
                  onCreateTask(milestone.id)
                }}
                disabled={isCreatingTask}
                aria-label={`Add task to milestone: ${milestone.title}`}
                title="Add task to milestone"
                data-testid={`project-milestone-add-task-icon:${milestone.id}`}
              >
                <Plus size={14} aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </ProjectMilestoneContextMenu>
      <div
        id={`project-milestone-content:${milestone.id}`}
        className="motion-milestone-content"
        data-state={expanded ? 'open' : 'closed'}
        data-testid={`project-milestone-children:${milestone.id}`}
        aria-hidden={!expanded}
        inert={!expanded}
      >
        <div className="ml-[21px] border-l border-border pl-3">
          {milestoneTasks.length > 0 ? (
            <ul className="list-none">
              {milestoneTasks.map((task) => (
                <TaskDetailRow
                  key={task.id}
                  task={task}
                  selected={selectedTaskId === task.id}
                  onUpdateTask={onUpdateTask}
                  onDeleteTask={onDeleteTask}
                  onOpenTask={onOpenTask}
                />
              ))}
            </ul>
          ) : (
            <p className="px-2 py-2 text-xs text-muted-foreground">No tasks in this milestone.</p>
          )}
        </div>
      </div>
    </li>
  )
}

function ProjectTasks({
  tasks,
  onCreateTask,
  isCreatingTask,
  onUpdateTask,
  onDeleteTask,
  onOpenTask,
  selectedTaskId
}: {
  tasks: CalendarTask[]
  onCreateTask: () => void
  isCreatingTask: boolean
  onUpdateTask: (taskId: string, patch: Partial<CalendarTask>) => void
  onDeleteTask: (taskId: string) => void
  onOpenTask: (taskId: string) => void
  selectedTaskId: string | null
}): ReactElement {
  return (
    <section aria-labelledby="project-tasks-heading" className="space-y-3">
      <div className="border-t border-border pt-3">
        <h2 id="project-tasks-heading" className="text-sm font-medium text-muted-foreground">
          Project Tasks
        </h2>
      </div>
      <ul className="list-none">
        {tasks.map((task) => (
          <TaskDetailRow
            key={task.id}
            task={task}
            selected={selectedTaskId === task.id}
            onUpdateTask={onUpdateTask}
            onDeleteTask={onDeleteTask}
            onOpenTask={onOpenTask}
          />
        ))}
      </ul>
      <div className="py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start px-2 text-muted-foreground hover:bg-transparent hover:text-foreground"
          onClick={() => void onCreateTask()}
          disabled={isCreatingTask}
        >
          <Plus size={14} /> {isCreatingTask ? 'Adding…' : 'Add new task'}
        </Button>
      </div>
    </section>
  )
}

function TaskDetailRow({
  task,
  onUpdateTask,
  onDeleteTask,
  onOpenTask,
  selected
}: {
  task: CalendarTask
  onUpdateTask: (taskId: string, patch: Partial<CalendarTask>) => void
  onDeleteTask: (taskId: string) => void
  onOpenTask: (taskId: string) => void
  selected: boolean
}): ReactElement {
  const status = getTaskStatus(task.status, task.completed)
  const scheduleLabel = formatCalendarTaskScheduleLabel(task)

  const stopRowInteraction = (event: SyntheticEvent): void => {
    event.stopPropagation()
  }

  const openContextMenu = (event: MouseEvent<HTMLButtonElement>): void => {
    stopRowInteraction(event)
    const bounds = event.currentTarget.getBoundingClientRect()
    event.currentTarget.dispatchEvent(
      new window.MouseEvent('contextmenu', {
        bubbles: true,
        button: 2,
        clientX: bounds.left,
        clientY: bounds.bottom
      })
    )
  }

  return (
    <TaskContextMenu
      task={task}
      onDelete={onDeleteTask}
      onUpdateStatus={(taskId, nextStatus) =>
        onUpdateTask(taskId, {
          status: nextStatus,
          completed: nextStatus === 'completed'
        })
      }
      onUpdatePriority={(taskId, priority) => onUpdateTask(taskId, { priority })}
      onUpdateTaskType={(taskId, taskType) => onUpdateTask(taskId, { taskType })}
      onUpdateTime={(taskId, time) => onUpdateTask(taskId, { time })}
      onUpdateReminders={(taskId, reminders) => onUpdateTask(taskId, { reminders })}
      onUnscheduleTask={(taskId) => onUpdateTask(taskId, { date: undefined, endDate: undefined })}
    >
      <li
        className="group relative rounded-[var(--radius-button)] px-2 py-1"
        data-selected={selected}
        data-testid={`project-task-row:${task.id}`}
      >
        <button
          type="button"
          className="absolute inset-0 z-0 rounded-[var(--radius-button)] border border-transparent bg-transparent text-left outline-none transition-colors group-hover:border-border group-hover:bg-accent focus-visible:border-border focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring group-data-[selected=true]:border-border group-data-[selected=true]:bg-accent"
          onClick={() => onOpenTask(task.id)}
          aria-label={`Open task: ${task.title}`}
          data-testid={`project-task-open:${task.id}`}
        >
          <span className="sr-only">{task.title}</span>
        </button>
        <div className="pointer-events-none relative z-10 grid gap-2 sm:grid-cols-[max-content_minmax(0,1fr)_max-content_2rem] sm:items-center">
          <SelectiveChip
            className="pointer-events-auto"
            label={`Status for ${task.title}`}
            value={status}
            variant="plain"
            options={TASK_STATUS_CHIP_OPTIONS}
            data-testid={`project-task-status-chip:${task.id}`}
            onPointerDown={stopRowInteraction}
            onClick={stopRowInteraction}
            onValueChange={(value) => {
              const nextStatus = value as TaskStatus
              onUpdateTask(task.id, {
                status: nextStatus,
                completed: nextStatus === 'completed'
              })
            }}
          />
          <div className="min-w-0 px-1 py-1 text-left">
            <span className="block min-w-0 truncate text-base font-semibold text-foreground">
              {task.title}
            </span>
            {task.tags.length > 0 ? (
              <TaskTagSummary tags={task.tags} mode="full" className="mt-1" />
            ) : null}
          </div>
          <span
            className="pointer-events-none whitespace-nowrap text-right text-xs text-muted-foreground"
            title={scheduleLabel}
          >
            {scheduleLabel}
          </span>
          <Button
            className="pointer-events-auto text-muted-foreground hover:bg-card hover:text-foreground focus-visible:bg-card"
            type="button"
            variant="ghost"
            size="icon"
            onPointerDown={stopRowInteraction}
            onClick={openContextMenu}
            aria-label={`Open actions for task: ${task.title}`}
            title="Open task actions"
            data-testid={`project-task-menu:${task.id}`}
          >
            <MoreHorizontal size={14} aria-hidden="true" />
          </Button>
        </div>
      </li>
    </TaskContextMenu>
  )
}
