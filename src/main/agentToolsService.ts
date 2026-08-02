import { z } from 'zod'
import { normalizeProjectIcon } from '../shared/projectIcons'
import { upsertTagsInMarkdown } from '../shared/noteTags'
import {
  AppSettings,
  CALENDAR_TASK_TYPE_VALUES,
  CalendarTask,
  Project,
  SearchResult,
  WeeklyPlanPriority,
  WeeklyPlanReview,
  WeeklyPlanWeek
} from '../shared/types'
import { VaultRuntime } from './runtime'
import { WeeklyPlanService } from './planning/weeklyPlanService'

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/)

const noteSearchSchema = z.object({
  query: z.string().trim().min(1).max(200)
})

const noteReadSchema = z.object({
  path: z.string().trim().min(1).max(512)
})

const noteCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  content: z.string().max(2_000_000).optional(),
  tags: z.array(z.string().trim().min(1).max(100)).max(50).optional()
})

const noteUpdateSchema = z.object({
  path: z.string().trim().min(1).max(512),
  content: z.string().max(2_000_000)
})

const noteAppendSchema = z.object({
  path: z.string().trim().min(1).max(512),
  content: z.string().min(1).max(2_000_000),
  separator: z.string().max(20).optional()
})

const projectIconSchema = z.object({
  set: z.enum(['tabler', 'shape', 'lucide']).optional(),
  glyph: z
    .enum([
      'circle',
      'square',
      'triangle',
      'diamond',
      'hex',
      'briefcase',
      'folder-kanban',
      'rocket',
      'lightbulb',
      'target',
      'book-open',
      'package',
      'flask-conical',
      'sparkles',
      'pen-tool',
      'monitor',
      'megaphone',
      'globe',
      'shield',
      'camera',
      'calendar'
    ])
    .optional(),
  shape: z.enum(['circle', 'square', 'triangle', 'diamond', 'hex']).optional(),
  variant: z.enum(['filled', 'outlined']).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/)
})

const projectCreateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  icon: projectIconSchema.optional()
})

const projectUpdateSchema = z
  .object({
    projectId: z.string().trim().min(1).max(120).optional(),
    projectName: z.string().trim().min(1).max(200).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    icon: projectIconSchema.optional()
  })
  .refine((value) => value.projectId || value.projectName, {
    message: 'Provide projectId or projectName'
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.icon !== undefined,
    {
      message: 'Provide at least one project field to update'
    }
  )

const reminderSchema = z.object({
  id: z.string().trim().min(1).max(120),
  type: z.enum(['minutes', 'hours', 'days']),
  value: z.number().int().min(1).max(365),
  enabled: z.boolean()
})

const calendarTaskCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  projectId: z.string().trim().min(1).max(120).optional(),
  projectName: z.string().trim().min(1).max(200).optional(),
  date: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
  time: timeSchema.optional(),
  endTime: timeSchema.optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  taskType: z.enum(CALENDAR_TASK_TYPE_VALUES).optional(),
  reminders: z.array(reminderSchema).max(10).optional(),
  status: z.enum(['pending', 'in-progress', 'blocked', 'completed']).optional(),
  completed: z.boolean().optional()
})

