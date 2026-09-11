import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { WorkspaceViewPage } from '../src/renderer/src/pages/WorkspaceViewPage'
import { createWorkspaceView } from '../src/shared/workspaceViews'
import { normalizeResourceInput } from '../src/shared/resourceDomain'
import type { Project } from '../src/shared/types'

const project: Project = {
  id: 'project-1',
  name: 'Atlas',
  description: '',
  summary: '',
  state: 'active',
  updatedAt: '2026-08-20T00:00:00.000Z',
  icon: { variant: 'filled', color: '#2563eb' },
  milestones: []
}

describe('WorkspaceViewPage', () => {
  it('renders a saved task view without a main identity header', () => {
    const view = createWorkspaceView('tasks-view', 'tasks', [], '2026-08-29T10:00:00.000Z')
    const markup = renderToStaticMarkup(
      createElement(WorkspaceViewPage, {
        view,
        projects: [project],
        tasks: [
          {
            id: 'task-1',
            title: 'Launch brief',
            tags: [],
            completed: false,
            status: 'pending',
            createdAt: '2026-08-20T00:00:00.000Z',
            priority: 'high',
            taskType: 'review',
            projectId: project.id,
            reminders: []
          }
        ],
        onOpenTask: () => undefined,
        onUpdateView: () => undefined,
        resourcePageProps: {
          projects: [project],
          noteTree: [],
          folderColors: {},
          resources: [],
          relations: [],
          onCreateResource: async () => undefined,
          onUpdateResource: async () => undefined,
          onSetResourceProjectLinks: async () => undefined,
          onRemoveResource: async () => undefined,
          onOpenResource: async () => undefined,
          onOpenNotebookResource: () => undefined
        }
      })
    )

    expect(markup).toContain('data-testid="workspace-view-page"')
    expect(markup).not.toContain('data-testid="workspace-view-identity"')
    expect(markup).not.toContain('data-testid="workspace-view-icon-trigger"')
    expect(markup).not.toContain('data-testid="workspace-view-name-row"')
    expect(markup).toContain('data-testid="tasks-table"')
    expect(markup).toContain('>Launch brief</span>')
  })

  it('renders a saved resource view through the existing resource table', () => {
    const view = createWorkspaceView('resources-view', 'resources', [], '2026-08-29T10:00:00.000Z')
    const resource = normalizeResourceInput({
      canonicalUri: 'https://example.com/brief',
      title: 'Brief'
    })
    const markup = renderToStaticMarkup(
      createElement(WorkspaceViewPage, {
        view,
        projects: [],
        tasks: [],
        onOpenTask: () => undefined,
        onUpdateView: () => undefined,
        resourcePageProps: {
          projects: [],
          noteTree: [],
          folderColors: {},
          resources: [resource],
          relations: [],
          onCreateResource: async () => undefined,
          onUpdateResource: async () => undefined,
          onSetResourceProjectLinks: async () => undefined,
          onRemoveResource: async () => undefined,
          onOpenResource: async () => undefined,
          onOpenNotebookResource: () => undefined
        }
      })
    )

    expect(markup).not.toContain('data-testid="workspace-view-identity"')
    expect(markup).toContain('data-testid="resources-table"')
    expect(markup).toContain('>Brief</span>')
  })
})
