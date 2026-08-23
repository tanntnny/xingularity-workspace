import { describe, expect, it } from 'vitest'
import {
  RecentSearchStore,
  UnifiedSearchIndex,
  rankSearchDocuments
} from '../src/main/unifiedSearch'
import {
  createSearchDocument,
  createSearchDocumentFromEntity,
  toSafeSearchMetadata,
  type SearchDocument
} from '../src/shared/searchDomain'

const now = '2026-08-17T12:00:00.000Z'

function document(
  input: Partial<SearchDocument> & Pick<SearchDocument, 'id' | 'entityType' | 'title'>
): SearchDocument {
  return createSearchDocument({
    id: input.id,
    entityType: input.entityType,
    title: input.title,
    source: input.source ?? 'structured',
    body: input.body,
    summary: input.summary,
    tags: input.tags,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    date: input.date,
    status: input.status,
    projectId: input.projectId,
    relPath: input.relPath,
    target: input.target,
    metadata: input.metadata
  })
}

describe('unified workspace search', () => {
  it('normalizes cross-domain records and keeps secret-bearing fields out of the index', () => {
    const schedule = createSearchDocumentFromEntity(
      'schedule',
      {
        id: 'schedule:daily',
        name: 'Daily launch review',
        description: 'Review the launch queue',
        code: 'const apiKey = "sk-live-should-never-be-indexed"',
        secretRefs: ['provider-token'],
        runtime: 'javascript',
        enabled: true,
        trigger: { type: 'daily' },
        updatedAt: now
      },
      { metadata: { apiKey: 'secret-value', runtime: 'javascript' } }
    )

    expect(schedule).not.toBeNull()
    expect(schedule?.body).not.toContain('sk-live-should-never-be-indexed')
    expect(schedule?.metadata).toEqual(
      expect.objectContaining({ runtime: 'javascript', enabled: true })
    )
    expect(schedule?.metadata).not.toHaveProperty('apiKey')

    const redacted = createSearchDocument({
      id: 'note:credentials',
      entityType: 'note',
      title: 'Deployment notes',
      body: 'apiKey=super-secret-value Bearer another-secret-value',
      metadata: { token: 'also-secret', owner: 'team' }
    })
    expect(redacted.body).not.toContain('super-secret-value')
    expect(redacted.body).not.toContain('another-secret-value')
    expect(redacted.metadata).toEqual({ owner: 'team' })
  })

  it('ranks title matches above body matches and supports entity/status/date filters', () => {
    const index = new UnifiedSearchIndex({
      now: new Date(now),
      documents: [
        document({
          id: 'note:body',
          entityType: 'note',
          title: 'Meeting notes',
          body: 'The launch project is ready for review',
          tags: ['planning'],
          updatedAt: '2026-08-15T12:00:00.000Z'
        }),
        document({
          id: 'task:launch',
          entityType: 'task',
          title: 'Launch review',
          body: 'Confirm the release checklist',
          tags: ['planning'],
          status: 'in-progress',
          projectId: 'project:alpha',
          date: '2026-08-17',
          updatedAt: '2026-08-16T12:00:00.000Z'
        }),
        document({
          id: 'project:launch',
          entityType: 'project',
          title: 'Launch project',
          summary: 'A project for the next release',
          status: 'active',
          updatedAt: '2026-08-14T12:00:00.000Z'
        })
      ]
    })

    const allResults = index.search('launch')
    expect(allResults.map((result) => result.id)).toEqual([
      'task:launch',
      'project:launch',
      'note:body'
    ])
    expect(allResults[0]?.matchedFields).toContain('title')
    expect(allResults[2]?.matchedFields).toContain('body')

    const taskResults = index.search({
      query: 'launch',
      filters: {
        entityTypes: ['task'],
        statuses: ['in-progress'],
        projectIds: ['project:alpha'],
        dateFrom: '2026-08-17',
        dateTo: '2026-08-17'
      }
    })
    expect(taskResults).toHaveLength(1)
    expect(taskResults[0]?.entityType).toBe('task')
  })

  it('updates and removes normalized documents without rebuilding unrelated domains', () => {
    const index = new UnifiedSearchIndex()
    index.upsert(document({ id: 'task:1', entityType: 'task', title: 'Old title' }))
    index.upsert(document({ id: 'project:1', entityType: 'project', title: 'Project title' }))

    index.upsert(document({ id: 'task:1', entityType: 'task', title: 'New title' }))
    expect(index.search('new title')[0]?.id).toBe('task:1')
    expect(index.search('old title')).toHaveLength(0)

    expect(index.remove('task', '1')).toBe(true)
    expect(index.search('new title')).toHaveLength(0)
    expect(index.search('project title')[0]?.id).toBe('project:1')
  })

  it('deduplicates recent searches while preserving filter context and recency', () => {
    const store = new RecentSearchStore([], {
      limit: 2,
      now: () => now
    })

    store.add('  launch  ', { entityTypes: ['task'] }, '2026-08-15T00:00:00.000Z')
    store.add('other', undefined, '2026-08-16T00:00:00.000Z')
    store.add('LAUNCH', { entityTypes: ['task'] }, '2026-08-17T00:00:00.000Z')

    expect(store.list()).toEqual([
      {
        query: 'LAUNCH',
        filters: { entityTypes: ['task'] },
        usedAt: '2026-08-17T00:00:00.000Z'
      },
      { query: 'other', usedAt: '2026-08-16T00:00:00.000Z' }
    ])

    store.remove('other')
    expect(store.list()).toHaveLength(1)
  })

  it('keeps only explicitly safe metadata values', () => {
    expect(
      toSafeSearchMetadata({
        priority: 'high',
        count: 2,
        enabled: true,
        apiKey: 'secret',
        refreshToken: 'secret',
        nested: { secret: 'secret' }
      })
    ).toEqual({ priority: 'high', count: 2, enabled: true })
  })

  it('returns deterministic ranking from the reusable helper', () => {
    const docs = [
      document({ id: 'note:a', entityType: 'note', title: 'Alpha', body: 'body' }),
      document({ id: 'note:b', entityType: 'note', title: 'Notes', body: 'Alpha appears here' })
    ]
    expect(
      rankSearchDocuments(docs, 'alpha', undefined, { now }).map((result) => result.id)
    ).toEqual(['note:a', 'note:b'])
  })
})
