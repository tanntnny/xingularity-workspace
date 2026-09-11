import * as React from 'react'

import { cn } from '../../lib/utils'
import { SelectionCounter } from './badge'
import { statusChipVariants } from './status-chip-variants'
import { getButtonTooltipLabel, TooltipButton } from './tooltip'
import { WorkspaceTextClip } from './workspace-text-clip'
import { WorkspaceTextFade } from './workspace-text-fade'

export interface StatusChipItem {
  label: React.ReactNode
  icon: React.ReactNode
  iconColorToken: string
  labelColorToken?: string
}

export type StatusChipVariant = 'default' | 'bare'
export type StatusChipSurface = 'none' | 'pill' | 'attention' | 'hover' | 'hover-pill'
export type StatusChipLabelOverflow = 'wrap' | 'fade' | 'clip'

type StatusChipSpanProps = {
  as?: 'span'
  item: StatusChipItem
  variant?: StatusChipVariant
  surface?: StatusChipSurface
  wrapLabel?: boolean
  labelOverflow?: StatusChipLabelOverflow
  mutedLabel?: boolean
  counter?: number
  tooltip?: string
  tooltipWrapperClassName?: string
} & Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>

type StatusChipButtonProps = {
  as: 'button'
  item: StatusChipItem
  variant?: StatusChipVariant
  surface?: StatusChipSurface
  wrapLabel?: boolean
  labelOverflow?: StatusChipLabelOverflow
  mutedLabel?: boolean
  counter?: number
  tooltip?: string
  tooltipWrapperClassName?: string
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>

export type StatusChipProps = StatusChipSpanProps | StatusChipButtonProps

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
      counter,
      tooltip,
      tooltipWrapperClassName,
      title,
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const resolvedLabelOverflow = labelOverflow ?? (wrapLabel ? 'wrap' : 'fade')
    const hasCounter = counter !== undefined && counter > 0
    const chipStyle = {
      ...style,
      '--status-chip-icon-color': item.iconColorToken,
      ...(item.labelColorToken ? { '--status-chip-label-color': item.labelColorToken } : {})
    } as React.CSSProperties
    const labelClassName = cn(
      hasCounter ? 'min-w-0 flex-1 text-left text-sm' : 'w-full text-left text-sm',
      resolvedLabelOverflow === 'wrap' ? 'whitespace-normal break-words' : 'flex-1',
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
        {item.icon ? (
          <span
            aria-hidden="true"
            className="inline-flex shrink-0 items-center justify-center text-[var(--status-chip-icon-color)]"
          >
            {item.icon}
          </span>
        ) : null}
        {resolvedLabelOverflow === 'fade' ? (
          <WorkspaceTextFade className={labelClassName}>{item.label}</WorkspaceTextFade>
        ) : resolvedLabelOverflow === 'clip' ? (
          <WorkspaceTextClip className={labelClassName}>{item.label}</WorkspaceTextClip>
        ) : (
          <span className={labelClassName}>{item.label}</span>
        )}
        <SelectionCounter count={counter ?? 0} />
      </>
    )

    if (as === 'button') {
      const resolvedTooltip = getButtonTooltipLabel(tooltip, ariaLabel, title, item.label)
      const button = (
        <button
          {...props}
          ref={ref as React.Ref<HTMLButtonElement>}
          type={(props as React.ButtonHTMLAttributes<HTMLButtonElement>).type ?? 'button'}
          aria-label={ariaLabel}
          title={title}
          className={rootClassName}
          style={chipStyle}
        >
          {content}
        </button>
      )

      return resolvedTooltip ? (
        <TooltipButton
          label={resolvedTooltip}
          disabled={(props as React.ButtonHTMLAttributes<HTMLButtonElement>).disabled}
          wrapperClassName={tooltipWrapperClassName}
        >
          {button}
        </TooltipButton>
      ) : (
        button
      )
    }

    return (
      <span
        {...props}
        ref={ref as React.Ref<HTMLSpanElement>}
        aria-label={ariaLabel}
        title={title}
        className={rootClassName}
        style={chipStyle}
      >
        {content}
      </span>
    )
  }
)
StatusChip.displayName = 'StatusChip'
