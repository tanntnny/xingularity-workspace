import { type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { getMilestoneChipOptions } from '../src/renderer/src/lib/statusChipMeta'
import type { CalendarTask, Project } from '../src/shared/types'

const project: Project = {
  id: 'project-1',
  name: 'Alpha Project',
  description: '',
  summary: '',
  state: 'active',
  updatedAt: '2026-08-20T00:00:00.000Z',
  icon: { variant: 'filled', color: '#2563eb' },
  milestones: [
    {
      id: 'milestone-complete',
      title: 'Completed setup',
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-20T00:00:00.000Z'
    },
    {
      id: 'milestone-current',
      title: 'Current launch',
      createdAt: '2026-08-21T00:00:00.000Z',
      updatedAt: '2026-08-21T00:00:00.000Z'
    },
    {
      id: 'milestone-unreached',
      title: 'Later launch',
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z'
    }
  ]
}

const tasks: CalendarTask[] = [
  {
    id: 'task-complete',
    title: 'Finish setup',
    projectId: project.id,
    milestoneId: 'milestone-complete',
    tags: [],
    completed: true,
    status: 'completed',
    createdAt: '2026-08-20T00:00:00.000Z',
    priority: 'medium',
    reminders: []
  },
  {
    id: 'task-current',
    title: 'Prepare launch',
    projectId: project.id,
    milestoneId: 'milestone-current',
    tags: [],
    completed: false,
    status: 'pending',
    createdAt: '2026-08-21T00:00:00.000Z',
    priority: 'medium',
    reminders: []
  }
]

function renderOptionIcon(
  options: ReturnType<typeof getMilestoneChipOptions>,
  value: string
): string {
  const option = options.find((item) => item.value === value)
  return option?.icon ? renderToStaticMarkup(option.icon as ReactElement) : ''
}

describe('milestone status chip metadata', () => {
  it('matches Project Home icon shape, status class, and color token', () => {
    const options = getMilestoneChipOptions(project, tasks)

    expect(options.map((option) => option.value)).toEqual([
      '__none__',
      'milestone-complete',
      'milestone-current',
      'milestone-unreached'
    ])

    const noMilestone = options[0]
    expect(noMilestone).toMatchObject({
      iconColorToken: 'var(--milestone-unreached-icon)',
      mutedTrigger: true
    })
    expect(renderOptionIcon(options, '__none__')).toContain(
      'tabler-icon-diamonds shrink-0 text-milestone-unreached'
    )

    expect(options[1]?.iconColorToken).toBe('var(--milestone-complete-icon)')
    expect(renderOptionIcon(options, 'milestone-complete')).toContain(
      'tabler-icon-diamonds-filled shrink-0 text-milestone-complete'
    )

    expect(options[2]?.iconColorToken).toBe('var(--milestone-current-icon)')
    expect(renderOptionIcon(options, 'milestone-current')).toContain(
      'tabler-icon-diamonds shrink-0 text-milestone-current'
    )

    expect(options[3]?.iconColorToken).toBe('var(--milestone-unreached-icon)')
    expect(renderOptionIcon(options, 'milestone-unreached')).toContain(
      'tabler-icon-diamonds shrink-0 text-milestone-unreached'
    )
  })
})
