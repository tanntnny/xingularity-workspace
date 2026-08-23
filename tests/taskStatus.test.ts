import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { TaskStatus } from '../src/shared/types'
import { TaskStatusIcon } from '../src/renderer/src/components/TaskStatusIcon'
import { getTaskStatus, TASK_STATUS_META } from '../src/renderer/src/lib/taskStatus'

const statuses: TaskStatus[] = [
  'pending',
  'backlog',
  'in-progress',
  'blocked',
  'canceled',
  'completed'
]

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
    expect(TASK_STATUS_META.blocked).toMatchObject({
      tone: 'warning',
      visual: 'blocked-cancel',
      iconColorToken: 'var(--status-chip-task-status-blocked-icon)'
    })
    expect(TASK_STATUS_META.canceled).toMatchObject({
      label: 'Canceled',
      tone: 'danger',
      visual: 'canceled-dashed-x',
      iconColorToken: 'var(--status-chip-task-status-canceled-icon)'
    })
  })

  it('preserves legacy completed fallback behavior', () => {
    expect(getTaskStatus(undefined, false)).toBe('pending')
    expect(getTaskStatus(undefined, true)).toBe('completed')
    expect(getTaskStatus('backlog', true)).toBe('backlog')
  })

  it('renders every status as a decorative SVG', () => {
    for (const status of statuses) {
      const markup = renderStatusIcon(status)

      expect(markup).toContain(`data-status="${status}"`)
      expect(markup).toContain('aria-hidden="true"')
      expect(markup).toContain('viewBox="0 0 24 24"')
      expect(markup).toContain('height="18"')
      expect(markup).toContain('width="18"')
      expect(markup).toContain('max-height:18px')
      expect(markup).toContain('max-width:18px')
      expect(markup).toContain('min-height:18px')
      expect(markup).toContain('min-width:18px')
      expect(markup).toContain(`color:var(--status-chip-task-status-${status}-icon)`)
    }
  })

  it('uses a distinct abstract pattern for each status', () => {
    const pending = renderStatusIcon('pending')
    expect(countTag(pending, 'circle')).toBe(0)
    expect(countTag(pending, 'path')).toBe(9)
    expect(pending).toContain('d="M8.56 3.69a9 9 0 0 0 -2.92 1.95"')
    expect(pending).toContain('d="M15.44 3.69a9 9 0 0 0 -3.44 -.69"')
    expect(pending).toContain('stroke-width="2"')

    const backlog = renderStatusIcon('backlog')
    expect(countTag(backlog, 'circle')).toBe(0)
    expect(countTag(backlog, 'path')).toBe(9)
    expect(backlog).toContain('tabler-icon-circle-dashed-minus')
    expect(backlog).toContain('d="M8.56 3.69a9 9 0 0 0 -2.92 1.95"')
    expect(backlog).toContain('d="M9 12h6"')
    expect(backlog).not.toContain('cx="12"')

    const inProgress = renderStatusIcon('in-progress')
    expect(countTag(inProgress, 'path')).toBe(5)
    expect(inProgress).toContain('tabler-icon-circle-half-2')
    expect(inProgress).toContain('d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"')
    expect(inProgress).toContain('d="M12 3v18"')
    expect(inProgress).toContain('d="M12 19l8.5 -8.5"')

    const blocked = renderStatusIcon('blocked')
    expect(countTag(blocked, 'path')).toBe(3)
    expect(blocked).toContain('d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"')
    expect(blocked).toContain('d="M18.364 5.636l-12.728 12.728"')

    const canceled = renderStatusIcon('canceled')
    expect(countTag(canceled, 'path')).toBe(11)
    expect(canceled).toContain('d="M8.56 3.69a9 9 0 0 0 -2.92 1.95"')
    expect(canceled).toContain('d="M20.31 8.56a9 9 0 0 0 -.69 -3.44"')
    expect(canceled).toContain('d="M14 14l-4 -4"')
    expect(canceled).toContain('d="M10 14l4 -4"')

    const completed = renderStatusIcon('completed')
    expect(countTag(completed, 'circle')).toBe(0)
    expect(countTag(completed, 'path')).toBe(2)
    expect(completed).toContain('tabler-icon-circle-check')
    expect(completed).toContain('d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"')
    expect(completed).toContain('d="M9 12l2 2l4 -4"')
  })

  it('uses the completed visual for the legacy completed fallback', () => {
    expect(renderStatusIcon(undefined, true)).toContain('data-status="completed"')
  })
})
