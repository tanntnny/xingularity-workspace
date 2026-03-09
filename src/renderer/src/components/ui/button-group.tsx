import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/utils'

const buttonGroupVariants = cva('inline-flex items-center', {
  variants: {
    variant: {
      default: 'rounded-lg bg-[var(--panel-2)] p-1 gap-0.5',
      outline: 'rounded-lg border border-[var(--line)] p-1 gap-0.5',
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

const buttonGroupItemVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'rounded-md text-[var(--muted)] hover:text-[var(--text)] data-[active=true]:bg-[var(--panel)] data-[active=true]:text-[var(--text)] data-[active=true]:shadow-sm',
        outline:
          'rounded-md text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-2)] data-[active=true]:bg-[var(--accent-soft)] data-[active=true]:text-[var(--text)] data-[active=true]:shadow-sm',
        ghost:
          'rounded-lg border border-transparent text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-2)] data-[active=true]:border-[var(--accent-line)] data-[active=true]:bg-[var(--accent-soft)] data-[active=true]:text-[var(--text)]'
      },
      size: {
        default: 'h-8 px-3 text-sm',
        sm: 'h-7 px-2.5 text-xs',
        lg: 'h-9 px-4 text-sm'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

interface ButtonGroupContextValue extends VariantProps<typeof buttonGroupItemVariants> {
  value?: string
  onValueChange?: (value: string) => void
}

const ButtonGroupContext = React.createContext<ButtonGroupContextValue>({
  variant: 'default',
  size: 'default'
})

export interface ButtonGroupProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof buttonGroupVariants> {
  value?: string
  onValueChange?: (value: string) => void
}

const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ className, variant, size, value, onValueChange, children, ...props }, ref) => (
    <div
      ref={ref}
      role="group"
      className={cn(buttonGroupVariants({ variant, size }), className)}
      {...props}
    >
      <ButtonGroupContext.Provider value={{ variant, size, value, onValueChange }}>
        {children}
      </ButtonGroupContext.Provider>
    </div>
  )
)
ButtonGroup.displayName = 'ButtonGroup'

export interface ButtonGroupItemProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonGroupItemVariants> {
  value: string
}

const ButtonGroupItem = React.forwardRef<HTMLButtonElement, ButtonGroupItemProps>(
  ({ className, variant, size, value, children, onClick, ...props }, ref) => {
    const context = React.useContext(ButtonGroupContext)
    const isActive = context.value === value

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      context.onValueChange?.(value)
      onClick?.(e)
    }

    return (
      <button
        ref={ref}
        type="button"
        role="radio"
        aria-checked={isActive}
        data-active={isActive}
        className={cn(
          buttonGroupItemVariants({
            variant: variant ?? context.variant,
            size: size ?? context.size
          }),
          className
        )}
        onClick={handleClick}
        {...props}
      >
        {children}
      </button>
    )
  }
)
ButtonGroupItem.displayName = 'ButtonGroupItem'

export { ButtonGroup, ButtonGroupItem, buttonGroupVariants, buttonGroupItemVariants }
