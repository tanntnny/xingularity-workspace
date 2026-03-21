import { cloneElement, ReactElement, useState } from 'react'
import { Bell, BellRing, Calendar, Check, Clock3, Pencil, Target, Trash2, X } from 'lucide-react'
import { CalendarTask, CalendarTaskType, NativeMenuItemDescriptor, TaskReminder } from '../../../shared/types'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuDestructiveItem,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from './ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog'
import { canUseNativeMenus, getMouseMenuPosition, showNativeMenu } from '../lib/nativeMenu'

interface TaskContextMenuProps {
  task: CalendarTask
  selectedDate: string
  onToggle: (taskId: string) => void
  onDelete: (taskId: string) => void
  onRename: (taskId: string, newTitle: string) => void
  onUpdateTaskType: (taskId: string, taskType: CalendarTaskType) => void
  onUpdateTime: (taskId: string, time: string | undefined) => void
  onUpdateReminders: (taskId: string, reminders: TaskReminder[]) => void
  onScheduleTask: (taskId: string, date: string) => void
  onUnscheduleTask: (taskId: string) => void
  children: ReactElement<{
    onContextMenu?: (event: React.MouseEvent<HTMLElement>) => void
  }>
}

export const TASK_TYPE_OPTIONS: Array<{ value: CalendarTaskType; label: string }> = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'review', label: 'Review' },
  { value: 'personal', label: 'Personal' },
  { value: 'other', label: 'Other' }
]

