import * as React from 'react'
import * as DrawerPrimitive from '@radix-ui/react-dialog'

import { cn } from '../lib/utils'

const Drawer = DrawerPrimitive.Root

const DrawerTrigger = DrawerPrimitive.Trigger

const DrawerPortal = DrawerPrimitive.Portal

const DrawerClose = DrawerPrimitive.Close

const DrawerOverlay = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn('drawer-glass-overlay fixed inset-0 z-50', className)}
    {...props}
  />
))
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName

type DrawerContentProps = React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
  side?: 'left' | 'right' | 'top' | 'bottom'
}

const DrawerContent = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Content>,
  DrawerContentProps
>(({ className, children, side = 'right', style, ...props }, ref) => {
  const sideClasses: Record<NonNullable<DrawerContentProps['side']>, string> = {
    right: 'drawer-glass-content-right inset-y-0 right-0 h-full w-full border-l',
    left: 'drawer-glass-content-left inset-y-0 left-0 h-full w-full border-r',
    top: 'drawer-glass-content-top inset-x-0 top-0 w-full max-h-[90vh] border-b',
    bottom: 'drawer-glass-content-bottom inset-x-0 bottom-0 w-full max-h-[90vh] border-t'
  }

  const dimensionStyle: React.CSSProperties =
    side === 'left' || side === 'right' ? { width: 'min(var(--drawer-width, 640px), 100vw)' } : {}

  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        ref={ref}
        className={cn(
          'drawer-glass-content fixed z-50 flex flex-col overflow-hidden border-[var(--line-strong)] transform-gpu',
          sideClasses[side],
          className
        )}
        style={{ ...dimensionStyle, ...style }}
        {...props}
      >
        <div className="flex h-full min-h-0 flex-col">{children}</div>
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
})
DrawerContent.displayName = DrawerPrimitive.Content.displayName

const DrawerHeader = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement => (
  <div className={cn('px-6 py-5 text-left', className)} {...props}>
    <div className="min-w-0 space-y-1.5">{children}</div>
  </div>
)
DrawerHeader.displayName = 'DrawerHeader'

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement => (
  <div className={cn('flex items-center gap-3 px-6 py-5', className)} {...props} />
)
DrawerFooter.displayName = 'DrawerFooter'

const DrawerTitle = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn('text-base font-semibold text-[var(--text)]', className)}
    {...props}
  />
))
DrawerTitle.displayName = DrawerPrimitive.Title.displayName

const DrawerDescription = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn('text-sm text-[var(--muted)]', className)}
    {...props}
  />
))
DrawerDescription.displayName = DrawerPrimitive.Description.displayName

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription
}
