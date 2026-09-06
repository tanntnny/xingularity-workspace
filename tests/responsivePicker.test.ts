import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { badgeVariants, SelectionCounter } from '../src/renderer/src/components/ui/badge'

const responsivePickerSource = readFileSync(
  new URL('../src/renderer/src/components/ui/responsive-picker.tsx', import.meta.url),
  'utf8'
)

describe('ResponsivePicker', () => {
  it('places a positive numeric count beside the title', () => {
    const titleRowIndex = responsivePickerSource.indexOf(
      'className="flex min-w-0 items-center gap-2"'
    )
    const countIndex = responsivePickerSource.indexOf('<SelectionCounter', titleRowIndex)
    const descriptionIndex = responsivePickerSource.indexOf('{description ?', titleRowIndex)

    expect(titleRowIndex).toBeGreaterThanOrEqual(0)
    expect(countIndex).toBeGreaterThan(titleRowIndex)
    expect(countIndex).toBeLessThan(descriptionIndex)
    expect(responsivePickerSource).toContain('count={selectedCount ?? 0}')
  })

  it('omits the counter when there are no selected values', () => {
    expect(responsivePickerSource).toContain(
      'const hasSelectionCount = selectedCount !== undefined && selectedCount > 0'
    )
    expect(responsivePickerSource).toContain(
      'const clearDisabled = selectedCount !== undefined && selectedCount === 0'
    )
    expect(responsivePickerSource).not.toContain('None selected')
  })

  it('uses semantic surface and foreground tokens for the counter variant', () => {
    const counterClasses = badgeVariants({ variant: 'counter' })

    expect(counterClasses).toContain('bg-selection-counter')
    expect(counterClasses).toContain('text-selection-counter-foreground')
  })

  it('renders the shared counter beside a trigger and omits zero values', () => {
    const selectedMarkup = renderToStaticMarkup(createElement(SelectionCounter, { count: 3 }))
    const emptyMarkup = renderToStaticMarkup(createElement(SelectionCounter, { count: 0 }))

    expect(selectedMarkup).toContain('aria-label="3 selected"')
    expect(selectedMarkup).toContain('>3</span>')
    expect(emptyMarkup).toBe('')
  })

  it('centers the picker header and gives clear actions a hover surface', () => {
    expect(responsivePickerSource).toContain(
      'className="flex min-w-0 items-center justify-between gap-3"'
    )
    expect(responsivePickerSource).toContain(
      'className="shrink-0 px-2 text-xs hover:bg-surface-subtle-hover focus-visible:bg-surface-subtle-hover"'
    )
  })
})
