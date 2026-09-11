import type { ReactElement } from 'react'

import { getTagChipItem } from '../lib/statusChipMeta'
import { Button } from './ui/button'
import { HardDrive, TagOutline, X } from './ui/icons'
import { StatusChip, type StatusChipLabelOverflow } from './ui/status-chip'

interface TagChipProps {
  tag: string
  kind?: 'tag' | 'resource'
  onClick?: (tag: string) => void
  onRemove?: (tag: string) => void
  className?: string
  labelOverflow?: StatusChipLabelOverflow
}

export function TagChip({
  tag,
  kind = 'tag',
  onClick,
  onRemove,
  className,
  labelOverflow = 'fade'
}: TagChipProps): ReactElement {
  const item =
    kind === 'resource'
      ? {
          ...getTagChipItem(tag),
          icon: <HardDrive aria-hidden="true" />,
          iconColorToken: 'var(--status-chip-resource-reference-icon)'
        }
      : {
          ...getTagChipItem(tag),
          icon: <TagOutline aria-hidden="true" />
        }
  const chip = onClick ? (
    <StatusChip
      as="button"
      item={item}
      className={className}
      labelOverflow={labelOverflow}
      onClick={() => onClick(tag)}
      aria-label={`Search tag ${tag}`}
    />
  ) : (
    <StatusChip item={item} className={className} labelOverflow={labelOverflow} />
  )

  if (!onRemove) {
    return chip
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      {chip}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        shape="pill"
        className="h-auto w-auto shrink-0 p-1 text-xs leading-none text-foreground opacity-80 hover:bg-muted hover:text-foreground hover:opacity-100"
        onClick={() => onRemove(tag)}
        aria-label={`Remove tag ${tag}`}
      >
        <X size={14} aria-hidden="true" />
      </Button>
    </span>
  )
}
