'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { PanelLeft } from './icons'

import { cn } from '../../lib/utils'
import { Button } from './button'
import { Input } from './input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'

const SIDEBAR_COOKIE_NAME = 'sidebar_state'
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH_MOBILE = '18rem'
const SIDEBAR_WIDTH_ICON = '3rem'
const SIDEBAR_DEFAULT_WIDTH = 256
const SIDEBAR_MIN_WIDTH = 220
const SIDEBAR_MAX_WIDTH = 360
const SIDEBAR_WIDTH_STORAGE_KEY = 'sidebar_width'
const SIDEBAR_RESIZE_STEP = 16

type SidebarContext = {
  state: 'expanded' | 'collapsed'
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
  sidebarWidth: number
  setSidebarWidth: (width: number | ((width: number) => number)) => void
  minSidebarWidth: number
  maxSidebarWidth: number
  isResizing: boolean
  setIsResizing: (isResizing: boolean) => void
}

const SidebarContext = React.createContext<SidebarContext | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider.')
  }

  return context
}

// Simple mobile detection hook
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)')
    const onChange = () => {
      setIsMobile(mql.matches)
    }
    mql.addEventListener('change', onChange)
    setIsMobile(mql.matches)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}

function clampSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) {
    return SIDEBAR_DEFAULT_WIDTH
  }

  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)))
}

function getStoredSidebarWidth(): number {
  if (typeof window === 'undefined') {
    return SIDEBAR_DEFAULT_WIDTH
  }

  try {
    const storedValue = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)
    if (storedValue === null) {
      return SIDEBAR_DEFAULT_WIDTH
    }

    const storedWidth = Number(storedValue)
    return clampSidebarWidth(storedWidth)
  } catch {
    return SIDEBAR_DEFAULT_WIDTH
  }
}

const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    defaultOpen?: boolean
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }
>(
  (
    {
      defaultOpen = true,
      open: openProp,
      onOpenChange: setOpenProp,
      className,
      style,
      children,
      ...props
    },
    ref
  ) => {
    const isMobile = useIsMobile()
    const [openMobile, setOpenMobile] = React.useState(false)
    const [sidebarWidth, _setSidebarWidth] = React.useState(getStoredSidebarWidth)
    const [isResizing, setIsResizing] = React.useState(false)

    // This is the internal state of the sidebar.
    // We use openProp and setOpenProp for control from outside the component.
    const [_open, _setOpen] = React.useState(defaultOpen)
    const open = openProp ?? _open
    const setOpen = React.useCallback(
      (value: boolean | ((value: boolean) => boolean)) => {
        const openState = typeof value === 'function' ? value(open) : value
        if (setOpenProp) {
          setOpenProp(openState)
        } else {
          _setOpen(openState)
        }

        // This sets the cookie to keep the sidebar state.
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
      },
      [setOpenProp, open]
    )

    // Helper to toggle the sidebar.
    const toggleSidebar = React.useCallback(() => {
      return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open)
    }, [isMobile, setOpen, setOpenMobile])

    const setSidebarWidth = React.useCallback((value: number | ((width: number) => number)) => {
      _setSidebarWidth((currentWidth) => {
        const nextWidth = typeof value === 'function' ? value(currentWidth) : value
        return clampSidebarWidth(nextWidth)
      })
    }, [])

    React.useEffect(() => {
      try {
        window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth))
      } catch {
        // Ignore storage errors. UI should still work with in-memory state.
      }
    }, [sidebarWidth])

    // We add a state so that we can do data-state="expanded" or "collapsed".
    // This makes it easier to style the sidebar with Tailwind classes.
    const state = open ? 'expanded' : 'collapsed'

    const contextValue = React.useMemo<SidebarContext>(
      () => ({
        state,
        open,
        setOpen,
        isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar,
        sidebarWidth,
        setSidebarWidth,
        minSidebarWidth: SIDEBAR_MIN_WIDTH,
        maxSidebarWidth: SIDEBAR_MAX_WIDTH,
        isResizing,
        setIsResizing
      }),
      [
        state,
        open,
        setOpen,
        isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar,
        sidebarWidth,
        setSidebarWidth,
        isResizing
      ]
    )

    return (
      <SidebarContext.Provider value={contextValue}>
        <TooltipProvider delayDuration={0}>
          <div
            style={
              {
                '--sidebar-width': `${sidebarWidth}px`,
                '--sidebar-width-min': `${SIDEBAR_MIN_WIDTH}px`,
                '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
                ...style
              } as React.CSSProperties
            }
            className={cn(
              'group/sidebar-wrapper flex w-full has-[[data-variant=inset]]:bg-sidebar',
              className
            )}
            ref={ref}
            {...props}
          >
            {children}
          </div>
        </TooltipProvider>
      </SidebarContext.Provider>
    )
  }
)
SidebarProvider.displayName = 'SidebarProvider'

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    side?: 'left' | 'right'
    variant?: 'sidebar' | 'floating' | 'inset'
    collapsible?: 'offcanvas' | 'icon' | 'min' | 'none'
  }
