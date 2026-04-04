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
  it('builds protected project paths from project names', () => {
    expect(getProjectsRootPath()).toBe('Projects')
    expect(getProjectFolderPath(project)).toBe('Projects/Alpha Project')
    expect(isDirectProjectFolderPath('Projects/Alpha Project')).toBe(true)
    expect(isDirectProjectFolderPath('Projects/Alpha Project/docs')).toBe(false)
  })

  it('resolves protected paths and project tags from note locations', () => {
    expect(isProtectedProjectTreePath('Projects', [project])).toBe(true)
    expect(isProtectedProjectTreePath('Projects/Alpha Project', [project])).toBe(true)
    expect(isProtectedProjectTreePath('Projects/Alpha Project/docs', [project])).toBe(false)
    expect(getProjectProtectionKind('Projects', [project])).toBe('projects-root')
    expect(getProjectProtectionKind('Projects/Alpha Project', [project])).toBe('project-folder')
    expect(resolveProjectByFolderPath('Projects/Alpha Project/specs/plan.xnote', [project])?.id).toBe(
      project.id
    )
    expect(getProjectTagForPath('Projects/Alpha Project/specs/plan.xnote', [project])).toBe(
      'project:alpha-project'
    )
  })
})
