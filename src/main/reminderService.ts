import { Notification, BrowserWindow } from 'electron'
import { CalendarTask, TaskReminder } from '../shared/types'

interface ScheduledReminder {
  taskId: string
  reminderId: string
  taskTitle: string
  reminderTime: Date
  timeoutId: ReturnType<typeof setTimeout>
}

export class ReminderService {
  private scheduledReminders: Map<string, ScheduledReminder> = new Map()
  private tasks: CalendarTask[] = []
  private checkInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    // Start checking reminders every minute
    this.startReminderCheck()
  }

  /**
   * Update the task list and reschedule all reminders
   */
  updateTasks(tasks: CalendarTask[]): void {
    this.tasks = tasks
    this.rescheduleAllReminders()
  }

  /**
   * Stop all reminder checks and clear scheduled reminders
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }

    // Clear all scheduled reminders
    for (const reminder of this.scheduledReminders.values()) {
      clearTimeout(reminder.timeoutId)
    }
    this.scheduledReminders.clear()
  }

  private startReminderCheck(): void {
    // Check every minute for reminders that need to be scheduled
    this.checkInterval = setInterval(() => {
      this.rescheduleAllReminders()
    }, 60 * 1000) // Every minute
  }

  private rescheduleAllReminders(): void {
    const now = new Date()

    for (const task of this.tasks) {
      // Skip completed tasks
      if (task.completed) continue

      // Skip tasks without a date (unscheduled tasks)
      if (!task.date) continue

      // Skip tasks without reminders
      if (!task.reminders || task.reminders.length === 0) continue

      // Parse task date and time
      const taskDateTime = this.parseTaskDateTime(task.date, task.time)
      if (!taskDateTime) continue

      for (const reminder of task.reminders) {
        if (!reminder.enabled) continue

        const reminderKey = `${task.id}-${reminder.id}`
        const reminderTime = this.calculateReminderTime(taskDateTime, reminder)

        // Skip if reminder time is in the past
        if (reminderTime <= now) {
          // If we haven't fired this reminder yet and it's within the last 5 minutes, fire it now
          const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
          if (reminderTime > fiveMinutesAgo && !this.scheduledReminders.has(reminderKey)) {
            this.fireNotification(task.title, taskDateTime, reminder)
          }
          continue
        }

        // Check if this reminder is already scheduled with the correct time
        const existing = this.scheduledReminders.get(reminderKey)
        if (existing && existing.reminderTime.getTime() === reminderTime.getTime()) {
          continue
        }

        // Clear existing timeout if any
        if (existing) {
          clearTimeout(existing.timeoutId)
        }

        // Schedule new reminder (only if it's within the next 24 hours)
        const timeUntilReminder = reminderTime.getTime() - now.getTime()
        if (timeUntilReminder > 0 && timeUntilReminder <= 24 * 60 * 60 * 1000) {
          const timeoutId = setTimeout(() => {
            this.fireNotification(task.title, taskDateTime, reminder)
            this.scheduledReminders.delete(reminderKey)
          }, timeUntilReminder)

          this.scheduledReminders.set(reminderKey, {
            taskId: task.id,
            reminderId: reminder.id,
            taskTitle: task.title,
            reminderTime,
            timeoutId
          })
        }
      }
    }
  }

  private parseTaskDateTime(date: string, time?: string): Date | null {
    try {
      if (time) {
        const [hours, minutes] = time.split(':').map(Number)
        const parsed = new Date(`${date}T00:00:00`)
        parsed.setHours(hours, minutes, 0, 0)
        return parsed
      }
      // Default to 9 AM if no time specified
      const parsed = new Date(`${date}T09:00:00`)
      return parsed
    } catch {
      return null
    }
  }

  private calculateReminderTime(taskDateTime: Date, reminder: TaskReminder): Date {
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
    }

    return reminderTime
  }

  private fireNotification(taskTitle: string, taskDateTime: Date, reminder: TaskReminder): void {
    const timeString = taskDateTime.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit'
    })
    const dateString = taskDateTime.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })

    const reminderText = this.formatReminderText(reminder)

    const notification = new Notification({
      title: `Task Reminder: ${taskTitle}`,
      body: `${reminderText}\nScheduled for ${dateString} at ${timeString}`,
      silent: false,
      urgency: 'normal'
    })

    notification.on('click', () => {
      // Focus the main window when notification is clicked
      const windows = BrowserWindow.getAllWindows()
      if (windows.length > 0) {
        const mainWindow = windows[0]
        if (mainWindow.isMinimized()) {
          mainWindow.restore()
        }
        mainWindow.focus()
      }
    })

    notification.show()
  }

  private formatReminderText(reminder: TaskReminder): string {
    const unit = reminder.type === 'minutes' ? 'minute' : reminder.type === 'hours' ? 'hour' : 'day'
    const plural = reminder.value !== 1 ? 's' : ''
    return `Reminder: ${reminder.value} ${unit}${plural} before`
  }
}
