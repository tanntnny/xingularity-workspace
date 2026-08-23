import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SelectiveChip } from '../src/renderer/src/components/ui/selective-chip'

describe('SelectiveChip', () => {
  it('renders a labelled chip trigger with the current option', () => {
    const markup = renderToStaticMarkup(
      createElement(SelectiveChip, {
        label: 'Project favorite',
        value: 'favorite',
        options: [
          { value: 'favorite', label: 'Favorite', tone: 'success' },
          { value: 'not-favorite', label: 'Not favorite', tone: 'danger' }
        ],
        onValueChange: () => undefined
      })
    )

    expect(markup).toContain('aria-label="Project favorite: Favorite"')
    expect(markup).toContain('>Favorite</span>')
    expect(markup).toContain('hover:bg-transparent')
    expect(markup).toContain('text-foreground')
    expect(markup).toContain('w-fit')
    expect(markup).toContain('ui-control')
    expect(markup).toContain('font-semibold')
    expect(markup).toContain('px-[var(--control-padding-x)]')
    expect(markup).not.toContain('border-success-border')
    expect(markup).not.toContain('bg-secondary')
    expect(markup).not.toContain('<svg')
    expect(markup).toContain('aria-haspopup="dialog"')
  })

  it('renders a plain trigger without chip surface spacing', () => {
    const markup = renderToStaticMarkup(
      createElement(SelectiveChip, {
        label: 'Task status',
        value: 'completed',
        variant: 'plain',
        options: [{ value: 'completed', label: 'Completed', tone: 'success' }],
        onValueChange: () => undefined
      })
    )

    expect(markup).toContain('bg-transparent')
    expect(markup).toContain('hover:bg-transparent')
    expect(markup).toContain('px-[var(--control-padding-x)]')
    expect(markup).not.toContain('border-0')
    expect(markup).not.toContain('bg-emerald-50')
    expect(markup).not.toContain('border-emerald-200')
  })

  it('can render an icon-only trigger while retaining its accessible label', () => {
    const markup = renderToStaticMarkup(
      createElement(SelectiveChip, {
        label: 'Task status',
        value: 'completed',
        showValue: false,
        options: [{ value: 'completed', label: 'Completed', tone: 'success' }],
        onValueChange: () => undefined
      })
    )

    expect(markup).toContain('aria-label="Task status: Completed"')
    expect(markup).not.toContain('>Completed</span>')
  })
})
