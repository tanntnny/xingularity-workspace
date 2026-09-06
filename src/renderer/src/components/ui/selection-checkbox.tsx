import type { ReactElement } from 'react'

import { cn } from '../../lib/utils'
import { Check } from './icons'

interface SelectionCheckboxProps {
  checked: boolean
  className?: string
}

export function SelectionCheckbox({ checked, className }: SelectionCheckboxProps): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-sm border border-primary transition-colors',
        checked
          ? 'bg-primary text-primary-foreground hover:bg-primary group-hover:bg-primary'
          : 'bg-transparent text-primary hover:bg-muted group-hover:bg-muted',
        className
      )}
    >
      {checked ? <Check size={12} /> : null}
    </span>
  )
}
