import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ProgressRing } from '../src/renderer/src/components/ui/progress-ring'

describe('ProgressRing', () => {
  it('renders a fixed-size outlined ring with clamped progress', () => {
    const markup = renderToStaticMarkup(
      createElement(ProgressRing, {
        value: 125,
        'data-testid': 'progress-ring'
      })
    )

    expect(markup).toContain('data-testid="progress-ring"')
    expect(markup).toContain('aria-hidden="true"')
    expect(markup).toContain('width="20"')
    expect(markup).toContain('height="20"')
    expect(markup).toContain('viewBox="0 0 20 20"')
    expect(markup).toContain('text-border')
    expect(markup).toContain('text-progress')
    expect(markup).toContain('stroke-dasharray=')
    expect(markup).toContain('stroke-dashoffset="0"')
    expect(markup.match(/<circle/g)).toHaveLength(2)
  })
})
