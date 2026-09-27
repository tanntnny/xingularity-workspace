import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { describe, expect, it } from 'vitest'
import { remarkXingularityMarkdown } from '../src/shared/markdownDialect'

function render(markdown: string): string {
  return renderToStaticMarkup(
    createElement(
      ReactMarkdown,
      { remarkPlugins: [remarkGfm, remarkXingularityMarkdown] },
      markdown
    )
  )
}

describe('Xingularity Markdown dialect', () => {
  it('renders single underscores as underline while preserving other emphasis styles', () => {
    const markup = render('_underlined_ *italic* __bold__')

    expect(markup).toContain('<u>underlined</u>')
    expect(markup).toContain('<em>italic</em>')
    expect(markup).toContain('<strong>bold</strong>')
  })

  it('does not turn Setext-like lines into headings', () => {
    const markup = render('Test\n-\n\nDivider text\n---\n\n# Explicit heading')

    expect(markup).toContain('<p>Test\n-</p>')
    expect(markup).toContain('<p>Divider text</p>')
    expect(markup).toMatch(/<hr\/?\s*>/)
    expect(markup).toContain('<h1>Explicit heading</h1>')
    expect(markup).not.toContain('<h2>Test</h2>')
  })

  it('leaves escaped, code, and internal underscore text unchanged', () => {
    const markup = render('`_code_` \\_literal\\_ foo_bar_baz')

    expect(markup).toContain('<code>_code_</code>')
    expect(markup).toContain('_literal_')
    expect(markup).toContain('foo_bar_baz')
    expect(markup).not.toContain('<u>')
  })
})
