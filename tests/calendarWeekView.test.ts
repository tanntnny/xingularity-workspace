import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarWeekView } from '../src/renderer/src/components/CalendarWeekView'
import { CalendarTask } from '../src/shared/types'

function makeTask(overrides: Partial<CalendarTask> = {}): CalendarTask {
  return {
    id: 'task-1',
    title: 'Task',
    completed: false,
    createdAt: '2026-07-06T00:00:00.000Z',
    priority: 'medium',
    reminders: [],
    ...overrides
  }
}

describe('CalendarWeekView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T10:15:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders a single shared now line across the weekly timed grid', () => {
    const markup = renderToStaticMarkup(
      createElement(CalendarWeekView, {
        selectedDate: '2026-07-06',
        tasks: [],
        onSelectDate: () => undefined
      })
    )

    expect(markup.match(/data-testid="calendar-week-current-time-line"/g)?.length ?? 0).toBe(1)
    expect(markup.match(/data-testid="calendar-week-current-time-label"/g)?.length ?? 0).toBe(1)
  })

  it('renders a multi-day all-day task as one spanning block', () => {
    const markup = renderToStaticMarkup(
      createElement(CalendarWeekView, {
        selectedDate: '2026-07-06',
        tasks: [
          makeTask({
            id: 'task-trip',
            title: 'Trip',
            date: '2026-07-06',
            endDate: '2026-07-07'
          })
        ],
        onSelectDate: () => undefined
      })
    )

    expect(markup.match(/data-testid="calendar-week-all-day-task:task-trip"/g)?.length ?? 0).toBe(1)
    expect(markup).toContain('data-span-days="2"')
    expect(markup).toContain('data-start-date="2026-07-06"')
    expect(markup).toContain('data-end-date="2026-07-07"')
    expect(markup).toContain('margin-left:10px')
    expect(markup).toContain('margin-right:10px')
  })
})
