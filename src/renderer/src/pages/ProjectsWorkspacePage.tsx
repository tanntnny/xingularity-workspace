import { useMemo, useState, type ReactElement } from 'react'
import type { CalendarTask, Project, ProjectIconStyle, TaskStatus } from '../../../shared/types'
import { PROJECT_ICON_COLORS, PROJECT_ICON_SYMBOLS } from '../../../shared/projectIcons'
import { NoteShapeIcon } from '../components/NoteShapeIcon'
import { TaskStatusIcon } from '../components/TaskStatusIcon'
import { TASK_STATUS_META, getTaskStatus } from '../lib/taskStatus'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select'
import { Textarea } from '../components/ui/textarea'
import {
  WorkspaceHeaderSecondaryActionsRight,
  WorkspaceIconButton,
  WorkspacePanelStack
} from '../components/ui/document-workspace'
import {
  WorkspacePanelSection,
  WorkspacePanelSectionHeader
} from '../components/ui/workspace-panel-section'
import { WorkspaceListRail, WorkspaceListRailItem } from '../components/ui/workspace-list-rail'
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group'
import {
  filterProjectsForWorkspace,
  PROJECTS_WORKSPACE_FILTER_OPTIONS,
  type ProjectsWorkspaceFilterMode
} from '../lib/projectTaskRows'
import { Archive, Circle, Plus, Star, Trash2 } from '../components/ui/icons'

export type { ProjectsWorkspaceFilterMode } from '../lib/projectTaskRows'

interface ProjectsWorkspacePageProps {
  projects: Project[]
  tasks: CalendarTask[]
  favoriteProjectIds: string[]
  selectedProjectId: string | null
  newProjectRequestToken: number
  onNewProjectRequestHandled: () => void
  filterMode: ProjectsWorkspaceFilterMode
  onFilterModeChange: (mode: ProjectsWorkspaceFilterMode) => void
  onSelectProject: (projectId: string) => void
  onCreateProject: (input: {
    name: string
    description: string
    icon: ProjectIconStyle
  }) => Promise<string>
  onCreateTask: (projectId: string | undefined, title: string) => Promise<void>
  onUpdateTask: (taskId: string, patch: Partial<CalendarTask>) => void
  onDeleteTask: (taskId: string) => void
}

