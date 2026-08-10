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
  it('uses the native sidebar composition and keeps macOS clearance at the app boundary', () => {
    const markup = renderToStaticMarkup(
      createElement(
        SidebarProvider,
        null,
        createElement(AppSidebar, {
          activePage: 'notes',
          onChange: () => undefined,
          onOpenSearchPalette: () => undefined,
          onOpenVaultManager: () => undefined,
          vaultName: 'Personal Vault',
          notesCount: 3,
          projectsCount: 2,
          calendarUndoneCount: 4,
          macosTrafficLightInset: true
        })
      )
    )

    expect(markup).toContain('data-sidebar="content"')
    expect(markup).toContain('data-sidebar="group-label"')
    expect(markup).toContain('data-sidebar="group-content"')
    expect(markup).toContain('data-sidebar="rail"')
    expect(markup).toContain('role="separator"')
    expect(markup).toContain('aria-label="Resize or toggle Sidebar"')
    expect(markup).toContain('--sidebar-width:256px')
    expect(markup).toContain('data-testid="sidebar-command-palette"')
    expect(markup).toContain('data-testid="sidebar-vault-manager"')
    expect(markup).toContain('text-muted-foreground')
    expect(markup).toContain('hover:text-sidebar-accent-foreground')
    expect(markup).toContain('data-active="true"')
    expect(markup).toContain('>Personal Vault</span>')
    expect(markup).not.toContain('>Board</span>')
    const viewIndex = markup.indexOf('>View</span>')
    expect(viewIndex).toBeGreaterThanOrEqual(0)
    const inboxIndex = markup.indexOf('>Inbox</span>')
    expect(inboxIndex).toBeGreaterThanOrEqual(0)
    expect(markup.indexOf('>Capture</span>')).toBeGreaterThan(inboxIndex)
    expect(inboxIndex).toBeLessThan(viewIndex)
    expect(markup.indexOf('>Notebooks</span>')).toBeGreaterThan(viewIndex)
    expect(markup.indexOf('>Projects</span>')).toBeGreaterThan(markup.indexOf('>Notebooks</span>'))
    expect(markup.indexOf('>Calendar</span>')).toBeGreaterThan(markup.indexOf('>Projects</span>'))
    expect(markup.indexOf('>Knowledge</span>')).toBeGreaterThan(markup.indexOf('>Calendar</span>'))
    expect(markup).toContain(
      'data-sidebar="group" class="relative flex w-full min-w-0 flex-col p-1 mt-2"'
    )
    const firstSeparatorIndex = markup.indexOf('data-sidebar="separator"')
    const lastSeparatorIndex = markup.lastIndexOf('data-sidebar="separator"')
    expect(markup.match(/data-sidebar="separator"/g)).toHaveLength(2)
    expect(markup).toContain(
      'data-sidebar="separator" class="h-px w-auto bg-sidebar-border mx-1"'
    )
    expect(markup.indexOf('data-testid="sidebar-vault-manager"')).toBeLessThan(
      firstSeparatorIndex
    )
    expect(firstSeparatorIndex).toBeLessThan(
      markup.indexOf('data-testid="sidebar-command-palette"')
    )
    expect(lastSeparatorIndex).toBeLessThan(markup.indexOf('data-testid="sidebar-page:settings"'))
    expect(markup).toContain('sidebar-brand-shimmer')
    expect(markup).toContain('!pt-11')
    expect(markup).not.toContain('<details')
    expect(markup).not.toContain('<summary')
    expect(markup.match(/data-testid="sidebar-command-palette"/g)).toHaveLength(1)

    const defaultMarkup = renderToStaticMarkup(
      createElement(SidebarProvider, null, createElement(SidebarHeader, null, 'Header'))
    )

    expect(defaultMarkup).not.toContain('sidebar-macos-traffic-light-inset')
  })

  it('keeps the normal sidebar visible at its minimum width', () => {
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
          calendarUndoneCount: 0
        })
      )
    )

    expect(markup).toContain('data-collapsible="min"')
    expect(markup).toContain('data-testid="sidebar-page:notes"')
    expect(markup).toContain('--sidebar-width-min:220px')
  })

  it('keeps focus mode on the off-canvas path', () => {
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

    expect(markup).toContain('data-collapsible="offcanvas"')
    expect(markup).toContain('group-data-[collapsible=offcanvas]:opacity-0')
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
          onOpenVaultManager: () => undefined,
          notesCount: 3,
          projectsCount: 2,
          calendarUndoneCount: 4,
          macosTrafficLightInset: false
        })
      )
    )

    expect(markup).not.toContain('data-testid="sidebar-shortcut:notes"')
    expect(markup).not.toContain('data-testid="sidebar-shortcut:knowledge"')
    expect(markup).not.toContain('data-testid="sidebar-shortcut:projects"')
    expect(markup).not.toContain('data-testid="sidebar-shortcut:calendar"')
    expect(markup).not.toContain('data-testid="sidebar-shortcut:schedules"')
    expect(markup).not.toContain('data-testid="sidebar-page:designAudit"')
    expect(markup).not.toContain('sidebar-page:weeklyPlan')
    expect(markup).not.toContain('Weekly Plan')
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
    expect(markup).toContain('app-drag-region min-w-0 flex-1 overflow-x-auto')
    expect(markup).toContain('app-no-drag flex w-max items-center gap-1.5')
    expect(markup).toContain('rounded-[var(--radius-button-pill)]')
    expect(markup).toContain('data-toggle-group-indicator="true"')
    expect(markup).toContain('transition-none')
    expect(markup).toContain('aria-label="Command"')
    expect(markup).toContain('aria-label="1"')
    expect(markup).toContain('data-active="true"')
  })
})
