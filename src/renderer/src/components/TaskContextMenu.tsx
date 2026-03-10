import { ReactElement, useState } from 'react'
import { Calendar, Check, Clock3, Flag, Pencil, Trash2 } from 'lucide-react'
import { CalendarTask, TaskPriority } from '../../../shared/types'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
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

interface TaskContextMenuProps {
  task: CalendarTask
  selectedDate: string
  onToggle: (taskId: string) => void
  onDelete: (taskId: string) => void
  onRename: (taskId: string, newTitle: string) => void
  onUpdatePriority: (taskId: string, priority: TaskPriority) => void
  onUpdateTime: (taskId: string, time: string | undefined) => void
  onScheduleTask: (taskId: string, date: string) => void
  onUnscheduleTask: (taskId: string) => void
  children: ReactElement
}

const PRIORITY_ORDER: TaskPriority[] = ['high', 'medium', 'low']

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
  onUpdatePriority,
  onUpdateTime,
  onScheduleTask,
  onUnscheduleTask,
  children
}: TaskContextMenuProps): ReactElement {
  const [isTimeDialogOpen, setIsTimeDialogOpen] = useState(false)
  const [timeInputValue, setTimeInputValue] = useState(task.time ?? '')

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onToggle(task.id)}>
            <Check className="mr-2 h-4 w-4" />
            {task.completed ? 'Mark as pending' : 'Mark as complete'}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              const raw = window.prompt('Rename task', task.title)
              if (raw === null) return
              const nextTitle = raw.trim()
              if (!nextTitle) return
              onRename(task.id, nextTitle)
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Rename
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Flag className="mr-2 h-4 w-4" />
              Set priority
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {PRIORITY_ORDER.map((priority) => (
                <ContextMenuItem key={priority} onClick={() => onUpdatePriority(task.id, priority)}>
                  {priority[0].toUpperCase() + priority.slice(1)}
                  {task.priority === priority && <Check className="ml-auto h-4 w-4" />}
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
          <ContextMenuItem
            onClick={() => onDelete(task.id)}
            className="text-red-500 focus:text-red-500"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

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
    </>
  )
}
