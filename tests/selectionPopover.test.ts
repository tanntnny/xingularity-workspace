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

  it('keeps option rows comfortably padded for touch and keyboard use', () => {
    expect(selectionPopoverSource).toContain(
      'min-h-9 cursor-pointer gap-2 rounded-sm px-2.5 py-1.5'
    )
    expect(selectionPopoverSource).toContain('hover:bg-popover-hover')
  })

  it('treats the create option like a navigable selection row', () => {
    expect(selectionPopoverSource).toContain('const createOptionValue =')
    expect(selectionPopoverSource).toContain('...(canCreate ? [createOptionValue] : [])')
    expect(selectionPopoverSource).toContain('value={createOptionValue}')
    expect(selectionPopoverSource).toContain('onSelect={handleCreate}')
    expect(selectionPopoverSource).toContain('className={selectionOptionClassName}')
  })

  it('uses the selection label for empty and no-results copy', () => {
    expect(selectionPopoverSource).toContain('`No matching ${label.toLowerCase()}`')
    expect(selectionPopoverSource).toContain('`No ${label.toLowerCase()} yet`')
    expect(selectionPopoverSource).not.toContain('No tags yet')
    expect(selectionPopoverSource).not.toContain('No matching tags')
  })

  it('does not render checkbox indicators for single-selection options', () => {
    expect(selectionPopoverSource).not.toContain('{!multiple ? (')
    expect(selectionPopoverSource).toContain('{multiple ? <SelectionCheckbox checked={selected} />')
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
