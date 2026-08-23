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

const toggleGroupIndicatorVariants = cva(
  'pointer-events-none absolute left-0 top-0 z-0 rounded-[inherit] opacity-0 transition-[transform,width,height,opacity] duration-200 ease-out motion-reduce:transition-none',
  {
    variants: {
      variant: {
        default: 'bg-card shadow-sm',
        outline: 'border border-input bg-muted'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

const toggleGroupItemVariants = cva(
  'ui-control relative z-10 inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-[var(--radius-button)] px-3 font-medium text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none [&_svg]:size-[var(--control-icon-size)]',
  {
    variants: {
      variant: {
        default: 'hover:bg-muted hover:text-foreground',
        outline:
          'border border-transparent hover:bg-muted hover:text-foreground data-[state=on]:text-foreground'
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

type ToggleGroupType = 'single' | 'multiple'

type ToggleGroupContextValue = VariantProps<typeof toggleGroupItemVariants> & {
  type: ToggleGroupType
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({
  variant: 'default',
  size: 'default',
  type: 'single'
})

type ToggleGroupRootElement = React.ComponentRef<typeof ToggleGroupPrimitive.Root>

type ToggleGroupIndicatorBounds = {
  x: number
  y: number
  width: number
  height: number
  borderRadius: string
}

function setForwardedRef<T>(ref: React.ForwardedRef<T>, value: T | null): void {
  if (typeof ref === 'function') {
    ref(value)
  } else if (ref) {
    ref.current = value
  }
}

function getToggleGroupIndicatorTarget(root: HTMLElement): HTMLElement | null {
  const activeItem = root.querySelector<HTMLElement>('[data-state="on"]')
  if (!activeItem) {
    return null
  }

  return activeItem.closest<HTMLElement>('[data-toggle-group-indicator-target]') ?? activeItem
}

interface ToggleGroupSelectionIndicatorProps {
  rootRef: React.RefObject<ToggleGroupRootElement | null>
  variant: VariantProps<typeof toggleGroupVariants>['variant']
  animated: boolean
}

function ToggleGroupSelectionIndicator({
  rootRef,
  variant,
  animated
}: ToggleGroupSelectionIndicatorProps): React.ReactElement {
  const [bounds, setBounds] = React.useState<ToggleGroupIndicatorBounds | null>(null)

  React.useEffect(() => {
    const root = rootRef.current
    if (!root || typeof window === 'undefined') {
      return
    }

    let frame: number | null = null

    const measure = (): void => {
      frame = null
      const target = getToggleGroupIndicatorTarget(root)
      if (!target) {
        setBounds(null)
        return
      }

      const rootBounds = root.getBoundingClientRect()
      const targetBounds = target.getBoundingClientRect()
      if (targetBounds.width <= 0 || targetBounds.height <= 0) {
        setBounds(null)
        return
      }

      setBounds({
        x: targetBounds.left - rootBounds.left,
        y: targetBounds.top - rootBounds.top,
        width: targetBounds.width,
        height: targetBounds.height,
        borderRadius: window.getComputedStyle(target).borderRadius
      })
    }

    const scheduleMeasure = (): void => {
      if (frame !== null) {
        return
      }

      frame = window.requestAnimationFrame(measure)
    }

    const mutationObserver =
      typeof MutationObserver === 'undefined' ? null : new MutationObserver(scheduleMeasure)
    mutationObserver?.observe(root, {
      attributes: true,
      attributeFilter: ['data-state'],
      childList: true,
      subtree: true
    })

    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure)
    resizeObserver?.observe(root)
    root.querySelectorAll<HTMLElement>('[data-state]').forEach((element) => {
      resizeObserver?.observe(element)
    })
    const target = getToggleGroupIndicatorTarget(root)
    if (target) {
      resizeObserver?.observe(target)
    }

    window.addEventListener('resize', scheduleMeasure)
    scheduleMeasure()

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame)
      }
      mutationObserver?.disconnect()
      resizeObserver?.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
    }
  }, [rootRef])

  return (
    <span
      aria-hidden="true"
      data-toggle-group-indicator="true"
      className={cn(
        toggleGroupIndicatorVariants({ variant }),
        !animated && 'transition-none',
        bounds && 'opacity-100'
      )}
      style={{
        width: bounds?.width ?? 0,
        height: bounds?.height ?? 0,
        transform: `translate3d(${bounds?.x ?? 0}px, ${bounds?.y ?? 0}px, 0)`,
        borderRadius: bounds?.borderRadius ?? 'inherit'
      }}
    />
  )
}

const ToggleGroup = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
    VariantProps<typeof toggleGroupVariants> &
    VariantProps<typeof toggleGroupItemVariants> & {
      selectionIndicatorAnimated?: boolean
    }
>(({ className, variant, size, children, selectionIndicatorAnimated = true, ...props }, ref) => {
  const type = props.type
  const rootRef = React.useRef<ToggleGroupRootElement | null>(null)
  const setRootRef = React.useCallback(
    (node: ToggleGroupRootElement | null): void => {
      rootRef.current = node
      setForwardedRef(ref, node)
    },
    [ref]
  )

  return (
    <ToggleGroupPrimitive.Root
      ref={setRootRef}
      className={cn('relative', toggleGroupVariants({ variant }), className)}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size, type }}>
        {children}
        {type === 'single' ? (
          <ToggleGroupSelectionIndicator
            rootRef={rootRef}
            variant={variant}
            animated={selectionIndicatorAnimated}
          />
        ) : null}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  )
})
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName

const ToggleGroupItem = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
    VariantProps<typeof toggleGroupItemVariants>
>(({ className, children, variant, size, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext)
  const itemVariant = variant ?? context.variant
  const activeStateClass =
    context.type === 'multiple'
      ? itemVariant === 'outline'
        ? 'data-[state=on]:border-input data-[state=on]:bg-muted'
        : 'data-[state=on]:bg-card data-[state=on]:shadow-sm'
      : 'data-[state=on]:border-transparent data-[state=on]:bg-transparent data-[state=on]:hover:bg-transparent data-[state=on]:shadow-none'

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleGroupItemVariants({
          variant: itemVariant,
          size: size ?? context.size
        }),
        activeStateClass,
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
