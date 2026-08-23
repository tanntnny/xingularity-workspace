import {
  DragEvent,
  MouseEvent as ReactMouseEvent,
  ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { CalendarTask, Project, WeeklyHeightMode } from '../../../shared/types'
import { isTaskDone, isTaskStatusDone } from '../../../shared/taskStatus'
import {
  buildWeeklyCalendarEntries,
  getWeeklyAllDaySurfaceHeightPx,
  layoutWeeklyAllDayItems,
  WEEKLY_ALL_DAY_TASK_GAP_PX,
  WEEKLY_ALL_DAY_TASK_MIN_HEIGHT_PX,
  type WeeklyCalendarAllDayLayout,
  normalizeCalendarTasks
} from '../lib/calendarTasks'
import { getCalendarTaskHoverPosition } from '../lib/calendarTaskHoverPosition'
import { useCalendarDragAutoScroll } from '../hooks/useCalendarDragAutoScroll'
import {
  buildResizedTimedRange,
  clampWeeklyHourHeight,
  formatWeeklyTimeLabel,
  getWeeklyDayHeightPx,
  layoutWeeklyTimedTasks,
  minutesToPixels,
  minutesToTime,
  normalizeTimedRange,
  pixelsToMinutes,
  snapMinutes,
  WEEKLY_HOUR_HEIGHT_PX,
  WEEKLY_HOUR_HEIGHT_STEP_PX,
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
import { DragSource } from './ui/drag-source'
import { DropZone } from './ui/drop-zone'
import type { TaskOpenOptions } from '../lib/taskOpenOptions'

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
  onOpenTask?: (taskId: string, options?: TaskOpenOptions) => void
  onRescheduleTask?: (taskId: string, newDate: string | undefined) => void
  onDeleteTask?: (taskId: string) => void
  onUpdateTask?: (taskId: string, patch: Partial<CalendarTask>) => void
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
const WEEKLY_ALL_DAY_CELL_PADDING_X_PX = WEEKLY_CELL_PADDING_X_PX
const WEEKLY_ALL_DAY_SURFACE_PADDING_PX = 8
const WEEKLY_ALL_DAY_MIN_HEIGHT_PX = 92
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
  onOpenTask,
  onRescheduleTask,
  onDeleteTask,
  onUpdateTask,
  onUpdateTaskSchedule
}: CalendarWeekViewProps): ReactElement {
  const calendarRootRef = useRef<HTMLElement | null>(null)
  const { start: startCalendarDragAutoScroll, stop: stopCalendarDragAutoScroll } =
    useCalendarDragAutoScroll({ rootRef: calendarRootRef })
  const [currentDateTime, setCurrentDateTime] = useState(() => new Date())
  const [weeklyHourHeightPx, setWeeklyHourHeightPx] = useState(WEEKLY_HOUR_HEIGHT_PX)
  const weeklyDayHeightPx = getWeeklyDayHeightPx(weeklyHourHeightPx)
  const weeklyTimedSurfaceHeightPx = weeklyDayHeightPx + WEEKLY_CELL_PADDING_Y_PX * 2
  const [timeScaleMetrics, setTimeScaleMetrics] = useState<WeeklyTimeScaleMetrics>(() => ({
    topPx: WEEKLY_CELL_PADDING_Y_PX,
    heightPx: getWeeklyDayHeightPx()
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
  const allDayTaskElementsRef = useRef(new Map<string, HTMLDivElement>())
  const timedScrollerRef = useRef<HTMLDivElement | null>(null)
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
  const registerAllDayTaskElement = useCallback(
    (taskId: string, element: HTMLDivElement | null): void => {
      if (element) {
        allDayTaskElementsRef.current.set(taskId, element)
      } else {
        allDayTaskElementsRef.current.delete(taskId)
      }
    },
    []
  )
  const [allDayTaskHeights, setAllDayTaskHeights] = useState<Record<string, number>>({})
  useLayoutEffect(() => {
    const elements = allDayTaskElementsRef.current
    const updateHeights = (entries: readonly HTMLDivElement[]): void => {
      setAllDayTaskHeights((current) => {
        let changed = false
        const next = { ...current }

        for (const element of entries) {
          const taskId = [...elements.entries()].find(([, node]) => node === element)?.[0]
          if (!taskId) {
            continue
          }

          const measuredHeight = Math.ceil(element.getBoundingClientRect().height)
          const nextHeight = Math.max(WEEKLY_ALL_DAY_TASK_MIN_HEIGHT_PX, measuredHeight)
          if (next[taskId] !== nextHeight) {
            next[taskId] = nextHeight
            changed = true
          }
        }

        return changed ? next : current
      })
    }

    const visibleElements = [...elements.values()]
    updateHeights(visibleElements)

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver((entries) => {
            updateHeights(entries.map((entry) => entry.target as HTMLDivElement))
          })
    visibleElements.forEach((element) => resizeObserver?.observe(element))

    return () => resizeObserver?.disconnect()
  }, [allDayItems])
  const timedLayouts = useMemo(
    () =>
      layoutWeeklyTimedTasks(
        timedTasks.map((entry) => ({
          taskId: entry.task.id,
          date: entry.date,
          startMinutes: entry.startMinutes,
          endMinutes: entry.startMinutes + entry.durationMinutes,
          heightMode: entry.task.weeklyHeightMode
        })),
        weeklyHourHeightPx
      ),
    [timedTasks, weeklyHourHeightPx]
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
    () =>
      layoutWeeklyAllDayItems(
        allDayItems,
        weekStart,
        allDayTaskHeights,
        WEEKLY_ALL_DAY_TASK_GAP_PX,
        WEEKLY_ALL_DAY_TASK_MIN_HEIGHT_PX
      ),
    [allDayItems, allDayTaskHeights, weekStart]
  )
  const allDaySurfaceHeightPx = useMemo(
    () =>
      getWeeklyAllDaySurfaceHeightPx(
        allDayLayouts,
        WEEKLY_ALL_DAY_MIN_HEIGHT_PX,
        WEEKLY_ALL_DAY_SURFACE_PADDING_PX
      ),
    [allDayLayouts]
  )

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
  const safeUpdateTaskStatus = onUpdateTask ?? (() => undefined)
  const safeUpdateTaskSchedule = onUpdateTaskSchedule ?? NOOP_UPDATE_TASK_SCHEDULE

  useEffect(() => {
    const node = timedScrollerRef.current
    if (!node) {
      return
    }

    const handleWheel = (event: WheelEvent): void => {
      if ((!event.metaKey && !event.ctrlKey) || event.deltaY === 0) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      setTimedDropIndicator(null)

      const direction = event.deltaY < 0 ? 1 : -1
      setWeeklyHourHeightPx((current) =>
        clampWeeklyHourHeight(current + direction * WEEKLY_HOUR_HEIGHT_STEP_PX)
      )
    }

    node.addEventListener('wheel', handleWheel, { capture: true, passive: false })
    return () => {
      node.removeEventListener('wheel', handleWheel, true)
    }
  }, [])

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
  }, [weekStart, weeklyHourHeightPx])

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

      const pointerMinutes = getPointerMinutesForClientY(event.clientY, column, weeklyHourHeightPx)
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
      daySurfaceRefs.current[date] ?? event.currentTarget,
      weeklyHourHeightPx
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
      buildWeeklyTimedCreateSchedule(
        date,
        getPointerMinutesForClientY(event.clientY, daySurface, weeklyHourHeightPx)
      )
    )
      .then((task) => {
        onOpenTask?.(task.id, { isNewTask: true })
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
              pixelsToMinutes(
                event.clientY - event.currentTarget.getBoundingClientRect().top,
                weeklyHourHeightPx
              )
            )
          : 0
    }
    dragStateRef.current = dragState
    setCalendarTaskDragSession(dragState)
    startCalendarDragAutoScroll()
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
    stopCalendarDragAutoScroll()
    dragStateRef.current = null
    setTimedDropIndicator(null)
    setAllDayDropIndicator(null)
    clearCalendarTaskDragSession()
  }

  const renderAllDayTask = (
    task: CalendarTask,
    layout: WeeklyCalendarAllDayLayout
  ): ReactElement => {
    const columnWidthPercent = 100 / 7
    const leftPercent = layout.columnStart * columnWidthPercent
    const widthPercent = layout.columnSpan * columnWidthPercent
    const horizontalPadding = WEEKLY_ALL_DAY_CELL_PADDING_X_PX * 2

    return (
      <div
        key={layout.id}
        className="pointer-events-none absolute"
        style={{
          top: `${WEEKLY_ALL_DAY_SURFACE_PADDING_PX + layout.topPx}px`,
          left: `calc(${leftPercent}% + ${WEEKLY_ALL_DAY_CELL_PADDING_X_PX}px)`,
          width: `calc(${widthPercent}% - ${horizontalPadding}px)`
        }}
      >
        <DragSource
          as="article"
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
          onDragStart={(event) => handleTaskDragStart(event, task, 'all-day')}
          onDragEnd={handleTaskDragEnd}
          onClick={(event) => {
            event.stopPropagation()
            setHoveredTaskCard(null)
            onOpenTask?.(task.id)
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
            onOpenTask?.(task.id)
          }}
          className={`pointer-events-auto w-full transition-colors ${isTaskDone(task) ? 'line-through' : ''}`}
        >
          <CalendarTaskCard
            ref={(element) => registerAllDayTaskElement(task.id, element)}
            task={task}
            compact
            showStatusValue
            heightMode="content"
            project={task.projectId ? projectsById.get(task.projectId) : undefined}
            showProject={Boolean(task.projectId)}
            showTime={Boolean(task.time || task.endTime)}
            onStatusChange={(taskId, status) =>
              safeUpdateTaskStatus(taskId, { status, completed: isTaskStatusDone(status) })
            }
          />
        </DragSource>
      </div>
    )
  }

  const renderTimedTask = (layout: WeeklyTimedTaskLayout): ReactElement => {
    const task = timedTasksById[layout.taskId]
    if (!task) {
      return <></>
    }

    const isInteracting =
      timedInteraction?.taskId === task.id && timedInteraction.previewDate === layout.date
    const blockStyle = buildTimedTaskStyle(layout, weeklyHourHeightPx)
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
          onOpenTask?.(task.id)
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
          onOpenTask?.(task.id)
        }}
        className={`motion-calendar-event group absolute overflow-hidden rounded-md bg-card transition-colors hover:bg-muted ${
          isInteracting ? 'z-20 shadow-lg' : 'z-10 hover:shadow-md'
        } ${isTaskDone(task) ? 'line-through' : ''} cursor-grab active:cursor-grabbing`}
      >
        <button
          type="button"
          data-weekly-resize-handle="true"
          data-resize-direction="y"
          data-resizing={
            timedInteraction?.taskId === task.id && timedInteraction.kind === 'resize-start'
              ? 'true'
              : undefined
          }
          aria-label="Resize task start"
          title="Resize task start"
          onMouseDown={(event) => startResizeInteraction('resize-start', event, task, layout)}
          className="resize-affordance absolute inset-x-0 top-0 z-20 cursor-ns-resize rounded-t-sm opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ height: `${resizeBandPx}px` }}
        />
        <button
          type="button"
          data-weekly-resize-handle="true"
          data-resize-direction="y"
          data-resizing={
            timedInteraction?.taskId === task.id && timedInteraction.kind === 'resize-end'
              ? 'true'
              : undefined
          }
          aria-label="Resize task end"
          title="Resize task end"
          onMouseDown={(event) => startResizeInteraction('resize-end', event, task, layout)}
          className="resize-affordance absolute inset-x-0 bottom-0 z-20 cursor-ns-resize rounded-b-sm opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              safeUpdateTaskStatus(taskId, { status, completed: isTaskStatusDone(status) })
            }
            className="min-h-0"
          />
        </div>
      </DragSource>
    )
  }

  return (
    <section
      ref={calendarRootRef}
      data-testid="calendar-week-view"
      className="flex min-h-full flex-1 flex-col overflow-hidden rounded-shell border border-panel-border bg-[var(--calendar-surface)]"
    >
      <div
        data-testid="calendar-week-weekday-header"
        className="grid shrink-0 grid-cols-[72px_repeat(7,minmax(0,1fr))] border-b border-panel-border bg-card"
      >
        <div className="border-r border-panel-border bg-[var(--calendar-surface)] px-3 py-4" />
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
        <div className="border-r border-panel-border bg-[var(--calendar-surface)] px-3 py-3" />
        <div className="relative col-span-7" style={{ minHeight: `${allDaySurfaceHeightPx}px` }}>
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
                  className={`h-full rounded-none border-r border-panel-border px-2 py-2 transition-colors last:border-r-0 ${isHighlighted ? 'calendar-date-highlight' : 'bg-transparent'}`}
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
              className="pointer-events-none absolute inset-0 z-[2]"
              style={{ minHeight: `${allDaySurfaceHeightPx}px` }}
            >
              {allDayLayouts.map((item) => (item.task ? renderAllDayTask(item.task, item) : null))}
            </div>
          ) : null}
        </div>
      </div>

      <div
        ref={timedScrollerRef}
        data-testid="calendar-week-timed-scroller"
        data-weekly-hour-height={weeklyHourHeightPx}
        className="flex-1 overflow-visible"
      >
        <div className="relative grid min-w-full grid-cols-[72px_repeat(7,minmax(0,1fr))]">
          <div className="border-r border-panel-border bg-[var(--calendar-surface)]">
            <div className="relative" style={{ height: `${weeklyTimedSurfaceHeightPx}px` }}>
              <div
                ref={timeScaleRef}
                className="absolute inset-x-0"
                style={{
                  top: `${WEEKLY_CELL_PADDING_Y_PX}px`,
                  height: `${weeklyDayHeightPx}px`
                }}
              >
                {TIME_SLOTS.map((slot, index) => (
                  <div
                    key={slot.hour}
                    className={`px-3 text-right text-xs font-medium text-muted-foreground ${
                      index === 0 ? '' : 'border-t border-panel-border'
                    }`}
                    style={{ height: `${weeklyHourHeightPx}px`, paddingTop: '8px' }}
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
                    daySurfaceRefs.current[date] ?? event.currentTarget,
                    weeklyHourHeightPx
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
                    topPx: minutesToPixels(nextRange.startMinutes, weeklyHourHeightPx),
                    heightPx: Math.max(
                      minutesToPixels(
                        nextRange.endMinutes - nextRange.startMinutes,
                        weeklyHourHeightPx
                      ),
                      minutesToPixels(WEEKLY_MIN_DURATION_MINUTES, weeklyHourHeightPx)
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
                className="relative border-r border-panel-border bg-transparent last:border-r-0"
                style={{ height: `${weeklyTimedSurfaceHeightPx}px` }}
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
                        className={`border-t border-panel-border ${index === 0 ? 'border-t-0' : ''}`}
                        style={{ height: `${weeklyHourHeightPx}px` }}
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
    </section>
  )
}

function buildTimedTaskStyle(
  layout: WeeklyTimedTaskLayout,
  hourHeightPx: number
): {
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
        : `${Math.max(layout.heightPx, minutesToPixels(WEEKLY_MIN_DURATION_MINUTES, hourHeightPx))}px`,
    left: `calc(${layout.leftPercent}% + 1px)`,
    width: `calc(${layout.widthPercent}% - 2px)`
  }
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

function getPointerMinutesForClientY(
  clientY: number,
  element: HTMLElement,
  hourHeightPx: number
): number {
  const rect = element.getBoundingClientRect()
  const relativeY = clampNumber(clientY - rect.top, 0, rect.height)
  return clampNumber(pixelsToMinutes(relativeY, hourHeightPx), 0, WEEKLY_MAX_END_MINUTES)
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
