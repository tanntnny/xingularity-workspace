import { describe, expect, it } from 'vitest'
import { buildKnowledgeGraph } from '../src/renderer/src/lib/knowledgeGraph'
import type { NoteListItem } from '../src/shared/types'

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
})
