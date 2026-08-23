import { describe, expect, it } from 'vitest'
import {
  buildKnowledgeGraph,
  createKnowledgeGraphEntities,
  filterKnowledgeGraph
} from '../src/renderer/src/lib/knowledgeGraph'
import type { NoteListItem, ResourceRef } from '../src/shared/types'

function createNote(
  overrides: Partial<NoteListItem> & Pick<NoteListItem, 'relPath' | 'name'>
): NoteListItem {
  return {
    ...overrides,
    relPath: overrides.relPath,
    name: overrides.name,
    dir: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    tags: [],
    bodyPreview: '',
    mentionTargets: overrides.mentionTargets ?? []
  }
}

describe('buildKnowledgeGraph', () => {
  it('includes project-linked resources as typed context nodes', () => {
    const resource: ResourceRef = {
      id: 'resource-1',
      type: 'external',
      provider: 'filesystem',
      kind: 'local-file',
      title: 'Brief.pdf',
      canonicalUri: 'file:///tmp/Brief.pdf',
      sourceOfTruth: 'external',
      access: 'read-only',
      state: 'available',
      projectIds: ['project-1'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }
    const graph = buildKnowledgeGraph(
      [],
      createKnowledgeGraphEntities(
        [
          {
            id: 'project-1',
            name: 'Atlas',
            summary: '',
            state: 'active',
            icon: { variant: 'filled', color: '#000000' },
            updatedAt: '2026-01-01T00:00:00.000Z'
          }
        ],
        [],
        [resource]
      )
    )

    expect(graph.nodes.some((node) => node.kind === 'resource')).toBe(true)
    expect(graph.links).toEqual([
      {
        source: 'resource:resource-1',
        target: 'project:project-1',
        relationType: 'project-resource'
      }
    ])
  })

  it('resolves links by exact relative path mention', () => {
    const graph = buildKnowledgeGraph([
      createNote({
        relPath: 'alpha.md',
        name: 'alpha.md',
        mentionTargets: ['nested/beta']
      }),
      createNote({
        relPath: 'nested/beta.md',
        name: 'beta.md'
      })
    ])

    expect(graph.links).toEqual([{ source: 'alpha.md', target: 'nested/beta.md' }])
    expect(graph.nodes.map((node) => node.relPath)).toEqual(['alpha.md', 'nested/beta.md'])
  })

  it('resolves links by unique note name mention', () => {
    const graph = buildKnowledgeGraph([
      createNote({
        relPath: 'alpha.md',
        name: 'alpha.md',
        mentionTargets: ['beta']
      }),
      createNote({
        relPath: 'notes/beta.md',
        name: 'beta.md'
      })
    ])

    expect(graph.links).toEqual([{ source: 'alpha.md', target: 'notes/beta.md' }])
  })

  it('ignores ambiguous note name mentions', () => {
    const graph = buildKnowledgeGraph([
      createNote({
        relPath: 'alpha.md',
        name: 'alpha.md',
        mentionTargets: ['shared']
      }),
      createNote({
        relPath: 'one/shared.md',
        name: 'shared.md'
      }),
      createNote({
        relPath: 'two/shared.md',
        name: 'shared.md'
      })
    ])

    expect(graph.links).toEqual([])
    expect(
      graph.nodes.map((node) => ({
        relPath: node.relPath,
        degree: node.degree,
        isOrphan: node.isOrphan
      }))
    ).toEqual([
      { relPath: 'alpha.md', degree: 0, isOrphan: true },
      { relPath: 'one/shared.md', degree: 0, isOrphan: true },
      { relPath: 'two/shared.md', degree: 0, isOrphan: true }
    ])
  })

  it('ignores self-links and deduplicates mirrored links', () => {
    const graph = buildKnowledgeGraph([
      createNote({
        relPath: 'alpha.md',
        name: 'alpha.md',
        mentionTargets: ['alpha', 'beta']
      }),
      createNote({
        relPath: 'beta.md',
        name: 'beta.md',
        mentionTargets: ['alpha']
      })
    ])

    expect(graph.links).toEqual([{ source: 'alpha.md', target: 'beta.md' }])
    expect(
      graph.nodes.map((node) => ({
        relPath: node.relPath,
        degree: node.degree
      }))
    ).toEqual([
      { relPath: 'alpha.md', degree: 1 },
      { relPath: 'beta.md', degree: 1 }
    ])
  })

  it('includes notes without links as orphan nodes', () => {
    const graph = buildKnowledgeGraph([
      createNote({
        relPath: 'alpha.md',
        name: 'alpha.md'
      }),
      createNote({
        relPath: 'beta.md',
        name: 'beta.md'
      })
    ])

    expect(graph.links).toEqual([])
    expect(
      graph.nodes.map((node) => ({
        relPath: node.relPath,
        degree: node.degree,
        isOrphan: node.isOrphan
      }))
    ).toEqual([
      { relPath: 'alpha.md', degree: 0, isOrphan: true },
      { relPath: 'beta.md', degree: 0, isOrphan: true }
    ])
  })

  it('includes connected and orphan notes together', () => {
    const graph = buildKnowledgeGraph([
      createNote({
        relPath: 'alpha.md',
        name: 'alpha.md',
        mentionTargets: ['beta']
      }),
      createNote({
        relPath: 'beta.md',
        name: 'beta.md'
      }),
      createNote({
        relPath: 'orphan.md',
        name: 'orphan.md'
      })
    ])

    expect(graph.links).toEqual([{ source: 'alpha.md', target: 'beta.md' }])
    expect(
      graph.nodes.map((node) => ({
        relPath: node.relPath,
        degree: node.degree,
        isOrphan: node.isOrphan
      }))
    ).toEqual([
      { relPath: 'alpha.md', degree: 1, isOrphan: false },
      { relPath: 'beta.md', degree: 1, isOrphan: false },
      { relPath: 'orphan.md', degree: 0, isOrphan: true }
    ])
  })

  it('filters orphan nodes while preserving connected links', () => {
    const graph = buildKnowledgeGraph([
      createNote({
        relPath: 'alpha.md',
        name: 'alpha.md',
        mentionTargets: ['beta']
      }),
      createNote({
        relPath: 'beta.md',
        name: 'beta.md'
      }),
      createNote({
        relPath: 'orphan.md',
        name: 'orphan.md'
      })
    ])

    expect(filterKnowledgeGraph(graph, false)).toEqual({
      nodes: [
        { id: 'alpha.md', relPath: 'alpha.md', label: 'alpha', degree: 1, isOrphan: false },
        { id: 'beta.md', relPath: 'beta.md', label: 'beta', degree: 1, isOrphan: false }
      ],
      links: [{ source: 'alpha.md', target: 'beta.md' }]
    })
    expect(filterKnowledgeGraph(graph, true)).toBe(graph)
  })
})
