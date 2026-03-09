import { ReactElement } from 'react'
import { ProjectIconStyle } from '../../../shared/types'

interface NoteShapeIconProps {
  icon: ProjectIconStyle
  size?: number
  className?: string
}

export function NoteShapeIcon({ icon, size = 16, className }: NoteShapeIconProps): ReactElement {
  const stroke = icon.color
  const fill = icon.variant === 'filled' ? icon.color : 'transparent'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {icon.shape === 'circle' ? (
        <circle cx="12" cy="12" r="7" fill={fill} stroke={stroke} strokeWidth="1.8" />
      ) : null}
      {icon.shape === 'square' ? (
        <rect
          x="5"
          y="5"
          width="14"
          height="14"
          rx="2"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.8"
        />
      ) : null}
      {icon.shape === 'triangle' ? (
        <polygon points="12,5 19,18 5,18" fill={fill} stroke={stroke} strokeWidth="1.8" />
      ) : null}
      {icon.shape === 'diamond' ? (
        <polygon points="12,4 20,12 12,20 4,12" fill={fill} stroke={stroke} strokeWidth="1.8" />
      ) : null}
      {icon.shape === 'hex' ? (
        <polygon
          points="7,6 17,6 22,12 17,18 7,18 2,12"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.8"
        />
      ) : null}
    </svg>
  )
}
