import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  DocumentWorkspaceMainContent,
  DocumentWorkspacePanel,
  WorkspacePanelStack,
  WorkspaceResizableLayout
} from '../src/renderer/src/components/ui/document-workspace'
import { WorkspacePage } from '../src/renderer/src/components/workspace/page'

describe('document workspace right panel', () => {
  it('provides a full-width scrolling main content surface', () => {
    const markup = renderToStaticMarkup(createElement(DocumentWorkspaceMainContent, null, 'body'))

    expect(markup).toContain('<main')
    expect(markup).toContain('w-full')
    expect(markup).toContain('max-w-none')
    expect(markup).toContain('overflow-auto')
    expect(markup).toContain('p-2')
  })

  it('keeps page composition full-width without adding a nested main landmark', () => {
    const markup = renderToStaticMarkup(createElement(WorkspacePage, null, 'body'))

    expect(markup).toContain('min-h-full')
    expect(markup).toContain('w-full')
    expect(markup).not.toContain('<main')
    expect(markup).not.toContain('max-w-')
  })

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
        createElement('aside', { 'data-testid': 'workspace-right-panel-content-one' }),
        createElement('aside', { 'data-testid': 'workspace-right-panel-content-two' })
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
    expect(markup).toContain('data-testid="workspace-right-panel-content-one"')
    expect(markup).toContain('data-testid="workspace-right-panel-content-two"')
  })
})