const calendarTaskUpdateSchema = z
  .object({
    taskId: z.string().trim().min(1).max(120).optional(),
    titleMatch: z.string().trim().min(1).max(200).optional(),
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    projectId: z.string().trim().min(1).max(120).optional().nullable(),
    date: isoDateSchema.nullable().optional(),
    endDate: isoDateSchema.nullable().optional(),
    time: timeSchema.nullable().optional(),
    endTime: timeSchema.nullable().optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    taskType: z.enum(CALENDAR_TASK_TYPE_VALUES).nullable().optional(),
    reminders: z.array(reminderSchema).max(10).optional(),
    status: z.enum(['pending', 'in-progress', 'blocked', 'completed']).optional(),
    completed: z.boolean().optional()
  })
  .refine((value) => value.taskId || value.titleMatch, {
    message: 'Provide taskId or titleMatch'
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.projectId !== undefined ||
      value.date !== undefined ||
      value.endDate !== undefined ||
      value.time !== undefined ||
      value.endTime !== undefined ||
      value.priority !== undefined ||
      value.taskType !== undefined ||
      value.reminders !== undefined ||
      value.status !== undefined ||
      value.completed !== undefined,
    {
      message: 'Provide at least one calendar task field to update'
    }
  )

const weeklyPlanCreateWeekSchema = z.object({
  startDate: isoDateSchema,
  endDate: isoDateSchema.optional(),
  focus: z.string().trim().max(500).optional()
})

const weeklyPlanCreatePrioritySchema = z
  .object({
    weekId: z.string().trim().min(1).max(200).optional(),
    weekStartDate: isoDateSchema.optional(),
    title: z.string().trim().min(1).max(300),
    linkedProjectId: z.string().trim().min(1).max(200).optional(),
    linkedTaskId: z.string().trim().min(1).max(200).optional()
  })
  .refine((value) => value.weekId || value.weekStartDate, {
    message: 'Provide weekId or weekStartDate'
  })

const weeklyPlanUpsertReviewSchema = z
  .object({
    weekId: z.string().trim().min(1).max(200).optional(),
    weekStartDate: isoDateSchema.optional(),
    reviewId: z.string().trim().min(1).max(200).optional(),
    wins: z.string().trim().max(2000).nullable().optional(),
    misses: z.string().trim().max(2000).nullable().optional(),
    blockers: z.string().trim().max(2000).nullable().optional(),
    nextWeek: z.string().trim().max(2000).nullable().optional()
  })
  .refine((value) => value.weekId || value.weekStartDate, {
    message: 'Provide weekId or weekStartDate'
  })

export type AgentToolName =
  | 'note.search'
  | 'note.read'
  | 'note.create'
  | 'note.update'
  | 'note.append'
  | 'project.create'
  | 'project.update'
  | 'calendarTask.create'
  | 'calendarTask.update'
  | 'task.create'
  | 'task.update'
  | 'weeklyPlan.createWeek'
  | 'weeklyPlan.createPriority'
  | 'weeklyPlan.upsertReview'

export class AgentToolsService {
  constructor(
    private readonly runtime: VaultRuntime,
    private readonly weeklyPlanService: WeeklyPlanService
  ) {}

  async invoke(name: AgentToolName, input: unknown): Promise<unknown> {
    switch (name) {
      case 'note.search':
        return this.noteSearch(noteSearchSchema.parse(input))
      case 'note.read':
        return this.noteRead(noteReadSchema.parse(input))
      case 'note.create':
        return this.noteCreate(noteCreateSchema.parse(input))
      case 'note.update':
        return this.noteUpdate(noteUpdateSchema.parse(input))
      case 'note.append':
        return this.noteAppend(noteAppendSchema.parse(input))
      case 'project.create':
        return this.projectCreate(projectCreateSchema.parse(input))
      case 'project.update':
        return this.projectUpdate(projectUpdateSchema.parse(input))
      case 'calendarTask.create':
        return this.calendarTaskCreate(calendarTaskCreateSchema.parse(input))
      case 'calendarTask.update':
        return this.calendarTaskUpdate(calendarTaskUpdateSchema.parse(input))
      case 'task.create':
        return this.calendarTaskCreate(calendarTaskCreateSchema.parse(input))
      case 'task.update':
        return this.calendarTaskUpdate(calendarTaskUpdateSchema.parse(input))
      case 'weeklyPlan.createWeek':
        return this.weeklyPlanCreateWeek(weeklyPlanCreateWeekSchema.parse(input))
      case 'weeklyPlan.createPriority':
        return this.weeklyPlanCreatePriority(weeklyPlanCreatePrioritySchema.parse(input))
      case 'weeklyPlan.upsertReview':
        return this.weeklyPlanUpsertReview(weeklyPlanUpsertReviewSchema.parse(input))
      default:
        throw new Error(`Unsupported agent tool: ${name satisfies never}`)
    }
  }

  private noteSearch(input: z.infer<typeof noteSearchSchema>): SearchResult[] {
    return this.runtime.search(input.query)
  }

  private async noteRead(
    input: z.infer<typeof noteReadSchema>
  ): Promise<{ path: string; content: string }> {
    const content = await this.runtime.readNote(input.path)
    return { path: input.path, content }
  }

  private async noteCreate(
    input: z.infer<typeof noteCreateSchema>
  ): Promise<{ path: string; content: string }> {
    const path = input.tags?.length
      ? await this.runtime.createNoteWithTags(input.name, input.tags)
      : await this.runtime.createNote(input.name)
    const content =
      input.content !== undefined
        ? input.tags?.length
          ? upsertTagsInMarkdown(input.content, input.tags)
          : input.content
        : await this.runtime.readNote(path)
    if (input.content !== undefined) {
      await this.runtime.writeNote(path, content)
    }
    return { path, content }
  }

  private async noteUpdate(
    input: z.infer<typeof noteUpdateSchema>
  ): Promise<{ path: string; content: string }> {
    await this.runtime.writeNote(input.path, input.content)
    return { path: input.path, content: input.content }
  }

  private async noteAppend(
    input: z.infer<typeof noteAppendSchema>
  ): Promise<{ path: string; content: string }> {
    const existing = await this.runtime.readNote(input.path)
    const separator = input.separator ?? '\n\n'
    const nextContent =
      existing.trim().length > 0 ? `${existing}${separator}${input.content}` : input.content
    await this.runtime.writeNote(input.path, nextContent)
    return { path: input.path, content: nextContent }
  }

  private async projectCreate(input: z.infer<typeof projectCreateSchema>): Promise<Project> {
    return this.runtime.mutateSettings(async (settings) => {
      const name = buildProjectName(settings.projects, input.name)
      const nowIso = new Date().toISOString()
      const project: Project = {
        id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        description: input.description?.trim() || '',
        icon: normalizeProjectIcon(input.icon, name),
        updatedAt: nowIso,
        summary: input.description?.trim() || '',
        state: 'active',
        status: 'on-track',
        progress: 0,
        milestones: []
      }

      return {
        next: {
          projects: [project, ...settings.projects],
          projectIcons: { ...settings.projectIcons, [project.id]: project.icon }
        },
        result: project
      }
    })
  }

  private async projectUpdate(input: z.infer<typeof projectUpdateSchema>): Promise<Project> {
    return this.runtime.mutateSettings(async (settings) => {
      const project = resolveProject(settings, input.projectId, input.projectName)
      const updated: Project = {
        ...project,
        name: input.name?.trim() || project.name,
        description:
          input.description !== undefined ? input.description.trim() : project.description,
        summary:
          input.description !== undefined ? input.description.trim() : project.summary,
        icon: input.icon ? normalizeProjectIcon(input.icon, project.id) : project.icon,
        updatedAt: new Date().toISOString()
      }
      const nextProjects = settings.projects.map((item) =>
        item.id === project.id ? updated : item
      )

      return {
        next: {
          projects: nextProjects,
          projectIcons: { ...settings.projectIcons, [project.id]: updated.icon }
        },
        result: updated
      }
    })
  }

  private async calendarTaskCreate(
    input: z.infer<typeof calendarTaskCreateSchema>
  ): Promise<CalendarTask> {
    return this.runtime.mutateSettings(async (settings) => {
      const projectId = input.projectId ??
        (input.projectName ? resolveProject(settings, undefined, input.projectName).id : undefined)
      const status = input.status ?? (input.completed ? 'completed' : 'pending')
      const task: CalendarTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: input.title.trim(),
        description: input.description?.trim(),
        projectId,
        date: input.date,
        endDate: normalizeCalendarEndDate(input.date, input.endDate),
        time: input.time,
        endTime: input.endTime,
        completed: status === 'completed',
        status,
        createdAt: new Date().toISOString(),
        priority: input.priority ?? 'low',
        taskType: input.taskType ?? 'assignment',
        reminders: input.reminders ?? []
      }

      return {
        next: {
          calendarTasks: [...settings.calendarTasks, task],
          tasks: [...settings.calendarTasks, task]
        },
        result: task
      }
    })
  }

  private async calendarTaskUpdate(
    input: z.infer<typeof calendarTaskUpdateSchema>
  ): Promise<CalendarTask> {
    return this.runtime.mutateSettings(async (settings) => {
      const task = resolveCalendarTask(settings, input.taskId, input.titleMatch)
      const nextDate = input.date === undefined ? task.date : (input.date ?? undefined)
      const nextEndDate =
        input.endDate === undefined
          ? task.endDate
          : input.endDate === null
            ? undefined
            : input.endDate

      const updated: CalendarTask = {
        ...task,
        title: input.title?.trim() || task.title,
        description:
          input.description === undefined ? task.description : input.description.trim(),
        projectId:
          input.projectId === undefined ? task.projectId : input.projectId ?? undefined,
        date: nextDate,
        endDate: normalizeCalendarEndDate(nextDate, nextEndDate),
        time: input.time === undefined ? task.time : (input.time ?? undefined),
        endTime: input.endTime === undefined ? task.endTime : (input.endTime ?? undefined),
        priority: input.priority ?? task.priority,
        taskType: input.taskType === undefined ? task.taskType : (input.taskType ?? undefined),
        reminders: input.reminders ?? task.reminders,
        completed:
          input.status !== undefined
            ? input.status === 'completed'
            : input.completed ?? task.completed,
        status:
          input.status ??
          (input.completed !== undefined
            ? input.completed
              ? 'completed'
              : 'pending'
            : task.status ?? (task.completed ? 'completed' : 'pending'))
      }

      return {
        next: {
          calendarTasks: settings.calendarTasks.map((item) => item.id === task.id ? updated : item),
          tasks: settings.calendarTasks.map((item) => item.id === task.id ? updated : item)
        },
        result: updated
      }
    })
  }

  private async weeklyPlanCreateWeek(
    input: z.infer<typeof weeklyPlanCreateWeekSchema>
  ): Promise<WeeklyPlanWeek> {
    const state = await this.weeklyPlanService.createWeek(input)
    const week = state.weeks.find((item) => item.startDate === input.startDate)
    if (!week) {
      throw new Error(`Week not found after creation: ${input.startDate}`)
    }
    return week
  }

  private async weeklyPlanCreatePriority(
    input: z.infer<typeof weeklyPlanCreatePrioritySchema>
  ): Promise<WeeklyPlanPriority> {
    const week = await this.resolveWeek(input.weekId, input.weekStartDate)
    const state = await this.weeklyPlanService.addPriority({
      weekId: week.id,
      title: input.title,
      linkedProjectId: input.linkedProjectId,
      linkedTaskId: input.linkedTaskId
    })
    const match = findNewestByWeek(state.priorities, week.id)
    if (!match) {
      throw new Error(`Priority not found after creation for week ${week.id}`)
    }
    return match
  }

  private async weeklyPlanUpsertReview(
    input: z.infer<typeof weeklyPlanUpsertReviewSchema>
  ): Promise<WeeklyPlanReview> {
    const week = await this.resolveWeek(input.weekId, input.weekStartDate)
    const state = await this.weeklyPlanService.upsertReview({
      weekId: week.id,
      reviewId: input.reviewId,
      wins: input.wins,
      misses: input.misses,
      blockers: input.blockers,
      nextWeek: input.nextWeek
    })

    const match = input.reviewId
      ? state.reviews.find((item) => item.id === input.reviewId)
      : findNewestByWeek(state.reviews, week.id)

    if (!match) {
      throw new Error(`Review not found after upsert for week ${week.id}`)
    }

    return match
  }

  private async resolveWeek(weekId?: string, weekStartDate?: string): Promise<WeeklyPlanWeek> {
    const state = await this.weeklyPlanService.getState()
    if (weekId) {
      const byId = state.weeks.find((item) => item.id === weekId)
      if (!byId) {
        throw new Error(`Week not found: ${weekId}`)
      }
      return byId
    }

    const byStartDate = state.weeks.find((item) => item.startDate === weekStartDate)
    if (!byStartDate) {
      throw new Error(`Week not found for start date: ${weekStartDate}`)
    }
    return byStartDate
  }
}

