import * as React from 'react'

import { cn } from '../../lib/utils'

export interface ProgressRingProps extends Omit<
  React.SVGAttributes<SVGSVGElement>,
  'children' | 'color'
> {
  value: number
  size?: number
  strokeWidth?: number
  'data-testid'?: string
}

const viewBoxSize = 20

export function ProgressRing({
  value,
  size = viewBoxSize,
  strokeWidth = 2,
  className,
  ...props
}: ProgressRingProps): React.ReactElement {
  const normalizedValue = Math.min(100, Math.max(0, value))
  const radius = (viewBoxSize - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - normalizedValue / 100)

  return (
    <svg
      {...props}
      aria-hidden="true"
      className={cn('shrink-0', className)}
      fill="none"
      height={size}
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      width={size}
    >
      <circle
        className="text-border"
        cx={viewBoxSize / 2}
        cy={viewBoxSize / 2}
        r={radius}
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
      <circle
        className="text-progress transition-[stroke-dashoffset]"
        cx={viewBoxSize / 2}
        cy={viewBoxSize / 2}
        r={radius}
        stroke="currentColor"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
        transform={`rotate(-90 ${viewBoxSize / 2} ${viewBoxSize / 2})`}
      />
    </svg>
  )
}
