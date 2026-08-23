import * as React from 'react'

import { cn } from '../../lib/utils'

const WorkspaceReadingWidth = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('mx-auto w-full min-w-0 max-w-5xl', className)} {...props} />
))

WorkspaceReadingWidth.displayName = 'WorkspaceReadingWidth'

export { WorkspaceReadingWidth }
