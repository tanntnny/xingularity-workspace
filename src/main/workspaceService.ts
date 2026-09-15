import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { FileService, sanitizeNotePath } from './fileService'
import { ProjectStore } from './projectStore'
import { TaskStore } from './taskStore'
import { ResourceService } from './resourceService'
import { readVaultManifestReport, buildVaultContext, searchVaultContext } from './vaultContext'
import { getVaultAttachmentsDir, getVaultNotebooksDir } from './vaultData'
import { withWorkspaceMutationLock } from './workspaceMutationLock'
import { withWorkspaceTransaction } from './workspaceTransaction'
import { normalizeProjectIcon } from '../shared/projectIcons'
import { normalizeTaskTags } from '../shared/taskTags'
import { resolveTaskPriority } from '../shared/taskDefaults'
import { validateTaskRelationships } from '../shared/projectPlanning'
import { createStoredNoteDocumentFromText } from '../shared/noteDocument'
import type {
  CalendarTask,
  CreateProjectInput,
  CreateProjectMeetingInput,
  CreateProjectMilestoneInput,
  CreateProjectUpdateInput,
  CreateTaskInput,
  DeleteProjectInput,
  Project,
  ProjectMeeting,
  ProjectMilestone,
  ProjectUpdate,
  ResourceInput,
  ResourceLabel,
  ResourceProjectLinksInput,
  ResourceRelation,
  ResourceRelationType,
  ResourceRef,
  TaskPriority,
  TaskStatus,
  UpdateProjectInput,
  UpdateProjectMeetingInput,
  UpdateProjectMilestoneInput,
  UpdateProjectUpdateInput
} from '../shared/types'
import { XWorkspaceError } from '../cli/xWorkspaceErrors'

export interface WorkspaceServiceOptions {
  rootPath: string
  now?: () => Date
  lockWaitMs?: number
}

export interface WorkspaceApplyOptions {
  beforeApply?: () => Promise<void>
}

export interface WorkspaceStatus {
  rootPath: string
  vaultId: string | null
  manifest: Awaited<ReturnType<typeof readVaultManifestReport>>
  counts: {
    notes: number
    projects: number
    tasks: number
    resources: number
  }
}

export interface WorkspaceNoteRead {
  path: string
  content: string
  tags: string[]
  revision: string
}

export interface WorkspaceTaskUpdateInput {
  taskId: string
  title?: string
  description?: string | null
  projectId?: string | null
  milestoneId?: string | null
  tags?: string[]
  date?: string | null
  endDate?: string | null
  time?: string | null
  endTime?: string | null
  priority?: TaskPriority
  taskType?: CalendarTask['taskType']
  status?: TaskStatus
  completed?: boolean
  estimateMinutes?: number | null
  dependencyIds?: string[]
  parentTaskId?: string | null
}

export interface WorkspaceResourceRelationInput {
  type: ResourceRelationType
  fromId: string
  fromKind: string
  toId: string
  toKind: string
  confidence?: 'suggested' | 'confirmed'
  createdBy?: 'user' | 'agent' | 'system'
  note?: string
}

export type WorkspaceOperationInput =
  | {
      operation: 'note.create'
      input: { path?: string; name?: string; markdown?: string; tags?: string[] }
    }
  | { operation: 'note.update'; input: { path: string; markdown: string; tags?: string[] } }
  | { operation: 'note.append'; input: { path: string; markdown: string } }
  | { operation: 'note.delete'; input: { path: string } }
  | { operation: 'project.create'; input: CreateProjectInput }
  | { operation: 'project.update'; input: UpdateProjectInput }
  | { operation: 'project.archive'; input: { projectId: string; state?: 'active' | 'archived' } }
  | { operation: 'project.delete'; input: DeleteProjectInput }
  | { operation: 'project.task.create'; input: CreateTaskInput }
  | { operation: 'project.task.update'; input: WorkspaceTaskUpdateInput }
  | { operation: 'project.task.delete'; input: { taskId: string } }
  | { operation: 'project.milestone.create'; input: CreateProjectMilestoneInput }
  | { operation: 'project.milestone.update'; input: UpdateProjectMilestoneInput }
  | { operation: 'project.milestone.delete'; input: { projectId: string; milestoneId: string } }
  | { operation: 'project.update.create'; input: CreateProjectUpdateInput }
  | { operation: 'project.update.update'; input: UpdateProjectUpdateInput }
  | { operation: 'project.update.delete'; input: { projectId: string; updateId: string } }
  | { operation: 'project.meeting.create'; input: CreateProjectMeetingInput }
  | { operation: 'project.meeting.update'; input: UpdateProjectMeetingInput }
  | { operation: 'project.meeting.delete'; input: { projectId: string; meetingId: string } }
  | { operation: 'resource.create'; input: ResourceInput }
  | {
      operation: 'resource.update'
      input: {
        resourceId: string
        canonicalUri?: string
        title?: string
        labels?: ResourceLabel[]
        projectIds?: string[]
      }
    }
  | { operation: 'resource.delete'; input: { resourceId: string } }
  | { operation: 'resource.link'; input: ResourceProjectLinksInput }
  | { operation: 'resource.relate'; input: WorkspaceResourceRelationInput }
  | { operation: 'resource.refresh'; input: { resourceId: string } }

