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

  it('splits calendar card metadata evenly and clips long title and status values', () => {
    const longTitle = 'A very long task title that clips inside the calendar card'
    const longProjectName = 'A very long project name that fades inside the calendar card'
    const markup = renderToStaticMarkup(
      createElement(CalendarTaskCard, {
        task: { ...task, title: longTitle, time: '09:00', endTime: '17:00' },
        project: { ...project, name: longProjectName }
      })
    )

    expect(markup).toContain('grid-cols-2')
    expect(markup).toContain('data-calendar-task-field="status"')
    expect(markup).toContain('data-calendar-task-field="time"')
    expect(markup).toContain('data-calendar-task-field="title"')
    expect(markup).toContain('data-calendar-task-field="project"')
    expect(markup).toContain('workspace-text-clip')
    expect(markup).toContain('workspace-text-fade')
    expect(markup).toContain(`title="${longTitle}"`)
    expect(markup).toContain(`title="${longProjectName}"`)
    expect(markup).toContain('title="09:00 - 17:00"')
    expect(markup).not.toContain('truncate')
  })

  it('uses a single metadata column when a card hides its time', () => {
    const markup = renderToStaticMarkup(createElement(CalendarTaskCard, { task, showTime: false }))

    expect(markup).toContain('grid-cols-1')
    expect(markup).not.toContain('grid-cols-2')
    expect(markup).not.toContain('data-calendar-task-field="time"')
  })

  it('can keep completed weekly task and project labels readable', () => {
    const markup = renderToStaticMarkup(
      createElement(CalendarTaskCard, {
        task: { ...task, completed: true },
        project,
        strikeCompleted: false
      })
    )

    expect(markup).toContain('Launch project')
    expect(markup).not.toContain('line-through')
  })

  it('renders calendar task property chips with muted bare styling', () => {
    const markup = renderToStaticMarkup(
      createElement(CalendarTaskCard, { task: { ...task, tags: [] } })
    )

    expect(markup).toContain('group/status-chip')
    expect(markup).toContain('text-muted-foreground')
    expect(markup).toContain('hover:bg-transparent')
    expect(markup).not.toContain('ui-control')
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
    expect(markup).toContain('aria-label="Task project for Prepare release: Launch project"')
    expect(markup).toContain('aria-haspopup="dialog"')
  })

  it('provides a full-page task surface with a description character contract', () => {
    const markup = renderToStaticMarkup(
      createElement(TaskPage, {
        task,
        onUpdateTask: () => undefined,
        vimModeEnabled: true,
        vimKeyMappings: []
      })
    )

    expect(markup).toContain('data-testid="task-page"')
    expect(markup).toContain('data-testid="note-block-editor"')
    expect(markup).toContain('data-vim-mode="insert"')
    expect(markup).toContain('Description saved')
  })
})
