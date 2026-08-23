import { BrowserWindow, Notification } from 'electron'
import { CalendarTask, ReminderClickTarget, TaskReminder } from '../shared/types'
import { isTaskDone } from '../shared/taskStatus'

const DEFAULT_LOOK_AHEAD_MS = 24 * 60 * 60 * 1000
const DEFAULT_MISSED_REMINDER_WINDOW_MS = 5 * 60 * 1000
const REMINDER_CHECK_INTERVAL_MS = 60 * 1000

type TimerHandle = ReturnType<typeof setTimeout>

export interface ReminderScheduleSnapshot {
  key: string
  identity: string
  taskId: string
  reminderId: string
  taskTitle: string
  reminderTime: Date
  target: ReminderClickTarget
}

interface ReminderNotification {
  on(event: 'click', listener: () => void): unknown
  show(): void
}

interface ReminderWindow {
  isMinimized(): boolean
  restore(): void
  focus(): void
}

export interface ReminderServiceOptions {
  now?: () => Date
  setTimeout?: typeof setTimeout
  clearTimeout?: typeof clearTimeout
  setInterval?: typeof setInterval
  clearInterval?: typeof clearInterval
  createNotification?: (options: {
    title: string
    body: string
    silent: boolean
    urgency: 'normal'
  }) => ReminderNotification
  getWindows?: () => readonly ReminderWindow[]
  onReminderClick?: (target: ReminderClickTarget) => void
  autoStart?: boolean
  lookAheadMs?: number
  missedReminderWindowMs?: number
}

interface ReminderDefinition extends ReminderScheduleSnapshot {
  taskDateTime: Date
  reminder: TaskReminder
}

interface ScheduledReminder extends ReminderDefinition {
  timeoutId: TimerHandle
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const LOCAL_TIME_PATTERN = /^(\d{2}):(\d{2})$/

export function isValidDateOnly(value: string): boolean {
  const match = DATE_ONLY_PATTERN.exec(value)
  if (!match) {
    return false
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false
  }

  const probe = new Date(0)
  probe.setFullYear(year, month - 1, day)
  return probe.getFullYear() === year && probe.getMonth() === month - 1 && probe.getDate() === day
}

export function parseTaskDateTime(date: string, time?: string): Date | null {
  const dateMatch = DATE_ONLY_PATTERN.exec(date)
  if (!dateMatch || !isValidDateOnly(date)) {
    return null
  }

  let hours = 9
  let minutes = 0
  if (time !== undefined) {
    const timeMatch = LOCAL_TIME_PATTERN.exec(time)
    if (!timeMatch) {
      return null
    }
    hours = Number(timeMatch[1])
    minutes = Number(timeMatch[2])
    if (hours > 23 || minutes > 59) {
      return null
    }
  }

  const parsed = new Date(0)
  parsed.setFullYear(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]))
  parsed.setHours(hours, minutes, 0, 0)

  // Reject dates normalized by the runtime, including nonexistent DST wall times.
  if (
    parsed.getFullYear() !== Number(dateMatch[1]) ||
    parsed.getMonth() !== Number(dateMatch[2]) - 1 ||
    parsed.getDate() !== Number(dateMatch[3]) ||
    parsed.getHours() !== hours ||
    parsed.getMinutes() !== minutes
  ) {
    return null
  }

  return parsed
}

export function calculateReminderTime(taskDateTime: Date, reminder: TaskReminder): Date | null {
  if (
    !Number.isInteger(reminder.value) ||
    reminder.value <= 0 ||
    !Number.isFinite(taskDateTime.getTime())
  ) {
    return null
  }

  const reminderTime = new Date(taskDateTime)
  switch (reminder.type) {
    case 'minutes':
      reminderTime.setMinutes(reminderTime.getMinutes() - reminder.value)
      break
    case 'hours':
      reminderTime.setHours(reminderTime.getHours() - reminder.value)
      break
    case 'days':
      reminderTime.setDate(reminderTime.getDate() - reminder.value)
      break
    default:
      return null
  }

  return Number.isFinite(reminderTime.getTime()) ? reminderTime : null
}

export function getReminderKey(taskId: string, reminderId: string): string {
  return `${encodeURIComponent(taskId)}:${encodeURIComponent(reminderId)}`
}

export function getReminderIdentity(
  taskId: string,
  reminderId: string,
  reminderTime: Date
): string {
  return `${getReminderKey(taskId, reminderId)}:${reminderTime.toISOString()}`
}

export function buildReminderClickTarget(
  task: Pick<CalendarTask, 'id' | 'date' | 'endDate'>
): ReminderClickTarget | null {
  const selectedDate = task.date ?? task.endDate
  if (!task.id || !selectedDate || !isValidDateOnly(selectedDate)) {
    return null
  }

  return {
    page: 'calendar',
    taskId: task.id,
    selectedDate,
    view: 'month'
  }
}

