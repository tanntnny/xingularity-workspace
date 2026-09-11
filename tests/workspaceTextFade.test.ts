import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import {
  WorkspaceTextFade,
  WorkspaceTextFadeContent
} from '../src/renderer/src/components/ui/workspace-text-fade'

describe('WorkspaceTextFade', () => {
  it('renders the single-line fade contract by default', () => {
    const markup = renderToStaticMarkup(
      createElement(WorkspaceTextFade, { title: 'A long label' }, 'A long label')
    )

    expect(markup).toContain('class="workspace-text-fade"')
    expect(markup).toContain('data-lines="1"')
    expect(markup).toContain('data-overflowing="false"')
    expect(markup).toContain('A long label')
  })

  it('supports a two-line fade contract', () => {
    const markup = renderToStaticMarkup(
      createElement(
        WorkspaceTextFade,
        { lines: 2 },
        'A long snippet that can occupy two lines before fading.'
      )
    )

    expect(markup).toContain('data-lines="2"')
    expect(markup).toContain('A long snippet that can occupy two lines before fading.')
  })

  it('consumes the mutation observer opt-out without leaking it into the DOM', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      const markup = renderToStaticMarkup(
        createElement(WorkspaceTextFade, { observeMutations: false }, 'A static notebook label')
      )

      expect(consoleError).not.toHaveBeenCalled()
      expect(markup).not.toContain('observeMutations')
      expect(markup).toContain('A static notebook label')
    } finally {
      consoleError.mockRestore()
    }
  })

  it('wraps direct text while preserving nested content', () => {
    const markup = renderToStaticMarkup(
      createElement(
        WorkspaceTextFadeContent,
        { className: 'min-w-0' },
        'A label',
        createElement('strong', { key: 'emphasis' }, ' with emphasis')
      )
    )

    expect(markup).toContain('workspace-text-fade min-w-0')
    expect(markup).toContain('A label')
    expect(markup).toContain('<strong> with emphasis</strong>')
  })
})
