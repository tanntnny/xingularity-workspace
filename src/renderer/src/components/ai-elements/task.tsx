import * as React from 'react'
import { CheckCircle2, ChevronDown, Circle, LoaderCircle } from '../ui/icons'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'

interface TaskContextValue {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const TaskContext = React.createContext<TaskContextValue | null>(null)

export function Task({
  className,
  defaultOpen = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { defaultOpen?: boolean }): React.ReactElement {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <TaskContext.Provider value={{ open, setOpen }}>
      <div className={cn('rounded-lg border border-border bg-card', className)} {...props} />
    </TaskContext.Provider>
  )
}

export function TaskTrigger({
  className,
  title,
  status = 'pending',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  title: string
  status?: 'pending' | 'in_progress' | 'completed'
}): React.ReactElement {
  const context = React.useContext(TaskContext)
  if (!context) {
    throw new Error('TaskTrigger must be used inside Task')
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn('flex w-full items-center gap-3 px-4 py-3 text-left', className)}
      onClick={() => context.setOpen((value) => !value)}
      {...props}
    >
      {status === 'completed' ? (
        <CheckCircle2 size={16} className="text-primary" />
      ) : status === 'in_progress' ? (
        <LoaderCircle size={16} className="animate-spin text-primary" />
      ) : (
        <Circle size={16} className="text-muted-foreground" />
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{title}</span>
      <ChevronDown
        size={15}
        className={cn('text-muted-foreground transition', context.open ? 'rotate-180' : '')}
      />
    </Button>
  )
}

export function TaskContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement | null {
  const context = React.useContext(TaskContext)
  if (!context) {
    throw new Error('TaskContent must be used inside Task')
  }
  if (!context.open) {
    return null
  }
  return <div className={cn('border-t border-border px-4 py-3', className)} {...props} />
}

export function TaskItem({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      className={cn('flex items-start gap-2 py-1 text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}