export function formatReminderText(reminder: TaskReminder): string {
  const unit = reminder.type === 'minutes' ? 'minute' : reminder.type === 'hours' ? 'hour' : 'day'
  const plural = reminder.value !== 1 ? 's' : ''
  return `Reminder: ${reminder.value} ${unit}${plural} before`
}

function cloneSnapshot(reminder: ReminderScheduleSnapshot): ReminderScheduleSnapshot {
  return {
    ...reminder,
    reminderTime: new Date(reminder.reminderTime),
    target: { ...reminder.target }
  }
}

export class ReminderService {
  private readonly now: () => Date
  private readonly scheduleTimeout: typeof setTimeout
  private readonly cancelTimeout: typeof clearTimeout
  private readonly scheduleInterval: typeof setInterval
  private readonly cancelInterval: typeof clearInterval
  private readonly createNotification: NonNullable<ReminderServiceOptions['createNotification']>
  private readonly getWindows: () => readonly ReminderWindow[]
  private readonly lookAheadMs: number
  private readonly missedReminderWindowMs: number
  private onReminderClick: ((target: ReminderClickTarget) => void) | null
  private scheduledReminders: Map<string, ScheduledReminder> = new Map()
  private desiredReminders: Map<string, ReminderDefinition> = new Map()
  private firedReminderIdentities: Set<string> = new Set()
  private readonly firedReminderIdentitiesByScope = new Map<string, Set<string>>()
  private reminderScope: string | null = '__default__'
  private tasks: CalendarTask[] = []
  private checkInterval: ReturnType<typeof setInterval> | null = null

  constructor(options: ReminderServiceOptions = {}) {
    this.now = options.now ?? (() => new Date())
    this.scheduleTimeout = options.setTimeout ?? setTimeout
    this.cancelTimeout = options.clearTimeout ?? clearTimeout
    this.scheduleInterval = options.setInterval ?? setInterval
    this.cancelInterval = options.clearInterval ?? clearInterval
    this.createNotification =
      options.createNotification ?? ((notificationOptions) => new Notification(notificationOptions))
    this.getWindows = options.getWindows ?? (() => BrowserWindow.getAllWindows())
    this.onReminderClick = options.onReminderClick ?? null
    this.lookAheadMs = options.lookAheadMs ?? DEFAULT_LOOK_AHEAD_MS
    this.missedReminderWindowMs =
      options.missedReminderWindowMs ?? DEFAULT_MISSED_REMINDER_WINDOW_MS

    if (!Number.isFinite(this.lookAheadMs) || this.lookAheadMs <= 0) {
      throw new Error('Reminder look-ahead must be positive')
    }
    if (!Number.isFinite(this.missedReminderWindowMs) || this.missedReminderWindowMs < 0) {
      throw new Error('Missed reminder window cannot be negative')
    }

    if (options.autoStart !== false) {
      this.startReminderCheck()
    }
  }

  updateTasks(tasks: CalendarTask[]): void {
    if (this.reminderScope === null) {
      return
    }
    this.tasks = [...tasks]
    this.reconcile()
  }

  setScope(scope: string | null): void {
    if (scope === this.reminderScope) {
      return
    }

    this.stop()
    if (this.reminderScope !== null) {
      this.firedReminderIdentitiesByScope.set(
        this.reminderScope,
        new Set(this.firedReminderIdentities)
      )
    }
    this.reminderScope = scope
    this.firedReminderIdentities = scope
      ? new Set(this.firedReminderIdentitiesByScope.get(scope) ?? [])
      : new Set()
    this.tasks = []
    this.desiredReminders.clear()
  }

  setReminderClickHandler(handler: ((target: ReminderClickTarget) => void) | null): void {
    this.onReminderClick = handler
  }

  start(): void {
    this.startReminderCheck()
    this.reconcile()
  }

  stop(): void {
    if (this.checkInterval) {
      this.cancelInterval(this.checkInterval)
      this.checkInterval = null
    }

    for (const reminder of this.scheduledReminders.values()) {
      this.cancelTimeout(reminder.timeoutId)
    }
    this.scheduledReminders.clear()
    this.desiredReminders.clear()
  }

