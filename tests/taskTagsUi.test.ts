import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CalendarTaskCard } from '../src/renderer/src/components/CalendarTaskCard'
import { CalendarTaskFilter } from '../src/renderer/src/components/CalendarTaskFilter'
import { TagChip } from '../src/renderer/src/components/TagChip'
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
  it('uses the outline tag icon before the tag label', () => {
    const markup = renderToStaticMarkup(createElement(TagChip, { tag: 'course-test-longer' }))

    expect(markup).toContain('stroke-width="2"')
    expect(markup).toContain(
      'd="M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592 -5.592a2.41 2.41 0 0 0 0 -3.408l-7.71 -7.71a2 2 0 0 0 -1.414 -.586h-5.172a3 3 0 0 0 -3 3"'
    )
    expect(markup).toContain('course-test-longer')
    expect(markup).toContain('truncate')
    expect(markup).toContain('rounded-[var(--radius-control)]')
    expect(markup).not.toContain('workspace-text-fade')
    expect(markup).not.toContain('status-chip-label-fade')
    expect(markup).not.toContain('whitespace-normal')
  })

  it('keeps fading opt-in for popover tag options', () => {
    const markup = renderToStaticMarkup(
      createElement(TagChip, {
        tag: 'course-test-longer',
        labelOverflow: 'fade'
      })
    )

    expect(markup).toContain('status-chip-label-fade')
  })

  it('renders a static Tags trigger for the editable tag control', () => {
    const markup = renderToStaticMarkup(
      createElement(TagEditor, {
        value: task.tags,
        onChange: () => undefined,
        label: 'Task tags',
        testId: 'task-tags-editor'
      })
    )

    expect(markup).toContain('task-tags-editor')
    expect(markup).toContain('task-tags-editor-trigger')
    expect(markup).toContain('Tags')
    expect(markup).toContain('aria-label="Task tags selection"')
    expect(markup).toContain('aria-haspopup="dialog"')
    expect(markup).toContain('border border-border')
    expect(markup).toContain('bg-surface-subtle')
    expect(markup).toContain('hover:bg-surface-subtle-hover')
    expect(markup).toContain('focus-visible:bg-surface-subtle-hover')
    expect(markup).toContain(
      'd="M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592 -5.592a2.41 2.41 0 0 0 0 -3.408l-7.71 -7.71a2 2 0 0 0 -1.414 -.586h-5.172a3 3 0 0 0 -3 3"'
    )
    expect(markup).not.toContain('release')
    expect(markup).not.toContain('project:alpha')
    expect(markup).not.toContain('aria-label="Add tag"')
    expect(markup).not.toContain('placeholder="tag name"')
  })

  it('keeps the Tags trigger visible when no tags are selected', () => {
    const markup = renderToStaticMarkup(
      createElement(TagEditor, {
        value: [],
        onChange: () => undefined,
        label: 'Task tags',
        testId: 'empty-task-tags-editor'
      })
    )

    expect(markup).toContain('empty-task-tags-editor-trigger')
    expect(markup).toContain('Tags')
    expect(markup).toContain('aria-haspopup="dialog"')
  })

  it('supports the shared pill surface for tag triggers', () => {
    const markup = renderToStaticMarkup(
      createElement(TagEditor, {
        value: [],
        onChange: () => undefined,
        label: 'Task tags',
        surface: 'pill'
      })
    )

    expect(markup).toContain('border border-border')
    expect(markup).toContain('rounded-[var(--radius-button-pill)]')
    expect(markup).toContain('bg-surface-subtle')
    expect(markup).toContain('hover:bg-surface-subtle-hover')
    expect(markup).toContain('focus-visible:bg-surface-subtle-hover')
  })

  it('keeps the static trigger compact for long selected tags', () => {
    const markup = renderToStaticMarkup(
      createElement(TagEditor, {
        value: ['a-very-long-project-property-tag'],
        onChange: () => undefined,
        label: 'Task tags'
      })
    )

    expect(markup).toContain('Tags')
    expect(markup).toContain('aria-label="Task tags selection"')
    expect(markup).not.toContain('whitespace-normal')
  })

  it('removes tag metadata from calendar cards while keeping full detail summaries', () => {
    const cardMarkup = renderToStaticMarkup(createElement(CalendarTaskCard, { task }))
    const fullSummaryMarkup = renderToStaticMarkup(
      createElement(TaskTagSummary, { tags: task.tags, mode: 'full' })
    )

    expect(cardMarkup).not.toContain('task-tags-summary')
    expect(cardMarkup).not.toContain('project:alpha')
    expect(cardMarkup).toContain('group-hover/status-chip:text-foreground')
    expect(fullSummaryMarkup).toContain('project:alpha')
  })

  it('keeps project metadata while removing the card metadata row', () => {
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

    expect(cardMarkup).toContain('calendar-task-project')
    expect(cardMarkup).not.toContain('task-tags-summary')
    expect(cardMarkup).not.toContain('aria-label="Medium priority"')
    expect(cardMarkup).not.toContain('aria-label="Reminder enabled"')
    expect(cardMarkup).toContain('overflow-hidden text-sm text-muted-foreground')
    expect(cardMarkup).toContain('data-project-icon-surface="none"')
    expect(cardMarkup).toContain('width:18px')
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
    expect(markup).toContain('aria-label="2 selected"')
    expect(markup).toContain('bg-selection-counter')
    expect(markup).not.toContain('Filter (2)')
    expect(markup).toContain('Filter calendar tasks, 2 active')
  })
})
