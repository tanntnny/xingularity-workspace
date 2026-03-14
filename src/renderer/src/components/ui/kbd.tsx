import { ReactElement, HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>): ReactElement {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 items-center rounded border border-[var(--line)] bg-[var(--panel-2)] px-1.5 text-[10px] font-medium text-[var(--muted)]',
        className
      )}
      {...props}
    />
  )
}
