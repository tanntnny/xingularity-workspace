type CalendarTaskDragSession = {
  taskId: string
  pointerOffsetMinutes: number
}

let activeSession: CalendarTaskDragSession | null = null

export function setCalendarTaskDragSession(session: CalendarTaskDragSession): void {
  activeSession = session
}

export function getCalendarTaskDragSession(): CalendarTaskDragSession | null {
  return activeSession
}

export function clearCalendarTaskDragSession(): void {
  activeSession = null
}
