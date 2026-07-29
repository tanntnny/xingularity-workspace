import type { CalendarTaskType } from '../../../shared/types'

export const CALENDAR_TASK_TYPE_BACKGROUND_TOKENS: Record<CalendarTaskType, string> = {
  meeting: 'var(--calendar-task-meeting-bg)',
  assignment: 'var(--calendar-task-assignment-bg)',
  review: 'var(--calendar-task-review-bg)',
  personal: 'var(--calendar-task-personal-bg)',
  call: 'var(--calendar-task-call-bg)',
  'deep-work': 'var(--calendar-task-deep-work-bg)',
  errand: 'var(--calendar-task-errand-bg)',
  'follow-up': 'var(--calendar-task-follow-up-bg)',
  other: 'var(--calendar-task-other-bg)'
}

export const CALENDAR_TASK_TYPE_BORDER_TOKENS: Record<CalendarTaskType, string> = {
  meeting: 'var(--calendar-task-meeting-border)',
  assignment: 'var(--calendar-task-assignment-border)',
  review: 'var(--calendar-task-review-border)',
  personal: 'var(--calendar-task-personal-border)',
  call: 'var(--calendar-task-call-border)',
  'deep-work': 'var(--calendar-task-deep-work-border)',
  errand: 'var(--calendar-task-errand-border)',
  'follow-up': 'var(--calendar-task-follow-up-border)',
  other: 'var(--calendar-task-other-border)'
}

export function getCalendarTaskBackgroundToken(taskType?: CalendarTaskType): string {
  const resolvedTaskType = taskType ?? 'assignment'
  return (
    CALENDAR_TASK_TYPE_BACKGROUND_TOKENS[resolvedTaskType] ??
    CALENDAR_TASK_TYPE_BACKGROUND_TOKENS.assignment
  )
}

export function getCalendarTaskBorderToken(taskType?: CalendarTaskType): string {
  const resolvedTaskType = taskType ?? 'assignment'
  return (
    CALENDAR_TASK_TYPE_BORDER_TOKENS[resolvedTaskType] ??
    CALENDAR_TASK_TYPE_BORDER_TOKENS.assignment
  )
}
