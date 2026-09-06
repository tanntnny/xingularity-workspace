import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import {
  Draggable,
  DropArg,
  EventDragStartArg,
  EventDragStopArg,
  EventResizeDoneArg
} from '@fullcalendar/interaction'
import {
  DayCellMountArg,
  EventApi,
  EventDropArg,
  EventMountArg,
  EventHoveringArg
} from '@fullcalendar/core'
import {
  CalendarTask,
  CalendarTaskType,
  Project,
  TaskPriority,
  TaskReminder
} from '../../../shared/types'
import type { TaskScheduleOverride } from '../../../shared/types'
import { isTaskStatusDone } from '../../../shared/taskStatus'
import { CalendarTaskCard } from './CalendarTaskCard'
import { TaskContextMenu } from './TaskContextMenu'
import { CalendarTaskHoverCard } from './CalendarTaskHoverCard'
import { DragSource } from './ui/drag-source'
import {
  buildCalendarEvents,
  type CalendarEventInput,
  normalizeCalendarTasks
} from '../lib/calendarTasks'
import { parseIsoDate, toIsoDate } from '../lib/calendarDate'
import { getCalendarTaskHoverPosition } from '../lib/calendarTaskHoverPosition'
import {
  getCalendarTaskDragSession,
  setCalendarTaskDragSession,
  setCalendarTaskUnscheduledDragOver,
  type CalendarTaskDragMode
} from '../lib/calendarTaskDragSession'
import { useCalendarDragAutoScroll } from '../hooks/useCalendarDragAutoScroll'
import type { TaskOpenOptions } from '../lib/taskOpenOptions'

interface CalendarMonthViewProps {
  selectedDate: string
  tasks: CalendarTask[]
  projects?: Project[]
  onSelectDate: (date: string) => void
  onCreateTask?: (date: string) => Promise<CalendarTask>
  onOpenTask?: (taskId: string, options?: TaskOpenOptions) => void
  onDuplicateTask?: (taskId: string) => void | Promise<void>
  onCopyTaskToSchedule?: (taskId: string, schedule: TaskScheduleOverride) => void | Promise<void>
  onRescheduleTask?: (taskId: string, newDate: string | undefined) => void
  onResizeTaskStart?: (taskId: string, newStartDate: string) => void
  onResizeTaskEnd?: (taskId: string, newEndDate: string) => void
  onDeleteTask?: (taskId: string) => void
  onUpdateTask?: (taskId: string, patch: Partial<CalendarTask>) => void
  onUpdateTaskPriority?: (taskId: string, priority: TaskPriority) => void
  onUpdateTaskType?: (taskId: string, taskType: CalendarTaskType) => void
  onUpdateTaskTime?: (taskId: string, time: string | undefined) => void
  onUpdateTaskReminders?: (taskId: string, reminders: TaskReminder[]) => void
}

