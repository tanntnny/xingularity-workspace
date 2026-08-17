import type { ReactElement } from 'react'
import { cn } from '../lib/utils'

export function MilestoneCompletenessIcon({
  completed,
  size = 18,
  className = '',
  dataTestId
}: {
  completed: boolean
  size?: number
  className?: string
  dataTestId?: string
}): ReactElement {
  return (
    <svg
      aria-hidden="true"
      className={cn('shrink-0 text-warning', className)}
      data-completed={completed ? 'true' : 'false'}
      data-testid={dataTestId}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <path
        d="M12 3 21 12l-9 9-9-9 9-9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      {completed ? (
        <path
          d="m8.2 12 2.4 2.4 5.2-5.2"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.2"
        />
      ) : null}
    </svg>
  )
}