export class WorkspaceService {
  readonly rootPath: string
  private readonly now: () => Date
  private readonly lockWaitMs: number
  private readonly fileService: FileService
  private readonly projectStore: ProjectStore
  private readonly taskStore: TaskStore
  private readonly resourceService: ResourceService

  constructor(options: WorkspaceServiceOptions) {
    this.rootPath = path.resolve(options.rootPath)
    this.now = options.now ?? (() => new Date())
    this.lockWaitMs = options.lockWaitMs ?? 5_000
    this.fileService = new FileService(
      getVaultNotebooksDir(this.rootPath),
      getVaultAttachmentsDir(this.rootPath),
      () => undefined
    )
    this.projectStore = new ProjectStore(this.rootPath)
    this.taskStore = new TaskStore(this.rootPath)
    this.resourceService = new ResourceService(this.rootPath, { mutationLock: false })
  }

  async status(): Promise<WorkspaceStatus> {
    const [manifest, notes, projects, tasks, resources] = await Promise.all([
      readVaultManifestReport(this.rootPath),
      this.fileService.listNotes().catch(() => []),
      this.projectStore.read(),
      this.taskStore.read(),
      this.resourceService.list()
    ])
    return {
      rootPath: this.rootPath,
      vaultId: manifest.manifest?.vaultId ?? null,
      manifest,
      counts: {
        notes: notes.length,
        projects: projects.projects.length,
        tasks: tasks.length,
        resources: resources.resources.length
      }
    }
  }

  context(
    options: Parameters<typeof buildVaultContext>[1] = {}
  ): ReturnType<typeof buildVaultContext> {
    return buildVaultContext(this.rootPath, options)
  }

  search(
    query: string,
    options: Parameters<typeof searchVaultContext>[2] = {}
  ): ReturnType<typeof searchVaultContext> {
    return searchVaultContext(this.rootPath, query, options)
  }

  listNotes(): ReturnType<FileService['listNotes']> {
    return this.fileService.listNotes()
  }

  async readNote(relPath: string): Promise<WorkspaceNoteRead> {
    const normalizedPath = sanitizeNotePath(relPath)
    const result = await this.fileService.readNoteDocumentWithRevision(normalizedPath)
    return {
      path: normalizedPath,
      content: result.document.markdown,
      tags: result.document.tags,
      revision: result.revision.contentHash
    }
  }

  async listProjects(): Promise<Project[]> {
    const [snapshot, tasks] = await Promise.all([this.projectStore.read(), this.taskStore.read()])
    return snapshot.projects.map((project) => ({
      ...project,
      tasks: tasks.filter((task) => task.projectId === project.id)
    }))
  }

  async getProject(projectId: string): Promise<Project> {
    const projects = await this.listProjects()
    return this.requireProject(projects, projectId)
  }

  listTasks(projectId?: string): Promise<CalendarTask[]> {
    return this.taskStore
      .read()
      .then((tasks) => (projectId ? tasks.filter((task) => task.projectId === projectId) : tasks))
  }

  async getTask(taskId: string): Promise<CalendarTask> {
    const task = (await this.taskStore.read()).find((candidate) => candidate.id === taskId)
    if (!task) throw new XWorkspaceError('not-found', `Task not found: ${taskId}`)
    return task
  }

  async listProjectUpdates(projectId: string): Promise<ProjectUpdate[]> {
    return (await this.getProject(projectId)).updates ?? []
  }

  async getProjectUpdate(projectId: string, updateId: string): Promise<ProjectUpdate> {
    const update = (await this.getProject(projectId)).updates?.find(
      (candidate) => candidate.id === updateId
    )
    if (!update) throw new XWorkspaceError('not-found', `Project update not found: ${updateId}`)
    return update
  }

