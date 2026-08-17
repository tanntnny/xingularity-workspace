import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { TaskStatus } from '../src/shared/types'
import { TaskStatusIcon } from '../src/renderer/src/components/TaskStatusIcon'
import { getTaskStatus, TASK_STATUS_META } from '../src/renderer/src/lib/taskStatus'

const statuses: TaskStatus[] = ['pending', 'backlog', 'in-progress', 'blocked', 'completed']

function renderStatusIcon(status?: TaskStatus, completed?: boolean): string {
  return renderToStaticMarkup(createElement(TaskStatusIcon, { status, completed }))
}

function countTag(markup: string, tag: string): number {
  return markup.split(`<${tag}`).length - 1
}

describe('task status metadata', () => {
  it('defines visual metadata for every task status', () => {
    expect(Object.keys(TASK_STATUS_META)).toEqual(statuses)
    expect(TASK_STATUS_META.backlog.label).toBe('Backlog')
    expect(TASK_STATUS_META.backlog.tone).toBe('warning')
  })

  it('preserves legacy completed fallback behavior', () => {
    expect(getTaskStatus(undefined, false)).toBe('pending')
    expect(getTaskStatus(undefined, true)).toBe('completed')
    expect(getTaskStatus('backlog', true)).toBe('backlog')
  })

  it('renders every status as a decorative circular SVG', () => {
    for (const status of statuses) {
      const markup = renderStatusIcon(status)

      expect(markup).toContain(`data-status="${status}"`)
      expect(markup).toContain('aria-hidden="true"')
      expect(markup).toContain('fill="none"')
      expect(markup).toContain('stroke="currentColor"')
      expect(markup).toContain('viewBox="0 0 24 24"')
      expect(markup).toContain('height="18"')
      expect(markup).toContain('width="18"')
    }
  })

  it('uses a distinct abstract pattern for each status', () => {
    const pending = renderStatusIcon('pending')
    expect(countTag(pending, 'circle')).toBe(1)
    expect(pending).toContain('stroke-dasharray="1.35 2.25"')

    const backlog = renderStatusIcon('backlog')
    expect(countTag(backlog, 'circle')).toBe(1)
    expect(backlog).not.toContain('stroke-dasharray')

    const inProgress = renderStatusIcon('in-progress')
    expect(countTag(inProgress, 'circle')).toBe(1)
    expect(countTag(inProgress, 'path')).toBe(1)
    expect(countTag(inProgress, 'line')).toBe(1)

    const blocked = renderStatusIcon('blocked')
    expect(countTag(blocked, 'circle')).toBe(1)
    expect(countTag(blocked, 'path')).toBe(1)

    const completed = renderStatusIcon('completed')
    expect(countTag(completed, 'circle')).toBe(1)
    expect(countTag(completed, 'path')).toBe(1)
  })

  it('uses the completed visual for the legacy completed fallback', () => {
    expect(renderStatusIcon(undefined, true)).toContain('data-status="completed"')
  })
})
