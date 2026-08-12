import {
  DragEvent,
  MouseEvent as ReactMouseEvent,
  ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  CalendarTask,
  CalendarTaskType,
  Project,
  TaskPriority,
  WeeklyHeightMode
} from '../../../shared/types'
import {
  buildWeeklyCalendarEntries,
  layoutWeeklyAllDayItems,
  type WeeklyCalendarAllDayLayout,
  normalizeCalendarTasks
} from '../lib/calendarTasks'
import { getCalendarTaskHoverPosition } from '../lib/calendarTaskHoverPosition'
import {
  buildResizedTimedRange,
  formatWeeklyTimeLabel,
  layoutWeeklyTimedTasks,
  minutesToPixels,
  minutesToTime,
  normalizeTimedRange,
  pixelsToMinutes,
  snapMinutes,
  WEEKLY_DAY_HEIGHT_PX,
  WEEKLY_HOUR_HEIGHT_PX,
  WEEKLY_MAX_END_MINUTES,
  WEEKLY_MIN_DURATION_MINUTES,
  shouldShowWeeklyProject,
  type WeeklyTimedTaskLayout
} from '../lib/calendarWeekLayout'
import {
  buildWeeklyAllDayDropIndicator,
  buildWeeklyAllDayDropSchedule,
  buildWeeklyTimedCreateSchedule,
  buildWeeklyTimedDropPreview,
  buildWeeklyTimedDropSchedule
} from '../lib/calendarWeekDrag'
import {
  clearCalendarTaskDragSession,
  getCalendarTaskDragSession,
  setCalendarTaskDragSession
} from '../lib/calendarTaskDragSession'
import { isDeleteShortcut } from '../lib/isDeleteShortcut'
import { CalendarTaskCard } from './CalendarTaskCard'
import { CalendarTaskHoverCard } from './CalendarTaskHoverCard'
import { TaskEditDialog } from './TaskEditDialog'
import { DragSource } from './ui/drag-source'
import { DropZone } from './ui/drop-zone'

interface CalendarWeekViewProps {
  selectedDate: string
  tasks: CalendarTask[]
  projects?: Project[]
  onSelectDate: (date: string) => void
  onCreateTask?: (schedule: {
    date: string
    endDate: undefined
    time: string
    endTime: string
  }) => Promise<CalendarTask>
  onRescheduleTask?: (taskId: string, newDate: string | undefined) => void
  onDeleteTask?: (taskId: string) => void
  onUpdateTask?: (taskId: string, patch: Partial<CalendarTask>) => void
  onRenameTask?: (taskId: string, newTitle: string) => void
  onUpdateTaskPriority?: (taskId: string, priority: TaskPriority) => void
  onUpdateTaskType?: (taskId: string, taskType: CalendarTaskType) => void
  onUpdateTaskProject?: (taskId: string, projectId: string | undefined) => void
  onUpdateTaskSchedule?: (
    taskId: string,
    schedule: {
      date: string | undefined
      endDate: string | undefined
      time: string | undefined
      endTime: string | undefined
      weeklyHeightMode?: WeeklyHeightMode
    }
  ) => void
}

type ResizeStartInteractionState = {
  kind: 'resize-start'
  taskId: string
  previewDate: string
  previewStartMinutes: number
  previewEndMinutes: number
  fixedEndMinutes: number
}

type ResizeEndInteractionState = {
  kind: 'resize-end'
  taskId: string
  previewDate: string
  previewStartMinutes: number
  previewEndMinutes: number
  fixedStartMinutes: number
}

type TimedInteractionState = ResizeStartInteractionState | ResizeEndInteractionState

type WeeklyTaskDragState = {
  taskId: string
  pointerOffsetMinutes: number
}

type TimedDropIndicatorState = {
  date: string
  topPx: number
  heightPx: number
  heightMode: WeeklyHeightMode
  task?: CalendarTask
}

type AllDayDropIndicatorState = {
  startDate: string
  endDate: string
  columnStart: number
  columnSpan: number
}

const TIME_SLOTS = Array.from({ length: 24 }, (_, hour) => ({
  hour,
  label: formatWeeklyTimeLabel(hour)
}))
const WEEKLY_TIME_GUTTER_WIDTH_PX = 72
const WEEKLY_CELL_PADDING_X_PX = 2
const WEEKLY_CELL_PADDING_Y_PX = 8
const WEEKLY_ALL_DAY_ROW_HEIGHT_PX = 44
const WEEKLY_ALL_DAY_ROW_GAP_PX = 8
const WEEKLY_ALL_DAY_CELL_PADDING_X_PX = WEEKLY_CELL_PADDING_X_PX
const WEEKLY_ALL_DAY_SURFACE_PADDING_PX = 8
const WEEKLY_ALL_DAY_MIN_HEIGHT_PX = 92
const WEEKLY_TIMED_SURFACE_HEIGHT_PX = WEEKLY_DAY_HEIGHT_PX + WEEKLY_CELL_PADDING_Y_PX * 2
const WEEKLY_TASK_RESIZE_BAND_MAX_PX = 10
const NOOP_UPDATE_TASK_SCHEDULE: NonNullable<CalendarWeekViewProps['onUpdateTaskSchedule']> = () =>
  undefined