  async listProjectMeetings(projectId: string): Promise<ProjectMeeting[]> {
    return (await this.getProject(projectId)).meetings ?? []
  }

  async getProjectMeeting(projectId: string, meetingId: string): Promise<ProjectMeeting> {
    const meeting = (await this.getProject(projectId)).meetings?.find(
      (candidate) => candidate.id === meetingId
    )
    if (!meeting) throw new XWorkspaceError('not-found', `Project meeting not found: ${meetingId}`)
    return meeting
  }

  async listProjectMilestones(projectId: string): Promise<ProjectMilestone[]> {
    return (await this.getProject(projectId)).milestones ?? []
  }

  async getProjectMilestone(projectId: string, milestoneId: string): Promise<ProjectMilestone> {
    const milestone = (await this.getProject(projectId)).milestones?.find(
      (candidate) => candidate.id === milestoneId
    )
    if (!milestone)
      throw new XWorkspaceError('not-found', `Project milestone not found: ${milestoneId}`)
    return milestone
  }

  async listResources(): Promise<{ resources: ResourceRef[]; relations: ResourceRelation[] }> {
    const snapshot = await this.resourceService.list()
    return {
      resources: snapshot.resources,
      relations: snapshot.relations
    }
  }

  async getResource(resourceId: string): Promise<ResourceRef> {
    const snapshot = await this.resourceService.list()
    const resource = snapshot.resources.find((candidate) => candidate.id === resourceId)
    if (!resource) throw new XWorkspaceError('not-found', `Resource not found: ${resourceId}`)
    return resource
  }

  resourcePreview(
    resourceId: string,
    allowContent = false
  ): ReturnType<ResourceService['preview']> {
    return this.resourceService.preview(resourceId, allowContent)
  }

  previewOperation(
    operation: WorkspaceOperationInput['operation'],
    input: unknown
  ): Promise<Record<string, unknown>> {
    return this.validateOperation({ operation, input } as WorkspaceOperationInput).then(() => ({
      operation,
      changes: [{ operation, input }],
      summary: `Preview ${operation}`
    }))
  }

  async applyOperation(
    operation: WorkspaceOperationInput['operation'],
    input: unknown,
    options: WorkspaceApplyOptions = {}
  ): Promise<{ result: unknown; transactionId: string }> {
    const request = { operation, input } as WorkspaceOperationInput
    await this.validateOperation(request)
    const transactionId = randomUUID()
    const result = await withWorkspaceMutationLock(
      this.rootPath,
      async () => {
        await options.beforeApply?.()
        return withWorkspaceTransaction(this.rootPath, transactionId, operation, () =>
          this.applyOperationUnlocked(request)
        )
      },
      { waitMs: this.lockWaitMs, transactionId }
    )
    return { result, transactionId }
  }

  private async validateOperation(request: WorkspaceOperationInput): Promise<void> {
    const input = request.input as Record<string, unknown>
    switch (request.operation) {
      case 'note.create': {
        const relPath = this.noteCreatePath(input)
        const absolutePath = path.join(getVaultNotebooksDir(this.rootPath), relPath)
        try {
          await fs.access(absolutePath)
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
          return
        }
        throw new XWorkspaceError('conflict', `Note already exists: ${relPath}`)
      }
      case 'note.update':
      case 'note.append':
      case 'note.delete':
        if (typeof input.path !== 'string' || !input.path.trim()) {
          throw new XWorkspaceError('invalid-input', 'A note path is required')
        }
        await this.fileService.readNoteDocument(input.path)
        return
      case 'project.create':
        return
      case 'project.update':
      case 'project.archive':
      case 'project.delete':
        await this.getProject(String(input.projectId))
        if (
          request.operation === 'project.delete' &&
          input.linkedTasks !== 'delete' &&
          input.linkedTasks !== 'unassign'
        ) {
          throw new XWorkspaceError(
            'invalid-input',
            'Project deletion requires linkedTasks=delete or linkedTasks=unassign'
          )
        }
        return
      case 'project.task.create':
        if (input.projectId) await this.getProject(String(input.projectId))
        return
      case 'project.task.update':
      case 'project.task.delete':
        await this.getTask(String(input.taskId))
        return
      case 'project.milestone.create':
      case 'project.milestone.update':
      case 'project.milestone.delete':
      case 'project.update.create':
      case 'project.update.update':
      case 'project.update.delete':
      case 'project.meeting.create':
      case 'project.meeting.update':
      case 'project.meeting.delete':
        await this.getProject(String(input.projectId))
        return
      case 'resource.create':
        if (typeof input.canonicalUri !== 'string' || !input.canonicalUri.trim()) {
          throw new XWorkspaceError('invalid-input', 'A resource canonicalUri is required')
        }
        return
      case 'resource.update':
      case 'resource.delete':
      case 'resource.link':
      case 'resource.refresh':
        await this.getResource(String(input.resourceId))
        return
      case 'resource.relate':
        if (!input.fromId || !input.toId || !input.type) {
          throw new XWorkspaceError(
            'invalid-input',
            'A resource relation requires type, fromId, and toId'
          )
        }
        return
    }
  }

