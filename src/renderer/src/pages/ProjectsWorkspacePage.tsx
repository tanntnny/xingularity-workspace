import { useEffect, useMemo, useRef, useState, type ReactElement, type SyntheticEvent } from 'react'
import type {
  CalendarTask,
  Project,
  ProjectIconStyle,
  ProjectPropertiesPatch,
  TaskStatus
} from '../../../shared/types'
import { normalizeTag } from '../../../shared/noteTags'
import { NoteShapeIcon } from '../components/NoteShapeIcon'
import { ProjectIconPicker } from '../components/ProjectIconPicker'
import { TaskStatusIcon } from '../components/TaskStatusIcon'
import { TaskEditDialog } from '../components/TaskEditDialog'
import { TASK_STATUS_META, getTaskStatus } from '../lib/taskStatus'
import { formatCalendarTaskScheduleLabel } from '../lib/calendarTaskScheduleLabel'
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
import { WorkspaceListRail, WorkspaceListRailItem } from '../components/ui/workspace-list-rail'
import { EmptyState } from '../components/ui/empty-state'
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group'
import { SelectiveChip, type SelectiveChipOption } from '../components/ui/selective-chip'
import {
  filterProjectsForWorkspace,
  PROJECTS_WORKSPACE_FILTER_OPTIONS,
  type ProjectsWorkspaceFilterMode
} from '../lib/projectTaskRows'
import { Archive, FolderKanban, ListTodo, Plus, Star, Trash2, X } from '../components/ui/icons'

export type { ProjectsWorkspaceFilterMode } from '../lib/projectTaskRows'

const TASK_STATUS_CHIP_OPTIONS: readonly SelectiveChipOption[] = (
  Object.keys(TASK_STATUS_META) as TaskStatus[]
).map((value) => {
  const meta = TASK_STATUS_META[value]
  return {
    value,
    label: meta.label,
    icon: <TaskStatusIcon status={value} size={14} />,
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
  onCreateTask: (projectId: string | undefined, title: string) => Promise<CalendarTask>
  onUpdateProject: (
    projectId: string,
    draft: { name: string; description: string; icon: ProjectIconStyle }
  ) => void
  onUpdateProjectProperties: (projectId: string, patch: ProjectPropertiesPatch) => void
  onUpdateTask: (taskId: string, patch: Partial<CalendarTask>) => void
  onDeleteTask: (taskId: string) => void
}

export function ProjectsWorkspacePage({
  projects,
  tasks,
  favoriteProjectIds,
  selectedProjectId,
  filterMode,
  onFilterModeChange,
  onCreateTask,
  onUpdateProject,
  onUpdateProjectProperties,
  onUpdateTask,
  onDeleteTask
}: ProjectsWorkspacePageProps): ReactElement {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [isCreatingTask, setIsCreatingTask] = useState(false)

  const visibleProjects = useMemo(
    () => filterProjectsForWorkspace(projects, favoriteProjectIds, filterMode),
    [favoriteProjectIds, filterMode, projects]
  )

  const selectedProject =
    visibleProjects.find((project) => project.id === selectedProjectId) ??
    visibleProjects[0] ??
    null

  const projectTasks = selectedProject
    ? tasks.filter((task) => task.projectId === selectedProject.id)
    : []
  const editingTask = editingTaskId
    ? (tasks.find((task) => task.id === editingTaskId) ?? null)
    : null

  const handleCreateTask = async (): Promise<void> => {
    if (!selectedProject || isCreatingTask) return

    setIsCreatingTask(true)
    try {
      const task = await onCreateTask(selectedProject.id, 'New Task')
      setEditingTaskId(task.id)
    } catch {
      // The parent reports persistence errors.
    } finally {
      setIsCreatingTask(false)
    }
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
            <ProjectTasks
              tasks={projectTasks}
              onCreateTask={handleCreateTask}
              isCreatingTask={isCreatingTask}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
              onOpenTask={setEditingTaskId}
              selectedTaskId={editingTaskId}
            />
          </div>
        ) : (
          <EmptyState
            icon={FolderKanban}
            title="No project selected"
            description="Create a project to start organizing tasks."
          />
        )}
      </div>
      {editingTask ? (
        <TaskEditDialog
          key={editingTask.id}
          task={editingTask}
          projects={projects}
          description="Update task details without leaving this project."
          onSave={onUpdateTask}
          onClose={() => setEditingTaskId(null)}
          onDelete={(taskId) => {
            onDeleteTask(taskId)
            setEditingTaskId(null)
          }}
        />
      ) : null}
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
          icon={FolderKanban}
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
        <div className="grid gap-3" data-testid={`${testIdPrefix}-properties`}>
          <ProjectPropertyRow label="Tags" testId={`${testIdPrefix}-tags-row`}>
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
          </ProjectPropertyRow>
          <ProjectPropertyRow label="Resources" testId={`${testIdPrefix}-resources-row`}>
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
          </ProjectPropertyRow>
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
        <ProjectPropertyRow label="Favorite" testId="project-property-favorite">
          <Button
            type="button"
            variant={favorite ? 'secondary' : 'outline'}
            size="sm"
            data-testid="project-favorite-button"
            className="rounded-[var(--radius-button-pill)]"
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
        </ProjectPropertyRow>
        <ProjectPropertyRow label="Archive" testId="project-property-archive">
          <Button
            type="button"
            variant={project.state === 'archived' ? 'secondary' : 'outline'}
            size="sm"
            data-testid="project-archive-button"
            className="rounded-[var(--radius-button-pill)]"
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
        </ProjectPropertyRow>
        <ProjectPropertyRow label="Start Date" testId="project-property-start-date">
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
        </ProjectPropertyRow>
        <ProjectPropertyRow label="End Date" testId="project-property-end-date">
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
        </ProjectPropertyRow>
      </div>
    </CollapsibleWorkspacePanelSection>
  )
}

