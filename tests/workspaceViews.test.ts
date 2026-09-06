import { describe, expect, it } from 'vitest'

import { createWorkspaceView, normalizeWorkspaceViews } from '../src/shared/workspaceViews'

describe('workspace views', () => {
  it('creates source-specific defaults with stable names and table state', () => {
    const createdAt = '2026-08-29T10:00:00.000Z'
    const tasksView = createWorkspaceView('view-tasks', 'tasks', [], createdAt)
    const duplicateTasksView = createWorkspaceView('view-tasks-2', 'tasks', [tasksView], createdAt)
    const resourcesView = createWorkspaceView('view-resources', 'resources', [], createdAt)

    expect(tasksView).toMatchObject({
      id: 'view-tasks',
      name: 'Untitled Tasks View',
      source: 'tasks',
      config: {
        searchQuery: '',
        groupBy: 'none',
        sortState: { columnId: 'start-date', direction: 'asc' }
      },
      createdAt,
      updatedAt: createdAt
    })
    expect(duplicateTasksView.name).toBe('Untitled Tasks View 2')
    expect(resourcesView).toMatchObject({
      name: 'Untitled Resources View',
      source: 'resources',
      config: { searchQuery: '', sortState: null }
    })
    expect(tasksView.icon.glyph).toBe('list-check')
    expect(resourcesView.icon.glyph).toBe('table')
  })

  it('normalizes malformed persisted views without changing their source', () => {
    const normalized = normalizeWorkspaceViews([
      {
        id: 'tasks-view',
        name: '  Planning  ',
        source: 'tasks',
        icon: { set: 'tabler', glyph: 'calendar', variant: 'outlined', color: '#38bdf8' },
        config: {
          searchQuery: '  launch ',
          statuses: ['pending', 'not-a-status'],
          groupBy: 'priority',
          sortState: { columnId: 'priority', direction: 'desc' }
        },
        createdAt: '2026-08-28T10:00:00.000Z',
        updatedAt: '2026-08-29T10:00:00.000Z'
      },
      {
        id: 'resources-view',
        name: 'Resources',
        source: 'resources',
        config: {
          searchQuery: 'docs',
          providers: ['web', 'invalid-provider'],
          sortState: { columnId: 'location', direction: 'asc' }
        },
        createdAt: '2026-08-28T10:00:00.000Z',
        updatedAt: '2026-08-29T10:00:00.000Z'
      },
      { id: '', name: 'Ignored', source: 'tasks' }
    ])

    expect(normalized).toHaveLength(2)
    expect(normalized[0]).toMatchObject({
      id: 'tasks-view',
      name: 'Planning',
      source: 'tasks',
      icon: { glyph: 'calendar', variant: 'outlined', color: '#38bdf8' },
      config: {
        searchQuery: '  launch ',
        statuses: ['pending'],
        groupBy: 'priority',
        sortState: { columnId: 'priority', direction: 'desc' }
      }
    })
    expect(normalized[1]).toMatchObject({
      id: 'resources-view',
      source: 'resources',
      config: { providers: ['web'], sortState: { columnId: 'location', direction: 'asc' } }
    })
  })
})
