import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  WorkspaceListRail,
  WorkspaceListRailItem
} from '../src/renderer/src/components/ui/workspace-list-rail'

describe('workspace list rail', () => {
  it('renders semantic list structure and item slots', () => {
    const markup = renderToStaticMarkup(
      createElement(
        WorkspaceListRail,
        { 'aria-label': 'Projects' },
        createElement(
          WorkspaceListRailItem,
          {
            active: true,
            leading: createElement('span', { 'aria-hidden': true }, 'P'),
            trailing: createElement('span', { 'aria-hidden': true }, '*'),
            description: 'Active project'
          },
          'Alpha Project'
        )
      )
    )

    expect(markup).toContain('<nav')
    expect(markup).toContain('aria-label="Projects"')
    expect(markup).toContain('<ul')
    expect(markup).toContain('<li')
    expect(markup).toContain('<button')
    expect(markup).toContain('aria-current="page"')
    expect(markup).toContain('data-active="true"')
    expect(markup).toContain('>Alpha Project</span>')
    expect(markup).toContain('>Active project</span>')
  })

  it('renders the empty state without an empty list', () => {
    const markup = renderToStaticMarkup(
      createElement(WorkspaceListRail, {
        'aria-label': 'Projects',
        emptyState: 'No projects yet'
      })
    )

    expect(markup).toContain('No projects yet')
    expect(markup).not.toContain('<ul')
  })

  it('supports single-row fading labels', () => {
    const markup = renderToStaticMarkup(
      createElement(WorkspaceListRailItem, null, 'A long design audit destination label')
    )

    expect(markup).toContain('workspace-text-fade')
    expect(markup).not.toContain('truncate')
  })
})
