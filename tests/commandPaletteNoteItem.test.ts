import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CommandPaletteNoteItemContent } from '../src/renderer/src/components/CommandPaletteNoteItem'
import { createCommandPaletteNoteHighlights } from '../src/renderer/src/lib/commandPaletteSearch'
import { getCommandPaletteFolderBreadcrumbs } from '../src/renderer/src/lib/commandPaletteNoteRows'

describe('getCommandPaletteFolderBreadcrumbs', () => {
  it('uses Vault for notes at the vault root', () => {
    expect(getCommandPaletteFolderBreadcrumbs('Inbox.md')).toEqual([{ label: 'Vault', path: null }])
  })

  it('returns only the parent folders for nested notes', () => {
    expect(getCommandPaletteFolderBreadcrumbs('Projects/Research/Roadmap.md')).toEqual([
      { label: 'Projects', path: 'Projects' },
      { label: 'Research', path: 'Projects/Research' }
    ])
  })
})

describe('CommandPaletteNoteItemContent', () => {
  it('renders a two-line note row with folder path and trailing recency icon', () => {
    const markup = renderToStaticMarkup(
      createElement(CommandPaletteNoteItemContent, {
        title: 'Roadmap',
        relPath: 'Projects/Research/Roadmap.md',
        folderColors: {
          Projects: '#38bdf8',
          'Projects/Research': '#f472b6'
        }
      })
    )

    expect(markup).toContain('data-testid="command-palette-note-title"')
    expect(markup).toContain('data-testid="command-palette-note-folder-path"')
    expect(markup).toContain('Roadmap')
    expect(markup).toContain('Projects')
    expect(markup).toContain('Research')
    expect(markup.match(/viewBox="0 0 36 36"/g)).toHaveLength(2)
    expect(markup.match(/width="10" height="10"/g)).toHaveLength(2)
    expect(markup.match(/style="width:10px;height:10px"/g)).toHaveLength(2)
    expect(markup).toContain('#38bdf8')
    expect(markup).toContain('#f472b6')
    expect(markup.match(/tabler-icon-chevron-right/g)).toHaveLength(1)
    expect(markup).toContain('tabler-icon-hourglass-empty')
    expect(markup).not.toContain('>Roadmap.md<')
  })

  it('renders title, folder, and body-search highlights without changing note affordances', () => {
    const highlights = createCommandPaletteNoteHighlights({
      title: 'Roadmap',
      relPath: 'Projects/Research/Roadmap.md',
      query: 'research',
      excerpt: 'A research note excerpt'
    })
    const markup = renderToStaticMarkup(
      createElement(CommandPaletteNoteItemContent, {
        title: 'Roadmap',
        relPath: 'Projects/Research/Roadmap.md',
        folderColors: {
          Projects: '#38bdf8',
          'Projects/Research': '#f472b6'
        },
        highlights,
        snippet: 'A research note excerpt'
      })
    )

    expect(markup).toContain('data-testid="command-palette-note-excerpt"')
    expect(markup).toContain('data-testid="command-palette-match"')
    expect(markup.match(/data-testid="command-palette-match"/g)).toHaveLength(2)
    expect(markup).toContain('tabler-icon-hourglass-empty')
    expect(markup).toContain('tabler-icon-chevron-right')
  })
})
