export const WEEKLY_SNAP_MINUTES = 10
export const WEEKLY_MIN_DURATION_MINUTES = 10
export const WEEKLY_HOUR_HEIGHT_PX = 80
export const WEEKLY_DAY_HEIGHT_PX = 24 * WEEKLY_HOUR_HEIGHT_PX
export const WEEKLY_MAX_END_MINUTES = 23 * 60 + 50

export interface WeeklyTimedTaskLayoutInput {
  taskId: string
  date: string
  startMinutes: number
  endMinutes: number
}

export interface WeeklyTimedTaskLayout extends WeeklyTimedTaskLayoutInput {
  lane: number
  laneCount: number
  topPx: number
  heightPx: number
  leftPercent: number
  widthPercent: number
}

export function formatWeeklyTimeLabel(hour: number): string {
  const normalizedHour = ((hour % 24) + 24) % 24
  return `${String(normalizedHour).padStart(2, '0')}:00`
}

export function parseTimeToMinutes(time: string | undefined): number | null {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    return null
  }

  const [hour, minute] = time.split(':').map((value) => Number.parseInt(value, 10))
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null
  }

  return hour * 60 + minute
}

export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(minutes, WEEKLY_MAX_END_MINUTES))
  const hour = Math.floor(clamped / 60)
  const minute = clamped % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function pixelsToMinutes(pixels: number): number {
  return (pixels / WEEKLY_HOUR_HEIGHT_PX) * 60
}

export function minutesToPixels(minutes: number): number {
  return (minutes / 60) * WEEKLY_HOUR_HEIGHT_PX
}

export function snapMinutes(
  minutes: number,
  mode: 'nearest' | 'floor' | 'ceil' = 'nearest'
): number {
  const scaled = minutes / WEEKLY_SNAP_MINUTES
  const snapped =
    mode === 'floor' ? Math.floor(scaled) : mode === 'ceil' ? Math.ceil(scaled) : Math.round(scaled)

  return clampMinutes(snapped * WEEKLY_SNAP_MINUTES, 0, WEEKLY_MAX_END_MINUTES)
}

export function normalizeTimedRange(
  startMinutes: number,
  endMinutes: number
): { startMinutes: number; endMinutes: number } {
  const snappedStart = snapMinutes(startMinutes)
  const snappedEnd = snapMinutes(endMinutes)
  const duration = normalizeDurationMinutes(snappedEnd - snappedStart)
  const maxStart = Math.max(0, WEEKLY_MAX_END_MINUTES - duration)
  const normalizedStart = clampMinutes(snappedStart, 0, maxStart)

  return {
    startMinutes: normalizedStart,
    endMinutes: normalizedStart + duration
  }
}

export function buildMovedTimedRange(params: {
  pointerMinutes: number
  pointerOffsetMinutes: number
  durationMinutes: number
}): { startMinutes: number; endMinutes: number } {
  const duration = normalizeDurationMinutes(params.durationMinutes)
  const maxStart = Math.max(0, WEEKLY_MAX_END_MINUTES - duration)
  const startMinutes = clampMinutes(
    snapMinutes(params.pointerMinutes - params.pointerOffsetMinutes),
    0,
    maxStart
  )

  return {
    startMinutes,
    endMinutes: startMinutes + duration
  }
}

export function buildResizedTimedRange(
  kind: 'resize-start' | 'resize-end',
  pointerMinutes: number,
  startMinutes: number,
  endMinutes: number
): { startMinutes: number; endMinutes: number } {
  const normalized = normalizeTimedRange(startMinutes, endMinutes)
  const snappedPointer = snapMinutes(pointerMinutes)

  if (kind === 'resize-start') {
    return {
      startMinutes: clampMinutes(
        snappedPointer,
        0,
        normalized.endMinutes - WEEKLY_MIN_DURATION_MINUTES
      ),
      endMinutes: normalized.endMinutes
    }
  }

  return {
    startMinutes: normalized.startMinutes,
    endMinutes: clampMinutes(
      snappedPointer,
      normalized.startMinutes + WEEKLY_MIN_DURATION_MINUTES,
      WEEKLY_MAX_END_MINUTES
    )
  }
}

export function layoutWeeklyTimedTasks(
  entries: WeeklyTimedTaskLayoutInput[]
): WeeklyTimedTaskLayout[] {
  const byDate = new Map<string, WeeklyTimedTaskLayoutInput[]>()

  for (const entry of entries) {
    const normalized = normalizeTimedRange(entry.startMinutes, entry.endMinutes)
    const nextEntry = { ...entry, ...normalized }
    const current = byDate.get(entry.date)
    if (current) {
      current.push(nextEntry)
    } else {
      byDate.set(entry.date, [nextEntry])
    }
  }

  const layouts: WeeklyTimedTaskLayout[] = []

  for (const [date, dateEntries] of byDate.entries()) {
    const sorted = [...dateEntries].sort((left, right) => {
      if (left.startMinutes !== right.startMinutes) {
        return left.startMinutes - right.startMinutes
      }
      if (left.endMinutes !== right.endMinutes) {
        return left.endMinutes - right.endMinutes
      }
      return left.taskId.localeCompare(right.taskId)
    })

    let cluster: WeeklyTimedTaskLayoutInput[] = []
    let clusterEnd = -1

    const flushCluster = (): void => {
      if (cluster.length === 0) {
        return
      }

      const laneEndMinutes: number[] = []
      const laneAssignments = new Map<string, number>()

      for (const entry of cluster) {
        let lane = laneEndMinutes.findIndex((endMinutes) => endMinutes <= entry.startMinutes)
        if (lane === -1) {
          lane = laneEndMinutes.length
          laneEndMinutes.push(entry.endMinutes)
        } else {
          laneEndMinutes[lane] = entry.endMinutes
        }
        laneAssignments.set(entry.taskId, lane)
      }

      const laneCount = Math.max(1, laneEndMinutes.length)

      for (const entry of cluster) {
        const lane = laneAssignments.get(entry.taskId) ?? 0
        layouts.push({
          ...entry,
          date,
          lane,
          laneCount,
          topPx: minutesToPixels(entry.startMinutes),
          heightPx: Math.max(
            minutesToPixels(entry.endMinutes - entry.startMinutes),
            minutesToPixels(WEEKLY_MIN_DURATION_MINUTES)
          ),
          leftPercent: (lane / laneCount) * 100,
          widthPercent: 100 / laneCount
        })
      }

      cluster = []
      clusterEnd = -1
    }

    for (const entry of sorted) {
      if (cluster.length === 0) {
        cluster = [entry]
        clusterEnd = entry.endMinutes
        continue
      }

      if (entry.startMinutes >= clusterEnd) {
        flushCluster()
        cluster = [entry]
        clusterEnd = entry.endMinutes
        continue
      }

      cluster.push(entry)
      clusterEnd = Math.max(clusterEnd, entry.endMinutes)
    }

    flushCluster()
  }

  return layouts.sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date)
    }
    if (left.startMinutes !== right.startMinutes) {
      return left.startMinutes - right.startMinutes
    }
    if (left.lane !== right.lane) {
      return left.lane - right.lane
    }
    return left.taskId.localeCompare(right.taskId)
  })
}

function normalizeDurationMinutes(durationMinutes: number): number {
  const snappedDuration = snapMinutes(durationMinutes)
  return clampMinutes(
    snappedDuration || WEEKLY_MIN_DURATION_MINUTES,
    WEEKLY_MIN_DURATION_MINUTES,
    WEEKLY_MAX_END_MINUTES
  )
}

function clampMinutes(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
