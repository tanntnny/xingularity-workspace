import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileText, FolderKanban, LayoutDashboard, Plus, Clock } from 'lucide-react'
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

export interface CommandPaletteSearchResult {
  id: string
  kind: 'note' | 'project'
  title: string
  subtitle: string
  value: string
  keywords?: string[]
  tags?: string[]
  updatedAt?: string
}

type CommandPalettePage =
  | 'dashboard'
  | 'notes'
  | 'projects'
  | 'calendar'
  | 'weeklyPlan'
  | 'schedules'
  | 'settings'

interface CommandPaletteProps {
  open: boolean
  initialQuery?: string
  notes: NoteListItem[]
  searchResults: CommandPaletteSearchResult[]
  searchLoading?: boolean
  aiLoading?: boolean
  activeNotePath?: string | null
  recentNotePaths?: string[]
  onClose: () => void
  onCreate: () => void
  onQueryChange: (query: string) => void
  onRunAiPrompt: (prompt: string) => Promise<boolean>
  onOpenNote: (relPath: string) => void
  onOpenProject: (projectId: string) => void
  onOpenPage: (page: CommandPalettePage) => void
}

export function CommandPalette({
  open,
  initialQuery = '',
  notes,
  searchResults,
  searchLoading = false,
  aiLoading = false,
  activeNotePath,
  recentNotePaths = [],
  onClose,
  onCreate,
  onQueryChange,
  onRunAiPrompt,
  onOpenNote,
  onOpenProject,
  onOpenPage
}: CommandPaletteProps): ReactElement | null {
  const [query, setQuery] = useState('')
  const [hoveredResult, setHoveredResult] = useState<CommandPaletteSearchResult | null>(null)
  const [isWaitingForSearch, setIsWaitingForSearch] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const trimmedQuery = query.trim()
  const mode = trimmedQuery.startsWith('>')
    ? 'command'
    : trimmedQuery.startsWith('?')
      ? 'ai'
      : 'search'
  const isCommandMode = mode === 'command'
  const isAiMode = mode === 'ai'
  const searchQuery = mode === 'search' ? trimmedQuery : trimmedQuery.slice(1).trim()
  const aiActionValue = `?${searchQuery || 'ai'}`
  const aiNoteLabel = activeNotePath?.split('/').pop()?.replace(/\.md$/i, '') || 'current note'

  // Reset state when closing
  useEffect(() => {
    if (!open) {
      setQuery('')
      setHoveredResult(null)
      setIsWaitingForSearch(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    setQuery(initialQuery)
  }, [open, initialQuery])

  useEffect(() => {
    if (!open) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    if (isCommandMode || isAiMode) {
      setIsWaitingForSearch(false)
      onQueryChange('')
      return
    }

    if (!searchQuery) {
      setIsWaitingForSearch(false)
      onQueryChange('')
      return
    }

    setIsWaitingForSearch(true)
    const timeoutId = window.setTimeout(() => {
      setIsWaitingForSearch(false)
      onQueryChange(searchQuery)
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [open, isAiMode, isCommandMode, searchQuery, onQueryChange])

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
    const q = mode === 'search' ? query.trim().toLowerCase() : ''
    if (!q) {
      return notes.slice(0, 15)
    }
    return notes
      .filter((note) => {
        return (
          note.relPath.toLowerCase().includes(q) ||
          note.name.toLowerCase().includes(q) ||
          note.tags.some((tag) => tag.toLowerCase().includes(q))
        )
      })
      .slice(0, 15)
  }, [mode, notes, query])

  const noteResults = useMemo(
    () => searchResults.filter((result) => result.kind === 'note'),
    [searchResults]
  )

  const projectResults = useMemo(
    () => searchResults.filter((result) => result.kind === 'project'),
    [searchResults]
  )

  const commandItems = useMemo(
    () => [
      {
        value: '>new note',
        label: 'New Note',
        shortcut: '⌘N',
        onSelect: () => onCreate(),
        icon: Plus
      },
      {
        value: '>go dashboard',
        label: 'Go to Dashboard',
        onSelect: () => onOpenPage('dashboard'),
        icon: LayoutDashboard
      },
      {
        value: '>go notes',
        label: 'Go to Notes',
        onSelect: () => onOpenPage('notes'),
        icon: FileText
      },
      {
        value: '>go projects',
        label: 'Go to Projects',
        onSelect: () => onOpenPage('projects'),
        icon: FolderKanban
      },
      {
        value: '>go calendar',
        label: 'Go to Calendar',
        onSelect: () => onOpenPage('calendar'),
        icon: FolderKanban
      },
      {
        value: '>go weekly plan',
        label: 'Go to Weekly Plan',
        onSelect: () => onOpenPage('weeklyPlan'),
        icon: FolderKanban
      },
      {
        value: '>go schedules',
        label: 'Go to Schedules',
        onSelect: () => onOpenPage('schedules'),
        icon: FolderKanban
      },
      {
        value: '>go settings',
        label: 'Go to Settings',
        onSelect: () => onOpenPage('settings'),
        icon: FolderKanban
      }
    ],
    [onCreate, onOpenPage]
  )

  const allSelectableResults = useMemo(() => {
    const noteItems = filteredNotes.map((note) => ({
      id: `note:${note.relPath}`,
      value: `note:${note.relPath}`,
      title: note.name.replace(/\.md$/i, ''),
      subtitle: note.relPath,
      keywords: [note.name, note.relPath, ...note.tags],
      tags: note.tags,
      updatedAt: note.updatedAt,
      kind: 'note' as const
    }))

    const commandResults = commandItems.map((item) => ({
      id: item.value,
      kind: 'project' as const,
      title: item.label,
      subtitle: 'Command',
      value: item.value
    }))

    return [...searchResults, ...noteItems, ...commandResults]
  }, [commandItems, filteredNotes, searchResults])

  const handleSelect = useCallback(
    (value: string) => {
      if (value === 'new-note') {
        onCreate()
        onClose()
      } else if (value.startsWith('>')) {
        const command = commandItems.find((item) => item.value === value)
        command?.onSelect()
        onClose()
      } else if (value.startsWith('?')) {
        void (async () => {
          const didComplete = await onRunAiPrompt(searchQuery)
          if (didComplete) {
            onClose()
          }
        })()
      } else if (value.startsWith('note:')) {
        const relPath = value.replace('note:', '')
        onOpenNote(relPath)
        onClose()
      } else if (value.startsWith('project:')) {
        const projectId = value.replace('project:', '')
        onOpenProject(projectId)
        onClose()
      }
    },
    [commandItems, onCreate, onOpenNote, onOpenProject, onClose, onRunAiPrompt, searchQuery]
  )

  if (!open) {
    return null
  }

  return (
    <div
      className="command-palette-overlay fixed inset-0 z-50 grid place-items-start bg-black/40 pt-[18vh]"
      onClick={onClose}
    >
      <div
        className="command-palette-panel mx-auto flex w-[min(720px,92vw)] overflow-hidden rounded-xl border border-[var(--line-strong)] bg-[var(--panel)] shadow-[0_20px_60px_rgb(0_0_0_/_22%)]"
        onClick={(event) => event.stopPropagation()}
      >
        <Command
          className="flex-1"
          onValueChange={(value) => {
            const result = allSelectableResults.find((item) => item.value === value) ?? null
            setHoveredResult(result)
          }}
        >
          <CommandInput
            ref={inputRef}
            placeholder={
              isCommandMode
                ? 'Type a command...'
                : isAiMode
                  ? 'Ask AI to continue the current note...'
                  : 'Search notes and projects...'
            }
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[360px]">
            <CommandEmpty>
              {isCommandMode
                ? 'No commands found.'
                : isAiMode
                  ? activeNotePath
                    ? 'Type an instruction after ? to complete the current note.'
                    : 'Open a note before using AI note completion.'
                  : isWaitingForSearch || searchLoading
                    ? 'Searching...'
                    : 'No results found.'}
            </CommandEmpty>

            {isCommandMode ? (
              <CommandGroup heading="Commands">
                {commandItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <CommandItem key={item.value} value={item.value} onSelect={handleSelect}>
                      <Icon className="mr-2 h-4 w-4" />
                      <span>{item.label}</span>
                      {item.shortcut ? <CommandShortcut>{item.shortcut}</CommandShortcut> : null}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ) : isAiMode ? (
              <CommandGroup heading="AI Note Completion">
                <CommandItem
                  value={aiActionValue}
                  onSelect={handleSelect}
                  disabled={!activeNotePath || !searchQuery || aiLoading}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">
                      {aiLoading
                        ? 'Completing note with Mistral...'
                        : searchQuery
                          ? `Continue ${aiNoteLabel}`
                          : `Complete ${aiNoteLabel}`}
                    </div>
                    <div className="truncate text-xs text-[var(--muted)]">
                      {activeNotePath
                        ? searchQuery || 'Describe how AI should continue the note.'
                        : 'Open a note first to send its content to Mistral.'}
                    </div>
                  </div>
                  <CommandShortcut>{aiLoading ? '...' : 'Enter'}</CommandShortcut>
                </CommandItem>
              </CommandGroup>
            ) : (
              <CommandGroup heading="Quick Actions">
                <CommandItem value="new-note" onSelect={handleSelect}>
                  <Plus className="mr-2 h-4 w-4" />
                  <span>New Note</span>
                  <CommandShortcut>⌘N</CommandShortcut>
                </CommandItem>
              </CommandGroup>
            )}

            {recentNotes.length > 0 && !trimmedQuery && !isCommandMode && !isAiMode && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Recent Notes">
                  {recentNotes.map((note) => (
                    <CommandItem
                      key={`recent:${note.relPath}`}
                      value={`note:${note.relPath}`}
                      keywords={[note.name, note.relPath, ...note.tags]}
                      onSelect={handleSelect}
                    >
                      <Clock className="mr-2 h-4 w-4 text-[var(--muted)]" />
                      <span className="truncate">{note.name.replace(/\.md$/i, '')}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {!isCommandMode && !isAiMode ? <CommandSeparator /> : null}
            {!isCommandMode && !isAiMode && searchQuery ? (
              <>
                {!isWaitingForSearch ? (
                  <>
                    <CommandGroup heading="Notes">
                      {noteResults.map((result) => (
                        <CommandItem
                          key={result.id}
                          value={result.value}
                          keywords={result.keywords}
                          onSelect={handleSelect}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate">{result.title}</div>
                            <div className="truncate text-xs text-[var(--muted)]">
                              {result.subtitle}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>

                    <CommandGroup heading="Projects">
                      {projectResults.map((result) => (
                        <CommandItem
                          key={result.id}
                          value={result.value}
                          keywords={result.keywords}
                          onSelect={handleSelect}
                        >
                          <FolderKanban className="mr-2 h-4 w-4" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate">{result.title}</div>
                            <div className="truncate text-xs text-[var(--muted)]">
                              {result.subtitle}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                ) : null}
              </>
            ) : !isCommandMode && !isAiMode ? (
              <CommandGroup heading="All Notes">
                {filteredNotes.map((note) => (
                  <CommandItem
                    key={note.relPath}
                    value={`note:${note.relPath}`}
                    keywords={[note.name, note.relPath, ...note.tags]}
                    onSelect={handleSelect}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    <span className="truncate">{note.relPath}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>

        {/* Note Preview Panel */}
        {hoveredResult && (
          <div className="command-palette-preview hidden w-[260px] shrink-0 border-l border-[var(--line)] bg-[var(--panel-2)] p-4 md:block">
            <div className="mb-2 text-sm font-semibold text-[var(--text)]">
              {hoveredResult.title}
            </div>
            <div className="mb-3 text-xs text-[var(--muted)]">{hoveredResult.subtitle}</div>
            {hoveredResult.tags && hoveredResult.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {hoveredResult.tags.slice(0, 5).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs text-[var(--accent)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {hoveredResult.updatedAt ? (
              <div className="mt-3 text-xs text-[var(--muted)]">
                Updated: {new Date(hoveredResult.updatedAt).toLocaleDateString()}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
