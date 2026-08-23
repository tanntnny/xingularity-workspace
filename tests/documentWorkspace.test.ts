import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  DocumentWorkspace,
  DocumentWorkspaceMainHeader,
  DocumentWorkspaceMainContent,
  DocumentWorkspacePanel,
  DocumentWorkspacePanelContent,
  WorkspaceContextProvider,
  WorkspaceHeaderActions,
  WorkspaceIconButton,
  WorkspacePageContextMenu,
  WorkspacePanelStack,
  WorkspaceResizableLayout
} from '../src/renderer/src/components/ui/document-workspace'
import { BreadcrumbButton } from '../src/renderer/src/components/ui/breadcrumb'
import { Card } from '../src/renderer/src/components/ui/card'
import { WorkspacePanelSection } from '../src/renderer/src/components/ui/workspace-panel-section'
import { SidebarProvider, SidebarRail } from '../src/renderer/src/components/ui/sidebar'
import { WorkspacePage } from '../src/renderer/src/components/workspace/page'

describe('document workspace right panel', () => {
  it('uses panel surfaces for secondary header controls', () => {
    const markup = renderToStaticMarkup(
      createElement(
        WorkspaceContextProvider,
        {
          hasPanel: true,
          onTogglePanel: () => undefined
        },
        createElement(DocumentWorkspaceMainHeader, {
          pageContextMenu: createElement(
            WorkspacePageContextMenu,
            null,
            createElement('div', null, 'Actions')
          ),
          secondaryActions: createElement(WorkspaceIconButton, {
            icon: 'Filter',
            label: 'Filter',
            'aria-label': 'Filter'
          })
        })
      )
    )

    const secondaryRow = markup.match(/<div data-workspace-header-row="secondary"[^>]*>/)?.[0]

    expect(secondaryRow).toContain('bg-panel')
    expect(secondaryRow).toContain(
      '[&amp;_button:not([data-tab-toggle-group-item]):hover]:bg-panel-hover'
    )
    expect(secondaryRow).toContain(
      '[&amp;_button:not([data-tab-toggle-group-item]):focus-visible]:bg-panel-hover'
    )
    expect(markup).toContain('aria-label="Close right sidebar"')
  })

  it('keeps the page breadcrumb and context menu in the primary header row', () => {
    const markup = renderToStaticMarkup(
      createElement(
        WorkspaceContextProvider,
        null,
        createElement(DocumentWorkspaceMainHeader, {
          breadcrumb: createElement('span', { 'data-testid': 'page-breadcrumb' }, 'Projects'),
          pageContextMenu: createElement(
            WorkspacePageContextMenu,
            null,
            createElement('div', null, 'Actions')
          )
        })
      )
    )

    const primaryRow = markup.match(/<div data-workspace-header-row="primary"[^>]*>/)?.[0]

    expect(primaryRow).toBeDefined()
    expect(markup).toContain('data-testid="page-breadcrumb"')
    expect(markup).toContain('data-testid="workspace-page-context-menu-trigger"')
    expect(markup).toContain('aria-label="Open page context menu"')
  })

  it('omits the page context menu trigger when no page actions are available', () => {
    const markup = renderToStaticMarkup(
      createElement(
        WorkspaceContextProvider,
        null,
        createElement(DocumentWorkspaceMainHeader, {
          breadcrumb: createElement('span', { 'data-testid': 'page-breadcrumb' }, 'Settings')
        })
      )
    )

    expect(markup).toContain('data-testid="page-breadcrumb"')
    expect(markup).not.toContain('data-testid="workspace-page-context-menu-trigger"')
  })

  it('uses muted topbar actions and borderless hover-only primary-row controls', () => {
    const markup = renderToStaticMarkup(
      createElement(
        WorkspaceContextProvider,
        {
          hasPanel: true,
          onTogglePanel: () => undefined
        },
        createElement(DocumentWorkspaceMainHeader, {
          breadcrumb: createElement(BreadcrumbButton, null, 'Projects'),
          pageContextMenu: createElement(
            WorkspacePageContextMenu,
            null,
            createElement('div', null, 'Actions')
          ),
          secondaryActions: createElement(WorkspaceIconButton, {
            icon: 'Filter',
            'aria-label': 'Filter',
            'data-testid': 'secondary-header-action'
          })
        })
      )
    )

    const primaryRow = markup.match(/<div data-workspace-header-row="primary"[^>]*>/)?.[0]
    const contextTrigger = markup.match(
      /<button[^>]*data-testid="workspace-page-context-menu-trigger"[^>]*>/
    )?.[0]
    const secondaryAction = markup.match(
      /<button[^>]*data-testid="secondary-header-action"[^>]*>/
    )?.[0]

    expect(primaryRow).toContain('[&amp;_button]:border-0')
    expect(primaryRow).toContain('[&amp;_button:not(.bg-accent)]:bg-transparent')
    expect(primaryRow).toContain('[&amp;_button:not(.bg-accent):hover]:bg-muted')
    expect(primaryRow).toContain('[&amp;_button:not(.bg-accent):focus-visible]:bg-muted')
    expect(contextTrigger).toContain('text-muted-foreground')
    expect(secondaryAction).toContain('border border-input')

    const accentActionMarkup = renderToStaticMarkup(
      createElement(
        WorkspaceContextProvider,
        null,
        createElement(DocumentWorkspaceMainHeader, {
          primaryRightActions: createElement(WorkspaceIconButton, {
            icon: 'Plus',
            label: 'Add resource',
            variant: 'accent',
            'data-testid': 'add-resource-button'
          })
        })
      )
    )

    expect(accentActionMarkup).toContain('data-testid="add-resource-button"')
    expect(accentActionMarkup).toContain('bg-accent')
    expect(accentActionMarkup).toContain('hover:bg-accent-hover')

    const labeledActionMarkup = renderToStaticMarkup(
      createElement(
        WorkspaceHeaderActions,
        null,
        createElement(WorkspaceIconButton, {
          icon: 'Filter',
          label: 'Filter',
          'aria-label': 'Filter'
        })
      )
    )

    expect(labeledActionMarkup).not.toContain('text-muted-foreground')
  })

  it('uses the softer panel border token across shared surfaces', () => {
    const markup = renderToStaticMarkup(
      createElement(
        'div',
        null,
        createElement(Card, null, 'Card'),
        createElement(WorkspacePanelSection, null, 'Panel'),
        createElement(DocumentWorkspace, null, 'Workspace')
      )
    )

    expect(markup.match(/border-panel-border/g)).toHaveLength(3)
    expect(markup).toContain('border border-panel-border')
    expect(markup).not.toContain('border-[0.5px]')
  })

  it('provides a full-width scrolling main content surface', () => {
    const markup = renderToStaticMarkup(createElement(DocumentWorkspaceMainContent, null, 'body'))

    expect(markup).toContain('<main')
    expect(markup).toContain('w-full')
    expect(markup).toContain('max-w-none')
    expect(markup).toContain('overflow-auto')
    expect(markup).toContain('px-2')
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
    expect(markup).toContain('h-full')
    expect(markup).toContain('min-h-0')
    expect(markup).toContain('data-testid="panel-one"')
    expect(markup).toContain('data-testid="panel-two"')
    expect(markup).toContain('gap-3')
    expect(markup).toContain('overflow-y-auto')
    expect(markup).not.toContain('bg-card p-3')
  })

  it('keeps the panel frame clipped while the stack owns vertical scrolling', () => {
    const markup = renderToStaticMarkup(
      createElement(
        DocumentWorkspacePanelContent,
        { className: 'overflow-hidden' },
        createElement(WorkspacePanelStack, null, createElement('section', null, 'Panel'))
      )
    )

    expect(markup).toContain('overflow-hidden')
    expect(markup).toContain('overflow-y-auto')
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
    expect(markup).toContain('w-2')
    expect(markup).toContain('bg-transparent')
    expect(markup).toContain('data-resize-direction="x"')
    expect(markup).toContain('resize-affordance')
    expect(markup).not.toContain('data-[separator=active]:bg-ring')
    expect(markup).toContain('data-testid="workspace-main"')
    expect(markup).toContain('data-testid="workspace-right-panel-content-one"')
    expect(markup).toContain('data-testid="workspace-right-panel-content-two"')
  })

  it('marks the sidebar rail as a horizontal resize affordance', () => {
    const markup = renderToStaticMarkup(
      createElement(SidebarProvider, null, createElement(SidebarRail))
    )

    expect(markup).toContain('data-sidebar="rail"')
    expect(markup).toContain('data-resize-direction="x"')
    expect(markup).toContain('resize-affordance')
    expect(markup).toContain('aria-orientation="vertical"')
  })
})
