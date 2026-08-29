import { describe, expect, it } from 'vitest'
import {
  inferExternalProduct,
  inferProviderFromUri,
  migrateProjectResources,
  notebookPathFromResource,
  notebookResourceUri,
  normalizeResourceInput,
  normalizeResourceLabels,
  normalizeResourceRelation,
  resourceIdForCanonicalUri
} from '../src/shared/resourceDomain'

describe('resource domain', () => {
  it('normalizes provider-aware identities deterministically', () => {
    const first = normalizeResourceInput({ canonicalUri: '/tmp/brief.md', provider: 'filesystem' })
    const second = normalizeResourceInput({ canonicalUri: '/tmp/brief.md', provider: 'filesystem' })

    expect(first.id).toBe(resourceIdForCanonicalUri('filesystem', first.canonicalUri))
    expect(second.id).toBe(first.id)
    expect(first.kind).toBe('local-file')
    expect(first.sourceOfTruth).toBe('external')
  })

  it('normalizes labels into bounded, searchable key-value pairs', () => {
    const resource = normalizeResourceInput({
      canonicalUri: 'https://example.com/brief',
      labels: [
        { key: ' Status ', value: ' active ' },
        { key: 'status', value: 'active' },
        { key: 'owner.name', value: 'Amy' },
        { key: 'not valid', value: 'ignored' }
      ],
      projectIds: ['project-1', 'project-1']
    })

    expect(resource.labels).toEqual([
      { key: 'status', value: 'active' },
      { key: 'owner.name', value: 'Amy' }
    ])
    expect(resource.projectIds).toEqual(['project-1'])
    expect(normalizeResourceLabels(null)).toEqual([])
  })

  it('infers web and Drive providers without exposing credentials', () => {
    expect(inferProviderFromUri('https://docs.google.com/document/d/abc/edit')).toBe('google-drive')
    expect(inferProviderFromUri('https://example.com/brief')).toBe('web')
    const resource = normalizeResourceInput({
      canonicalUri: 'https://example.com/brief',
      metadata: { token: 'do-not-store', label: 'brief' }
    })
    expect(resource.metadata).toEqual({ label: 'brief' })
  })

  it('classifies external products and notebook folder resources', () => {
    expect(inferExternalProduct('https://docs.google.com/document/d/abc/edit')).toBe('google-docs')
    expect(inferExternalProduct('https://docs.google.com/spreadsheets/d/abc/edit')).toBe(
      'google-sheets'
    )
    expect(inferExternalProduct('https://www.canva.com/design/abc/view')).toBe('canva')

    const notebook = normalizeResourceInput({
      type: 'notebook',
      canonicalUri: notebookResourceUri('Projects/Atlas'),
      title: 'Atlas'
    })

    expect(notebook.type).toBe('notebook')
    expect(notebook.kind).toBe('notebook')
    expect(notebook.sourceOfTruth).toBe('xingularity')
    expect(notebookPathFromResource(notebook)).toBe('Projects/Atlas')
  })

  it('migrates legacy project resource strings into typed refs and relations', () => {
    const result = migrateProjectResources([
      {
        id: 'project-1',
        name: 'Atlas',
        summary: '',
        state: 'active',
        icon: { variant: 'filled', color: '#000000' },
        updatedAt: '2026-01-01T00:00:00.000Z',
        notebookPath: 'Projects/Atlas',
        resources: ['https://example.com/brief']
      } as never
    ])

    expect(result.migrated).toBe(2)
    expect(result.projects[0]).not.toHaveProperty('notebookPath')
    expect(result.projects[0]).not.toHaveProperty('resources')
    expect(result.projects[0].resourceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'notebook', kind: 'notebook' }),
        expect.objectContaining({ type: 'external', provider: 'web' })
      ])
    )
    expect(result.relations).toHaveLength(2)
    expect(result.relations[0].type).toBe('project_contains_resource')
  })

  it('normalizes relation ids and suggested confidence', () => {
    const relation = normalizeResourceRelation({
      type: 'resource_related_to_resource',
      fromId: 'a',
      toId: 'b',
      createdBy: 'agent',
      confidence: 'suggested'
    })

    expect(relation?.id).toContain('relation-')
    expect(relation?.confidence).toBe('suggested')
    expect(relation?.createdBy).toBe('agent')
  })
})
