import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Editor } from '../src/renderer/src/components/Editor'
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
    expect(markup).toContain('data-editor-mode="live"')
    expect(markup).toContain('data-testid="note-codemirror-root"')
    expect(markup).toContain('data-editor-density="compact"')
    expect(markup).toContain('data-testid="note-editor-page-content"')
    expect(markup).toContain('data-testid="note-title-content"')
    expect(markup).not.toContain('border-b border-border pb-5')
    expect(markup).toContain('data-scroll-state="visible"')
    expect(markup).toContain('class="note-title-area shrink-0 border-b-0 bg-workspace"')
    expect(markup).not.toContain('sticky top-0')
    expect(markup).toContain('data-testid="note-editor-content"')
    expect(markup).toContain('note-page-editor')
    expect(markup.match(/max-w-5xl/g) ?? []).toHaveLength(1)
  })

  it('uses the same source-owned CodeMirror surface in source mode', () => {
    const markup = renderToStaticMarkup(
      createElement(Editor, {
        initialContent: '# Launch brief\n\nDraft',
        mode: 'source',
        onDirty: () => undefined,
        onPasteImage: async () => null,
        onDropFile: async () => null,
        notes: [],
        vimModeEnabled: true,
        vimKeyMappings: []
      })
    )

    expect(markup).toContain('data-editor-mode="source"')
    expect(markup).toContain('data-testid="note-codemirror-root"')
    expect(markup).toContain('data-note-source-editor="true"')
  })
})