  private async applyOperationUnlocked(request: WorkspaceOperationInput): Promise<unknown> {
    switch (request.operation) {
      case 'note.create':
        return this.createNote(request.input)
      case 'note.update':
        return this.updateNote(request.input)
      case 'note.append':
        return this.appendNote(request.input)
      case 'note.delete':
        return this.deleteNote(request.input.path)
      case 'project.create':
        return this.createProject(request.input)
      case 'project.update':
        return this.updateProject(request.input)
      case 'project.archive':
        return this.setProjectState(request.input.projectId, request.input.state ?? 'archived')
      case 'project.delete':
        return this.deleteProject(request.input)
      case 'project.task.create':
        return this.createTask(request.input)
      case 'project.task.update':
        return this.updateTask(request.input)
      case 'project.task.delete':
        return this.deleteTask(request.input.taskId)
      case 'project.milestone.create':
        return this.createProjectMilestone(request.input)
      case 'project.milestone.update':
        return this.updateProjectMilestone(request.input)
      case 'project.milestone.delete':
        return this.deleteProjectMilestone(request.input.projectId, request.input.milestoneId)
      case 'project.update.create':
        return this.createProjectUpdate(request.input)
      case 'project.update.update':
        return this.updateProjectUpdate(request.input)
      case 'project.update.delete':
        return this.deleteProjectUpdate(request.input.projectId, request.input.updateId)
      case 'project.meeting.create':
        return this.createProjectMeeting(request.input)
      case 'project.meeting.update':
        return this.updateProjectMeeting(request.input)
      case 'project.meeting.delete':
        return this.deleteProjectMeeting(request.input.projectId, request.input.meetingId)
      case 'resource.create':
        return this.resourceService.add(request.input)
      case 'resource.update':
        return this.resourceService.update(request.input.resourceId, request.input)
      case 'resource.delete': {
        const resourceSnapshot = await this.resourceService.list()
        const projectSnapshot = await this.projectStore.read()
        const operationId = randomUUID()
        await this.archiveJsonSnapshot(resourceSnapshot, 'resources.json', operationId)
        const projects = projectSnapshot.projects.map((project) => ({
          ...project,
          resourceRefs: project.resourceRefs?.filter(
            (resource) => resource.id !== request.input.resourceId
          )
        }))
        const projectsChanged = projects.some(
          (project, index) =>
            project.resourceRefs?.length !== projectSnapshot.projects[index]?.resourceRefs?.length
        )
        if (projectsChanged) {
          await this.archiveJsonSnapshot(projectSnapshot.projects, 'projects.json', operationId)
        }
        await this.resourceService.remove(request.input.resourceId)
        if (projectsChanged) await this.projectStore.writeAll(projects)
        return { resourceId: request.input.resourceId, deleted: true, operationId }
      }
      case 'resource.link':
        return this.resourceService.setProjectLinks(request.input)
      case 'resource.relate':
        return this.resourceService.relate(request.input)
      case 'resource.refresh':
        return this.resourceService.refresh(request.input.resourceId)
    }
  }

  private async createNote(input: {
    path?: string
    name?: string
    markdown?: string
    tags?: string[]
  }): Promise<{ path: string; content: string; tags: string[] }> {
    const relPath = this.noteCreatePath(input)
    const document = createStoredNoteDocumentFromText(input.markdown ?? '', input.tags ?? [])
    await this.fileService.createNoteAtPath(relPath)
    await this.fileService.writeNoteDocument(relPath, document)
    return { path: relPath, content: document.markdown, tags: document.tags }
  }

  private async updateNote(input: {
    path: string
    markdown: string
    tags?: string[]
  }): Promise<{ path: string; content: string; tags: string[] }> {
    const current = await this.fileService.readNoteDocument(input.path)
    const document = createStoredNoteDocumentFromText(input.markdown, input.tags ?? current.tags)
    await this.fileService.writeNoteDocument(input.path, document)
    return { path: sanitizeNotePath(input.path), content: document.markdown, tags: document.tags }
  }

