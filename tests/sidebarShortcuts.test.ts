import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AppSidebar } from '../src/renderer/src/components/AppSidebar'
import { SidebarProvider } from '../src/renderer/src/components/ui/sidebar'
import { Shortcut } from '../src/renderer/src/components/ui/kbd'
import { TabMenu, TabMenuItem } from '../src/renderer/src/components/ui/tab-menu'
import {
  DocumentWorkspace,
  DocumentWorkspaceMain,
  WorkspaceTabManager
} from '../src/renderer/src/components/ui/document-workspace'

describe('sidebar shortcuts', () => {
  it('renders icon-based Option+Tab shortcut keys', () => {
    const markup = renderToStaticMarkup(createElement(Shortcut, { keys: ['option', 'tab'] }))

    expect(markup).toContain('aria-label="Option"')
    expect(markup).toContain('aria-label="Tab"')
    expect(markup).not.toContain('>Opt<')
    expect(markup).not.toContain('>Tab<')
  })

  it('renders shortcut hints for the main home pages in the sidebar', () => {
    const markup = renderToStaticMarkup(
      createElement(
        SidebarProvider,
        null,
        createElement(AppSidebar, {
          activePage: 'notes',
          onChange: () => undefined,
          onOpenSearchPalette: () => undefined,
          notesCount: 3,
          projectsCount: 2,
          calendarUndoneCount: 4,
          profileName: 'Tanny'
        })
      )
    )

    expect(markup).toContain('data-testid="sidebar-shortcut:notes"')
    expect(markup).toContain('data-testid="sidebar-shortcut:projects"')
    expect(markup).toContain('data-testid="sidebar-shortcut:calendar"')
    expect(markup).toContain('data-testid="sidebar-shortcut:weeklyPlan"')
  })

  it('renders a trailing shortcut inside the tab menu group', () => {
    const markup = renderToStaticMarkup(
      createElement(
        TabMenu,
        {
          variant: 'toolbar',
          value: 'board',
          fullWidth: false,
          withSpacer: false,
          trailingAccessory: createElement(Shortcut, {
            keys: ['option', 'tab'],
            'data-testid': 'tab-menu-shortcut'
          })
        },
        createElement(TabMenuItem, { variant: 'toolbar', value: 'board' }, 'Board'),
        createElement(TabMenuItem, { variant: 'toolbar', value: 'taskList' }, 'Task List')
      )
    )

    expect(markup).toContain('tab-menu-group')
    expect(markup).toContain('tab-menu-accessory')
    expect(markup).toContain('data-testid="tab-menu-shortcut"')
  })

  it('renders a static current-route tab above the workspace content', () => {
    const markup = renderToStaticMarkup(
      createElement(
        DocumentWorkspace,
        { tabLabel: 'Notebooks' },
        createElement(DocumentWorkspaceMain, null, 'Workspace content')
      )
    )

    expect(markup).toContain('data-testid="workspace-current-tab"')
    expect(markup).toContain('aria-current="page"')
    expect(markup).toContain('>Notebooks<')
    expect(markup.indexOf('document-workspace-tab-manager')).toBeLessThan(
      markup.indexOf('document-workspace-main-surface')
    )
  })

  it('keeps the current-route tab non-interactive', () => {
    const markup = renderToStaticMarkup(createElement(WorkspaceTabManager, { label: 'Projects' }))

    expect(markup).not.toContain('<button')
    expect(markup).not.toContain('role="tab"')
  })
})
