import type { ReactElement } from 'react'
import type { TaskStatus } from '../../../shared/types'
import { TASK_STATUS_META, getTaskStatus, type TaskStatusVisual } from '../lib/taskStatus'
import { cn } from '../lib/utils'

const CENTER = 12
const RING_RADIUS = 8
const STROKE_WIDTH = 1.75
const CONTRAST_COLOR = 'var(--card)'
const PENDING_DASH_ARRAY = '1.35 2.25'

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

  return (
    <svg
      aria-hidden="true"
      className={cn(meta.className, className)}
      data-status={resolved}
      fill="none"
      focusable="false"
      height={size}
      style={{ height: size, width: size }}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={STROKE_WIDTH}
      viewBox="0 0 24 24"
      width={size}
    >
      <TaskStatusGlyph visual={meta.visual} />
    </svg>
  )
}

function TaskStatusGlyph({ visual }: { visual: TaskStatusVisual }): ReactElement {
  switch (visual) {
    case 'pending-dash':
      return (
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RING_RADIUS}
          strokeDasharray={PENDING_DASH_ARRAY}
          strokeWidth={1.5}
        />
      )
    case 'backlog-ring':
      return <circle cx={CENTER} cy={CENTER} r={RING_RADIUS} />
    case 'progress-half':
      return (
        <g>
          <path
            d={`M ${CENTER} ${CENTER - RING_RADIUS} A ${RING_RADIUS} ${RING_RADIUS} 0 0 1 ${CENTER} ${CENTER + RING_RADIUS} Z`}
            fill="currentColor"
            stroke="none"
          />
          <circle cx={CENTER} cy={CENTER} r={RING_RADIUS} />
          <line x1={CENTER} x2={CENTER} y1={CENTER - RING_RADIUS} y2={CENTER + RING_RADIUS} />
        </g>
      )
    case 'blocked-cross':
      return (
        <g>
          <circle
            cx={CENTER}
            cy={CENTER}
            fill="currentColor"
            r={RING_RADIUS}
            stroke="currentColor"
          />
          <path d="m8.5 8.5 7 7m0-7-7 7" fill="none" stroke={CONTRAST_COLOR} strokeWidth={1.8} />
        </g>
      )
    case 'completed-check':
      return (
        <g>
          <circle
            cx={CENTER}
            cy={CENTER}
            fill="currentColor"
            r={RING_RADIUS}
            stroke="currentColor"
          />
          <path d="m8.5 12.1 2.4 2.4 4.7-5" fill="none" stroke={CONTRAST_COLOR} strokeWidth={1.8} />
        </g>
      )
  }
}
