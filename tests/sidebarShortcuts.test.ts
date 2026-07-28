import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NotebookPen } from '../src/renderer/src/components/ui/icons'
import { describe, expect, it } from 'vitest'
import { AppSidebar } from '../src/renderer/src/components/AppSidebar'
import { SidebarHeader, SidebarProvider } from '../src/renderer/src/components/ui/sidebar'
import { Shortcut } from '../src/renderer/src/components/ui/kbd'
import { ToggleGroup, ToggleGroupItem } from '../src/renderer/src/components/ui/toggle-group'
import { WorkspaceTabManager } from '../src/renderer/src/components/ui/document-workspace'

describe('sidebar shortcuts', () => {
  it('adds macOS traffic-light clearance to the shared sidebar header', () => {
    const macMarkup = renderToStaticMarkup(
      createElement(
        SidebarProvider,
        { macosTrafficLightInset: true },
        createElement(SidebarHeader, null, 'Header')
      )
    )
    const defaultMarkup = renderToStaticMarkup(
      createElement(SidebarProvider, null, createElement(SidebarHeader, null, 'Header'))
    )

    expect(macMarkup).toContain('--sidebar-macos-traffic-light-inset:32px')
    expect(macMarkup).toContain('pt-[calc(0.75rem+var(--sidebar-macos-traffic-light-inset))]')
    expect(defaultMarkup).toContain('--sidebar-macos-traffic-light-inset:0px')
  })

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

  it('renders shortcut content inside a toggle group', () => {
    const markup = renderToStaticMarkup(
      createElement(
        ToggleGroup,
        {
          type: 'single',
          value: 'board'
        },
        createElement(
          ToggleGroupItem,
          { value: 'board' },
          'Board',
          createElement(Shortcut, {
            keys: ['option', 'tab'],
            'data-testid': 'toggle-group-shortcut'
          })
        ),
        createElement(ToggleGroupItem, { value: 'taskList' }, 'Task List')
      )
    )

    expect(markup).toContain('role="group"')
    expect(markup).toContain('data-state="on"')
    expect(markup).toContain('data-testid="toggle-group-shortcut"')
  })

  it('renders interactive workspace tabs with a create control', () => {
    const markup = renderToStaticMarkup(
      createElement(WorkspaceTabManager, {
        tabs: [
          { id: 'notes', label: 'Notebooks', icon: NotebookPen, shortcut: ['cmd', '1'] },
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
    expect(markup).toContain('data-testid="workspace-tab-icon:notes"')
    expect(markup).toContain('data-testid="workspace-tab-shortcut:notes"')
    expect(markup).toContain('aria-label="Command"')
    expect(markup).toContain('aria-label="1"')
    expect(markup).toContain('data-active="true"')
  })
})