  private async appendNote(input: {
    path: string
    markdown: string
  }): Promise<{ path: string; content: string; tags: string[] }> {
    const current = await this.fileService.readNoteDocument(input.path)
    const separator = current.markdown && !current.markdown.endsWith('\n') ? '\n' : ''
    const document = createStoredNoteDocumentFromText(
      `${current.markdown}${separator}${input.markdown}`,
      current.tags
    )
    await this.fileService.writeNoteDocument(input.path, document)
    return { path: sanitizeNotePath(input.path), content: document.markdown, tags: document.tags }
  }

  private async deleteNote(
    relPath: string
  ): Promise<{ path: string; deleted: true; operationId: string }> {
    const normalizedPath = sanitizeNotePath(relPath)
    const source = path.join(getVaultNotebooksDir(this.rootPath), normalizedPath)
    const operationId = randomUUID()
    await this.archivePath(source, path.join('notebooks', normalizedPath), operationId)
    await this.fileService.delete(normalizedPath)
    return { path: normalizedPath, deleted: true, operationId }
  }

  private async createProject(input: CreateProjectInput): Promise<Project> {
    const snapshot = await this.projectStore.read()
    const requestedName = input.name?.trim() || 'Untitled Project'
    const names = new Set(snapshot.projects.map((project) => project.name.toLowerCase()))
    let name = requestedName
    let suffix = 2
    while (names.has(name.toLowerCase())) name = `${requestedName} ${suffix++}`
    const now = this.now().toISOString()
    const description = input.description?.trim() ?? ''
    const project: Project = {
      id: `project-${randomUUID()}`,
      name,
      summary: description,
      description,
      state: 'active',
      startDate: input.startDate ?? now.slice(0, 10),
      endDate: input.endDate,
      tags: normalizeStrings(input.tags),
      resourceRefs: input.resourceRefs,
      timeBudgetMinutes:
        input.timeBudgetMinutes === undefined
          ? undefined
          : Math.max(0, Math.round(input.timeBudgetMinutes)),
      icon: normalizeProjectIcon(input.icon, name),
      updatedAt: now
    }
    await this.projectStore.writeAll([project, ...snapshot.projects])
    return project
  }

  private async updateProject(input: UpdateProjectInput): Promise<Project> {
    const snapshot = await this.projectStore.read()
    const existing = this.requireProject(snapshot.projects, input.projectId)
    const name = input.name === undefined ? existing.name : input.name.trim()
    if (!name) throw new XWorkspaceError('invalid-input', 'Project name is required')
    const description =
      input.description === undefined ? existing.description : input.description.trim()
    const updated: Project = {
      ...existing,
      name,
      summary: description ?? existing.summary,
      description,
      startDate: input.startDate === null ? undefined : (input.startDate ?? existing.startDate),
      endDate: input.endDate === null ? undefined : (input.endDate ?? existing.endDate),
      tags: input.tags === undefined ? existing.tags : normalizeStrings(input.tags),
      resourceRefs: input.resourceRefs === undefined ? existing.resourceRefs : input.resourceRefs,
      timeBudgetMinutes:
        input.timeBudgetMinutes === null
          ? undefined
          : input.timeBudgetMinutes === undefined
            ? existing.timeBudgetMinutes
            : Math.max(0, Math.round(input.timeBudgetMinutes)),
      icon: input.icon ? normalizeProjectIcon(input.icon, existing.id) : existing.icon,
      updatedAt: this.now().toISOString()
    }
    await this.projectStore.writeAll(
      snapshot.projects.map((project) => (project.id === updated.id ? updated : project))
    )
    return updated
  }

  private async setProjectState(projectId: string, state: 'active' | 'archived'): Promise<Project> {
    const snapshot = await this.projectStore.read()
    const existing = this.requireProject(snapshot.projects, projectId)
    const updated = { ...existing, state, updatedAt: this.now().toISOString() }
    await this.projectStore.writeAll(
      snapshot.projects.map((candidate) => (candidate.id === projectId ? updated : candidate))
    )
    return updated
  }

