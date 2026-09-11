import { createElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/renderer/src/components/ui/responsive-picker', () => ({
  ResponsivePicker: ({ trigger, children }: { trigger: ReactElement; children: ReactNode }) =>
    createElement(
      'div',
      null,
      createElement('div', { 'aria-haspopup': 'dialog' }, trigger),
      children
    )
}))

import { ResourceLabelsEditor } from '../src/renderer/src/components/ResourceLabelsEditor'
import { ResourceProjectsEditor } from '../src/renderer/src/components/ResourceProjectsEditor'
import type { Project } from '../src/shared/types'

const project: Project = {
  id: 'project-1',
  name: 'Atlas',
  description: '',
  summary: '',
  state: 'active',
  updatedAt: '2026-08-20T00:00:00.000Z',
  icon: { variant: 'filled', color: '#2563eb' },
  milestones: []
}

describe('resource dialog property editors', () => {
  it('renders labels as a chip-backed editor', () => {
    const markup = renderToStaticMarkup(
      createElement(ResourceLabelsEditor, {
        drafts: [{ id: 'label-1', key: 'status', value: 'active' }],
        onChange: () => undefined
      })
    )

    expect(markup).toContain('data-testid="resource-labels-editor"')
    expect(markup).toContain('data-testid="resource-labels-editor-trigger"')
    expect(markup).toContain('aria-label="Labels selection"')
    expect(markup).toContain('aria-haspopup="dialog"')
    expect(markup).toContain('rounded-[var(--radius-button-pill)]')
    expect(markup).toContain('>Labels</span>')
    expect(markup).toContain('data-testid="label-1-value-trigger"')
    expect(markup).toContain('aria-label="Remove status label"')
    expect(markup).toContain('data-testid="label-1-key"')
    expect(markup).toContain('>status</span>')
    expect(markup).not.toMatch(/<input[^>]*data-testid="label-1-key"/)
    expect(markup).not.toContain('data-testid="label-1-value"')
    expect(markup).not.toContain('>Value</label>')
    expect(markup).toContain('px-3 py-2')
    expect(markup).toContain('hover:bg-surface-subtle-hover')
    expect(markup.indexOf('data-testid="label-1-value-trigger"')).toBeLessThan(
      markup.indexOf('data-testid="resource-labels-editor-add"')
    )
  })

  it('keeps an empty labels popover blank while retaining the add action', () => {
    const markup = renderToStaticMarkup(
      createElement(ResourceLabelsEditor, {
        drafts: [],
        onChange: () => undefined
      })
    )

    expect(markup).toContain('>Add label</span>')
    expect(markup).not.toContain('Use stable keys and values to make resources easier to filter.')
    expect(markup).not.toContain(
      'Enter a key and value. Press Enter in the last value to add another row.'
    )
    expect(markup).not.toContain('No labels yet')
    expect(markup).not.toContain('Add your first label')
  })

  it('renders the selected project on a chip-backed multi-select', () => {
    const markup = renderToStaticMarkup(
      createElement(ResourceProjectsEditor, {
        value: [project.id],
        projects: [project],
        onChange: () => undefined
      })
    )

    expect(markup).toContain('data-testid="resource-projects-editor"')
    expect(markup).toContain('data-testid="resource-projects-editor-trigger"')
    expect(markup).toContain('aria-label="Projects selection"')
    expect(markup).toContain('aria-haspopup="dialog"')
    expect(markup).toContain('rounded-[var(--radius-button-pill)]')
    expect(markup).toContain('>Atlas</span>')
  })
})
