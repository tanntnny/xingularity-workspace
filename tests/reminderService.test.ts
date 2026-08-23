import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => []
  },
  Notification: class Notification {}
}))

import {
  buildReminderClickTarget,
  calculateReminderTime,
  getReminderIdentity,
  parseTaskDateTime,
  ReminderService
} from '../src/main/reminderService'
import type { CalendarTask } from '../src/shared/types'

function createTask(overrides: Partial<CalendarTask> = {}): CalendarTask {
  return {
    id: 'task-1',
    title: 'Prepare review',
    tags: [],
    date: '2026-08-17',
    completed: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    priority: 'medium',
    reminders: [{ id: 'reminder-1', type: 'minutes', value: 30, enabled: true }],
    ...overrides
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('ReminderService', () => {
  it('reconciles and cancels stale schedules when a task is completed or removed', () => {
    const service = new ReminderService({
      autoStart: false,
      now: () => new Date('2026-08-17T09:00:00')
    })
    const task = createTask({ time: '10:00' })

    service.updateTasks([task])
    expect(service.getScheduledReminders()).toHaveLength(1)

    service.updateTasks([{ ...task, completed: true }])
    expect(service.getScheduledReminders()).toHaveLength(0)

    service.updateTasks([{ ...task, status: 'canceled' }])
    expect(service.getScheduledReminders()).toHaveLength(0)

    service.updateTasks([task])
    expect(service.getScheduledReminders()).toHaveLength(1)
    service.updateTasks([])
    expect(service.getScheduledReminders()).toHaveLength(0)
  })

  it('reschedules an edited reminder and ignores the old timer identity', () => {
    vi.useFakeTimers()
    const now = new Date('2026-08-17T09:00:00')
    const notifications: string[] = []
    const service = new ReminderService({
      autoStart: false,
      now: () => new Date(now),
      createNotification: (options) => ({
        on: () => undefined,
        show: () => notifications.push(options.title)
      })
    })
    const task = createTask({ time: '10:00' })

    service.updateTasks([task])
    const first = service.getScheduledReminders()[0]
    service.updateTasks([{ ...task, time: '11:00' }])
    const second = service.getScheduledReminders()[0]

    expect(first.reminderTime.getHours()).toBe(9)
    expect(first.reminderTime.getMinutes()).toBe(30)
    expect(second.reminderTime.getHours()).toBe(10)
    expect(second.reminderTime.getMinutes()).toBe(30)
    expect(second.identity).not.toBe(first.identity)

    now.setTime(new Date('2026-08-17T10:30:00').getTime())
    vi.advanceTimersByTime(90 * 60 * 1000)
    expect(notifications).toEqual(['Task Reminder: Prepare review'])
  })

  it('fires a missed reminder once by explicit identity and exposes a safe click target', () => {
    const clickHandlers: Array<() => void> = []
    const clicked: unknown[] = []
    const focused = vi.fn()
    const notifications: string[] = []
    const now = new Date('2026-08-17T08:32:00')
    const service = new ReminderService({
      autoStart: false,
      now: () => new Date(now),
      getWindows: () => [
        {
          isMinimized: () => false,
          restore: vi.fn(),
          focus: focused
        }
      ],
      onReminderClick: (target) => clicked.push(target),
      createNotification: (options) => ({
        on: (_event, listener) => clickHandlers.push(listener),
        show: () => notifications.push(options.body)
      })
    })
    const task = createTask({ time: '09:00' })

    service.updateTasks([task])
    service.reconcile()
    clickHandlers[0]?.()

    expect(notifications).toHaveLength(1)
    expect(service.getFiredReminderIdentities()).toEqual([
      getReminderIdentity('task-1', 'reminder-1', new Date('2026-08-17T08:30:00'))
    ])
    expect(clicked).toEqual([
      {
        page: 'calendar',
        taskId: 'task-1',
        selectedDate: '2026-08-17',
        view: 'month'
      }
    ])
    expect(JSON.stringify(clicked)).not.toContain('attachments')
    expect(focused).toHaveBeenCalledTimes(1)

    service.reconcile()
    expect(notifications).toHaveLength(1)
  })

  it('stops inactive-vault schedules and restores fired identities per vault scope', () => {
    vi.useFakeTimers()
    const now = new Date('2026-08-17T08:00:00')
    const notifications: string[] = []
    const service = new ReminderService({
      autoStart: false,
      now: () => new Date(now),
      createNotification: () => ({
        on: () => undefined,
        show: () => notifications.push('reminder')
      })
    })
    const task = createTask({ time: '09:00' })

    service.setScope('/vault-a')
    service.updateTasks([task])
    expect(service.getScheduledReminders()).toHaveLength(1)
    now.setTime(new Date('2026-08-17T08:32:00').getTime())
    service.reconcile()
    expect(notifications).toHaveLength(1)
    service.setScope(null)
    expect(service.getScheduledReminders()).toHaveLength(0)
    service.setScope('/vault-a')
    service.updateTasks([task])
    expect(service.getScheduledReminders()).toHaveLength(0)
    expect(notifications).toHaveLength(1)
  })

  it('rejects invalid dates and constructs deterministic local reminder helpers', () => {
    expect(parseTaskDateTime('2026-02-29', '10:00')).toBeNull()
    expect(parseTaskDateTime('2026-08-17', '24:00')).toBeNull()
    expect(parseTaskDateTime('2026-08-17')?.getHours()).toBe(9)

    const taskDateTime = parseTaskDateTime('2026-08-17', '10:00')!
    const reminderTime = calculateReminderTime(taskDateTime, {
      id: 'reminder-1',
      type: 'hours',
      value: 2,
      enabled: true
    })
    expect(reminderTime?.getHours()).toBe(8)
    expect(buildReminderClickTarget(createTask())).toEqual({
      page: 'calendar',
      taskId: 'task-1',
      selectedDate: '2026-08-17',
      view: 'month'
    })
  })
})
