import * as React from 'react'

import { cn } from '../../lib/utils'
import { statusChipVariants } from './status-chip-variants'

export interface StatusChipItem {
  label: React.ReactNode
  icon: React.ReactNode
  iconColorToken: string
  labelColorToken?: string
}

export type StatusChipVariant = 'default' | 'bare'
export type StatusChipSurface = 'none' | 'pill' | 'hover' | 'hover-pill'
export type StatusChipLabelOverflow = 'truncate' | 'wrap' | 'fade'

type StatusChipSpanProps = {
  as?: 'span'
  item: StatusChipItem
  variant?: StatusChipVariant
  surface?: StatusChipSurface
  wrapLabel?: boolean
  labelOverflow?: StatusChipLabelOverflow
  mutedLabel?: boolean
} & Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>

type StatusChipButtonProps = {
  as: 'button'
  item: StatusChipItem
  variant?: StatusChipVariant
  surface?: StatusChipSurface
  wrapLabel?: boolean
  labelOverflow?: StatusChipLabelOverflow
  mutedLabel?: boolean
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>

export type StatusChipProps = StatusChipSpanProps | StatusChipButtonProps

interface StatusChipLabelProps {
  children: React.ReactNode
  className: string
  fade: boolean
}

function StatusChipLabel({ children, className, fade }: StatusChipLabelProps): React.ReactElement {
  const labelRef = React.useRef<HTMLSpanElement>(null)
  const [isOverflowing, setIsOverflowing] = React.useState(false)

  React.useEffect(() => {
    const element = labelRef.current
    if (!element || !fade) {
      setIsOverflowing(false)
      return
    }

    const updateOverflow = (): void => {
      const nextIsOverflowing = element.scrollWidth > element.clientWidth
      setIsOverflowing((current) => (current === nextIsOverflowing ? current : nextIsOverflowing))
    }

    updateOverflow()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const resizeObserver = new ResizeObserver(updateOverflow)
    resizeObserver.observe(element)

    return () => resizeObserver.disconnect()
  }, [children, fade])

  return (
    <span
      ref={labelRef}
      className={className}
      data-overflowing={fade && isOverflowing ? 'true' : undefined}
    >
      {children}
    </span>
  )
}

export const StatusChip = React.forwardRef<HTMLElement, StatusChipProps>(
  (
    {
      item,
      className,
      style,
      as = 'span',
      variant = 'default',
      surface = 'none',
      wrapLabel = false,
      labelOverflow,
      mutedLabel,
      ...props
    },
    ref
  ) => {
    const resolvedLabelOverflow = labelOverflow ?? (wrapLabel ? 'wrap' : 'truncate')
    const chipStyle = {
      ...style,
      '--status-chip-icon-color': item.iconColorToken,
      ...(item.labelColorToken ? { '--status-chip-label-color': item.labelColorToken } : {})
    } as React.CSSProperties
    const labelClassName = cn(
      'w-full text-left text-sm',
      resolvedLabelOverflow === 'fade'
        ? 'status-chip-label-fade flex-1'
        : resolvedLabelOverflow === 'wrap'
          ? 'whitespace-normal break-words'
          : 'truncate',
      mutedLabel === true
        ? 'text-muted-foreground'
        : mutedLabel === false
          ? 'text-foreground'
          : item.labelColorToken
            ? 'text-[var(--status-chip-label-color)]'
            : variant === 'bare'
              ? 'text-muted-foreground transition-colors group-hover/status-chip:text-foreground group-focus-visible/status-chip:text-foreground'
              : 'text-foreground'
    )
    const rootClassName = cn(
      statusChipVariants({ variant, surface: variant === 'default' ? surface : 'none' }),
      resolvedLabelOverflow === 'wrap' && '!whitespace-normal',
      className,
      'items-center justify-start'
    )

    const content = (
      <>
        <span
          aria-hidden="true"
          className="inline-flex shrink-0 items-center justify-center text-[var(--status-chip-icon-color)]"
        >
          {item.icon}
        </span>
        <StatusChipLabel className={labelClassName} fade={resolvedLabelOverflow === 'fade'}>
          {item.label}
        </StatusChipLabel>
      </>
    )

    if (as === 'button') {
      return (
        <button
          {...props}
          ref={ref as React.Ref<HTMLButtonElement>}
          type={(props as React.ButtonHTMLAttributes<HTMLButtonElement>).type ?? 'button'}
          className={rootClassName}
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
        className={rootClassName}
        style={chipStyle}
      >
        {content}
      </span>
    )
  }
)
StatusChip.displayName = 'StatusChip'
