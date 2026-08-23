import type { CSSProperties, ReactElement } from 'react'
import type { TaskStatus } from '../../../shared/types'
import { CircleCheck, CircleDashedMinus, CircleHalf2 } from './ui/icons'
import { TASK_STATUS_META, getTaskStatus } from '../lib/taskStatus'
import { cn } from '../lib/utils'

const STROKE_WIDTH = 1.75

function getNormalizedIconStyle(size: number, color: string): CSSProperties {
  return {
    color,
    display: 'block',
    flex: '0 0 auto',
    height: size,
    maxHeight: size,
    maxWidth: size,
    minHeight: size,
    minWidth: size,
    width: size
  }
}

export function TaskStatusIcon({
  status,
  completed,
  size = 18,
  className = ''
}: {
  status?: TaskStatus
  completed?: boolean
  size?: number
  className?: string
}): ReactElement {
  const resolved = getTaskStatus(status, completed)
  const meta = TASK_STATUS_META[resolved]

  if (meta.visual === 'completed-check') {
    return (
      <CircleCheck
        aria-hidden="true"
        className={cn('shrink-0', meta.className, className)}
        data-status={resolved}
        focusable="false"
        size={size}
        style={getNormalizedIconStyle(size, meta.iconColorToken)}
      />
    )
  }

  if (meta.visual === 'backlog-dashed-minus') {
    return (
      <CircleDashedMinus
        aria-hidden="true"
        className={cn('shrink-0', meta.className, className)}
        data-status={resolved}
        focusable="false"
        size={size}
        style={getNormalizedIconStyle(size, meta.iconColorToken)}
      />
    )
  }

  if (meta.visual === 'progress-half') {
    return (
      <CircleHalf2
        aria-hidden="true"
        className={cn('shrink-0', meta.className, className)}
        data-status={resolved}
        focusable="false"
        size={size}
        style={getNormalizedIconStyle(size, meta.iconColorToken)}
      />
    )
  }

  if (meta.visual === 'blocked-cancel') {
    return (
      <TaskStatusSvg
        className={cn('shrink-0', meta.className, className)}
        dataStatus={resolved}
        iconColorToken={meta.iconColorToken}
        size={size}
      >
        <BlockedStatusGlyph />
      </TaskStatusSvg>
    )
  }

  if (meta.visual === 'canceled-dashed-x') {
    return (
      <TaskStatusSvg
        className={cn('shrink-0', meta.className, className)}
        dataStatus={resolved}
        iconColorToken={meta.iconColorToken}
        size={size}
      >
        <CanceledStatusGlyph />
      </TaskStatusSvg>
    )
  }

  return (
    <svg
      aria-hidden="true"
      className={cn('block shrink-0', meta.className, className)}
      data-status={resolved}
      fill="none"
      focusable="false"
      height={size}
      style={getNormalizedIconStyle(size, meta.iconColorToken)}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={STROKE_WIDTH}
      viewBox="0 0 24 24"
      width={size}
    >
      <TaskStatusGlyph />
    </svg>
  )
}

function TaskStatusSvg({
  children,
  className,
  dataStatus,
  iconColorToken,
  size
}: {
  children: ReactElement
  className: string
  dataStatus: TaskStatus
  iconColorToken: string
  size: number
}): ReactElement {
  return (
    <svg
      aria-hidden="true"
      className={className}
      data-status={dataStatus}
      fill="none"
      focusable="false"
      height={size}
      style={getNormalizedIconStyle(size, iconColorToken)}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
    >
      {children}
    </svg>
  )
}

function BlockedStatusGlyph(): ReactElement {
  return (
    <g>
      <path d="M0 0h24v24H0z" fill="none" stroke="none" />
      <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
      <path d="M18.364 5.636l-12.728 12.728" />
    </g>
  )
}

function CanceledStatusGlyph(): ReactElement {
  return (
    <g>
      <path d="M0 0h24v24H0z" fill="none" stroke="none" />
      <path d="M8.56 3.69a9 9 0 0 0 -2.92 1.95" />
      <path d="M3.69 8.56a9 9 0 0 0 -.69 3.44" />
      <path d="M3.69 15.44a9 9 0 0 0 1.95 2.92" />
      <path d="M8.56 20.31a9 9 0 0 0 3.44 .69" />
      <path d="M15.44 20.31a9 9 0 0 0 2.92 -1.95" />
      <path d="M20.31 15.44a9 9 0 0 0 .69 -3.44" />
      <path d="M20.31 8.56a9 9 0 0 0 -.69 -3.44" />
      <path d="M15.44 3.69a9 9 0 0 0 -3.44 -.69" />
      <path d="M14 14l-4 -4" />
      <path d="M10 14l4 -4" />
    </g>
  )
}

function TaskStatusGlyph(): ReactElement {
  return (
    <g strokeWidth={2}>
      <path d="M0 0h24v24H0z" fill="none" stroke="none" />
      <path d="M8.56 3.69a9 9 0 0 0 -2.92 1.95" />
      <path d="M3.69 8.56a9 9 0 0 0 -.69 3.44" />
      <path d="M3.69 15.44a9 9 0 0 0 1.95 2.92" />
      <path d="M8.56 20.31a9 9 0 0 0 3.44 .69" />
      <path d="M15.44 20.31a9 9 0 0 0 2.92 -1.95" />
      <path d="M20.31 15.44a9 9 0 0 0 .69 -3.44" />
      <path d="M20.31 8.56a9 9 0 0 0 -1.95 -2.92" />
      <path d="M15.44 3.69a9 9 0 0 0 -3.44 -.69" />
    </g>
  )
}
