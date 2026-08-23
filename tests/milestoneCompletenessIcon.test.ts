import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MilestoneCompletenessIcon } from '../src/renderer/src/components/MilestoneCompletenessIcon'

describe('MilestoneCompletenessIcon', () => {
  it('renders the yellow outline diamonds icon for the current milestone', () => {
    const markup = renderToStaticMarkup(
      createElement(MilestoneCompletenessIcon, { status: 'current', size: 24 })
    )

    expect(markup).toContain(
      'class="tabler-icon tabler-icon-diamonds shrink-0 text-milestone-current"'
    )
    expect(markup).toContain('data-milestone-status="current"')
    expect(markup).toContain('data-completed="false"')
    expect(markup).toContain('fill="none"')
    expect(markup).toContain('stroke="currentColor"')
    expect(markup).toContain(
      'd="M10.831 20.413l-5.375 -6.91c-.608 -.783 -.608 -2.223 0 -3l5.375 -6.911a1.457 1.457 0 0 1 2.338 0l5.375 6.91c.608 .783 .608 2.223 0 3l-5.375 6.911a1.457 1.457 0 0 1 -2.338 0"'
    )
  })

  it('renders the blue filled diamonds icon for a finished milestone', () => {
    const markup = renderToStaticMarkup(
      createElement(MilestoneCompletenessIcon, { status: 'complete', size: 24 })
    )

    expect(markup).toContain(
      'class="tabler-icon tabler-icon-diamonds-filled shrink-0 text-milestone-complete"'
    )
    expect(markup).toContain('data-milestone-status="complete"')
    expect(markup).toContain('data-completed="true"')
    expect(markup).toContain('fill="currentColor"')
    expect(markup).toContain(
      'd="M12 2.005c-.777 0 -1.508 .367 -1.971 .99l-5.362 6.895c-.89 1.136 -.89 3.083 0 4.227l5.375 6.911a2.457 2.457 0 0 0 3.93 -.017l5.361 -6.894c.89 -1.136 .89 -3.083 0 -4.227l-5.375 -6.911a2.446 2.446 0 0 0 -1.958 -.974z"'
    )
  })

  it('renders the grey outline diamonds icon for an unreached milestone', () => {
    const markup = renderToStaticMarkup(
      createElement(MilestoneCompletenessIcon, { status: 'unreached', size: 24 })
    )

    expect(markup).toContain(
      'class="tabler-icon tabler-icon-diamonds shrink-0 text-milestone-unreached"'
    )
    expect(markup).toContain('data-milestone-status="unreached"')
    expect(markup).toContain('data-completed="false"')
    expect(markup).toContain('fill="none"')
  })
})