>(
  (
    {
      side = 'left',
      variant = 'sidebar',
      collapsible = 'offcanvas',
      className,
      children,
      ...props
    },
    ref
  ) => {
    const { isMobile, state, openMobile, setOpenMobile, isResizing } = useSidebar()

    if (collapsible === 'none') {
      return (
        <div
          className={cn(
            'flex h-full w-[--sidebar-width] flex-col bg-sidebar text-sidebar-foreground',
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </div>
      )
    }

    if (isMobile) {
      return (
        <div
          className={cn(
            'fixed inset-0 z-50 bg-overlay-muted transition-opacity motion-reduce:transition-none',
            openMobile ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
          onClick={() => setOpenMobile(false)}
        >
          <div
            data-sidebar="sidebar"
            data-mobile="true"
            className={cn(
              'fixed inset-y-0 z-50 flex h-full w-[--sidebar-width] flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-linear motion-reduce:transition-none',
              side === 'left'
                ? 'left-0 border-r border-sidebar-border'
                : 'right-0 border-l border-sidebar-border',
              openMobile
                ? 'translate-x-0'
                : side === 'left'
                  ? '-translate-x-full'
                  : 'translate-x-full'
            )}
            style={
              {
                '--sidebar-width': SIDEBAR_WIDTH_MOBILE
              } as React.CSSProperties
            }
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className="group peer hidden md:block text-sidebar-foreground"
        data-state={state}
        data-collapsible={state === 'collapsed' ? collapsible : ''}
        data-variant={variant}
        data-side={side}
      >
        {/* This is what handles the sidebar gap on desktop */}
        <div
          className={cn(
            'relative h-svh w-[--sidebar-width] bg-transparent transition-[width] duration-200 ease-linear motion-reduce:transition-none',
            'group-data-[collapsible=offcanvas]:w-0',
            'group-data-[side=right]:rotate-180',
            variant === 'floating' || variant === 'inset'
              ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4))]'
              : 'group-data-[collapsible=icon]:w-[--sidebar-width-icon]',
            variant === 'floating' || variant === 'inset'
              ? 'group-data-[collapsible=min]:w-[calc(var(--sidebar-width-min)_+_theme(spacing.4))]'
              : 'group-data-[collapsible=min]:w-[--sidebar-width-min]',
            isResizing && 'transition-none'
          )}
        />
        <div
          className={cn(
            'fixed inset-y-0 z-10 hidden h-svh w-[--sidebar-width] transition-[left,right,width] duration-200 ease-linear motion-reduce:transition-none md:flex',
            side === 'left'
              ? 'left-0 group-data-[collapsible=offcanvas]:-translate-x-full'
              : 'right-0 group-data-[collapsible=offcanvas]:translate-x-full',
            'group-data-[collapsible=offcanvas]:pointer-events-none group-data-[collapsible=offcanvas]:opacity-0',
            // Adjust the padding for floating and inset variants.
            variant === 'floating' || variant === 'inset'
              ? 'p-3 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4)_+2px)]'
              : 'group-data-[collapsible=icon]:w-[--sidebar-width-icon]',
            variant === 'floating' || variant === 'inset'
              ? 'group-data-[collapsible=min]:w-[calc(var(--sidebar-width-min)_+_theme(spacing.4)_+2px)]'
              : 'group-data-[collapsible=min]:w-[--sidebar-width-min]',
            isResizing && 'transition-none',
            className
          )}
          {...props}
        >
          <div
            data-sidebar="sidebar"
            className={cn(
              'flex size-full flex-col bg-sidebar group-data-[variant=floating]:rounded-shell group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow'
            )}
          >
            {children}
          </div>
        </div>
      </div>
    )
  }
)
Sidebar.displayName = 'Sidebar'

const SidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      ref={ref}
      data-sidebar="trigger"
      variant="ghost"
      size="icon"
      className={cn('h-7 w-7', className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeft />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
})
SidebarTrigger.displayName = 'SidebarTrigger'

const SidebarRail = React.forwardRef<HTMLButtonElement, React.ComponentProps<'button'>>(
  (
    {
      className,
      onClick,
      onKeyDown,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      ...props
    },
    ref
  ) => {
    const {
      open,
      isMobile,
      sidebarWidth,
      setSidebarWidth,
      minSidebarWidth,
      maxSidebarWidth,
      setOpen,
      setIsResizing,
      isResizing,
      toggleSidebar
    } = useSidebar()
    const resizeStartRef = React.useRef<{
      pointerId: number
      clientX: number
      width: number
      moved: boolean
    } | null>(null)
    const didDragRef = React.useRef(false)

    const getSide = (element: HTMLElement): 'left' | 'right' =>
      element.closest<HTMLElement>('[data-side]')?.dataset.side === 'right' ? 'right' : 'left'

    const finishResize = (
      event: React.PointerEvent<HTMLButtonElement>,
      onFinished?: React.PointerEventHandler<HTMLButtonElement>
    ): void => {
      const resizeStart = resizeStartRef.current
      if (!resizeStart || event.pointerId !== resizeStart.pointerId) {
        onFinished?.(event)
        return
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      resizeStartRef.current = null
      didDragRef.current = resizeStart.moved
      setIsResizing(false)
      onFinished?.(event)
    }

    return (
      <button
        ref={ref}
        type="button"
        data-sidebar="rail"
        data-resize-direction="x"
        data-resizing={isResizing ? 'true' : undefined}
        role="separator"
        aria-label="Resize or toggle Sidebar"
        aria-orientation="vertical"
        aria-valuemin={minSidebarWidth}
        aria-valuemax={maxSidebarWidth}
        aria-valuenow={open ? sidebarWidth : minSidebarWidth}
        tabIndex={0}
        onClick={(event) => {
          onClick?.(event)
          if (event.defaultPrevented) {
            return
          }

          if (didDragRef.current) {
            event.preventDefault()
            didDragRef.current = false
            return
          }

          toggleSidebar()
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (event.defaultPrevented) {
            return
          }

          const side = getSide(event.currentTarget)
          const direction = side === 'right' ? -1 : 1
          const isIncrease = event.key === 'ArrowRight' || event.key === 'ArrowDown'
          const isDecrease = event.key === 'ArrowLeft' || event.key === 'ArrowUp'

          if (event.key === 'Home') {
            event.preventDefault()
            setSidebarWidth(minSidebarWidth)
            setOpen(false)
          } else if (event.key === 'End') {
            event.preventDefault()
            setSidebarWidth(maxSidebarWidth)
            setOpen(true)
          } else if (isIncrease || isDecrease) {
            event.preventDefault()
            const delta = (isIncrease ? 1 : -1) * direction * SIDEBAR_RESIZE_STEP
            const nextWidth = clampSidebarWidth(sidebarWidth + delta)
            setSidebarWidth(nextWidth)
            if (!open && nextWidth > minSidebarWidth) {
              setOpen(true)
            }
          }
        }}
        onPointerDown={(event) => {
          onPointerDown?.(event)
          if (
            event.defaultPrevented ||
            isMobile ||
            !event.isPrimary ||
            event.button !== 0 ||
            event.currentTarget.closest('[data-collapsible="offcanvas"]')
          ) {
            return
          }

          resizeStartRef.current = {
            pointerId: event.pointerId,
            clientX: event.clientX,
            width: open ? sidebarWidth : minSidebarWidth,
            moved: false
          }
          didDragRef.current = false
          event.currentTarget.setPointerCapture(event.pointerId)
          setIsResizing(true)
        }}
        onPointerMove={(event) => {
          onPointerMove?.(event)
          const resizeStart = resizeStartRef.current
          if (!resizeStart || event.pointerId !== resizeStart.pointerId) {
            return
          }

          const side = getSide(event.currentTarget)
          const direction = side === 'right' ? -1 : 1
          const delta = (event.clientX - resizeStart.clientX) * direction
          const nextWidth = clampSidebarWidth(resizeStart.width + delta)
          if (Math.abs(delta) > 2) {
            resizeStart.moved = true
          }
          setSidebarWidth(nextWidth)
          if (!open && nextWidth > minSidebarWidth) {
            setOpen(true)
          }
        }}
        onPointerUp={(event) => finishResize(event, onPointerUp)}
        onPointerCancel={(event) => finishResize(event, onPointerCancel)}
        className={cn(
          'resize-affordance absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 rounded-none border-0 bg-transparent p-0 transition-all duration-200 ease-linear motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[side=left]:-right-4 group-data-[side=right]:left-0 sm:flex',
          '[[data-side=left]_&]:cursor-ew-resize [[data-side=right]_&]:cursor-ew-resize',
          'group-data-[collapsible=offcanvas]:pointer-events-none group-data-[collapsible=offcanvas]:opacity-0',
          '[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
          '[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
          className
        )}
        {...props}
      />
    )
  }
)
SidebarRail.displayName = 'SidebarRail'

const SidebarInset = React.forwardRef<HTMLDivElement, React.ComponentProps<'main'>>(
  ({ className, ...props }, ref) => {
    return (
      <main
        ref={ref}
        className={cn(
          'relative flex min-h-svh flex-1 flex-col bg-sidebar',
          'peer-data-[variant=inset]:min-h-[calc(100svh-theme(spacing.4))] md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-shell md:peer-data-[variant=inset]:shadow',
          className
        )}
        {...props}
      />
    )
  }
)
SidebarInset.displayName = 'SidebarInset'

const SidebarInput = React.forwardRef<
  React.ElementRef<typeof Input>,
  React.ComponentProps<typeof Input>
>(({ className, ...props }, ref) => {
  return (
    <Input
      ref={ref}
      data-sidebar="input"
      className={cn(
        'h-8 w-full bg-sidebar-accent shadow-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        className
      )}
      {...props}
    />
  )
})
SidebarInput.displayName = 'SidebarInput'

const SidebarHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-sidebar="header"
        className={cn('flex flex-col gap-2 p-3', className)}
        {...props}
      />
    )
  }
)
SidebarHeader.displayName = 'SidebarHeader'

const SidebarFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-sidebar="footer"
        className={cn('flex flex-col gap-2 p-3', className)}
        {...props}
      />
    )
  }
)
SidebarFooter.displayName = 'SidebarFooter'

const SidebarSeparator = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-sidebar="separator"
        className={cn('mx-2 h-[var(--border-width)] w-auto bg-sidebar-border', className)}
        {...props}
      />
    )
  }
)
SidebarSeparator.displayName = 'SidebarSeparator'

const SidebarContent = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-sidebar="content"
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden',
          className
        )}
        {...props}
      />
    )
  }
)
SidebarContent.displayName = 'SidebarContent'

const SidebarGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-sidebar="group"
        className={cn('relative flex w-full min-w-0 flex-col p-1', className)}
        {...props}
      />
    )
  }
)
SidebarGroup.displayName = 'SidebarGroup'

const SidebarGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'div'

  return (
    <Comp
      ref={ref}
      data-sidebar="group-label"
      className={cn(
        'flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-bold text-muted-foreground outline-none ring-sidebar-ring transition-[margin,opacity] duration-200 ease-linear motion-reduce:transition-none focus-visible:ring-2 [&>svg]:size-3 [&>svg]:shrink-0',
        'group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0',
        className
      )}
      {...props}
    />
  )
})
SidebarGroupLabel.displayName = 'SidebarGroupLabel'

const SidebarGroupAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<'button'> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      ref={ref}
      data-sidebar="group-action"
      className={cn(
        'absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
        // Increases the hit area of the button on mobile.
        'after:absolute after:-inset-2 after:md:hidden',
        'group-data-[collapsible=icon]:hidden',
        className
      )}
      {...props}
    />
  )
})
SidebarGroupAction.displayName = 'SidebarGroupAction'

const SidebarGroupContent = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-sidebar="group-content"
      className={cn('w-full text-sm', className)}
      {...props}
    />
  )
)
SidebarGroupContent.displayName = 'SidebarGroupContent'

const SidebarMenu = React.forwardRef<HTMLUListElement, React.ComponentProps<'ul'>>(
  ({ className, ...props }, ref) => (
    <ul
      ref={ref}
      data-sidebar="menu"
      className={cn('flex w-full min-w-0 flex-col gap-1', className)}
      {...props}
    />
  )
)
SidebarMenu.displayName = 'SidebarMenu'

const SidebarMenuItem = React.forwardRef<HTMLLIElement, React.ComponentProps<'li'>>(
  ({ className, ...props }, ref) => (
    <li
      ref={ref}
      data-sidebar="menu-item"
      className={cn('group/menu-item relative', className)}
      {...props}
    />
  )
)
SidebarMenuItem.displayName = 'SidebarMenuItem'

