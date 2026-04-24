import {
  ReactElement,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  CreditCard,
  Clock,
  FileText,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  LayoutGrid,
  PenTool,
  Plus
} from 'lucide-react'
import { stripNoteExtension } from '../../../shared/noteDocument'
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
import { GRID_PAGE_ENABLED } from '../lib/featureFlags'
import { useStaggeredScrollReveal } from '../hooks/useStaggeredScrollReveal'

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
  | 'knowledge'
  | 'notes'
  | 'projects'
  | 'subscriptions'
  | 'grid'
  | 'excalidraw'
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
  const paletteItemIconClass =
    'mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_srgb,var(--accent-line)_24%,var(--line))] bg-[color:color-mix(in_srgb,var(--accent-soft)_72%,var(--panel))] text-[var(--accent)] transition-colors group-data-[selected=true]:border-[var(--accent-line)] group-data-[selected=true]:bg-[color:color-mix(in_srgb,var(--accent-soft)_92%,var(--panel))] group-data-[selected=true]:text-[var(--accent)]'
  const [query, setQuery] = useState('')
  const [hoveredResult, setHoveredResult] = useState<CommandPaletteSearchResult | null>(null)
  const [isWaitingForSearch, setIsWaitingForSearch] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const deferredQuery = useDeferredValue(query)
  const trimmedQuery = query.trim()
  const deferredTrimmedQuery = deferredQuery.trim()
  const mode = trimmedQuery.startsWith('>')
    ? 'command'
    : trimmedQuery.startsWith('?')
      ? 'ai'
      : 'search'
  const deferredMode = deferredTrimmedQuery.startsWith('>')
    ? 'command'
    : deferredTrimmedQuery.startsWith('?')
      ? 'ai'
      : 'search'
  const isCommandMode = mode === 'command'
  const isAiMode = mode === 'ai'
  const searchQuery = mode === 'search' ? trimmedQuery : trimmedQuery.slice(1).trim()
  const deferredSearchQuery =
    deferredMode === 'search' ? deferredTrimmedQuery : deferredTrimmedQuery.slice(1).trim()
  const isBodySearch = mode === 'search' && searchQuery.startsWith('@')
  const isDeferredBodySearch = deferredMode === 'search' && deferredSearchQuery.startsWith('@')
  const searchableQuery = isBodySearch ? searchQuery.slice(1).trim() : searchQuery
  const deferredSearchableQuery = isDeferredBodySearch
    ? deferredSearchQuery.slice(1).trim()
    : deferredSearchQuery
  const aiActionValue = `?${searchQuery || 'ai'}`
  const aiNoteLabel = activeNotePath?.split('/').pop()
    ? stripNoteExtension(activeNotePath.split('/').pop()!)
    : 'current note'

  // Reset state when closing
  useEffect(() => {
    if (!open) {
      const frameId = window.requestAnimationFrame(() => {
        setQuery('')
        setHoveredResult(null)
        setIsWaitingForSearch(false)
      })

      return () => window.cancelAnimationFrame(frameId)
    }

    return
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      setQuery(initialQuery)
    })

    return () => window.cancelAnimationFrame(frameId)
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
      const frameId = window.requestAnimationFrame(() => {
        setIsWaitingForSearch(false)
      })
      onQueryChange('')
      return () => window.cancelAnimationFrame(frameId)
    }

    if (!searchableQuery) {
      const frameId = window.requestAnimationFrame(() => {
        setIsWaitingForSearch(false)
      })
      onQueryChange('')
      return () => window.cancelAnimationFrame(frameId)
    }

    if (searchableQuery.length < 2) {
      const frameId = window.requestAnimationFrame(() => {
        setIsWaitingForSearch(false)
      })
      onQueryChange('')
      return () => window.cancelAnimationFrame(frameId)
    }

    const frameId = window.requestAnimationFrame(() => {
      setIsWaitingForSearch(true)
    })
    let searchFrameId = 0
    const timeoutId = window.setTimeout(() => {
      searchFrameId = window.requestAnimationFrame(() => {
        setIsWaitingForSearch(false)
        onQueryChange(searchQuery)
      })
    }, 300)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.cancelAnimationFrame(searchFrameId)
      window.clearTimeout(timeoutId)
    }
  }, [open, isAiMode, isCommandMode, searchQuery, searchableQuery, onQueryChange])

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
    const explicitlyRecentNotes = recentNotePaths
      .map((path) => notes.find((note) => note.relPath === path))
      .filter((note): note is NoteListItem => note !== undefined)

    if (explicitlyRecentNotes.length > 0) {
      return explicitlyRecentNotes.slice(0, 5)
    }

    return [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)
  }, [notes, recentNotePaths])

  // Filter notes based on query
  const filteredNotes = useMemo(() => {
    const q = deferredMode === 'search' ? deferredSearchableQuery.toLowerCase() : ''
    if (!q) {
      return notes.slice(0, 15)
    }
    return notes
      .filter((note) => {
        if (isDeferredBodySearch) {
          return (note.bodyPreview ?? '').toLowerCase().includes(q)
        }

        const aliases = note.mentionTargets ?? []
        return (
          note.relPath.toLowerCase().includes(q) ||
          note.name.toLowerCase().includes(q) ||
          aliases.some((alias) => alias.toLowerCase().includes(q))
        )
      })
      .slice(0, 15)
  }, [deferredMode, deferredSearchableQuery, isDeferredBodySearch, notes])

  const noteResults = useMemo(
    () => searchResults.filter((result) => result.kind === 'note'),
    [searchResults]
  )

  const projectResults = useMemo(
    () => searchResults.filter((result) => result.kind === 'project'),
    [searchResults]
  )
  const fallbackSearchNotes = useMemo(() => {
    if (!searchableQuery || noteResults.length > 0) {
      return []
    }

    return filteredNotes
  }, [filteredNotes, noteResults.length, searchableQuery])

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
        value: '>go knowledge',
        label: 'Go to Knowledge',
        shortcut: '⌘K',
        onSelect: () => onOpenPage('knowledge'),
        icon: GitBranch
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
        value: '>go subscriptions',
        label: 'Go to Subscriptions',
        onSelect: () => onOpenPage('subscriptions'),
        icon: CreditCard
      },
      ...(GRID_PAGE_ENABLED
        ? [
            {
              value: '>go grid',
              label: 'Go to Grid',
              onSelect: () => onOpenPage('grid'),
              icon: LayoutGrid
            }
          ]
        : []),
      {
        value: '>go excalidraw',
        label: 'Go to Excalidraw',
        onSelect: () => onOpenPage('excalidraw'),
        icon: PenTool
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

  const revealItemIds = useMemo(() => {
    if (isCommandMode) {
      return commandItems.map((item) => `command:${item.value}`)
    }

    if (isAiMode) {
      return ['ai-action']
    }

    const ids = ['quick:new-note']

    if (recentNotes.length > 0 && !trimmedQuery) {
      ids.push(...recentNotes.map((note) => `recent:${note.relPath}`))
    }

    if (searchableQuery) {
      ids.push(...noteResults.map((result) => `search:${result.id}`))
      ids.push(...projectResults.map((result) => `search:${result.id}`))
      ids.push(...fallbackSearchNotes.map((note) => `fallback:${note.relPath}`))
      return ids
    }

    ids.push(...filteredNotes.map((note) => `note:${note.relPath}`))
    return ids
  }, [
    commandItems,
    filteredNotes,
    isAiMode,
    isCommandMode,
    noteResults,
    fallbackSearchNotes,
    projectResults,
    recentNotes,
    searchableQuery,
    trimmedQuery
  ])

  const { containerRef, getRevealItemProps } = useStaggeredScrollReveal(revealItemIds, {
    resetKey: open
  })

  const allSelectableResults = useMemo(() => {
    const noteItems = filteredNotes.map((note) => ({
      id: `note:${note.relPath}`,
      value: `note:${note.relPath}`,
      title: stripNoteExtension(note.name),
      subtitle: note.relPath,
      keywords: [note.name, note.relPath, ...note.tags],
      tags: note.tags,
      updatedAt: note.updatedAt,
      kind: 'note' as const
    }))

    const recentNoteItems = recentNotes.map((note) => ({
      id: `recent:${note.relPath}`,
      value: `recent:${note.relPath}`,
      title: stripNoteExtension(note.name),
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

    return [...searchResults, ...recentNoteItems, ...noteItems, ...commandResults]
  }, [commandItems, filteredNotes, recentNotes, searchResults])

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
      } else if (value.startsWith('note:') || value.startsWith('recent:')) {
        const relPath = value.replace(/^note:|^recent:/, '')
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

  const passthroughCommandFilter = useCallback(() => 1, [])

  if (!open) {
    return null
  }

  return (
    <div
      className="dialog-glass-overlay command-palette-overlay fixed inset-0 z-50 grid place-items-start pt-[18vh]"
      onClick={onClose}
    >
      <div
        className="dialog-glass-surface command-palette-panel mx-auto flex w-[min(720px,92vw)] overflow-hidden rounded-lg border-[var(--accent)]"
        onClick={(event) => event.stopPropagation()}
      >
        <Command
          shouldFilter={false}
          filter={passthroughCommandFilter}
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
                  : 'Search names, aliases, paths... use @ for body'
            }
            value={query}
            onValueChange={setQuery}
          />
          <CommandList ref={containerRef} className="max-h-[360px]">
            <CommandEmpty>
              {isCommandMode
                ? 'No commands found.'
                : isAiMode
                  ? activeNotePath
                    ? 'Type an instruction after ? to complete the current note.'
                    : 'Open a note before using AI note completion.'
                  : isBodySearch && !searchableQuery
                    ? 'Type after @ to search note bodies.'
                    : isWaitingForSearch || searchLoading
                      ? 'Searching...'
                      : 'No results found.'}
            </CommandEmpty>

            {isCommandMode ? (
              <CommandGroup heading="Commands">
                {commandItems.map((item) => {
                  const Icon = item.icon
                  const revealProps = getRevealItemProps(`command:${item.value}`)
                  return (
                    <CommandItem
                      key={item.value}
                      ref={revealProps.ref}
                      className={`group ${revealProps.className ?? ''}`}
                      style={revealProps.style}
                      value={item.value}
                      onSelect={handleSelect}
                    >
                      <div className={paletteItemIconClass}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span>{item.label}</span>
                      {item.shortcut ? <CommandShortcut>{item.shortcut}</CommandShortcut> : null}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ) : isAiMode ? (
              <CommandGroup heading="AI Note Completion">
                {(() => {
                  const revealProps = getRevealItemProps('ai-action')
                  return (
                    <CommandItem
                      ref={revealProps.ref}
                      className={`group ${revealProps.className ?? ''}`}
                      style={revealProps.style}
                      value={aiActionValue}
                      onSelect={handleSelect}
                      disabled={!activeNotePath || !searchQuery || aiLoading}
                    >
                      <div className={paletteItemIconClass}>
                        <Plus className="h-4 w-4" />
                      </div>
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
                  )
                })()}
              </CommandGroup>
            ) : (
              <CommandGroup heading="Quick Actions">
                {(() => {
                  const revealProps = getRevealItemProps('quick:new-note')
                  return (
                    <CommandItem
                      ref={revealProps.ref}
                      className={`group ${revealProps.className ?? ''}`}
                      style={revealProps.style}
                      value="new-note"
                      onSelect={handleSelect}
                    >
                      <div className={paletteItemIconClass}>
                        <Plus className="h-4 w-4" />
                      </div>
                      <span>New Note</span>
                      <CommandShortcut>⌘N</CommandShortcut>
                    </CommandItem>
                  )
                })()}
              </CommandGroup>
            )}

            {recentNotes.length > 0 && !trimmedQuery && !isCommandMode && !isAiMode && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Recent Notes">
                  {recentNotes.map((note) => {
                    const revealProps = getRevealItemProps(`recent:${note.relPath}`)
                    return (
                      <CommandItem
                        key={`recent:${note.relPath}`}
                        ref={revealProps.ref}
                        className={`group ${revealProps.className ?? ''}`}
                        style={revealProps.style}
                        value={`recent:${note.relPath}`}
                        keywords={[note.name, note.relPath, ...note.tags]}
                        onSelect={handleSelect}
                      >
                        <div className={paletteItemIconClass}>
                          <Clock className="h-4 w-4" />
                        </div>
                        <span className="truncate">{note.relPath}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </>
            )}

            {!isCommandMode && !isAiMode ? <CommandSeparator /> : null}
            {!isCommandMode && !isAiMode && searchableQuery ? (
              <>
                {!isWaitingForSearch || fallbackSearchNotes.length > 0 ? (
                  <>
                    <CommandGroup heading="Notes">
                      {noteResults.map((result) => {
                        const revealProps = getRevealItemProps(`search:${result.id}`)
                        return (
                          <CommandItem
                            key={result.id}
                            ref={revealProps.ref}
                            className={`group ${revealProps.className ?? ''}`}
                            style={revealProps.style}
                            value={result.value}
                            keywords={result.keywords}
                            onSelect={handleSelect}
                          >
                            <div className={paletteItemIconClass}>
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate">{result.title}</div>
                              <div className="truncate text-xs text-[var(--muted)]">
                                {result.subtitle}
                              </div>
                            </div>
                          </CommandItem>
                        )
                      })}
                      {fallbackSearchNotes.map((note) => {
                        const revealProps = getRevealItemProps(`fallback:${note.relPath}`)
                        return (
                          <CommandItem
                            key={`fallback:${note.relPath}`}
                            ref={revealProps.ref}
                            className={`group ${revealProps.className ?? ''}`}
                            style={revealProps.style}
                            value={`note:${note.relPath}`}
                            keywords={[
                              note.name,
                              note.relPath,
                              note.bodyPreview ?? '',
                              ...note.tags
                            ]}
                            onSelect={handleSelect}
                          >
                            <div className={paletteItemIconClass}>
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate">{stripNoteExtension(note.name)}</div>
                              <div className="truncate text-xs text-[var(--muted)]">
                                {note.relPath}
                              </div>
                            </div>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>

                    <CommandGroup heading="Projects">
                      {projectResults.map((result) => {
                        const revealProps = getRevealItemProps(`search:${result.id}`)
                        return (
                          <CommandItem
                            key={result.id}
                            ref={revealProps.ref}
                            className={`group ${revealProps.className ?? ''}`}
                            style={revealProps.style}
                            value={result.value}
                            keywords={result.keywords}
                            onSelect={handleSelect}
                          >
                            <div className={paletteItemIconClass}>
                              <FolderKanban className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate">{result.title}</div>
                              <div className="truncate text-xs text-[var(--muted)]">
                                {result.subtitle}
                              </div>
                            </div>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </>
                ) : null}
              </>
            ) : !isCommandMode && !isAiMode && !searchQuery ? (
              <CommandGroup heading="All Notes">
                {filteredNotes.map((note) => {
                  const revealProps = getRevealItemProps(`note:${note.relPath}`)
                  return (
                    <CommandItem
                      key={note.relPath}
                      ref={revealProps.ref}
                      className={`group ${revealProps.className ?? ''}`}
                      style={revealProps.style}
                      value={`note:${note.relPath}`}
                      keywords={[note.name, note.relPath, ...note.tags]}
                      onSelect={handleSelect}
                    >
                      <div className={paletteItemIconClass}>
                        <FileText className="h-4 w-4" />
                      </div>
                      <span className="truncate">{note.relPath}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>

        {/* Note Preview Panel */}
        {hoveredResult && (
          <div className="command-palette-preview hidden w-[260px] shrink-0 border-l border-[color:color-mix(in_srgb,var(--accent-line)_20%,var(--line))] bg-[color:color-mix(in_srgb,var(--accent-soft)_28%,transparent)] p-4 md:block">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:color-mix(in_srgb,var(--accent-line)_24%,var(--line))] bg-[color:color-mix(in_srgb,var(--accent-soft)_82%,var(--panel))] text-[var(--accent)]">
              {hoveredResult.kind === 'project' ? (
                <FolderKanban className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
            </div>
            <div className="mb-2 text-sm font-semibold text-[var(--text)]">
              {hoveredResult.title}
            </div>
            <div className="mb-3 text-xs text-[var(--muted)]">{hoveredResult.subtitle}</div>
            {hoveredResult.tags && hoveredResult.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {hoveredResult.tags.slice(0, 5).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[color:color-mix(in_srgb,var(--accent-line)_22%,var(--line))] bg-[color:color-mix(in_srgb,var(--accent-soft)_90%,var(--panel))] px-2 py-0.5 text-xs text-[var(--accent)]"
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
