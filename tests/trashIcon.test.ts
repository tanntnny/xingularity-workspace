import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Trash2 } from '../src/renderer/src/components/ui/icons'

describe('shared trash icon', () => {
  it('uses the Tabler outline trash geometry', () => {
    const markup = renderToStaticMarkup(createElement(Trash2, { size: 24 }))

    expect(markup).toContain('fill="none"')
    expect(markup).toContain('stroke="currentColor"')
    expect(markup).toContain('d="M4 7l16 0"')
    expect(markup).toContain('d="M10 11l0 6"')
    expect(markup).toContain('d="M14 11l0 6"')
    expect(markup).toContain('d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"')
    expect(markup).toContain('d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"')
  })
})
