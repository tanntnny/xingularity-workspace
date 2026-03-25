import { describe, expect, it } from 'vitest'
import { extractNoteOutline, extractNoteOutlineFromMarkdown } from '../src/renderer/src/lib/noteOutline'

describe('extractNoteOutlineFromMarkdown', () => {
  it('preserves heading order and line-based ids', () => {
    const markdown = ['# Title', '', 'Body', '## Section', '### Details'].join('\n')

    expect(extractNoteOutlineFromMarkdown(markdown)).toEqual([
      { id: 'heading-line-1', label: 'Title', level: 1 },
      { id: 'heading-line-4', label: 'Section', level: 2 },
      { id: 'heading-line-5', label: 'Details', level: 3 }
    ])
  })

  it('ignores fenced code blocks when building the outline', () => {
    const markdown = ['```md', '# Not a heading', '```', '## Real Heading'].join('\n')

    expect(extractNoteOutlineFromMarkdown(markdown)).toEqual([
      { id: 'heading-line-4', label: 'Real Heading', level: 2 }
    ])
  })
})

describe('extractNoteOutline', () => {
  it('extracts heading blocks from a blocknote document tree', () => {
    expect(
      extractNoteOutline([
        {
          id: 'heading-1',
          type: 'heading',
          props: { level: 1 },
          content: [{ type: 'text', text: 'Title' }]
        },
        {
          id: 'paragraph-1',
          type: 'paragraph',
          content: [{ type: 'text', text: 'Body' }],
          children: [
            {
              id: 'heading-2',
              type: 'heading',
              props: { level: 2 },
              content: [{ type: 'text', text: 'Nested Section' }]
            }
          ]
        }
      ])
    ).toEqual([
      { id: 'heading-1', label: 'Title', level: 1 },
      { id: 'heading-2', label: 'Nested Section', level: 2 }
    ])
  })
})
