import { ReactElement, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Draggable, DropArg, EventDragStopArg, EventResizeDoneArg } from '@fullcalendar/interaction'
import {
  DayCellMountArg,
  EventApi,
  EventDropArg,
  EventMountArg,
  EventHoveringArg
} from '@fullcalendar/core'
import {
  CALENDAR_TASK_TYPE_OPTIONS,
  CalendarTask,
  CalendarTaskType,
  TaskPriority,
  TaskReminder
} from '../../../shared/types'
import { CalendarTaskCard } from './CalendarTaskCard'
import { TaskContextMenu } from './TaskContextMenu'
import { CalendarTaskHoverCard } from './CalendarTaskHoverCard'
import { Input } from './ui/input'
import {
  buildCalendarEvents,
  type CalendarEventInput,
  normalizeCalendarTasks
} from '../lib/calendarTasks'
import { toIsoDate } from '../lib/calendarDate'
import { getCalendarTaskHoverPosition } from '../lib/calendarTaskHoverPosition'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog'

interface CalendarMonthViewProps {
  selectedDate: string
  tasks: CalendarTask[]
  onSelectDate: (date: string) => void
  onCreateTask?: (date: string) => Promise<CalendarTask>
  onRescheduleTask?: (taskId: string, newDate: string | undefined) => void
  onRescheduleMilestone?: (projectId: string, milestoneId: string, newDate: string) => void
  onResizeTaskStart?: (taskId: string, newStartDate: string) => void
  onResizeTaskEnd?: (taskId: string, newEndDate: string) => void
  onToggleTask?: (taskId: string) => void
  onDeleteTask?: (taskId: string) => void
  onRenameTask?: (taskId: string, newTitle: string) => void
  onUpdateTaskPriority?: (taskId: string, priority: TaskPriority) => void
  onUpdateTaskType?: (taskId: string, taskType: CalendarTaskType) => void
  onUpdateTaskTime?: (taskId: string, time: string | undefined) => void
  onUpdateTaskReminders?: (taskId: string, reminders: TaskReminder[]) => void
  milestoneEvents?: CalendarEventInput[]
  onOpenMilestone?: (projectId: string, milestoneId: string) => void
}