  private async deleteProject(input: DeleteProjectInput): Promise<{
    deletedProjectId: string
    removedTaskIds: string[]
    unassignedTaskIds: string[]
    operationId: string
  }> {
    const projectSnapshot = await this.projectStore.read()
    const taskSnapshot = await this.taskStore.read()
    const project = this.requireProject(projectSnapshot.projects, input.projectId)
    const linkedTasks = taskSnapshot.filter((task) => task.projectId === project.id)
    const operationId = randomUUID()
    await this.archiveJsonSnapshot(projectSnapshot.projects, 'projects.json', operationId)
    await this.archiveJsonSnapshot(taskSnapshot, 'tasks.json', operationId)
    const projects = projectSnapshot.projects.filter((candidate) => candidate.id !== project.id)
    const tasks =
      input.linkedTasks === 'delete'
        ? taskSnapshot.filter((task) => task.projectId !== project.id)
        : taskSnapshot.map((task) =>
            task.projectId === project.id
              ? { ...task, projectId: undefined, milestoneId: undefined }
              : task
          )
    await this.projectStore.writeAll(projects)
    await this.taskStore.writeAll(tasks)
    return {
      deletedProjectId: project.id,
      removedTaskIds: input.linkedTasks === 'delete' ? linkedTasks.map((task) => task.id) : [],
      unassignedTaskIds: input.linkedTasks === 'unassign' ? linkedTasks.map((task) => task.id) : [],
      operationId
    }
  }

  private async createTask(input: CreateTaskInput): Promise<CalendarTask> {
    const [projects, tasks] = await Promise.all([this.projectStore.read(), this.taskStore.read()])
    const project = input.projectId
      ? this.requireProject(projects.projects, input.projectId)
      : undefined
    if (input.milestoneId && !project)
      throw new XWorkspaceError('invalid-input', 'A milestone requires a project')
    if (
      input.milestoneId &&
      !project?.milestones?.some((milestone) => milestone.id === input.milestoneId)
    ) {
      throw new XWorkspaceError('not-found', `Milestone not found: ${input.milestoneId}`)
    }
    const now = this.now().toISOString()
    const task: CalendarTask = {
      id: `task-${randomUUID()}`,
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      projectId: input.projectId,
      milestoneId: input.milestoneId,
      tags: normalizeTaskTags(input.tags),
      date: input.date,
      endDate: input.endDate,
      time: input.time,
      endTime: input.endTime,
      completed: false,
      status: 'pending',
      createdAt: now,
      priority: resolveTaskPriority(input.priority),
      taskType: input.taskType ?? 'assignment',
      reminders: input.reminders ?? [],
      dependencyIds: Array.from(new Set(input.dependencyIds ?? [])),
      parentTaskId: input.parentTaskId,
      estimateMinutes:
        input.estimateMinutes === undefined
          ? undefined
          : Math.max(0, Math.round(input.estimateMinutes)),
      updatedAt: now
    }
    const errors = validateTaskRelationships([...tasks, task])
    if (errors.length) throw new XWorkspaceError('invalid-input', errors.join('; '))
    await this.taskStore.writeAll([...tasks, task])
    return task
  }

  private async updateTask(input: WorkspaceTaskUpdateInput): Promise<CalendarTask> {
    const [projects, tasks] = await Promise.all([this.projectStore.read(), this.taskStore.read()])
    const existing = tasks.find((task) => task.id === input.taskId)
    if (!existing) throw new XWorkspaceError('not-found', `Task not found: ${input.taskId}`)
    if (input.projectId) this.requireProject(projects.projects, input.projectId)
    if (input.milestoneId) {
      const project = this.requireProject(
        projects.projects,
        input.projectId ?? existing.projectId ?? ''
      )
      if (!project.milestones?.some((milestone) => milestone.id === input.milestoneId)) {
        throw new XWorkspaceError('not-found', `Milestone not found: ${input.milestoneId}`)
      }
    }
    const status = input.status ?? existing.status ?? (existing.completed ? 'completed' : 'pending')
    const updated: CalendarTask = {
      ...existing,
      ...(input.title === undefined ? {} : { title: input.title.trim() }),
      ...(input.description === undefined
        ? {}
        : { description: input.description?.trim() || undefined }),
      ...(input.projectId === undefined ? {} : { projectId: input.projectId ?? undefined }),
      ...(input.milestoneId === undefined ? {} : { milestoneId: input.milestoneId ?? undefined }),
      ...(input.tags === undefined ? {} : { tags: normalizeTaskTags(input.tags) }),
      ...(input.date === undefined ? {} : { date: input.date ?? undefined }),
      ...(input.endDate === undefined ? {} : { endDate: input.endDate ?? undefined }),
      ...(input.time === undefined ? {} : { time: input.time ?? undefined }),
      ...(input.endTime === undefined ? {} : { endTime: input.endTime ?? undefined }),
      ...(input.priority === undefined ? {} : { priority: input.priority }),
      ...(input.taskType === undefined ? {} : { taskType: input.taskType }),
      status,
      completed: input.completed ?? status === 'completed',
      ...(input.estimateMinutes === undefined
        ? {}
        : { estimateMinutes: input.estimateMinutes ?? undefined }),
      ...(input.dependencyIds === undefined
        ? {}
        : { dependencyIds: Array.from(new Set(input.dependencyIds)) }),
      ...(input.parentTaskId === undefined
        ? {}
        : { parentTaskId: input.parentTaskId ?? undefined }),
      updatedAt: this.now().toISOString()
    }
    const errors = validateTaskRelationships(
      tasks.map((task) => (task.id === updated.id ? updated : task))
    )
    if (errors.length) throw new XWorkspaceError('invalid-input', errors.join('; '))
    await this.taskStore.writeAll(tasks.map((task) => (task.id === updated.id ? updated : task)))
    return updated
  }

