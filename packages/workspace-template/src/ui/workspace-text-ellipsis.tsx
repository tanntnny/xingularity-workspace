import * as React from 'react'

import { cn } from '../lib/utils'

export type WorkspaceTextEllipsisLines = 1 | 2

export interface WorkspaceTextEllipsisProps extends React.HTMLAttributes<HTMLSpanElement> {
  lines?: WorkspaceTextEllipsisLines
}

const WorkspaceTextEllipsis = React.forwardRef<HTMLSpanElement, WorkspaceTextEllipsisProps>(
  ({ children, className, lines = 1, ...props }, forwardedRef) => (
    <span
      ref={forwardedRef}
      {...props}
      className={cn('workspace-text-ellipsis', className)}
      data-lines={lines}
    >
      {children}
    </span>
  )
)
WorkspaceTextEllipsis.displayName = 'WorkspaceTextEllipsis'

export { WorkspaceTextEllipsis }
