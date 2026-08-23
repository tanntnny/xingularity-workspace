import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ChipGroup } from '../src/renderer/src/components/ui/chip-group'
import { CalendarDateEditPopover } from '../src/renderer/src/components/ui/calendar-date-edit-popover'
import { CalendarTimeEditPopover } from '../src/renderer/src/components/ui/calendar-time-edit-popover'

describe('ChipGroup', () => {
  it('renders one labelled pill wrapper with a divider between children', () => {
    const markup = renderToStaticMarkup(
      createElement(
        ChipGroup,
        {
          'aria-label': 'Task project and milestone',
          'data-testid': 'task-dialog-project-milestone-group'
        },
        createElement('span', { key: 'project' }, 'Project'),
        createElement('span', { key: 'milestone' }, 'Milestone')
      )
    )

    expect(markup).toContain('role="group"')
    expect(markup).toContain('aria-label="Task project and milestone"')
    expect(markup).toContain('data-testid="task-dialog-project-milestone-group"')
    expect(markup).toContain('rounded-[var(--radius-button-pill)]')
    expect(markup).toContain('border border-border')
    expect(markup).toContain('bg-surface-subtle')
    expect(markup).toContain('divide-x')
    expect(markup).toContain('divide-foreground/30')
    expect(markup).toContain('[&amp;&gt;*]:w-fit')
    expect(markup).toContain('[&amp;&gt;*:hover]:!bg-surface-subtle-hover')
  })

  it('uses status-chip typography for date and time triggers', () => {
    const dateMarkup = renderToStaticMarkup(
      createElement(CalendarDateEditPopover, {
        label: 'Task start date',
        value: '2026-08-22',
        onValueChange: () => undefined,
        'data-testid': 'start-date-trigger'
      })
    )
    const timeMarkup = renderToStaticMarkup(
      createElement(CalendarTimeEditPopover, {
        label: 'Task start time',
        value: '09:30',
        onValueChange: () => undefined,
        'data-testid': 'start-time-trigger'
      })
    )

    expect(dateMarkup).toContain('text-sm font-semibold')
    expect(timeMarkup).toContain('text-sm font-semibold')
    expect(dateMarkup).not.toContain('text-xs font-normal')
    expect(timeMarkup).not.toContain('text-xs font-normal')
  })
})
