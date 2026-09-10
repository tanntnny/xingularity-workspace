import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ProjectMeeting } from '../src/shared/types'
import { ProjectMeetingFeed } from '../src/renderer/src/components/ProjectMeetingFeed'

const meetings: ProjectMeeting[] = [
  {
    id: 'meeting-old',
    projectId: 'project-1',
    markdown: 'Older meeting note',
    type: 'stand-up',
    outcome: 'informational',
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z'
  },
  {
    id: 'meeting-new',
    projectId: 'project-1',
    markdown: 'Newer meeting note',
    type: 'planning',
    outcome: 'follow-up-needed',
    createdAt: '2026-08-20T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z'
  }
]

describe('Project meeting feed', () => {
  it('renders meetings newest first with type and outcome metadata', () => {
    const markup = renderToStaticMarkup(
      createElement(ProjectMeetingFeed, {
        meetings,
        notes: [],
        vimModeEnabled: false,
        vimKeyMappings: [],
        onOpenNoteLink: () => undefined,
        onEdit: () => undefined,
        onDelete: async () => undefined,
        onCreateFollowUpTask: () => undefined
      })
    )

    expect(markup).toContain('data-testid="project-meeting-feed"')
    expect(markup).toContain('data-testid="project-meeting-card:meeting-new"')
    expect(markup).toContain('data-testid="project-meeting-card:meeting-old"')
    expect(markup.indexOf('project-meeting-card:meeting-new')).toBeLessThan(
      markup.indexOf('project-meeting-card:meeting-old')
    )
    expect(markup).toContain('>Planning</span>')
    expect(markup).toContain('>Follow-up needed</span>')
    expect(markup).toContain('data-testid="project-meeting-menu:meeting-new"')
  })

  it('renders an empty state when no meetings exist', () => {
    const markup = renderToStaticMarkup(
      createElement(ProjectMeetingFeed, {
        meetings: [],
        notes: [],
        vimModeEnabled: false,
        vimKeyMappings: [],
        onOpenNoteLink: () => undefined,
        onEdit: () => undefined,
        onDelete: async () => undefined
      })
    )

    expect(markup).toContain('data-testid="project-meeting-empty"')
    expect(markup).toContain('>No meetings yet</h2>')
  })
})
