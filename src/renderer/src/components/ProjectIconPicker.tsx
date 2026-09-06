import { useMemo, useRef, useState, type ReactElement } from 'react'
import type { ProjectIconStyle, ProjectIconVariant } from '../../../shared/types'
import { PROJECT_ICON_COLORS } from '../../../shared/projectIcons'
import { cn } from '../lib/utils'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ToggleGroup,
  ToggleGroupItem
} from './ui'
import { NoteShapeIcon } from './NoteShapeIcon'
import { PROJECT_ICON_PICKER_RESULT_LIMIT, searchProjectIcons } from '../lib/projectIconCatalog'
import { ProjectIconSvg } from './ui/project-icon'
import { TooltipButton } from './ui/tooltip'

function getIconVariantLabel(variant: ProjectIconVariant): string {
  return variant === 'filled' ? 'Filled' : 'Outline'
}

export interface ProjectIconPickerProps {
  icon: ProjectIconStyle
  onChange: (icon: ProjectIconStyle) => void
  testId?: string
  entityLabel?: string
  iconOptionTestIdPrefix?: string
}

export function ProjectIconPicker({
  icon,
  onChange,
  testId = 'project-icon-picker-trigger',
  entityLabel = 'project',
  iconOptionTestIdPrefix = 'project-icon-option'
}: ProjectIconPickerProps): ReactElement {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const searchResult = useMemo(
    () => searchProjectIcons(query, { glyph: icon.glyph, variant: icon.variant }),
    [icon.glyph, icon.variant, query]
  )
  const trimmedQuery = query.trim()

  const handleIconChange = (
    glyph: ProjectIconStyle['glyph'],
    variant: ProjectIconVariant
  ): void => {
    if (!glyph) return

    onChange({
      ...icon,
      set: 'tabler',
      glyph,
      shape: undefined,
      variant
    })
  }

  const handleColorChange = (color: string): void => {
    onChange({ ...icon, color })
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setQuery('')
      }}
    >
      <TooltipButton label={`Change ${entityLabel} icon`}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="rounded-lg outline-none transition-shadow hover:ring-2 hover:ring-ring/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`Change ${entityLabel} icon`}
            aria-expanded={open}
            aria-haspopup="dialog"
            data-testid={testId}
          >
            <NoteShapeIcon icon={icon} size={40} surface="subtle" />
          </button>
        </PopoverTrigger>
      </TooltipButton>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[min(20rem,calc(100vw-1rem))] overflow-hidden p-0"
        aria-label={`Choose ${entityLabel} icon`}
        data-icon-picker-content="true"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <Command shouldFilter={false} className="rounded-md">
          <CommandInput
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            placeholder="Search icon names..."
            aria-label={`Search ${entityLabel} icons`}
            autoComplete="off"
            spellCheck={false}
          />
          <CommandSeparator />
          <div className="space-y-2 px-3 py-2.5">
            <div className="text-xs font-medium text-muted-foreground">Color</div>
            <ToggleGroup
              type="single"
              value={icon.color}
              onValueChange={(value) => {
                if (value) handleColorChange(value)
              }}
              aria-label={`${entityLabel[0]?.toUpperCase() ?? ''}${entityLabel.slice(1)} icon color`}
              className="h-auto min-h-8 w-full max-w-full flex-wrap justify-start gap-1.5 rounded-none bg-transparent"
            >
              {PROJECT_ICON_COLORS.map((color) => (
                <ToggleGroupItem
                  key={color}
                  value={color}
                  aria-label={`Select ${color} icon color`}
                  title={color}
                  className="size-6 rounded-full border-2 border-transparent p-0 data-[state=on]:border-foreground data-[state=on]:ring-2 data-[state=on]:ring-ring data-[state=on]:ring-offset-1"
                >
                  <span
                    className="size-4 rounded-full border border-foreground/10"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <CommandSeparator />
          <CommandList
            className="max-h-72 overflow-y-auto"
            aria-label={`${entityLabel[0]?.toUpperCase() ?? ''}${entityLabel.slice(1)} icon results`}
          >
            {searchResult.entries.length === 0 ? (
              <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                No icons found{trimmedQuery ? ` for “${trimmedQuery}”` : ''}. Try a different name.
              </CommandEmpty>
            ) : (
              <CommandGroup
                heading={trimmedQuery ? 'Search results' : 'Popular icons'}
                className="px-0 py-1 [&_[cmdk-group-heading]]:px-2"
              >
                <div className="grid grid-cols-6 gap-1 p-2">
                  {searchResult.entries.map((entry) => {
                    const variantLabel = getIconVariantLabel(entry.variant)
                    const isCurrent = entry.glyph === icon.glyph && entry.variant === icon.variant

                    return (
                      <CommandItem
                        key={`${entry.glyph}:${entry.variant}`}
                        value={`${entry.label} ${entry.glyph} ${entry.variant}`}
                        onSelect={() => handleIconChange(entry.glyph, entry.variant)}
                        aria-label={`${entry.label}, ${variantLabel}${isCurrent ? ', selected' : ''}`}
                        title={`${entry.label} · ${variantLabel}`}
                        data-testid={`${iconOptionTestIdPrefix}:${entry.glyph}:${entry.variant}`}
                        data-icon-variant={entry.variant}
                        data-current={isCurrent}
                        className={cn(
                          'flex size-10 cursor-pointer items-center justify-center rounded-md p-0 [&_svg]:size-5',
                          isCurrent && 'bg-muted text-foreground ring-1 ring-ring'
                        )}
                      >
                        <ProjectIconSvg
                          iconNode={entry.iconNode}
                          glyph={entry.glyph}
                          variant={entry.variant}
                          size={20}
                          aria-hidden="true"
                        />
                      </CommandItem>
                    )
                  })}
                </div>
              </CommandGroup>
            )}
          </CommandList>
          {searchResult.isTruncated ? (
            <div
              className="border-t border-border px-3 py-2 text-xs text-muted-foreground"
              role="status"
            >
              Showing the first {PROJECT_ICON_PICKER_RESULT_LIMIT} of {searchResult.totalMatches}{' '}
              results. Keep typing to narrow the list.
            </div>
          ) : null}
          <div className="sr-only" aria-live="polite">
            {trimmedQuery
              ? `${searchResult.totalMatches} icon${searchResult.totalMatches === 1 ? '' : 's'} found`
              : `${searchResult.entries.length} popular icons`}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
