import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { EditorPage } from '../src/renderer/src/pages/EditorPage'

describe('note editor page composition', () => {
  it('uses compact editor density like the project main content', () => {
    const markup = renderToStaticMarkup(
      createElement(EditorPage, {
        initialContent: '# Launch brief',
        notePath: 'Projects/Launch.md',
        tags: [],
        notes: [],
        onDirty: () => undefined,
        onDropFile: async () => null,
        onPasteImage: async () => null,
        onAddTag: () => undefined,
        onRemoveTag: () => undefined,
        onFindByTag: () => undefined,
        onOpenNoteLink: () => undefined,
        onRename: async () => undefined,
        vimModeEnabled: true,
        vimKeyMappings: []
      })
    )

    expect(markup).toContain('data-testid="note-block-editor"')
    expect(markup).toContain('data-editor-density="compact"')
    expect(markup).toContain('data-testid="note-editor-page-content"')
    expect(markup).toContain('data-testid="note-title-content"')
    expect(markup).toContain('data-testid="note-editor-content"')
    expect(markup.match(/max-w-5xl/g) ?? []).toHaveLength(1)
  })
})
