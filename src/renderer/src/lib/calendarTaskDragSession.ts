type CalendarTaskDragSession = {
  taskId: string
  pointerOffsetMinutes: number
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