function ProjectPropertyRow({
  label,
  testId,
  children
}: {
  label: string
  testId: string
  children: ReactElement
}): ReactElement {
  return (
    <div
      className="grid grid-cols-[minmax(5.5rem,auto)_minmax(0,1fr)] items-start gap-3 px-4 py-3"
      data-testid={testId}
    >
      <span className="pt-1 text-sm font-medium text-muted-foreground">{label}</span>
      <div className="min-w-0 max-w-full overflow-x-auto" data-testid={`${testId}-value`}>
        <div className="flex w-max min-w-full flex-nowrap items-start justify-start gap-1.5">
          {children}
        </div>
      </div>
    </div>
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
        className="max-w-full border-border"
      />
      {value ? (
        <WorkspaceIconButton
          aria-label={`Clear ${ariaLabel.toLowerCase()}`}
          title={`Clear ${ariaLabel.toLowerCase()}`}
          icon={<X size={14} />}
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
    <div className="flex w-max min-w-full shrink-0 flex-nowrap items-center gap-2">
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
            className="w-32 rounded-md border border-primary bg-card px-2.5 py-1 text-sm text-foreground caret-primary"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center justify-center rounded-md border border-dashed border-border bg-card p-1 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={label}
          aria-label={label}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      )}
    </div>
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
      {tasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="No tasks in this project"
          description="Add a new task to get started."
        />
      ) : (
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
      )}
      <div className="border-y border-border py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start px-2 text-muted-foreground hover:text-foreground"
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

  return (
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
      <div className="pointer-events-none relative z-10 grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_10rem_2rem] sm:items-center">
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
        <span className="min-w-0 truncate px-1 py-1 text-left text-sm font-medium text-foreground">
          {task.title}
        </span>
        <span
          className="pointer-events-none min-w-0 truncate text-xs text-muted-foreground"
          title={scheduleLabel}
        >
          {scheduleLabel}
        </span>
        <Button
          className="pointer-events-auto"
          type="button"
          variant="ghost"
          size="icon"
          onPointerDown={stopRowInteraction}
          onClick={(event) => {
            stopRowInteraction(event)
            onDeleteTask(task.id)
          }}
          aria-label={`Delete ${task.title}`}
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </li>
  )
}