interface WeeklyTimeScaleMetrics {
  topPx: number
  heightPx: number
}

export function CalendarWeekView({
  selectedDate,
  tasks,
  projects = [],
  onSelectDate,
  onCreateTask,
  onRescheduleTask,
  onDeleteTask,
  onUpdateTask,
  onRenameTask,
  onUpdateTaskPriority,
  onUpdateTaskType,
  onUpdateTaskProject,
  onUpdateTaskSchedule
}: CalendarWeekViewProps): ReactElement {
  const [currentDateTime, setCurrentDateTime] = useState(() => new Date())
  const [timeScaleMetrics, setTimeScaleMetrics] = useState<WeeklyTimeScaleMetrics>(() => ({
    topPx: WEEKLY_CELL_PADDING_Y_PX,
    heightPx: WEEKLY_DAY_HEIGHT_PX
  }))
  const selected = useMemo(() => parseIsoDate(selectedDate), [selectedDate])
  const weekStart = useMemo(() => startOfWeekIso(selected), [selected])
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addIsoDays(weekStart, index)
        return {
          date,
          value: parseIsoDate(date)
        }
      }),
    [weekStart]
  )
  const todayIso = toIsoDate(currentDateTime)
  const normalizedTasks = useMemo(() => normalizeCalendarTasks(tasks), [tasks])
  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  )
  const tasksById = useMemo(
    () => Object.fromEntries(normalizedTasks.map((task) => [task.id, task])),
    [normalizedTasks]
  )
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [timedDropIndicator, setTimedDropIndicator] = useState<TimedDropIndicatorState | null>(null)
  const [allDayDropIndicator, setAllDayDropIndicator] = useState<AllDayDropIndicatorState | null>(
    null
  )
  const [hoveredTaskCard, setHoveredTaskCard] = useState<{
    task: CalendarTask
    x: number
    y: number
  } | null>(null)
  const [timedInteraction, setTimedInteraction] = useState<TimedInteractionState | null>(null)
  const daySurfaceRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const timeScaleRef = useRef<HTMLDivElement | null>(null)
  const timedInteractionRef = useRef<TimedInteractionState | null>(null)
  const timedInteractionCleanupRef = useRef<(() => void) | null>(null)
  const dragStateRef = useRef<WeeklyTaskDragState | null>(null)
  const suppressTaskOpenRef = useRef<string | null>(null)

  const previewTask = useMemo(() => {
    if (!timedInteraction) {
      return null
    }

    const task = tasksById[timedInteraction.taskId]
    if (!task) {
      return null
    }

    return {
      ...task,
      date: timedInteraction.previewDate,
      endDate: undefined,
      time: minutesToTime(timedInteraction.previewStartMinutes),
      endTime: minutesToTime(timedInteraction.previewEndMinutes)
    }
  }, [timedInteraction, tasksById])

  const effectiveTasks = useMemo(() => {
    if (!previewTask) {
      return normalizedTasks
    }

    return normalizedTasks.map((task) => (task.id === previewTask.id ? previewTask : task))
  }, [normalizedTasks, previewTask])

  const { timedTasks, allDayItems } = useMemo(
    () => buildWeeklyCalendarEntries(effectiveTasks, weekStart),
    [effectiveTasks, weekStart]
  )
  const timedLayouts = useMemo(
    () =>
      layoutWeeklyTimedTasks(
        timedTasks.map((entry) => ({
          taskId: entry.task.id,
          date: entry.date,
          startMinutes: entry.startMinutes,
          endMinutes: entry.startMinutes + entry.durationMinutes,
          heightMode: entry.task.weeklyHeightMode
        }))
      ),
    [timedTasks]
  )
  const timedLayoutsByDate = useMemo(() => {
    const grouped: Record<string, WeeklyTimedTaskLayout[]> = {}
    for (const layout of timedLayouts) {
      grouped[layout.date] ??= []
      grouped[layout.date]!.push(layout)
    }
    return grouped
  }, [timedLayouts])
  const timedTasksById = useMemo(
    () => Object.fromEntries(timedTasks.map((entry) => [entry.task.id, entry.task])),
    [timedTasks]
  )
  const allDayLayouts = useMemo(
    () => layoutWeeklyAllDayItems(allDayItems, weekStart),
    [allDayItems, weekStart]
  )
  const allDayRowCount = useMemo(
    () => allDayLayouts.reduce((max, item) => Math.max(max, item.row + 1), 0),
    [allDayLayouts]
  )
  const allDaySurfaceMinHeightPx = useMemo(() => {
    const occupiedHeight =
      allDayRowCount > 0
        ? WEEKLY_ALL_DAY_SURFACE_PADDING_PX * 2 +
          allDayRowCount * WEEKLY_ALL_DAY_ROW_HEIGHT_PX +
          (allDayRowCount - 1) * WEEKLY_ALL_DAY_ROW_GAP_PX
        : WEEKLY_ALL_DAY_MIN_HEIGHT_PX

    return Math.max(WEEKLY_ALL_DAY_MIN_HEIGHT_PX, occupiedHeight)
  }, [allDayRowCount])

  const editingTask = editingTaskId ? (tasksById[editingTaskId] ?? null) : null
  const currentTimeIndicator = useMemo(() => {
    if (!weekDays.some(({ date }) => date === todayIso)) {
      return null
    }

    const minutes =
      currentDateTime.getHours() * 60 +
      currentDateTime.getMinutes() +
      currentDateTime.getSeconds() / 60

    return {
      date: todayIso,
      topPx:
        timeScaleMetrics.topPx +
        (clampNumber(minutes, 0, 24 * 60) / (24 * 60)) * timeScaleMetrics.heightPx,
      label: formatCurrentTimeIndicatorLabel(currentDateTime)
    }
  }, [currentDateTime, timeScaleMetrics, todayIso, weekDays])
  const safeDeleteTask = onDeleteTask ?? (() => undefined)
  const safeRenameTask = onRenameTask ?? (() => undefined)
  const safeUpdateTaskPriority = onUpdateTaskPriority ?? (() => undefined)
  const safeUpdateTaskType = onUpdateTaskType ?? (() => undefined)
  const safeUpdateTaskStatus = onUpdateTask ?? (() => undefined)
  const safeUpdateTaskSchedule = onUpdateTaskSchedule ?? NOOP_UPDATE_TASK_SCHEDULE

  useEffect(() => {
    return () => {
      timedInteractionCleanupRef.current?.()
      timedInteractionCleanupRef.current = null
    }
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentDateTime(new Date())
    }, 30000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    const node = timeScaleRef.current
    if (!node) {
      return
    }

    const syncTimeScaleMetrics = (): void => {
      const nextMetrics = {
        topPx: node.offsetTop,
        heightPx: node.clientHeight
      }

      setTimeScaleMetrics((current) =>
        current.topPx === nextMetrics.topPx && current.heightPx === nextMetrics.heightPx
          ? current
          : nextMetrics
      )
    }

    syncTimeScaleMetrics()
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncTimeScaleMetrics)
    resizeObserver?.observe(node)
    window.addEventListener('resize', syncTimeScaleMetrics)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', syncTimeScaleMetrics)
    }
  }, [weekStart])

  const setTimedInteractionState = (next: TimedInteractionState | null): void => {
    timedInteractionRef.current = next
    setTimedInteraction(next)
  }

  const commitTimedInteraction = (current: TimedInteractionState): void => {
    const task = tasksById[current.taskId]
    if (!task) {
      return
    }

    const nextTime = minutesToTime(current.previewStartMinutes)
    const nextEndTime = minutesToTime(current.previewEndMinutes)
    const nextSchedule = {
      date: current.previewDate,
      endDate: undefined,
      time: nextTime,
      endTime: nextEndTime,
      weeklyHeightMode: 'duration' as const
    }

    if (hasTimedTaskScheduleChanged(task, nextSchedule)) {
      safeUpdateTaskSchedule(task.id, nextSchedule)
      suppressTaskOpenRef.current = task.id
    }
  }

  const beginTimedInteraction = (initialState: TimedInteractionState): void => {
    timedInteractionCleanupRef.current?.()
    const previousUserSelect = document.body.style.userSelect
    const previousCursor = document.body.style.cursor
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'ns-resize'

    const handleMouseMove = (event: MouseEvent): void => {
      const current = timedInteractionRef.current
      if (!current) {
        return
      }

      const column = daySurfaceRefs.current[current.previewDate]
      if (!column) {
        return
      }

      const pointerMinutes = getPointerMinutesForClientY(event.clientY, column)
      const nextRange =
        current.kind === 'resize-start'
          ? buildResizedTimedRange(
              'resize-start',
              pointerMinutes,
              current.previewStartMinutes,
              current.fixedEndMinutes
            )
          : buildResizedTimedRange(
              'resize-end',
              pointerMinutes,
              current.fixedStartMinutes,
              current.previewEndMinutes
            )

      setTimedInteractionState({
        ...current,
        previewStartMinutes: nextRange.startMinutes,
        previewEndMinutes: nextRange.endMinutes
      })
    }

    const handleMouseUp = (): void => {
      const current = timedInteractionRef.current
      if (!current) {
        cleanupTimedInteraction()
        return
      }

      commitTimedInteraction(current)
      setTimedInteractionState(null)
      cleanupTimedInteraction()
    }

    const cleanupTimedInteraction = (): void => {
      document.body.style.userSelect = previousUserSelect
      document.body.style.cursor = previousCursor
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      if (timedInteractionCleanupRef.current === cleanupTimedInteraction) {
        timedInteractionCleanupRef.current = null
      }
    }

    timedInteractionCleanupRef.current = cleanupTimedInteraction
    setTimedInteractionState(initialState)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleTimedDrop = (event: DragEvent<HTMLDivElement>, date: string): void => {
    event.preventDefault()
    setTimedDropIndicator(null)
    setAllDayDropIndicator(null)
    const taskId = getDraggedTaskId(event)
    if (!taskId) {
      return
    }

    const pointerMinutes = getPointerMinutesForClientY(
      event.clientY,
      daySurfaceRefs.current[date] ?? event.currentTarget
    )
    const sourceTask = tasksById[taskId]
    const dragState = dragStateRef.current
    const pointerOffsetMinutes =
      dragState && dragState.taskId === taskId ? dragState.pointerOffsetMinutes : 0

    safeUpdateTaskSchedule(taskId, {
      ...buildWeeklyTimedDropSchedule(sourceTask, date, pointerMinutes, pointerOffsetMinutes)
    })
  }

  const handleTimedCellDoubleClick = (
    event: ReactMouseEvent<HTMLDivElement>,
    date: string
  ): void => {
    if (!onCreateTask || timedInteractionRef.current || dragStateRef.current) {
      return
    }

    const target = event.target
    if (
      target instanceof HTMLElement &&
      target.closest('[data-calendar-week-task="true"], button, [data-weekly-resize-handle="true"]')
    ) {
      return
    }

    const daySurface = daySurfaceRefs.current[date]
    if (!daySurface) {
      return
    }

    event.preventDefault()
    setHoveredTaskCard(null)
    onSelectDate(date)

    void onCreateTask(
      buildWeeklyTimedCreateSchedule(date, getPointerMinutesForClientY(event.clientY, daySurface))
    )
      .then((task) => {
        setEditingTaskId(task.id)
      })
      .catch((error) => {
        console.error('Failed to create weekly calendar task', error)
      })
  }

  const handleAllDayDrop = (event: DragEvent<HTMLElement>, date: string): void => {
    event.preventDefault()
    const taskId = getDraggedTaskId(event)
    setTimedDropIndicator(null)
    setAllDayDropIndicator(null)
    if (!taskId) {
      return
    }

    const sourceTask = tasksById[taskId]
    if (!sourceTask) {
      onRescheduleTask?.(taskId, date)
      return
    }

    safeUpdateTaskSchedule(taskId, buildWeeklyAllDayDropSchedule(sourceTask, date))
  }

  const handleTaskDragStart = (
    event: DragEvent<HTMLElement>,
    task: CalendarTask,
    source: 'timed' | 'all-day'
  ): void => {
    const target = event.target
    if (
      target instanceof HTMLElement &&
      (target.closest('[data-weekly-resize-handle="true"]') || target.closest('button'))
    ) {
      event.preventDefault()
      return
    }

    event.dataTransfer.setData('text/plain', `move:${task.id}`)
    event.dataTransfer.effectAllowed = 'move'
    setHoveredTaskCard(null)
    setTimedDropIndicator(null)
    const dragState = {
      taskId: task.id,
      pointerOffsetMinutes:
        source === 'timed'
          ? snapMinutes(
              pixelsToMinutes(event.clientY - event.currentTarget.getBoundingClientRect().top)
            )
          : 0
    }
    dragStateRef.current = dragState
    setCalendarTaskDragSession(dragState)
  }

  const startResizeInteraction = (
    kind: 'resize-start' | 'resize-end',
    event: ReactMouseEvent<HTMLElement>,
    task: CalendarTask,
    layout: WeeklyTimedTaskLayout
  ): void => {
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    setHoveredTaskCard(null)
    const normalizedRange = normalizeTimedRange(layout.startMinutes, layout.endMinutes)

    beginTimedInteraction(
      kind === 'resize-start'
        ? {
            kind,
            taskId: task.id,
            previewDate: layout.date,
            previewStartMinutes: normalizedRange.startMinutes,
            previewEndMinutes: normalizedRange.endMinutes,
            fixedEndMinutes: normalizedRange.endMinutes
          }
        : {
            kind,
            taskId: task.id,
            previewDate: layout.date,
            previewStartMinutes: normalizedRange.startMinutes,
            previewEndMinutes: normalizedRange.endMinutes,
            fixedStartMinutes: normalizedRange.startMinutes
          }
    )
  }

  const handleTaskDragEnd = (): void => {
    dragStateRef.current = null
    setTimedDropIndicator(null)
    setAllDayDropIndicator(null)
    clearCalendarTaskDragSession()
  }

  const renderAllDayTask = (
    task: CalendarTask,
    layout: WeeklyCalendarAllDayLayout
  ): ReactElement => (
    <DragSource
      as="article"
      key={layout.id}
      rotation={0}
      preview="floating"
      previewVariant="content"
      previewSizing="fit-content"
      tabIndex={0}
      role="group"
      aria-label={`Task ${task.title}`}
      data-testid={`calendar-week-all-day-task:${task.id}`}
      data-span-days={layout.columnSpan}
      data-start-date={layout.startDate}
      data-end-date={layout.endDate}
      style={{
        gridColumn: `${layout.columnStart + 1} / span ${layout.columnSpan}`,
        gridRow: `${layout.row + 1}`,
        marginLeft: `${WEEKLY_ALL_DAY_CELL_PADDING_X_PX}px`,
        marginRight: `${WEEKLY_ALL_DAY_CELL_PADDING_X_PX}px`
      }}
      onDragStart={(event) => handleTaskDragStart(event, task, 'all-day')}
      onDragEnd={handleTaskDragEnd}
      onClick={(event) => {
        event.stopPropagation()
        setHoveredTaskCard(null)
        setEditingTaskId(task.id)
      }}
      onMouseMove={(event) => {
        const { x, y } = getCalendarTaskHoverPosition(event.clientX, event.clientY)
        setHoveredTaskCard((current) => {
          if (!current || current.task.id !== task.id) {
            return { task, x, y }
          }
          return { ...current, x, y }
        })
      }}
      onMouseLeave={() => setHoveredTaskCard(null)}
      onKeyDown={(event) => {
        if (isDeleteShortcut(event)) {
          event.preventDefault()
          safeDeleteTask(task.id)
          return
        }

        if (event.key !== 'Enter' && event.key !== ' ') {
          return
        }
        if (event.target instanceof HTMLElement && event.target.closest('button')) {
          return
        }

        event.preventDefault()
        setHoveredTaskCard(null)
        setEditingTaskId(task.id)
      }}
      className={`pointer-events-auto h-fit cursor-grab self-start rounded-md bg-card transition-colors hover:bg-accent active:cursor-grabbing ${task.completed ? 'line-through' : ''}`}
    >
      <CalendarTaskCard
        task={task}
        compact
        showStatusValue
        heightMode="content"
        project={task.projectId ? projectsById.get(task.projectId) : undefined}
        showProject={shouldShowWeeklyProject(WEEKLY_ALL_DAY_ROW_HEIGHT_PX)}
        showTime={Boolean(task.time || task.endTime)}
        onStatusChange={(taskId, status) =>
          safeUpdateTaskStatus(taskId, { status, completed: status === 'completed' })
        }
        className="min-h-0"
      />
    </DragSource>
  )

  const renderTimedTask = (layout: WeeklyTimedTaskLayout): ReactElement => {
    const task = timedTasksById[layout.taskId]
    if (!task) {
      return <></>
    }

    const isInteracting =
      timedInteraction?.taskId === task.id && timedInteraction.previewDate === layout.date
    const blockStyle = buildTimedTaskStyle(layout)
    const resizeBandPx = getWeeklyResizeBandPx(layout.heightPx)
    const contentStyle =
      layout.heightMode === 'content'
        ? undefined
        : {
            top: '0px',
            right: '0px',
            bottom: '0px',
            left: '0px'
          }

    return (
      <DragSource
        as="article"
        key={task.id}
        rotation={0}
        preview="floating"
        previewVariant="content"
        tabIndex={0}
        role="group"
        aria-label={`Task ${task.title}`}
        data-calendar-week-task="true"
        data-calendar-interacting={isInteracting ? 'true' : 'false'}
        data-testid={`calendar-week-task:${task.id}`}
        style={blockStyle}
        onDragStart={(event) => handleTaskDragStart(event, task, 'timed')}
        onDragEnd={handleTaskDragEnd}
        onMouseMove={(event) => {
          if (timedInteractionRef.current) {
            return
          }
          const { x, y } = getCalendarTaskHoverPosition(event.clientX, event.clientY)
          setHoveredTaskCard((current) => {
            if (!current || current.task.id !== task.id) {
              return { task, x, y }
            }
            return { ...current, x, y }
          })
        }}
        onMouseLeave={() => {
          if (!timedInteractionRef.current) {
            setHoveredTaskCard(null)
          }
        }}
        onKeyDown={(event) => {
          if (isDeleteShortcut(event)) {
            event.preventDefault()
            safeDeleteTask(task.id)
            return
          }

          if (event.key !== 'Enter' && event.key !== ' ') {
            return
          }
          if (event.target instanceof HTMLElement && event.target.closest('button')) {
            return
          }

          event.preventDefault()
          setHoveredTaskCard(null)
          setEditingTaskId(task.id)
        }}
        onClick={(event) => {
          if (event.target instanceof HTMLElement && event.target.closest('button')) {
            return
          }
          if (suppressTaskOpenRef.current === task.id) {
            suppressTaskOpenRef.current = null
            return
          }
          setHoveredTaskCard(null)
          setEditingTaskId(task.id)
        }}
        className={`motion-calendar-event group absolute overflow-hidden rounded-md bg-card transition-colors hover:bg-accent ${
          isInteracting ? 'z-20 shadow-lg' : 'z-10 hover:shadow-md'
        } ${task.completed ? 'line-through' : ''} cursor-grab active:cursor-grabbing`}
      >
        <button
          type="button"
          data-weekly-resize-handle="true"
          aria-label="Resize task start"
          title="Resize task start"
          onMouseDown={(event) => startResizeInteraction('resize-start', event, task, layout)}
          className="absolute inset-x-0 top-0 z-20 cursor-ns-resize rounded-t-sm bg-primary/30 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ height: `${resizeBandPx}px` }}
        />
        <button
          type="button"
          data-weekly-resize-handle="true"
          aria-label="Resize task end"
          title="Resize task end"
          onMouseDown={(event) => startResizeInteraction('resize-end', event, task, layout)}
          className="absolute inset-x-0 bottom-0 z-20 cursor-ns-resize rounded-b-sm bg-primary/30 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ height: `${resizeBandPx}px` }}
        />
        <div
          className={`${layout.heightMode === 'content' ? '' : 'absolute'} z-10 overflow-hidden rounded-sm`}
          style={contentStyle}
        >
          <CalendarTaskCard
            task={task}
            compact
            showStatusValue
            project={task.projectId ? projectsById.get(task.projectId) : undefined}
            showProject={shouldShowWeeklyProject(layout.heightPx)}
            showTime={false}
            heightMode={layout.heightMode === 'content' ? 'content' : 'fill'}
            onStatusChange={(taskId, status) =>
              safeUpdateTaskStatus(taskId, { status, completed: status === 'completed' })
            }
            className="min-h-0"
          />
        </div>
      </DragSource>
    )
  }

  return (
    <section
      data-testid="calendar-week-view"
      className="flex min-h-full flex-1 flex-col overflow-hidden rounded-2xl border border-border"
    >
      <div
        data-testid="calendar-week-weekday-header"
        className="grid shrink-0 grid-cols-[72px_repeat(7,minmax(0,1fr))] border-b border-border bg-card"
      >
        <div className="border-r border-border bg-muted px-3 py-4" />
        {weekDays.map(({ date, value }) => {
          const isSelected = date === selectedDate
          const isToday = date === todayIso
          const isHighlighted = isSelected || isToday

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDate(date)}
              className={`border-r border-border px-3 py-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring last:border-r-0 ${
                isHighlighted ? 'calendar-date-highlight' : 'calendar-date-highlight-hover'
              }`}
            >
              <div className="text-sm font-semibold">
                <span
                  className={
                    isToday
                      ? 'rounded-sm bg-destructive px-1.5 py-0.5 text-destructive-foreground'
                      : 'text-foreground'
                  }
                >
                  {formatWeekdayHeaderLabel(value)}
                </span>
              </div>
              <div
                className={`mt-1 text-xs font-normal ${
                  isToday ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {formatWeekDateHeaderLabel(value)}
              </div>
            </button>
          )
        })}
      </div>

      <div className="grid shrink-0 grid-cols-[72px_repeat(7,minmax(0,1fr))]">
        <div className="border-r border-border bg-muted px-3 py-3" />
        <div className="relative col-span-7" style={{ minHeight: `${allDaySurfaceMinHeightPx}px` }}>
          <div className="absolute inset-0 grid grid-cols-7">
            {weekDays.map(({ date }) => {
              const isSelected = date === selectedDate
              const isToday = date === todayIso
              const isHighlighted = isSelected || isToday

              return (
                <DropZone
                  as="div"
                  key={date}
                  variant="row"
                  onClick={() => onSelectDate(date)}
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    setTimedDropIndicator(null)
                    const dragState = getCalendarTaskDragSession()
                    const taskId = dragState?.taskId ?? getDraggedTaskId(event)
                    if (!taskId) {
                      setAllDayDropIndicator(null)
                      return
                    }
                    const sourceTask = tasksById[taskId]
                    setAllDayDropIndicator(
                      buildWeeklyAllDayDropIndicator(sourceTask, date, weekStart)
                    )
                  }}
                  onDragLeave={(event) => {
                    if (
                      event.relatedTarget instanceof Node &&
                      event.currentTarget.contains(event.relatedTarget)
                    ) {
                      return
                    }
                    setAllDayDropIndicator(null)
                  }}
                  onDrop={(event) => handleAllDayDrop(event, date)}
                  className={`h-full rounded-none border-r border-border px-2 py-2 transition-colors last:border-r-0 ${isHighlighted ? 'calendar-date-highlight' : 'bg-transparent'}`}
                  style={{
                    paddingLeft: `${WEEKLY_ALL_DAY_CELL_PADDING_X_PX}px`,
                    paddingRight: `${WEEKLY_ALL_DAY_CELL_PADDING_X_PX}px`
                  }}
                />
              )
            })}
          </div>

          {allDayDropIndicator ? (
            <div className="pointer-events-none absolute inset-0 z-[1] grid grid-cols-7">
              <DropZone
                as="div"
                data-testid="calendar-week-all-day-drop-indicator"
                active
                tone="calendar"
                variant="row"
                className="rounded-none"
                style={{
                  gridColumn: `${allDayDropIndicator.columnStart + 1} / span ${allDayDropIndicator.columnSpan}`,
                  gridRow: '1 / 2'
                }}
              />
            </div>
          ) : null}

          {allDayLayouts.length > 0 ? (
            <div
              className="pointer-events-none relative z-[2] grid h-full grid-cols-7 py-2"
              style={{
                gridAutoRows: `${WEEKLY_ALL_DAY_ROW_HEIGHT_PX}px`,
                rowGap: `${WEEKLY_ALL_DAY_ROW_GAP_PX}px`,
                minHeight: `${allDaySurfaceMinHeightPx}px`
              }}
            >
              {allDayLayouts.map((item) => (item.task ? renderAllDayTask(item.task, item) : null))}
            </div>
          ) : null}
        </div>
      </div>

      <div data-testid="calendar-week-timed-scroller" className="flex-1 overflow-visible">
        <div className="relative grid min-w-full grid-cols-[72px_repeat(7,minmax(0,1fr))]">
          <div className="border-r border-border bg-muted">
            <div className="relative" style={{ height: `${WEEKLY_TIMED_SURFACE_HEIGHT_PX}px` }}>
              <div
                ref={timeScaleRef}
                className="absolute inset-x-0"
                style={{
                  top: `${WEEKLY_CELL_PADDING_Y_PX}px`,
                  height: `${WEEKLY_DAY_HEIGHT_PX}px`
                }}
              >
                {TIME_SLOTS.map((slot, index) => (
                  <div
                    key={slot.hour}
                    className={`px-3 text-right text-xs font-medium text-muted-foreground ${
                      index === 0 ? '' : 'border-t border-border'
                    }`}
                    style={{ height: `${WEEKLY_HOUR_HEIGHT_PX}px`, paddingTop: '8px' }}
                  >
                    {slot.label}
                  </div>
                ))}
              </div>
              {currentTimeIndicator ? (
                <div
                  data-testid="calendar-week-current-time-label"
                  className="pointer-events-none absolute inset-x-0 z-10"
                  style={{ top: `${currentTimeIndicator.topPx}px` }}
                >
                  <div className="relative -translate-y-1/2">
                    <div className="absolute right-0 top-1/2 h-0.5 w-3 -translate-y-1/2 bg-primary" />
                    <div className="flex justify-end pr-4">
                      <span className="rounded-sm bg-foreground px-1.5 py-0.5 text-right text-xs font-semibold leading-none text-background shadow-sm">
                        {currentTimeIndicator.label}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          {weekDays.map(({ date }) => {
            const isSelected = date === selectedDate
            const isToday = date === todayIso
            const isHighlighted = isSelected || isToday
            const dayLayouts = timedLayoutsByDate[date] ?? []

            return (
              <DropZone
                as="div"
                key={date}
                variant="timed"
                data-testid={`calendar-week-timed-column:${date}`}
                onClick={() => onSelectDate(date)}
                onDoubleClick={(event) => handleTimedCellDoubleClick(event, date)}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  setAllDayDropIndicator(null)
                  const dragState = getCalendarTaskDragSession()
                  const taskId = dragState?.taskId ?? getDraggedTaskId(event)
                  if (!taskId) {
                    setTimedDropIndicator(null)
                    return
                  }
                  const pointerMinutes = getPointerMinutesForClientY(
                    event.clientY,
                    daySurfaceRefs.current[date] ?? event.currentTarget
                  )
                  const sourceTask = tasksById[taskId]
                  const pointerOffsetMinutes =
                    dragState && dragState.taskId === taskId ? dragState.pointerOffsetMinutes : 0
                  const nextRange = buildWeeklyTimedDropPreview(
                    sourceTask,
                    pointerMinutes,
                    pointerOffsetMinutes
                  )
                  const previewTask = sourceTask
                    ? {
                        ...sourceTask,
                        date,
                        endDate: undefined,
                        time: minutesToTime(nextRange.startMinutes),
                        endTime: minutesToTime(nextRange.endMinutes),
                        weeklyHeightMode: nextRange.heightMode
                      }
                    : undefined

                  setTimedDropIndicator({
                    date,
                    topPx: minutesToPixels(nextRange.startMinutes),
                    heightPx: Math.max(
                      minutesToPixels(nextRange.endMinutes - nextRange.startMinutes),
                      minutesToPixels(WEEKLY_MIN_DURATION_MINUTES)
                    ),
                    heightMode: nextRange.heightMode,
                    task: previewTask
                  })
                }}
                onDragLeave={(event) => {
                  if (
                    event.relatedTarget instanceof Node &&
                    event.currentTarget.contains(event.relatedTarget)
                  ) {
                    return
                  }
                  setTimedDropIndicator((current) => (current?.date === date ? null : current))
                }}
                onDrop={(event) => handleTimedDrop(event, date)}
                className="relative border-r border-border bg-transparent last:border-r-0"
                style={{ height: `${WEEKLY_TIMED_SURFACE_HEIGHT_PX}px` }}
              >
                {isHighlighted ? (
                  <div
                    aria-hidden="true"
                    className="calendar-date-highlight pointer-events-none absolute inset-0 z-0"
                  />
                ) : null}
                <div
                  ref={(node) => {
                    daySurfaceRefs.current[date] = node
                  }}
                  className="absolute z-[1]"
                  style={{
                    top: `${WEEKLY_CELL_PADDING_Y_PX}px`,
                    right: `${WEEKLY_CELL_PADDING_X_PX}px`,
                    bottom: `${WEEKLY_CELL_PADDING_Y_PX}px`,
                    left: `${WEEKLY_CELL_PADDING_X_PX}px`
                  }}
                >
                  <div className="absolute inset-0">
                    {TIME_SLOTS.map((slot, index) => (
                      <div
                        key={slot.hour}
                        className={`border-t border-border ${index === 0 ? 'border-t-0' : ''}`}
                        style={{ height: `${WEEKLY_HOUR_HEIGHT_PX}px` }}
                      />
                    ))}
                  </div>
                  {timedDropIndicator?.date === date ? (
                    <div className="pointer-events-none absolute inset-0 z-[1]">
                      <DropZone
                        as="div"
                        data-testid="calendar-week-drop-indicator"
                        active
                        tone="calendar"
                        variant="indicator"
                        className="absolute inset-x-0"
                        style={{
                          top: `${timedDropIndicator.topPx}px`,
                          ...(timedDropIndicator.heightMode === 'duration'
                            ? { height: `${timedDropIndicator.heightPx}px` }
                            : {})
                        }}
                      >
                        {timedDropIndicator.heightMode === 'content' && timedDropIndicator.task ? (
                          <CalendarTaskCard
                            task={timedDropIndicator.task}
                            compact
                            showStatusValue
                            showProject={Boolean(timedDropIndicator.task.projectId)}
                            showTime={false}
                            heightMode="content"
                            className="invisible min-h-0"
                          />
                        ) : null}
                      </DropZone>
                    </div>
                  ) : null}
                  <div className="absolute inset-0">
                    {dayLayouts.map((layout) => renderTimedTask(layout))}
                  </div>
                </div>
              </DropZone>
            )
          })}
          {currentTimeIndicator ? (
            <div
              data-testid="calendar-week-current-time-line"
              className="pointer-events-none absolute right-0 z-10 -translate-y-1/2"
              style={{
                top: `${currentTimeIndicator.topPx}px`,
                left: `${WEEKLY_TIME_GUTTER_WIDTH_PX}px`
              }}
            >
              <div className="h-0.5 w-full bg-primary" />
            </div>
          ) : null}
        </div>
      </div>

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

      {editingTask ? (
        <TaskEditDialog
          task={editingTask}
          onClose={() => setEditingTaskId(null)}
          onSave={(taskId, patch) => {
            const scheduleMode =
              'time' in patch || 'endTime' in patch
                ? getWeeklyHeightModeForSchedule(patch.time, patch.endTime)
                : undefined
            if (onUpdateTask) {
              onUpdateTask(
                taskId,
                scheduleMode ? { ...patch, weeklyHeightMode: scheduleMode } : patch
              )
              return
            }
            if (patch.title) safeRenameTask(taskId, patch.title)
            if (patch.priority) safeUpdateTaskPriority(taskId, patch.priority)
            if (patch.taskType) safeUpdateTaskType(taskId, patch.taskType)
            if (patch.status) {
              safeUpdateTaskStatus(taskId, {
                status: patch.status,
                completed: patch.status === 'completed'
              })
            }
            if ('projectId' in patch) onUpdateTaskProject?.(taskId, patch.projectId)
            if ('date' in patch || 'endDate' in patch || 'time' in patch || 'endTime' in patch) {
              safeUpdateTaskSchedule(taskId, {
                date: patch.date,
                endDate: patch.endDate,
                time: patch.time,
                endTime: patch.endTime,
                weeklyHeightMode: scheduleMode
              })
            }
          }}
          projects={projects}
          onDelete={safeDeleteTask}
        />
      ) : null}
    </section>
  )
}

function buildTimedTaskStyle(layout: WeeklyTimedTaskLayout): {
  top: string
  height: string
  left: string
  width: string
} {
  return {
    top: `${layout.topPx}px`,
    height:
      layout.heightMode === 'content'
        ? 'fit-content'
        : `${Math.max(layout.heightPx, minutesToPixels(WEEKLY_MIN_DURATION_MINUTES))}px`,
    left: `calc(${layout.leftPercent}% + 1px)`,
    width: `calc(${layout.widthPercent}% - 2px)`
  }
}

function getWeeklyHeightModeForSchedule(
  time: string | undefined,
  endTime: string | undefined
): WeeklyHeightMode {
  return !time && !endTime ? 'content' : 'duration'
}

function getWeeklyResizeBandPx(heightPx: number): number {
  return Math.max(4, Math.min(WEEKLY_TASK_RESIZE_BAND_MAX_PX, Math.floor(heightPx / 4)))
}

function getDraggedTaskId(event: DragEvent<HTMLElement>): string | null {
  const payload = event.dataTransfer.getData('text/plain').trim()
  if (!payload) {
    return null
  }

  return payload.startsWith('move:') ? payload.slice(5) : payload
}

function hasTimedTaskScheduleChanged(
  task: CalendarTask,
  nextSchedule: {
    date: string | undefined
    endDate: string | undefined
    time: string | undefined
    endTime: string | undefined
  }
): boolean {
  return (
    task.date !== nextSchedule.date ||
    task.endDate !== nextSchedule.endDate ||
    task.time !== nextSchedule.time ||
    task.endTime !== nextSchedule.endTime
  )
}

function getPointerMinutesForClientY(clientY: number, element: HTMLElement): number {
  const rect = element.getBoundingClientRect()
  const relativeY = clampNumber(clientY - rect.top, 0, rect.height)
  return clampNumber(pixelsToMinutes(relativeY), 0, WEEKLY_MAX_END_MINUTES)
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function formatCurrentTimeIndicatorLabel(value: Date): string {
  const hours = String(value.getHours()).padStart(2, '0')
  const minutes = String(value.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function startOfWeekIso(date: Date): string {
  const copy = new Date(date)
  copy.setDate(copy.getDate() - copy.getDay())
  return toIsoDate(copy)
}

function addIsoDays(iso: string, days: number): string {
  const date = parseIsoDate(iso)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseIsoDate(iso: string): Date {
  const parsed = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return new Date()
  }
  return parsed
}

function formatWeekdayHeaderLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long'
  })
}

function formatWeekDateHeaderLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}
