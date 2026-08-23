import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  TabToggleGroup,
  TabToggleGroupItem
} from '../src/renderer/src/components/ui/tab-toggle-group'

describe('TabToggleGroup', () => {
  it('renders standalone true tabs with a shared control height', () => {
    const markup = renderToStaticMarkup(
      createElement(
        TabToggleGroup,
        { value: 'first', onValueChange: () => undefined, 'aria-label': 'Example tabs' },
        createElement(TabToggleGroupItem, { value: 'first' }, 'First'),
        createElement(TabToggleGroupItem, { value: 'second' }, 'Second')
      )
    )

    expect(markup).toContain('role="tablist"')
    expect(markup).toContain('role="tab"')
    expect(markup).toContain('aria-selected="true"')
    expect(markup).toContain('aria-selected="false"')
    expect(markup).toContain('data-tab-toggle-group-item="true"')
    expect(markup).toContain('h-[var(--control-height)]')
    expect(markup).toContain('rounded-[var(--radius-button)]')
    expect(markup).toContain('border-input')
    expect(markup).toContain('bg-panel')
    expect(markup).toContain('bg-panel-hover')
    expect(markup).toContain('text-muted-foreground')
    expect(markup).not.toContain('aria-checked=')
    expect(markup).not.toContain('aria-pressed=')
    expect(markup).not.toContain('data-toggle-group-indicator=')
  })
})
