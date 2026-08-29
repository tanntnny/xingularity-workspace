import type { ReactElement } from 'react'
import type { ResourceLabel } from '../../../shared/types'

import { TagOutline } from './ui/icons'
import { StatusChip } from './ui/status-chip'

export interface ResourceLabelChipProps {
  label: ResourceLabel
  className?: string
}

export function ResourceLabelChip({ label, className }: ResourceLabelChipProps): ReactElement {
  const value = `${label.key}=${label.value}`

  return (
    <StatusChip
      item={{
        label: value,
        icon: <TagOutline aria-hidden="true" />,
        iconColorToken: 'var(--muted-foreground)'
      }}
      surface="pill"
      labelOverflow="fade"
      className={className}
      title={value}
      aria-label={`Resource label ${value}`}
    />
  )
}
