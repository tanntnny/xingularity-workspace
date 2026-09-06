import { RRule } from 'rrule'
import { isTaskDone } from './taskStatus'
import { isDateOnly, isIanaTimezone, isLocalTime, normalizeRecurrenceRule } from './timeSemantics'
import type { CalendarTask, TaskRecurrence, TaskRecurrenceDraft } from './types'

export const DEFAULT_TASK_RECURRENCE_HORIZON = 6
export const MAX_TASK_RECURRENCE_HORIZON = 52

export interface TaskRecurrenceOccurrence {
  date?: string
  endDate?: string
  time?: string
  endTime?: string
  key: string
}

export interface TaskRecurrenceReconcileOptions {
  now?: Date
  createTaskId: () => string
  createReminderId?: (sourceReminderId: string, index: number) => string
}

export function normalizeTaskRecurrenceDraft(
  draft: TaskRecurrenceDraft
): Required<TaskRecurrenceDraft> {
  const ruleInput = draft.rrule.trim().replace(/^RRULE:/i, '')
  if (!ruleInput) {
    throw new Error('Enter an RRULE recurrence rule')
  }

  const rrule = normalizeRecurrenceRule(ruleInput)
  try {
    RRule.fromString(rrule)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid recurrence rule'
    throw new Error(`Invalid recurrence rule: ${message}`)
  }

  const horizon = draft.horizon ?? DEFAULT_TASK_RECURRENCE_HORIZON
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > MAX_TASK_RECURRENCE_HORIZON) {
    throw new Error(
      `Recurrence horizon must be an integer between 1 and ${MAX_TASK_RECURRENCE_HORIZON}`
    )
  }

  const timezone = draft.timezone?.trim() || getLocalTimezone()
  if (!isIanaTimezone(timezone)) {
    throw new Error(`Invalid recurrence timezone: ${timezone}`)
  }

  return { rrule, horizon, timezone }
}

export function initializeTaskRecurrence(
  task: CalendarTask,
  draft: TaskRecurrenceDraft
): CalendarTask {
  const normalized = normalizeTaskRecurrenceDraft(draft)
  const scheduledDate = getTaskScheduleDate(task)
  if (!scheduledDate) {
    throw new Error('Repeating tasks need a start date or due date')
  }
  if (!isDateOnly(scheduledDate)) {
    throw new Error('Repeating tasks need a valid date')
  }

  const previous = task.recurrence
  const seriesId = previous?.seriesId ?? `series-${task.id}`
  const occurrenceKey = getTaskOccurrenceKey(task)

  return {
    ...task,
    recurrence: {
      seriesId,
      anchorTaskId: task.id,
      occurrenceKey,
      rrule: normalized.rrule,
      horizon: normalized.horizon,
      timezone: normalized.timezone,
      generated: false,
      overridden: false,
      excludedOccurrenceKeys:
        previous?.rrule === normalized.rrule && previous.occurrenceKey === occurrenceKey
          ? previous.excludedOccurrenceKeys
          : undefined
    }
  }
}

export function getTaskRecurrenceOccurrences(
  task: CalendarTask,
  recurrence: TaskRecurrence,
  now = new Date(),
  horizon = recurrence.horizon
): TaskRecurrenceOccurrence[] {
  const scheduledDate = getTaskScheduleDate(task)
  if (!scheduledDate || !isDateOnly(scheduledDate)) {
    return []
  }

  let rule: RRule
  try {
    rule = createRule(task, recurrence.rrule)
  } catch {
    return []
  }
  const anchorDate = toWallDate(scheduledDate, task.time)
  const nowDate = toLocalWallDate(now)
  let cursor = nowDate > anchorDate ? nowDate : anchorDate
  const excluded = new Set(recurrence.excludedOccurrenceKeys ?? [])
  const occurrences: TaskRecurrenceOccurrence[] = []
  const seen = new Set<string>()

  for (let attempts = 0; attempts < MAX_TASK_RECURRENCE_HORIZON * 20; attempts += 1) {
    const next = rule.after(cursor, false)
    if (!next) {
      break
    }

    cursor = next
    const occurrence = buildOccurrence(task, next)
    if (seen.has(occurrence.key)) {
      continue
    }
    seen.add(occurrence.key)
    if (!excluded.has(occurrence.key)) {
      occurrences.push(occurrence)
    }
    if (occurrences.length >= horizon) {
      break
    }
  }

  return occurrences
}

