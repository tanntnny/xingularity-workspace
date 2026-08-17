import { describe, expect, it } from 'vitest'
import { buildFolderMarkdown } from '../src/main/noteMarkdownExport'

describe('buildFolderMarkdown', () => {
  it('builds a combined Markdown document with note metadata and bodies', () => {
    const result = buildFolderMarkdown('Archive', [
      {
        relPath: 'archive/alpha.md',
        markdown: '---\ntags: [alpha]\n---\n# Alpha\n\nAlpha body'
      },
      {
        relPath: 'archive/nested/beta.md',
        markdown: 'Beta body'
      }
    ])

    expect(result).toBe(
      [
        '# Archive',
        '',
        '## Alpha',
        '',
        'Source: `archive/alpha.md`',
        '',
        '# Alpha\n\nAlpha body',
        '',
        '---',
        '',
        '## beta',
        '',
        'Source: `archive/nested/beta.md`',
        '',
        'Beta body',
        ''
      ].join('\n')
    )
    expect(result).not.toContain('tags: [alpha]')
  })

  it('keeps an empty note section readable', () => {
    expect(buildFolderMarkdown('Archive', [{ relPath: 'archive/empty.md', markdown: '' }])).toBe(
      ['# Archive', '', '## empty', '', 'Source: `archive/empty.md`', ''].join('\n')
    )
  })
})
