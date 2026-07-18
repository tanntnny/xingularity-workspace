import { ReactElement, useEffect, useMemo, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
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
import {
  CalendarMilestoneCard,
  CalendarMilestoneDetails,
  CalendarMilestoneHoverCard,
  CalendarMilestoneDialog
} from './CalendarMilestoneDetails'
import { TaskContextMenu } from './TaskContextMenu'
import { CalendarTaskHoverCard } from './CalendarTaskHoverCard'
import { Input } from './ui/input'
import { Select } from './ui/select'
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
  onUpdateTaskSchedule?: (
    taskId: string,
    schedule: {
      date: string | undefined
      endDate: string | undefined
      time: string | undefined
      endTime: string | undefined
    }
  ) => void
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
  onUpdateTaskSchedule,
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
  const [hoveredMilestoneCard, setHoveredMilestoneCard] = useState<{
    milestone: CalendarMilestoneDetails
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
  const [selectedMilestone, setSelectedMilestone] = useState<CalendarMilestoneDetails | null>(null)
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
        onContextMenu?: (event: MouseEvent) => void
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
    isInteractingRef.current = isInteracting
  }, [isInteracting])

  useEffect(() => {
    const dayCellListenerMap = dayCellListenerMapRef.current

    return () => {
      unscheduledDragCleanupRef.current?.()
      dayCellListenerMap.forEach((handler, el) => {
        el.removeEventListener('dblclick', handler)
      })
      dayCellListenerMap.clear()
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
  }, [calendarEvents])

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

    const { x, y } = getCalendarTaskHoverPosition(
      hoverInfo.jsEvent.clientX,
      hoverInfo.jsEvent.clientY
    )

    const source = String(hoverInfo.event.extendedProps.source ?? 'task')
    if (source === 'milestone') {
      const milestone = getMilestoneDetailsFromEvent(hoverInfo.event)
      if (!milestone) {
        return
      }
      setHoveredTaskCard(null)
      setHoveredMilestoneCard({
        milestone,
        x,
        y
      })
      return
    }

    const task = tasksById[hoverInfo.event.id]
    if (!task) {
      return
    }

    setHoveredMilestoneCard(null)
    setHoveredTaskCard({
      task,
      x,
      y
    })
  }

  const handleEventMouseLeave = (): void => {
    setHoveredTaskCard(null)
    setHoveredMilestoneCard(null)
  }

  const handleEventDidMount = (mountInfo: EventMountArg): void => {
    const source = String(mountInfo.event.extendedProps.source ?? 'task')
    const taskId = mountInfo.event.id
    const onMouseMove = (event: MouseEvent): void => {
      if (isInteractingRef.current) {
        return
      }
      const { x, y } = getCalendarTaskHoverPosition(event.clientX, event.clientY)
      if (source === 'milestone') {
        const milestone = getMilestoneDetailsFromEvent(mountInfo.event)
        if (!milestone) {
          return
        }
        setHoveredTaskCard(null)
        setHoveredMilestoneCard((current) => {
          if (
            !current ||
            current.milestone.projectId !== milestone.projectId ||
            current.milestone.milestoneId !== milestone.milestoneId
          ) {
            return {
              milestone,
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
        return
      }
      const task = tasksByIdRef.current[taskId]
      if (!task) {
        return
      }
      setHoveredMilestoneCard(null)
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
      setHoveredMilestoneCard(null)
    }

    const onContextMenu =
      source === 'task'
        ? (event: MouseEvent): void => {
            event.preventDefault()
            event.stopPropagation()
            contextMenuNonceRef.current += 1
            setHoveredTaskCard(null)
            setHoveredMilestoneCard(null)
            setCalendarContextMenu({
              taskId,
              x: event.clientX,
              y: event.clientY,
              nonce: contextMenuNonceRef.current
            })
          }
        : undefined

    const contextMenuTargets = [
      mountInfo.el,
      mountInfo.el.querySelector<HTMLElement>('.fc-event-main')
    ].filter((target): target is HTMLElement => Boolean(target))

    if (onContextMenu) {
      contextMenuTargets.forEach((target) => {
        target.addEventListener('contextmenu', onContextMenu, true)
      })
    }
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
  const safeUpdateTaskSchedule = onUpdateTaskSchedule ?? (() => undefined)
  const safeRescheduleTask = onRescheduleTask ?? (() => undefined)

  const handleEventWillUnmount = (mountInfo: EventMountArg): void => {
    const handlers = eventListenerMapRef.current.get(mountInfo.el)
    if (!handlers) {
      return
    }
    if (handlers.onContextMenu) {
      handlers.contextMenuTargets.forEach((target) => {
        target.removeEventListener('contextmenu', handlers.onContextMenu as EventListener, true)
      })
    }
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
    <section
      className="calendar-full min-h-0 overflow-hidden rounded-b-2xl"
      data-testid="calendar-month-view"
    >
      <div className="relative overflow-hidden">
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
              const milestone = getMilestoneDetailsFromEvent(info.event)
              if (milestone) {
                setHoveredTaskCard(null)
                setHoveredMilestoneCard(null)
                setCalendarContextMenu(null)
                setSelectedMilestone(milestone)
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
              const milestone = getMilestoneDetailsFromEvent(arg.event)
              if (!milestone) {
                return <span className="truncate text-[var(--text)]">{arg.event.title}</span>
              }
              return (
                <div className="beacon-task-inner w-full rounded px-1.5 py-1">
                  <CalendarMilestoneCard milestone={milestone} />
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
      {selectedMilestone ? (
        <CalendarMilestoneDialog
          milestone={selectedMilestone}
          onClose={() => setSelectedMilestone(null)}
          onOpenMilestone={onOpenMilestone}
        />
      ) : null}
      {hoveredMilestoneCard ? (
        <CalendarMilestoneHoverCard
          milestone={hoveredMilestoneCard.milestone}
          x={hoveredMilestoneCard.x}
          y={hoveredMilestoneCard.y}
        />
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
          key={editingTask.id}
          task={editingTask}
          onClose={handleCloseEditor}
          onRename={safeRenameTask}
          onUpdateTaskPriority={safeUpdateTaskPriority}
          onUpdateTaskType={safeUpdateTaskType}
          onUpdateTaskSchedule={safeUpdateTaskSchedule}
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
  onUpdateTaskSchedule: (
    taskId: string,
    schedule: {
      date: string | undefined
      endDate: string | undefined
      time: string | undefined
      endTime: string | undefined
    }
  ) => void
  onDelete: (taskId: string) => void
}

export function TaskEditDialog({
  task,
  onClose,
  onRename,
  onUpdateTaskPriority,
  onUpdateTaskType,
  onUpdateTaskSchedule,
  onDelete
}: TaskEditDialogProps): ReactElement {
  const [title, setTitle] = useState(task.title)
  const [priority, setPriority] = useState<TaskPriority>(task.priority ?? 'low')
  const [taskType, setTaskType] = useState<CalendarTaskType>(task.taskType ?? 'assignment')
  const [date, setDate] = useState(task.date ?? '')
  const [endDate, setEndDate] = useState(task.endDate ?? '')
  const [time, setTime] = useState(task.time ?? '')
  const [endTime, setEndTime] = useState(task.endTime ?? '')
  const skipAutoSaveRef = useRef(false)

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
    const normalizedDate = date.trim()
    const normalizedEndDate = endDate.trim()
    const normalizedTime = time.trim()
    const normalizedEndTime = endTime.trim()
    const previousDate = task.date ?? ''
    const previousEndDate = task.endDate ?? ''
    const previousTime = task.time ?? ''
    const previousEndTime = task.endTime ?? ''
    if (
      normalizedDate !== previousDate ||
      normalizedEndDate !== previousEndDate ||
      normalizedTime !== previousTime ||
      normalizedEndTime !== previousEndTime
    ) {
      onUpdateTaskSchedule(task.id, {
        date: normalizedDate || undefined,
        endDate: normalizedEndDate || undefined,
        time: normalizedTime || undefined,
        endTime: normalizedEndTime || undefined
      })
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
            <Select
              value={priority}
              onChange={(event) => setPriority(event.target.value as TaskPriority)}
              className="mt-1 w-full"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Type
            </label>
            <Select
              value={taskType}
              onChange={(event) => setTaskType(event.target.value as CalendarTaskType)}
              className="mt-1 w-full"
            >
              {CALENDAR_TASK_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Start date
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
                Start time
              </label>
              <Input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                End date
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                End time
              </label>
              <Input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="mt-1"
              />
            </div>
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
    projectIcon: event.extendedProps.projectIcon ?? null,
    completed: event.extendedProps.completed ?? false,
    milestoneId: event.extendedProps.milestoneId ?? '',
    milestoneDescription: event.extendedProps.milestoneDescription ?? '',
    milestoneDueDate: event.extendedProps.milestoneDueDate ?? '',
    milestoneStatus: event.extendedProps.milestoneStatus ?? '',
    milestoneCompletedSubtaskCount: event.extendedProps.milestoneCompletedSubtaskCount ?? 0,
    milestoneSubtaskCount: event.extendedProps.milestoneSubtaskCount ?? 0,
    milestoneProgressPercent: event.extendedProps.milestoneProgressPercent ?? 0
  })
}

function getMilestoneDetailsFromEvent(event: EventApi): CalendarMilestoneDetails | null {
  const projectId = String(event.extendedProps.projectId ?? '')
  const milestoneId = String(event.extendedProps.milestoneId ?? '')
  const projectName = String(event.extendedProps.projectName ?? '')

  if (!projectId || !milestoneId || !projectName) {
    return null
  }

  return {
    title: event.title,
    projectId,
    projectName,
    projectIcon: event.extendedProps.projectIcon,
    milestoneId,
    milestoneDescription:
      typeof event.extendedProps.milestoneDescription === 'string'
        ? event.extendedProps.milestoneDescription
        : undefined,
    milestoneDueDate:
      typeof event.extendedProps.milestoneDueDate === 'string'
        ? event.extendedProps.milestoneDueDate
        : undefined,
    milestoneStatus: event.extendedProps.milestoneStatus,
    milestoneCompletedSubtaskCount:
      typeof event.extendedProps.milestoneCompletedSubtaskCount === 'number'
        ? event.extendedProps.milestoneCompletedSubtaskCount
        : undefined,
    milestoneSubtaskCount:
      typeof event.extendedProps.milestoneSubtaskCount === 'number'
        ? event.extendedProps.milestoneSubtaskCount
        : undefined,
    milestoneProgressPercent:
      typeof event.extendedProps.milestoneProgressPercent === 'number'
        ? event.extendedProps.milestoneProgressPercent
        : undefined,
    completed: Boolean(event.extendedProps.completed)
  }
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
