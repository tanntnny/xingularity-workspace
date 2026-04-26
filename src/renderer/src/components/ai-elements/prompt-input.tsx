import * as React from 'react'
import { ArrowUp, LoaderCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface PromptInputMessage {
  text: string
}

interface PromptInputContextValue {
  onSubmit?: (message: PromptInputMessage, event: React.FormEvent<HTMLFormElement>) => void
}

const PromptInputContext = React.createContext<PromptInputContextValue>({})

export const PromptInput = React.forwardRef<
  HTMLFormElement,
  React.FormHTMLAttributes<HTMLFormElement> & {
    onSubmit?: (message: PromptInputMessage, event: React.FormEvent<HTMLFormElement>) => void
  }
>(({ className, onSubmit, children, ...props }, ref) => {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const textValue = formData.get('prompt-input-message')
    onSubmit?.({ text: typeof textValue === 'string' ? textValue : '' }, event)
  }

  return (
    <PromptInputContext.Provider value={{ onSubmit }}>
      <form
        ref={ref}
        className={cn(
          'workspace-subtle-surface rounded-lg p-2',
          className
        )}
        onSubmit={handleSubmit}
        {...props}
      >
        {children}
      </form>
    </PromptInputContext.Provider>
  )
})
PromptInput.displayName = 'PromptInput'

export const PromptInputHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-wrap items-center gap-2 px-2 pt-1', className)}
    {...props}
  />
))
PromptInputHeader.displayName = 'PromptInputHeader'

export const PromptInputBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('px-1 py-1', className)} {...props} />
))
PromptInputBody.displayName = 'PromptInputBody'

export const PromptInputTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    name="prompt-input-message"
    className={cn(
      'min-h-[96px] w-full resize-none bg-transparent px-3 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]',
      className
    )}
    {...props}
  />
))
PromptInputTextarea.displayName = 'PromptInputTextarea'

export const PromptInputFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center justify-between gap-3 px-2 pb-1 pt-1', className)}
    {...props}
  />
))
PromptInputFooter.displayName = 'PromptInputFooter'

export const PromptInputTools = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center gap-2', className)} {...props} />
))
PromptInputTools.displayName = 'PromptInputTools'

export function PromptInputButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>): React.ReactElement {
  return (
    <button
      type="button"
      className={cn(
        'workspace-subtle-control inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] px-3 text-xs font-medium text-[var(--muted)] transition hover:text-[var(--accent)]',
        className
      )}
      {...props}
    />
  )
}

export function PromptInputSubmit({
  className,
  disabled,
  status,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  status?: 'ready' | 'submitted' | 'streaming' | 'error'
}): React.ReactElement {
  const busy = status === 'submitted' || status === 'streaming'
  return (
    <button
      type="submit"
      disabled={disabled || busy}
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent)] text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      {busy ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowUp size={16} />}
    </button>
  )
}

export function usePromptInputContext(): PromptInputContextValue {
  return React.useContext(PromptInputContext)
}
