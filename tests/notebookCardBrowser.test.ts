import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { NoteTreeNode } from '../src/shared/types'
import { NotebookCardBrowser } from '../src/renderer/src/components/NotebookCardBrowser'

describe('NotebookCardBrowser', () => {
  it('uses the same non-fading ellipsis labels for folders, notes, and drawings', () => {
    const tree: NoteTreeNode[] = [
      note('A very long notebook name.md'),
      folder('A very long folder name'),
      drawing('A very long drawing name.excalidraw')
    ]

    const markup = renderToStaticMarkup(
      createElement(NotebookCardBrowser, {
        tree,
        folderPath: null,
        selectedEntries: [],
        onBrowseFolder: () => undefined,
        onOpenFolder: () => undefined,
        onSelectionChange: () => undefined,
        onOpenPath: () => undefined,
        onCreateNote: () => undefined,
        onCreateExcalidraw: () => undefined,
        onCreateFolder: () => undefined,
        onExportFolderPdf: () => undefined,
        onExportFolderMarkdown: () => undefined,
        onRenamePath: () => undefined,
        onDeleteEntries: () => undefined,
        onMoveEntries: async () => undefined,
        folderColors: {},
        onFolderColorChange: () => undefined
      })
    )

    expect(markup).not.toContain('workspace-text-fade')
    expect(markup.match(/class="workspace-text-ellipsis/g)).toHaveLength(6)
    expect(markup.match(/data-lines="2"/g)).toHaveLength(3)
    expect(markup.match(/data-lines="1"/g)).toHaveLength(3)
    expect(markup).toContain('data-testid="notebook-card-title:A very long notebook name.md"')
    expect(markup).toContain('title="A very long notebook name"')
    expect(markup).toContain('title="A very long folder name"')
    expect(markup).toContain('title="A very long drawing name"')
  })
})

function note(relPath: string): NoteTreeNode {
  const name = relPath.split('/').pop() ?? relPath

  return {
    kind: 'note',
    id: relPath,
    relPath,
    name,
    createdAt: '2026-09-11T00:00:00.000Z',
    updatedAt: '2026-09-11T00:00:00.000Z',
    note: {
      relPath,
      name,
      dir: '',
      createdAt: '2026-09-11T00:00:00.000Z',
      updatedAt: '2026-09-11T00:00:00.000Z',
      tags: []
    }
  }
}

function folder(relPath: string): NoteTreeNode {
  return {
    kind: 'folder',
    id: relPath,
    relPath,
    name: relPath,
    isLinked: false,
    children: []
  }
}

function drawing(relPath: string): NoteTreeNode {
  return {
    kind: 'excalidraw',
    id: relPath,
    relPath,
    name: relPath,
    createdAt: '2026-09-11T00:00:00.000Z',
    updatedAt: '2026-09-11T00:00:00.000Z'
  }
}
