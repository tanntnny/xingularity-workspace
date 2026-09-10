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
        'flex size-4 shrink-0 items-center justify-center rounded-sm border border-primary text-primary',
        checked && 'bg-primary text-primary-foreground',
        className
      )}
    >
      {checked ? <Check size={12} /> : null}
    </span>
  )
}
