import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { WorkspaceTextClip } from '../src/renderer/src/components/ui/workspace-text-clip'

describe('WorkspaceTextClip', () => {
  it('renders the hard clipping contract without fade metadata', () => {
    const markup = renderToStaticMarkup(
      createElement(WorkspaceTextClip, { title: 'A long label' }, 'A long label')
    )

    expect(markup).toContain('class="workspace-text-clip"')
    expect(markup).not.toContain('workspace-text-fade')
    expect(markup).toContain('A long label')
  })
})
