import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MessageResponse } from '../src/renderer/src/components/ai-elements/message'

describe('AI Markdown responses', () => {
  it('uses the Xingularity Markdown dialect', () => {
    const markup = renderToStaticMarkup(
      createElement(MessageResponse, null, '_underlined_ *italic* __bold__')
    )

    expect(markup).toContain('<u>underlined</u>')
    expect(markup).toContain('<em>italic</em>')
    expect(markup).toContain('<strong>bold</strong>')
  })
})
