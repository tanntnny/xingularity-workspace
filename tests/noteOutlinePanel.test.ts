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
          { id: 'heading-2', label: 'Section', level: 2 },
          { id: 'heading-3', label: 'Nested Section', level: 3 }
        ],
        onJumpToIndex: () => undefined
      })
    )

    expect(markup).toContain('aria-label="Note headings"')
    expect(markup).toContain('data-testid="note-outline-item:0"')
    expect(markup).toContain('Jump to heading: Section')
    expect(markup).toContain('H2')
    expect(markup).not.toContain('data-testid="note-outline-indent-guide:0:0"')
    expect(markup).toContain('data-testid="note-outline-indent-guide:1:0"')
    expect(markup).toContain('data-testid="note-outline-indent-guide:2:0"')
    expect(markup).toContain('data-testid="note-outline-indent-guide:2:1"')
  })

  it('keeps long headings on one line with the workspace fade treatment', () => {
    const markup = renderToStaticMarkup(
      createElement(NoteOutlinePanel, {
        items: [
          {
            id: 'heading-1',
            label: 'A heading with enough text to exceed the narrow outline panel',
            level: 1
          }
        ],
        onJumpToIndex: () => undefined
      })
    )

    expect(markup).toContain('workspace-text-fade block max-w-full min-w-0 flex-1')
    expect(markup).not.toContain('break-words')
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
