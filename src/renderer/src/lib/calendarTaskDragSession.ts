export type CalendarTaskDragMode = 'move' | 'copy'

export type CalendarTaskDragSession = {
  taskId: string
  pointerOffsetMinutes: number
  mode: CalendarTaskDragMode
}

let activeSession: CalendarTaskDragSession | null = null
let isUnscheduledDragOver = false
const unscheduledDragOverListeners = new Set<(isDragOver: boolean) => void>()

export function setCalendarTaskDragSession(session: CalendarTaskDragSession): void {
  activeSession = session
}

export function getCalendarTaskDragSession(): CalendarTaskDragSession | null {
  return activeSession
}

export function clearCalendarTaskDragSession(): void {
  activeSession = null
}

export function parseCalendarTaskDragPayload(payload: string): {
  taskId: string
  mode: CalendarTaskDragMode
} | null {
  if (payload.startsWith('copy:')) {
    const taskId = payload.slice('copy:'.length)
    return taskId ? { taskId, mode: 'copy' } : null
  }

  if (payload.startsWith('move:')) {
    const taskId = payload.slice('move:'.length)
    return taskId ? { taskId, mode: 'move' } : null
  }

  return payload ? { taskId: payload, mode: 'move' } : null
}

export function setCalendarTaskUnscheduledDragOver(isDragOver: boolean): void {
  if (isUnscheduledDragOver === isDragOver) {
    return
  }

  isUnscheduledDragOver = isDragOver
  unscheduledDragOverListeners.forEach((listener) => listener(isDragOver))
}

export function subscribeCalendarTaskUnscheduledDragOver(
  listener: (isDragOver: boolean) => void
): () => void {
  unscheduledDragOverListeners.add(listener)
  listener(isUnscheduledDragOver)

  return () => {
    unscheduledDragOverListeners.delete(listener)
  }
}
