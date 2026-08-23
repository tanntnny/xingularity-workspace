import * as React from 'react'

import { cn } from '../../lib/utils'

export type InputVariant = 'default' | 'ghost' | 'plain'

export interface InputProps extends React.ComponentProps<'input'> {
  variant?: InputVariant
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = 'default', ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:outline-none focus-visible:ring-[4px] focus-visible:ring-border disabled:cursor-not-allowed disabled:opacity-50',
          variant === 'ghost' &&
            'border-0 bg-transparent px-0 shadow-none hover:bg-muted/60 focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
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
