import { ReactElement, useState } from 'react'
import { Bell, BellRing, Calendar, Check, Clock3, Copy, Flag, Target, Trash2, X } from './ui/icons'
import {
  CALENDAR_TASK_TYPE_OPTIONS,
  TASK_STATUS_OPTIONS,
  CalendarTask,
  CalendarTaskType,
  TaskPriority,
  TaskReminder,
  TaskStatus
} from '../../../shared/types'
import { getTaskStatus } from '../lib/taskStatus'
import { StatusChip } from './ui/status-chip'
import {
  getCalendarTaskTypeChipItem,
  getTaskPriorityChipItem,
  getTaskStatusChipItem
} from '../lib/statusChipMeta'
import { ActionMenuItems, type ActionMenuGroup } from './ui/action-menu'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from './ui/context-menu'
import { Shortcut } from './ui/kbd'
import { Button } from './ui/button'
import {
  Dialog,
  DialogActionButton,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogShell,
  DialogShellHeader,
  DialogShellFooter
} from './ui/dialog'
import { CalendarTimeEditPopover } from './ui/calendar-time-edit-popover'
import { SelectionPopover } from './ui/selection-popover'

interface TaskContextMenuProps {
  task: CalendarTask
  selectedDate?: string
  onDuplicateTask?: (taskId: string) => void | Promise<void>
  showCopyGestureHint?: boolean
  onDelete: (taskId: string) => void
  onUpdateStatus: (taskId: string, status: TaskStatus) => void
  onUpdatePriority: (taskId: string, priority: TaskPriority) => void
  onUpdateTaskType: (taskId: string, taskType: CalendarTaskType) => void
  onUpdateTime: (taskId: string, time: string | undefined) => void
  onUpdateReminders: (taskId: string, reminders: TaskReminder[]) => void
  onScheduleTask?: (taskId: string, date: string) => void
  onUnscheduleTask?: (taskId: string) => void
  children: ReactElement
}

const QUICK_TIME_OPTIONS = [
  { label: '9:00 AM', value: '09:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '3:00 PM', value: '15:00' },
  { label: '6:00 PM', value: '18:00' }
]

const TASK_PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' }
]

