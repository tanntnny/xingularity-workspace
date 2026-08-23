import { describe, expect, it } from 'vitest'

import {
  findNotebookFolder,
  flattenNotebookFolders,
  getNotebookFolderName,
  getProjectNotebookPath
} from '../src/renderer/src/lib/projectNotebook'
import { normalizeResourceInput, notebookResourceUri } from '../src/shared/resourceDomain'
import type { NoteTreeNode } from '../src/shared/types'

const notebookTree: NoteTreeNode[] = [
  {
    id: 'folder:Projects',
    kind: 'folder',
    relPath: 'Projects',
    name: 'Projects',
    isLinked: false,
    children: [
      {
        id: 'folder:Projects/Beta',
        kind: 'folder',
        relPath: 'Projects/Beta',
        name: 'Beta',
        isLinked: false,
        children: []
      },
      {
        id: 'folder:Projects/Alpha',
        kind: 'folder',
        relPath: 'Projects/Alpha',
        name: 'Alpha',
        isLinked: false,
        children: [
          {
            id: 'folder:Projects/Alpha/Docs',
            kind: 'folder',
            relPath: 'Projects/Alpha/Docs',
            name: 'Docs',
            isLinked: false,
            children: []
          }
        ]
      }
    ]
  }
]

describe('project notebook helpers', () => {
  it('flattens and sorts every notebook folder for searching', () => {
    expect(flattenNotebookFolders(notebookTree)).toEqual([
      { path: 'Projects', name: 'Projects', depth: 0 },
      { path: 'Projects/Alpha', name: 'Alpha', depth: 1 },
      { path: 'Projects/Alpha/Docs', name: 'Docs', depth: 2 },
      { path: 'Projects/Beta', name: 'Beta', depth: 1 }
    ])
  })

  it('resolves automatic and explicit project notebook resource paths', () => {
    expect(getProjectNotebookPath({ name: 'Launch' })).toBe('Projects/Launch')
    expect(
      getProjectNotebookPath({
        name: 'Launch',
        resourceRefs: [
          normalizeResourceInput({
            type: 'notebook',
            canonicalUri: notebookResourceUri('Projects/Alpha')
          })
        ]
      })
    ).toBe('Projects/Alpha')
    expect(getNotebookFolderName('Projects/Alpha/Docs')).toBe('Docs')
    expect(findNotebookFolder(notebookTree, 'Projects/Alpha/Docs')?.name).toBe('Docs')
    expect(findNotebookFolder(notebookTree, 'Projects/Missing')).toBeNull()
  })
})
