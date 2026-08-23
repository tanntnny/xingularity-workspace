import * as React from 'react'
import { cva } from 'class-variance-authority'

import { cn } from '../lib/utils'

export interface StatusChipItem {
  label: React.ReactNode
  icon: React.ReactNode
  iconColorToken: string
  labelColorToken?: string
}

export type StatusChipVariant = 'default' | 'bare'

const statusChipVariants = cva(
  'inline-flex w-fit max-w-full items-center whitespace-nowrap text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-[var(--control-icon-size)] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'ui-control gap-2 rounded-[var(--radius-control)] bg-transparent px-[var(--control-padding-x)] text-foreground font-medium hover:bg-accent focus-visible:bg-accent',
        bare: 'group/status-chip gap-1 rounded-none bg-transparent px-0 py-0 text-muted-foreground font-normal hover:bg-transparent hover:text-foreground focus-visible:bg-transparent focus-visible:text-foreground'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

type StatusChipSpanProps = {
  as?: 'span'
  item: StatusChipItem
  variant?: StatusChipVariant
  mutedLabel?: boolean
} & Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>

type StatusChipButtonProps = {
  as: 'button'
  item: StatusChipItem
  variant?: StatusChipVariant
  mutedLabel?: boolean
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>

export type StatusChipProps = StatusChipSpanProps | StatusChipButtonProps

export const StatusChip = React.forwardRef<HTMLElement, StatusChipProps>(
  ({ item, className, style, as = 'span', variant = 'default', mutedLabel, ...props }, ref) => {
    const chipStyle = {
      ...style,
      '--status-chip-icon-color': item.iconColorToken,
      ...(item.labelColorToken ? { '--status-chip-label-color': item.labelColorToken } : {})
    } as React.CSSProperties
    const labelClassName =
      mutedLabel === true
        ? 'min-w-0 truncate text-muted-foreground'
        : mutedLabel === false
          ? 'min-w-0 truncate text-foreground'
          : item.labelColorToken
            ? 'min-w-0 truncate text-[var(--status-chip-label-color)]'
            : variant === 'bare'
              ? 'min-w-0 truncate text-muted-foreground transition-colors group-hover/status-chip:text-foreground group-focus-visible/status-chip:text-foreground'
              : 'min-w-0 truncate text-foreground'

    const content = (
      <>
        <span aria-hidden="true" className="shrink-0 text-[var(--status-chip-icon-color)]">
          {item.icon}
        </span>
        <span className={labelClassName}>{item.label}</span>
      </>
    )

    if (as === 'button') {
      return (
        <button
          {...props}
          ref={ref as React.Ref<HTMLButtonElement>}
          type={(props as React.ButtonHTMLAttributes<HTMLButtonElement>).type ?? 'button'}
          className={cn(statusChipVariants({ variant }), className)}
          style={chipStyle}
        >
          {content}
        </button>
      )
    }

    return (
      <span
        {...props}
        ref={ref as React.Ref<HTMLSpanElement>}
        className={cn(statusChipVariants({ variant }), className)}
        style={chipStyle}
      >
        {content}
      </span>
    )
  }
)
StatusChip.displayName = 'StatusChip'
