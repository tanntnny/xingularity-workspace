import { describe, expect, it } from 'vitest'

import { createWorkspaceView } from '../src/shared/workspaceViews'
import {
  buildResourceWorkspaceViewConfig,
  buildTaskWorkspaceViewConfig,
  getResourceWorkspaceViewState,
  getTaskWorkspaceViewState
} from '../src/renderer/src/lib/workspaceViewState'

describe('workspace view table state', () => {
  it('maps a task view config to the existing task page controls', () => {
    const view = createWorkspaceView('tasks-view', 'tasks', [], '2026-08-29T10:00:00.000Z')
    view.config = {
      ...view.config,
      searchQuery: 'launch',
      statuses: ['pending'],
      projectIds: ['project-1'],
      groupBy: 'priority',
      sortState: { columnId: 'priority', direction: 'desc' }
    }

    const state = getTaskWorkspaceViewState(view)

    expect(state).toEqual({
      filters: expect.objectContaining({
        searchQuery: 'launch',
        statuses: ['pending'],
        projectIds: ['project-1']
      }),
      groupBy: 'priority',
      sortState: { columnId: 'priority', direction: 'desc' }
    })
    expect(buildTaskWorkspaceViewConfig(state)).toEqual(view.config)
  })

  it('maps a resource view config to the existing resource page controls', () => {
    const view = createWorkspaceView('resources-view', 'resources', [], '2026-08-29T10:00:00.000Z')
    view.config = {
      ...view.config,
      searchQuery: 'docs',
      providers: ['web'],
      labelFilters: { topic: ['planning'] },
      sortState: { columnId: 'location', direction: 'asc' }
    }

    const state = getResourceWorkspaceViewState(view)

    expect(state).toEqual({
      filters: expect.objectContaining({
        searchQuery: 'docs',
        providers: ['web'],
        labelFilters: { topic: ['planning'] }
      }),
      sortState: { columnId: 'location', direction: 'asc' }
    })
    expect(buildResourceWorkspaceViewConfig(state)).toEqual(view.config)
  })
})
