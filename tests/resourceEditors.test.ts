import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

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
