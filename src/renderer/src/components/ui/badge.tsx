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
        tag0: 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/60',
        tag1: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60',
        tag2: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60',
        tag3: 'border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-950/60',
        tag4: 'border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200 dark:hover:bg-orange-950/60',
        tag5: 'border-pink-200 bg-pink-50 text-pink-800 hover:bg-pink-100 dark:border-pink-800 dark:bg-pink-950/40 dark:text-pink-200 dark:hover:bg-pink-950/60',
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
