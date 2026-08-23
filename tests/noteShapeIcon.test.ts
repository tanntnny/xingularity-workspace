import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { NoteShapeIcon } from '../src/renderer/src/components/NoteShapeIcon'

const icon = {
  set: 'tabler' as const,
  glyph: 'rocket',
  variant: 'filled' as const,
  color: '#38bdf8'
}

describe('NoteShapeIcon', () => {
  it('renders a colored unbounded glyph by default', () => {
    const markup = renderToStaticMarkup(createElement(NoteShapeIcon, { icon, size: 18 }))

    expect(markup).toContain('data-project-icon-surface="none"')
    expect(markup).toContain('color:var(--project-icon-color)')
    expect(markup).not.toContain('background-color:')
    expect(markup).not.toContain('border-color:')
  })

  it('renders the subtle surface only when explicitly requested', () => {
    const markup = renderToStaticMarkup(
      createElement(NoteShapeIcon, { icon, size: 40, surface: 'subtle' })
    )

    expect(markup).toContain('data-project-icon-surface="subtle"')
    expect(markup).toContain('project-icon-surface')
    expect(markup).toContain('--project-icon-color:#38bdf8')
  })
})
