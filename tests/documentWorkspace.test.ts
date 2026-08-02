import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  DocumentWorkspacePanel,
  WorkspacePanelStack
} from '../src/renderer/src/components/ui/document-workspace'

describe('document workspace right panel', () => {
  it('renders a transparent shell with independently stackable content', () => {
    const markup = renderToStaticMarkup(
      createElement(
        DocumentWorkspacePanel,
        null,
        createElement(
          WorkspacePanelStack,
          null,
          createElement('section', { 'data-testid': 'panel-one' }),
          createElement('section', { 'data-testid': 'panel-two' })
        )
      )
    )

    expect(markup).toContain('bg-transparent')
    expect(markup).toContain('data-testid="panel-one"')
    expect(markup).toContain('data-testid="panel-two"')
    expect(markup).toContain('gap-3')
    expect(markup).not.toContain('bg-card p-3')
  })
})
