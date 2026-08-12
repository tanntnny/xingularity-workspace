import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/utils'

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
  'ui-control inline-flex items-center gap-0 overflow-hidden rounded-[var(--radius-button)] border bg-card [&>*]:h-full [&>*:not(:first-child)]:border-l',
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
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof actionButtonGroupVariants> {}

const ActionButtonGroup = React.forwardRef<HTMLDivElement, ActionButtonGroupProps>(
  ({ className, focusWithin, size, ...props }, ref) => (
    <div
      ref={ref}
      role="group"
      className={cn(actionButtonGroupVariants({ focusWithin, size }), className)}
      {...props}
    />
  )
)
ActionButtonGroup.displayName = 'ActionButtonGroup'

export { ActionButtonGroup, ButtonGroup }
