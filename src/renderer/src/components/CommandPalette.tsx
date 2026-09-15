import {
  ReactElement,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { CircleAlert, Download, FileText, FolderOpen, Plus, RefreshCw, Terminal } from './ui/icons'
import { APP_PAGE_ICONS, VaultIcon } from '../lib/pageIcons'
import type { AppPage } from '../navigation'
import type { FolderColorMap } from '../../../shared/folderColors'
import { stripNoteExtension } from '../../../shared/noteDocument'
import { NoteListItem } from '../../../shared/types'
import warpLogo from '../assets/warp-logo.png'
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
import { CommandPaletteNoteItem } from './CommandPaletteNoteItem'
import { CommandPaletteMatchText } from './CommandPaletteMatchText'
import { Pallete, PalleteSearchBar } from './ui/pallete'
import { WorkspaceTextFade } from './ui/workspace-text-fade'
import {
  createCommandPaletteCommandSearchIndex,
  searchCommandPaletteCommands,
  searchCommandPaletteNotes,
  type CommandPaletteNoteSearchIndex,
  type CommandPaletteSearchResult
} from '../lib/commandPaletteSearch'
import {
  isMiddleMouseButton,
  isModifiedNotebookOpen,
  type NotebookOpenOptions
} from '../lib/notebookOpen'
import type { WorkspaceOpenOptions } from '../lib/workspaceOpen'

export type { CommandPaletteSearchResult } from '../lib/commandPaletteSearch'

type CommandPalettePage = Exclude<AppPage, 'schedulingGuide'>

const COMMAND_PAGE_BY_VALUE: Partial<Record<string, CommandPalettePage>> = {
  '>go capture': 'capture',
  '>go sticky note': 'stickyNote',
  '>go knowledge': 'knowledge',
  '>go notes': 'notes',
  '>go projects': 'projects',
  '>go tasks': 'tasks',
  '>go resources': 'resources',
  '>go subscriptions': 'subscriptions',
  '>go calendar': 'calendar',
  '>go scheduling': 'schedules',
  '>go design audit': 'designAudit',
  '>go settings': 'settings'
}

interface CommandPaletteProps {
  open: boolean
  initialQuery?: string
  notes: NoteListItem[]
  noteSearchIndex: CommandPaletteNoteSearchIndex
  folderColors: FolderColorMap
  searchResults: CommandPaletteSearchResult[]
  searchLoading?: boolean
  aiLoading?: boolean
  activeNotePath?: string | null
  recentNotePaths?: string[]
  onClose: () => void
  onCreate: () => void
  onQueryChange: (query: string) => void
  onRunAiPrompt: (prompt: string) => Promise<boolean>
  onOpenNote: (relPath: string, options?: NotebookOpenOptions) => void
  onOpenProject: (projectId: string, options?: WorkspaceOpenOptions) => void
  onOpenPage: (page: CommandPalettePage, options?: WorkspaceOpenOptions) => void
  onOpenWarpAtNoteFolder: () => Promise<void>
  onManageVaults?: () => void
  onOpenVaultFinder?: () => Promise<void>
  onOpenVaultTerminal?: () => Promise<void>
  onOpenSyncHealth?: () => void
  onReconcileVault?: () => Promise<void>
  onCreateVaultBackup?: () => Promise<void>
}

type CommandPaletteShortcutKey = 'cmd' | 'Enter' | string

export function CommandPalette({
  open,
  initialQuery = '',
  notes,
  noteSearchIndex,
  folderColors,
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
  onOpenPage,
  onOpenWarpAtNoteFolder,
  onManageVaults,
  onOpenVaultFinder,
  onOpenVaultTerminal,
  onOpenSyncHealth,
  onReconcileVault,
  onCreateVaultBackup
}: CommandPaletteProps): ReactElement | null {
  const paletteItemIconClass =
    'mr-2 flex h-8 w-8 shrink-0 items-center justify-center text-primary transition-colors group-data-[selected=true]:text-primary'
  const [query, setQuery] = useState('')
  const [hoveredResult, setHoveredResult] = useState<CommandPaletteSearchResult | null>(null)
  const [isWaitingForSearch, setIsWaitingForSearch] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const modifiedNoteSelectionRef = useRef<string | null>(null)
  const modifiedTargetSelectionRef = useRef<string | null>(null)
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
      modifiedNoteSelectionRef.current = null
      modifiedTargetSelectionRef.current = null
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

  const allNotes = useMemo(() => notes.slice(0, 15), [notes])

  const noteResults = useMemo(
    () => searchResults.filter((result) => result.kind === 'note'),
    [searchResults]
  )

  const projectResults = useMemo(
    () => searchResults.filter((result) => result.kind === 'project'),
    [searchResults]
  )
  const fallbackSearchNotes = useMemo(() => {
    if (!deferredSearchableQuery || noteResults.length > 0) {
      return []
    }

    return searchCommandPaletteNotes(
      noteSearchIndex,
      deferredSearchableQuery,
      isDeferredBodySearch ? 'body' : 'name',
      15
    )
  }, [deferredSearchableQuery, isDeferredBodySearch, noteResults.length, noteSearchIndex])

  const commandItems = useMemo(
    () => [
      {
        value: '>go capture',
        label: 'Go to Capture',
        onSelect: () => onOpenPage('capture'),
        keywords: ['inbox', 'fleeting', 'quick capture'],
        icon: APP_PAGE_ICONS.capture
      },
      {
        value: '>go sticky note',
        label: 'Go to Sticky Note',
        onSelect: () => onOpenPage('stickyNote'),
        keywords: ['sticky', 'sticky note', 'post-it', 'board', 'canvas'],
        icon: APP_PAGE_ICONS.stickyNote
      },
      {
        value: '>new note',
        label: 'New Note',
        shortcutKeys: ['cmd', 'N'] as CommandPaletteShortcutKey[],
        onSelect: () => onCreate(),
        keywords: ['create', 'add', 'note'],
        icon: Plus
      },
      {
        value: '>go knowledge',
        label: 'Go to Knowledge',
        shortcutKeys: ['cmd', 'K'] as CommandPaletteShortcutKey[],
        onSelect: () => onOpenPage('knowledge'),
        keywords: ['graph', 'knowledge base'],
        icon: APP_PAGE_ICONS.knowledge
      },
      {
        value: '>go notes',
        label: 'Go to Notebooks',
        onSelect: () => onOpenPage('notes'),
        keywords: ['notes', 'notebooks', 'docs'],
        icon: APP_PAGE_ICONS.notes
      },
      {
        value: '>go projects',
        label: 'Go to Projects',
        onSelect: () => onOpenPage('projects'),
        keywords: ['project', 'workspace'],
        icon: APP_PAGE_ICONS.projects
      },
      {
        value: '>go tasks',
        label: 'Go to Tasks',
        onSelect: () => onOpenPage('tasks'),
        keywords: ['task', 'todo', 'work items'],
        icon: APP_PAGE_ICONS.tasks
      },
      {
        value: '>go resources',
        label: 'Go to Resources',
        onSelect: () => onOpenPage('resources'),
        keywords: ['links', 'files', 'labels', 'sources'],
        icon: APP_PAGE_ICONS.resources
      },
      {
        value: '>go subscriptions',
        label: 'Go to Subscriptions',
        onSelect: () => onOpenPage('subscriptions'),
        keywords: ['billing', 'payments'],
        icon: APP_PAGE_ICONS.subscriptions
      },
      {
        value: '>go calendar',
        label: 'Go to Calendar',
        onSelect: () => onOpenPage('calendar'),
        keywords: ['dates', 'events', 'schedule'],
        icon: APP_PAGE_ICONS.calendar
      },
      {
        value: '>go scheduling',
        label: 'Go to Scheduling',
        onSelect: () => onOpenPage('schedules'),
        keywords: ['automation', 'jobs', 'schedules'],
        icon: APP_PAGE_ICONS.schedules
      },
      {
        value: '>go design audit',
        label: 'Go to Design Audit',
        onSelect: () => onOpenPage('designAudit'),
        keywords: ['design system', 'components', 'colors', 'tokens', 'ui'],
        icon: APP_PAGE_ICONS.designAudit
      },
      {
        value: '>go settings',
        label: 'Go to Settings',
        onSelect: () => onOpenPage('settings'),
        keywords: ['preferences', 'config'],
        icon: APP_PAGE_ICONS.settings
      },
      {
        value: '>warp open current note folder',
        label: 'Warp: Open Current Note Folder',
        onSelect: () => {
          void onOpenWarpAtNoteFolder()
        },
        keywords: ['warp', 'terminal', 'shell', 'cwd', 'folder', 'current note'],
        icon: Terminal,
        logo: warpLogo,
        disabled: !activeNotePath
      },
      ...(onManageVaults
        ? [
            {
              value: '>manage vaults',
              label: 'Manage Vaults',
              onSelect: () => onManageVaults(),
              keywords: ['vault', 'storage', 'folders'],
              icon: VaultIcon
            }
          ]
        : []),
      ...(onOpenVaultFinder
        ? [
            {
              value: '>vault open finder',
              label: 'Open Vault in Finder',
              onSelect: () => {
                void onOpenVaultFinder()
              },
              keywords: ['vault', 'finder', 'explorer', 'folder', 'files'],
              icon: FolderOpen
            }
          ]
        : []),
      ...(onOpenVaultTerminal
        ? [
            {
              value: '>vault open terminal',
              label: 'Open Vault in Terminal',
              onSelect: () => {
                void onOpenVaultTerminal()
              },
              keywords: ['vault', 'terminal', 'shell', 'command line', 'cwd'],
              icon: Terminal
            }
          ]
        : []),
      ...(onOpenSyncHealth
        ? [
            {
              value: '>vault status',
              label: 'Show Vault Status',
              onSelect: () => onOpenSyncHealth(),
              keywords: ['vault', 'status', 'sync', 'health'],
              icon: VaultIcon
            },
            {
              value: '>vault validate',
              label: 'Validate Vault',
              onSelect: () => onOpenSyncHealth(),
              keywords: ['vault', 'validate', 'diagnostics', 'health'],
              icon: CircleAlert
            }
          ]
        : []),
      ...(onReconcileVault
        ? [
            {
              value: '>vault reconcile',
              label: 'Reconcile Vault',
              onSelect: () => {
                void onReconcileVault()
              },
              keywords: ['vault', 'reconcile', 'rescan', 'refresh', 'sync'],
              icon: RefreshCw
            }
          ]
        : []),
      ...(onOpenSyncHealth
        ? [
            {
              value: '>vault conflicts',
              label: 'Review Vault Conflicts',
              onSelect: () => onOpenSyncHealth(),
              keywords: ['vault', 'conflicts', 'merge', 'recovery'],
              icon: CircleAlert
            },
            {
              value: '>vault diagnostics',
              label: 'Open Vault Diagnostics',
              onSelect: () => onOpenSyncHealth(),
              keywords: ['vault', 'diagnostics', 'repair', 'quarantine'],
              icon: CircleAlert
            }
          ]
        : []),
      ...(onCreateVaultBackup
        ? [
            {
              value: '>vault backup',
              label: 'Create Vault Backup',
              onSelect: () => {
                void onCreateVaultBackup()
              },
              keywords: ['vault', 'backup', 'export', 'portable', 'manifest'],
              icon: Download
            }
          ]
        : [])
    ],
    [
      activeNotePath,
      onCreate,
      onCreateVaultBackup,
      onManageVaults,
      onOpenPage,
      onOpenSyncHealth,
      onOpenVaultFinder,
      onOpenVaultTerminal,
      onOpenWarpAtNoteFolder,
      onReconcileVault
    ]
  )

  const commandSearchIndex = useMemo(
    () => createCommandPaletteCommandSearchIndex(commandItems),
    [commandItems]
  )
  const filteredCommandResults = useMemo(
    () => searchCommandPaletteCommands(commandSearchIndex, searchQuery),
    [commandSearchIndex, searchQuery]
  )

  const allSelectableResults = useMemo(() => {
    const noteItems: CommandPaletteSearchResult[] = searchableQuery
      ? fallbackSearchNotes
      : allNotes.map((note) => ({
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

    const commandResults = filteredCommandResults.map(({ command: item }) => ({
      id: item.value,
      kind: 'project' as const,
      title: item.label,
      subtitle: 'Command',
      value: item.value
    }))

    return [...searchResults, ...recentNoteItems, ...noteItems, ...commandResults]
  }, [
    allNotes,
    fallbackSearchNotes,
    filteredCommandResults,
    recentNotes,
    searchResults,
    searchableQuery
  ])

  const handleSelect = useCallback(
    (value: string) => {
      if (value === 'new-note') {
        onCreate()
        onClose()
      } else if (value.startsWith('>')) {
        if (modifiedTargetSelectionRef.current === value) {
          modifiedTargetSelectionRef.current = null
          return
        }
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
        if (modifiedNoteSelectionRef.current === relPath) {
          modifiedNoteSelectionRef.current = null
          return
        }
        onOpenNote(relPath)
        onClose()
      } else if (value.startsWith('project:')) {
        if (modifiedTargetSelectionRef.current === value) {
          modifiedTargetSelectionRef.current = null
          return
        }
        const projectId = value.replace('project:', '')
        onOpenProject(projectId)
        onClose()
      } else if (modifiedTargetSelectionRef.current === value) {
        modifiedTargetSelectionRef.current = null
        return
      }
    },
    [commandItems, onCreate, onOpenNote, onOpenProject, onClose, onRunAiPrompt, searchQuery]
  )

  const getNoteOpenInteractionProps = useCallback(
    (
      relPath: string
    ): {
      onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
      onAuxClick: (event: React.MouseEvent<HTMLDivElement>) => void
    } => ({
      onPointerDown: (event) => {
        if (!isModifiedNotebookOpen(event)) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        modifiedNoteSelectionRef.current = relPath
        onOpenNote(relPath, { openInNewTab: true })
        onClose()
      },
      onAuxClick: (event) => {
        if (!isMiddleMouseButton(event)) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        modifiedNoteSelectionRef.current = relPath
        onOpenNote(relPath, { openInNewTab: true })
        onClose()
      }
    }),
    [onClose, onOpenNote]
  )

  const getProjectOpenInteractionProps = useCallback(
    (
      projectId: string,
      value: string
    ): {
      onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
      onAuxClick: (event: React.MouseEvent<HTMLDivElement>) => void
    } => ({
      onPointerDown: (event) => {
        if (!isModifiedNotebookOpen(event)) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        modifiedTargetSelectionRef.current = value
        onOpenProject(projectId, { openInNewTab: true })
        onClose()
      },
      onAuxClick: (event) => {
        if (!isMiddleMouseButton(event)) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        modifiedTargetSelectionRef.current = value
        onOpenProject(projectId, { openInNewTab: true })
        onClose()
      }
    }),
    [onClose, onOpenProject]
  )

  const getPageOpenInteractionProps = useCallback(
    (
      page: CommandPalettePage,
      value: string
    ): {
      onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
      onAuxClick: (event: React.MouseEvent<HTMLDivElement>) => void
    } => ({
      onPointerDown: (event) => {
        if (!isModifiedNotebookOpen(event)) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        modifiedTargetSelectionRef.current = value
        onOpenPage(page, { openInNewTab: true })
        onClose()
      },
      onAuxClick: (event) => {
        if (!isMiddleMouseButton(event)) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        modifiedTargetSelectionRef.current = value
        onOpenPage(page, { openInNewTab: true })
        onClose()
      }
    }),
    [onClose, onOpenPage]
  )

  const passthroughCommandFilter = useCallback(() => 1, [])

  return (
    <Pallete
      open={open}
      aria-label="Command palette"
      className="!top-[clamp(7rem,25vh,16rem)] !-translate-y-0 !p-3"
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose()
        }
      }}
    >
      <div className="flex flex-1 overflow-hidden">
        <Command
          shouldFilter={false}
          filter={passthroughCommandFilter}
          className="flex-1 bg-panel text-foreground"
          onValueChange={(value) => {
            const result = allSelectableResults.find((item) => item.value === value) ?? null
            setHoveredResult(result)
          }}
        >
          <PalleteSearchBar data-cmdk-input-wrapper="">
            <CommandInput
              bare
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
          </PalleteSearchBar>
          <CommandList className="max-h-[360px]">
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
                {filteredCommandResults.map(({ command: item, highlights }) => {
                  const Icon = item.icon
                  return (
                    <CommandItem
                      key={item.value}
                      variant="palette"
                      className="group"
                      value={item.value}
                      keywords={item.keywords}
                      disabled={item.disabled}
                      onSelect={handleSelect}
                      {...(COMMAND_PAGE_BY_VALUE[item.value]
                        ? getPageOpenInteractionProps(
                            COMMAND_PAGE_BY_VALUE[item.value] as CommandPalettePage,
                            item.value
                          )
                        : {})}
                    >
                      <div className={paletteItemIconClass}>
                        {item.logo ? (
                          <img src={item.logo} alt="" className="size-5 rounded-sm" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </div>
                      <WorkspaceTextFade className="min-w-0 flex-1" observeMutations={false}>
                        <CommandPaletteMatchText text={item.label} ranges={highlights?.title} />
                      </WorkspaceTextFade>
                      {item.shortcutKeys ? <CommandShortcut keys={item.shortcutKeys} /> : null}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ) : isAiMode ? (
              <CommandGroup heading="AI Note Completion">
                {(() => {
                  return (
                    <CommandItem
                      className="group"
                      variant="palette"
                      value={aiActionValue}
                      onSelect={handleSelect}
                      disabled={!activeNotePath || !searchQuery || aiLoading}
                    >
                      <div className={paletteItemIconClass}>
                        <Plus className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <WorkspaceTextFade>
                          {aiLoading
                            ? 'Completing note with Mistral...'
                            : searchQuery
                              ? `Continue ${aiNoteLabel}`
                              : `Complete ${aiNoteLabel}`}
                        </WorkspaceTextFade>
                        <WorkspaceTextFade className="text-xs text-muted-foreground">
                          {activeNotePath
                            ? searchQuery || 'Describe how AI should continue the note.'
                            : 'Open a note first to send its content to Mistral.'}
                        </WorkspaceTextFade>
                      </div>
                      <CommandShortcut keys={[aiLoading ? '...' : 'Enter']} />
                    </CommandItem>
                  )
                })()}
              </CommandGroup>
            ) : (
              <CommandGroup heading="Quick Actions">
                {(() => {
                  return (
                    <CommandItem
                      className="group"
                      variant="palette"
                      value="new-note"
                      onSelect={handleSelect}
                    >
                      <div className={paletteItemIconClass}>
                        <Plus className="h-4 w-4" />
                      </div>
                      <span>New Note</span>
                      <CommandShortcut keys={['cmd', 'N']} />
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
                    return (
                      <CommandPaletteNoteItem
                        key={`recent:${note.relPath}`}
                        title={stripNoteExtension(note.name)}
                        relPath={note.relPath}
                        folderColors={folderColors}
                        value={`recent:${note.relPath}`}
                        keywords={[note.name, note.relPath, ...note.tags]}
                        onSelect={handleSelect}
                        {...getNoteOpenInteractionProps(note.relPath)}
                      />
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
                        return (
                          <CommandPaletteNoteItem
                            key={result.id}
                            title={result.title}
                            relPath={result.subtitle}
                            folderColors={folderColors}
                            highlights={result.highlights}
                            snippet={result.searchMode === 'body' ? result.snippet : undefined}
                            value={result.value}
                            keywords={result.keywords}
                            onSelect={handleSelect}
                            {...getProjectOpenInteractionProps(
                              result.value.replace('project:', ''),
                              result.value
                            )}
                            {...getNoteOpenInteractionProps(result.value.replace(/^note:/, ''))}
                          />
                        )
                      })}
                      {fallbackSearchNotes.map((result) => {
                        return (
                          <CommandPaletteNoteItem
                            key={`fallback:${result.value}`}
                            title={result.title}
                            relPath={result.subtitle}
                            folderColors={folderColors}
                            highlights={result.highlights}
                            snippet={result.searchMode === 'body' ? result.snippet : undefined}
                            value={result.value}
                            keywords={result.keywords}
                            onSelect={handleSelect}
                            {...getNoteOpenInteractionProps(result.subtitle)}
                          />
                        )
                      })}
                    </CommandGroup>

                    <CommandGroup heading="Projects">
                      {projectResults.map((result) => {
                        return (
                          <CommandItem
                            key={result.id}
                            className="group"
                            variant="palette"
                            value={result.value}
                            keywords={result.keywords}
                            onSelect={handleSelect}
                          >
                            <div className={paletteItemIconClass}>
                              <APP_PAGE_ICONS.projects className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <WorkspaceTextFade observeMutations={false}>
                                <CommandPaletteMatchText
                                  text={result.title}
                                  ranges={result.highlights?.title}
                                />
                              </WorkspaceTextFade>
                              <WorkspaceTextFade
                                className="text-xs text-muted-foreground"
                                observeMutations={false}
                              >
                                <CommandPaletteMatchText
                                  text={result.subtitle}
                                  ranges={result.highlights?.subtitle}
                                />
                              </WorkspaceTextFade>
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
                {allNotes.map((note) => {
                  return (
                    <CommandPaletteNoteItem
                      key={note.relPath}
                      title={stripNoteExtension(note.name)}
                      relPath={note.relPath}
                      folderColors={folderColors}
                      value={`note:${note.relPath}`}
                      keywords={[note.name, note.relPath, ...note.tags]}
                      onSelect={handleSelect}
                      {...getNoteOpenInteractionProps(note.relPath)}
                    />
                  )
                })}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>

        {/* Note Preview Panel */}
        {hoveredResult && (
          <div className="hidden w-64 shrink-0 border-l bg-muted/30 p-4 md:block">
            <div className="mb-3 inline-flex size-10 items-center justify-center rounded-md border bg-card text-primary">
              {hoveredResult.kind === 'project' ? (
                <APP_PAGE_ICONS.projects className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
            </div>
            <div
              className="mb-2 min-w-0 text-sm font-semibold text-foreground"
              title={hoveredResult.title}
            >
              <WorkspaceTextFade>{hoveredResult.title}</WorkspaceTextFade>
            </div>
            <div
              className="mb-3 min-w-0 text-xs text-muted-foreground"
              title={hoveredResult.subtitle}
            >
              <WorkspaceTextFade>{hoveredResult.subtitle}</WorkspaceTextFade>
            </div>
            {hoveredResult.tags && hoveredResult.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {hoveredResult.tags.slice(0, 5).map((tag) => (
                  <span
                    key={tag}
                    className="max-w-full rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-foreground"
                    title={tag}
                  >
                    <WorkspaceTextFade>{tag}</WorkspaceTextFade>
                  </span>
                ))}
              </div>
            )}
            {hoveredResult.updatedAt ? (
              <div className="mt-3 text-xs text-muted-foreground">
                Updated: {new Date(hoveredResult.updatedAt).toLocaleDateString()}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Pallete>
  )
}
