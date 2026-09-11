import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/utils'
import { getButtonTooltipLabel, TooltipButton } from './tooltip'
import { WorkspaceTextFadeContent } from './workspace-text-fade'

const rowActionButtonClassName =
  'bg-transparent text-muted-foreground hover:bg-card-hover hover:text-foreground focus-visible:bg-card-hover focus-visible:text-foreground'

const buttonVariants = cva(
  'ui-control inline-flex min-w-0 max-w-full items-center justify-center gap-2 overflow-hidden whitespace-nowrap bg-card px-[var(--control-padding-x)] font-medium text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-[var(--control-icon-size)] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
        accent:
          'bg-accent text-accent-foreground hover:bg-accent-hover hover:text-accent-foreground',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground',
        outline: 'border border-input bg-card hover:bg-muted hover:text-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:
          'bg-transparent hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground',
        muted:
          'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground',
        rowAction: rowActionButtonClassName,
        link: 'bg-transparent px-0 text-primary hover:bg-transparent hover:text-primary hover:underline'
      },
      size: {
        default: '',
        sm: 'px-3',
        lg: 'px-4',
        icon: 'ui-compact-control w-[var(--compact-control-height)] px-0'
      },
      shape: {
        default: 'rounded-[var(--radius-button)]',
        pill: 'rounded-[var(--radius-button-pill)]'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      shape: 'default'
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  tooltip?: string
  tooltipWrapperClassName?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      shape,
      asChild = false,
      tooltip,
      tooltipWrapperClassName,
      title,
      'aria-label': ariaLabel,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button'
    const resolvedTooltip = getButtonTooltipLabel(tooltip, ariaLabel, title, children)
    const button = (
      <Comp
        className={cn(buttonVariants({ variant, size, shape, className }))}
        ref={ref}
        aria-label={ariaLabel}
        title={title}
        {...props}
      >
        <WorkspaceTextFadeContent className="min-w-0">{children}</WorkspaceTextFadeContent>
      </Comp>
    )

    return resolvedTooltip ? (
      <TooltipButton
        label={resolvedTooltip}
        disabled={props.disabled}
        wrapperClassName={tooltipWrapperClassName}
      >
        {button}
      </TooltipButton>
    ) : (
      button
    )
  }
)
Button.displayName = 'Button'

// buttonVariants is intentionally exported for composed controls such as the calendar.
// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants, rowActionButtonClassName }
