import * as React from 'react'

import { cn } from '../../lib/utils'

export type WorkspaceTextFadeLines = 1 | 2

export interface WorkspaceTextFadeProps extends React.HTMLAttributes<HTMLSpanElement> {
  lines?: WorkspaceTextFadeLines
  observeMutations?: boolean
}

const WorkspaceTextFade = React.forwardRef<HTMLSpanElement, WorkspaceTextFadeProps>(
  ({ children, className, lines = 1, observeMutations = true, ...props }, forwardedRef) => {
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
        const nextIsOverflowing =
          lines === 2
            ? element.scrollHeight > element.clientHeight
            : element.scrollWidth > element.clientWidth
        setIsOverflowing((current) => (current === nextIsOverflowing ? current : nextIsOverflowing))
      }

      updateOverflow()

      const resizeObserver =
        typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateOverflow)
      resizeObserver?.observe(element)

      const mutationObserver =
        observeMutations && typeof MutationObserver !== 'undefined'
          ? new MutationObserver(updateOverflow)
          : null
      mutationObserver?.observe(element, {
        characterData: true,
        childList: true,
        subtree: true
      })

      return () => {
        resizeObserver?.disconnect()
        mutationObserver?.disconnect()
      }
    }, [children, lines, observeMutations])

    return (
      <span
        ref={setRefs}
        {...props}
        className={cn('workspace-text-fade', className)}
        data-lines={lines}
        data-overflowing={isOverflowing ? 'true' : 'false'}
      >
        {children}
      </span>
    )
  }
)
WorkspaceTextFade.displayName = 'WorkspaceTextFade'

export interface WorkspaceTextFadeContentProps extends Omit<WorkspaceTextFadeProps, 'children'> {
  children?: React.ReactNode
}

function WorkspaceTextFadeContent({
  children,
  className,
  ...props
}: WorkspaceTextFadeContentProps): React.ReactNode {
  const hasDirectText = React.Children.toArray(children).some(
    (child) => typeof child === 'string' || typeof child === 'number'
  )

  if (!hasDirectText) {
    return children
  }

  return (
    <>
      {React.Children.map(children, (child, index) =>
        typeof child === 'string' || typeof child === 'number' ? (
          <WorkspaceTextFade key={`workspace-text-fade-${index}`} className={className} {...props}>
            {child}
          </WorkspaceTextFade>
        ) : (
          child
        )
      )}
    </>
  )
}

WorkspaceTextFadeContent.displayName = 'WorkspaceTextFadeContent'

export { WorkspaceTextFade, WorkspaceTextFadeContent }
