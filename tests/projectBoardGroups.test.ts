import { describe, expect, it } from 'vitest'

import type { Project } from '../src/shared/types'
import { buildProjectBoardGroups } from '../src/renderer/src/lib/projectBoardGroups'

const baseProject: Project = {
  id: 'project-base',
  name: 'Base',
  summary: '',
  status: 'on-track',
  updatedAt: '2026-07-10T12:00:00.000Z',
  progress: 0,
  icon: {
    set: 'shape',
    glyph: 'circle',
    shape: 'circle',
    variant: 'filled',
    color: '#2563eb'
  },
  milestones: []
}

describe('project board groups', () => {
  it('builds fixed status groups and sorts projects by recent update first', () => {
    const groups = buildProjectBoardGroups(
      [
        createProject({
          id: 'project-blocked-old',
          name: 'Blocked Old',
          status: 'blocked',
          updatedAt: '2026-07-07T12:00:00.000Z'
        }),
        createProject({
          id: 'project-blocked-new',
          name: 'Blocked New',
          status: 'blocked',
          updatedAt: '2026-07-09T12:00:00.000Z'
        }),
        createProject({
          id: 'project-completed',
          name: 'Completed',
          status: 'completed',
          updatedAt: '2026-07-08T12:00:00.000Z'
        })
      ],
      'status'
    )

    expect(groups.map((group) => group.key)).toEqual([
      'on-track',
      'at-risk',
      'blocked',
      'completed'
    ])
    expect(groups[2]?.projects.map((project) => project.id)).toEqual([
      'project-blocked-new',
      'project-blocked-old'
    ])
    expect(groups[3]?.projects.map((project) => project.id)).toEqual(['project-completed'])
  })

  it('buckets projects into recent activity groups', () => {
    const today = new Date('2026-07-10T12:00:00.000Z')
    const groups = buildProjectBoardGroups(
      [
        createProject({
          id: 'project-older',
          name: 'Older',
          updatedAt: '2026-06-21T12:00:00.000Z'
        }),
        createProject({
          id: 'project-month',
          name: 'This Month',
          updatedAt: '2026-07-02T12:00:00.000Z'
        }),
        createProject({
          id: 'project-week',
          name: 'This Week',
          updatedAt: '2026-07-08T12:00:00.000Z'
        }),
        createProject({
          id: 'project-today',
          name: 'Today',
          updatedAt: '2026-07-10T08:00:00.000Z'
        })
      ],
      'updatedAt',
      today
    )

    expect(getGroupProjectIds(groups, 'today')).toEqual(['project-today'])
    expect(getGroupProjectIds(groups, 'this-week')).toEqual(['project-week'])
    expect(getGroupProjectIds(groups, 'this-month')).toEqual(['project-month'])
    expect(getGroupProjectIds(groups, 'older')).toEqual(['project-older'])
  })
})

function createProject(
  overrides: Partial<Project> & Pick<Project, 'id' | 'name'> & { updatedAt?: string }
): Project {
  return {
    ...baseProject,
    ...overrides,
    updatedAt: overrides.updatedAt ?? baseProject.updatedAt
  }
}

function getGroupProjectIds(
  groups: ReturnType<typeof buildProjectBoardGroups>,
  key: string
): string[] {
  return groups.find((group) => group.key === key)?.projects.map((project) => project.id) ?? []
}
