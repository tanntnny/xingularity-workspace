import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import type { UiTone } from '../../lib/uiTone'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center whitespace-nowrap rounded-[var(--radius-control)] border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'border-border text-foreground',
        tag0: 'border-border bg-secondary text-secondary-foreground',
        tag1: 'border-border bg-secondary text-secondary-foreground',
        tag2: 'border-border bg-secondary text-secondary-foreground',
        tag3: 'border-border bg-secondary text-secondary-foreground',
        tag4: 'border-border bg-secondary text-secondary-foreground',
        tag5: 'border-border bg-secondary text-secondary-foreground',
        neutral: 'border-border bg-muted text-muted-foreground'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({
  className,
  variant,
  style,
  tone,
  ...props
}: BadgeProps & { tone?: UiTone }): React.ReactElement {
  const toneClassName = {
    subtle: 'border-border bg-secondary text-secondary-foreground',
    neutral: 'border-border bg-muted text-muted-foreground',
    info: 'border-border bg-secondary text-secondary-foreground',
    accent: 'border-border bg-secondary text-secondary-foreground',
    attention: 'border-border bg-secondary text-secondary-foreground',
    success: 'border-border bg-secondary text-secondary-foreground',
    warning: 'border-border bg-secondary text-secondary-foreground',
    danger: 'border-transparent bg-destructive text-destructive-foreground'
  } satisfies Record<UiTone, string>

  return (
    <div
      className={cn(badgeVariants({ variant }), tone && toneClassName[tone], className)}
      style={style}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
