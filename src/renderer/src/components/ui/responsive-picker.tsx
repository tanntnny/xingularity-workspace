import * as React from 'react'

import { cn } from '../../lib/utils'
import { Badge } from './badge'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from './drawer'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Button } from './button'
import { ResponsivePickerOpenContext } from './responsive-picker-context'

export interface ResponsivePickerProps {
  trigger: React.ReactElement
  title: string
  description?: React.ReactNode
  selectedCount?: number
  onClear?: () => void
  clearLabel?: string
  clearTestId?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  testId?: string
  ariaLabel?: string
  contentClassName?: string
  bodyClassName?: string
  children: React.ReactNode
  footer?: React.ReactNode
  onCloseAutoFocus?: (event: Event) => void
}

function PickerHeader({
  description,
  selectedCount,
  onClear,
  clearLabel,
  clearTestId,
  heading,
  descriptionId
}: {
  description?: React.ReactNode
  selectedCount?: number
  onClear?: () => void
  clearLabel: string
  clearTestId?: string
  heading: React.ReactNode
  descriptionId?: string
}): React.ReactElement {
  const hasSelectionCount = selectedCount !== undefined
  const clearDisabled = selectedCount !== undefined && selectedCount === 0

  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        {heading}
        {description ? (
          <p id={descriptionId} className="text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        ) : null}
        {hasSelectionCount ? (
          <Badge variant="neutral" className="h-5 px-1.5 text-[11px]">
            {selectedCount === 0 ? 'None selected' : `${selectedCount} selected`}
          </Badge>
        ) : null}
      </div>
      {onClear ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={clearDisabled}
          onClick={onClear}
          aria-label={clearLabel}
          data-testid={clearTestId}
          className="shrink-0 px-2 text-xs"
        >
          {clearLabel}
        </Button>
      ) : null}
    </div>
  )
}

export function ResponsivePicker({
  trigger,
  title,
  description,
  selectedCount,
  onClear,
  clearLabel = 'Clear all',
  clearTestId,
  open: controlledOpen,
  onOpenChange,
  align = 'start',
  sideOffset = 6,
  testId,
  ariaLabel,
  contentClassName,
  bodyClassName,
  children,
  footer,
  onCloseAutoFocus
}: ResponsivePickerProps): React.ReactElement {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const [isMobile, setIsMobile] = React.useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(max-width: 639px)').matches
  })
  const titleId = React.useId()
  const descriptionId = React.useId()
  const open = controlledOpen ?? uncontrolledOpen

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia('(max-width: 639px)')
    const update = (): void => setIsMobile(mediaQuery.matches)
    update()
    mediaQuery.addEventListener('change', update)

    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  const handleOpenChange = (nextOpen: boolean): void => {
    if (controlledOpen === undefined) {
      setUncontrolledOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }

  const handleOpenAutoFocus = (event: Event): void => {
    event.preventDefault()
    const content = event.currentTarget
    const focusSearch = (): void => {
      if (!(content instanceof HTMLElement)) return
      content.querySelector<HTMLElement>('[data-responsive-picker-input]')?.focus()
    }

    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(focusSearch)
    } else {
      focusSearch()
    }
  }

  const body = (
    <ResponsivePickerOpenContext.Provider value={open}>
      <div className={cn('min-h-0 flex-1 overflow-y-auto', bodyClassName)}>{children}</div>
      {footer ? <div className="shrink-0 border-t border-border/70">{footer}</div> : null}
    </ResponsivePickerOpenContext.Provider>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent
          side="bottom"
          aria-label={ariaLabel ?? title}
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          data-testid={testId}
          className={cn('max-h-[min(88vh,44rem)]', contentClassName)}
          onOpenAutoFocus={handleOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <DrawerHeader className="px-4 pb-3 pt-4 [&>div]:space-y-0">
            <PickerHeader
              description={description}
              selectedCount={selectedCount}
              onClear={onClear}
              clearLabel={clearLabel}
              clearTestId={clearTestId}
              descriptionId={descriptionId}
              heading={<DrawerTitle id={titleId}>{title}</DrawerTitle>}
            />
          </DrawerHeader>
          {body}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={sideOffset}
        aria-label={ariaLabel ?? title}
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        data-testid={testId}
        className={cn(
          'flex max-h-[min(72vh,38rem)] w-[min(30rem,calc(100vw-1rem))] flex-col overflow-hidden p-0',
          contentClassName
        )}
        onOpenAutoFocus={handleOpenAutoFocus}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <div className="shrink-0 border-b border-border/70 px-3 py-3">
          <PickerHeader
            description={description}
            selectedCount={selectedCount}
            onClear={onClear}
            clearLabel={clearLabel}
            clearTestId={clearTestId}
            descriptionId={descriptionId}
            heading={
              <h2 id={titleId} className="text-sm font-semibold text-foreground">
                {title}
              </h2>
            }
          />
        </div>
        {body}
      </PopoverContent>
    </Popover>
  )
}
