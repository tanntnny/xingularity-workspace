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
      size: {
        default: '',
        sm: '',
        lg: ''
      }
    },
    defaultVariants: {
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
  ({ className, size, ...props }, ref) => (
    <div
      ref={ref}
      role="group"
      className={cn(actionButtonGroupVariants({ size }), className)}
      {...props}
    />
  )
)
ActionButtonGroup.displayName = 'ActionButtonGroup'

export { ActionButtonGroup, ButtonGroup }
