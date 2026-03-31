import { describe, expect, it } from 'vitest'
import { buildKnowledgeGraph } from '../src/renderer/src/lib/knowledgeGraph'
import type { NoteListItem } from '../src/shared/types'

function createNote(
  overrides: Partial<NoteListItem> & Pick<NoteListItem, 'relPath' | 'name'>
): NoteListItem {
  return {
    relPath: overrides.relPath,
    name: overrides.name,
    dir: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    tags: [],
    bodyPreview: '',
    mentionTargets: [],
    ...overrides
  }
}

describe('buildKnowledgeGraph', () => {
  it('resolves links by exact relative path mention', () => {
    const graph = buildKnowledgeGraph([
      createNote({
        relPath: 'alpha.xnote',
        name: 'alpha.xnote',
        mentionTargets: ['nested/beta']
      }),
      createNote({
        relPath: 'nested/beta.xnote',
        name: 'beta.xnote'
      })
    ])

    expect(graph.links).toEqual([{ source: 'alpha.xnote', target: 'nested/beta.xnote' }])
    expect(graph.nodes.map((node) => node.relPath)).toEqual(['alpha.xnote', 'nested/beta.xnote'])
  })

  it('resolves links by unique note name mention', () => {
    const graph = buildKnowledgeGraph([
      createNote({
        relPath: 'alpha.xnote',
        name: 'alpha.xnote',
        mentionTargets: ['beta']
      }),
      createNote({
        relPath: 'notes/beta.xnote',
        name: 'beta.xnote'
      })
    ])

    expect(graph.links).toEqual([{ source: 'alpha.xnote', target: 'notes/beta.xnote' }])
  })

  it('ignores ambiguous note name mentions', () => {
    const graph = buildKnowledgeGraph([
      createNote({
        relPath: 'alpha.xnote',
        name: 'alpha.xnote',
        mentionTargets: ['shared']
      }),
      createNote({
        relPath: 'one/shared.xnote',
        name: 'shared.xnote'
      }),
      createNote({
        relPath: 'two/shared.xnote',
        name: 'shared.xnote'
      })
    ])

    expect(graph.links).toEqual([])
    expect(graph.nodes).toEqual([])
  })

  it('ignores self-links and deduplicates mirrored links', () => {
    const graph = buildKnowledgeGraph([
      createNote({
        relPath: 'alpha.xnote',
        name: 'alpha.xnote',
        mentionTargets: ['alpha', 'beta']
      }),
      createNote({
        relPath: 'beta.xnote',
        name: 'beta.xnote',
        mentionTargets: ['alpha']
      })
    ])

    expect(graph.links).toEqual([{ source: 'alpha.xnote', target: 'beta.xnote' }])
    expect(
      graph.nodes.map((node) => ({
        relPath: node.relPath,
        degree: node.degree
      }))
    ).toEqual([
      { relPath: 'alpha.xnote', degree: 1 },
      { relPath: 'beta.xnote', degree: 1 }
    ])
  })
})
