import { ReactElement, ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '../lib/utils'

interface FloatingHoverCardProps {
  children: ReactNode
  x: number
  y: number
  className?: string
}

export function FloatingHoverCard({
  children,
  x,
  y,
  className
}: FloatingHoverCardProps): ReactElement | null {
  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      className={cn(
        'pointer-events-none fixed z-50 rounded-md border bg-popover p-3 text-popover-foreground shadow-md',
        className
      )}
      style={{
        left: `${x}px`,
        top: `${y}px`
      }}
    >
      {children}
    </div>,
    document.body
  )
}
