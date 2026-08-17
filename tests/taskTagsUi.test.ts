import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CalendarTaskCard } from '../src/renderer/src/components/CalendarTaskCard'
import { CalendarTaskFilter } from '../src/renderer/src/components/CalendarTaskFilter'
import { TagEditor } from '../src/renderer/src/components/TagEditor'
import { TaskTagSummary } from '../src/renderer/src/components/TaskTagSummary'

const task = {
  id: 'task-1',
  title: 'Prepare release',
  tags: ['release', 'project:alpha'],
  completed: false,
  createdAt: '2026-08-12T00:00:00.000Z',
  priority: 'medium' as const,
  reminders: []
}

describe('task tag UI', () => {
  it('renders the editable tag control with the current task tags', () => {
    const markup = renderToStaticMarkup(
      createElement(TagEditor, {
        value: task.tags,
        onChange: () => undefined,
        label: 'Task tags',
        testId: 'task-tags-editor'
      })
    )

    expect(markup).toContain('task-tags-editor')
    expect(markup).toContain('release')
    expect(markup).toContain('project:alpha')
    expect(markup).toContain('aria-label="Add tag"')
  })

  it('shows a compact tag summary on calendar cards and full tags in detail summaries', () => {
    const cardMarkup = renderToStaticMarkup(createElement(CalendarTaskCard, { task }))
    const fullSummaryMarkup = renderToStaticMarkup(
      createElement(TaskTagSummary, { tags: task.tags, mode: 'full' })
    )

    expect(cardMarkup).toContain('release')
    expect(cardMarkup).toContain('+1')
    expect(fullSummaryMarkup).toContain('project:alpha')
  })

  it('places the project before tags and moves priority and reminders to the tag row', () => {
    const cardMarkup = renderToStaticMarkup(
      createElement(CalendarTaskCard, {
        task: {
          ...task,
          endDate: '2026-08-20',
          reminders: [{ id: 'reminder-1', type: 'minutes', value: 30, enabled: true }]
        },
        project: {
          name: 'Launch project',
          icon: {
            set: 'tabler',
            glyph: 'rocket',
            variant: 'filled',
            color: '#0ea5e9'
          }
        }
      })
    )

    expect(cardMarkup.indexOf('calendar-task-project')).toBeLessThan(
      cardMarkup.indexOf('task-tags-summary')
    )
    expect(cardMarkup.indexOf('aria-label="Medium priority"')).toBeLessThan(
      cardMarkup.indexOf('task-tags-summary')
    )
    expect(cardMarkup.indexOf('aria-label="Reminder enabled"')).toBeLessThan(
      cardMarkup.indexOf('task-tags-summary')
    )
    expect(cardMarkup).toContain('aria-label="Medium priority"')
    expect(cardMarkup).toContain('aria-label="Reminder enabled"')
    expect(cardMarkup).not.toContain('calendar-task-deadline-marker')
  })

  it('announces active calendar filters on the general filter trigger', () => {
    const markup = renderToStaticMarkup(
      createElement(CalendarTaskFilter, {
        tagOptions: [{ value: 'release', count: 1 }],
        contentFilterOptions: [
          { value: 'all', label: 'All', count: 2 },
          { value: 'projectTasks', label: 'Project Tasks', count: 1 },
          { value: 'nonProjectTasks', label: 'Non-project Tasks', count: 1 }
        ],
        contentFilter: 'projectTasks',
        onContentFilterChange: () => undefined,
        selectedTags: ['release'],
        onSelectedTagsChange: () => undefined
      })
    )

    expect(markup).toContain('calendar-task-filter-trigger')
    expect(markup).toContain('Filter (2)')
    expect(markup).toContain('Filter calendar tasks, 2 active')
  })
})
