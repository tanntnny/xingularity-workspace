import * as React from 'react'
import { ArrowDown } from 'lucide-react'
import { cn } from '../../lib/utils'

const ConversationScrollContext = React.createContext<{ scrollToBottom: () => void } | null>(null)

export const Conversation = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const contentRef = React.useRef<HTMLDivElement | null>(null)

    const scrollToBottom = React.useCallback(() => {
      const node = contentRef.current
      if (!node) {
        return
      }
      node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
    }, [])

    return (
      <ConversationScrollContext.Provider value={{ scrollToBottom }}>
        <div
          ref={ref}
          className={cn('relative flex min-h-0 flex-1 flex-col overflow-hidden', className)}
          {...props}
        >
          {React.Children.map(children, (child) => {
            if (!React.isValidElement(child)) {
              return child
            }

            if (child.type === ConversationContent) {
              return React.cloneElement(child, { viewportRef: contentRef } as {
                viewportRef: typeof contentRef
              })
            }

            return child
          })}
        </div>
      </ConversationScrollContext.Provider>
    )
  }
)
Conversation.displayName = 'Conversation'

export const ConversationContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { viewportRef?: React.RefObject<HTMLDivElement | null> }
>(({ className, viewportRef, ...props }, ref) => {
  React.useEffect(() => {
    const node = viewportRef?.current
    if (!node) {
      return
    }
    node.scrollTop = node.scrollHeight
  })

  return (
    <div
      ref={(node) => {
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
        if (viewportRef) {
          viewportRef.current = node
        }
      }}
      className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-5', className)}
      {...props}
    />
  )
})
ConversationContent.displayName = 'ConversationContent'

export function ConversationEmptyState({
  className,
  icon,
  title = 'No messages yet',
  description = 'Start a conversation to see messages here',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  icon?: React.ReactNode
  title?: string
  description?: string
}): React.ReactElement {
  return (
    <div
      className={cn(
        'workspace-subtle-surface flex h-full flex-col items-center justify-center gap-3 rounded-3xl border-dashed px-6 py-10 text-center',
        className
      )}
      {...props}
    >
      {icon ? <div className="text-[var(--muted)]">{icon}</div> : null}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
        <p className="max-w-md text-sm text-[var(--muted)]">{description}</p>
      </div>
      {children}
    </div>
  )
}

export function ConversationScrollButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>): React.ReactElement {
  const context = React.useContext(ConversationScrollContext)

  return (
    <button
      type="button"
      className={cn(
        'workspace-subtle-control absolute bottom-4 right-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--text)] transition hover:text-[var(--accent)]',
        className
      )}
      onClick={() => context?.scrollToBottom()}
      {...props}
    >
      <ArrowDown size={15} />
    </button>
  )
}
