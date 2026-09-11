import * as React from 'react'

import { cn } from '../../lib/utils'

export type InputVariant = 'default' | 'ghost' | 'plain'
export type InputRadius = 'default' | 'control' | 'pill'

export interface InputProps extends React.ComponentProps<'input'> {
  variant?: InputVariant
  radius?: InputRadius
  focusRadius?: InputRadius
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = 'default', radius = 'default', focusRadius, ...props }, ref) => {
    const radiusClassName = {
      default: 'rounded-md',
      control: 'rounded-[var(--radius-button)]',
      pill: 'rounded-[var(--radius-button-pill)]'
    }[radius]
    const focusRadiusClassName = focusRadius
      ? {
          default: 'focus-visible:rounded-md',
          control: 'focus-visible:rounded-[var(--radius-button)]',
          pill: 'focus-visible:rounded-[var(--radius-button-pill)]'
        }[focusRadius]
      : undefined

    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full min-w-0 border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-[color,box-shadow] outline-none selection:bg-selection selection:text-selection-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20',
          radiusClassName,
          focusRadiusClassName,
          variant === 'ghost' &&
            'border-0 bg-transparent px-0 shadow-none hover:bg-muted/60 focus-visible:border-transparent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-offset-0',
          variant === 'plain' &&
            'border-0 bg-transparent px-0 shadow-none hover:bg-transparent focus-visible:border-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
