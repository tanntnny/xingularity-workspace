import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/utils'
import { Separator } from './separator'

const buttonGroupVariants = cva('ui-control inline-flex items-center [&>button]:px-2', {
  variants: {
    variant: {
      default: 'gap-0.5 rounded-[var(--radius-button)] bg-muted',
      outline: 'gap-0.5 rounded-[var(--radius-button)] border border-border bg-card',
      ghost: 'gap-1 rounded-[var(--radius-button)] bg-transparent'
    },
    size: {
      default: '',
      sm: '',
      lg: ''
    }
  },
  defaultVariants: {
    variant: 'default',
    size: 'default'
  }
})

const actionButtonGroupVariants = cva(
  'ui-control inline-flex items-center gap-0 overflow-hidden rounded-[var(--radius-button)] border bg-card [&>*:not([data-slot=separator])]:h-full [&>button]:!rounded-none [&>button]:!border-0',
  {
    variants: {
      focusWithin: {
        none: '',
        glow: 'transition-[box-shadow,border-color] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40 focus-within:ring-offset-2 focus-within:ring-offset-background'
      },
      size: {
        default: '',
        sm: '',
        lg: ''
      }
    },
    defaultVariants: {
      focusWithin: 'none',
      size: 'default'
    }
  }
)

export interface ButtonGroupProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof buttonGroupVariants> {}

const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ className, variant, size, children, ...props }, ref) => (
    <div
      ref={ref}
      role="group"
      className={cn(buttonGroupVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </div>
  )
)
ButtonGroup.displayName = 'ButtonGroup'

export interface ActionButtonGroupProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof actionButtonGroupVariants> {
  dividers?: boolean
}

const ActionButtonGroup = React.forwardRef<HTMLDivElement, ActionButtonGroupProps>(
  ({ className, focusWithin, size, dividers = true, children, ...props }, ref) => {
    const groupChildren = React.Children.toArray(children)

    return (
      <div
        ref={ref}
        role="group"
        className={cn(actionButtonGroupVariants({ focusWithin, size }), className)}
        {...props}
      >
        {dividers
          ? groupChildren.flatMap((child, index) => [
              ...(index > 0
                ? [
                    <Separator
                      key={`action-button-group-separator-${index}`}
                      orientation="vertical"
                      className="h-[var(--compact-control-height)]"
                    />
                  ]
                : []),
              child
            ])
          : children}
      </div>
    )
  }
)
ActionButtonGroup.displayName = 'ActionButtonGroup'

export { ActionButtonGroup, ButtonGroup }
