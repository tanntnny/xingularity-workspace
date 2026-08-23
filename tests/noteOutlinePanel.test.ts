import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { NoteOutlinePanel } from '../src/renderer/src/components/NoteOutlinePanel'

describe('NoteOutlinePanel', () => {
  it('renders a navigable hierarchy of note headings', () => {
    const markup = renderToStaticMarkup(
      createElement(NoteOutlinePanel, {
        items: [
          { id: 'heading-1', label: 'Title', level: 1 },
          { id: 'heading-2', label: 'Section', level: 2 }
        ],
        onJumpToIndex: () => undefined
      })
    )

    expect(markup).toContain('aria-label="Note headings"')
    expect(markup).toContain('data-testid="note-outline-item:0"')
    expect(markup).toContain('Jump to heading: Section')
    expect(markup).toContain('H2')
  })

  it('renders an empty state when the note has no headings', () => {
    const markup = renderToStaticMarkup(
      createElement(NoteOutlinePanel, {
        items: [],
        onJumpToIndex: () => undefined
      })
    )

    expect(markup).toContain('data-testid="note-outline-empty"')
    expect(markup).toContain('Add a heading to make it available here.')
  })
})
