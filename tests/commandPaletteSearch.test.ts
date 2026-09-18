import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CommandPaletteMatchText } from '../src/renderer/src/components/CommandPaletteMatchText'
import type { NoteListItem, Project } from '../src/shared/types'
import {
  createCommandPaletteCommandSearchIndex,
  createCommandPaletteBodyExcerpt,
  createCommandPaletteNoteSearchIndex,
  createCommandPaletteProjectSearchIndex,
  searchCommandPaletteCommands,
  searchCommandPaletteNotes,
  searchCommandPaletteProjects
} from '../src/renderer/src/lib/commandPaletteSearch'

const NOTE: NoteListItem = {
  relPath: 'Projects/Research/Roadmap.md',
  name: 'Roadmap.md',
  dir: 'Projects/Research',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  tags: ['planning'],
  bodyPreview: 'A launch plan with a needle in the middle of the roadmap.',
  mentionTargets: ['release planning']
}

const PROJECT: Project = {
  id: 'project-1',
  name: 'Apollo Launch',
  summary: 'Coordinate the launch plan',
  folderPath: 'Projects/Research',
  state: 'active',
  updatedAt: '2026-01-03T00:00:00.000Z',
  icon: {
    variant: 'outlined',
    color: '#74a9df'
  }
}

describe('command palette search metadata', () => {
  it('highlights visible command labels while preserving fuzzy ranking', () => {
    const index = createCommandPaletteCommandSearchIndex([
      {
        value: '>go projects',
        label: 'Go to Projects',
        keywords: ['workspace']
      }
    ])

    const [result] = searchCommandPaletteCommands(index, 'gpr')

    expect(result.highlights?.title).toEqual([
      { start: 0, end: 1 },
      { start: 6, end: 8 }
    ])
  })

  it('highlights matching note titles and individual folder breadcrumbs', () => {
    const index = createCommandPaletteNoteSearchIndex([NOTE])

    const [result] = searchCommandPaletteNotes(index, 'research', 'name', 10)

    expect(result.highlights?.title).toEqual([])
    expect(result.highlights?.folders?.[0]).toEqual([])
    expect(result.highlights?.folders?.[1]).toEqual([{ start: 0, end: 8 }])
  })

  it('highlights a fuzzy command-style match as separate characters in visible text', () => {
    const index = createCommandPaletteNoteSearchIndex([
      {
        ...NOTE,
        name: 'Go Projects.md',
        relPath: 'Go Projects.md',
        dir: ''
      }
    ])

    const [result] = searchCommandPaletteNotes(index, 'gpr', 'name', 10)
    const title = result.title
    const ranges = result.highlights?.title ?? []

    expect(ranges.map((range) => title.slice(range.start, range.end))).toEqual(['G', 'Pr'])
  })

  it('returns a bounded body excerpt with correctly shifted highlight ranges', () => {
    const body = `${'context '.repeat(18)}needle ${'tail '.repeat(18)}`
    const excerpt = createCommandPaletteBodyExcerpt(body, 'needle', 40)

    expect(excerpt).toBeDefined()
    expect(excerpt!.text.length).toBeLessThanOrEqual(44)
    expect(excerpt!.highlights.map((range) => excerpt!.text.slice(range.start, range.end))).toEqual(
      ['needle']
    )
  })

  it('searches and highlights visible project summaries', () => {
    const index = createCommandPaletteProjectSearchIndex([PROJECT])

    const [result] = searchCommandPaletteProjects(index, 'launch', 10)

    expect(result.title).toBe('Apollo Launch')
    expect(result.subtitle).toBe('Coordinate the launch plan')
    expect(result.icon).toEqual(PROJECT.icon)
    expect(result.highlights?.title).toEqual([{ start: 7, end: 13 }])
    expect(result.highlights?.subtitle).toEqual([{ start: 15, end: 21 }])
  })

  it('highlights diacritic-insensitive matches against the original title', () => {
    const index = createCommandPaletteNoteSearchIndex([
      {
        ...NOTE,
        name: 'Café Roadmap.md',
        relPath: 'Café Roadmap.md',
        dir: ''
      }
    ])

    const [result] = searchCommandPaletteNotes(index, 'cafe', 'name', 10)

    expect(result.title).toBe('Café Roadmap')
    expect(result.highlights?.title).toEqual([{ start: 0, end: 4 }])
  })

  it('renders highlighted text as safe semantic markup', () => {
    const markup = renderToStaticMarkup(
      createElement(CommandPaletteMatchText, {
        text: '<script>launch</script>',
        ranges: [{ start: 8, end: 14 }]
      })
    )

    expect(markup).toContain('&lt;script&gt;')
    expect(markup).toContain('<mark')
    expect(markup).toContain('>launch</mark>')
    expect(markup).toContain('rounded-none')
    expect(markup).toContain('bg-yellow-700')
    expect(markup).toContain('text-white')
    expect(markup).not.toContain('rounded-sm')
    expect(markup).not.toContain('<script>')
  })
})
