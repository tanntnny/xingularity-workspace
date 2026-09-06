import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NotebookPen } from '../src/renderer/src/components/ui/icons'
import { describe, expect, it } from 'vitest'
import { AppSidebar } from '../src/renderer/src/components/AppSidebar'
import { SidebarHeader, SidebarProvider } from '../src/renderer/src/components/ui/sidebar'
import { Shortcut } from '../src/renderer/src/components/ui/kbd'
import { ToggleGroup, ToggleGroupItem } from '../src/renderer/src/components/ui/toggle-group'
import { WorkspaceTabManager } from '../src/renderer/src/components/ui/document-workspace'
import { createWorkspaceView } from '../src/shared/workspaceViews'

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
    expect(markup).toContain('text-xs font-bold text-muted-foreground')
    expect(markup).toContain('size-4')
    expect(markup).toContain('size-3')
    expect(markup).toContain('!size-3')
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
    expect(markup.match(/tabler-icon-box/g)).toHaveLength(2)
    expect(markup.match(/tabler-icon-files/g)).toHaveLength(1)
    expect(markup.match(/tabler-icon-calendar-event/g)).toHaveLength(1)
    expect(markup.match(/tabler-icon-chart-dots-3/g)).toHaveLength(1)
    expect(markup.match(/tabler-icon-brand-mastercard/g)).toHaveLength(1)
    expect(markup.match(/tabler-icon-bolt/g)).toHaveLength(1)
    expect(markup.match(/tabler-icon-mail/g)).toHaveLength(1)
    expect(markup.match(/tabler-icon-search/g)).toHaveLength(1)
    expect(markup).not.toContain('>Board</span>')
    const workspaceIndex = markup.indexOf('>Workspace</span>')
    expect(workspaceIndex).toBeGreaterThanOrEqual(0)
    const viewIndex = markup.indexOf('>View</span>')
    expect(viewIndex).toBeGreaterThanOrEqual(0)
    const inboxIndex = markup.indexOf('>Inbox</span>')
    expect(inboxIndex).toBeGreaterThanOrEqual(0)
    expect(markup.indexOf('>Capture</span>')).toBeGreaterThan(inboxIndex)
    expect(inboxIndex).toBeLessThan(workspaceIndex)
    expect(markup.indexOf('>Notebooks</span>')).toBeGreaterThan(workspaceIndex)
    expect(markup.indexOf('>Projects</span>')).toBeGreaterThan(markup.indexOf('>Notebooks</span>'))
    expect(markup.indexOf('>Calendar</span>')).toBeGreaterThan(markup.indexOf('>Projects</span>'))
    expect(markup.indexOf('>Tasks</span>')).toBeGreaterThan(markup.indexOf('>Calendar</span>'))
    expect(markup.indexOf('>Resources</span>')).toBeGreaterThan(markup.indexOf('>Tasks</span>'))
    expect(markup.indexOf('>Knowledge</span>')).toBeGreaterThan(markup.indexOf('>Resources</span>'))

    const taskPageButton = markup.match(
      /<button[^>]*data-testid="sidebar-page:tasks"[^>]*>[\s\S]*?<\/button>/
    )?.[0]
    const resourcePageButton = markup.match(
      /<button[^>]*data-testid="sidebar-page:resources"[^>]*>[\s\S]*?<\/button>/
    )?.[0]

    expect(taskPageButton).toContain('tabler-icon-table')
    expect(resourcePageButton).toContain('tabler-icon-table')
    expect(taskPageButton).not.toContain('tabler-icon-list-check-filled')
    expect(markup.indexOf('>Workspace</span>')).toBeLessThan(viewIndex)
    expect(markup).toContain('data-testid="sidebar-create-view"')
    expect(markup).toContain('>Create View</span>')
    expect(markup).not.toContain('data-sidebar="group-action"')
    expect(markup).toContain('>Automation</span>')
    expect(markup).toContain('>Scheduling</span>')
    expect(markup).toContain('data-testid="sidebar-page:schedules"')
    expect(markup).not.toContain('data-testid="sidebar-badge:schedules"')
    expect(markup.indexOf('>Automation</span>')).toBeGreaterThan(
      markup.indexOf('>Knowledge</span>')
    )
    expect(markup.indexOf('>Finance</span>')).toBeGreaterThan(markup.indexOf('>Automation</span>'))
    expect(markup).toContain(
      'data-sidebar="group" class="relative flex w-full min-w-0 flex-col p-1 mt-2"'
    )
    const firstSeparatorIndex = markup.indexOf('data-sidebar="separator"')
    const lastSeparatorIndex = markup.lastIndexOf('data-sidebar="separator"')
    expect(markup.match(/data-sidebar="separator"/g)).toHaveLength(2)
    expect(markup).toContain(
      'data-sidebar="separator" class="h-[var(--border-width)] w-auto bg-sidebar-border mx-1"'
    )
    expect(markup.indexOf('data-testid="sidebar-vault-manager"')).toBeLessThan(firstSeparatorIndex)
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

  it('renders saved views below the View section', () => {
    const view = createWorkspaceView('tasks-view', 'tasks', [], '2026-08-29T10:00:00.000Z')
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
          calendarUndoneCount: 0,
          workspaceViews: [view],
          activeWorkspaceViewId: view.id,
          onOpenWorkspaceView: () => undefined,
          onCreateWorkspaceView: () => undefined,
          onDeleteWorkspaceView: () => undefined
        })
      )
    )

    expect(markup).toContain(`data-testid="sidebar-view:${view.id}"`)
    expect(markup).toContain(
      `class="workspace-text-fade sidebar-workspace-text-fade block max-w-full min-w-0 flex-1">${view.name}</span>`
    )
    expect(markup).toContain('text-clip')
    expect(markup).toContain(`data-testid="sidebar-view-actions:${view.id}"`)
    expect(markup).toContain('data-testid="sidebar-create-view"')
    expect(markup.indexOf(`data-testid="sidebar-view:${view.id}"`)).toBeLessThan(
      markup.indexOf('data-testid="sidebar-create-view"')
    )
  })

  it('keeps the source page in its hover state while a saved view is active', () => {
    const taskView = createWorkspaceView('tasks-view', 'tasks', [], '2026-08-29T10:00:00.000Z')
    const resourceView = createWorkspaceView(
      'resources-view',
      'resources',
      [],
      '2026-08-29T10:00:00.000Z'
    )
    const renderMarkup = (activePage: 'tasks' | 'resources', activeViewId: string): string =>
      renderToStaticMarkup(
        createElement(
          SidebarProvider,
          null,
          createElement(AppSidebar, {
            activePage,
            onChange: () => undefined,
            onOpenSearchPalette: () => undefined,
            onOpenVaultManager: () => undefined,
            notesCount: 0,
            projectsCount: 0,
            calendarUndoneCount: 0,
            workspaceViews: [taskView, resourceView],
            activeWorkspaceViewId: activeViewId
          })
        )
      )

    const taskMarkup = renderMarkup('tasks', taskView.id)
    const resourceMarkup = renderMarkup('resources', resourceView.id)
    const taskPageButton = taskMarkup.match(
      /<button[^>]*data-testid="sidebar-page:tasks"[^>]*>/
    )?.[0]
    const resourcePageButton = resourceMarkup.match(
      /<button[^>]*data-testid="sidebar-page:resources"[^>]*>/
    )?.[0]

    expect(taskPageButton).toContain('data-active="false"')
    expect(resourcePageButton).toContain('data-active="false"')
    expect(taskMarkup).toContain(`data-testid="sidebar-view:${taskView.id}"`)
    expect(resourceMarkup).toContain(`data-testid="sidebar-view:${resourceView.id}"`)
  })

  it('shows the scheduling review count in the sidebar', () => {
    const markup = renderToStaticMarkup(
      createElement(
        SidebarProvider,
        null,
        createElement(AppSidebar, {
          activePage: 'schedules',
          onChange: () => undefined,
          onOpenSearchPalette: () => undefined,
          onOpenVaultManager: () => undefined,
          notesCount: 0,
          projectsCount: 0,
          calendarUndoneCount: 0,
          schedulingReviewCount: 2
        })
      )
    )

    expect(markup).toContain('data-testid="sidebar-badge:schedules"')
    expect(markup).toContain('aria-label="2 automations need review"')
    expect(markup).toContain('>2</div>')
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
    expect(markup).not.toContain('Weekly plan')
    expect(markup).not.toContain('sidebar-page:agent')
    expect(markup).not.toContain('>Agent</span>')
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
          {
            id: 'notes',
            label: 'A very long note title that fades before the tab close control',
            icon: createElement(NotebookPen),
            shortcut: ['cmd', '1']
          },
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
    expect(markup).toContain('data-testid="workspace-tab-label:notes"')
    expect(markup).toContain('workspace-tab-label-fade')
    expect(markup).toContain('workspace-text-fade')
    expect(markup).toContain('workspace-tab-card')
    expect(markup).toContain('rounded-sm bg-workspace data-[active=true]:bg-transparent')
    expect(markup).toContain('text-xs font-semibold text-muted-foreground')
    expect(markup).toContain('workspace-tab-shortcut-overlay')
    expect(markup).toContain('right-[var(--workspace-tab-control-height)]')
    expect(markup).toContain('workspace-tab-close-overlay')
    expect(markup).toContain('group-hover:opacity-100')
    expect(markup).toContain('group-focus-within:opacity-100')
    expect(markup).toContain('hover:bg-muted')
    expect(markup).not.toContain('&amp;_button]:rounded-[var(--radius-button-pill)]')
    expect(markup).toContain(
      'title="A very long note title that fades before the tab close control"'
    )
    expect(markup).toContain('data-testid="workspace-tab-shortcut:notes"')
    expect(markup).toContain('app-drag-region min-w-0 flex-1 overflow-x-auto')
    expect(markup).toContain('app-no-drag flex w-max items-center gap-1')
    expect(markup).toContain('rounded-[var(--radius-button-pill)]')
    expect(markup).toContain('data-toggle-group-indicator="true"')
    expect(markup).toContain('transition-none')
    expect(markup).toContain('aria-label="Command"')
    expect(markup).toContain('aria-label="1"')
    expect(markup).toContain('data-active="true"')
  })

  it('insets the workspace tab manager for macOS traffic lights when requested', () => {
    const markup = renderToStaticMarkup(
      createElement(WorkspaceTabManager, {
        tabs: [{ id: 'notes', label: 'Notes' }],
        activeTabId: 'notes',
        onSelectTab: () => undefined,
        onCloseTab: () => undefined,
        onAddTab: () => undefined,
        macosTrafficLightInset: true
      })
    )

    expect(markup).toContain('pl-24')
  })
})
