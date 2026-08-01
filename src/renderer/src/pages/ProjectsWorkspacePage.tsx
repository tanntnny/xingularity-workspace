import { useMemo, useState, type ReactElement } from 'react'
import type {
  CalendarTask,
  Project,
  ProjectIconStyle,
  TaskStatus
} from '../../../shared/types'
import { PROJECT_ICON_COLORS, PROJECT_ICON_SYMBOLS } from '../../../shared/projectIcons'
import { NoteShapeIcon } from '../components/NoteShapeIcon'
import { TaskStatusIcon } from '../components/TaskStatusIcon'
import { TASK_STATUS_META, getTaskStatus } from '../lib/taskStatus'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Textarea } from '../components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group'
import { WorkspaceHeaderSecondaryActions, WorkspaceIconButton } from '../components/ui/document-workspace'
import { Circle, Plus, Star, Trash2 } from '../components/ui/icons'
import { cn } from '../lib/utils'

export type ProjectsWorkspaceTab = 'board' | 'taskList' | 'projectDetail'
export type ProjectsWorkspaceFilterMode = 'all' | 'favorites' | 'active' | 'completed'

interface ProjectsWorkspacePageProps {
  projects: Project[]
  tasks: CalendarTask[]
  favoriteProjectIds: string[]
  selectedProjectId: string | null
  activeTab: ProjectsWorkspaceTab
  filterMode: ProjectsWorkspaceFilterMode
  onFilterModeChange: (mode: ProjectsWorkspaceFilterMode) => void
  onActiveTabChange: (tab: ProjectsWorkspaceTab) => void
  onSelectProject: (projectId: string) => void
  onCreateProject: (input: { name: string; description: string; icon: ProjectIconStyle }) => string
  onUpdateProject: (projectId: string, draft: { name: string; description: string; icon: ProjectIconStyle }) => void
  onToggleProjectFavorite: (projectId: string) => void
  onDeleteProject: (projectId: string) => Promise<void>
  onCreateTask: (projectId: string | undefined, title: string) => void
  onUpdateTask: (taskId: string, patch: Partial<CalendarTask>) => void
  onDeleteTask: (taskId: string) => void
}

