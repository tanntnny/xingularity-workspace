import { describe, expect, it } from 'vitest'

import { buildProjectMarkdown } from '../src/main/projectMarkdownExport'
import type { FolderMarkdownNote } from '../src/main/noteMarkdownExport'
import type { CalendarTask, ProjectUpdate } from '../src/shared/types'

const task = (overrides: Partial<CalendarTask>): CalendarTask => ({
  id: 'task-default',
  title: 'Default task',
  projectId: 'project-1',
  tags: [],
  completed: false,
  status: 'pending',
  createdAt: '2026-08-20T00:00:00.000Z',
  priority: 'medium',
  reminders: [],
  ...overrides
})

const update = (overrides: Partial<ProjectUpdate>): ProjectUpdate => ({
  id: 'update-default',
  projectId: 'project-1',
  markdown: 'Default update',
  status: 'on-track',
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z',
  ...overrides
})

describe('buildProjectMarkdown', () => {
  it('builds a deterministic project context document from tasks, updates, and nested notes', () => {
    const notes: FolderMarkdownNote[] = [
      {
        relPath: 'Projects/Launch/nested/brief`draft.md',
        markdown: '---\ntags: [launch]\n---\n# Brief\n\nShip the launch.'
      },
      {
        relPath: 'Projects/Launch/readme.md',
        markdown: '# Readme\n\nProject context.'
      }
    ]

    const result = buildProjectMarkdown({
      project: {
        name: 'Launch',
        description: 'Ship the next launch.',
        summary: 'Fallback summary',
        updatedAt: '2026-08-21T09:00:00.000Z'
      },
      notebookPath: 'Projects/Launch',
      tasks: [
        task({
          id: 'task-zeta',
          title: 'Zeta task',
          milestoneId: 'milestone-beta',
          status: 'completed',
          priority: 'low',
          taskType: 'review',
          date: '2026-08-26',
          tags: ['review'],
          description: 'Review the result.'
        }),
        task({
          id: 'task-alpha',
          title: 'Alpha task',
          milestoneId: 'milestone-alpha',
          status: 'in-progress',
          priority: 'high',
          taskType: 'deep-work',
          date: '2026-08-25',
          time: '09:00',
          endTime: '10:00',
          tags: ['launch', 'planning'],
          description: 'Draft the brief.'
        })
      ],
      updates: [
        update({
          id: 'update-old',
          markdown: 'Older update',
          status: 'on-track',
          createdAt: '2026-08-20T09:00:00.000Z'
        }),
        update({
          id: 'update-new',
          markdown: 'Newest update',
          status: 'at-risk',
          createdAt: '2026-08-22T09:00:00.000Z'
        })
      ],
      notes,
      externalDocuments: [
        {
          title: 'Spec',
          canonicalUri: 'https://docs.google.com/document/d/spec/edit',
          modifiedAt: '2026-08-22T10:00:00.000Z',
          markdown: '# Spec\n\nDetails',
          truncated: true
        }
      ],
      exportedAt: '2026-08-22T12:00:00.000Z'
    })

    expect(result).toBe(
      [
        '# Launch',
        '',
        '- Exported: 2026-08-22T12:00:00.000Z',
        '- Last updated: 2026-08-21T09:00:00.000Z',
        '- Linked notebook: `Projects/Launch`',
        '',
        '## Description',
        '',
        'Ship the next launch.',
        '',
        '## Tasks',
        '',
        '### milestone-alpha',
        '',
        '- [ ] **Alpha task**',
        '  - Status: In progress',
        '  - Priority: High',
        '  - Type: Deep Work',
        '  - Schedule: 2026-08-25 09:00–10:00',
        '  - Tags: launch, planning',
        '  - Description: Draft the brief.',
        '',
        '### milestone-beta',
        '',
        '- [x] **Zeta task**',
        '  - Status: Completed',
        '  - Priority: Low',
        '  - Type: Review',
        '  - Schedule: 2026-08-26',
        '  - Tags: review',
        '  - Description: Review the result.',
        '',
        '## Updates',
        '',
        '### 2026-08-22T09:00:00.000Z · At risk',
        '',
        'Newest update',
        '',
        '### 2026-08-20T09:00:00.000Z · On track',
        '',
        'Older update',
        '',
        '## Linked Notes',
        '',
        '### Brief',
        '',
        'Source: `Projects/Launch/nested/brief\\`draft.md`',
        '',
        'Ship the launch.',
        '',
        '### Readme',
        '',
        'Source: `Projects/Launch/readme.md`',
        '',
        'Project context.',
        '',
        '## Linked Google Docs',
        '',
        '### Spec',
        '',
        'Source: [Open in Google Docs](https://docs.google.com/document/d/spec/edit)',
        'Modified: 2026-08-22T10:00:00.000Z',
        '',
        'Details',
        '',
        '_Content truncated by Xingularity._',
        ''
      ].join('\n')
    )
  })

  it('uses readable empty-state text and description fallbacks', () => {
    const result = buildProjectMarkdown({
      project: {
        name: 'Empty',
        description: '  ',
        summary: 'Summary fallback',
        updatedAt: '2026-08-21T09:00:00.000Z'
      },
      notebookPath: 'Projects/Empty',
      tasks: [],
      updates: [],
      notes: [],
      exportedAt: '2026-08-22T12:00:00.000Z'
    })

    expect(result).toContain('Summary fallback')
    expect(result).toContain('_No tasks found._')
    expect(result).toContain('_No updates found._')
    expect(result).toContain('_No linked notes found._')
    expect(result).toContain('_No linked Google Docs found._')
  })

  it('exports canceled tasks as done while preserving their status label', () => {
    const result = buildProjectMarkdown({
      project: {
        name: 'Canceled project',
        description: '',
        summary: 'Summary',
        updatedAt: '2026-08-21T09:00:00.000Z'
      },
      notebookPath: 'Projects/Canceled',
      tasks: [
        task({
          title: 'Canceled task',
          status: 'canceled',
          completed: false
        })
      ],
      updates: [],
      notes: [],
      exportedAt: '2026-08-22T12:00:00.000Z'
    })

    expect(result).toContain('- [x] **Canceled task**')
    expect(result).toContain('  - Status: Canceled')
  })
})
