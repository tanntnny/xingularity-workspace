import * as React from 'react'
import {
  Group,
  Panel,
  Separator,
  type GroupProps,
  type PanelProps,
  type SeparatorProps
} from 'react-resizable-panels'

import { cn } from '../../lib/utils'

const ResizablePanelGroup = React.forwardRef<HTMLDivElement, GroupProps>(
  ({ className, ...props }, ref) => (
    <Group
      elementRef={ref}
      className={cn('flex h-full w-full data-[panel-group-direction=vertical]:flex-col', className)}
      {...props}
    />
  )
)
ResizablePanelGroup.displayName = 'ResizablePanelGroup'

const ResizablePanel = React.forwardRef<HTMLDivElement, PanelProps>(({ ...props }, ref) => (
  <Panel elementRef={ref} {...props} />
))
ResizablePanel.displayName = 'ResizablePanel'

interface ResizableHandleProps extends SeparatorProps {
  withHandle?: boolean
}

const ResizableHandle = React.forwardRef<HTMLDivElement, ResizableHandleProps>(
  ({ className, withHandle = false, ...props }, ref) => (
    <Separator
      elementRef={ref}
      data-resize-direction="x"
      className={cn(
        'resize-affordance group relative flex w-2 cursor-ew-resize items-center justify-center bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className
      )}
      {...props}
    >
      {withHandle ? (
        <span className="z-10 h-8 w-1 rounded-full bg-border" aria-hidden="true" />
      ) : null}
    </Separator>
  )
)
ResizableHandle.displayName = 'ResizableHandle'

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
