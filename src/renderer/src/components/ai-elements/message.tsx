import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '../../lib/utils'

export const Message = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { from: 'user' | 'assistant' | 'system' }
>(({ className, from, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex w-full', from === 'user' ? 'justify-end' : 'justify-start', className)}
    {...props}
  />
))
Message.displayName = 'Message'

export const MessageContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'workspace-subtle-surface max-w-[min(860px,100%)] rounded-3xl px-4 py-3 text-sm text-[var(--text)]',
      className
    )}
    {...props}
  />
))
MessageContent.displayName = 'MessageContent'

export function MessageResponse({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { children: string }): React.ReactElement {
  return (
    <div
      className={cn(
        'prose prose-sm max-w-none break-words text-[var(--text)] prose-p:my-2 prose-pre:rounded-2xl prose-pre:border prose-pre:border-[var(--line)] prose-pre:bg-[color:color-mix(in_srgb,var(--panel)_20%,transparent)]',
        className
      )}
      {...props}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}

export function MessageActions({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn('mt-2 flex items-center gap-1.5 px-2', className)} {...props} />
}

export function MessageAction({
  className,
  label,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }): React.ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'workspace-subtle-control inline-flex h-8 items-center justify-center rounded-full border border-[var(--line)] px-2.5 text-[var(--muted)] transition hover:text-[var(--accent)]',
        className
      )}
      {...props}
    />
  )
}
