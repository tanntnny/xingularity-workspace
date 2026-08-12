import { ReactElement, useState } from 'react'
import {
  Bell,
  BellRing,
  Calendar,
  Check,
  Clock3,
  Flag,
  Pencil,
  Target,
  Trash2,
  X
} from './ui/icons'
import {
  CALENDAR_TASK_TYPE_OPTIONS,
  CalendarTask,
  CalendarTaskType,
  TaskPriority,
  TaskReminder
} from '../../../shared/types'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from './ui/context-menu'
import { Shortcut } from './ui/kbd'
import { Button } from './ui/button'
import {
  Dialog,
  DialogActionButton,
  DialogBody,
  DialogCloseAction,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogShell,
  DialogShellFooter,
  DialogTitle
} from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { CalendarTaskTypeBadge } from './ui/calendar-task-type-badge'

interface TaskContextMenuProps {
  task: CalendarTask
  selectedDate: string
  onToggle: (taskId: string) => void
  onDelete: (taskId: string) => void
  onRename: (taskId: string, newTitle: string) => void
  onUpdatePriority: (taskId: string, priority: TaskPriority) => void
  onUpdateTaskType: (taskId: string, taskType: CalendarTaskType) => void
  onUpdateTime: (taskId: string, time: string | undefined) => void
  onUpdateReminders: (taskId: string, reminders: TaskReminder[]) => void
  onScheduleTask: (taskId: string, date: string) => void
  onUnscheduleTask: (taskId: string) => void
  children: ReactElement<{
    onContextMenu?: (event: React.MouseEvent<HTMLElement>) => void
  }>
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
  onToggle,
  onDelete,
  onRename,
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

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onToggle(task.id)}>
            <Check className="mr-2 h-4 w-4" />
            {task.completed ? 'Mark as pending' : 'Mark as complete'}
          </ContextMenuItem>
          <ContextMenuItem onClick={handleRename}>
            <Pencil className="mr-2 h-4 w-4" />
            Rename
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Target className="mr-2 h-4 w-4" />
              Set type
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {CALENDAR_TASK_TYPE_OPTIONS.map((taskType) => (
                <ContextMenuItem
                  key={taskType.value}
                  onClick={() => onUpdateTaskType(task.id, taskType.value)}
                >
                  <CalendarTaskTypeBadge taskType={taskType.value} />
                  {(task.taskType || 'assignment') === taskType.value && (
                    <Check className="ml-auto h-4 w-4" />
                  )}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Flag className="mr-2 h-4 w-4" />
              Set priority
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {TASK_PRIORITY_OPTIONS.map((priority) => (
                <ContextMenuItem
                  key={priority.value}
                  onSelect={() => onUpdatePriority(task.id, priority.value)}
                >
                  {priority.label}
                  {(task.priority || 'low') === priority.value && (
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
          <ContextMenuItem destructive onClick={() => onDelete(task.id)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
            <ContextMenuShortcut>
              <Shortcut keys={['cmd', 'backspace']} />
            </ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={isTimeDialogOpen} onOpenChange={setIsTimeDialogOpen}>
        <DialogContent className="max-w-sm" showCloseButton={false}>
          <DialogShell>
            <DialogHeader>
              <DialogTitle>Set task time</DialogTitle>
              <DialogDescription>Choose a time for this task.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <input
                type="time"
                value={timeInputValue}
                onChange={(event) => setTimeInputValue(event.target.value)}
                className=" w-full rounded-lg border px-3 py-2 text-sm text-foreground outline-none"
              />
            </DialogBody>
            <DialogShellFooter closeAction={<DialogCloseAction label="Close time dialog" />}>
              <DialogActionButton
                onClick={() => {
                  onUpdateTime(task.id, timeInputValue || undefined)
                  setIsTimeDialogOpen(false)
                }}
                title="Done"
                aria-label="Done"
                icon={<Check />}
                tone="primary"
              />
            </DialogShellFooter>
          </DialogShell>
        </DialogContent>
      </Dialog>

      <Dialog open={isReminderDialogOpen} onOpenChange={setIsReminderDialogOpen}>
        <DialogContent className="max-w-md" showCloseButton={false}>
          <DialogShell>
            <DialogHeader>
              <DialogTitle>Task reminders</DialogTitle>
              <DialogDescription>Manage notifications for this task.</DialogDescription>
            </DialogHeader>

            <DialogBody>
              <div className="space-y-3">
                {(task.reminders || []).length > 0 ? (
                  <div className="space-y-1.5">
                    {(task.reminders || []).map((reminder) => (
                      <div
                        key={reminder.id}
                        className={`flex items-center justify-between rounded-md border px-2 py-1.5 text-xs ${
                          reminder.enabled
                            ? 'border-ring bg-accent'
                            : 'border-border bg-muted opacity-70'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleReminder(reminder.id)}
                          className="flex items-center gap-1.5 rounded-[var(--radius-control)] px-1 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                    <Select
                      value={newReminderType}
                      onValueChange={(value) =>
                        setNewReminderType(value as 'minutes' | 'hours' | 'days')
                      }
                    >
                      <SelectTrigger className=" flex-1 text-xs">
                        <SelectValue placeholder="Unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">minutes</SelectItem>
                        <SelectItem value="hours">hours</SelectItem>
                        <SelectItem value="days">days</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" onClick={handleAddReminder} variant="outline" size="sm">
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            </DialogBody>
            <DialogShellFooter closeAction={<DialogCloseAction label="Close reminders" />}>
              <DialogActionButton
                onClick={() => setIsReminderDialogOpen(false)}
                title="Done"
                aria-label="Done"
                icon={<Check />}
                tone="primary"
              />
            </DialogShellFooter>
          </DialogShell>
        </DialogContent>
      </Dialog>
    </>
  )
}
