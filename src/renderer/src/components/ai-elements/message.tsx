import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'

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
      'border bg-card text-card-foreground max-w-[min(860px,100%)] rounded-lg px-4 py-3 text-sm text-foreground',
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
        'prose prose-sm max-w-none break-words text-foreground prose-p:my-2 prose-pre:rounded-lg prose-pre:border prose-pre:border-border prose-pre:bg-muted',
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
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={label}
      title={label}
      className={cn(
        'border border-input bg-card text-foreground inline-flex h-8 items-center justify-center rounded-lg border border-border px-2.5 text-muted-foreground transition hover:text-primary',
        className
      )}
      {...props}
    />
  )
}