  private async deleteTask(taskId: string): Promise<{
    taskId: string
    deleted: true
    operationId: string
  }> {
    const tasks = await this.taskStore.read()
    const task = tasks.find((candidate) => candidate.id === taskId)
    if (!task) throw new XWorkspaceError('not-found', `Task not found: ${taskId}`)
    const operationId = randomUUID()
    await this.archiveJsonSnapshot(tasks, 'tasks.json', operationId)
    await this.taskStore.writeAll(tasks.filter((candidate) => candidate.id !== taskId))
    return { taskId, deleted: true, operationId }
  }

  private async createProjectMilestone(
    input: CreateProjectMilestoneInput
  ): Promise<ProjectMilestone> {
    const project = await this.getProject(input.projectId)
    const now = this.now().toISOString()
    const milestone: ProjectMilestone = {
      id: `milestone-${randomUUID()}`,
      title: input.title.trim(),
      endDate: input.endDate,
      createdAt: now,
      updatedAt: now
    }
    await this.writeProject({
      ...project,
      milestones: [...(project.milestones ?? []), milestone],
      updatedAt: now
    })
    return milestone
  }

  private async updateProjectMilestone(
    input: UpdateProjectMilestoneInput
  ): Promise<ProjectMilestone> {
    const project = await this.getProject(input.projectId)
    const existing = (project.milestones ?? []).find(
      (milestone) => milestone.id === input.milestoneId
    )
    if (!existing)
      throw new XWorkspaceError('not-found', `Milestone not found: ${input.milestoneId}`)
    const updated = {
      ...existing,
      title: input.title.trim(),
      endDate: input.endDate ?? undefined,
      updatedAt: this.now().toISOString()
    }
    await this.writeProject({
      ...project,
      milestones: (project.milestones ?? []).map((milestone) =>
        milestone.id === updated.id ? updated : milestone
      ),
      updatedAt: updated.updatedAt
    })
    return updated
  }

  private async deleteProjectMilestone(
    projectId: string,
    milestoneId: string
  ): Promise<{ milestoneId: string; movedTaskIds: string[] }> {
    const project = await this.getProject(projectId)
    if (!(project.milestones ?? []).some((milestone) => milestone.id === milestoneId))
      throw new XWorkspaceError('not-found', `Milestone not found: ${milestoneId}`)
    const tasks = await this.taskStore.read()
    const movedTaskIds = tasks
      .filter((task) => task.projectId === projectId && task.milestoneId === milestoneId)
      .map((task) => task.id)
    await this.writeProject({
      ...project,
      milestones: (project.milestones ?? []).filter((milestone) => milestone.id !== milestoneId),
      updatedAt: this.now().toISOString()
    })
    await this.taskStore.writeAll(
      tasks.map((task) =>
        task.projectId === projectId && task.milestoneId === milestoneId
          ? { ...task, milestoneId: undefined }
          : task
      )
    )
    return { milestoneId, movedTaskIds }
  }

  private async createProjectUpdate(input: CreateProjectUpdateInput): Promise<ProjectUpdate> {
    const project = await this.getProject(input.projectId)
    if (!input.markdown.trim())
      throw new XWorkspaceError('invalid-input', 'Project update content is required')
    const now = this.now().toISOString()
    const update: ProjectUpdate = {
      id: `update-${randomUUID()}`,
      projectId: project.id,
      markdown: input.markdown,
      status: input.status,
      createdAt: now,
      updatedAt: now
    }
    await this.writeProject({
      ...project,
      updates: [...(project.updates ?? []), update],
      updatedAt: now
    })
    return update
  }

