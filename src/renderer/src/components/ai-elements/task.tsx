import * as React from 'react'
import { CheckCircle2, ChevronDown, Circle, LoaderCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

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
      <div
        className={cn('rounded-2xl border border-[var(--line)] bg-[var(--panel)]', className)}
        {...props}
      />
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
    <button
      type="button"
      className={cn('flex w-full items-center gap-3 px-4 py-3 text-left', className)}
      onClick={() => context.setOpen((value) => !value)}
      {...props}
    >
      {status === 'completed' ? (
        <CheckCircle2 size={16} className="text-emerald-500" />
      ) : status === 'in_progress' ? (
        <LoaderCircle size={16} className="animate-spin text-[var(--accent)]" />
      ) : (
        <Circle size={16} className="text-[var(--muted)]" />
      )}
      <span className="flex-1 text-sm font-semibold text-[var(--text)]">{title}</span>
      <ChevronDown
        size={15}
        className={cn('text-[var(--muted)] transition', context.open ? 'rotate-180' : '')}
      />
    </button>
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
  return <div className={cn('border-t border-[var(--line)] px-4 py-3', className)} {...props} />
}

export function TaskItem({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      className={cn('flex items-start gap-2 py-1 text-sm text-[var(--muted)]', className)}
      {...props}
    />
  )
}
