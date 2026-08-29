import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ProjectUpdate } from '../src/shared/types'
import { ProjectUpdateFeed } from '../src/renderer/src/components/ProjectUpdateFeed'

const updates: ProjectUpdate[] = [
  {
    id: 'update-old',
    projectId: 'project-1',
    markdown: 'Older update',
    status: 'on-track',
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z'
  },
  {
    id: 'update-new',
    projectId: 'project-1',
    markdown: 'Newer update',
    status: 'at-risk',
    createdAt: '2026-08-20T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z'
  }
]

describe('Project update feed', () => {
  it('renders each posted update in its own card container', () => {
    const markup = renderToStaticMarkup(
      createElement(ProjectUpdateFeed, {
        updates,
        notes: [],
        vimModeEnabled: false,
        vimKeyMappings: [],
        onOpenNoteLink: () => undefined,
        onEdit: () => undefined,
        onDelete: async () => undefined
      })
    )

    expect(markup).toContain('data-testid="project-update-feed"')
    expect(markup).toContain('class="space-y-3"')
    expect(markup).toContain('data-testid="project-update-card:update-new"')
    expect(markup).toContain('data-testid="project-update-card:update-old"')
    expect(markup).toContain('data-testid="project-update-feed-item:update-new"')
    expect(markup).toContain('data-testid="project-update-feed-item:update-old"')
    expect(markup).toContain('data-testid="project-update-menu:update-new"')
    expect(markup).not.toContain('divide-y')
  })
})
