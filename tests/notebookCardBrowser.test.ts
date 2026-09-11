import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { NoteTreeNode } from '../src/shared/types'
import { NotebookCardBrowser } from '../src/renderer/src/components/NotebookCardBrowser'

describe('NotebookCardBrowser', () => {
  it('allows notebook names to occupy up to two lines', () => {
    const note: NoteTreeNode = {
      kind: 'note',
      id: 'note-1',
      relPath: 'A very long notebook name.md',
      name: 'A very long notebook name.md',
      createdAt: '2026-09-11T00:00:00.000Z',
      updatedAt: '2026-09-11T00:00:00.000Z',
      note: {
        relPath: 'A very long notebook name.md',
        name: 'A very long notebook name.md',
        dir: '',
        createdAt: '2026-09-11T00:00:00.000Z',
        updatedAt: '2026-09-11T00:00:00.000Z',
        tags: []
      }
    }

    const markup = renderToStaticMarkup(
      createElement(NotebookCardBrowser, {
        tree: [note],
        folderPath: null,
        selectedEntries: [],
        onBrowseFolder: () => undefined,
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

    expect(markup).toContain('data-testid="notebook-card:A very long notebook name.md"')
    expect(markup).toContain('data-lines="2"')
  })
})
