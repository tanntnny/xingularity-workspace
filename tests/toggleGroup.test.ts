import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ToggleGroup, ToggleGroupItem } from '../src/renderer/src/components/ui/toggle-group'

describe('ToggleGroup', () => {
  it('slides a shared selection background while respecting reduced motion', () => {
    const markup = renderToStaticMarkup(
      createElement(
        ToggleGroup,
        { type: 'single', value: 'first', 'aria-label': 'Example toggle group' },
        createElement(ToggleGroupItem, { value: 'first' }, 'First'),
        createElement(ToggleGroupItem, { value: 'second' }, 'Second')
      )
    )

    expect(markup).toContain('data-toggle-group-indicator="true"')
    expect(markup).toContain('rounded-[inherit]')
    expect(markup).toContain('transition-[transform,width,height,opacity] duration-200 ease-out')
    expect(markup).toContain('motion-reduce:transition-none')
    expect(markup).toContain('data-[state=on]:bg-transparent')
  })

  it('keeps per-item active backgrounds for multiple-selection groups', () => {
    const markup = renderToStaticMarkup(
      createElement(
        ToggleGroup,
        { type: 'multiple', value: ['first'], 'aria-label': 'Multiple toggle group' },
        createElement(ToggleGroupItem, { value: 'first' }, 'First'),
        createElement(ToggleGroupItem, { value: 'second' }, 'Second')
      )
    )

    expect(markup).not.toContain('data-toggle-group-indicator="true"')
    expect(markup).toContain('data-[state=on]:bg-card')
  })
})