export function CalendarMonthView({
  selectedDate,
  tasks,
  projects = [],
  onSelectDate,
  onCreateTask,
  onOpenTask,
  onDuplicateTask,
  onCopyTaskToSchedule,
  onRescheduleTask,
  onResizeTaskStart,
  onResizeTaskEnd,
  onDeleteTask,
  onUpdateTask,
  onUpdateTaskPriority,
  onUpdateTaskType,
  onUpdateTaskTime,
  onUpdateTaskReminders
}: CalendarMonthViewProps): ReactElement {
  const calendarRootRef = useRef<HTMLElement | null>(null)
  const { start: startCalendarDragAutoScroll, stop: stopCalendarDragAutoScroll } =
    useCalendarDragAutoScroll({ rootRef: calendarRootRef })
  const calendarRef = useRef<FullCalendar | null>(null)
  const mirrorParent = typeof document === 'undefined' ? undefined : document.body
  const todayIso = toIsoDate(new Date())
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
  const contextMenuTriggerRef = useRef<HTMLSpanElement | null>(null)
  const contextMenuNonceRef = useRef(0)
  const dayCellListenerMapRef = useRef(new Map<HTMLElement, (event: MouseEvent) => void>())
  const unscheduledDragCleanupRef = useRef<(() => void) | null>(null)
  const dragModeRef = useRef<'move' | 'copy'>('move')
  const activeDragSourceRef = useRef<HTMLElement | null>(null)

  const syncCalendarDragOperation = useCallback((mode: CalendarTaskDragMode): void => {
    const source = activeDragSourceRef.current
    if (source) {
      setCalendarTaskDragVisual(source, mode)
    }
    dragModeRef.current = mode

    const session = getCalendarTaskDragSession()
    if (session && session.mode !== mode) {
      setCalendarTaskDragSession({ ...session, mode })
    }
  }, [])

  const normalizedTasks = useMemo(() => normalizeCalendarTasks(tasks), [tasks])
  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  )
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
    const handleModifierKey = (event: KeyboardEvent): void => {
      if (
        event.key !== 'Alt' &&
        event.key !== 'Option' &&
        event.code !== 'AltLeft' &&
        event.code !== 'AltRight'
      ) {
        return
      }

      if (!activeDragSourceRef.current) {
        return
      }

      syncCalendarDragOperation(event.type === 'keydown' ? 'copy' : 'move')
    }
    const handleDragModifier = (event: DragEvent): void => {
      if (!activeDragSourceRef.current) {
        return
      }

      syncCalendarDragOperation(event.altKey ? 'copy' : 'move')
    }

    window.addEventListener('keydown', handleModifierKey, true)
    window.addEventListener('keyup', handleModifierKey, true)
    window.addEventListener('drag', handleDragModifier, true)
    window.addEventListener('dragover', handleDragModifier, true)

    return () => {
      window.removeEventListener('keydown', handleModifierKey, true)
      window.removeEventListener('keyup', handleModifierKey, true)
      window.removeEventListener('drag', handleDragModifier, true)
      window.removeEventListener('dragover', handleDragModifier, true)
    }
  }, [syncCalendarDragOperation])

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

  const calendarEvents = useMemo(() => buildCalendarEvents(normalizedTasks), [normalizedTasks])

  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (!api) {
      return
    }

    const activeEventIds = new Set<string>()

    for (const event of calendarEvents) {
      activeEventIds.add(event.id)
      const task = tasksById[event.id]
      const project = task?.projectId ? projectsById.get(task.projectId) : undefined
      const syncSignature = buildCalendarSyncSignature(event, project)
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
  }, [calendarEvents, projectsById, tasksById])

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

    let activeSource: HTMLElement | null = null
    let activeDropCell: HTMLElement | null = null

    const setActiveDropCell = (nextCell: HTMLElement | null): void => {
      if (activeDropCell === nextCell) {
        return
      }

      if (activeDropCell) {
        activeDropCell.dataset.calendarDropOver = 'false'
      }
      if (nextCell) {
        nextCell.dataset.calendarDropOver = 'true'
      }
      activeDropCell = nextCell
    }

    const handleExternalDragStart = (event: MonthlyExternalDragEvent): void => {
      activeSource = event.subjectEl
      activeDragSourceRef.current = activeSource
      const mode = getCalendarTaskDragSession()?.mode ?? 'move'
      setCalendarTaskDragVisual(activeSource, mode)
      dragModeRef.current = mode
      startCalendarDragAutoScroll()
    }

    const handleExternalDragMove = (event: MonthlyExternalDragEvent): void => {
      const pointerTarget = document.elementFromPoint(
        event.pageX - window.scrollX,
        event.pageY - window.scrollY
      )
      const dayCell =
        pointerTarget instanceof Element
          ? pointerTarget.closest<HTMLElement>('.calendar-full .fc-daygrid-day')
          : null
      setActiveDropCell(dayCell)
    }

    const handleExternalDragEnd = (): void => {
      if (activeSource) {
        clearCalendarTaskDragVisual(activeSource)
        if (activeDragSourceRef.current === activeSource) {
          activeDragSourceRef.current = null
        }
        activeSource = null
      }
      setActiveDropCell(null)
      dragModeRef.current = 'move'
      stopCalendarDragAutoScroll()
    }

    draggable.dragging.emitter.on('dragstart', handleExternalDragStart)
    draggable.dragging.emitter.on('dragmove', handleExternalDragMove)
    draggable.dragging.emitter.on('dragend', handleExternalDragEnd)

    return () => {
      draggable.dragging.emitter.off('dragstart', handleExternalDragStart)
      draggable.dragging.emitter.off('dragmove', handleExternalDragMove)
      draggable.dragging.emitter.off('dragend', handleExternalDragEnd)
      handleExternalDragEnd()
      draggable.destroy()
    }
  }, [startCalendarDragAutoScroll, stopCalendarDragAutoScroll, syncCalendarDragOperation])

  const handleEventDrop = (dropInfo: EventDropArg): void => {
    if (!dropInfo.event.start) {
      return
    }
    const nextDate = toIsoDate(dropInfo.event.start)
    const sourceTask = tasksById[dropInfo.event.id]
    const mode = dragModeRef.current
    dragModeRef.current = 'move'
    if (mode === 'copy' && sourceTask) {
      dropInfo.revert()
      void onCopyTaskToSchedule?.(sourceTask.id, buildMonthlyDropSchedule(sourceTask, nextDate))
      return
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
    const mode = dragModeRef.current
    const nextDate = toIsoDate(dropInfo.date)
    const sourceTask = tasksById[taskId]
    if (mode === 'copy' && sourceTask) {
      void onCopyTaskToSchedule?.(taskId, buildMonthlyDropSchedule(sourceTask, nextDate))
      return
    }
    onRescheduleTask?.(taskId, nextDate)
  }

  const handleEventDragStop = (dragInfo: EventDragStopArg): void => {
    clearCalendarTaskDragVisual(dragInfo.el)
    if (activeDragSourceRef.current === dragInfo.el) {
      activeDragSourceRef.current = null
    }
    unscheduledDragCleanupRef.current?.()
    unscheduledDragCleanupRef.current = null
    stopCalendarDragAutoScroll()
    setIsInteracting(false)

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
      const mode = dragModeRef.current
      dragModeRef.current = 'move'
      if (mode === 'copy') {
        void onCopyTaskToSchedule?.(dragInfo.event.id, {})
      } else {
        onRescheduleTask?.(dragInfo.event.id, undefined)
      }
    }
  }

  const handleEventDragStart = (dragInfo: EventDragStartArg): void => {
    const mode: CalendarTaskDragMode = dragInfo.jsEvent.altKey ? 'copy' : 'move'
    activeDragSourceRef.current = dragInfo.el
    dragModeRef.current = mode
    setCalendarTaskDragVisual(dragInfo.el, mode)
    unscheduledDragCleanupRef.current?.()
    unscheduledDragCleanupRef.current = trackUnscheduledDragHover()
    startCalendarDragAutoScroll()
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

    const task = tasksById[hoverInfo.event.id]
    if (!task) {
      return
    }

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
    const taskId = mountInfo.event.id
    mountInfo.el.classList.add('motion-calendar-event')
    const onMouseMove = (event: MouseEvent): void => {
      if (isInteractingRef.current) {
        return
      }
      const { x, y } = getCalendarTaskHoverPosition(event.clientX, event.clientY)
      const task = tasksByIdRef.current[taskId]
      if (!task) {
        return
      }
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

  const safeDeleteTask = onDeleteTask ?? (() => undefined)
  const safeUpdateTaskPriority = onUpdateTaskPriority ?? (() => undefined)
  const safeUpdateTaskType = onUpdateTaskType ?? (() => undefined)
  const safeUpdateTaskStatus = onUpdateTask ?? (() => undefined)
  const safeUpdateTaskTime = onUpdateTaskTime ?? (() => undefined)
  const safeRescheduleTask = onRescheduleTask ?? (() => undefined)

  const handleEventWillUnmount = (mountInfo: EventMountArg): void => {
    clearCalendarTaskDragVisual(mountInfo.el)
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
    info.el.dataset.calendarDropZone = 'true'

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
            onOpenTask?.(task.id, { isNewTask: true })
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
    delete info.el.dataset.calendarDropZone
    delete info.el.dataset.calendarDropOver

    const handler = dayCellListenerMapRef.current.get(info.el)
    if (handler) {
      info.el.removeEventListener('dblclick', handler)
      dayCellListenerMapRef.current.delete(info.el)
    }
  }

  return (
    <section
      ref={calendarRootRef}
      className="min-h-full overflow-hidden rounded-b-2xl bg-[var(--calendar-surface)]"
      data-testid="calendar-month-view"
    >
      <div className="calendar-full relative overflow-hidden rounded-b-2xl">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          initialDate={selectedDate}
          headerToolbar={false}
          height="auto"
          firstDay={0}
          fixedWeekCount={false}
          stickyHeaderDates
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
          dayHeaderContent={(arg) => {
            const date = toIsoDate(arg.date)
            const isHighlighted = date === selectedDate || date === todayIso
            const isToday = date === todayIso

            return (
              <div
                className={`flex w-full flex-col items-center bg-card px-3 py-3 text-center transition-colors ${
                  isHighlighted ? 'calendar-date-highlight' : 'calendar-date-highlight-hover'
                }`}
              >
                <span
                  className={`text-sm font-semibold ${
                    isToday ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {formatWeekdayHeaderLabel(arg.date)}
                </span>
              </div>
            )
          }}
          dayCellContent={(arg) => {
            const date = toIsoDate(arg.date)
            const isToday = date === todayIso

            return (
              <div className="flex w-full items-center gap-2 px-1 pt-1">
                {isToday ? (
                  <span className="rounded-sm bg-destructive px-1.5 py-0.5 text-xs font-semibold text-destructive-foreground">
                    today
                  </span>
                ) : null}
                <span className="ml-auto text-sm font-medium text-foreground">
                  {arg.dayNumberText}
                </span>
              </div>
            )
          }}
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
            const date = info.event.start ? toIsoDate(info.event.start) : selectedDate
            setHoveredTaskCard(null)
            setCalendarContextMenu(null)
            onSelectDate(date)
            onOpenTask?.(info.event.id)
          }}
          eventClassNames={(arg) => {
            const task = tasksById[arg.event.id]
            if (!task) {
              return ['rounded-md', 'border', 'bg-card']
            }
            return [
              'calendar-task-event',
              'rounded-md',
              ...(!task.date && task.endDate ? ['calendar-task-deadline-only'] : []),
              ...(arg.isMirror ? ['calendar-task-drag-preview'] : [])
            ]
          }}
          dayCellClassNames={(arg) => {
            const iso = toIsoDate(arg.date)
            return iso === selectedDate || iso === todayIso ? ['calendar-date-highlight'] : []
          }}
          eventContent={(arg) => {
            const task = tasksById[arg.event.id]
            if (!task) {
              return <span className="truncate text-foreground">{arg.event.title}</span>
            }

            return (
              <DragSource
                as="div"
                draggable={false}
                preview="none"
                previewVariant="content"
                data-calendar-task-drag-source="true"
              >
                <CalendarTaskCard
                  task={task}
                  project={task.projectId ? projectsById.get(task.projectId) : undefined}
                  onStatusChange={(taskId, status) =>
                    safeUpdateTaskStatus(taskId, { status, completed: isTaskStatusDone(status) })
                  }
                />
              </DragSource>
            )
          }}
        />
      </div>
      {calendarContextMenu && tasksById[calendarContextMenu.taskId] ? (
        <TaskContextMenu
          key={`${calendarContextMenu.taskId}-${calendarContextMenu.nonce}`}
          task={tasksById[calendarContextMenu.taskId]}
          selectedDate={selectedDate}
          onDelete={safeDeleteTask}
          onDuplicateTask={onDuplicateTask}
          showCopyGestureHint
          onUpdateStatus={(taskId, status) =>
            safeUpdateTaskStatus(taskId, { status, completed: isTaskStatusDone(status) })
          }
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
          project={
            hoveredTaskCard.task.projectId
              ? projectsById.get(hoveredTaskCard.task.projectId)
              : undefined
          }
          x={hoveredTaskCard.x}
          y={hoveredTaskCard.y}
        />
      ) : null}
    </section>
  )
}

function addIsoDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function setCalendarTaskDragVisual(element: HTMLElement | null, mode: CalendarTaskDragMode): void {
  if (!element) {
    return
  }

  element.dataset.dragging = 'true'
  element.dataset.dragOperation = mode

  document
    .querySelectorAll<HTMLElement>(
      '.calendar-full .fc-event.calendar-task-event.fc-event-dragging, .calendar-full .fc-event.calendar-task-event.fc-event-mirror, .fc-event-dragging.calendar-task-event, .fc-event-mirror.calendar-task-event'
    )
    .forEach((mirror) => {
      mirror.dataset.dragging = 'true'
      mirror.dataset.dragOperation = mode
    })
}

function clearCalendarTaskDragVisual(element: HTMLElement | null): void {
  if (!element) {
    return
  }

  element.dataset.dragging = 'false'
  delete element.dataset.dragOperation
}

function buildMonthlyDropSchedule(task: CalendarTask, date: string): TaskScheduleOverride {
  if (!task.date) {
    return {
      date: null,
      endDate: date,
      time: null,
      endTime: null,
      weeklyHeightMode: null
    }
  }

  const sourceEndDate = task.endDate && task.endDate >= task.date ? task.endDate : task.date
  const durationDays = Math.max(
    0,
    Math.round(
      (parseIsoDate(sourceEndDate).getTime() - parseIsoDate(task.date).getTime()) /
        (24 * 60 * 60 * 1000)
    )
  )

  return {
    date,
    endDate: toIsoDate(addIsoDays(parseIsoDate(date), durationDays)),
    time: task.time ?? null,
    endTime: task.endTime ?? null,
    weeklyHeightMode: task.weeklyHeightMode ?? null
  }
}

interface MonthlyExternalDragEvent {
  subjectEl: HTMLElement
  pageX: number
  pageY: number
}

function formatWeekdayHeaderLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long'
  })
}

function setUnscheduledDragState(isActive: boolean): void {
  setCalendarTaskUnscheduledDragOver(isActive)

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

function buildCalendarSyncSignature(
  event: CalendarEventInput,
  project?: Pick<Project, 'name' | 'icon'>
): string {
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
    projectName: project?.name ?? '',
    projectIcon: project?.icon ?? null,
    completed: event.extendedProps.completed ?? false,
    status: event.extendedProps.status ?? '',
    deadlineOnly: event.extendedProps.deadlineOnly ?? false
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
