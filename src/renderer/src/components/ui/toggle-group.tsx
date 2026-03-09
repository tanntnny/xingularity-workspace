import * as React from 'react'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/utils'

const toggleGroupVariants = cva('flex items-center justify-center gap-1', {
  variants: {
    variant: {
      default: 'rounded-lg bg-[var(--muted-color)] p-1',
      outline: 'border border-[var(--border)] rounded-lg',
      pill: 'flex-wrap gap-1.5'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
})

const toggleGroupItemVariants = cva(
  'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'text-[var(--muted-foreground)] data-[state=on]:bg-[var(--background)] data-[state=on]:text-[var(--foreground)] data-[state=on]:shadow-sm hover:text-[var(--foreground)]',
        outline:
          'border border-transparent text-[var(--muted-foreground)] data-[state=on]:border-[var(--accent-line)] data-[state=on]:bg-[var(--accent-soft)] data-[state=on]:text-[var(--foreground)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]',
        pill: 'rounded-full border border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--accent)] data-[state=on]:border-[var(--accent-line)] data-[state=on]:bg-[var(--accent-soft)] data-[state=on]:text-[var(--text)]'
      },
      size: {
        default: 'h-9 px-3',
        sm: 'h-8 px-2 text-xs',
        lg: 'h-10 px-4',
        xs: 'px-2.5 py-1 text-xs'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

const ToggleGroupContext = React.createContext<VariantProps<typeof toggleGroupItemVariants>>({
  variant: 'default',
  size: 'default'
})

const ToggleGroup = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
    VariantProps<typeof toggleGroupVariants> &
    VariantProps<typeof toggleGroupItemVariants>
>(({ className, variant, size, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn(toggleGroupVariants({ variant }), className)}
    {...props}
  >
    <ToggleGroupContext.Provider value={{ variant, size }}>{children}</ToggleGroupContext.Provider>
  </ToggleGroupPrimitive.Root>
))
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName

const ToggleGroupItem = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
    VariantProps<typeof toggleGroupItemVariants>
>(({ className, children, variant, size, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext)

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleGroupItemVariants({
          variant: variant ?? context.variant,
          size: size ?? context.size
        }),
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
})
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName

export { ToggleGroup, ToggleGroupItem }
