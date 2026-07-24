import { type ReactElement, type ReactNode, useEffect, useRef } from 'react'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut
} from '../ui/command'
import { Pallete, PalleteSearchBar } from '../ui/pallete'
import { type ShortcutKey } from '../ui/kbd'

export interface WorkspaceCommandPaletteItem {
  id: string
  label: ReactNode
  icon?: ReactNode
  keywords?: readonly string[]
  shortcut?: readonly ShortcutKey[]
  disabled?: boolean
  onSelect: () => void
}

export interface WorkspaceCommandPaletteGroup {
  id: string
  heading?: string
  items: readonly WorkspaceCommandPaletteItem[]
}

export interface WorkspaceCommandPaletteProps {
  open: boolean
  groups: readonly WorkspaceCommandPaletteGroup[]
  onOpenChange: (open: boolean) => void
  placeholder?: string
  emptyLabel?: ReactNode
}

export function WorkspaceCommandPalette({
  open,
  groups,
  onOpenChange,
  placeholder = 'Search commands and pages...',
  emptyLabel = 'No matching commands.'
}: WorkspaceCommandPaletteProps): ReactElement {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const frameId = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frameId)
  }, [open])

  return (
    <Pallete
      open={open}
      aria-label="Command palette"
      className="command-palette-top-aligned !top-[clamp(7rem,25vh,16rem)] !-translate-y-0 !p-3"
      onOpenChange={onOpenChange}
    >
      <Command className="flex-1">
        <PalleteSearchBar data-cmdk-input-wrapper="" className="command-palette-search-bar">
          <CommandInput bare ref={inputRef} placeholder={placeholder} />
        </PalleteSearchBar>
        <CommandList className="max-h-[min(52vh,32rem)] px-1 py-2">
          <CommandEmpty>{emptyLabel}</CommandEmpty>
          {groups.map((group, groupIndex) => (
            <div key={group.id}>
              {groupIndex > 0 ? <CommandSeparator /> : null}
              <CommandGroup heading={group.heading}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    keywords={item.keywords ? [...item.keywords] : undefined}
                    disabled={item.disabled}
                    onSelect={() => {
                      item.onSelect()
                      onOpenChange(false)
                    }}
                  >
                    {item.icon ? (
                      <span className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center text-[var(--accent)]">
                        {item.icon}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.shortcut ? <CommandShortcut keys={item.shortcut} /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          ))}
        </CommandList>
      </Command>
    </Pallete>
  )
}
