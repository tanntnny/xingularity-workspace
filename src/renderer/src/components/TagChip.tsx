import { ReactElement } from 'react'
import { Tag } from './ui/icons'
import { getTagColorIndex } from '../utils/tagColor'
import { Badge, type BadgeProps } from './ui/badge'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

interface TagChipProps {
  tag: string
  onClick?: (tag: string) => void
  onRemove?: (tag: string) => void
}

const tagVariants: BadgeProps['variant'][] = ['tag0', 'tag1', 'tag2', 'tag3', 'tag4', 'tag5']

export function TagChip({ tag, onClick, onRemove }: TagChipProps): ReactElement {
  const colorIndex = getTagColorIndex(tag)
  const variant = tagVariants[colorIndex]

  return (
    <Badge
      variant={variant}
      className={cn(
        'min-w-0 shrink-0 gap-1 px-2 py-0.5 font-normal leading-[1.2]',
        onClick && 'cursor-pointer'
      )}
    >
      {onClick ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto min-w-0 gap-1 p-0 text-inherit hover:bg-transparent hover:text-inherit"
          onClick={() => onClick(tag)}
          aria-label={`Search tag ${tag}`}
        >
          <Tag size={11} aria-hidden="true" />
          <span className="truncate">{tag}</span>
        </Button>
      ) : (
        <>
          <Tag size={11} aria-hidden="true" />
          <span className="truncate">{tag}</span>
        </>
      )}
      {onRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto w-auto p-0 text-xs leading-none text-inherit opacity-80 hover:bg-transparent hover:text-inherit hover:opacity-100"
          onClick={() => onRemove(tag)}
          aria-label={`Remove tag ${tag}`}
        >
          x
        </Button>
      ) : null}
    </Badge>
  )
}
