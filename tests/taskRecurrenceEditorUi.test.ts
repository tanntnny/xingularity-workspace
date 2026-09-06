import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { TaskRecurrenceEditor } from '../src/renderer/src/components/TaskRecurrenceEditor'
import type { CalendarTask } from '../src/shared/types'

const task: CalendarTask = {
  id: 'task-1',
  title: 'Prepare release',
  tags: [],
  completed: false,
  createdAt: '2026-08-12T00:00:00.000Z',
  priority: 'medium',
  reminders: []
}

describe('task recurrence UI', () => {
  it('renders an icon-only recurrence action when requested', () => {
    const markup = renderToStaticMarkup(
      createElement(TaskRecurrenceEditor, {
        task,
        iconOnly: true,
        onChange: () => undefined
      })
    )

    expect(markup).toContain('task-recurrence-trigger')
    expect(markup).toContain('aria-label="Set task to repeat"')
    expect(markup).toContain('title="Set task to repeat"')
    expect(markup).not.toContain('Does not repeat')
  })
})
