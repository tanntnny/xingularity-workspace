import * as React from 'react'

import { cn } from '../../lib/utils'

export interface WorkspaceTextClipProps extends React.HTMLAttributes<HTMLSpanElement> {}

const WorkspaceTextClip = React.forwardRef<HTMLSpanElement, WorkspaceTextClipProps>(
  ({ children, className, ...props }, forwardedRef) => (
    <span ref={forwardedRef} {...props} className={cn('workspace-text-clip', className)}>
      {children}
    </span>
  )
)
WorkspaceTextClip.displayName = 'WorkspaceTextClip'

export { WorkspaceTextClip }
