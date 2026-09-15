import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { WorkspaceViewBreadcrumb } from '../src/renderer/src/components/WorkspaceViewBreadcrumb'
import { createWorkspaceView } from '../src/shared/workspaceViews'

describe('WorkspaceViewBreadcrumb', () => {
  it('shows the view icon and makes only the saved name editable', () => {
    const view = createWorkspaceView('tasks-view', 'tasks', [], '2026-08-29T10:00:00.000Z')
    const markup = renderToStaticMarkup(
      createElement(WorkspaceViewBreadcrumb, {
        view,
        onUpdateView: () => undefined
      })
    )

    expect(markup).toContain('data-testid="workspace-view-breadcrumb"')
    expect(markup).toContain('>View</span>')
    expect(markup).toContain('data-testid="workspace-view-breadcrumb-trigger"')
    expect(markup).toContain('aria-label="Edit view: Untitled Tasks View"')
    expect(markup).toContain('aria-haspopup="dialog"')
    expect(markup).toContain('data-project-icon-surface="none"')
    expect(markup).toContain('>Untitled Tasks View</span>')
  })
})
