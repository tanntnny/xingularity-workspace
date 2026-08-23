import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  StatusChipToggleGroup,
  StatusChipToggleItem
} from '../src/renderer/src/components/ui/status-chip-toggle'

describe('StatusChipToggleGroup', () => {
  it('renders text-only single-select status chips with an active glow', () => {
    const markup = renderToStaticMarkup(
      createElement(
        StatusChipToggleGroup,
        {
          value: 'notebook',
          onValueChange: () => undefined,
          'aria-label': 'Resource type'
        },
        createElement(StatusChipToggleItem, { value: 'notebook' }, 'Notebook'),
        createElement(StatusChipToggleItem, { value: 'external' }, 'External URL')
      )
    )

    expect(markup).toContain('role="group"')
    expect(markup).toContain('aria-label="Resource type"')
    expect(markup).toContain('data-state="on"')
    expect(markup).toContain('aria-checked="true"')
    expect(markup).toContain('data-state="off"')
    expect(markup).toContain('aria-checked="false"')
    expect(markup).toContain('ui-compact-control')
    expect(markup).toContain('rounded-[var(--radius-control)]')
    expect(markup).toContain('data-[state=on]:bg-card-hover')
    expect(markup).toContain('data-[state=on]:shadow-sm')
    expect(markup).not.toContain('role="tablist"')
    expect(markup).not.toContain('<svg')
  })
})
