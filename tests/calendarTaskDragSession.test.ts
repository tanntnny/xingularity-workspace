import { afterEach, describe, expect, it } from 'vitest'
import {
  clearCalendarTaskDragSession,
  getCalendarTaskDragSession,
  parseCalendarTaskDragPayload,
  setCalendarTaskDragSession,
  setCalendarTaskUnscheduledDragOver,
  subscribeCalendarTaskUnscheduledDragOver
} from '../src/renderer/src/lib/calendarTaskDragSession'

afterEach(() => {
  clearCalendarTaskDragSession()
  setCalendarTaskUnscheduledDragOver(false)
})

describe('calendar task unscheduled drag state', () => {
  it('shares the active drop state with the unscheduled panel', () => {
    const states: boolean[] = []
    const unsubscribe = subscribeCalendarTaskUnscheduledDragOver((isDragOver) => {
      states.push(isDragOver)
    })

    setCalendarTaskUnscheduledDragOver(true)
    setCalendarTaskUnscheduledDragOver(false)
    unsubscribe()

    expect(states).toEqual([false, true, false])
  })

  it('starts new subscribers with the current shared state', () => {
    setCalendarTaskUnscheduledDragOver(true)
    const states: boolean[] = []

    const unsubscribe = subscribeCalendarTaskUnscheduledDragOver((isDragOver) => {
      states.push(isDragOver)
    })
    unsubscribe()

    expect(states).toEqual([true])
  })

  it('shares whether a drag should move or copy the task', () => {
    setCalendarTaskDragSession({ taskId: 'task-1', pointerOffsetMinutes: 15, mode: 'copy' })

    expect(getCalendarTaskDragSession()).toEqual({
      taskId: 'task-1',
      pointerOffsetMinutes: 15,
      mode: 'copy'
    })
  })

  it('parses copy and legacy move drag payloads', () => {
    expect(parseCalendarTaskDragPayload('copy:task-copy')).toEqual({
      taskId: 'task-copy',
      mode: 'copy'
    })
    expect(parseCalendarTaskDragPayload('move:task-move')).toEqual({
      taskId: 'task-move',
      mode: 'move'
    })
    expect(parseCalendarTaskDragPayload('task-legacy')).toEqual({
      taskId: 'task-legacy',
      mode: 'move'
    })
  })
})
