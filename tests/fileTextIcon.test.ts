import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FileText } from '../src/renderer/src/components/ui/icons'

describe('FileText icon', () => {
  it('renders the shared light grey gradient Markdown file artwork', () => {
    const markup = renderToStaticMarkup(createElement(FileText, { size: 30 }))

    expect(markup).toContain('class="tabler-icon icon-tabler-markdown-file"')
    expect(markup).toContain('viewBox="0 0 30 30"')
    expect(markup).toContain('<linearGradient')
    expect(markup).toContain('stop-color="#f8f8f8"')
    expect(markup).toContain('stop-color="#d9d9d9"')
    expect(markup).toContain('stop-color="#eeeeee"')
    expect(markup).toContain('stop-color="#c8c8c8"')
    expect(markup).toContain('fill="url(#markdown-file-gradient-')
    expect(markup).toContain('fill="url(#markdown-file-fold-gradient-')
    expect(markup).toContain(
      'd="M19 3H8C6.9 3 6 3.9 6 5v20c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8L19 3z"'
    )
  })
})
