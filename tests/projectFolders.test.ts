import { describe, expect, it } from 'vitest'
import type { Project } from '../src/shared/types'
import {
  getProjectFolderPath,
  getProjectProtectionKind,
  getProjectTagForPath,
  getProjectsRootPath,
  isDirectProjectFolderPath,
  isProtectedProjectTreePath,
  resolveProjectByFolderPath
} from '../src/shared/projectFolders'

const project: Project = {
  id: 'project-1',
  name: 'Alpha Project',
  summary: '',
  status: 'on-track',
  updatedAt: '2026-04-02T00:00:00.000Z',
  progress: 0,
  milestones: [],
  icon: {
    shape: 'circle',
    variant: 'filled',
    color: '#000000'
  }
}

describe('project folder helpers', () => {
  it('builds legacy project paths from project names', () => {
    expect(getProjectsRootPath()).toBe('Projects')
    expect(getProjectFolderPath(project)).toBe('Projects/Alpha Project')
    expect(isDirectProjectFolderPath('Projects/Alpha Project')).toBe(true)
    expect(isDirectProjectFolderPath('Projects/Alpha Project/docs')).toBe(false)
  })

  it('does not protect or tag project paths from note locations', () => {
    expect(isProtectedProjectTreePath('Projects', [project])).toBe(false)
    expect(isProtectedProjectTreePath('Projects/Alpha Project', [project])).toBe(false)
    expect(isProtectedProjectTreePath('Projects/Alpha Project/docs', [project])).toBe(false)
    expect(getProjectProtectionKind('Projects', [project])).toBeNull()
    expect(getProjectProtectionKind('Projects/Alpha Project', [project])).toBeNull()
    expect(resolveProjectByFolderPath('Projects/Alpha Project/specs/plan.md', [project])?.id).toBe(
      project.id
    )
    expect(getProjectTagForPath('Projects/Alpha Project/specs/plan.md', [project])).toBeNull()
  })

  it('does not reserve Projects when there are no managed projects', () => {
    expect(isProtectedProjectTreePath('Projects', [])).toBe(false)
    expect(getProjectProtectionKind('Projects', [])).toBeNull()
  })
})
