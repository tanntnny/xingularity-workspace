import * as React from 'react'

import type { UiTone } from '../../lib/uiTone'
import { StatusChipSelect, type StatusChipOption } from './status-chip-select'

export interface SelectiveChipOption {
  value: string
  label: React.ReactNode
  icon?: React.ReactNode
  tone?: UiTone
}

export interface SelectiveChipProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'value' | 'onChange'
> {
  variant?: 'default' | 'plain'
  showValue?: boolean
  label: string
  value: string
  options: readonly SelectiveChipOption[]
  onValueChange: (value: string) => void
}

const toneIconTokens: Record<UiTone, string> = {
  subtle: 'var(--muted-foreground)',
  neutral: 'var(--muted-foreground)',
  info: 'var(--info)',
  accent: 'var(--primary)',
  attention: 'var(--warning)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--destructive)'
}

export function SelectiveChip({
  variant: _variant,
  options,
  ...props
}: SelectiveChipProps): React.ReactElement {
  void _variant
  const statusOptions: readonly StatusChipOption[] = options.map((option) => ({
    value: option.value,
    label: option.label,
    icon: option.icon ?? null,
    iconColorToken: toneIconTokens[option.tone ?? 'neutral']
  }))

  return <StatusChipSelect {...props} options={statusOptions} />
}
