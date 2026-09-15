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
    expect(markup).toContain('data-editor-mode="preview"')
    expect(markup).toContain('data-testid="note-raw-editor-surface"')
    expect(markup).toContain('data-testid="note-raw-editor"')
    expect(markup).toContain('data-editor-density="compact"')
    expect(markup).toContain('data-testid="note-editor-page-content"')
    expect(markup).toContain('data-testid="note-title-content"')
    expect(markup).toContain('data-scroll-state="visible"')
    expect(markup).toContain('class="shrink-0 bg-workspace"')
    expect(markup).not.toContain('sticky top-0')
    expect(markup).toContain('data-testid="note-editor-content"')
    expect(markup).toContain('note-page-editor')
    expect(markup.match(/max-w-5xl/g) ?? []).toHaveLength(1)
  })

  it('keeps the raw source surface mounted alongside the preview editor', () => {
    const markup = renderToStaticMarkup(
      createElement(Editor, {
        initialContent: '# Launch brief\n\nDraft',
        mode: 'raw',
        onDirty: () => undefined,
        onPasteImage: async () => null,
        onDropFile: async () => null,
        notes: [],
        vimModeEnabled: true,
        vimKeyMappings: []
      })
    )

    expect(markup).toContain('data-editor-mode="raw"')
    expect(markup).toContain('data-testid="note-milkdown-root" class="min-h-[10vh] h-full hidden"')
    expect(markup).toContain('data-testid="note-raw-editor-surface"')
    expect(markup).toContain('data-note-raw-scroll="bounded"')
    expect(markup).toContain('data-testid="note-raw-editor"')
  })
})
