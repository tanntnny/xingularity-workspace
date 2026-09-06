import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { WorkspaceIdentityEditor } from '../src/renderer/src/components/WorkspaceIdentityEditor'

describe('WorkspaceIdentityEditor', () => {
  it('renders the shared view identity fields used by the breadcrumb popover', () => {
    const markup = renderToStaticMarkup(
      createElement(WorkspaceIdentityEditor, {
        name: 'Launch planning',
        icon: { set: 'tabler', glyph: 'list-check', variant: 'filled', color: '#38bdf8' },
        onNameChange: () => undefined,
        onNameCommit: () => undefined,
        onIconChange: () => undefined,
        entityLabel: 'view',
        testIdPrefix: 'workspace-view'
      })
    )

    expect(markup).toContain('data-testid="workspace-view-header"')
    expect(markup).toContain('data-testid="workspace-view-icon-row"')
    expect(markup).toContain('data-testid="workspace-view-icon-trigger"')
    expect(markup).toContain('data-testid="workspace-view-name-row"')
    expect(markup).toContain('aria-label="View name"')
    expect(markup).toContain('value="Launch planning"')
  })
})
