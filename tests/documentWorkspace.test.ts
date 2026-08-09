import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  DocumentWorkspacePanel,
  WorkspacePanelStack,
  WorkspaceResizableLayout
} from '../src/renderer/src/components/ui/document-workspace'

describe('document workspace right panel', () => {
  it('renders a transparent shell with independently stackable content', () => {
    const markup = renderToStaticMarkup(
      createElement(
        DocumentWorkspacePanel,
        null,
        createElement(
          WorkspacePanelStack,
          null,
          createElement('section', { 'data-testid': 'panel-one' }),
          createElement('section', { 'data-testid': 'panel-two' })
        )
      )
    )

    expect(markup).toContain('bg-transparent')
    expect(markup).toContain('data-testid="panel-one"')
    expect(markup).toContain('data-testid="panel-two"')
    expect(markup).toContain('gap-3')
    expect(markup).not.toContain('bg-card p-3')
  })

  it('composes the main content and right panel into an accessible resizable group', () => {
    const markup = renderToStaticMarkup(
      createElement(
        WorkspaceResizableLayout,
        { panelWidth: 300 },
        createElement('main', { 'data-testid': 'workspace-main' }),
        createElement('aside', { 'data-testid': 'workspace-right-panel-content' })
      )
    )

    expect(markup).toContain('data-group')
    expect(markup).toContain('id="workspace-right-panel"')
    expect(markup).toContain('data-testid="workspace-right-panel"')
    expect(markup).toContain('data-testid="workspace-right-panel-resize"')
    expect(markup).toContain('aria-label="Resize right sidebar"')
    expect(markup).toContain('cursor-ew-resize')
    expect(markup).toContain('w-4')
    expect(markup).toContain('bg-transparent')
    expect(markup).toContain('after:w-[2px]')
    expect(markup).not.toContain('data-[separator=active]:bg-ring')
    expect(markup).toContain('data-testid="workspace-main"')
    expect(markup).toContain('data-testid="workspace-right-panel-content"')
  })
})
