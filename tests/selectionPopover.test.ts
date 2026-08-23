import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SelectionPopover } from '../src/renderer/src/components/ui/selection-popover'

const options = [{ value: 'heading2', label: 'Heading 2' }]
const selectionPopoverSource = readFileSync(
  new URL('../src/renderer/src/components/ui/selection-popover.tsx', import.meta.url),
  'utf8'
)

describe('SelectionPopover', () => {
  it('controls arrow-key highlighting for anchored option lists', () => {
    expect(selectionPopoverSource).toContain('value={highlightedOptionValue}')
    expect(selectionPopoverSource).toContain("event.key === 'ArrowDown' || event.key === 'ArrowUp'")
    expect(selectionPopoverSource).toContain('setHighlightedValue(nextValue)')
  })

  it('supports controlled anchor-only usage without rendering a trigger', () => {
    const markup = renderToStaticMarkup(
      createElement(SelectionPopover, {
        selectionMode: 'single',
        value: '',
        options,
        onValueChange: () => undefined,
        label: 'Insert block',
        open: false,
        onOpenChange: () => undefined,
        searchValue: '',
        onSearchValueChange: () => undefined,
        hideTrigger: true,
        anchor: createElement('span', { 'data-testid': 'selection-anchor' })
      })
    )

    expect(markup).toContain('data-testid="selection-anchor"')
    expect(markup).not.toContain('<button')
  })
})
