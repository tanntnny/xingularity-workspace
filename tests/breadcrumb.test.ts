import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  BreadcrumbButton,
  BreadcrumbEllipsis,
  BreadcrumbLabel,
  BreadcrumbLink,
  BreadcrumbPage
} from '../src/renderer/src/components/ui/breadcrumb'

describe('breadcrumb primitives', () => {
  it('uses rounded control geometry for every breadcrumb entry type', () => {
    const markup = renderToStaticMarkup(
      createElement(
        'div',
        null,
        createElement(BreadcrumbLink, { href: '#' }, 'Link'),
        createElement(BreadcrumbButton, null, 'Button'),
        createElement(BreadcrumbLabel, null, 'Label'),
        createElement(BreadcrumbPage, null, 'Page'),
        createElement(BreadcrumbEllipsis)
      )
    )

    expect(markup.match(/rounded-\[var\(--radius-button\)\]/g)).toHaveLength(5)
    expect(markup.match(/px-2 py-1/g)).toHaveLength(4)
    expect(markup).toContain('hover:bg-muted')
    expect(markup).toContain('focus-visible:ring-2')
    expect(markup).toContain('aria-current="page"')
  })

  it('preserves breadcrumb button semantics and caller classes', () => {
    const markup = renderToStaticMarkup(
      createElement(
        BreadcrumbButton,
        { className: 'text-sm', 'data-testid': 'breadcrumb-button' },
        'Open'
      )
    )

    expect(markup).toContain('type="button"')
    expect(markup).toContain('data-testid="breadcrumb-button"')
    expect(markup).toContain('text-sm')
    expect(markup).toContain('app-no-drag')
  })
})
