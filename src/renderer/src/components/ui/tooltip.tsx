'use client'

import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

import { cn } from '../../lib/utils'

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

function getTooltipText(children: React.ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children)
  }

  if (Array.isArray(children)) {
    return children.map(getTooltipText).join(' ')
  }

  if (React.isValidElement(children)) {
    const element = children as React.ReactElement<{ children?: React.ReactNode }>
    return getTooltipText(element.props.children)
  }

  return ''
}

// eslint-disable-next-line react-refresh/only-export-components
export function getButtonTooltipLabel(
  explicitLabel: string | undefined,
  ariaLabel: string | undefined,
  title: string | undefined,
  children: React.ReactNode
): string | undefined {
  const label = explicitLabel ?? ariaLabel ?? title ?? getTooltipText(children)
  const trimmedLabel = label?.trim()
  return trimmedLabel ? trimmedLabel : undefined
}

export interface TooltipButtonProps {
  label: string
  children?: React.ReactElement
  disabled?: boolean
  wrapperClassName?: string
  preserveChildAttributes?: boolean
}

const TooltipButton = ({
  label,
  children,
  disabled = false,
  wrapperClassName,
  preserveChildAttributes = false
}: TooltipButtonProps): React.ReactElement | null => {
  if (!children) {
    return null
  }

  if (!label.trim()) {
    return children
  }

  const trigger = disabled ? (
    <span data-tooltip-disabled-trigger="true" className={cn('inline-flex', wrapperClassName)}>
      {children}
    </span>
  ) : preserveChildAttributes ? (
    <span className={cn('inline-flex', wrapperClassName)}>{children}</span>
  ) : (
    children
  )

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'motion-floating-content z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-md',
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, TooltipButton }
