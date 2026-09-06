import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Checkbox } from '../src/renderer/src/components/ui/checkbox'

describe('Checkbox', () => {
  it('uses a rectangular shape and hover fill instead of the control pill radius', () => {
    const markup = renderToStaticMarkup(createElement(Checkbox, { checked: false }))

    expect(markup).toContain('rounded-sm')
    expect(markup).toContain('data-[state=unchecked]:hover:bg-muted')
    expect(markup).not.toContain('rounded-[var(--radius-control)]')
  })
})
