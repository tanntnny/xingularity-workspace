import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Calendar } from '../src/renderer/src/components/ui/calendar'

describe('Calendar', () => {
  it('uses rounded card-hover states with normal foreground text', () => {
    const markup = renderToStaticMarkup(
      createElement(Calendar, {
        mode: 'single',
        month: new Date(2026, 0, 1),
        selected: new Date(2026, 0, 15)
      })
    )

    expect(markup).toContain('hover:!bg-card-hover')
    expect(markup).toContain('hover:!text-foreground')
    expect(markup).toContain('rounded-md')
    expect(markup).toContain('bg-card-hover text-foreground')
    expect(markup).toContain('data-selected="true"')
  })
})