const sidebarMenuButtonVariants = cva(
  'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md border border-transparent px-2 py-2 text-left text-sm font-bold text-muted-foreground outline-none ring-sidebar-ring transition-[background-color,color,width,height,padding] duration-150 motion-reduce:transition-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-bold data-[active=true]:text-sidebar-accent-foreground group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:[&>span]:hidden [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: '',
        outline:
          'border-sidebar-border bg-sidebar-accent hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground'
      },
      size: {
        default: 'h-8 text-sm',
        sm: 'h-7 text-xs',
        lg: 'h-12 text-sm group-data-[collapsible=icon]:!p-0'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<'button'> & {
    asChild?: boolean
    isActive?: boolean
    tooltip?: string | React.ComponentProps<typeof TooltipContent>
  } & VariantProps<typeof sidebarMenuButtonVariants>
>(
  (
    {
      asChild = false,
      isActive = false,
      variant = 'default',
      size = 'default',
      tooltip,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button'
    const { isMobile, state } = useSidebar()

    const button = (
      <Comp
        ref={ref}
        data-sidebar="menu-button"
        data-size={size}
        data-active={isActive}
        className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
        style={style}
        {...props}
      />
    )

    if (!tooltip) {
      return button
    }

    if (typeof tooltip === 'string') {
      tooltip = {
        children: tooltip
      }
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent
          side="right"
          align="center"
          hidden={state !== 'collapsed' || isMobile}
          {...tooltip}
        />
      </Tooltip>
    )
  }
)
SidebarMenuButton.displayName = 'SidebarMenuButton'

const SidebarMenuAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<'button'> & {
    asChild?: boolean
    showOnHover?: boolean
  }
>(({ className, asChild = false, showOnHover = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-action"
      className={cn(
        'absolute right-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform motion-reduce:transition-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0',
        // Increases the hit area of the button on mobile.
        'after:absolute after:-inset-2 after:md:hidden',
        'peer-data-[size=sm]/menu-button:top-1',
        'peer-data-[size=default]/menu-button:top-1.5',
        'peer-data-[size=lg]/menu-button:top-2.5',
        'group-data-[collapsible=icon]:hidden',
        showOnHover &&
          'group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0',
        className
      )}
      {...props}
    />
  )
})
SidebarMenuAction.displayName = 'SidebarMenuAction'

const SidebarMenuBadge = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-sidebar="menu-badge"
      className={cn(
        'pointer-events-none absolute right-3 top-1/2 z-10 flex min-w-5 -translate-y-1/2 select-none items-center justify-center px-1 text-xs font-bold tabular-nums',
        'bg-transparent text-sidebar-foreground/80',
        'peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-foreground',
        'group-data-[collapsible=icon]:hidden',
        className
      )}
      {...props}
    />
  )
)
SidebarMenuBadge.displayName = 'SidebarMenuBadge'

const SidebarMenuSkeleton = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    showIcon?: boolean
  }
>(({ className, showIcon = false, ...props }, ref) => {
  // Random width between 50 to 90%.
  const width = React.useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`
  }, [])

  return (
    <div
      ref={ref}
      data-sidebar="menu-skeleton"
      className={cn('flex h-8 items-center gap-2 rounded-md px-2', className)}
      {...props}
    >
      {showIcon && <div className="size-4 rounded-md bg-sidebar-accent-foreground/10" />}
      <div
        className="h-4 max-w-[--skeleton-width] flex-1 rounded-md bg-sidebar-accent-foreground/10"
        style={
          {
            '--skeleton-width': width
          } as React.CSSProperties
        }
      />
    </div>
  )
})
SidebarMenuSkeleton.displayName = 'SidebarMenuSkeleton'

const SidebarMenuSub = React.forwardRef<HTMLUListElement, React.ComponentProps<'ul'>>(
  ({ className, ...props }, ref) => (
    <ul
      ref={ref}
      data-sidebar="menu-sub"
      className={cn(
        'mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5',
        'group-data-[collapsible=icon]:hidden',
        className
      )}
      {...props}
    />
  )
)
SidebarMenuSub.displayName = 'SidebarMenuSub'

const SidebarMenuSubItem = React.forwardRef<HTMLLIElement, React.ComponentProps<'li'>>(
  ({ ...props }, ref) => <li ref={ref} {...props} />
)
SidebarMenuSubItem.displayName = 'SidebarMenuSubItem'

const SidebarMenuSubButton = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<'a'> & {
    asChild?: boolean
    size?: 'sm' | 'md'
    isActive?: boolean
  }
>(({ asChild = false, size = 'md', isActive, className, ...props }, ref) => {
  const Comp = asChild ? Slot : 'a'

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        'flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground outline-none ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground',
        'data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground',
        size === 'sm' && 'text-xs',
        size === 'md' && 'text-sm',
        'group-data-[collapsible=icon]:hidden',
        className
      )}
      {...props}
    />
  )
})
SidebarMenuSubButton.displayName = 'SidebarMenuSubButton'

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar
}