export function CalendarMonthView({
  selectedDate,
  tasks,
  onSelectDate,
  onCreateTask,
  onRescheduleTask,
  onRescheduleMilestone,
  onResizeTaskStart,
  onResizeTaskEnd,
  onToggleTask,
  onDeleteTask,
  onRenameTask,
  onUpdateTaskPriority,
  onUpdateTaskType,
  onUpdateTaskTime,
  onUpdateTaskReminders,
  milestoneEvents = [],
  onOpenMilestone
}: CalendarMonthViewProps): ReactElement {
  const calendarRef = useRef<FullCalendar | null>(null)
  const mirrorParent = typeof document === 'undefined' ? undefined : document.body
  const [hoveredTaskCard, setHoveredTaskCard] = useState<{
    task: CalendarTask
    x: number
    y: number
  } | null>(null)
  const [calendarContextMenu, setCalendarContextMenu] = useState<{
    taskId: string
    x: number
    y: number
    nonce: number
  } | null>(null)
  const [isInteracting, setIsInteracting] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const contextMenuTriggerRef = useRef<HTMLSpanElement | null>(null)
  const contextMenuNonceRef = useRef(0)
  const dayCellListenerMapRef = useRef(new Map<HTMLElement, (event: MouseEvent) => void>())
  const unscheduledDragCleanupRef = useRef<(() => void) | null>(null)

  const normalizedTasks = useMemo(() => normalizeCalendarTasks(tasks), [tasks])
  const tasksById = useMemo(
    () => Object.fromEntries(normalizedTasks.map((task) => [task.id, task])),
    [normalizedTasks]
  )
  const tasksByIdRef = useRef(tasksById)
  const isInteractingRef = useRef(isInteracting)
  const eventListenerMapRef = useRef(
    new WeakMap<
      HTMLElement,
      {
        onContextMenu: (event: MouseEvent) => void
        onMouseMove: (event: MouseEvent) => void
        onMouseLeave: () => void
        contextMenuTargets: HTMLElement[]
      }
    >()
  )
  useEffect(() => {
    tasksByIdRef.current = tasksById
  }, [tasksById])

  useEffect(() => {
    if (editingTaskId && !tasksById[editingTaskId]) {
      setEditingTaskId(null)
    }
  }, [editingTaskId, tasksById])

  useEffect(() => {
    isInteractingRef.current = isInteracting
  }, [isInteracting])

  useEffect(() => {
    return () => {
      unscheduledDragCleanupRef.current?.()
      dayCellListenerMapRef.current.forEach((handler, el) => {
        el.removeEventListener('dblclick', handler)
      })
      dayCellListenerMapRef.current.clear()
    }
  }, [])

  useEffect(() => {
    if (!calendarContextMenu) {
      return
    }
    if (typeof window === 'undefined') {
      return
    }
    const frame = window.requestAnimationFrame(() => {
      contextMenuTriggerRef.current?.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2,
          clientX: calendarContextMenu.x,
          clientY: calendarContextMenu.y
        })
      )
    })
    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [calendarContextMenu])

  const calendarEvents = useMemo(() => {
    return [...buildCalendarEvents(normalizedTasks), ...milestoneEvents]
  }, [milestoneEvents, normalizedTasks])

  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (!api) {
      return
    }

    const activeEventIds = new Set<string>()

    for (const event of calendarEvents) {
      activeEventIds.add(event.id)
      const syncSignature = buildCalendarSyncSignature(event)
      const currentEvent = api.getEventById(event.id)

      if (!currentEvent) {
        api.addEvent({
          ...event,
          extendedProps: {
            ...event.extendedProps,
            syncSignature
          }
        })
        continue
      }

      if (hasCalendarEventChanged(currentEvent, event, syncSignature)) {
        currentEvent.remove()
        api.addEvent({
          ...event,
          extendedProps: {
            ...event.extendedProps,
            syncSignature
          }
        })
      }
    }

    api.getEvents().forEach((event) => {
      if (!activeEventIds.has(event.id)) {
        event.remove()
      }
    })
  }, [calendarEvents, tasksById])

  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (!api) {
      return
    }
    api.gotoDate(selectedDate)
  }, [selectedDate])

  useEffect(() => {
    const unscheduledContainer = document.querySelector<HTMLElement>(
      '[data-unscheduled-task-list="true"]'
    )
    if (!unscheduledContainer) {
      return
    }

    const draggable = new Draggable(unscheduledContainer, {
      itemSelector: '[data-unscheduled-task-id]',
      eventData: (eventEl) => {
        const taskId = eventEl.getAttribute('data-unscheduled-task-id') ?? ''
        const title = eventEl.getAttribute('data-unscheduled-task-title') ?? 'Task'
        return {
          id: taskId,
          title,
          create: false
        }
      }
    })

    return () => {
      draggable.destroy()
    }
  }, [])

  const handleEventDrop = (dropInfo: EventDropArg): void => {
    if (!dropInfo.event.start) {
      return
    }
    const nextDate = toIsoDate(dropInfo.event.start)
    const source = String(dropInfo.event.extendedProps.source ?? 'task')
    if (source === 'milestone') {
      const projectId = String(dropInfo.event.extendedProps.projectId ?? '')
      const milestoneId = String(dropInfo.event.extendedProps.milestoneId ?? '')
      if (projectId && milestoneId) {
        onRescheduleMilestone?.(projectId, milestoneId, nextDate)
        onSelectDate(nextDate)
        return
      }
    }
    onRescheduleTask?.(dropInfo.event.id, nextDate)
  }

  const handleEventResize = (resizeInfo: EventResizeDoneArg): void => {
    const { event, oldEvent } = resizeInfo
    if (!event.start) {
      return
    }

    const prevStartIso = oldEvent.start ? toIsoDate(oldEvent.start) : undefined
    const nextStartIso = toIsoDate(event.start)
    if (prevStartIso !== nextStartIso) {
      onResizeTaskStart?.(event.id, nextStartIso)
    }

    const previousExclusiveEnd = oldEvent.end ? toIsoDate(oldEvent.end) : undefined
    const nextExclusiveEnd = event.end ? toIsoDate(event.end) : undefined
    if (previousExclusiveEnd !== nextExclusiveEnd && event.end) {
      onResizeTaskEnd?.(event.id, toIsoDate(addIsoDays(event.end, -1)))
    }
  }

  const handleExternalDrop = (dropInfo: DropArg): void => {
    const taskId = dropInfo.draggedEl.getAttribute('data-unscheduled-task-id')
    if (!taskId) {
      return
    }
    onRescheduleTask?.(taskId, toIsoDate(dropInfo.date))
  }

  const handleEventDragStop = (dragInfo: EventDragStopArg): void => {
    unscheduledDragCleanupRef.current?.()
    unscheduledDragCleanupRef.current = null
    setIsInteracting(false)

    const source = String(dragInfo.event.extendedProps.source ?? 'task')
    if (source !== 'task') {
      return
    }

    const unscheduledContainer = document.querySelector<HTMLElement>(
      '[data-unscheduled-task-list="true"]'
    )
    if (!unscheduledContainer) {
      return
    }

    const rect = unscheduledContainer.getBoundingClientRect()
    const { clientX, clientY } = dragInfo.jsEvent
    const droppedInUnscheduled =
      clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom

    if (droppedInUnscheduled) {
      onRescheduleTask?.(dragInfo.event.id, undefined)
    }
  }

  const handleEventDragStart = (): void => {
    unscheduledDragCleanupRef.current?.()
    unscheduledDragCleanupRef.current = trackUnscheduledDragHover()
    setIsInteracting(true)
    setHoveredTaskCard(null)
  }

  const handleEventResizeStart = (): void => {
    setIsInteracting(true)
    setHoveredTaskCard(null)
  }

  const handleEventResizeStop = (): void => {
    setIsInteracting(false)
  }

  const handleEventMouseEnter = (hoverInfo: EventHoveringArg): void => {
    if (isInteracting) {
      return
    }

    const task = tasksById[hoverInfo.event.id]
    if (!task) {
      return
    }

    const { x, y } = getCalendarTaskHoverPosition(
      hoverInfo.jsEvent.clientX,
      hoverInfo.jsEvent.clientY
    )

    setHoveredTaskCard({
      task,
      x,
      y
    })
  }

  const handleEventMouseLeave = (): void => {
    setHoveredTaskCard(null)
  }

  const handleEventDidMount = (mountInfo: EventMountArg): void => {
    const source = String(mountInfo.event.extendedProps.source ?? 'task')
    if (source !== 'task') {
      return
    }

    const taskId = mountInfo.event.id
    const onContextMenu = (event: MouseEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      contextMenuNonceRef.current += 1
      setHoveredTaskCard(null)
      setCalendarContextMenu({
        taskId,
        x: event.clientX,
        y: event.clientY,
        nonce: contextMenuNonceRef.current
      })
    }
    const onMouseMove = (event: MouseEvent): void => {
      if (isInteractingRef.current) {
        return
      }
      const task = tasksByIdRef.current[taskId]
      if (!task) {
        return
      }
      const { x, y } = getCalendarTaskHoverPosition(event.clientX, event.clientY)
      setHoveredTaskCard((current) => {
        if (!current || current.task.id !== task.id) {
          return {
            task,
            x,
            y
          }
        }
        return {
          ...current,
          x,
          y
        }
      })
    }
    const onMouseLeave = (): void => {
      setHoveredTaskCard(null)
    }

    const contextMenuTargets = [
      mountInfo.el,
      mountInfo.el.querySelector<HTMLElement>('.fc-event-main')
    ].filter((target): target is HTMLElement => Boolean(target))

    contextMenuTargets.forEach((target) => {
      target.addEventListener('contextmenu', onContextMenu, true)
    })
    mountInfo.el.addEventListener('mousemove', onMouseMove)
    mountInfo.el.addEventListener('mouseleave', onMouseLeave)
    eventListenerMapRef.current.set(mountInfo.el, {
      onContextMenu,
      onMouseMove,
      onMouseLeave,
      contextMenuTargets
    })
  }

  const editingTask = editingTaskId ? (tasksById[editingTaskId] ?? null) : null
  const handleCloseEditor = (): void => setEditingTaskId(null)
  const safeToggleTask = onToggleTask ?? (() => undefined)
  const safeDeleteTask = onDeleteTask ?? (() => undefined)
  const safeRenameTask = onRenameTask ?? (() => undefined)
  const safeUpdateTaskPriority = onUpdateTaskPriority ?? (() => undefined)
  const safeUpdateTaskType = onUpdateTaskType ?? (() => undefined)
  const safeUpdateTaskTime = onUpdateTaskTime ?? (() => undefined)
  const safeRescheduleTask = onRescheduleTask ?? (() => undefined)

  const handleEventWillUnmount = (mountInfo: EventMountArg): void => {
    const handlers = eventListenerMapRef.current.get(mountInfo.el)
    if (!handlers) {
      return
    }
    handlers.contextMenuTargets.forEach((target) => {
      target.removeEventListener('contextmenu', handlers.onContextMenu, true)
    })
    mountInfo.el.removeEventListener('mousemove', handlers.onMouseMove)
    mountInfo.el.removeEventListener('mouseleave', handlers.onMouseLeave)
    eventListenerMapRef.current.delete(mountInfo.el)
  }

  const handleDayCellDidMount = (info: DayCellMountArg): void => {
    const onDoubleClick = (event: MouseEvent): void => {
      event.preventDefault()
      const iso = toIsoDate(info.date)
      setHoveredTaskCard(null)
      setCalendarContextMenu(null)
      onSelectDate(iso)
      if (!onCreateTask) {
        return
      }
      void onCreateTask(iso)
        .then((task) => {
          if (task) {
            setEditingTaskId(task.id)
          }
        })
        .catch((error) => {
          console.error('Failed to create calendar task', error)
        })
    }
    info.el.addEventListener('dblclick', onDoubleClick)
    dayCellListenerMapRef.current.set(info.el, onDoubleClick)
  }

  const handleDayCellWillUnmount = (info: DayCellMountArg): void => {
    const handler = dayCellListenerMapRef.current.get(info.el)
    if (handler) {
      info.el.removeEventListener('dblclick', handler)
      dayCellListenerMapRef.current.delete(info.el)
    }
  }

  return (
    <section className="calendar-full p-4">
      <div className="workspace-subtle-surface relative rounded-2xl">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          initialDate={selectedDate}
          headerToolbar={false}
          firstDay={0}
          editable
          droppable
          eventResizableFromStart
          fixedMirrorParent={mirrorParent}
          dragRevertDuration={0}
          eventDragMinDistance={8}
          eventDisplay="block"
          dayMaxEventRows={false}
          dayMaxEvents={false}
          displayEventTime={false}
          drop={handleExternalDrop}
          eventDragStart={handleEventDragStart}
          eventDrop={handleEventDrop}
          eventDragStop={handleEventDragStop}
          eventResizeStart={handleEventResizeStart}
          eventResize={handleEventResize}
          eventResizeStop={handleEventResizeStop}
          eventMouseEnter={handleEventMouseEnter}
          eventMouseLeave={handleEventMouseLeave}
          eventDidMount={handleEventDidMount}
          eventWillUnmount={handleEventWillUnmount}
          dayCellDidMount={handleDayCellDidMount}
          dayCellWillUnmount={handleDayCellWillUnmount}
          dateClick={(info) => onSelectDate(info.dateStr)}
          eventClick={(info) => {
            if (info.jsEvent.button !== 0) {
              return
            }
            info.jsEvent.preventDefault()
            info.jsEvent.stopPropagation()
            const source = String(info.event.extendedProps.source ?? 'task')
            if (source === 'milestone') {
              const projectId = String(info.event.extendedProps.projectId ?? '')
              const milestoneId = String(info.event.extendedProps.milestoneId ?? '')
              if (projectId && milestoneId) {
                onOpenMilestone?.(projectId, milestoneId)
              }
              return
            }
            const date = info.event.start ? toIsoDate(info.event.start) : selectedDate
            setHoveredTaskCard(null)
            setCalendarContextMenu(null)
            onSelectDate(date)
            setEditingTaskId(info.event.id)
          }}
          eventClassNames={(arg) => {
            const source = String(arg.event.extendedProps.source ?? 'task')
            if (source === 'milestone') {
              return [
                'beacon-task-event',
                'beacon-calendar-milestone',
                arg.event.extendedProps.completed ? 'beacon-task-completed' : ''
              ]
            }
            const task = tasksById[arg.event.id]
            if (!task) {
              return ['calendar-task-card-shell', 'beacon-task-event', 'beacon-task-assignment']
            }
            return [
              'calendar-task-card-shell',
              'beacon-task-event',
              `beacon-task-${task.taskType || 'assignment'}`,
              task.completed ? 'beacon-task-completed' : ''
            ]
          }}
          dayCellClassNames={(arg) => {
            const iso = toIsoDate(arg.date)
            return iso === selectedDate ? ['beacon-day-selected'] : []
          }}
          eventContent={(arg) => {
            const source = String(arg.event.extendedProps.source ?? 'task')
            if (source === 'milestone') {
              const isCompleted = Boolean(arg.event.extendedProps.completed)
              const projectName = String(arg.event.extendedProps.projectName ?? '')
              return (
                <div className="beacon-task-inner w-full rounded px-1.5 py-1">
                  <div className="beacon-task-row flex items-center justify-between gap-1.5">
                    <span className="flex min-w-0 items-center gap-1">
                      <span
                        aria-hidden="true"
                        className="inline-flex items-center"
                        title={isCompleted ? 'Completed milestone' : 'Pending milestone'}
                      >
                        <span
                          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                            isCompleted
                              ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--primary-foreground)]'
                              : 'workspace-subtle-control border-[var(--line-strong)]'
                          }`}
                        >
                          {isCompleted ? <Check size={8} strokeWidth={3} /> : null}
                        </span>
                      </span>
                      <span className="min-w-0 truncate text-[10px] font-medium text-[var(--muted)]">
                        {projectName}
                      </span>
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] font-medium text-[var(--text)]">
                    {arg.event.title}
                  </div>
                </div>
              )
            }
            const task = tasksById[arg.event.id]
            if (!task) {
              return <span className="truncate text-[var(--text)]">{arg.event.title}</span>
            }

            return <CalendarTaskCard task={task} onToggle={safeToggleTask} />
          }}
        />
      </div>
      {calendarContextMenu && tasksById[calendarContextMenu.taskId] ? (
        <TaskContextMenu
          key={`${calendarContextMenu.taskId}-${calendarContextMenu.nonce}`}
          task={tasksById[calendarContextMenu.taskId]}
          selectedDate={selectedDate}
          onToggle={safeToggleTask}
          onDelete={safeDeleteTask}
          onRename={safeRenameTask}
          onUpdatePriority={safeUpdateTaskPriority}
          onUpdateTaskType={safeUpdateTaskType}
          onUpdateTime={safeUpdateTaskTime}
          onUpdateReminders={onUpdateTaskReminders ?? (() => undefined)}
          onScheduleTask={(taskId, date) => safeRescheduleTask(taskId, date)}
          onUnscheduleTask={(taskId) => safeRescheduleTask(taskId, undefined)}
        >
          <span
            ref={contextMenuTriggerRef}
            className="pointer-events-none fixed h-px w-px opacity-0"
            style={{
              left: `${calendarContextMenu.x}px`,
              top: `${calendarContextMenu.y}px`
            }}
            aria-hidden="true"
          />
        </TaskContextMenu>
      ) : null}
      {hoveredTaskCard ? (
        <CalendarTaskHoverCard
          task={hoveredTaskCard.task}
          x={hoveredTaskCard.x}
          y={hoveredTaskCard.y}
        />
      ) : null}
      {editingTask ? (
        <TaskEditDialog
          task={editingTask}
          onClose={handleCloseEditor}
          onRename={safeRenameTask}
          onUpdateTaskPriority={safeUpdateTaskPriority}
          onUpdateTaskType={safeUpdateTaskType}
          onUpdateTaskTime={safeUpdateTaskTime}
          onRescheduleTask={safeRescheduleTask}
          onDelete={safeDeleteTask}
        />
      ) : null}
    </section>
  )
}

interface TaskEditDialogProps {
  task: CalendarTask
  onClose: () => void
  onRename: (taskId: string, title: string) => void
  onUpdateTaskPriority: (taskId: string, priority: TaskPriority) => void
  onUpdateTaskType: (taskId: string, taskType: CalendarTaskType) => void
  onUpdateTaskTime: (taskId: string, time: string | undefined) => void
  onRescheduleTask: (taskId: string, date: string | undefined) => void
  onDelete: (taskId: string) => void
}

export function TaskEditDialog({
  task,
  onClose,
  onRename,
  onUpdateTaskPriority,
  onUpdateTaskType,
  onUpdateTaskTime,
  onRescheduleTask,
  onDelete
}: TaskEditDialogProps): ReactElement {
  const [title, setTitle] = useState(task.title)
  const [priority, setPriority] = useState<TaskPriority>(task.priority ?? 'low')
  const [taskType, setTaskType] = useState<CalendarTaskType>(task.taskType ?? 'assignment')
  const [date, setDate] = useState(task.date ?? '')
  const [time, setTime] = useState(task.time ?? '')
  const skipAutoSaveRef = useRef(false)

  useEffect(() => {
    setTitle(task.title)
    setPriority(task.priority ?? 'low')
    setTaskType(task.taskType ?? 'assignment')
    setDate(task.date ?? '')
    setTime(task.time ?? '')
    skipAutoSaveRef.current = false
  }, [task.id, task.title, task.priority, task.taskType, task.date, task.time])

  const handleAutoSave = (): void => {
    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false
      return
    }
    const trimmedTitle = title.trim()
    if (trimmedTitle && trimmedTitle !== task.title) {
      onRename(task.id, trimmedTitle)
    }
    if ((task.priority ?? 'low') !== priority) {
      onUpdateTaskPriority(task.id, priority)
    }
    if ((task.taskType ?? 'assignment') !== taskType) {
      onUpdateTaskType(task.id, taskType)
    }
    const normalizedTime = time.trim()
    const previousTime = task.time ?? ''
    if (normalizedTime !== previousTime) {
      onUpdateTaskTime(task.id, normalizedTime || undefined)
    }
    const normalizedDate = date.trim()
    const previousDate = task.date ?? ''
    if (normalizedDate !== previousDate) {
      onRescheduleTask(task.id, normalizedDate || undefined)
    }
  }

  const handleDelete = (): void => {
    skipAutoSaveRef.current = true
    onDelete(task.id)
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          handleAutoSave()
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
          <DialogDescription>Update task details without leaving the calendar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Title
            </label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1"
              placeholder="Task title"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Priority
            </label>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as TaskPriority)}
              className="workspace-subtle-control mt-1 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Type
            </label>
            <select
              value={taskType}
              onChange={(event) => setTaskType(event.target.value as CalendarTaskType)}
              className="workspace-subtle-control mt-1 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
            >
              {CALENDAR_TASK_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Date
            </label>
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Time
            </label>
            <Input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter className="flex justify-end">
          <button
            type="button"
            onClick={handleDelete}
            className="workspace-subtle-control flex h-9 w-9 items-center justify-center rounded border border-[var(--line)] p-1.5 text-[var(--text)]"
            title="Delete task"
          >
            <Trash2 size={18} />
            <span className="sr-only">Delete task</span>
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function addIsoDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function setUnscheduledDragState(isActive: boolean): void {
  const unscheduledContainer = document.querySelector<HTMLElement>(
    '[data-unscheduled-task-list="true"]'
  )
  const unscheduledDropZone = document.querySelector<HTMLElement>(
    '[data-unscheduled-drop-zone="true"]'
  )

  if (unscheduledContainer) {
    unscheduledContainer.dataset.calendarDragOver = isActive ? 'true' : 'false'
  }

  if (unscheduledDropZone) {
    unscheduledDropZone.dataset.calendarDragOver = isActive ? 'true' : 'false'
  }
}

function trackUnscheduledDragHover(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => undefined
  }

  const updateDragState = (clientX: number, clientY: number): void => {
    const unscheduledContainer = document.querySelector<HTMLElement>(
      '[data-unscheduled-task-list="true"]'
    )
    if (!unscheduledContainer) {
      return
    }

    const rect = unscheduledContainer.getBoundingClientRect()
    const isInside =
      clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom

    setUnscheduledDragState(isInside)
  }

  const handlePointerMove = (event: PointerEvent | MouseEvent | DragEvent): void => {
    updateDragState(event.clientX, event.clientY)
  }

  window.addEventListener('pointermove', handlePointerMove, true)
  window.addEventListener('mousemove', handlePointerMove, true)
  window.addEventListener('dragover', handlePointerMove, true)

  return () => {
    window.removeEventListener('pointermove', handlePointerMove, true)
    window.removeEventListener('mousemove', handlePointerMove, true)
    window.removeEventListener('dragover', handlePointerMove, true)
    setUnscheduledDragState(false)
  }
}

function buildCalendarSyncSignature(event: CalendarEventInput): string {
  return JSON.stringify({
    source: event.extendedProps.source,
    title: event.title,
    start: event.start,
    end: event.end ?? '',
    editable: event.editable ?? true,
    startEditable: event.startEditable ?? true,
    durationEditable: event.durationEditable ?? true,
    taskId: event.extendedProps.taskId ?? '',
    taskType: event.extendedProps.taskType ?? '',
    priority: event.extendedProps.priority ?? '',
    projectId: event.extendedProps.projectId ?? '',
    projectName: event.extendedProps.projectName ?? '',
    completed: event.extendedProps.completed ?? false,
    milestoneId: event.extendedProps.milestoneId ?? ''
  })
}

function hasCalendarEventChanged(
  currentEvent: EventApi,
  nextEvent: {
    id: string
    title: string
    start: string
    end?: string
  },
  syncSignature: string
): boolean {
  return (
    currentEvent.title !== nextEvent.title ||
    currentEvent.startStr !== nextEvent.start ||
    (currentEvent.endStr ?? '') !== (nextEvent.end ?? '') ||
    String(currentEvent.extendedProps.syncSignature ?? '') !== syncSignature
  )
}
