import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ActionButtonGroup, ButtonGroup } from '../src/renderer/src/components/ui/button-group'
import { Button, buttonVariants } from '../src/renderer/src/components/ui/button'
import {
  WorkspaceActionButton,
  WorkspaceHeaderActionGroup
} from '../src/renderer/src/components/ui/document-workspace'
import {
  Dialog,
  DialogActionButton,
  DialogBody,
  DialogCloseAction,
  DialogShell,
  DialogShellFooter
} from '../src/renderer/src/components/ui/dialog'

describe('ActionButtonGroup', () => {
  it('adds compact horizontal padding to ButtonGroup child buttons', () => {
    const markup = renderToStaticMarkup(
      createElement(
        ButtonGroup,
        { variant: 'outline' },
        createElement(Button, null, 'Previous'),
        createElement(Button, null, 'Today')
      )
    )

    expect(markup).toContain('[&amp;&gt;button]:px-2')
    expect(markup).toContain('>Previous</button>')
  })

  it('keeps semantic hover feedback across button variants', () => {
    expect(buttonVariants()).toContain('rounded-[var(--radius-button)]')
    expect(buttonVariants({ variant: 'default' })).toContain('hover:bg-primary/90')
    expect(buttonVariants({ variant: 'outline' })).toContain('hover:bg-accent')
    expect(buttonVariants({ variant: 'secondary' })).toContain('hover:bg-secondary/80')
    expect(buttonVariants({ variant: 'ghost' })).toContain('hover:bg-accent')
    expect(buttonVariants({ variant: 'link' })).toContain('hover:underline')
  })

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
    expect(markup).toContain('role="group"')
    expect(markup).toContain('rounded-[var(--radius-button)]')
    expect(markup).toContain('rounded-[var(--radius-button-pill)]')
    expect(markup).toContain('ui-control')
    expect(markup).toContain('Current month')
  })

  it('uses the pill radius for workspace header action groups', () => {
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

    expect(markup).toContain('role="group"')
    expect(markup).toContain('ui-control')
    expect(markup).toContain('rounded-[var(--radius-button-pill)]')
  })

  it('uses the shared shell regions and pill radius for centered dialog actions', () => {
    const markup = renderToStaticMarkup(
      createElement(
        Dialog,
        null,
        createElement(
          DialogShell,
          null,
          createElement(DialogBody, null, 'Body'),
          createElement(
            DialogShellFooter,
            { closeAction: createElement(DialogCloseAction, { label: 'Close' }) },
            createElement(DialogActionButton, {
              icon: 'Done',
              tone: 'primary',
              'aria-label': 'Done'
            })
          )
        )
      )
    )

    expect(markup).toContain('data-dialog-body')
    expect(markup).toContain('--radius-control:var(--radius-button)')
    expect(markup.indexOf('aria-label="Close"')).toBeLessThan(markup.indexOf('aria-label="Done"'))
    expect(markup).toContain('rounded-[var(--radius-button-pill)]')
  })
})
