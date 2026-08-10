import { afterEach, describe, expect, it } from 'vitest'
import {
  setCalendarTaskUnscheduledDragOver,
  subscribeCalendarTaskUnscheduledDragOver
} from '../src/renderer/src/lib/calendarTaskDragSession'

afterEach(() => {
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
})
