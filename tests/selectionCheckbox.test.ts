import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SelectionCheckbox } from '../src/renderer/src/components/ui/selection-checkbox'

describe('SelectionCheckbox', () => {
  it('uses a rounded rectangle and primary border in both states', () => {
    const uncheckedMarkup = renderToStaticMarkup(
      createElement(SelectionCheckbox, { checked: false })
    )
    const checkedMarkup = renderToStaticMarkup(createElement(SelectionCheckbox, { checked: true }))

    expect(uncheckedMarkup).toContain('rounded-sm')
    expect(uncheckedMarkup).toContain('border-primary')
    expect(uncheckedMarkup).toContain('hover:bg-muted')
    expect(uncheckedMarkup).toContain('group-hover:bg-muted')
    expect(uncheckedMarkup).not.toContain('rounded-[var(--radius-control)]')
    expect(checkedMarkup).toContain('border-primary')
    expect(checkedMarkup).toContain('bg-primary')
    expect(checkedMarkup).toContain('hover:bg-primary')
  })
})