export function ProjectsWorkspacePage({
  projects,
  tasks,
  favoriteProjectIds,
  selectedProjectId,
  newProjectRequestToken,
  onNewProjectRequestHandled,
  filterMode,
  onFilterModeChange,
  onSelectProject,
  onCreateProject,
  onCreateTask,
  onUpdateTask,
  onDeleteTask
}: ProjectsWorkspacePageProps): ReactElement {
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const isProjectFormVisible = newProjectRequestToken > 0

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

  const handleCreateProject = async (): Promise<void> => {
    const name = newProjectName.trim()
    if (!name || isCreatingProject) return

    setIsCreatingProject(true)
    try {
      const id = await onCreateProject({
        name,
        description: newProjectDescription.trim(),
        icon: createProjectIcon(name)
      })
      onSelectProject(id)
      onNewProjectRequestHandled()
      setNewProjectName('')
      setNewProjectDescription('')
    } catch {
      // The parent reports persistence errors; keep the form values for retry.
    } finally {
      setIsCreatingProject(false)
    }
  }

  const handleCreateTask = async (): Promise<void> => {
    const title = newTaskTitle.trim()
    if (!title || isCreatingTask || isCreatingProject) return

    setIsCreatingTask(true)
    try {
      await onCreateTask(selectedProject?.id, title)
      setNewTaskTitle('')
    } catch {
      // The parent reports persistence errors; keep the title for retry.
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
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <WorkspaceHeaderSecondaryActionsRight>{toolbar}</WorkspaceHeaderSecondaryActionsRight>
      <main className="min-h-0 flex-1 overflow-auto p-2">
        {isProjectFormVisible ? (
          <section className="mb-3 rounded-lg border border-border bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end">
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Name
                <Input
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  autoFocus
                  disabled={isCreatingProject}
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Description
                <Input
                  value={newProjectDescription}
                  onChange={(event) => setNewProjectDescription(event.target.value)}
                  disabled={isCreatingProject}
                />
              </label>
              <Button
                type="button"
                onClick={() => void handleCreateProject()}
                disabled={isCreatingProject}
              >
                {isCreatingProject ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </section>
        ) : null}

        {selectedProject ? (
          <ProjectTasks
            tasks={projectTasks}
            newTaskTitle={newTaskTitle}
            onNewTaskTitleChange={setNewTaskTitle}
            onCreateTask={handleCreateTask}
            isCreatingTask={isCreatingTask || isCreatingProject}
            onUpdateTask={onUpdateTask}
            onDeleteTask={onDeleteTask}
            projects={projects}
          />
        ) : (
          <EmptyState
            title="No project selected"
            description="Create a project to start organizing tasks."
          />
        )}
      </main>
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
  onUpdateProject,
  onDeleteProject
}: {
  projects: Project[]
  favoriteProjectIds: string[]
  selectedProjectId: string | null
  filterMode: ProjectsWorkspaceFilterMode
  onSelectProject?: (projectId: string) => void
  onToggleProjectFavorite: (projectId: string) => void
  onToggleProjectArchive: (projectId: string) => void
  onUpdateProject: (
    projectId: string,
    draft: { name: string; description: string; icon: ProjectIconStyle }
  ) => void
  onDeleteProject: (projectId: string) => Promise<void>
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
      <WorkspacePanelSection data-testid="projects-list-panel" className="shrink-0">
        <WorkspacePanelSectionHeader
          heading="Project list"
          description={`${visibleProjects.length} visible ${visibleProjects.length === 1 ? 'project' : 'projects'}`}
        />
        <WorkspaceListRail
          aria-label="Projects"
          data-testid="projects-workspace-sidebar"
          className="h-auto min-h-0 p-0"
          emptyState="No projects yet"
        >
          {visibleProjects.map((project) => (
            <WorkspaceListRailItem
              key={project.id}
              active={project.id === selectedProject?.id}
              data-testid={`projects-sidebar-item:${project.id}`}
              onClick={() => onSelectProject?.(project.id)}
              leading={<NoteShapeIcon icon={project.icon} size={30} aria-hidden="true" />}
              trailing={
                favoriteProjectIds.includes(project.id) ? (
                  <Star size={13} className="text-amber-500" aria-hidden="true" />
                ) : null
              }
            >
              {project.name}
            </WorkspaceListRailItem>
          ))}
        </WorkspaceListRail>
      </WorkspacePanelSection>
      <ProjectPropertiesPanel
        key={selectedProject?.id ?? 'empty-project-properties'}
        project={selectedProject}
        favorite={selectedProject ? favoriteProjectIds.includes(selectedProject.id) : false}
        onUpdateProject={onUpdateProject}
        onToggleFavorite={() => {
          if (selectedProject) onToggleProjectFavorite(selectedProject.id)
        }}
        archived={selectedProject?.state === 'archived'}
        onToggleArchive={() => {
          if (selectedProject) onToggleProjectArchive(selectedProject.id)
        }}
        onDelete={() => {
          if (selectedProject) void onDeleteProject(selectedProject.id)
        }}
      />
    </WorkspacePanelStack>
  )
}

function ProjectPropertiesPanel({
  project,
  favorite,
  onUpdateProject,
  onToggleFavorite,
  archived,
  onToggleArchive,
  onDelete
}: {
  project: Project | null
  favorite: boolean
  onUpdateProject: (
    projectId: string,
    draft: { name: string; description: string; icon: ProjectIconStyle }
  ) => void
  onToggleFavorite: () => void
  archived: boolean
  onToggleArchive: () => void
  onDelete: () => void
}): ReactElement {
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? project?.summary ?? '')

  if (!project) {
    return (
      <WorkspacePanelSection data-testid="project-properties-panel">
        <WorkspacePanelSectionHeader
          heading="Project properties"
          description="Select a project to edit its details."
        />
        <EmptyState
          title="No project selected"
          description="Create a project to see its properties."
        />
      </WorkspacePanelSection>
    )
  }

  const projectDraft = {
    name: name.trim() || project.name,
    description: description.trim(),
    icon: project.icon
  }

  return (
    <WorkspacePanelSection data-testid="project-properties-panel">
      <WorkspacePanelSectionHeader
        heading="Project properties"
        description="Edit the selected project."
        actions={
          <div className="flex items-center gap-1.5" data-testid="project-detail-header-actions">
            <WorkspaceIconButton
              type="button"
              active={favorite}
              onClick={onToggleFavorite}
              aria-label={favorite ? 'Remove favorite' : 'Add favorite'}
              title={favorite ? 'Remove favorite' : 'Add favorite'}
              icon={<Star size={18} className={favorite ? 'fill-current' : ''} />}
            />
            <WorkspaceIconButton
              type="button"
              onClick={onToggleArchive}
              aria-label={archived ? 'Unarchive project' : 'Archive project'}
              title={archived ? 'Unarchive project' : 'Archive project'}
              icon={<Archive size={18} />}
            />
            <WorkspaceIconButton
              type="button"
              onClick={onDelete}
              aria-label="Delete project"
              title="Delete project"
              icon={<Trash2 size={18} />}
            />
          </div>
        }
      />
      <div className="grid gap-3" data-testid="project-detail-header">
        <div className="flex items-center" data-testid="project-detail-icon-row">
          <NoteShapeIcon icon={project.icon} size={30} />
        </div>
        <Input
          data-testid="project-detail-name-row"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => onUpdateProject(project.id, projectDraft)}
          className="h-auto border-0 bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
          aria-label="Project name"
        />
        <Textarea
          data-testid="project-detail-description-row"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          onBlur={() => onUpdateProject(project.id, projectDraft)}
          className="min-h-20 resize-y border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          aria-label="Project description"
          placeholder="Describe this project"
        />
      </div>
    </WorkspacePanelSection>
  )
}

