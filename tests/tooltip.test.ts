import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Button } from '../src/renderer/src/components/ui/button'
import { getButtonTooltipLabel, TooltipButton } from '../src/renderer/src/components/ui/tooltip'

describe('button tooltips', () => {
  it('prefers explicit labels and falls back to accessible button metadata', () => {
    expect(getButtonTooltipLabel('Save changes', 'Save', 'Save now', 'Save')).toBe('Save changes')
    expect(getButtonTooltipLabel(undefined, 'Save', 'Save now', 'Save')).toBe('Save')
    expect(getButtonTooltipLabel(undefined, undefined, 'Save now', 'Save')).toBe('Save now')
    expect(getButtonTooltipLabel(undefined, undefined, undefined, 'Save')).toBe('Save')
  })

  it('renders shared buttons with a Radix tooltip trigger instead of a browser title', () => {
    const markup = renderToStaticMarkup(
      createElement(Button, { tooltip: 'Save changes', 'aria-label': 'Save changes' }, 'Save')
    )

    expect(markup).toContain('data-state="closed"')
    expect(markup).toContain('aria-label="Save changes"')
    expect(markup).not.toContain('title="Save changes"')
  })

  it('keeps disabled controls hoverable through a wrapper trigger', () => {
    const markup = renderToStaticMarkup(
      createElement(
        TooltipButton,
        { label: 'Unavailable action', disabled: true },
        createElement('button', { type: 'button', disabled: true }, 'Action')
      )
    )

    expect(markup).toContain('data-tooltip-disabled-trigger="true"')
    expect(markup).toContain('disabled=""')
  })
})
