import { describe, expect, it } from 'vitest'
import type { NoteTreeNode } from '../src/shared/types'
import { getNotebookFolderContents } from '../src/renderer/src/lib/notebookFolderContents'

function note(relPath: string): NoteTreeNode {
  return {
    id: relPath,
    relPath,
    name: relPath.split('/').pop() ?? relPath,
    kind: 'note',
    createdAt: '',
    updatedAt: '',
    note: {
      relPath,
      name: relPath.split('/').pop() ?? relPath,
      dir: relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/')) : '',
      createdAt: '',
      updatedAt: '',
      tags: []
    }
  }
}

function folder(relPath: string, children: NoteTreeNode[] = []): NoteTreeNode {
  return {
    id: relPath,
    relPath,
    name: relPath.split('/').pop() ?? relPath,
    kind: 'folder',
    isLinked: false,
    children
  }
}

describe('getNotebookFolderContents', () => {
  const tree: NoteTreeNode[] = [
    note('root.md'),
    folder('archive', [
      note('archive/old.md'),
      folder('archive/2025', [note('archive/2025/jan.md')])
    ])
  ]

  it('returns root children when no folder is requested', () => {
    const result = getNotebookFolderContents(tree, null)

    expect(result.path).toBeNull()
    expect(result.name).toBe('Notebooks')
    expect(result.children.map((node) => node.relPath)).toEqual(['root.md', 'archive'])
  })

  it('returns immediate children for a nested folder', () => {
    const result = getNotebookFolderContents(tree, 'archive')

    expect(result.path).toBe('archive')
    expect(result.parentPath).toBeNull()
    expect(result.children.map((node) => node.relPath)).toEqual(['archive/old.md', 'archive/2025'])
  })

  it('falls back to the nearest existing folder', () => {
    const result = getNotebookFolderContents(tree, 'archive/missing/deeper')

    expect(result.path).toBe('archive')
    expect(result.children.map((node) => node.relPath)).toEqual(['archive/old.md', 'archive/2025'])
  })
})
