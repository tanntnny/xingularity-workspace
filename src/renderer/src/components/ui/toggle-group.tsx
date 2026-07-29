import * as React from 'react'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/utils'

const toggleGroupVariants = cva('ui-control flex items-center justify-center gap-1', {
  variants: {
    variant: {
      default: 'rounded-[var(--radius-button)] bg-muted',
      outline: 'rounded-[var(--radius-button)] border border-input bg-card'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
})

const toggleGroupItemVariants = cva(
  'ui-control inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-[var(--radius-button)] px-3 font-medium text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[var(--control-icon-size)]',
  {
    variants: {
      variant: {
        default:
          'hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm',
        outline:
          'border border-transparent hover:bg-accent hover:text-accent-foreground data-[state=on]:border-input data-[state=on]:bg-accent data-[state=on]:text-accent-foreground'
      },
      size: {
        default: '',
        sm: 'px-2',
        lg: 'px-4'
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
