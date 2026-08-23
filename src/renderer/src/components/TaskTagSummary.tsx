import type { ReactElement } from 'react'
import { Badge } from './ui/badge'
import { TagChip } from './TagChip'
import { cn } from '../lib/utils'

interface TaskTagSummaryProps {
  tags: string[]
  mode?: 'compact' | 'full'
  className?: string
}

export function TaskTagSummary({
  tags,
  mode = 'compact',
  className
}: TaskTagSummaryProps): ReactElement | null {
  if (tags.length === 0) {
    return null
  }

  if (mode === 'full') {
    return (
      <div className={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)}>
        {tags.map((tag) => (
          <TagChip key={tag} tag={tag} />
        ))}
      </div>
    )
  }

  return (
    <div
      data-testid="task-tags-summary"
      className={cn('flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden', className)}
      title={tags.join(', ')}
    >
      <TagChip tag={tags[0]} className="max-w-full truncate" />
      {tags.length > 1 ? (
        <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
          +{tags.length - 1}
        </Badge>
      ) : null}
    </div>
  )
}