export function reconcileTaskRecurrences(
  previousTasks: CalendarTask[],
  requestedTasks: CalendarTask[],
  options: TaskRecurrenceReconcileOptions
): CalendarTask[] {
  const now = options.now ?? new Date()
  const tasks: CalendarTask[] = requestedTasks.map((task) => ({
    ...task,
    recurrence: task.recurrence
      ? {
          ...task.recurrence,
          excludedOccurrenceKeys: task.recurrence.excludedOccurrenceKeys
            ? [...task.recurrence.excludedOccurrenceKeys]
            : undefined
        }
      : undefined
  }))
  const nextById = new Map(tasks.map((task) => [task.id, task]))

  for (const previousTask of previousTasks) {
    const previousRecurrence = previousTask.recurrence
    if (!previousRecurrence?.generated) {
      continue
    }

    const nextTask = nextById.get(previousTask.id)
    const anchor = nextById.get(previousRecurrence.anchorTaskId)
    if (!nextTask) {
      if (anchor?.recurrence && anchor.recurrence.seriesId === previousRecurrence.seriesId) {
        anchor.recurrence = addExcludedOccurrence(
          anchor.recurrence,
          previousRecurrence.occurrenceKey
        )
      }
      continue
    }

    if (nextTask.recurrence && hasTaskChangedOutsideRecurrence(previousTask, nextTask)) {
      nextTask.recurrence = { ...nextTask.recurrence, overridden: true }
    }
  }

  for (const previousTask of previousTasks) {
    const previousRecurrence = previousTask.recurrence
    if (!previousRecurrence || previousRecurrence.generated) {
      continue
    }

    const nextAnchor = nextById.get(previousTask.id)
    const stillActive =
      nextAnchor?.recurrence &&
      !nextAnchor.recurrence.generated &&
      nextAnchor.recurrence.anchorTaskId === nextAnchor.id
    if (stillActive) {
      continue
    }

    for (const task of tasks) {
      if (task.recurrence?.generated && task.recurrence.seriesId === previousRecurrence.seriesId) {
        task.recurrence = undefined
      }
    }
  }

  const removedIds = new Set<string>()
  const activeAnchors = tasks.filter((task) =>
    Boolean(
      task.recurrence && !task.recurrence.generated && task.recurrence.anchorTaskId === task.id
    )
  )

  for (const anchor of activeAnchors) {
    const recurrence = anchor.recurrence
    if (!recurrence || recurrence.generated || recurrence.anchorTaskId !== anchor.id) {
      continue
    }
    if (!getTaskScheduleDate(anchor)) {
      for (const task of tasks) {
        if (task.recurrence?.generated && task.recurrence.seriesId === recurrence.seriesId) {
          task.recurrence = undefined
        }
      }
      anchor.recurrence = undefined
      continue
    }
    anchor.recurrence = {
      ...recurrence,
      occurrenceKey: getTaskOccurrenceKey(anchor)
    }
    const seriesTasks = tasks.filter(
      (task) => task.recurrence?.generated && task.recurrence.seriesId === recurrence.seriesId
    )
    const futureConsumedCount = seriesTasks.filter(
      (task) =>
        !isPastTaskOccurrence(task, now) &&
        (isTaskDone(task) || task.recurrence?.overridden === true)
    ).length
    const expected = getTaskRecurrenceOccurrences(
      anchor,
      recurrence,
      now,
      recurrence.horizon + futureConsumedCount
    )
    const expectedByKey = new Map(expected.map((occurrence) => [occurrence.key, occurrence]))

    for (const task of seriesTasks) {
      const taskRecurrence = task.recurrence
      if (!taskRecurrence) {
        continue
      }
      const occurrence = expectedByKey.get(taskRecurrence.occurrenceKey)
      const canReconcile = !taskRecurrence.overridden && !isTaskDone(task)

      if (
        canReconcile &&
        recurrence.excludedOccurrenceKeys?.includes(taskRecurrence.occurrenceKey) &&
        !isPastTaskOccurrence(task, now)
      ) {
        removedIds.add(task.id)
        continue
      }

      if (canReconcile && occurrence) {
        Object.assign(task, buildGeneratedTaskPatch(task, anchor, occurrence, recurrence, options))
        continue
      }

      if (canReconcile && !occurrence && !isPastTaskOccurrence(task, now)) {
        removedIds.add(task.id)
      }
    }

    const existingKeys = new Set(
      seriesTasks
        .filter((task) => !removedIds.has(task.id))
        .map((task) => task.recurrence?.occurrenceKey)
        .filter((key): key is string => Boolean(key))
    )
    for (const occurrence of expected) {
      if (existingKeys.has(occurrence.key)) {
        continue
      }
      tasks.push(createGeneratedTask(anchor, occurrence, recurrence, options))
      existingKeys.add(occurrence.key)
    }
  }

  return tasks.filter((task) => !removedIds.has(task.id))
}

function createGeneratedTask(
  anchor: CalendarTask,
  occurrence: TaskRecurrenceOccurrence,
  recurrence: TaskRecurrence,
  options: TaskRecurrenceReconcileOptions
): CalendarTask {
  const now = (options.now ?? new Date()).toISOString()
  return {
    ...anchor,
    id: options.createTaskId(),
    date: occurrence.date,
    endDate: occurrence.endDate,
    time: occurrence.time,
    endTime: occurrence.endTime,
    completed: false,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    automationSource: undefined,
    automationSourceKey: undefined,
    reminders: anchor.reminders.map((reminder, index) => ({
      ...reminder,
      id: options.createReminderId?.(reminder.id, index) ?? reminder.id
    })),
    recurrence: {
      seriesId: recurrence.seriesId,
      anchorTaskId: recurrence.anchorTaskId,
      occurrenceKey: occurrence.key,
      rrule: recurrence.rrule,
      horizon: recurrence.horizon,
      timezone: recurrence.timezone,
      generated: true,
      overridden: false
    }
  }
}

