import { ReactElement } from 'react'
import { getTagColorVariant } from '../utils/tagColor'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

interface TagChipProps {
  tag: string
  onClick?: (tag: string) => void
  onRemove?: (tag: string) => void
}

export function TagChip({ tag, onClick, onRemove }: TagChipProps): ReactElement {
  return (
    <Badge
      variant={getTagColorVariant(tag)}
      className={cn(
        'min-w-0 shrink-0 px-2 py-0.5 font-normal leading-[1.2]',
        onClick && 'cursor-pointer'
      )}
    >
      {onClick ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto min-w-0 rounded-[var(--radius-control)] px-1 text-inherit hover:bg-accent/50 hover:text-foreground"
          onClick={() => onClick(tag)}
          aria-label={`Search tag ${tag}`}
        >
          <span className="truncate">{tag}</span>
        </Button>
      ) : (
        <span className="truncate">{tag}</span>
      )}
      {onRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto w-auto rounded-[var(--radius-control)] p-0.5 text-xs leading-none text-inherit opacity-80 hover:bg-accent/50 hover:text-foreground hover:opacity-100"
          onClick={() => onRemove(tag)}
          aria-label={`Remove tag ${tag}`}
        >
          x
        </Button>
      ) : null}
    </Badge>
  )
}
