import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../lib/utils'

const buttonGroupVariants = cva('inline-flex items-center', {
  variants: {
    variant: {
      default: 'gap-0.5 rounded-md bg-muted p-1',
      outline: 'gap-0.5 rounded-md border bg-background p-1',
      ghost: 'gap-1'
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
  'inline-flex items-center gap-0 overflow-hidden rounded-md border bg-background [&>*]:h-full [&>*:not(:first-child)]:border-l',
  {
    variants: {
      size: {
        default: 'h-8',
        sm: 'h-7',
        lg: 'h-9'
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
