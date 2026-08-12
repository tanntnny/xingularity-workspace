import { useMemo, useState, type ReactElement } from 'react'
import type { ProjectIconStyle } from '../../../shared/types'
import { PROJECT_ICON_COLORS } from '../../../shared/projectIcons'
import { cn } from '../lib/utils'
import {
  Command,
  CommandEmpty,
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
import { PROJECT_ICON_CATALOG } from '../lib/projectIconCatalog'

interface ProjectIconPickerProps {
  icon: ProjectIconStyle
  onChange: (icon: ProjectIconStyle) => void
  testId?: string
}

export function ProjectIconPicker({
  icon,
  onChange,
  testId = 'project-icon-picker-trigger'
}: ProjectIconPickerProps): ReactElement {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filteredIcons = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return PROJECT_ICON_CATALOG
    }

    return PROJECT_ICON_CATALOG.filter(
      (entry) =>
        entry.label.toLowerCase().includes(normalizedQuery) ||
        entry.glyph.toLowerCase().includes(normalizedQuery)
    )
  }, [query])

  const handleIconChange = (glyph: ProjectIconStyle['glyph']): void => {
    if (!glyph) return

    onChange({
      ...icon,
      set: 'tabler',
      glyph,
      shape: undefined,
      variant: 'filled'
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
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-lg outline-none transition-shadow hover:ring-2 hover:ring-ring/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Change project icon"
          title="Change project icon"
          data-testid={testId}
        >
          <NoteShapeIcon icon={icon} size={36} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-80 overflow-hidden p-0"
        aria-label="Choose project icon"
      >
        <Command shouldFilter={false} className="rounded-md">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search icon names..."
            aria-label="Search project icons"
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
              aria-label="Project icon color"
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
          <CommandList className="max-h-72 overflow-y-auto">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              No icons found.
            </CommandEmpty>
            <div className="grid grid-cols-6 gap-1 p-2">
              {filteredIcons.map((entry) => {
                const isCurrent = entry.glyph === icon.glyph
                const Icon = entry.Icon

                return (
                  <CommandItem
                    key={entry.glyph}
                    value={`${entry.label} ${entry.glyph}`}
                    onSelect={() => handleIconChange(entry.glyph)}
                    aria-label={`${entry.label}${isCurrent ? ', selected' : ''}`}
                    title={entry.label}
                    data-testid={`project-icon-option:${entry.glyph}`}
                    data-current={isCurrent}
                    className={cn(
                      'flex size-10 cursor-pointer items-center justify-center rounded-md p-0 [&_svg]:size-5',
                      isCurrent && 'bg-accent text-accent-foreground ring-1 ring-ring'
                    )}
                  >
                    <Icon aria-hidden="true" />
                  </CommandItem>
                )
              })}
            </div>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