export function ProjectsWorkspacePage({
  projects,
  tasks,
  favoriteProjectIds,
  selectedProjectId,
  activeTab,
  filterMode,
  onFilterModeChange,
  onActiveTabChange,
  onSelectProject,
  onCreateProject,
  onUpdateProject,
  onToggleProjectFavorite,
  onDeleteProject,
  onCreateTask,
  onUpdateTask,
  onDeleteTask
}: ProjectsWorkspacePageProps): ReactElement {
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [isCreatingProject, setIsCreatingProject] = useState(false)

  const visibleProjects = useMemo(() => {
    if (filterMode === 'favorites') {
      const favoriteIds = new Set(favoriteProjectIds)
      return projects.filter((project) => favoriteIds.has(project.id))
    }
    return projects
  }, [favoriteProjectIds, filterMode, projects])

  const selectedProject =
    visibleProjects.find((project) => project.id === selectedProjectId) ??
    projects.find((project) => project.id === selectedProjectId) ??
    visibleProjects[0] ??
    null

  const projectTasks = selectedProject
    ? tasks.filter((task) => task.projectId === selectedProject.id)
    : []

  const handleCreateProject = (): void => {
    const name = newProjectName.trim()
    if (!name) return
    const id = onCreateProject({
      name,
      description: newProjectDescription.trim(),
      icon: createProjectIcon(name)
    })
    onSelectProject(id)
    onActiveTabChange('projectDetail')
    setNewProjectName('')
    setNewProjectDescription('')
    setIsCreatingProject(false)
  }

  const handleCreateTask = (): void => {
    const title = newTaskTitle.trim()
    if (!title) return
    onCreateTask(selectedProject?.id, title)
    setNewTaskTitle('')
  }

  const toolbar = (
    <div className="flex min-w-max items-center gap-2">
      <ToggleGroup
        type="single"
        value={activeTab}
        onValueChange={(value) => value && onActiveTabChange(value as ProjectsWorkspaceTab)}
        aria-label="Projects view"
      >
        <ToggleGroupItem value="board">Projects</ToggleGroupItem>
        <ToggleGroupItem value="taskList">Tasks</ToggleGroupItem>
        <ToggleGroupItem value="projectDetail">Details</ToggleGroupItem>
      </ToggleGroup>
      <Select value={filterMode} onValueChange={(value) => onFilterModeChange(value as ProjectsWorkspaceFilterMode)}>
        <SelectTrigger className="w-32" aria-label="Project filter">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All projects</SelectItem>
          <SelectItem value="favorites">Favorites</SelectItem>
        </SelectContent>
      </Select>
      <WorkspaceIconButton
        icon={<Plus size={14} aria-hidden="true" />}
        label="New project"
        onClick={() => setIsCreatingProject((current) => !current)}
      />
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <WorkspaceHeaderSecondaryActions>{toolbar}</WorkspaceHeaderSecondaryActions>
      <main className="min-h-0 flex-1 overflow-auto p-2">
        {isCreatingProject ? (
          <section className="mb-3 rounded-lg border border-border bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end">
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Name
                <Input value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} autoFocus />
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Description
                <Input value={newProjectDescription} onChange={(event) => setNewProjectDescription(event.target.value)} />
              </label>
              <Button type="button" onClick={handleCreateProject}>Create</Button>
            </div>
          </section>
        ) : null}

        {activeTab === 'board' ? (
          <ProjectBoard
            projects={visibleProjects}
            tasks={tasks}
            selectedProjectId={selectedProject?.id ?? null}
            favoriteProjectIds={favoriteProjectIds}
            onSelect={(id) => { onSelectProject(id); onActiveTabChange('projectDetail') }}
            onToggleFavorite={onToggleProjectFavorite}
          />
        ) : activeTab === 'taskList' ? (
          <TaskList
            projects={projects}
            tasks={tasks}
            onSelectProject={(id) => { onSelectProject(id); onActiveTabChange('projectDetail') }}
            onUpdateTask={onUpdateTask}
            onDeleteTask={onDeleteTask}
          />
        ) : selectedProject ? (
          <ProjectDetails
            project={selectedProject}
            tasks={projectTasks}
            favorite={favoriteProjectIds.includes(selectedProject.id)}
            onUpdateProject={onUpdateProject}
            onToggleFavorite={() => onToggleProjectFavorite(selectedProject.id)}
            onDelete={() => void onDeleteProject(selectedProject.id)}
            newTaskTitle={newTaskTitle}
            onNewTaskTitleChange={setNewTaskTitle}
            onCreateTask={handleCreateTask}
            onUpdateTask={onUpdateTask}
            onDeleteTask={onDeleteTask}
            projects={projects}
          />
        ) : (
          <EmptyState title="No project selected" description="Create a project to start organizing tasks." />
        )}
      </main>
    </div>
  )
}

export function ProjectsWorkspaceSidebar({
  projects,
  favoriteProjectIds,
  selectedProjectId,
  onSelectProject,
  onSelect
}: {
  projects: Project[]
  favoriteProjectIds: string[]
  selectedProjectId: string | null
  filterMode?: ProjectsWorkspaceFilterMode
  onFilterModeChange?: (mode: ProjectsWorkspaceFilterMode) => void
  onSelectProject?: (projectId: string) => void
  onSelect?: (projectId: string) => void
}): ReactElement {
  return (
    <aside className="flex h-full min-h-0 flex-col gap-2 overflow-auto p-2">
      {projects.map((project) => (
        <Button
          key={project.id}
          type="button"
          variant={project.id === selectedProjectId ? 'secondary' : 'ghost'}
          className="h-auto justify-start gap-2 rounded-lg border border-border px-3 py-2 text-left"
          onClick={() => (onSelect ?? onSelectProject)?.(project.id)}
        >
          <NoteShapeIcon icon={project.icon} size={16} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">{project.name}</span>
          {favoriteProjectIds.includes(project.id) ? <Star size={13} className="text-amber-500" /> : null}
        </Button>
      ))}
    </aside>
  )
}