  reconcile(now: Date = this.now()): ReminderScheduleSnapshot[] {
    const currentTime = now.getTime()
    if (!Number.isFinite(currentTime)) {
      return this.getScheduledReminders()
    }

    const desired = this.buildDesiredReminders()
    this.desiredReminders = desired
    const desiredIdentities = new Set([...desired.values()].map((reminder) => reminder.identity))
    for (const identity of this.firedReminderIdentities) {
      if (!desiredIdentities.has(identity)) {
        this.firedReminderIdentities.delete(identity)
      }
    }

    for (const [key, scheduled] of this.scheduledReminders) {
      const next = desired.get(key)
      if (!next || next.identity !== scheduled.identity) {
        this.cancelTimeout(scheduled.timeoutId)
        this.scheduledReminders.delete(key)
      }
    }

    for (const [key, reminder] of desired) {
      const reminderTime = reminder.reminderTime.getTime()
      const existing = this.scheduledReminders.get(key)

      if (reminderTime <= currentTime) {
        if (existing) {
          this.cancelTimeout(existing.timeoutId)
          this.scheduledReminders.delete(key)
        }

        const age = currentTime - reminderTime
        if (
          age <= this.missedReminderWindowMs &&
          !this.firedReminderIdentities.has(reminder.identity)
        ) {
          this.fireIfNeeded(reminder)
        }
        continue
      }

      const delay = reminderTime - currentTime
      if (delay > this.lookAheadMs) {
        if (existing) {
          this.cancelTimeout(existing.timeoutId)
          this.scheduledReminders.delete(key)
        }
        continue
      }

      if (existing && existing.identity === reminder.identity) {
        continue
      }

      if (existing) {
        this.cancelTimeout(existing.timeoutId)
      }

      const timeoutId = this.scheduleTimeout(() => {
        this.fireScheduledReminder(key, reminder.identity)
      }, delay)
      this.scheduledReminders.set(key, { ...reminder, timeoutId })
    }

    return this.getScheduledReminders()
  }

  getScheduledReminders(): ReminderScheduleSnapshot[] {
    return [...this.scheduledReminders.values()]
      .sort((left, right) => left.key.localeCompare(right.key))
      .map(cloneSnapshot)
  }

  getFiredReminderIdentities(): string[] {
    return [...this.firedReminderIdentities].sort()
  }

  private startReminderCheck(): void {
    if (this.checkInterval) {
      return
    }

    this.checkInterval = this.scheduleInterval(() => {
      this.reconcile()
    }, REMINDER_CHECK_INTERVAL_MS)
  }

  private buildDesiredReminders(): Map<string, ReminderDefinition> {
    const desired = new Map<string, ReminderDefinition>()

    for (const task of this.tasks) {
      if (isTaskDone(task)) {
        continue
      }

      const taskDate = task.date ?? task.endDate
      if (!taskDate || task.reminders.length === 0) {
        continue
      }

      const taskDateTime = parseTaskDateTime(taskDate, task.time)
      const clickTarget = buildReminderClickTarget(task)
      if (!taskDateTime || !clickTarget) {
        continue
      }

      for (const reminder of task.reminders) {
        if (!reminder.enabled) {
          continue
        }

        const reminderTime = calculateReminderTime(taskDateTime, reminder)
        if (!reminderTime) {
          continue
        }

        const key = getReminderKey(task.id, reminder.id)
        desired.set(key, {
          key,
          identity: getReminderIdentity(task.id, reminder.id, reminderTime),
          taskId: task.id,
          reminderId: reminder.id,
          taskTitle: task.title,
          reminderTime,
          target: clickTarget,
          taskDateTime,
          reminder
        })
      }
    }

    return desired
  }

  private fireScheduledReminder(key: string, identity: string): void {
    const scheduled = this.scheduledReminders.get(key)
    if (!scheduled || scheduled.identity !== identity) {
      return
    }
    this.scheduledReminders.delete(key)

    const desired = this.desiredReminders.get(key)
    if (!desired || desired.identity !== identity) {
      return
    }

    const age = this.now().getTime() - desired.reminderTime.getTime()
    if (age < 0) {
      this.reconcile()
      return
    }
    if (age > this.missedReminderWindowMs || this.firedReminderIdentities.has(identity)) {
      return
    }

    this.fireIfNeeded(desired)
  }

  private fireIfNeeded(reminder: ReminderDefinition): void {
    if (this.firedReminderIdentities.has(reminder.identity)) {
      return
    }

    if (this.fireNotification(reminder)) {
      this.firedReminderIdentities.add(reminder.identity)
    }
  }

  private fireNotification(reminder: ReminderDefinition): boolean {
    const timeString = reminder.taskDateTime.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit'
    })
    const dateString = reminder.taskDateTime.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })

    try {
      const notification = this.createNotification({
        title: `Task Reminder: ${reminder.taskTitle}`,
        body: `${formatReminderText(reminder.reminder)}\nScheduled for ${dateString} at ${timeString}`,
        silent: false,
        urgency: 'normal'
      })

      notification.on('click', () => {
        this.handleNotificationClick(reminder.target)
      })
      notification.show()
      return true
    } catch (error) {
      console.error('[ReminderService] failed to show notification', error)
      return false
    }
  }

  private handleNotificationClick(target: ReminderClickTarget): void {
    try {
      this.onReminderClick?.({ ...target })
    } catch (error) {
      console.error('[ReminderService] reminder click handler failed', error)
    }

    for (const window of this.getWindows()) {
      if (window.isMinimized()) {
        window.restore()
      }
      window.focus()
    }
  }
}
