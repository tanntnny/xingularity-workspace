import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ActionButtonGroup } from '../src/renderer/src/components/ui/button-group'
import {
  WorkspaceActionButton,
  WorkspaceHeaderActionGroup
} from '../src/renderer/src/components/ui/document-workspace'

describe('ActionButtonGroup', () => {
  it('renders a compact, labelled group for segmented toolbar actions', () => {
    const markup = renderToStaticMarkup(
      createElement(
        ActionButtonGroup,
        { size: 'sm', 'aria-label': 'Calendar period navigation' },
        createElement(WorkspaceActionButton, {
          icon: 'Previous',
          'aria-label': 'Previous month'
        }),
        createElement(WorkspaceActionButton, {
          icon: 'Current',
          label: 'Current month'
        }),
        createElement(WorkspaceActionButton, {
          icon: 'Next',
          'aria-label': 'Next month'
        })
      )
    )

    expect(markup).toContain('aria-label="Calendar period navigation"')
    expect(markup).toContain('workspace-action-button-group')
    expect(markup).toContain('h-7')
    expect(markup).toContain('Current month')
  })

  it('is used by workspace header action groups', () => {
    const markup = renderToStaticMarkup(
      createElement(
        WorkspaceHeaderActionGroup,
        null,
        createElement(WorkspaceActionButton, {
          icon: 'Copy',
          'aria-label': 'Copy'
        }),
        createElement(WorkspaceActionButton, {
          icon: 'Export',
          'aria-label': 'Export'
        })
      )
    )

    expect(markup).toContain('workspace-action-button-group')
    expect(markup).toContain('h-8')
  })
})
