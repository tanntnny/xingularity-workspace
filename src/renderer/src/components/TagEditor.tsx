import { useId, useMemo, type ReactElement } from 'react'
import { normalizeTag } from '../../../shared/noteTags'
import { cn } from '../lib/utils'
import { TagChip } from './TagChip'
import { Search, TagOutline } from './ui/icons'
import { SelectionPopover, type SelectionPopoverOption } from './ui/selection-popover'
import { StatusChip, type StatusChipSurface } from './ui/status-chip'

export interface TagEditorProps {
  value: string[]
  availableTags?: readonly string[]
  onChange: (tags: string[]) => void
  onFind?: (tag: string) => void
  label?: string
  searchPlaceholder?: string
  testId?: string
  className?: string
  surface?: StatusChipSurface
}

const TAG_CREATE_ERROR = 'Use letters, numbers, dash, underscore, or a namespace colon.'

export function TagEditor({
  value,
  availableTags = [],
  onChange,
  onFind,
  label = 'Tags',
  searchPlaceholder = 'Search or add tags',
  testId,
  className,
  surface = 'pill'
}: TagEditorProps): ReactElement {
  const labelId = useId()
  const options = useMemo<SelectionPopoverOption[]>(() => {
    const values = new Set<string>()

    for (const tag of [...availableTags, ...value]) {
      const normalized = normalizeTag(tag)
      if (normalized) values.add(normalized)
    }

    return Array.from(values)
      .sort((left, right) => left.localeCompare(right))
      .map((tag) => ({
        value: tag,
        searchText: `#${tag}`,
        label: <TagChip tag={tag} className="w-full max-w-full" labelOverflow="fade" />,
        action: onFind
          ? {
              label: `Search tag ${tag}`,
              icon: <Search size={14} aria-hidden="true" />,
              onSelect: () => onFind(tag)
            }
          : undefined
      }))
  }, [availableTags, onFind, value])

  const handleCreate = (tag: string): void => {
    if (value.includes(tag)) return
    onChange([...value, tag])
  }

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      data-testid={testId}
      className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}
    >
      <span id={labelId} className="sr-only">
        {label}
      </span>
      <SelectionPopover
        selectionMode="multiple"
        value={value}
        options={options}
        onValueChange={onChange}
        onCreate={handleCreate}
        getCreateValue={normalizeTag}
        createError={TAG_CREATE_ERROR}
        label={`${label} selection`}
        searchPlaceholder={searchPlaceholder}
        testId={testId ? `${testId}-popover` : undefined}
      >
        <StatusChip
          as="button"
          item={{
            label: 'Tags',
            icon: <TagOutline aria-hidden="true" />,
            iconColorToken: 'var(--muted-foreground)'
          }}
          type="button"
          surface={surface}
          title={label}
          aria-label={`${label} selection`}
          data-testid={testId ? `${testId}-trigger` : undefined}
        />
      </SelectionPopover>
    </div>
  )
}
