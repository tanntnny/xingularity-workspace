import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { WorkspaceTextEllipsis } from '../src/renderer/src/components/ui/workspace-text-ellipsis'

describe('WorkspaceTextEllipsis', () => {
  it('renders a single-line trailing ellipsis contract without fade metadata', () => {
    const markup = renderToStaticMarkup(
      createElement(WorkspaceTextEllipsis, { title: 'A long label' }, 'A long label')
    )

    expect(markup).toContain('class="workspace-text-ellipsis"')
    expect(markup).toContain('data-lines="1"')
    expect(markup).not.toContain('workspace-text-fade')
    expect(markup).toContain('title="A long label"')
  })

  it('supports a two-line trailing ellipsis contract', () => {
    const markup = renderToStaticMarkup(
      createElement(
        WorkspaceTextEllipsis,
        { lines: 2 },
        'A long label that can occupy two lines before truncating.'
      )
    )

    expect(markup).toContain('data-lines="2"')
    expect(markup).not.toContain('workspace-text-fade')
  })
})
