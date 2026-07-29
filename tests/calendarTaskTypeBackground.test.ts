import { describe, expect, it } from 'vitest'
import { CALENDAR_TASK_TYPE_VALUES } from '../src/shared/types'
import {
  CALENDAR_TASK_TYPE_BACKGROUND_TOKENS,
  CALENDAR_TASK_TYPE_BORDER_TOKENS,
  getCalendarTaskBackgroundToken,
  getCalendarTaskBorderToken
} from '../src/renderer/src/lib/calendarTaskTypeBackground'

describe('calendar task type colors', () => {
  it('assigns a distinct background token to every task type', () => {
    const tokens = CALENDAR_TASK_TYPE_VALUES.map(
      (taskType) => CALENDAR_TASK_TYPE_BACKGROUND_TOKENS[taskType]
    )

    expect(new Set(tokens).size).toBe(CALENDAR_TASK_TYPE_VALUES.length)
  })

  it('assigns a distinct border token to every task type', () => {
    const tokens = CALENDAR_TASK_TYPE_VALUES.map(
      (taskType) => CALENDAR_TASK_TYPE_BORDER_TOKENS[taskType]
    )

    expect(new Set(tokens).size).toBe(CALENDAR_TASK_TYPE_VALUES.length)
  })

  it('keeps the requested semantic color assignments', () => {
    expect(CALENDAR_TASK_TYPE_BACKGROUND_TOKENS.assignment).toBe(
      'var(--calendar-task-assignment-bg)'
    )
    expect(CALENDAR_TASK_TYPE_BACKGROUND_TOKENS.errand).toBe('var(--calendar-task-errand-bg)')
    expect(CALENDAR_TASK_TYPE_BACKGROUND_TOKENS.meeting).toBe('var(--calendar-task-meeting-bg)')
    expect(CALENDAR_TASK_TYPE_BACKGROUND_TOKENS.personal).toBe('var(--calendar-task-personal-bg)')
  })

  it('falls back to assignment colors when a task type is missing', () => {
    expect(getCalendarTaskBackgroundToken()).toBe(CALENDAR_TASK_TYPE_BACKGROUND_TOKENS.assignment)
    expect(getCalendarTaskBorderToken()).toBe(CALENDAR_TASK_TYPE_BORDER_TOKENS.assignment)
  })
})
