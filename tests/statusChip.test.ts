import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Badge } from '../src/renderer/src/components/ui/badge'
import { StatusChip } from '../src/renderer/src/components/ui/status-chip'

const item = {
  label: 'Completed',
  icon: createElement('svg', { 'aria-hidden': true }),
  iconColorToken: 'var(--status-chip-task-status-completed-icon)'
}

describe('StatusChip', () => {
  it('uses the shared compact height for badges', () => {
    const markup = renderToStaticMarkup(createElement(Badge, null, 'Default'))

    expect(markup).toContain('ui-compact-control')
  })

  it('renders semantic content with a transparent surface and semantic icon color', () => {
    const markup = renderToStaticMarkup(createElement(StatusChip, { item }))

    expect(markup).toContain('Completed')
    expect(markup).toContain('ui-control')
    expect(markup).toContain('ui-compact-control')
    expect(markup).toContain('[&amp;_svg]:size-[var(--status-chip-icon-size)]')
    expect(markup).toContain('items-center')
    expect(markup).toContain('justify-start')
    expect(markup).toContain(
      'inline-flex shrink-0 items-center justify-center text-[var(--status-chip-icon-color)]'
    )
    expect(markup).toContain('text-left')
    expect(markup).toContain('text-sm')
    expect(markup).toMatch(/<span class="[^"]*w-full text-left text-sm[^"]*">Completed<\/span>/)
    expect(markup).toContain('font-semibold')
    expect(markup).toContain('px-[var(--control-padding-x)]')
    expect(markup).toContain('text-foreground')
    expect(markup).toContain('bg-transparent')
    expect(markup).toContain('hover:bg-transparent')
    expect(markup).toContain('focus-visible:bg-transparent')
    expect(markup).toContain(
      '--status-chip-icon-color:var(--status-chip-task-status-completed-icon)'
    )
    expect(markup).not.toContain('bg-secondary')
    expect(markup).not.toContain('bg-muted')
    expect(markup).not.toContain('bg-surface-subtle')
    expect(markup).not.toContain('border-')
  })

  it('applies an optional semantic token to the label text', () => {
    const markup = renderToStaticMarkup(
      createElement(StatusChip, {
        item: { ...item, labelColorToken: 'var(--success)' }
      })
    )

    expect(markup).toContain('text-[var(--status-chip-label-color)]')
    expect(markup).toContain('--status-chip-label-color:var(--success)')
    expect(markup).not.toMatch(/<span class="[^"]*text-foreground[^"]*">Completed<\/span>/)
  })

  it('supports an opt-in pill surface', () => {
    const markup = renderToStaticMarkup(createElement(StatusChip, { item, surface: 'pill' }))

    expect(markup).toContain('border border-border')
    expect(markup).toContain('px-2')
    expect(markup).not.toContain('px-[var(--control-padding-x)]')
    expect(markup).toContain('bg-surface-subtle')
    expect(markup).toContain('hover:bg-surface-subtle-hover')
    expect(markup).toContain('focus-visible:bg-surface-subtle-hover')
  })

  it('supports a transparent surface that gains a background on hover', () => {
    const markup = renderToStaticMarkup(createElement(StatusChip, { item, surface: 'hover' }))

    expect(markup).toContain('bg-transparent')
    expect(markup).toContain('hover:bg-card-hover')
    expect(markup).toContain('focus-visible:bg-card-hover')
    expect(markup).not.toContain('border-border')
  })

  it('supports a transparent pill surface that gains a subtle background on hover', () => {
    const markup = renderToStaticMarkup(createElement(StatusChip, { item, surface: 'hover-pill' }))

    expect(markup).toContain('rounded-[var(--radius-button-pill)]')
    expect(markup).toContain('bg-transparent')
    expect(markup).toContain('hover:bg-surface-subtle-hover')
    expect(markup).toContain('focus-visible:bg-surface-subtle-hover')
    expect(markup).not.toMatch(/(?:^| )bg-surface-subtle(?: |")/)
    expect(markup).not.toContain('border-border')
  })

  it('keeps bare chips transparent even when a pill surface is requested', () => {
    const markup = renderToStaticMarkup(
      createElement(StatusChip, { item, variant: 'bare', surface: 'pill' })
    )

    expect(markup).toContain('bg-transparent')
    expect(markup).not.toContain('bg-surface-subtle')
    expect(markup).not.toContain('border-')
  })

  it('renders an accessible button when requested', () => {
    const markup = renderToStaticMarkup(
      createElement(StatusChip, {
        as: 'button',
        item,
        'aria-label': 'Task status: Completed',
        type: 'button'
      })
    )

    expect(markup).toContain('<button')
    expect(markup).toContain('aria-label="Task status: Completed"')
    expect(markup).toContain('type="button"')
  })

  it('keeps content left-aligned when a consumer passes directional alignment classes', () => {
    const markup = renderToStaticMarkup(
      createElement(StatusChip, {
        item,
        className: 'items-start justify-center'
      })
    )

    expect(markup).toMatch(/^<span class="[^"]*items-center justify-start/)
    expect(markup).not.toMatch(/^<span class="[^"]*items-start/)
    expect(markup).not.toMatch(/^<span class="[^"]*justify-center/)
  })

  it('renders the bare variant without a control container and with muted-to-normal hover text', () => {
    const markup = renderToStaticMarkup(createElement(StatusChip, { item, variant: 'bare' }))

    expect(markup).toContain('group/status-chip')
    expect(markup).toContain('ui-compact-control')
    expect(markup).toContain('text-muted-foreground')
    expect(markup).toContain('text-sm')
    expect(markup).toContain('font-medium')
    expect(markup).toContain('group-hover/status-chip:text-foreground')
    expect(markup).toContain('hover:bg-transparent')
    expect(markup).not.toContain('ui-control')
    expect(markup).not.toContain('px-[var(--control-padding-x)]')
  })

  it('supports muted labels while keeping the regular chip surface', () => {
    const markup = renderToStaticMarkup(createElement(StatusChip, { item, mutedLabel: true }))

    expect(markup).toMatch(/<span class="[^"]*text-muted-foreground[^"]*">Completed<\/span>/)
    expect(markup).not.toMatch(/<span class="[^"]*text-foreground[^"]*">Completed<\/span>/)
    expect(markup).toContain('ui-control')
  })

  it('supports explicit foreground labels for bare selection rows', () => {
    const markup = renderToStaticMarkup(
      createElement(StatusChip, { item, variant: 'bare', mutedLabel: false })
    )

    expect(markup).toMatch(/<span class="[^"]*text-foreground[^"]*">Completed<\/span>/)
    expect(markup).not.toMatch(/<span class="[^"]*text-muted-foreground[^"]*">Completed<\/span>/)
  })

  it('wraps long labels when explicitly enabled', () => {
    const markup = renderToStaticMarkup(
      createElement(StatusChip, {
        item: { ...item, label: 'A project name that needs to wrap inside the dialog' },
        wrapLabel: true
      })
    )

    expect(markup).toContain('whitespace-normal')
    expect(markup).toContain('break-words')
    expect(markup).toContain('items-center')
    expect(markup).toContain('justify-start')
    expect(markup).toContain('text-left')
    expect(markup).not.toContain('items-start')
    expect(markup).not.toContain('text-center')
  })

  it('fades long labels in a single row when requested', () => {
    const markup = renderToStaticMarkup(
      createElement(StatusChip, {
        item: { ...item, label: 'course-test-longer' },
        labelOverflow: 'fade'
      })
    )

    expect(markup).toContain('status-chip-label-fade')
    expect(markup).not.toContain('workspace-text-fade')
    expect(markup).toContain('flex-1')
    expect(markup).not.toContain('whitespace-normal')
  })
})
