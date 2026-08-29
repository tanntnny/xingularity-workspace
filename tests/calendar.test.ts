import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { Calendar } from '../src/renderer/src/components/ui/calendar'

describe('Calendar', () => {
  it('uses rounded popover-hover states with normal foreground text', () => {
    const markup = renderToStaticMarkup(
      createElement(Calendar, {
        mode: 'single',
        month: new Date(2026, 0, 1),
        selected: new Date(2026, 0, 15)
      })
    )

    expect(markup).toContain('hover:!bg-popover-hover')
    expect(markup).toContain('hover:!text-foreground')
    expect(markup).toContain('rounded-md')
    expect(markup).toContain('bg-card-hover text-foreground')
    expect(markup).toContain('data-selected="true"')
  })

  it('uses stronger month text, muted outside dates, and a light today background', () => {
    const today = new Date(2026, 7, 24, 12, 0, 0)
    vi.useFakeTimers()
    vi.setSystemTime(today)

    try {
      const markup = renderToStaticMarkup(
        createElement(Calendar, {
          mode: 'single',
          month: today
        })
      )

      expect(markup).toContain('font-semibold')
      expect(markup).toContain('text-foreground')
      expect(markup).toContain('bg-popover-hover')
      expect(markup).toContain('[&amp;&gt;button]:!text-muted-foreground')
      expect(markup).toContain('[&amp;&gt;button:hover]:!text-muted-foreground')

      const todayCellStart = markup.indexOf('data-today="true"')
      const todayCellClassStart = markup.lastIndexOf('class="', todayCellStart)
      const todayCellMarkup = markup.slice(todayCellClassStart, markup.indexOf('>', todayCellStart))
      expect(todayCellMarkup).toContain('rounded-md')
      expect(todayCellMarkup).toContain('bg-popover-hover')
    } finally {
      vi.useRealTimers()
    }
  })
})
