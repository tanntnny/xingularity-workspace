import * as React from 'react'

import { cn } from '../../lib/utils'

export type WorkspaceTextFadeProps = React.HTMLAttributes<HTMLSpanElement>

const WorkspaceTextFade = React.forwardRef<HTMLSpanElement, WorkspaceTextFadeProps>(
  ({ children, className, ...props }, forwardedRef) => {
    const textRef = React.useRef<HTMLSpanElement>(null)
    const [isOverflowing, setIsOverflowing] = React.useState(false)

    const setRefs = React.useCallback(
      (node: HTMLSpanElement | null): void => {
        textRef.current = node
        if (typeof forwardedRef === 'function') {
          forwardedRef(node)
        } else if (forwardedRef) {
          forwardedRef.current = node
        }
      },
      [forwardedRef]
    )

    React.useEffect(() => {
      const element = textRef.current
      if (!element) {
        return
      }

      const updateOverflow = (): void => {
        const nextIsOverflowing = element.scrollWidth > element.clientWidth
        setIsOverflowing((current) => (current === nextIsOverflowing ? current : nextIsOverflowing))
      }

      updateOverflow()

      if (typeof ResizeObserver === 'undefined') {
        return
      }

      const resizeObserver = new ResizeObserver(updateOverflow)
      resizeObserver.observe(element)

      return () => resizeObserver.disconnect()
    }, [children])

    return (
      <span
        ref={setRefs}
        {...props}
        className={cn('workspace-text-fade', className)}
        data-overflowing={isOverflowing ? 'true' : 'false'}
      >
        {children}
      </span>
    )
  }
)
WorkspaceTextFade.displayName = 'WorkspaceTextFade'

export { WorkspaceTextFade }
