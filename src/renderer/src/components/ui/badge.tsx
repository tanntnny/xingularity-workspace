import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import type { UiTone } from '../../lib/uiTone'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'ui-compact-control inline-flex items-center whitespace-nowrap rounded-[var(--radius-control)] border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        pill: 'border-transparent bg-surface-subtle text-surface-subtle-foreground hover:bg-surface-subtle/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'border-border text-foreground',
        tag0: 'border-[var(--tag-0-border)] bg-[var(--tag-0-bg)] text-[var(--tag-0-foreground)] hover:bg-[var(--tag-0-hover)]',
        tag1: 'border-[var(--tag-1-border)] bg-[var(--tag-1-bg)] text-[var(--tag-1-foreground)] hover:bg-[var(--tag-1-hover)]',
        tag2: 'border-[var(--tag-2-border)] bg-[var(--tag-2-bg)] text-[var(--tag-2-foreground)] hover:bg-[var(--tag-2-hover)]',
        tag3: 'border-[var(--tag-3-border)] bg-[var(--tag-3-bg)] text-[var(--tag-3-foreground)] hover:bg-[var(--tag-3-hover)]',
        tag4: 'border-[var(--tag-4-border)] bg-[var(--tag-4-bg)] text-[var(--tag-4-foreground)] hover:bg-[var(--tag-4-hover)]',
        tag5: 'border-[var(--tag-5-border)] bg-[var(--tag-5-bg)] text-[var(--tag-5-foreground)] hover:bg-[var(--tag-5-hover)]',
        neutral: 'border-border bg-muted text-muted-foreground',
        counter: 'border-border bg-selection-counter text-selection-counter-foreground'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export interface SelectionCounterProps extends Omit<BadgeProps, 'children' | 'variant'> {
  count: number
}

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
    info: 'border-info-border bg-info-muted text-info-muted-foreground',
    accent: 'border-border bg-secondary text-secondary-foreground',
    attention: 'border-warning-border bg-warning-muted text-warning-muted-foreground',
    success: 'border-success-border bg-success-muted text-success-muted-foreground',
    warning: 'border-warning-border bg-warning-muted text-warning-muted-foreground',
    danger: 'border-transparent bg-destructive text-destructive-foreground'
  } satisfies Record<UiTone, string>

  return (
    <span
      className={cn(badgeVariants({ variant }), tone && toneClassName[tone], className)}
      style={style}
      {...props}
    />
  )
}

function SelectionCounter({
  count,
  className,
  'aria-label': ariaLabel,
  ...props
}: SelectionCounterProps): React.ReactElement | null {
  if (count <= 0) {
    return null
  }

  return (
    <Badge
      {...props}
      variant="counter"
      aria-label={ariaLabel ?? `${count} selected`}
      className={cn(
        'h-5 min-w-5 shrink-0 justify-center rounded-full px-1 text-[11px] leading-none',
        className
      )}
    >
      {count}
    </Badge>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export { Badge, badgeVariants, SelectionCounter }