const QUICK_TIME_OPTIONS = [
  { label: '9:00 AM', value: '09:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '3:00 PM', value: '15:00' },
  { label: '6:00 PM', value: '18:00' }
]

export function TaskContextMenu({
  task,
  selectedDate,
  onToggle,
  onDelete,
  onRename,
  onUpdateTaskType,
  onUpdateTime,
  onUpdateReminders,
  onScheduleTask,
  onUnscheduleTask,
  children
}: TaskContextMenuProps): ReactElement {
  const useNativeMenus = canUseNativeMenus()
  const [isTimeDialogOpen, setIsTimeDialogOpen] = useState(false)
  const [isReminderDialogOpen, setIsReminderDialogOpen] = useState(false)
  const [timeInputValue, setTimeInputValue] = useState(task.time ?? '')
  const [newReminderValue, setNewReminderValue] = useState(30)
  const [newReminderType, setNewReminderType] = useState<'minutes' | 'hours' | 'days'>('minutes')

  const formatReminderLabel = (reminder: TaskReminder): string => {
    const unit = reminder.value === 1 ? reminder.type.slice(0, -1) : reminder.type
    return `${reminder.value} ${unit} before`
  }

  const handleAddReminder = (): void => {
    const nextReminder: TaskReminder = {
      id: `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: newReminderType,
      value: Math.max(1, newReminderValue),
      enabled: true
    }
    onUpdateReminders(task.id, [...(task.reminders || []), nextReminder])
    setNewReminderValue(30)
    setNewReminderType('minutes')
  }

  const handleToggleReminder = (reminderId: string): void => {
    const nextReminders = (task.reminders || []).map((reminder) =>
      reminder.id === reminderId ? { ...reminder, enabled: !reminder.enabled } : reminder
    )
    onUpdateReminders(task.id, nextReminders)
  }

  const handleRemoveReminder = (reminderId: string): void => {
    const nextReminders = (task.reminders || []).filter((reminder) => reminder.id !== reminderId)
    onUpdateReminders(task.id, nextReminders)
  }

  const handleRename = (): void => {
    const raw = window.prompt('Rename task', task.title)
    if (raw === null) return
    const nextTitle = raw.trim()
    if (!nextTitle) return
    onRename(task.id, nextTitle)
  }

  const handleNativeContextMenu = async (
    event: React.MouseEvent<HTMLElement>
  ): Promise<void> => {
    event.preventDefault()

    const items: NativeMenuItemDescriptor[] = [
      {
        id: 'toggle',
        label: task.completed ? 'Mark as pending' : 'Mark as complete'
      },
      { id: 'rename', label: 'Rename' },
      {
        type: 'submenu',
        label: 'Set type',
        submenu: TASK_TYPE_OPTIONS.map((taskType) => ({
          id: `type:${taskType.value}`,
          type: 'checkbox',
          label: taskType.label,
          checked: (task.taskType || 'assignment') === taskType.value
        }))
      },
      {
        type: 'submenu',
        label: 'Set time',
        submenu: [
          ...QUICK_TIME_OPTIONS.map((option) => ({
            id: `time:${option.value}`,
            type: 'checkbox' as const,
            label: option.label,
            checked: task.time === option.value
          })),
          { id: 'time-custom', label: 'Custom time...' },
          { id: 'time-clear', label: 'Clear time' }
        ]
      },
      { id: 'reminders', label: 'Manage reminders' },
      { type: 'separator' },
      task.date
        ? { id: 'unschedule', label: 'Move to unscheduled' }
        : { id: 'schedule', label: `Schedule to ${selectedDate}` },
      { id: 'delete', label: 'Delete', accelerator: 'Command+Backspace' }
    ]

    const actionId = await showNativeMenu(items, getMouseMenuPosition(event))
    if (!actionId) {
      return
    }

    if (actionId === 'toggle') {
      onToggle(task.id)
      return
    }
    if (actionId === 'rename') {
      handleRename()
      return
    }
    if (actionId.startsWith('type:')) {
      onUpdateTaskType(task.id, actionId.slice('type:'.length) as CalendarTaskType)
      return
    }
    if (actionId.startsWith('time:')) {
      const value = actionId.slice('time:'.length)
      onUpdateTime(task.id, value)
      return
    }
    if (actionId === 'time-custom') {
      setTimeInputValue(task.time ?? '')
      setIsTimeDialogOpen(true)
      return
    }
    if (actionId === 'time-clear') {
      onUpdateTime(task.id, undefined)
      return
    }
    if (actionId === 'reminders') {
      setIsReminderDialogOpen(true)
      return
    }
    if (actionId === 'unschedule') {
      onUnscheduleTask(task.id)
      return
    }
    if (actionId === 'schedule') {
      onScheduleTask(task.id, selectedDate)
      return
    }
    if (actionId === 'delete') {
      onDelete(task.id)
    }
  }

  const triggerChild = useNativeMenus
    ? cloneElement(children, {
        onContextMenu: (event: React.MouseEvent<HTMLElement>) => {
          children.props.onContextMenu?.(event)
          if (!event.defaultPrevented) {
            void handleNativeContextMenu(event)
          }
        }
      })
    : children

  return (
    <>
      {useNativeMenus ? (
        triggerChild
      ) : (
      <ContextMenu>
        <ContextMenuTrigger asChild>{triggerChild}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onToggle(task.id)}>
            <Check className="mr-2 h-4 w-4" />
            {task.completed ? 'Mark as pending' : 'Mark as complete'}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={handleRename}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Rename
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Target className="mr-2 h-4 w-4" />
              Set type
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {TASK_TYPE_OPTIONS.map((taskType) => (
                <ContextMenuItem
                  key={taskType.value}
                  onClick={() => onUpdateTaskType(task.id, taskType.value)}
                >
                  {taskType.label}
                  {(task.taskType || 'assignment') === taskType.value && (
                    <Check className="ml-auto h-4 w-4" />
                  )}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Clock3 className="mr-2 h-4 w-4" />
              Set time
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {QUICK_TIME_OPTIONS.map((option) => (
                <ContextMenuItem
                  key={option.value}
                  onClick={() => onUpdateTime(task.id, option.value)}
                >
                  {option.label}
                  {task.time === option.value && <Check className="ml-auto h-4 w-4" />}
                </ContextMenuItem>
              ))}
              <ContextMenuItem
                onClick={() => {
                  setTimeInputValue(task.time ?? '')
                  setIsTimeDialogOpen(true)
                }}
              >
                Custom time...
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onUpdateTime(task.id, undefined)}>
                Clear time
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuItem
            onClick={() => {
              setIsReminderDialogOpen(true)
            }}
          >
            <Bell className="mr-2 h-4 w-4" />
            Manage reminders
          </ContextMenuItem>
          <ContextMenuSeparator />
          {task.date ? (
            <ContextMenuItem onClick={() => onUnscheduleTask(task.id)}>
              <Calendar className="mr-2 h-4 w-4" />
              Move to unscheduled
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onClick={() => onScheduleTask(task.id, selectedDate)}>
              <Calendar className="mr-2 h-4 w-4" />
              Schedule to {selectedDate}
            </ContextMenuItem>
          )}
          <ContextMenuDestructiveItem
            onClick={() => onDelete(task.id)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
            <ContextMenuShortcut keys={['cmd', 'backspace']} />
          </ContextMenuDestructiveItem>
        </ContextMenuContent>
      </ContextMenu>
      )}

      <Dialog open={isTimeDialogOpen} onOpenChange={setIsTimeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set task time</DialogTitle>
            <DialogDescription>Choose a time for this task.</DialogDescription>
          </DialogHeader>
          <input
            type="time"
            value={timeInputValue}
            onChange={(event) => setTimeInputValue(event.target.value)}
            className="w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] outline-none"
          />
          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                onUpdateTime(task.id, timeInputValue || undefined)
                setIsTimeDialogOpen(false)
              }}
              className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white"
            >
              Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReminderDialogOpen} onOpenChange={setIsReminderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Task reminders</DialogTitle>
            <DialogDescription>Manage notifications for this task.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {(task.reminders || []).length > 0 ? (
              <div className="space-y-1.5">
                {(task.reminders || []).map((reminder) => (
                  <div
                    key={reminder.id}
                    className={`flex items-center justify-between rounded-md border px-2 py-1.5 text-xs ${
                      reminder.enabled
                        ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
                        : 'border-[var(--line)] bg-[var(--panel-2)] opacity-70'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleReminder(reminder.id)}
                      className="flex items-center gap-1.5 text-[var(--text)]"
                    >
                      {reminder.enabled ? (
                        <BellRing size={12} className="text-amber-500" />
                      ) : (
                        <Bell size={12} className="text-[var(--muted)]" />
                      )}
                      {formatReminderLabel(reminder)}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveReminder(reminder.id)}
                      className="rounded p-0.5 text-[var(--muted)] hover:bg-[var(--panel)] hover:text-red-500"
                      title="Remove reminder"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--muted)]">No reminders yet.</p>
            )}

            <div className="border-t border-[var(--line)] pt-2">
              <div className="mb-2 text-xs text-[var(--muted)]">Add reminder</div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={newReminderValue}
                  onChange={(event) =>
                    setNewReminderValue(Math.max(1, Number(event.target.value) || 1))
                  }
                  className="w-16 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-xs text-[var(--text)] outline-none"
                />
                <select
                  value={newReminderType}
                  onChange={(event) =>
                    setNewReminderType(event.target.value as 'minutes' | 'hours' | 'days')
                  }
                  className="flex-1 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-xs text-[var(--text)] outline-none"
                >
                  <option value="minutes">minutes</option>
                  <option value="hours">hours</option>
                  <option value="days">days</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddReminder}
                  className="rounded-md bg-[var(--accent)] px-2 py-1 text-xs font-medium text-white"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
