import type { ReactElement } from 'react'

import { Hexagon, type FilledIcon } from './ui/icons'

interface ProjectUpdateStatusIconProps {
  icon: FilledIcon
}

export function ProjectUpdateStatusIcon({
  icon: StatusIcon
}: ProjectUpdateStatusIconProps): ReactElement {
  return (
    <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
      <Hexagon
        aria-hidden="true"
        className="absolute inset-0 !h-5 !w-5"
        size={20}
        strokeWidth={2}
      />
      <StatusIcon aria-hidden="true" className="relative !h-3 !w-3" size={12} strokeWidth={2} />
    </span>
  )
}
