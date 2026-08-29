import { useId, useMemo, type ReactElement } from 'react'
import { normalizeTag } from '../../../shared/noteTags'
import { cn } from '../lib/utils'
import { TagChip } from './TagChip'
import { TagPickerPopover, type TagPickerOption } from './TagPickerPopover'
import { type StatusChipSurface } from './ui/status-chip'

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
  maxTagCount?: number
  maxTagLength?: number
  triggerId?: string
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
  surface = 'pill',
  maxTagCount,
  maxTagLength,
  triggerId
}: TagEditorProps): ReactElement {
  const labelId = useId()
  const options = useMemo<TagPickerOption[]>(() => {
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
        label: (
          <span className="w-full">
            <TagChip tag={tag} className="w-full max-w-full" labelOverflow="fade" />
          </span>
        )
      }))
  }, [availableTags, value])

  const getCreateValue = (query: string): string | null => {
    const normalized = normalizeTag(query)
    if (!normalized || (maxTagLength !== undefined && normalized.length > maxTagLength)) {
      return null
    }
    return normalized
  }

  const handleCreate = (tag: string): void => {
    if (value.includes(tag) || (maxTagCount !== undefined && value.length >= maxTagCount)) return
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
      <TagPickerPopover
        value={value}
        options={options}
        onValueChange={onChange}
        onCreate={handleCreate}
        onFind={onFind}
        getCreateValue={getCreateValue}
        createError={
          maxTagLength !== undefined
            ? `${TAG_CREATE_ERROR} Tags must be ${maxTagLength} characters or fewer.`
            : TAG_CREATE_ERROR
        }
        maxCount={maxTagCount}
        label={label}
        searchPlaceholder={searchPlaceholder}
        testId={testId ? `${testId}-popover` : undefined}
        triggerTestId={testId ? `${testId}-trigger` : undefined}
        surface={surface}
        triggerId={triggerId}
        className="w-fit max-w-full"
      />
    </div>
  )
}
