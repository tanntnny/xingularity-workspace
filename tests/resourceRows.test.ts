import { describe, expect, it } from 'vitest'
import type { Project, ResourceRelation } from '../src/shared/types'
import { normalizeResourceInput } from '../src/shared/resourceDomain'
import {
  filterResourceRows,
  getResourceFilterOptions,
  getResourceLabelFilterOptions,
  getResourcePageRows,
  UNASSIGNED_RESOURCE_PROJECT_FILTER
} from '../src/renderer/src/lib/resourceRows'

const project = (id: string, name: string): Project => ({
  id,
  name,
  description: '',
  summary: '',
  state: 'active',
  updatedAt: '2026-08-20T00:00:00.000Z',
  icon: { variant: 'filled', color: '#2563eb' },
  milestones: []
})

const relation = (projectId: string, resourceId: string): ResourceRelation => ({
  id: `relation-${projectId}-${resourceId}`,
  type: 'project_contains_resource',
  fromId: projectId,
  fromKind: 'project',
  toId: resourceId,
  toKind: 'resource',
  createdAt: '2026-08-20T00:00:00.000Z',
  createdBy: 'user',
  confidence: 'confirmed'
})

describe('resource page rows', () => {
  it('resolves project links from resource refs, relations, and project refs', () => {
    const atlas = project('project-atlas', 'Atlas')
    const launch = project('project-launch', 'Launch')
    const linked = normalizeResourceInput(
      {
        canonicalUri: 'https://example.com/linked',
        title: 'Linked',
        projectIds: [atlas.id]
      },
      '2026-08-20T00:00:00.000Z'
    )
    const related = normalizeResourceInput(
      {
        canonicalUri: 'https://example.com/related',
        title: 'Related'
      },
      '2026-08-19T00:00:00.000Z'
    )
    const refLinked = normalizeResourceInput(
      {
        canonicalUri: 'https://example.com/ref',
        title: 'Ref linked'
      },
      '2026-08-18T00:00:00.000Z'
    )

    const rows = getResourcePageRows(
      [related, linked, refLinked],
      [atlas, { ...launch, resourceRefs: [refLinked] }],
      [relation(launch.id, related.id)]
    )

    expect(rows.map((row) => row.resource.title)).toEqual(['Linked', 'Related', 'Ref linked'])
    expect(rows.find((row) => row.resource.id === linked.id)?.projectNames).toEqual(['Atlas'])
    expect(rows.find((row) => row.resource.id === related.id)?.projectNames).toEqual(['Launch'])
    expect(rows.find((row) => row.resource.id === refLinked.id)?.projectNames).toEqual(['Launch'])
  })

  it('filters by full-text labels, grouped label values, and project assignment', () => {
    const atlas = project('project-atlas', 'Atlas')
    const active = normalizeResourceInput(
      {
        canonicalUri: 'https://example.com/active',
        title: 'Active brief',
        labels: [
          { key: 'status', value: 'active' },
          { key: 'owner', value: 'amy' }
        ]
      },
      '2026-08-20T00:00:00.000Z'
    )
    const archived = normalizeResourceInput(
      {
        canonicalUri: 'https://example.com/archived',
        title: 'Archived brief',
        labels: [{ key: 'status', value: 'archived' }]
      },
      '2026-08-19T00:00:00.000Z'
    )
    const rows = getResourcePageRows([active, archived], [atlas], [relation(atlas.id, active.id)])

    expect(filterResourceRows(rows, { searchQuery: 'owner=amy' })).toHaveLength(1)
    expect(
      filterResourceRows(rows, { labelFilters: { status: ['active', 'archived'] } })
    ).toHaveLength(2)
    expect(
      filterResourceRows(rows, { labelFilters: { status: ['active'], owner: ['amy'] } })
    ).toEqual([expect.objectContaining({ resource: expect.objectContaining({ id: active.id }) })])
    expect(
      filterResourceRows(rows, { projectIds: [UNASSIGNED_RESOURCE_PROJECT_FILTER] }).map(
        (row) => row.resource.id
      )
    ).toEqual([archived.id])
  })

  it('filters by type, provider, state, and multiple project assignments', () => {
    const atlas = project('project-atlas', 'Atlas')
    const local = {
      ...normalizeResourceInput({
        canonicalUri: 'file:///tmp/brief.pdf',
        provider: 'filesystem',
        title: 'Local brief',
        projectIds: [atlas.id]
      }),
      state: 'offline' as const
    }
    const notebook = normalizeResourceInput({
      type: 'notebook',
      canonicalUri: 'Planning',
      title: 'Planning notebook'
    })
    const rows = getResourcePageRows([local, notebook], [atlas], [])

    expect(filterResourceRows(rows, { types: ['notebook'] })).toEqual([
      expect.objectContaining({ resource: expect.objectContaining({ id: notebook.id }) })
    ])
    expect(filterResourceRows(rows, { providers: ['filesystem'] })).toEqual([
      expect.objectContaining({ resource: expect.objectContaining({ id: local.id }) })
    ])
    expect(filterResourceRows(rows, { states: ['offline'] })).toEqual([
      expect.objectContaining({ resource: expect.objectContaining({ id: local.id }) })
    ])
    expect(
      filterResourceRows(rows, { projectIds: [atlas.id, UNASSIGNED_RESOURCE_PROJECT_FILTER] })
    ).toHaveLength(2)
  })

  it('builds stable label filter options', () => {
    const rows = getResourcePageRows(
      [
        normalizeResourceInput({
          canonicalUri: 'https://example.com/a',
          labels: [
            { key: 'status', value: 'z' },
            { key: 'status', value: 'a' },
            { key: 'owner', value: 'amy' }
          ]
        })
      ],
      [],
      []
    )

    expect(getResourceLabelFilterOptions(rows)).toEqual({
      owner: ['amy'],
      status: ['a', 'z']
    })
  })

  it('builds data-backed filter options with readable labels', () => {
    const atlas = project('project-atlas', 'Atlas')
    const local = {
      ...normalizeResourceInput({
        canonicalUri: 'file:///tmp/brief.pdf',
        provider: 'filesystem',
        title: 'Local brief',
        labels: [{ key: 'owner', value: 'amy' }],
        projectIds: [atlas.id]
      }),
      state: 'offline' as const
    }
    const unassigned = normalizeResourceInput({
      canonicalUri: 'https://example.com/unassigned',
      labels: [{ key: 'owner', value: 'zoe' }]
    })
    const rows = getResourcePageRows([local, unassigned], [atlas], [])

    expect(getResourceFilterOptions(rows, [atlas])).toEqual({
      types: [{ value: 'external', label: 'External' }],
      providers: [
        { value: 'filesystem', label: 'Filesystem' },
        { value: 'web', label: 'Web' }
      ],
      states: [
        { value: 'offline', label: 'Offline' },
        { value: 'unindexed', label: 'Unindexed' }
      ],
      projects: [
        { value: atlas.id, label: 'Atlas' },
        { value: UNASSIGNED_RESOURCE_PROJECT_FILTER, label: 'Unassigned' }
      ],
      labels: {
        owner: [
          { value: 'amy', label: 'amy' },
          { value: 'zoe', label: 'zoe' }
        ]
      }
    })
  })
})