  private async updateProjectUpdate(input: UpdateProjectUpdateInput): Promise<ProjectUpdate> {
    const project = await this.getProject(input.projectId)
    const existing = (project.updates ?? []).find((update) => update.id === input.updateId)
    if (!existing)
      throw new XWorkspaceError('not-found', `Project update not found: ${input.updateId}`)
    if (!input.markdown.trim())
      throw new XWorkspaceError('invalid-input', 'Project update content is required')
    const updated = {
      ...existing,
      markdown: input.markdown,
      status: input.status,
      updatedAt: this.now().toISOString()
    }
    await this.writeProject({
      ...project,
      updates: (project.updates ?? []).map((item) => (item.id === updated.id ? updated : item)),
      updatedAt: updated.updatedAt
    })
    return updated
  }

  private async deleteProjectUpdate(
    projectId: string,
    updateId: string
  ): Promise<{ projectId: string; updateId: string; deleted: true }> {
    const project = await this.getProject(projectId)
    if (!(project.updates ?? []).some((update) => update.id === updateId))
      throw new XWorkspaceError('not-found', `Project update not found: ${updateId}`)
    await this.writeProject({
      ...project,
      updates: (project.updates ?? []).filter((update) => update.id !== updateId),
      updatedAt: this.now().toISOString()
    })
    return { projectId, updateId, deleted: true }
  }

  private async createProjectMeeting(input: CreateProjectMeetingInput): Promise<ProjectMeeting> {
    const project = await this.getProject(input.projectId)
    if (!input.markdown.trim())
      throw new XWorkspaceError('invalid-input', 'Project meeting content is required')
    const now = this.now().toISOString()
    const meeting: ProjectMeeting = {
      id: `meeting-${randomUUID()}`,
      projectId: project.id,
      markdown: input.markdown,
      type: input.type,
      outcome: input.outcome,
      createdAt: now,
      updatedAt: now
    }
    await this.writeProject({
      ...project,
      meetings: [...(project.meetings ?? []), meeting],
      updatedAt: now
    })
    return meeting
  }

  private async updateProjectMeeting(input: UpdateProjectMeetingInput): Promise<ProjectMeeting> {
    const project = await this.getProject(input.projectId)
    const existing = (project.meetings ?? []).find((meeting) => meeting.id === input.meetingId)
    if (!existing)
      throw new XWorkspaceError('not-found', `Project meeting not found: ${input.meetingId}`)
    if (!input.markdown.trim())
      throw new XWorkspaceError('invalid-input', 'Project meeting content is required')
    const updated = {
      ...existing,
      markdown: input.markdown,
      type: input.type,
      outcome: input.outcome,
      updatedAt: this.now().toISOString()
    }
    await this.writeProject({
      ...project,
      meetings: (project.meetings ?? []).map((item) => (item.id === updated.id ? updated : item)),
      updatedAt: updated.updatedAt
    })
    return updated
  }

  private async deleteProjectMeeting(
    projectId: string,
    meetingId: string
  ): Promise<{ projectId: string; meetingId: string; deleted: true }> {
    const project = await this.getProject(projectId)
    if (!(project.meetings ?? []).some((meeting) => meeting.id === meetingId))
      throw new XWorkspaceError('not-found', `Project meeting not found: ${meetingId}`)
    await this.writeProject({
      ...project,
      meetings: (project.meetings ?? []).filter((meeting) => meeting.id !== meetingId),
      updatedAt: this.now().toISOString()
    })
    return { projectId, meetingId, deleted: true }
  }

  private async writeProject(project: Project): Promise<void> {
    const snapshot = await this.projectStore.read()
    await this.projectStore.writeAll(
      snapshot.projects.map((candidate) => (candidate.id === project.id ? project : candidate))
    )
  }

  private requireProject(projects: Project[], projectId: string): Project {
    const project = projects.find((candidate) => candidate.id === projectId)
    if (!project) throw new XWorkspaceError('not-found', `Project not found: ${projectId}`)
    return project
  }

  private noteCreatePath(input: { path?: string; name?: string }): string {
    const candidate = input.path ?? `${input.name ?? 'untitled'}.md`
    return sanitizeNotePath(candidate)
  }

  private async archivePath(
    source: string,
    relativeName: string,
    operationId: string
  ): Promise<void> {
    const target = path.join(this.rootPath, '.xingularity', 'trash', operationId, relativeName)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.copyFile(source, target)
  }

  private async archiveJsonSnapshot(
    value: unknown,
    relativeName: string,
    operationId: string
  ): Promise<void> {
    const target = path.join(this.rootPath, '.xingularity', 'trash', operationId, relativeName)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  }
}

function normalizeStrings(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)))
}