function ProjectBoard({
  projects,
  tasks,
  selectedProjectId,
  favoriteProjectIds,
  onSelect,
  onToggleFavorite
}: {
  projects: Project[]
  tasks: CalendarTask[]
  selectedProjectId: string | null
  favoriteProjectIds: string[]
  onSelect: (projectId: string) => void
  onToggleFavorite: (projectId: string) => void
}): ReactElement {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {projects.length === 0 ? <EmptyState title="No projects yet" description="Create a project to group related tasks." /> : null}
      {projects.map((project) => {
        const projectTasks = tasks.filter((task) => task.projectId === project.id)
        const completed = projectTasks.filter((task) => getTaskStatus(task.status, task.completed) === 'completed').length
        return (
          <article key={project.id} className={cn('rounded-lg border border-border bg-card p-4', selectedProjectId === project.id && 'border-primary')}>
            <div className="flex items-start gap-3">
              <NoteShapeIcon icon={project.icon} size={24} className="shrink-0" />
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(project.id)}>
                <h2 className="truncate text-base font-semibold text-foreground">{project.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{project.description ?? project.summary ?? 'No description yet.'}</p>
              </button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => onToggleFavorite(project.id)} aria-label={`${favoriteProjectIds.includes(project.id) ? 'Remove' : 'Add'} favorite`}>
                <Star size={15} className={favoriteProjectIds.includes(project.id) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'} />
              </Button>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="neutral" tone="neutral">{projectTasks.length} {projectTasks.length === 1 ? 'task' : 'tasks'}</Badge>
              <span>{completed}/{projectTasks.length || 0} completed</span>
              <span className="ml-auto">Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function TaskList({
  projects,
  tasks,
  onSelectProject,
  onUpdateTask,
  onDeleteTask
}: {
  projects: Project[]
  tasks: CalendarTask[]
  onSelectProject: (projectId: string) => void
  onUpdateTask: (taskId: string, patch: Partial<CalendarTask>) => void
  onDeleteTask: (taskId: string) => void
}): ReactElement {
  const projectById = new Map(projects.map((project) => [project.id, project]))
  const sortedTasks = [...tasks].sort((left, right) => left.title.localeCompare(right.title))
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(8rem,14rem)_8rem_8rem_2.5rem] border-b border-border bg-muted px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Task</span><span>Project</span><span>Status</span><span>Due</span><span />
      </div>
      {sortedTasks.length === 0 ? <EmptyState title="No tasks yet" description="Tasks created in Projects or Calendar appear here." /> : null}
      {sortedTasks.map((task) => {
        const project = task.projectId ? projectById.get(task.projectId) : undefined
        return (
          <TaskRow
            key={task.id}
            task={task}
            project={project}
            onSelectProject={onSelectProject}
            onUpdateTask={onUpdateTask}
            onDeleteTask={onDeleteTask}
          />
        )
      })}
    </section>
  )
}

function TaskRow({
  task,
  project,
  onSelectProject,
  onUpdateTask,
  onDeleteTask
}: {
  task: CalendarTask
  project?: Project
  onSelectProject: (projectId: string) => void
  onUpdateTask: (taskId: string, patch: Partial<CalendarTask>) => void
  onDeleteTask: (taskId: string) => void
}): ReactElement {
  const status = getTaskStatus(task.status, task.completed)
  const nextStatus: TaskStatus = status === 'completed' ? 'pending' : status === 'pending' ? 'in-progress' : status === 'in-progress' ? 'completed' : 'in-progress'
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(8rem,14rem)_8rem_8rem_2.5rem] items-center border-b border-border px-3 py-2 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2">
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => onUpdateTask(task.id, { status: nextStatus, completed: nextStatus === 'completed' })} aria-label={`Set ${task.title} status to ${TASK_STATUS_META[nextStatus].label}`}>
          <TaskStatusIcon status={status} completed={task.completed} />
        </Button>
        <span className={cn('truncate text-sm', status === 'completed' && 'text-muted-foreground line-through')}>{task.title}</span>
      </div>
      {project ? <button type="button" className="truncate text-left text-sm text-muted-foreground hover:text-primary" onClick={() => onSelectProject(project.id)}>{project.name}</button> : <span className="text-sm text-muted-foreground">No project</span>}
      <span className="flex items-center gap-1 text-xs text-muted-foreground"><TaskStatusIcon status={status} size={13} />{TASK_STATUS_META[status].label}</span>
      <span className="text-xs text-muted-foreground">{task.date ?? 'Unscheduled'}</span>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDeleteTask(task.id)} aria-label={`Delete ${task.title}`}><Trash2 size={14} /></Button>
    </div>
  )
}

