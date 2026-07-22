import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AppSidebar } from '../src/renderer/src/components/AppSidebar'
import { SidebarProvider } from '../src/renderer/src/components/ui/sidebar'
import { Shortcut } from '../src/renderer/src/components/ui/kbd'
import { TabMenu, TabMenuItem } from '../src/renderer/src/components/ui/tab-menu'
import { WorkspaceTabManager } from '../src/renderer/src/components/ui/document-workspace'

describe('sidebar shortcuts', () => {
  it('renders icon-based Option+Tab shortcut keys', () => {
    const markup = renderToStaticMarkup(createElement(Shortcut, { keys: ['option', 'tab'] }))

    expect(markup).toContain('aria-label="Option"')
    expect(markup).toContain('aria-label="Tab"')
    expect(markup).not.toContain('>Opt<')
    expect(markup).not.toContain('>Tab<')
  })

  it('does not render page shortcut hints for tabs selected with Cmd+number', () => {
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

    expect(markup).not.toContain('data-testid="sidebar-shortcut:notes"')
    expect(markup).not.toContain('data-testid="sidebar-shortcut:knowledge"')
    expect(markup).not.toContain('data-testid="sidebar-shortcut:projects"')
    expect(markup).not.toContain('data-testid="sidebar-shortcut:calendar"')
    expect(markup).not.toContain('data-testid="sidebar-shortcut:weeklyPlan"')
    expect(markup).not.toContain('data-testid="sidebar-shortcut:schedules"')
    expect(markup).not.toContain('data-testid="sidebar-page:designAudit"')

    const weeklyPlanIndex = markup.indexOf('data-testid="sidebar-page:weeklyPlan"')
    expect(weeklyPlanIndex).toBeGreaterThanOrEqual(0)
    expect(markup.slice(Math.max(0, weeklyPlanIndex - 500), weeklyPlanIndex + 500)).toContain(
      'disabled=""'
    )
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

  it('renders interactive workspace tabs with a create control', () => {
    const markup = renderToStaticMarkup(
      createElement(WorkspaceTabManager, {
        tabs: [
          { id: 'notes', label: 'Notebooks' },
          { id: 'projects', label: 'Projects' }
        ],
        activeTabId: 'projects',
        onSelectTab: () => undefined,
        onCloseTab: () => undefined,
        onAddTab: () => undefined
      })
    )

    expect(markup).toContain('role="tablist"')
    expect(markup).toContain('data-testid="workspace-tab:notes"')
    expect(markup).toContain('data-testid="workspace-tab:projects"')
    expect(markup).toContain('data-testid="workspace-tab-close:projects"')
    expect(markup).toContain('data-testid="workspace-tab-add"')
    expect(markup).toContain('data-active="true"')
  })
})