export function TaskContextMenu({
  task,
  selectedDate,
  onDuplicateTask,
  showCopyGestureHint = false,
  onDelete,
  onUpdateStatus,
  onUpdatePriority,
  onUpdateTaskType,
  onUpdateTime,
  onUpdateReminders,
  onScheduleTask,
  onUnscheduleTask,
  children
}: TaskContextMenuProps): ReactElement {
  const [isTimeDialogOpen, setIsTimeDialogOpen] = useState(false)
  const [isReminderDialogOpen, setIsReminderDialogOpen] = useState(false)
  const [timeInputValue, setTimeInputValue] = useState(task.time ?? '')
  const [newReminderValue, setNewReminderValue] = useState(30)
  const [newReminderType, setNewReminderType] = useState<'minutes' | 'hours' | 'days'>('minutes')
  const currentStatus = getTaskStatus(task.status, task.completed)

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

  const menuGroups: ActionMenuGroup[] = [
    {
      id: 'properties',
      items: [
        {
          id: 'status',
          label: 'Set status',
          icon: <Check aria-hidden="true" />,
          submenu: TASK_STATUS_OPTIONS.map((option) => ({
            id: `status:${option.value}`,
            label: (
              <StatusChip
                item={getTaskStatusChipItem(option.value)}
                className="pointer-events-none"
              />
            ),
            trailing:
              currentStatus === option.value ? <Check className="ml-auto h-4 w-4" /> : undefined,
            onSelect: () => onUpdateStatus(task.id, option.value)
          }))
        },
        {
          id: 'type',
          label: 'Set type',
          icon: <Target aria-hidden="true" />,
          submenu: CALENDAR_TASK_TYPE_OPTIONS.map((taskType) => ({
            id: `type:${taskType.value}`,
            label: (
              <StatusChip
                item={getCalendarTaskTypeChipItem(taskType.value)}
                className="pointer-events-none"
              />
            ),
            trailing:
              (task.taskType || 'assignment') === taskType.value ? (
                <Check className="ml-auto h-4 w-4" />
              ) : undefined,
            onSelect: () => onUpdateTaskType(task.id, taskType.value)
          }))
        },
        {
          id: 'priority',
          label: 'Set priority',
          icon: <Flag aria-hidden="true" />,
          submenu: TASK_PRIORITY_OPTIONS.map((priority) => ({
            id: `priority:${priority.value}`,
            label: (
              <StatusChip
                item={getTaskPriorityChipItem(priority.value)}
                className="pointer-events-none"
              />
            ),
            trailing:
              (task.priority || 'low') === priority.value ? (
                <Check className="ml-auto h-4 w-4" />
              ) : undefined,
            onSelect: () => onUpdatePriority(task.id, priority.value)
          }))
        },
        {
          id: 'time',
          label: 'Set time',
          icon: <Clock3 aria-hidden="true" />,
          submenu: [
            ...QUICK_TIME_OPTIONS.map((option) => ({
              id: `time:${option.value}`,
              label: option.label,
              trailing:
                task.time === option.value ? <Check className="ml-auto h-4 w-4" /> : undefined,
              onSelect: () => onUpdateTime(task.id, option.value)
            })),
            {
              id: 'time:custom',
              label: 'Custom time…',
              onSelect: () => {
                setTimeInputValue(task.time ?? '')
                setIsTimeDialogOpen(true)
              }
            },
            {
              id: 'time:clear',
              label: 'Clear time',
              onSelect: () => onUpdateTime(task.id, undefined)
            }
          ]
        }
      ]
    },
    {
      id: 'management',
      items: [
        ...(onDuplicateTask
          ? [
              {
                id: 'duplicate',
                label: 'Duplicate task',
                icon: <Copy aria-hidden="true" />,
                shortcut: showCopyGestureHint ? <Shortcut keys={['option', 'drag']} /> : undefined,
                testId: `duplicate-task-menu-item:${task.id}`,
                onSelect: () => void onDuplicateTask(task.id)
              }
            ]
          : []),
        {
          id: 'reminders',
          label: 'Manage reminders',
          icon: <Bell aria-hidden="true" />,
          onSelect: () => setIsReminderDialogOpen(true)
        },
        ...(task.date && onUnscheduleTask
          ? [
              {
                id: 'unschedule',
                label: 'Move to unscheduled',
                icon: <Calendar aria-hidden="true" />,
                onSelect: () => onUnscheduleTask(task.id)
              }
            ]
          : !task.date && selectedDate && onScheduleTask
            ? [
                {
                  id: 'schedule',
                  label: task.endDate
                    ? `Move deadline to ${selectedDate}`
                    : `Schedule to ${selectedDate}`,
                  icon: <Calendar aria-hidden="true" />,
                  onSelect: () => onScheduleTask(task.id, selectedDate)
                }
              ]
            : [])
      ]
    },
    {
      id: 'destructive',
      items: [
        {
          id: 'delete',
          label: 'Delete task',
          icon: <Trash2 aria-hidden="true" />,
          destructive: true,
          shortcut: <Shortcut keys={['cmd', 'backspace']} />,
          onSelect: () => onDelete(task.id)
        }
      ]
    }
  ]

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent data-testid={`task-context-menu:${task.id}`}>
          <ActionMenuItems variant="context" groups={menuGroups} />
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={isTimeDialogOpen} onOpenChange={setIsTimeDialogOpen}>
        <DialogContent showCloseButton={false}>
          <DialogShell>
            <DialogShellHeader
              context="Task"
              title="Set task time"
              closeLabel="Close time dialog"
              onClose={() => setIsTimeDialogOpen(false)}
            />
            <DialogBody>
              <DialogDescription className="mb-3">Choose a time for this task.</DialogDescription>
              <CalendarTimeEditPopover
                value={timeInputValue || undefined}
                label="Task time"
                onValueChange={(value) => setTimeInputValue(value ?? '')}
                placeholder="Choose task time"
                aria-label="Task time"
                className="w-full justify-start"
              />
            </DialogBody>
            <DialogShellFooter>
              <DialogActionButton
                onClick={() => {
                  onUpdateTime(task.id, timeInputValue || undefined)
                  setIsTimeDialogOpen(false)
                }}
                title="Done"
                aria-label="Done"
                icon={<Check />}
                label="Done"
                tone="accent"
              />
            </DialogShellFooter>
          </DialogShell>
        </DialogContent>
      </Dialog>

      <Dialog open={isReminderDialogOpen} onOpenChange={setIsReminderDialogOpen}>
        <DialogContent showCloseButton={false}>
          <DialogShell>
            <DialogShellHeader
              context="Task"
              title="Task reminders"
              closeLabel="Close reminders"
              onClose={() => setIsReminderDialogOpen(false)}
            />

            <DialogBody>
              <DialogDescription className="mb-3">
                Manage notifications for this task.
              </DialogDescription>
              <div className="space-y-3">
                {(task.reminders || []).length > 0 ? (
                  <div className="space-y-1.5">
                    {(task.reminders || []).map((reminder) => (
                      <div
                        key={reminder.id}
                        className={`flex items-center justify-between rounded-md border px-2 py-1.5 text-xs ${
                          reminder.enabled
                            ? 'border-ring bg-muted'
                            : 'border-border bg-muted opacity-70'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleReminder(reminder.id)}
                          className="flex items-center gap-1.5 rounded-[var(--radius-control)] px-1 text-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {reminder.enabled ? (
                            <BellRing size={12} className="text-muted-foreground" />
                          ) : (
                            <Bell size={12} className="text-muted-foreground" />
                          )}
                          {formatReminderLabel(reminder)}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveReminder(reminder.id)}
                          className="rounded-[var(--radius-control)] p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          title="Remove reminder"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No reminders yet.</p>
                )}

                <div className="border-t border-border pt-2">
                  <div className="mb-2 text-xs text-muted-foreground">Add reminder</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={newReminderValue}
                      onChange={(event) =>
                        setNewReminderValue(Math.max(1, Number(event.target.value) || 1))
                      }
                      className=" w-16 rounded-lg border px-2 py-1 text-xs text-foreground outline-none"
                    />
                    <SelectionPopover
                      selectionMode="single"
                      value={newReminderType}
                      options={[
                        { value: 'minutes', label: 'minutes' },
                        { value: 'hours', label: 'hours' },
                        { value: 'days', label: 'days' }
                      ]}
                      onValueChange={(value) =>
                        setNewReminderType(value as 'minutes' | 'hours' | 'days')
                      }
                      label="Reminder unit"
                      searchPlaceholder="Search reminder units"
                      triggerProps={{
                        className: 'flex-1 text-xs',
                        'aria-label': 'Reminder unit'
                      }}
                    />
                    <Button type="button" onClick={handleAddReminder} variant="outline" size="sm">
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            </DialogBody>
            <DialogShellFooter>
              <DialogActionButton
                onClick={() => setIsReminderDialogOpen(false)}
                title="Done"
                aria-label="Done"
                icon={<Check />}
                label="Done"
                tone="accent"
              />
            </DialogShellFooter>
          </DialogShell>
        </DialogContent>
      </Dialog>
    </>
  )
}
