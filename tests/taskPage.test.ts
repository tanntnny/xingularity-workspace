import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CalendarTaskCard } from '../src/renderer/src/components/CalendarTaskCard'
import { TaskPropertiesPanel } from '../src/renderer/src/components/TaskPropertiesPanel'
import { TaskPage } from '../src/renderer/src/pages/TaskPage'

const task = {
  id: 'task-page-1',
  title: 'Prepare release',
  description: 'A private task description',
  tags: ['release'],
  completed: false,
  createdAt: '2026-08-12T00:00:00.000Z',
  priority: 'medium' as const,
  taskType: 'assignment' as const,
  reminders: []
}

const project = {
  id: 'project-1',
  name: 'Launch project',
  summary: 'Project summary',
  description: 'Project description',
  state: 'active' as const,
  updatedAt: '2026-08-12T00:00:00.000Z',
  icon: {
    set: 'tabler' as const,
    glyph: 'rocket',
    variant: 'filled' as const,
    color: '#0ea5e9'
  }
}

describe('task page composition', () => {
  it('keeps descriptions out of compact calendar task cards', () => {
    const markup = renderToStaticMarkup(createElement(CalendarTaskCard, { task }))

    expect(markup).toContain('Prepare release')
    expect(markup).not.toContain('A private task description')
  })

  it('renders the task properties using the shared project property-row layout', () => {
    const markup = renderToStaticMarkup(
      createElement(TaskPropertiesPanel, {
        task: { ...task, projectId: project.id },
        projects: [project],
        onUpdateTask: () => undefined
      })
    )

    expect(markup).toContain('data-testid="task-properties-panel"')
    expect(markup).toContain('data-testid="task-property-status"')
    expect(markup).toContain('data-testid="task-property-project"')
    expect(markup).toContain('data-testid="task-property-tags"')
    expect(markup).toContain('data-testid="task-property-reminders"')
    expect(markup).toContain('Launch project')
  })

  it('provides a full-page task surface with a description character contract', () => {
    const markup = renderToStaticMarkup(
      createElement(TaskPage, {
        task,
        onUpdateTask: () => undefined
      })
    )

    expect(markup).toContain('data-testid="task-page"')
    expect(markup).toContain('data-testid="note-block-editor"')
    expect(markup).toContain('Description saved')
  })
})
