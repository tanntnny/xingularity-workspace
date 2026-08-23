import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CalendarTaskTypeBadge } from '../src/renderer/src/components/ui/calendar-task-type-badge'
import { TaskPriorityBadge } from '../src/renderer/src/components/ui/task-priority-badge'
import { TagChip } from '../src/renderer/src/components/TagChip'

describe('semantic chip adapters', () => {
  it('renders task priority with the shared transparent chip treatment', () => {
    const markup = renderToStaticMarkup(createElement(TaskPriorityBadge, { priority: 'high' }))

    expect(markup).toContain('High')
    expect(markup).toContain('text-foreground')
    expect(markup).toContain('hover:bg-transparent')
    expect(markup).not.toContain('border-')
    expect(markup).not.toContain('bg-destructive')
  })

  it('renders calendar task type without replacing the calendar surface tint', () => {
    const markup = renderToStaticMarkup(
      createElement(CalendarTaskTypeBadge, { taskType: 'meeting' })
    )

    expect(markup).toContain('Meeting')
    expect(markup).toContain('text-foreground')
    expect(markup).toContain('hover:bg-transparent')
    expect(markup).not.toContain('calendar-task-meeting-bg')
    expect(markup).not.toContain('border-')
  })

  it('keeps tag search and removal actions as sibling controls', () => {
    const markup = renderToStaticMarkup(
      createElement(TagChip, {
        tag: 'release',
        onClick: () => undefined,
        onRemove: () => undefined
      })
    )

    expect(markup).toContain('release')
    expect(markup).toContain('text-foreground')
    expect(markup).toContain('hover:bg-muted')
    expect(markup).toContain('aria-label="Search tag release"')
    expect(markup).toContain('aria-label="Remove tag release"')
    expect(markup).toContain('tabler-icon-x-filled')
    expect(markup).not.toContain('>x</button>')
    expect(markup).not.toContain('border-')
    expect(markup).not.toContain('bg-secondary')
  })
})