function ProjectTasks({
  tasks,
  projects,
  newTaskTitle,
  onNewTaskTitleChange,
  onCreateTask,
  isCreatingTask,
  onUpdateTask,
  onDeleteTask
}: {
  tasks: CalendarTask[]
  projects: Project[]
  newTaskTitle: string
  onNewTaskTitleChange: (value: string) => void
  onCreateTask: () => void
  isCreatingTask: boolean
  onUpdateTask: (taskId: string, patch: Partial<CalendarTask>) => void
  onDeleteTask: (taskId: string) => void
}): ReactElement {
  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <section className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Tasks</h2>
            <p className="text-xs text-muted-foreground">
              {tasks.length} linked {tasks.length === 1 ? 'task' : 'tasks'}
            </p>
          </div>
          <Input
            value={newTaskTitle}
            onChange={(event) => onNewTaskTitleChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !isCreatingTask) void onCreateTask()
            }}
            placeholder="Add a task"
            className="max-w-xs"
            aria-label="New task title"
            disabled={isCreatingTask}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => void onCreateTask()}
            disabled={isCreatingTask}
          >
            <Plus size={14} /> {isCreatingTask ? 'Adding…' : 'Add task'}
          </Button>
        </div>
        {tasks.length === 0 ? (
          <EmptyState title="No tasks in this project" description="Add the first task above." />
        ) : (
          tasks.map((task) => (
            <TaskDetailRow
              key={task.id}
              task={task}
              projects={projects}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
            />
          ))
        )}
      </section>
    </div>
  )
}

function TaskDetailRow({
  task,
  projects,
  onUpdateTask,
  onDeleteTask
}: {
  task: CalendarTask
  projects: Project[]
  onUpdateTask: (taskId: string, patch: Partial<CalendarTask>) => void
  onDeleteTask: (taskId: string) => void
}): ReactElement {
  const status = getTaskStatus(task.status, task.completed)
  return (
    <div className="grid gap-2 border-b border-border p-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_10rem_10rem_2rem] sm:items-center">
      <Input
        value={task.title}
        onChange={(event) => onUpdateTask(task.id, { title: event.target.value })}
        aria-label={`Task title: ${task.title}`}
      />
      <Select
        value={status}
        onValueChange={(value) =>
          onUpdateTask(task.id, { status: value as TaskStatus, completed: value === 'completed' })
        }
      >
        <SelectTrigger aria-label={`Status for ${task.title}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(TASK_STATUS_META).map(([value, meta]) => (
            <SelectItem key={value} value={value}>
              <span className="flex items-center gap-2">
                <TaskStatusIcon status={value as TaskStatus} size={14} />
                {meta.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={task.projectId ?? 'none'}
        onValueChange={(value) =>
          onUpdateTask(task.id, { projectId: value === 'none' ? undefined : value })
        }
      >
        <SelectTrigger aria-label={`Project for ${task.title}`}>
          <SelectValue placeholder="No project" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No project</SelectItem>
          {projects.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onDeleteTask(task.id)}
        aria-label={`Delete ${task.title}`}
      >
        <Trash2 size={14} />
      </Button>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }): ReactElement {
  return (
    <div className="col-span-full flex min-h-32 flex-col items-center justify-center gap-1 p-6 text-center">
      <Circle size={18} className="text-muted-foreground" />
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="text-xs text-muted-foreground">{description}</div>
    </div>
  )
}

function createProjectIcon(seed: string): ProjectIconStyle {
  const index =
    Math.abs(seed.split('').reduce((total, char) => total + char.charCodeAt(0), 0)) %
    PROJECT_ICON_SYMBOLS.length
  return {
    set: 'tabler',
    glyph: PROJECT_ICON_SYMBOLS[index],
    variant: 'filled',
    color: PROJECT_ICON_COLORS[index % PROJECT_ICON_COLORS.length]
  }
}
