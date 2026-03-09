import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Plus, Search, Clock } from 'lucide-react'
import { NoteListItem } from '../../../shared/types'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut
} from './ui/command'

interface CommandPaletteProps {
  open: boolean
  notes: NoteListItem[]
  recentNotePaths?: string[]
  onClose: () => void
  onCreate: () => void
  onSearch: () => void
  onOpenNote: (relPath: string) => void
}

export function CommandPalette({
  open,
  notes,
  recentNotePaths = [],
  onClose,
  onCreate,
  onSearch,
  onOpenNote
}: CommandPaletteProps): ReactElement | null {
  const [query, setQuery] = useState('')
  const [hoveredNote, setHoveredNote] = useState<NoteListItem | null>(null)

  // Reset state when closing
  useEffect(() => {
    if (!open) {
      setQuery('')
      setHoveredNote(null)
    }
  }, [open])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && open) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Get recent notes
  const recentNotes = useMemo(() => {
    if (recentNotePaths.length === 0) return []
    return recentNotePaths
      .map((path) => notes.find((note) => note.relPath === path))
      .filter((note): note is NoteListItem => note !== undefined)
      .slice(0, 5)
  }, [notes, recentNotePaths])

  // Filter notes based on query
  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return notes.slice(0, 15)
    }
    return notes.filter((note) => note.relPath.toLowerCase().includes(q)).slice(0, 15)
  }, [notes, query])

  const handleSelect = useCallback(
    (value: string) => {
      if (value === 'new-note') {
        onCreate()
        onClose()
      } else if (value === 'search-notes') {
        onSearch()
        onClose()
      } else if (value.startsWith('note:')) {
        const relPath = value.replace('note:', '')
        onOpenNote(relPath)
        onClose()
      }
    },
    [onCreate, onSearch, onOpenNote, onClose]
  )

  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start bg-black/40 pt-[18vh]"
      onClick={onClose}
    >
      <div
        className="mx-auto flex w-[min(720px,92vw)] overflow-hidden rounded-xl border border-[var(--line-strong)] bg-[var(--panel)] shadow-[0_20px_60px_rgb(0_0_0_/_22%)]"
        onClick={(event) => event.stopPropagation()}
      >
        <Command
          className="flex-1"
          onValueChange={(value) => {
            const note = notes.find((n) => `note:${n.relPath}` === value)
            setHoveredNote(note || null)
          }}
        >
          <CommandInput
            placeholder="Type a command or search notes..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[360px]">
            <CommandEmpty>No results found.</CommandEmpty>

            <CommandGroup heading="Quick Actions">
              <CommandItem value="new-note" onSelect={handleSelect}>
                <Plus className="mr-2 h-4 w-4" />
                <span>New Note</span>
                <CommandShortcut>⌘N</CommandShortcut>
              </CommandItem>
              <CommandItem value="search-notes" onSelect={handleSelect}>
                <Search className="mr-2 h-4 w-4" />
                <span>Search Notes</span>
                <CommandShortcut>⌘F</CommandShortcut>
              </CommandItem>
            </CommandGroup>

            {recentNotes.length > 0 && !query && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Recent Notes">
                  {recentNotes.map((note) => (
                    <CommandItem
                      key={`recent:${note.relPath}`}
                      value={`note:${note.relPath}`}
                      onSelect={handleSelect}
                    >
                      <Clock className="mr-2 h-4 w-4 text-[var(--muted)]" />
                      <span className="truncate">{note.name.replace(/\.md$/i, '')}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            <CommandSeparator />
            <CommandGroup heading={query ? 'Search Results' : 'All Notes'}>
              {filteredNotes.map((note) => (
                <CommandItem
                  key={note.relPath}
                  value={`note:${note.relPath}`}
                  onSelect={handleSelect}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span className="truncate">{note.relPath}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>

        {/* Note Preview Panel */}
        {hoveredNote && (
          <div className="hidden w-[260px] shrink-0 border-l border-[var(--line)] bg-[var(--panel-2)] p-4 md:block">
            <div className="mb-2 text-sm font-semibold text-[var(--text)]">
              {hoveredNote.name.replace(/\.md$/i, '')}
            </div>
            <div className="mb-3 text-xs text-[var(--muted)]">{hoveredNote.relPath}</div>
            {hoveredNote.tags && hoveredNote.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {hoveredNote.tags.slice(0, 5).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs text-[var(--accent)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-3 text-xs text-[var(--muted)]">
              Updated: {new Date(hoveredNote.updatedAt).toLocaleDateString()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
