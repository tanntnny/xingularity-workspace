import { describe, expect, it } from 'vitest'
import { normalizeResourceInput, notebookResourceUri } from '../src/shared/resourceDomain'
import type { Project } from '../src/shared/types'
import { getProjectResourceRows } from '../src/renderer/src/lib/projectResources'

const project = {
  id: 'project-1',
  name: 'Atlas',
  summary: '',
  state: 'active',
  updatedAt: '2026-08-22T00:00:00.000Z',
  icon: { variant: 'filled', color: '#000000' }
} as Project

describe('project resource helpers', () => {
  it('returns no rows when a project has no persisted resources', () => {
    expect(getProjectResourceRows(project, [], [])).toEqual([])
  })

  it('preserves multiple notebook resources in project order', () => {
    const firstNotebook = normalizeResourceInput(
      {
        type: 'notebook',
        canonicalUri: notebookResourceUri('Projects/Research'),
        projectId: project.id
      },
      '2026-08-22T00:00:00.000Z'
    )
    const secondNotebook = normalizeResourceInput(
      {
        type: 'notebook',
        canonicalUri: notebookResourceUri('Projects/Archive'),
        projectId: project.id
      },
      '2026-08-22T00:00:00.000Z'
    )

    const rows = getProjectResourceRows(
      { ...project, resourceRefs: [firstNotebook, secondNotebook] },
      [firstNotebook, secondNotebook],
      []
    )

    expect(rows).toHaveLength(2)
    expect(rows.map(({ resource }) => resource.id)).toEqual([firstNotebook.id, secondNotebook.id])
  })

  it('merges relation resources without duplicating project references', () => {
    const notebook = normalizeResourceInput(
      {
        type: 'notebook',
        canonicalUri: notebookResourceUri('Projects/Research'),
        projectId: project.id
      },
      '2026-08-22T00:00:00.000Z'
    )

    const rows = getProjectResourceRows(
      { ...project, resourceRefs: [notebook] },
      [notebook],
      [
        {
          id: 'relation-1',
          type: 'project_contains_resource',
          fromId: project.id,
          fromKind: 'project',
          toId: notebook.id,
          toKind: 'resource',
          createdAt: '2026-08-22T00:00:00.000Z',
          createdBy: 'user',
          confidence: 'confirmed'
        }
      ]
    )

    expect(rows).toEqual([{ resource: notebook }])
  })
})