function ProjectDetails({
  project,
  tasks,
  favorite,
  projects,
  onUpdateProject,
  onToggleFavorite,
  onDelete,
  newTaskTitle,
  onNewTaskTitleChange,
  onCreateTask,
  onUpdateTask,
  onDeleteTask
}: {
  project: Project
  tasks: CalendarTask[]
  favorite: boolean
  projects: Project[]
  onUpdateProject: (projectId: string, draft: { name: string; description: string; icon: ProjectIconStyle }) => void
  onToggleFavorite: () => void
  onDelete: () => void
  newTaskTitle: string
  onNewTaskTitleChange: (value: string) => void
  onCreateTask: () => void
  onUpdateTask: (taskId: string, patch: Partial<CalendarTask>) => void
  onDeleteTask: (taskId: string) => void
}): ReactElement {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? project.summary ?? '')
  const icon = project.icon
  const projectDraft = { name: name.trim() || project.name, description: description.trim(), icon }

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-start gap-3">
          <NoteShapeIcon icon={project.icon} size={30} className="mt-1 shrink-0" />
          <div className="min-w-0 flex-1">
            <Input value={name} onChange={(event) => setName(event.target.value)} onBlur={() => onUpdateProject(project.id, projectDraft)} className="h-auto border-0 px-0 text-2xl font-semibold shadow-none focus-visible:ring-0" aria-label="Project name" />
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} onBlur={() => onUpdateProject(project.id, projectDraft)} className="mt-2 min-h-20 resize-y border-0 px-0 shadow-none focus-visible:ring-0" aria-label="Project description" placeholder="Describe this project" />
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" onClick={onToggleFavorite} aria-label={favorite ? 'Remove favorite' : 'Add favorite'}><Star size={16} className={favorite ? 'fill-amber-400 text-amber-400' : ''} /></Button>
            <Button type="button" variant="ghost" size="icon" onClick={onDelete} aria-label="Delete project"><Trash2 size={16} /></Button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="min-w-0 flex-1"><h2 className="text-base font-semibold">Tasks</h2><p className="text-xs text-muted-foreground">{tasks.length} linked {tasks.length === 1 ? 'task' : 'tasks'}</p></div>
          <Input value={newTaskTitle} onChange={(event) => onNewTaskTitleChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onCreateTask() }} placeholder="Add a task" className="max-w-xs" aria-label="New task title" />
          <Button type="button" size="sm" onClick={onCreateTask}><Plus size={14} /> Add task</Button>
        </div>
        {tasks.length === 0 ? <EmptyState title="No tasks in this project" description="Add the first task above." /> : tasks.map((task) => <TaskDetailRow key={task.id} task={task} projects={projects} onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} />)}
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
      <Input value={task.title} onChange={(event) => onUpdateTask(task.id, { title: event.target.value })} aria-label={`Task title: ${task.title}`} />
      <Select value={status} onValueChange={(value) => onUpdateTask(task.id, { status: value as TaskStatus, completed: value === 'completed' })}>
        <SelectTrigger aria-label={`Status for ${task.title}`}><SelectValue /></SelectTrigger>
        <SelectContent>{Object.entries(TASK_STATUS_META).map(([value, meta]) => <SelectItem key={value} value={value}><span className="flex items-center gap-2"><TaskStatusIcon status={value as TaskStatus} size={14} />{meta.label}</span></SelectItem>)}</SelectContent>
      </Select>
      <Select value={task.projectId ?? 'none'} onValueChange={(value) => onUpdateTask(task.id, { projectId: value === 'none' ? undefined : value })}>
        <SelectTrigger aria-label={`Project for ${task.title}`}><SelectValue placeholder="No project" /></SelectTrigger>
        <SelectContent><SelectItem value="none">No project</SelectItem>{projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
      </Select>
      <Button type="button" variant="ghost" size="icon" onClick={() => onDeleteTask(task.id)} aria-label={`Delete ${task.title}`}><Trash2 size={14} /></Button>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }): ReactElement {
  return <div className="col-span-full flex min-h-32 flex-col items-center justify-center gap-1 p-6 text-center"><Circle size={18} className="text-muted-foreground" /><div className="text-sm font-medium text-foreground">{title}</div><div className="text-xs text-muted-foreground">{description}</div></div>
}

function createProjectIcon(seed: string): ProjectIconStyle {
  const index = Math.abs(seed.split('').reduce((total, char) => total + char.charCodeAt(0), 0)) % PROJECT_ICON_SYMBOLS.length
  return { set: 'tabler', glyph: PROJECT_ICON_SYMBOLS[index], variant: 'filled', color: PROJECT_ICON_COLORS[index % PROJECT_ICON_COLORS.length] }
}
