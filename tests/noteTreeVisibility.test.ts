import { describe, expect, it } from 'vitest'
import { hideManagedProjectTree } from '../src/renderer/src/lib/noteTreeVisibility'
import type { NoteTreeNode } from '../src/shared/types'

describe('hideManagedProjectTree', () => {
  it('keeps Projects folders visible in the notes explorer tree', () => {
    const tree: NoteTreeNode[] = [
      {
        id: 'folder:Projects',
        kind: 'folder',
        relPath: 'Projects',
        name: 'Projects',
        protectionKind: null,
        children: [
          {
            id: 'folder:Projects/Alpha',
            kind: 'folder',
            relPath: 'Projects/Alpha',
            name: 'Alpha',
            isProtected: true,
            protectionKind: 'project-folder',
            children: []
          }
        ]
      },
      {
        id: 'folder:Archive',
        kind: 'folder',
        relPath: 'Archive',
        name: 'Archive',
        children: []
      }
    ]

    expect(hideManagedProjectTree(tree)).toEqual(tree)
  })

  it('keeps a normal user folder named Projects visible', () => {
    const tree: NoteTreeNode[] = [
      {
        id: 'folder:Projects',
        kind: 'folder',
        relPath: 'Projects',
        name: 'Projects',
        children: []
      }
    ]

    expect(hideManagedProjectTree(tree)).toEqual(tree)
  })
})
