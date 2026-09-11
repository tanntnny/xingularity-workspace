import type {
  CalendarTask,
  CalendarTaskType,
  TaskPriority,
  TaskStatus
} from '../../../shared/types'
import type { CalendarContentFilter } from './calendarTasks'
import { getTaskStatus } from './taskStatus'

export type WorkspaceCalendarViewMode = 'month' | 'week' | 'day'

export type WorkspaceTaskOriginRequest =
  | { source: 'calendar' }
  | { source: 'tasks'; workspaceViewId?: string }
  | { source: 'projects'; projectId: string | null; milestoneId?: string }

export type WorkspaceTaskOrigin =
  | {
      source: 'calendar'
      selectedDate: string
      viewMode: WorkspaceCalendarViewMode
      contentFilter: CalendarContentFilter
      tags: string[]
    }
  | { source: 'tasks'; workspaceViewId?: string }
  | { source: 'projects'; projectId: string | null; milestoneId?: string }

export interface TaskEditDialogDraft {
  title: string
  description: string
  priority: TaskPriority
  taskType: CalendarTaskType
  status: TaskStatus
  projectId: string
  milestoneId: string
  tags: string[]
  date: string
  endDate: string
  time: string
  endTime: string
}

export interface TaskDialogSession {
  taskId: string
  isNewTask: boolean
  origin: WorkspaceTaskOriginRequest
  draft: TaskEditDialogDraft
}

export interface TaskPageSession {
  taskId: string
  origin: WorkspaceTaskOrigin
}

export function createTaskEditDialogDraft(
  task: CalendarTask,
  isNewTask = false
): TaskEditDialogDraft {
  return {
    title: isNewTask ? '' : task.title,
    description: task.description ?? '',
    priority: task.priority ?? 'low',
    taskType: task.taskType ?? 'assignment',
    status: getTaskStatus(task.status, task.completed),
    projectId: task.projectId ?? '',
    milestoneId: task.milestoneId ?? '',
    tags: [...(task.tags ?? [])],
    date: task.date ?? '',
    endDate: task.endDate ?? '',
    time: task.time ?? '',
    endTime: task.endTime ?? ''
  }
}