function buildGeneratedTaskPatch(
  task: CalendarTask,
  anchor: CalendarTask,
  occurrence: TaskRecurrenceOccurrence,
  recurrence: TaskRecurrence,
  options: TaskRecurrenceReconcileOptions
): Partial<CalendarTask> {
  return {
    title: anchor.title,
    description: anchor.description,
    projectId: anchor.projectId,
    milestoneId: anchor.milestoneId,
    tags: [...anchor.tags],
    priority: anchor.priority,
    taskType: anchor.taskType,
    weeklyHeightMode: anchor.weeklyHeightMode,
    dependencyIds: anchor.dependencyIds ? [...anchor.dependencyIds] : undefined,
    parentTaskId: anchor.parentTaskId,
    estimateMinutes: anchor.estimateMinutes,
    date: occurrence.date,
    endDate: occurrence.endDate,
    time: occurrence.time,
    endTime: occurrence.endTime,
    reminders: anchor.reminders.map((reminder, index) => ({
      ...reminder,
      id: task.reminders[index]?.id ?? options.createReminderId?.(reminder.id, index) ?? reminder.id
    })),
    recurrence: {
      seriesId: recurrence.seriesId,
      anchorTaskId: recurrence.anchorTaskId,
      occurrenceKey: occurrence.key,
      rrule: recurrence.rrule,
      horizon: recurrence.horizon,
      timezone: recurrence.timezone,
      generated: true,
      overridden: task.recurrence?.overridden ?? false
    }
  }
}

function createRule(task: CalendarTask, rrule: string): RRule {
  const options = RRule.parseString(rrule)
  return new RRule({ ...options, dtstart: toWallDate(getTaskScheduleDate(task)!, task.time) })
}

function buildOccurrence(task: CalendarTask, date: Date): TaskRecurrenceOccurrence {
  const nextDate = toIsoDate(date)
  const durationDays = task.date && task.endDate ? differenceInIsoDays(task.date, task.endDate) : 0
  const endDate = task.date
    ? task.endDate
      ? addIsoDays(nextDate, durationDays)
      : undefined
    : nextDate

  return {
    date: task.date ? nextDate : undefined,
    endDate,
    time: task.time,
    endTime: task.endTime,
    key: getOccurrenceKey(nextDate, task.time)
  }
}

function getTaskScheduleDate(task: CalendarTask): string | undefined {
  return task.date ?? task.endDate
}

function getTaskOccurrenceKey(task: CalendarTask): string {
  const scheduledDate = getTaskScheduleDate(task)
  if (!scheduledDate) {
    throw new Error('Repeating tasks need a start date or due date')
  }
  return getOccurrenceKey(scheduledDate, task.time)
}

function getOccurrenceKey(date: string, time?: string): string {
  return `${date}T${time ?? '00:00'}`
}

function addExcludedOccurrence(recurrence: TaskRecurrence, occurrenceKey: string): TaskRecurrence {
  const excluded = new Set(recurrence.excludedOccurrenceKeys ?? [])
  excluded.add(occurrenceKey)
  return { ...recurrence, excludedOccurrenceKeys: Array.from(excluded).sort() }
}

function hasTaskChangedOutsideRecurrence(previous: CalendarTask, next: CalendarTask): boolean {
  const previousData = { ...previous }
  const nextData = { ...next }
  delete previousData.recurrence
  delete previousData.updatedAt
  delete nextData.recurrence
  delete nextData.updatedAt
  return JSON.stringify(previousData) !== JSON.stringify(nextData)
}

function isPastTaskOccurrence(task: CalendarTask, now: Date): boolean {
  const scheduledDate = getTaskScheduleDate(task)
  if (!scheduledDate) {
    return false
  }
  return toWallDate(scheduledDate, task.time) < toLocalWallDate(now)
}

function toWallDate(date: string, time?: string): Date {
  if (!isDateOnly(date)) {
    throw new Error(`Invalid task recurrence date: ${date}`)
  }
  if (time !== undefined && !isLocalTime(time)) {
    throw new Error(`Invalid task recurrence time: ${time}`)
  }
  const [year, month, day] = date.split('-').map(Number)
  const [hours, minutes] = (time ?? '00:00').split(':').map(Number)
  return new Date(Date.UTC(year, month - 1, day, hours, minutes))
}

function toLocalWallDate(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds()
    )
  )
}

function toIsoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate()
  ).padStart(2, '0')}`
}

function differenceInIsoDays(start: string, end: string): number {
  const startDate = toWallDate(start)
  const endDate = toWallDate(end)
  return Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000)
}

function addIsoDays(date: string, days: number): string {
  const next = toWallDate(date)
  next.setUTCDate(next.getUTCDate() + days)
  return toIsoDate(next)
}

function getLocalTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}