function buildProjectName(projects: Project[], proposedName?: string): string {
  const normalized = proposedName?.trim()
  if (normalized) {
    return normalized
  }

  const baseName = 'Untitled Project'
  const existingNames = new Set(projects.map((project) => project.name.toLowerCase()))
  let nextName = baseName
  let suffix = 2
  while (existingNames.has(nextName.toLowerCase())) {
    nextName = `${baseName} ${suffix}`
    suffix += 1
  }
  return nextName
}

function resolveProject(settings: AppSettings, projectId?: string, projectName?: string): Project {
  if (projectId) {
    const match = settings.projects.find((item) => item.id === projectId)
    if (!match) {
      throw new Error(`Project not found: ${projectId}`)
    }
    return match
  }

  const normalizedName = projectName!.trim().toLowerCase()
  const matches = settings.projects.filter(
    (item) => item.name.trim().toLowerCase() === normalizedName
  )
  if (matches.length === 1) {
    return matches[0]
  }
  if (matches.length > 1) {
    throw new Error(`Multiple projects matched name: ${projectName}`)
  }
  throw new Error(`Project not found: ${projectName}`)
}

function resolveCalendarTask(
  settings: AppSettings,
  taskId?: string,
  titleMatch?: string
): CalendarTask {
  const tasks = settings.tasks ?? settings.calendarTasks
  if (taskId) {
    const match = tasks.find((item) => item.id === taskId)
    if (!match) {
      throw new Error(`Calendar task not found: ${taskId}`)
    }
    return match
  }

  const normalizedTitle = titleMatch!.trim().toLowerCase()
  const matches = tasks.filter(
    (item) => item.title.trim().toLowerCase() === normalizedTitle
  )
  if (matches.length === 1) {
    return matches[0]
  }
  if (matches.length > 1) {
    throw new Error(`Multiple calendar tasks matched title: ${titleMatch}`)
  }
  throw new Error(`Calendar task not found: ${titleMatch}`)
}

function normalizeCalendarEndDate(date?: string, endDate?: string): string | undefined {
  if (!date || !endDate) {
    return undefined
  }
  return endDate >= date ? endDate : date
}

function findNewestByWeek<T extends { weekId: string; createdAt: string; updatedAt: string }>(
  items: T[],
  weekId: string
): T | undefined {
  return items
    .filter((item) => item.weekId === weekId)
    .sort(
      (a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt)
    )[0]
}
