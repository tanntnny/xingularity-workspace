import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { StatusChipSelect } from '../src/renderer/src/components/ui/status-chip-select'

const options = [
  {
    value: 'completed',
    label: 'Completed',
    icon: createElement('svg', { 'aria-hidden': true }),
    iconColorToken: 'var(--status-chip-task-status-completed-icon)'
  },
  {
    value: 'blocked',
    label: 'Blocked',
    icon: createElement('svg', { 'aria-hidden': true }),
    iconColorToken: 'var(--status-chip-task-status-blocked-icon)'
  }
] as const

const placeholderOptions = [
  {
    value: '__none__',
    label: 'No project',
    icon: createElement('svg', { 'aria-hidden': true }),
    iconColorToken: 'var(--muted-foreground)',
    mutedTrigger: true
  },
  ...options
] as const

describe('StatusChipSelect', () => {
  it('renders the selected value with an accessible field label', () => {
    const markup = renderToStaticMarkup(
      createElement(StatusChipSelect, {
        label: 'Task status',
        value: 'completed',
        options,
        surface: 'pill',
        onValueChange: () => undefined
      })
    )

    expect(markup).toContain('aria-label="Task status: Completed"')
    expect(markup).toContain('>Completed</span>')
    expect(markup).toContain('aria-haspopup="dialog"')
    expect(markup).toMatch(/<button[^>]*class="[^"]*items-center justify-start/)
    expect(markup).toContain('text-left')
    expect(markup).not.toMatch(/<button[^>]*class="[^"]*(items-start|justify-center)/)
    expect(markup).toContain('text-sm')
    expect(markup).toContain('border border-border')
    expect(markup).toContain('px-2')
    expect(markup).not.toContain('px-[var(--control-padding-x)]')
    expect(markup).toContain('bg-surface-subtle')
    expect(markup).toContain('hover:bg-surface-subtle-hover')
    expect(markup).toContain('focus-visible:bg-surface-subtle-hover')
    expect(markup).not.toContain('bg-secondary')
  })

  it('passes the bare trigger variant through without changing the option surfaces', () => {
    const markup = renderToStaticMarkup(
      createElement(StatusChipSelect, {
        label: 'Task status',
        value: 'completed',
        options,
        variant: 'bare',
        onValueChange: () => undefined
      })
    )

    expect(markup).toContain('group/status-chip')
    expect(markup).toContain('group-hover/status-chip:text-foreground')
    expect(markup).toContain('text-sm')
  })

  it('passes label wrapping through to the selected chip and options', () => {
    const markup = renderToStaticMarkup(
      createElement(StatusChipSelect, {
        label: 'Task project',
        value: 'completed',
        options,
        wrapLabel: true,
        onValueChange: () => undefined
      })
    )

    expect(markup).toContain('whitespace-normal')
    expect(markup).toContain('break-words')
  })

  it('supports muted selected labels', () => {
    const markup = renderToStaticMarkup(
      createElement(StatusChipSelect, {
        label: 'Task project',
        value: 'completed',
        options,
        mutedLabel: true,
        onValueChange: () => undefined
      })
    )

    expect(markup).toMatch(/<span class="[^"]*text-muted-foreground[^"]*">Completed<\/span>/)
    expect(markup).not.toMatch(/<span class="[^"]*text-foreground[^"]*">Completed<\/span>/)
  })

  it('mutes placeholder labels on the trigger', () => {
    const markup = renderToStaticMarkup(
      createElement(StatusChipSelect, {
        label: 'Task project',
        value: '__none__',
        options: placeholderOptions,
        onValueChange: () => undefined
      })
    )

    expect(markup).toMatch(
      /<span class="[^"]*w-full text-left text-sm[^"]*text-muted-foreground[^"]*">No project<\/span>/
    )
    expect(markup).toContain('aria-haspopup="dialog"')
  })
})
