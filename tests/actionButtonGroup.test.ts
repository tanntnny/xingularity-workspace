import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ActionButtonGroup, ButtonGroup } from '../src/renderer/src/components/ui/button-group'
import { Button, buttonVariants } from '../src/renderer/src/components/ui/button'
import { Maximize } from '../src/renderer/src/components/ui/icons'
import { Input } from '../src/renderer/src/components/ui/input'
import {
  WorkspaceActionButton,
  WorkspaceHeaderActionGroup,
  WorkspaceHeaderActions
} from '../src/renderer/src/components/ui/document-workspace'
import {
  Dialog,
  DialogActionButton,
  DialogBody,
  DialogCloseAction,
  DialogShell,
  DialogShellFooter,
  DialogShellHeader
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
    expect(buttonVariants({ shape: 'pill' })).toContain('rounded-[var(--radius-button-pill)]')
    expect(buttonVariants({ size: 'icon' })).toContain('ui-compact-control')
    expect(buttonVariants({ size: 'icon' })).toContain('w-[var(--compact-control-height)]')
    expect(buttonVariants({ variant: 'default' })).toContain('hover:bg-primary/90')
    expect(buttonVariants({ variant: 'outline' })).toContain('border-input')
    expect(buttonVariants({ variant: 'outline' })).toContain('hover:bg-muted')
    expect(buttonVariants({ variant: 'secondary' })).toContain('hover:bg-secondary/80')
    expect(buttonVariants({ variant: 'ghost' })).toContain('hover:bg-muted')
    expect(buttonVariants({ variant: 'rowAction' })).toContain('hover:bg-card-hover')
    expect(buttonVariants({ variant: 'rowAction' })).toContain('focus-visible:bg-card-hover')
    expect(buttonVariants({ variant: 'accent' })).toContain('hover:bg-accent-hover')
    expect(buttonVariants({ variant: 'outline' })).not.toContain('bg-accent')
    expect(buttonVariants({ variant: 'ghost' })).not.toContain('bg-accent')
    expect(buttonVariants({ variant: 'link' })).toContain('hover:underline')
  })

  it('supports a borderless ghost input variant for inline editing', () => {
    const markup = renderToStaticMarkup(
      createElement(Input, { variant: 'ghost', 'aria-label': 'Task name' })
    )

    expect(markup).toContain('border-0')
    expect(markup).toContain('bg-transparent')
    expect(markup).toContain('shadow-none')
    expect(markup).toContain('aria-label="Task name"')
  })

  it('supports a plain input variant without hover or focus surface changes', () => {
    const markup = renderToStaticMarkup(
      createElement(Input, { variant: 'plain', 'aria-label': 'Task name' })
    )

    expect(markup).toContain('border-0')
    expect(markup).toContain('bg-transparent')
    expect(markup).toContain('hover:bg-transparent')
    expect(markup).toContain('focus-visible:bg-transparent')
    expect(markup).toContain('focus-visible:ring-0')
    expect(markup).not.toContain('hover:bg-muted/60')
  })

  it('uses the outline maximize icon for full-page actions', () => {
    const markup = renderToStaticMarkup(createElement(Maximize, { 'aria-hidden': true }))

    expect(markup).toContain('tabler-icon-maximize')
    expect(markup).toContain('d="M4 8v-2a2 2 0 0 1 2 -2h2"')
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
    expect(markup).toContain('ui-compact-control')
    expect(markup).toContain('ui-control')
    expect(markup).toContain('Current month')
  })

  it('supports an opt-in glow when a grouped control receives focus', () => {
    const markup = renderToStaticMarkup(
      createElement(ActionButtonGroup, { focusWithin: 'glow' }, 'Quick capture')
    )

    expect(markup).toContain('focus-within:ring-2')
    expect(markup).toContain('focus-within:ring-ring/40')
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

  it('renders plain primary header actions without resting borders or surfaces', () => {
    const markup = renderToStaticMarkup(
      createElement(
        WorkspaceHeaderActions,
        { appearance: 'plain' },
        createElement(
          WorkspaceHeaderActionGroup,
          null,
          createElement(WorkspaceActionButton, {
            icon: 'Copy',
            label: 'Copy',
            bordered: true,
            'aria-label': 'Copy'
          })
        )
      )
    )

    expect(markup).toContain('data-workspace-header-appearance="plain"')
    expect(markup).toContain('border-0')
    expect(markup).toContain('bg-transparent')
    expect(markup).toContain('hover:bg-muted')
    expect(markup).not.toContain('border border-input')
    expect(markup).not.toContain('border bg-card')
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
    expect(markup).toContain('border-t border-border pt-3')
    expect(markup.indexOf('aria-label="Close"')).toBeLessThan(markup.indexOf('aria-label="Done"'))
    expect(markup).toContain('rounded-[var(--radius-button-pill)]')
  })

  it('supports action-only dialog footers', () => {
    const markup = renderToStaticMarkup(
      createElement(
        DialogShellFooter,
        null,
        createElement(DialogActionButton, {
          icon: 'Done',
          tone: 'primary',
          'aria-label': 'Done'
        })
      )
    )

    expect(markup).toContain('data-dialog-footer')
    expect(markup).toContain('aria-label="Done"')
    expect(markup).not.toContain('aria-label="Close"')
  })

  it('renders the shared dialog header and divided footer regions by default', () => {
    const headerMarkup = renderToStaticMarkup(
      createElement(
        Dialog,
        null,
        createElement(DialogShellHeader, {
          context: 'Task',
          title: 'Example task',
          closeLabel: 'Close dialog',
          closeTestId: 'dialog-close',
          onClose: () => undefined,
          actions: createElement('span', { 'data-testid': 'header-action' }, 'Action')
        })
      )
    )
    const footerMarkup = renderToStaticMarkup(
      createElement(
        DialogShellFooter,
        {
          leadingAction: createElement(DialogActionButton, {
            icon: 'Delete',
            'aria-label': 'Delete'
          })
        },
        createElement(DialogActionButton, {
          icon: 'Done',
          label: 'Done',
          tone: 'accent'
        })
      )
    )

    expect(headerMarkup).toContain('>Task</span>')
    expect(headerMarkup).toContain('>Example task</span>')
    expect(headerMarkup).toContain('data-testid="header-action"')
    expect(headerMarkup).toContain('data-testid="dialog-close"')
    expect(headerMarkup).toContain('border-b border-border pb-3')
    expect(headerMarkup.indexOf('data-testid="header-action"')).toBeLessThan(
      headerMarkup.indexOf('data-testid="dialog-close"')
    )
    expect(footerMarkup).toContain('border-t border-border pt-3')
    expect(footerMarkup).toContain('aria-label="Delete"')
    expect(footerMarkup).toContain('>Done</span>')
    expect(footerMarkup).toContain('bg-accent')
  })

  it('renders a labeled accent dialog action', () => {
    const markup = renderToStaticMarkup(
      createElement(DialogActionButton, {
        icon: 'Done',
        label: 'Save changes',
        tone: 'accent',
        'aria-label': 'Save changes'
      })
    )

    expect(markup).toContain('>Save changes</span>')
    expect(markup).toContain('bg-accent')
    expect(markup).toContain('text-accent-foreground')
    expect(markup).toContain('rounded-[var(--radius-button-pill)]')
  })
})
