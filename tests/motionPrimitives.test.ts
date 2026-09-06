import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AppSidebar } from '../src/renderer/src/components/AppSidebar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '../src/renderer/src/components/ui/collapsible'
import { CollapsibleWorkspacePanelSection } from '../src/renderer/src/components/ui/workspace-panel-section'
import { SidebarProvider } from '../src/renderer/src/components/ui/sidebar'

describe('motion primitives', () => {
  it('adds a state-driven animation contract to collapsible content', () => {
    const markup = renderToStaticMarkup(
      createElement(
        Collapsible,
        { defaultOpen: true },
        createElement(CollapsibleTrigger, null, 'Details'),
        createElement(CollapsibleContent, null, 'Content')
      )
    )

    expect(markup).toContain('motion-collapsible-content')
    expect(markup).toContain('data-state="open"')
  })

  it('applies the shared disclosure motion to workspace sections', () => {
    const markup = renderToStaticMarkup(
      createElement(
        CollapsibleWorkspacePanelSection,
        { heading: 'Details' },
        createElement('div', null, 'Content')
      )
    )

    expect(markup).toContain('motion-collapsible-content')
    expect(markup).toContain('motion-state-chevron')
    expect(markup).toContain('aria-expanded="true"')
  })

  it('uses the shared chevron motion for sidebar disclosure groups', () => {
    const markup = renderToStaticMarkup(
      createElement(
        SidebarProvider,
        null,
        createElement(AppSidebar, {
          activePage: 'notes',
          onChange: () => undefined,
          onOpenSearchPalette: () => undefined,
          onOpenVaultManager: () => undefined,
          notesCount: 0,
          projectsCount: 0,
          calendarUndoneCount: 0
        })
      )
    )

    expect(markup).toContain('motion-collapsible-content')
    expect(markup).toContain('motion-state-chevron')
  })

  it('uses the shared sidebar motion primitive for offcanvas state', () => {
    const markup = renderToStaticMarkup(
      createElement(
        SidebarProvider,
        { open: false },
        createElement(AppSidebar, {
          activePage: 'notes',
          onChange: () => undefined,
          onOpenSearchPalette: () => undefined,
          onOpenVaultManager: () => undefined,
          notesCount: 0,
          projectsCount: 0,
          calendarUndoneCount: 0,
          collapsible: 'offcanvas'
        })
      )
    )

    expect(markup).toContain('motion-sidebar-gap')
    expect(markup).toContain('motion-sidebar')
    expect(markup).toContain('group-data-[collapsible=offcanvas]:-translate-x-full')
  })
})
