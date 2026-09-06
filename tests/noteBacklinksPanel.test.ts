import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { NoteBacklinksPanel } from '../src/renderer/src/components/NoteBacklinksPanel'

describe('NoteBacklinksPanel', () => {
  it('renders backlink names, paths, and accessible open actions', () => {
    const markup = renderToStaticMarkup(
      createElement(NoteBacklinksPanel, {
        backlinks: [{ relPath: 'projects/beta.md' }],
        onOpenBacklink: () => undefined
      })
    )

    expect(markup).toContain('aria-label="Note backlinks"')
    expect(markup).toContain('data-testid="note-backlink-item:projects/beta.md"')
    expect(markup).toContain('Open backlink: projects/beta')
    expect(markup).toContain('>beta<')
    expect(markup).toContain('>projects/beta<')
    expect(markup).not.toContain('<svg')
  })

  it('renders an empty panel body without an empty-state message', () => {
    const markup = renderToStaticMarkup(
      createElement(NoteBacklinksPanel, {
        backlinks: [],
        onOpenBacklink: () => undefined
      })
    )

    expect(markup).toContain('data-testid="note-backlinks-list"')
    expect(markup).not.toContain('note-backlink-item:')
    expect(markup).not.toContain('No backlinks')
  })
})
