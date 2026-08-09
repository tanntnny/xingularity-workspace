import { Fragment, ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  ChevronDown,
  Copy,
  CreditCard,
  Download,
  LayoutGrid,
  Paintbrush,
  Trash2,
  Plus,
  Link2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  FolderOpen,
  FolderKanban,
  Inbox,
  NotebookPen,
  ChevronUp,
  Star,
  SlidersHorizontal
} from './components/ui/icons'
import {
  CalendarTask,
  FleetingConversionResult,
  FleetingConversionTarget,
  FleetingNote,
  NoteVimKeyMapping,
  NoteListItem,
  NoteImportResult,
  NoteTreeNode,
  Project,
  ProjectIconStyle,
  ProjectPropertiesPatch,
  ProjectState,
  NativeMenuItemDescriptor,
  RendererVaultApi,
  TaskPriority,
  TaskReminder,
  CalendarTaskType,
  HistoryAffectedAreas,
  VaultOpenResult
} from '../../shared/types'
import {
  isExcalidrawPath,
  stripNotebookFileExtension,
  withExcalidrawExtension
} from '../../shared/excalidrawFile'
import { normalizeProjectIcon } from '../../shared/projectIcons'
import {
  appendTextToNoteMarkdown,
  getNoteDisplayName,
  serializeStoredNoteDocument,
  stripNoteExtension,
  withNoteExtension
} from '../../shared/noteDocument'
import { splitNoteContent } from '../../shared/noteContent'
import { normalizeTag } from '../../shared/noteTags'
import {
  createNoteMentionResolver,
  extractMentionTargetsFromMarkdown,
  normalizeMentionTarget
} from '../../shared/noteMentions'
import { CalendarMonthView } from './components/CalendarMonthView'
import { CalendarWeekView } from './components/CalendarWeekView'
import { UnscheduledTaskList } from './components/UnscheduledTaskList'
import { CommandPalette, type CommandPaletteSearchResult } from './components/CommandPalette'
import { NotesTreeView } from './components/NotesTreeView'
import type { NoteEditorHandle } from './components/Editor'
import { SonnerBridge } from './components/SonnerBridge'
import { AppSidebar } from './components/AppSidebar'
import type { AppPage } from './navigation'
import { useAppPlatform } from './platform'
import {
  getAvailablePages,
  isPageAvailable,
  normalizePageForPlatform
} from './platform/pageAvailability'
import { SidebarProvider, SidebarInset } from './components/ui/sidebar'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import { Input } from './components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './components/ui/dropdown-menu'
import {
  DocumentWorkspace,
  DocumentWorkspaceMain,
  DocumentWorkspaceMainContent,
  DocumentWorkspaceMainHeader,
  DocumentWorkspacePanel,
  DocumentWorkspacePanelContent,
  DocumentWorkspacePanelHeader,
  WorkspaceResizableLayout,
  WorkspacePanelStack,
  WorkspaceContextProvider,
  WorkspaceFooter,
  WorkspaceTabManager,
  WorkspaceContextEmptyState,
  WorkspaceIconButton,
  WorkspaceHeaderActions,
  WorkspaceHeaderActionDivider,
  WorkspaceHeaderActionGroup
} from './components/ui/document-workspace'
import {
  WorkspacePanelSection,
  WorkspacePanelSectionHeader
} from './components/ui/workspace-panel-section'
import { ToggleGroup, ToggleGroupItem } from './components/ui/toggle-group'
import { ButtonGroup } from './components/ui/button-group'
import { EditorPage } from './pages/EditorPage'
import {
  ProjectsWorkspaceHeaderActions,
  ProjectsWorkspacePage,
  ProjectsWorkspaceRightPanel
} from './pages/ProjectsWorkspacePage'
import { SearchPage } from './pages/SearchPage'
import { SettingsPage } from './pages/SettingsPage'
import { SubscriptionsPage } from './pages/SubscriptionsPage'
import {
  ExcalidrawFileEditor,
  type ExcalidrawFileEditorHandle
} from './components/ExcalidrawFileEditor'
import { NoteExportDialog, type NoteExportFormat } from './components/NoteExportDialog'
import { KnowledgePage } from './pages/KnowledgePage'
import { DesignAuditPage } from './pages/DesignAuditPage'
import { NoVaultPage } from './pages/NoVaultPage'
import { CapturePage } from './pages/CapturePage'
import { VaultSwapperDialog } from './components/VaultSwapperDialog'
import { useVaultStore } from './state/store'
import { usePersistentState } from './hooks/usePersistentState'
import { useStaggeredScrollReveal } from './hooks/useStaggeredScrollReveal'
import { useWorkspaceShellShortcuts } from './hooks/useWorkspaceShellShortcuts'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from './components/ui/breadcrumb'
import { Shortcut } from './components/ui/kbd'
import { normalizeCalendarTasks } from './lib/calendarTasks'
import { filterProjectsForWorkspace } from './lib/projectTaskRows'
import { type NoteEditorSnapshot, type NoteEditorSessionSnapshot } from './lib/noteEditorSession'
import { createNoteSaveCoordinator } from './lib/noteSaveCoordinator'
import { formatWeekRange, shiftIsoMonthClamped } from './lib/calendarDate'
import {
  getPrimaryNoteTreeSelectionEntry,
  normalizeNoteTreeSelection,
  type NoteTreeSelection
} from './lib/noteTreeSelection'
import { canUseNativeMenus, getElementMenuPosition, showNativeMenu } from './lib/nativeMenu'
import { type ProjectsWorkspaceFilterMode } from './pages/ProjectsWorkspacePage'
import {
  createEmptyNotebookWorkspaceSession,
  getNextActiveWorkspaceTabId,
  type NotebookWorkspaceSession,
  remapNotebookWorkspaceSessionPaths,
  removeNotebookWorkspaceSessionPaths
} from './lib/workspaceTabs'
const PAGE_LABELS: Record<AppPage, string> = {
  capture: 'Capture',
  knowledge: 'Knowledge',
  notes: 'Notebooks',
  projects: 'Projects',
  subscriptions: 'Subscriptions',
  calendar: 'Calendar',
  designAudit: 'Design Audit',
  settings: 'Settings'
}

const PAGE_TAB_ICONS: Record<AppPage, typeof LayoutGrid> = {
  capture: Inbox,
  knowledge: LayoutGrid,
  notes: NotebookPen,
  projects: FolderKanban,
  subscriptions: CreditCard,
  calendar: CalendarDays,
  designAudit: Paintbrush,
  settings: SlidersHorizontal
}

type CalendarViewMode = 'month' | 'week'
type CalendarContentFilter = 'all' | 'tasks'
type StoredProjectsWorkspaceView = 'board' | 'taskList' | 'projectDetail'

type WorkspacePageTab = {
  id: string
  page: AppPage
}

const INITIAL_WORKSPACE_TAB_ID = 'workspace-tab-1'

const WORKSPACE_RIGHT_PANEL_DEFAULT_WIDTH = 300
const WORKSPACE_RIGHT_PANEL_MIN_WIDTH = 220
const WORKSPACE_RIGHT_PANEL_MAX_WIDTH = 360
const WORKSPACE_RIGHT_PANEL_STORAGE_KEY = 'workspace_right_panel_width'

function clampWorkspaceRightPanelWidth(width: number): number {
  if (!Number.isFinite(width)) {
    return WORKSPACE_RIGHT_PANEL_DEFAULT_WIDTH
  }

  return Math.min(
    WORKSPACE_RIGHT_PANEL_MAX_WIDTH,
    Math.max(WORKSPACE_RIGHT_PANEL_MIN_WIDTH, Math.round(width))
  )
}

function isStoredWorkspaceRightPanelWidth(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= WORKSPACE_RIGHT_PANEL_MIN_WIDTH &&
    value <= WORKSPACE_RIGHT_PANEL_MAX_WIDTH
  )
}

type PageLeaveSaveDebug = {
  requestedPage: AppPage | null
  notePath: string | null
  snapshotContent: string
  fingerprint: string | null
  attempted: boolean
  writeCompleted: boolean
  skippedReason: string | null
  lastError: string | null
}

const pageLeaveSaveDebugState: PageLeaveSaveDebug = {
  requestedPage: null,
  notePath: null,
  snapshotContent: '',
  fingerprint: null,
  attempted: false,
  writeCompleted: false,
  skippedReason: null,
  lastError: null
}

function summarizeTraceContent(content: string | null | undefined): string {
  if (!content) {
    return ''
  }

  return content.replace(/\s+/g, ' ').trim().slice(0, 120)
}

function pushNoteSaveTrace(event: string, details: Record<string, unknown>): void {
  void event
  void details
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index])
}

if (typeof window !== 'undefined') {
  ;(
    window as Window & {
      __XINGULARITY_E2E__?: {
        getCurrentNoteSnapshot: () =>
          | { path: string | null; content: string }
          | Promise<{ path: string | null; content: string }>
        getLastPageLeaveSaveDebug: () => PageLeaveSaveDebug
      }
    }
  ).__XINGULARITY_E2E__ = {
    getCurrentNoteSnapshot: () => {
      const state = useVaultStore.getState()
      return {
        path: state.currentNotePath,
        content: state.currentNoteContent
      }
    },
    getLastPageLeaveSaveDebug: () => ({ ...pageLeaveSaveDebugState })
  }
}

const CALENDAR_VIEW_MODE_OPTIONS = [
  { value: 'month', label: 'Monthly' },
  { value: 'week', label: 'Weekly' }
]

const NOTE_AUTOSAVE_DELAY_MS = 1200

function SettingsRightPanelSections(): ReactElement {
  const revealItemIds = ['settings-appearance', 'settings-editor-defaults', 'settings-shortcuts']
  const { containerRef, getRevealItemProps } = useStaggeredScrollReveal(revealItemIds, {
    resetKey: 'settings-right-panel'
  })
  const sections = [
    {
      id: 'settings-appearance',
      heading: 'Appearance',
      description: 'Theme and surface defaults for the workspace'
    },
    {
      id: 'settings-editor-defaults',
      heading: 'Editor Defaults',
      description: 'Type, writing, and editing preferences'
    },
    {
      id: 'settings-shortcuts',
      heading: 'Shortcuts',
      description: 'Keyboard actions available across the app'
    }
  ]

  return (
    <WorkspacePanelStack ref={containerRef} className="h-full">
      {sections.map((section) => {
        const revealProps = getRevealItemProps(section.id)
        return (
          <WorkspacePanelSection
            key={section.id}
            ref={revealProps.ref}
            style={revealProps.style}
            className={`${revealProps.className} rounded-lg`}
          >
            <WorkspacePanelSectionHeader
              heading={section.heading}
              description={section.description}
            />
          </WorkspacePanelSection>
        )
      })}
    </WorkspacePanelStack>
  )
}

function App(): ReactElement {
  const platform = useAppPlatform()
  const vaultApi = platform.api
  const vault = useVaultStore((state) => state.vault)
  const notes = useVaultStore((state) => state.notes)
  const currentNotePath = useVaultStore((state) => state.currentNotePath)
  const currentNoteContent = useVaultStore((state) => state.currentNoteContent)
  const searchQuery = useVaultStore((state) => state.searchQuery)
  const searchResults = useVaultStore((state) => state.searchResults)
  const commandPaletteOpen = useVaultStore((state) => state.commandPaletteOpen)
  const settingsProjects = useVaultStore((state) => state.settings.projects)
  const calendarTasks = useVaultStore((state) => state.settings.calendarTasks)
  const lastOpenedNotePath = useVaultStore((state) => state.settings.lastOpenedNotePath)
  const lastOpenedProjectId = useVaultStore((state) => state.settings.lastOpenedProjectId)
  const favoriteNotePathSettings = useVaultStore((state) => state.settings.favoriteNotePaths)
  const favoriteProjectIdSettings = useVaultStore((state) => state.settings.favoriteProjectIds)
  const fontFamily = useVaultStore((state) => state.settings.fontFamily)
  const editorVimModeEnabled = useVaultStore((state) => state.settings.editorVimModeEnabled)
  const editorVimKeyMappings = useVaultStore((state) => state.settings.editorVimKeyMappings)
  const profileName = useVaultStore((state) => state.settings.profile.name)
  const mistralApiKey = useVaultStore((state) => state.settings.ai.mistralApiKey)
  const lastVaultPath = useVaultStore((state) => state.settings.lastVaultPath)
  const projectIcons = useVaultStore((state) => state.settings.projectIcons)
  const setVault = useVaultStore((state) => state.setVault)
  const setNotes = useVaultStore((state) => state.setNotes)
  const setCurrentNotePath = useVaultStore((state) => state.setCurrentNotePath)
  const setCurrentNoteContent = useVaultStore((state) => state.setCurrentNoteContent)
  const setSearchQuery = useVaultStore((state) => state.setSearchQuery)
  const setSearchResults = useVaultStore((state) => state.setSearchResults)
  const setCommandPaletteOpen = useVaultStore((state) => state.setCommandPaletteOpen)
  const setSettings = useVaultStore((state) => state.setSettings)
  const patchSettings = useVaultStore((state) => state.patchSettings)
  const pushToast = useVaultStore((state) => state.pushToast)
  const [activePage, setActivePage] = useState<AppPage>('notes')
  const [workspaceTabs, setWorkspaceTabs] = useState<WorkspacePageTab[]>([
    { id: INITIAL_WORKSPACE_TAB_ID, page: 'notes' }
  ])
  const [activeWorkspaceTabId, setActiveWorkspaceTabId] = useState(INITIAL_WORKSPACE_TAB_ID)
  const workspaceTabSequenceRef = useRef(1)
  const activeWorkspaceTabIdRef = useRef(INITIAL_WORKSPACE_TAB_ID)
  const workspaceTabSessionsRef = useRef<Record<string, NotebookWorkspaceSession>>({
    [INITIAL_WORKSPACE_TAB_ID]: createEmptyNotebookWorkspaceSession()
  })
  const [knowledgeOrphanRingRadiusInput, setKnowledgeOrphanRingRadiusInput] = useState('')
  const availablePages = useMemo(() => getAvailablePages(platform), [platform])
  const useNativeMenus = platform.capabilities.supportsNativeMenus && canUseNativeMenus()
  const [isDarkMode, setIsDarkMode] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  )
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const settingsMutationVersionRef = useRef(0)
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => toIsoDate(new Date()))
  const [calendarViewMode, setCalendarViewMode] = usePersistentState<CalendarViewMode>(
    'calendar-view-mode',
    'month',
    {
      validate: (value): value is CalendarViewMode => value === 'month' || value === 'week'
    }
  )
  const [calendarContentFilter, setCalendarContentFilter] =
    usePersistentState<CalendarContentFilter>('calendar-content-filter', 'all', {
      validate: (value): value is CalendarContentFilter => value === 'all' || value === 'tasks'
    })
  const [calendarHeaderNewTask, setCalendarHeaderNewTask] = useState('')
  const [fleetingNotes, setFleetingNotes] = useState<FleetingNote[]>([])
  const [fleetingNotesLoading, setFleetingNotesLoading] = useState(false)
  const [currentNoteTagsState, setCurrentNoteTagsState] = useState<string[]>([])
  const [currentNoteEditorDraft, setCurrentNoteEditorDraft] = useState<string | null>(null)
  const [currentExcalidrawPath, setCurrentExcalidrawPath] = useState<string | null>(null)
  const [noteTitleEditTarget, setNoteTitleEditTarget] = useState<{
    relPath: string
    token: number
  } | null>(null)
  const [isNoteExportDialogOpen, setIsNoteExportDialogOpen] = useState(false)
  const [noteExportFormat, setNoteExportFormat] = useState<NoteExportFormat>('markdown')
  const [isNoteExporting, setIsNoteExporting] = useState(false)
  const [isFolderPdfExporting, setIsFolderPdfExporting] = useState(false)

  const [collapseAllNotesTreeToken, setCollapseAllNotesTreeToken] = useState(0)
  const [areAllNoteFoldersCollapsed, setAreAllNoteFoldersCollapsed] = useState(false)
  const knowledgeOrphanRingRadiusPx = useMemo(() => {
    const trimmed = knowledgeOrphanRingRadiusInput.trim()
    if (!trimmed) {
      return null
    }

    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) {
      return null
    }

    return Math.max(72, Math.round(parsed))
  }, [knowledgeOrphanRingRadiusInput])
  const [noteTree, setNoteTree] = useState<NoteTreeNode[]>([])
  const [selectedNoteTreeEntries, setSelectedNoteTreeEntries] = useState<NoteTreeSelection>([])
  const primarySelectedNoteTreeEntry = getPrimaryNoteTreeSelectionEntry(selectedNoteTreeEntries)
  const [pendingNoteTreeEditId, setPendingNoteTreeEditId] = useState<string | null>(null)
  const handlePendingNoteTreeEditHandled = useCallback((): void => {
    setPendingNoteTreeEditId(null)
  }, [])
  const visibleNoteTree = noteTree
  const projects = settingsProjects
  const hasVault = Boolean(vault?.rootPath)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const selectedProjectIdRef = useRef<string | null>(null)
  const projectMutationVersionRef = useRef(new Map<string, number>())
  const favoriteProjectMutationVersionRef = useRef(new Map<string, number>())
  const [projectFilterMode, setProjectFilterMode] = useState<ProjectsWorkspaceFilterMode>('all')
  const [, setStoredProjectsWorkspaceView] = usePersistentState<StoredProjectsWorkspaceView>(
    'projects-workspace-tab',
    'projectDetail',
    {
      validate: (value): value is StoredProjectsWorkspaceView =>
        value === 'board' || value === 'taskList' || value === 'projectDetail'
    }
  )
  useEffect(() => {
    setStoredProjectsWorkspaceView('projectDetail')
  }, [setStoredProjectsWorkspaceView])
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const todayIso = toIsoDate(new Date())
  const [commandPaletteResults, setCommandPaletteResults] = useState<CommandPaletteSearchResult[]>(
    []
  )
  const [commandPaletteInitialQuery, setCommandPaletteInitialQuery] = useState('')
  const [commandPaletteLoading, setCommandPaletteLoading] = useState(false)
  const [commandPaletteAiLoading, setCommandPaletteAiLoading] = useState(false)
  const [savedVaultCount, setSavedVaultCount] = useState(0)
  const [isVaultSwapperOpen, setIsVaultSwapperOpen] = useState(false)
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false)
  const [rightPanelWidth, setRightPanelWidth] = usePersistentState<number>(
    WORKSPACE_RIGHT_PANEL_STORAGE_KEY,
    WORKSPACE_RIGHT_PANEL_DEFAULT_WIDTH,
    { validate: isStoredWorkspaceRightPanelWidth }
  )
  const commandPaletteSearchRequestRef = useRef(0)
  const noteActionsButtonRef = useRef<HTMLButtonElement | null>(null)
  const createNoteRef = useRef<(() => Promise<void>) | null>(null)
  const notesRef = useRef(notes)
  const currentNotePathRef = useRef(currentNotePath)
  const currentExcalidrawPathRef = useRef(currentExcalidrawPath)
  const currentNoteContentRef = useRef(currentNoteContent)
  const currentNoteTagsRef = useRef<string[]>([])
  const currentNoteEditorRef = useRef<NoteEditorHandle | null>(null)
  const currentExcalidrawEditorRef = useRef<ExcalidrawFileEditorHandle | null>(null)
  const currentNoteEditorDirtyRef = useRef(false)
  const persistedNoteFingerprintsRef = useRef<Record<string, string>>({})
  const pendingNoteSaveRef = useRef<{ relPath: string; content: string } | null>(null)
  const noteSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteSaveInFlightRef = useRef<Promise<void> | null>(null)
  const openNoteRequestIdRef = useRef(0)
  const previousActivePageRef = useRef(activePage)
  const activePageRef = useRef(activePage)
  const pageNavigationQueueRef = useRef<Promise<void>>(Promise.resolve())
  const calendarTasksRef = useRef(calendarTasks)
  const hasAttemptedVaultRestoreRef = useRef(false)
  const hasRightPanel = activePage !== 'designAudit' && activePage !== 'capture'
  const shouldSlideWorkspacePanelOut = !hasRightPanel || isRightPanelCollapsed || isFocusMode

  useEffect(() => {
    currentNotePathRef.current = currentNotePath
  }, [currentNotePath])

  useEffect(() => {
    currentExcalidrawPathRef.current = currentExcalidrawPath
  }, [currentExcalidrawPath])

  useEffect(() => {
    activePageRef.current = activePage
  }, [activePage])

  useEffect(() => {
    activeWorkspaceTabIdRef.current = activeWorkspaceTabId
  }, [activeWorkspaceTabId])

  const getWorkspaceTabSession = useCallback(
    (tabId = activeWorkspaceTabIdRef.current): NotebookWorkspaceSession => {
      const existingSession = workspaceTabSessionsRef.current[tabId]
      if (existingSession) {
        return existingSession
      }

      const nextSession = createEmptyNotebookWorkspaceSession()
      workspaceTabSessionsRef.current[tabId] = nextSession
      return nextSession
    },
    []
  )

  useEffect(() => {
    const session = getWorkspaceTabSession()
    session.currentNotePath = currentNotePath
    session.currentExcalidrawPath = currentExcalidrawPath
    session.currentNoteContent = currentNoteContent
    session.currentNoteTags = [...currentNoteTagsState]
    session.currentNoteEditorDraft = currentNoteEditorDraft
    session.searchQuery = searchQuery
    session.searchResults = [...searchResults]
    session.selectedNoteTreeEntries = selectedNoteTreeEntries.map((entry) => ({ ...entry }))
  }, [
    currentExcalidrawPath,
    currentNoteContent,
    currentNoteEditorDraft,
    currentNotePath,
    currentNoteTagsState,
    getWorkspaceTabSession,
    searchQuery,
    searchResults,
    selectedNoteTreeEntries
  ])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const target = window as Window & {
      __XINGULARITY_E2E__?: {
        getCurrentNoteSnapshot?: () =>
          | { path: string | null; content: string }
          | Promise<{ path: string | null; content: string }>
        getLastPageLeaveSaveDebug?: () => PageLeaveSaveDebug
      }
    }

    target.__XINGULARITY_E2E__ = {
      ...target.__XINGULARITY_E2E__,
      getCurrentNoteSnapshot: async () => {
        const state = useVaultStore.getState()
        const liveSnapshot = await currentNoteEditorRef.current?.captureSnapshot()
        return {
          path: state.currentNotePath,
          content: liveSnapshot?.content ?? state.currentNoteContent
        }
      },
      getLastPageLeaveSaveDebug: () => ({ ...pageLeaveSaveDebugState })
    }
  }, [currentNoteContent, currentNotePath])

  useEffect(() => {
    currentNoteContentRef.current = currentNoteContent
  }, [currentNoteContent])

  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  const replaceNotes = useCallback(
    (nextNotes: NoteListItem[]): void => {
      notesRef.current = nextNotes
      setNotes(nextNotes)
    },
    [setNotes]
  )

  const updateNoteMentionTargets = useCallback(
    (relPath: string, markdown: string): void => {
      const nextMentionTargets = extractMentionTargetsFromMarkdown(markdown)
      const currentNotes = notesRef.current
      const currentNote = currentNotes.find((note) => note.relPath === relPath)

      if (!currentNote || arraysEqual(currentNote.mentionTargets ?? [], nextMentionTargets)) {
        return
      }

      replaceNotes(
        currentNotes.map((note) =>
          note.relPath === relPath ? { ...note, mentionTargets: nextMentionTargets } : note
        )
      )
    },
    [replaceNotes]
  )

  useEffect(() => {
    currentNoteTagsRef.current = currentNoteTagsState
  }, [currentNoteTagsState])

  const buildStoredNoteDocument = useCallback(
    (session: NoteEditorSessionSnapshot) => ({
      version: 1 as const,
      tags: [...session.tags],
      markdown: session.content
    }),
    []
  )

  const getStoredNoteFingerprint = useCallback(
    (session: NoteEditorSessionSnapshot): string =>
      serializeStoredNoteDocument(buildStoredNoteDocument(session)),
    [buildStoredNoteDocument]
  )

  const syncCurrentNoteDirtyState = useCallback(
    (relPath: string | null = currentNotePathRef.current): void => {
      if (!relPath || currentNotePathRef.current !== relPath) {
        return
      }

      const session = getWorkspaceTabSession().noteEditorSessions[relPath]
      const persistedFingerprint = persistedNoteFingerprintsRef.current[relPath]
      currentNoteEditorDirtyRef.current = Boolean(
        session && getStoredNoteFingerprint(session) !== persistedFingerprint
      )
    },
    [getStoredNoteFingerprint, getWorkspaceTabSession]
  )

  const updateNoteListEntryFromDocument = useCallback(
    (relPath: string, document: { markdown: string; tags: string[] }): void => {
      const bodyPreview = splitNoteContent(document.markdown).body.replace(/\s+/g, ' ').trim()
      const mentionTargets = extractMentionTargetsFromMarkdown(document.markdown)
      const nextUpdatedAt = new Date().toISOString()

      replaceNotes(
        notesRef.current.map((note) =>
          note.relPath === relPath
            ? {
                ...note,
                tags: [...document.tags],
                bodyPreview,
                mentionTargets,
                updatedAt: nextUpdatedAt
              }
            : note
        )
      )
    },
    [replaceNotes]
  )

  const persistLastOpenedNotePath = useCallback(
    async (relPath: string | null, options?: { history?: boolean }): Promise<void> => {
      if (!vaultApi) {
        return
      }

      if (lastOpenedNotePath === relPath) {
        return
      }

      try {
        const nextSettings = await vaultApi.settings.update(
          { lastOpenedNotePath: relPath },
          options
        )
        patchSettings({ lastOpenedNotePath: nextSettings.lastOpenedNotePath })
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [vaultApi, lastOpenedNotePath, patchSettings, pushToast]
  )

  const persistFavoriteNotePaths = useCallback(
    async (favoritePaths: string[], options?: { history?: boolean }): Promise<void> => {
      if (!vaultApi) {
        return
      }

      const normalized = Array.from(new Set(favoritePaths))
      const current = favoriteNotePathSettings
      if (
        normalized.length === current.length &&
        normalized.every((relPath, index) => relPath === current[index])
      ) {
        return
      }

      try {
        const nextSettings = await vaultApi.settings.update(
          { favoriteNotePaths: normalized },
          options
        )
        patchSettings({ favoriteNotePaths: nextSettings.favoriteNotePaths })
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [vaultApi, favoriteNotePathSettings, patchSettings, pushToast]
  )

  const selectProject = useCallback(
    (projectId: string | null): void => {
      const previousProjectId = selectedProjectIdRef.current
      selectedProjectIdRef.current = projectId
      setSelectedProjectId(projectId)
      const currentSettings = useVaultStore.getState().settings
      setSettings({ ...currentSettings, lastOpenedProjectId: projectId })

      if (!vaultApi || currentSettings.lastOpenedProjectId === projectId) {
        return
      }

      void vaultApi.projects.select({ projectId }).catch((error: unknown) => {
        if (selectedProjectIdRef.current === projectId) {
          selectedProjectIdRef.current = previousProjectId
          setSelectedProjectId(previousProjectId)
          const latestSettings = useVaultStore.getState().settings
          setSettings({ ...latestSettings, lastOpenedProjectId: previousProjectId })
        }
        pushToast('error', String(error))
      })
    },
    [vaultApi, setSettings, pushToast]
  )

  const noteIsOpen = Boolean(currentNotePath)
  const currentNoteBacklinks = useMemo(() => {
    if (!currentNotePath) {
      return []
    }
    const resolveNoteMentionTarget = createNoteMentionResolver(notes)

    return notes.filter((note) => {
      if (note.relPath === currentNotePath || !note.mentionTargets?.length) {
        return false
      }

      return note.mentionTargets.some(
        (target) => resolveNoteMentionTarget(target) === currentNotePath
      )
    })
  }, [currentNotePath, notes])
  const currentNoteTags = currentNoteTagsState

  const resetCurrentNoteEditorSession = useCallback((): void => {
    currentNoteEditorDirtyRef.current = false
    setCurrentNoteEditorDraft(null)
  }, [])

  const checkpointCurrentNote = useCallback(
    async ({
      updateDraftState = true
    }: {
      updateDraftState?: boolean
    } = {}): Promise<NoteEditorSessionSnapshot | null> => {
      const relPath = currentNotePathRef.current
      if (!relPath) {
        pushNoteSaveTrace('checkpoint:skip-no-path', {})
        return null
      }

      if (!currentNoteEditorRef.current) {
        const existingSession = getWorkspaceTabSession().noteEditorSessions[relPath] ?? null
        if (existingSession && updateDraftState) {
          setCurrentNoteEditorDraft(existingSession.content)
        }
        pushNoteSaveTrace('checkpoint:reuse-session', {
          relPath,
          hasSession: Boolean(existingSession),
          sessionContentPreview: summarizeTraceContent(existingSession?.content)
        })
        return existingSession
      }

      const snapshot: NoteEditorSnapshot = await currentNoteEditorRef.current.flushPendingChanges()
      const nextSession: NoteEditorSessionSnapshot = {
        content: snapshot.content,
        tags: [...currentNoteTagsRef.current]
      }

      getWorkspaceTabSession().noteEditorSessions[relPath] = nextSession
      currentNoteContentRef.current = nextSession.content
      if (updateDraftState) {
        setCurrentNoteContent(nextSession.content)
        setCurrentNoteEditorDraft(nextSession.content)
      }
      pushNoteSaveTrace('checkpoint:capture', {
        relPath,
        contentPreview: summarizeTraceContent(nextSession.content),
        tagCount: nextSession.tags.length
      })

      return nextSession
    },
    [getWorkspaceTabSession, setCurrentNoteContent]
  )

  const setCurrentNoteEditorSession = useCallback(
    (nextContent: string): void => {
      const relPath = currentNotePathRef.current
      const nextSession: NoteEditorSessionSnapshot = {
        content: nextContent,
        tags: [...currentNoteTagsRef.current]
      }

      if (relPath) {
        getWorkspaceTabSession().noteEditorSessions[relPath] = nextSession
        updateNoteMentionTargets(relPath, nextSession.content)
      }

      currentNoteContentRef.current = nextSession.content
      setCurrentNoteContent(nextSession.content)
      setCurrentNoteEditorDraft(nextSession.content)
      currentNoteEditorDirtyRef.current = true
    },
    [getWorkspaceTabSession, setCurrentNoteContent, updateNoteMentionTargets]
  )

  const handleCurrentNoteSnapshotChange = useCallback(
    (snapshot: NoteEditorSnapshot): void => {
      const relPath = currentNotePathRef.current
      const nextSession: NoteEditorSessionSnapshot = {
        content: snapshot.content,
        tags: [...currentNoteTagsRef.current]
      }

      if (relPath) {
        getWorkspaceTabSession().noteEditorSessions[relPath] = nextSession
        updateNoteMentionTargets(relPath, nextSession.content)
      }

      currentNoteContentRef.current = nextSession.content
      setCurrentNoteContent(nextSession.content)
      pushNoteSaveTrace('editor:snapshot-change', {
        relPath,
        contentPreview: summarizeTraceContent(nextSession.content),
        tagCount: nextSession.tags.length
      })
    },
    [getWorkspaceTabSession, setCurrentNoteContent, updateNoteMentionTargets]
  )

  const captureActiveWorkspaceSession = useCallback(async (): Promise<void> => {
    const session = getWorkspaceTabSession(activeWorkspaceTabIdRef.current)
    let checkpointedSession: NoteEditorSessionSnapshot | null = null
    if (currentNotePathRef.current) {
      checkpointedSession = await checkpointCurrentNote({ updateDraftState: false })
    }

    session.currentNotePath = currentNotePathRef.current
    session.currentExcalidrawPath = currentExcalidrawPathRef.current
    session.currentNoteContent = checkpointedSession?.content ?? currentNoteContentRef.current
    session.currentNoteTags = [...(checkpointedSession?.tags ?? currentNoteTagsRef.current)]
    session.currentNoteEditorDraft = checkpointedSession?.content ?? currentNoteEditorDraft
    session.searchQuery = searchQuery
    session.searchResults = [...searchResults]
    session.selectedNoteTreeEntries = selectedNoteTreeEntries.map((entry) => ({ ...entry }))
  }, [
    checkpointCurrentNote,
    currentNoteEditorDraft,
    getWorkspaceTabSession,
    searchQuery,
    searchResults,
    selectedNoteTreeEntries
  ])

  const restoreWorkspaceSession = useCallback(
    (tabId: string): void => {
      const session = getWorkspaceTabSession(tabId)
      const nextNotePath = session.currentNotePath
      const nextNoteSession = nextNotePath ? session.noteEditorSessions[nextNotePath] : null
      const nextNoteContent = nextNoteSession?.content ?? session.currentNoteContent
      const nextTags = [...(nextNoteSession?.tags ?? session.currentNoteTags)]

      currentNotePathRef.current = nextNotePath
      currentExcalidrawPathRef.current = session.currentExcalidrawPath
      currentNoteContentRef.current = nextNoteContent
      currentNoteTagsRef.current = nextTags
      currentNoteEditorDirtyRef.current = Boolean(
        nextNotePath &&
        session.noteEditorSessions[nextNotePath] &&
        getStoredNoteFingerprint(session.noteEditorSessions[nextNotePath]) !==
          persistedNoteFingerprintsRef.current[nextNotePath]
      )

      if (nextNotePath) {
        currentNoteEditorRef.current?.loadDocument({
          content: nextNoteContent,
          notePath: nextNotePath,
          preserveFocus: currentNoteEditorRef.current.hasFocusIntent()
        })
      }

      setCurrentExcalidrawPath(session.currentExcalidrawPath)
      setCurrentNotePath(nextNotePath)
      setCurrentNoteContent(nextNoteContent)
      setCurrentNoteTagsState(nextTags)
      setCurrentNoteEditorDraft(nextNoteSession?.content ?? session.currentNoteEditorDraft)
      setSearchQuery(session.searchQuery)
      setSearchResults([...session.searchResults])
      setSelectedNoteTreeEntries(session.selectedNoteTreeEntries.map((entry) => ({ ...entry })))
    },
    [
      getStoredNoteFingerprint,
      getWorkspaceTabSession,
      setCurrentExcalidrawPath,
      setCurrentNoteContent,
      setCurrentNotePath,
      setSearchQuery,
      setSearchResults
    ]
  )

  // Unscheduled tasks (no date assigned)
  const unscheduledTasks = useMemo(() => {
    return normalizeCalendarTasks(calendarTasks).filter((task) => !task.date)
  }, [calendarTasks])

  const scheduledCalendarTasks = useMemo(() => {
    return normalizeCalendarTasks(calendarTasks).filter((task) => Boolean(task.date))
  }, [calendarTasks])
  const calendarContentFilterOptions = useMemo(
    () => [
      {
        value: 'all' as const,
        label: 'All',
        count: scheduledCalendarTasks.length
      },
      {
        value: 'tasks' as const,
        label: 'Tasks',
        count: scheduledCalendarTasks.length
      }
    ],
    [scheduledCalendarTasks.length]
  )
  const visibleCalendarTasks = useMemo(() => {
    return calendarTasks
  }, [calendarTasks])
  const visibleScheduledCalendarTasks = useMemo(() => {
    return scheduledCalendarTasks
  }, [scheduledCalendarTasks])
  const calendarUndoneCount = useMemo(() => {
    return calendarTasks.filter((task) => !task.completed).length
  }, [calendarTasks])

  const favoriteProjectIds = useMemo(
    () =>
      favoriteProjectIdSettings.filter((projectId) =>
        projects.some((project) => project.id === projectId)
      ),
    [favoriteProjectIdSettings, projects]
  )
  const selectedProjectForHeader = useMemo(() => {
    const visibleProjects = filterProjectsForWorkspace(
      projects,
      favoriteProjectIds,
      projectFilterMode
    )

    return (
      visibleProjects.find((project) => project.id === selectedProjectId) ??
      visibleProjects[0] ??
      null
    )
  }, [favoriteProjectIds, projectFilterMode, projects, selectedProjectId])
  const favoriteNotePaths = useMemo(
    () =>
      favoriteNotePathSettings.filter((relPath) => notes.some((note) => note.relPath === relPath)),
    [favoriteNotePathSettings, notes]
  )
  const currentNoteIsFavorite = currentNotePath
    ? favoriteNotePaths.includes(currentNotePath)
    : false
  const middleHeaderBreadcrumbItem = useMemo(() => {
    if (!hasVault) {
      return 'Select Vault'
    }

    if (activePage === 'notes') {
      if (searchQuery.trim()) {
        return 'Search Results'
      }

      if (currentNotePath || currentExcalidrawPath) {
        return null
      }

      return 'No File Selected'
    }

    if (activePage === 'projects') {
      return null
    }

    if (activePage === 'knowledge') {
      return 'Note graph'
    }

    if (activePage === 'subscriptions') {
      return 'Subscriptions'
    }

    return null
  }, [activePage, hasVault, searchQuery, currentExcalidrawPath, currentNotePath])
  const calendarCurrentPeriodTitle = useMemo(() => {
    if (calendarViewMode === 'week') {
      const start = startOfWeekIso(parseIsoDate(selectedCalendarDate))
      return formatWeekRange(start, addIsoDays(start, 6))
    }

    return parseIsoDate(selectedCalendarDate).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric'
    })
  }, [calendarViewMode, selectedCalendarDate])
  const calendarTodayHeader = useMemo(() => getCalendarHeaderDateParts(todayIso), [todayIso])
  const noteHeaderBreadcrumbSegments = useMemo(() => {
    if (
      activePage !== 'notes' ||
      searchQuery.trim() ||
      (!currentNotePath && !currentExcalidrawPath)
    ) {
      return null
    }

    return stripNotebookFileExtension(currentNotePath ?? currentExcalidrawPath ?? '')
      .split('/')
      .filter(Boolean)
  }, [activePage, currentExcalidrawPath, currentNotePath, searchQuery])

  useEffect(() => {
    if (!vaultApi || !vault?.rootPath) {
      setSettingsLoaded(false)
      return
    }

    let cancelled = false
    const loadVersion = settingsMutationVersionRef.current
    setSettingsLoaded(false)
    void vaultApi.settings
      .get()
      .then((nextSettings) => {
        if (!cancelled && loadVersion === settingsMutationVersionRef.current) {
          setSettings(nextSettings)
        }
        if (!cancelled) {
          setSettingsLoaded(true)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          pushToast('error', String(error))
          setSettingsLoaded(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [vaultApi, vault?.rootPath, setSettings, pushToast])

  useEffect(() => {
    if (!vaultApi || !vault?.rootPath || activePage !== 'capture') {
      setFleetingNotes([])
      setFleetingNotesLoading(false)
      return
    }

    let cancelled = false
    setFleetingNotesLoading(true)
    void vaultApi.fleeting
      .list()
      .then((nextNotes) => {
        if (!cancelled) {
          setFleetingNotes(nextNotes)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          pushToast('error', String(error))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setFleetingNotesLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activePage, pushToast, vault?.rootPath, vaultApi])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const syncColorScheme = (): void => setIsDarkMode(mediaQuery.matches)

    syncColorScheme()
    mediaQuery.addEventListener('change', syncColorScheme)

    return () => {
      mediaQuery.removeEventListener('change', syncColorScheme)
    }
  }, [])

  useEffect(() => {
    calendarTasksRef.current = calendarTasks
  }, [calendarTasks])

  useEffect(() => {
    if (hasVault || !commandPaletteOpen) {
      return
    }

    setCommandPaletteOpen(false)
  }, [commandPaletteOpen, hasVault, setCommandPaletteOpen])

  useEffect(() => {
    if (!settingsLoaded) {
      return
    }

    const storedId = lastOpenedProjectId
    if (storedId && projects.some((project) => project.id === storedId)) {
      if (selectedProjectId !== storedId) {
        selectedProjectIdRef.current = storedId
        setSelectedProjectId(storedId)
      }
      return
    }

    if (!projects.length) {
      if (selectedProjectId !== null) {
        selectedProjectIdRef.current = null
        setSelectedProjectId(null)
      }
      return
    }

    if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
      selectedProjectIdRef.current = projects[0].id
      setSelectedProjectId(projects[0].id)
    }
  }, [settingsLoaded, lastOpenedProjectId, projects, selectedProjectId, setSelectedProjectId])

  const noteSaveCoordinator = useMemo(() => {
    if (!vaultApi) {
      return null
    }

    return createNoteSaveCoordinator({
      writeNote: async ({ relPath, document }) => {
        pushNoteSaveTrace('coordinator:write-start', {
          relPath,
          tagCount: document.tags.length,
          contentPreview: summarizeTraceContent(document.markdown)
        })
        await vaultApi.files.writeNoteDocument(relPath, document)
        pushNoteSaveTrace('coordinator:write-done', {
          relPath,
          tagCount: document.tags.length
        })
      }
    })
  }, [vaultApi])

  const persistNoteSession = useCallback(
    async (relPath: string, session: NoteEditorSessionSnapshot): Promise<void> => {
      if (!noteSaveCoordinator) {
        return
      }

      const document = buildStoredNoteDocument(session)
      const fingerprint = serializeStoredNoteDocument(document)
      if (persistedNoteFingerprintsRef.current[relPath] === fingerprint) {
        syncCurrentNoteDirtyState(relPath)
        return
      }

      pushNoteSaveTrace('persist:enqueue', {
        relPath,
        tagCount: document.tags.length,
        contentPreview: summarizeTraceContent(document.markdown)
      })
      const savePromise = noteSaveCoordinator.enqueue({
        relPath,
        content: session.content,
        document
      })
      noteSaveInFlightRef.current = savePromise

      try {
        await savePromise
        persistedNoteFingerprintsRef.current[relPath] = fingerprint
        updateNoteListEntryFromDocument(relPath, document)
        syncCurrentNoteDirtyState(relPath)
        pushNoteSaveTrace('persist:done', {
          relPath,
          tagCount: document.tags.length,
          contentPreview: summarizeTraceContent(document.markdown)
        })
      } catch (error) {
        if (currentNotePathRef.current === relPath) {
          currentNoteEditorDirtyRef.current = true
        }
        pushNoteSaveTrace('persist:error', {
          relPath,
          error: String(error)
        })
        throw error
      } finally {
        if (noteSaveInFlightRef.current === savePromise) {
          noteSaveInFlightRef.current = null
        }
      }
    },
    [
      buildStoredNoteDocument,
      noteSaveCoordinator,
      syncCurrentNoteDirtyState,
      updateNoteListEntryFromDocument
    ]
  )

  const hasPendingCurrentNoteSave = useCallback((): boolean => {
    const relPath = currentNotePathRef.current
    if (!relPath) {
      return false
    }

    return currentNoteEditorDirtyRef.current || pendingNoteSaveRef.current?.relPath === relPath
  }, [])

  const settleCurrentNoteEditor = useCallback(async (): Promise<void> => {
    if (!currentNoteEditorRef.current) {
      return
    }

    currentNoteEditorRef.current.blur()
    await currentNoteEditorRef.current.flushPendingChanges()
  }, [])

  const stageCurrentNoteForBackgroundSave = useCallback(async (): Promise<void> => {
    const relPath = currentNotePathRef.current
    if (!relPath || !hasPendingCurrentNoteSave()) {
      return
    }

    if (noteSaveTimerRef.current) {
      clearTimeout(noteSaveTimerRef.current)
      noteSaveTimerRef.current = null
    }
    pendingNoteSaveRef.current = null

    await settleCurrentNoteEditor()
    const checkpoint = await checkpointCurrentNote({ updateDraftState: false })
    if (!checkpoint) {
      return
    }

    void persistNoteSession(relPath, checkpoint).catch((error: unknown) => {
      pushToast('error', String(error))
    })
  }, [
    checkpointCurrentNote,
    hasPendingCurrentNoteSave,
    persistNoteSession,
    pushToast,
    settleCurrentNoteEditor
  ])

  const flushCurrentNote = useCallback(
    async ({
      force = false,
      settleEditor = false
    }: {
      force?: boolean
      settleEditor?: boolean
    } = {}): Promise<void> => {
      const relPath = currentNotePathRef.current
      if (!noteSaveCoordinator || !relPath) {
        pushNoteSaveTrace('flush:skip-no-note', {
          force,
          settleEditor,
          hasCoordinator: Boolean(noteSaveCoordinator),
          relPath
        })
        return
      }

      if (!force && !hasPendingCurrentNoteSave()) {
        pushNoteSaveTrace('flush:skip-not-dirty', {
          relPath,
          force,
          settleEditor
        })
        return
      }

      pushNoteSaveTrace('flush:start', {
        relPath,
        force,
        settleEditor,
        dirty: currentNoteEditorDirtyRef.current,
        pendingSaveRelPath: pendingNoteSaveRef.current?.relPath ?? null,
        currentContentPreview: summarizeTraceContent(currentNoteContentRef.current)
      })

      if (settleEditor) {
        await settleCurrentNoteEditor()
      }

      if (noteSaveInFlightRef.current) {
        await noteSaveInFlightRef.current
      }

      if (settleEditor) {
        await settleCurrentNoteEditor()
      }

      if (!force && !hasPendingCurrentNoteSave()) {
        return
      }

      if (noteSaveTimerRef.current) {
        clearTimeout(noteSaveTimerRef.current)
        noteSaveTimerRef.current = null
      }

      pendingNoteSaveRef.current = null
      const shouldRestoreEditorFocus =
        !settleEditor && currentNoteEditorRef.current?.hasFocusIntent() === true

      const savePromise = (async (): Promise<void> => {
        const checkpoint = await checkpointCurrentNote({
          updateDraftState: force || settleEditor
        })
        if (!checkpoint) {
          pushNoteSaveTrace('flush:skip-unchanged', {
            relPath,
            contentPreview: summarizeTraceContent(currentNoteContentRef.current),
            tagCount: currentNoteTagsRef.current.length
          })
          return
        }

        pushNoteSaveTrace('flush:enqueue', {
          relPath,
          contentPreview: summarizeTraceContent(checkpoint.content),
          tagCount: checkpoint.tags.length
        })
        await persistNoteSession(relPath, checkpoint)
      })()

      noteSaveInFlightRef.current = savePromise

      await savePromise
      syncCurrentNoteDirtyState(relPath)
      if (shouldRestoreEditorFocus || (!settleEditor && document.activeElement === document.body)) {
        currentNoteEditorRef.current?.focus()
      }
      pushNoteSaveTrace('flush:done', {
        relPath,
        currentContentPreview: summarizeTraceContent(currentNoteContentRef.current)
      })
    },
    [
      checkpointCurrentNote,
      hasPendingCurrentNoteSave,
      noteSaveCoordinator,
      persistNoteSession,
      settleCurrentNoteEditor,
      syncCurrentNoteDirtyState
    ]
  )

  const scheduleCurrentNoteAutosave = useCallback((): void => {
    if (!noteSaveCoordinator || !currentNotePathRef.current) {
      return
    }

    pendingNoteSaveRef.current = {
      relPath: currentNotePathRef.current,
      content: currentNoteContentRef.current
    }
    pushNoteSaveTrace('autosave:scheduled', {
      relPath: currentNotePathRef.current,
      contentPreview: summarizeTraceContent(currentNoteContentRef.current)
    })
    if (noteSaveTimerRef.current) {
      clearTimeout(noteSaveTimerRef.current)
    }
    noteSaveTimerRef.current = setTimeout(() => {
      pendingNoteSaveRef.current = null
      noteSaveTimerRef.current = null
      pushNoteSaveTrace('autosave:timer-fired', {
        relPath: currentNotePathRef.current,
        contentPreview: summarizeTraceContent(currentNoteContentRef.current)
      })
      void flushCurrentNote().catch((error: unknown) => {
        pushToast('error', String(error))
      })
    }, NOTE_AUTOSAVE_DELAY_MS)
  }, [flushCurrentNote, noteSaveCoordinator, pushToast])

  const handleCurrentNoteEditorDirty = useCallback((): void => {
    currentNoteEditorDirtyRef.current = true
    scheduleCurrentNoteAutosave()
  }, [scheduleCurrentNoteAutosave])

  const persistCurrentNoteForPageLeave = useCallback(
    async (page: AppPage): Promise<void> => {
      const relPath = currentNotePathRef.current
      pageLeaveSaveDebugState.requestedPage = page
      pageLeaveSaveDebugState.notePath = relPath
      pageLeaveSaveDebugState.snapshotContent = ''
      pageLeaveSaveDebugState.fingerprint = null
      pageLeaveSaveDebugState.attempted = false
      pageLeaveSaveDebugState.writeCompleted = false
      pageLeaveSaveDebugState.skippedReason = null
      pageLeaveSaveDebugState.lastError = null

      if (!relPath || !noteSaveCoordinator) {
        pageLeaveSaveDebugState.skippedReason = 'no-open-note'
        pushNoteSaveTrace('page-leave:skip-no-note', {
          requestedPage: page,
          relPath
        })
        return
      }

      try {
        pushNoteSaveTrace('page-leave:start', {
          requestedPage: page,
          relPath,
          dirty: currentNoteEditorDirtyRef.current,
          pendingSaveRelPath: pendingNoteSaveRef.current?.relPath ?? null,
          currentContentPreview: summarizeTraceContent(currentNoteContentRef.current)
        })
        if (noteSaveTimerRef.current) {
          clearTimeout(noteSaveTimerRef.current)
          noteSaveTimerRef.current = null
        }

        pendingNoteSaveRef.current = null

        await settleCurrentNoteEditor()

        const checkpoint = await checkpointCurrentNote()
        const session = checkpoint ?? {
          content: currentNoteContentRef.current,
          tags: [...currentNoteTagsRef.current]
        }
        const fingerprint = getStoredNoteFingerprint(session)

        pageLeaveSaveDebugState.attempted = true
        pageLeaveSaveDebugState.snapshotContent = session.content
        pageLeaveSaveDebugState.fingerprint = fingerprint

        if (noteSaveInFlightRef.current) {
          await noteSaveInFlightRef.current
        }

        if (persistedNoteFingerprintsRef.current[relPath] === fingerprint) {
          pageLeaveSaveDebugState.skippedReason = 'unchanged'
          pageLeaveSaveDebugState.writeCompleted = true
          pushNoteSaveTrace('page-leave:skip-unchanged', {
            requestedPage: page,
            relPath,
            contentPreview: summarizeTraceContent(session.content)
          })
          return
        }

        pushNoteSaveTrace('page-leave:enqueue', {
          requestedPage: page,
          relPath,
          contentPreview: summarizeTraceContent(session.content),
          tagCount: session.tags.length
        })
        const savePromise = persistNoteSession(relPath, session)
        noteSaveInFlightRef.current = savePromise

        try {
          await savePromise
          pageLeaveSaveDebugState.writeCompleted = true
          pushNoteSaveTrace('page-leave:done', {
            requestedPage: page,
            relPath,
            contentPreview: summarizeTraceContent(currentNoteContentRef.current)
          })
        } finally {
          if (noteSaveInFlightRef.current === savePromise) {
            noteSaveInFlightRef.current = null
          }
        }
      } catch (error) {
        pageLeaveSaveDebugState.lastError = String(error)
        pushNoteSaveTrace('page-leave:error', {
          requestedPage: page,
          relPath,
          error: String(error)
        })
        throw error
      }
    },
    [
      checkpointCurrentNote,
      getStoredNoteFingerprint,
      noteSaveCoordinator,
      persistNoteSession,
      settleCurrentNoteEditor
    ]
  )

  const navigateToPage = useCallback(
    async (page: AppPage): Promise<void> => {
      const runNavigation = async (): Promise<void> => {
        if (!hasVault) {
          return
        }

        const targetPage = normalizePageForPlatform(platform, page)
        const currentPage = activePageRef.current
        if (targetPage === currentPage) {
          return
        }

        pushNoteSaveTrace('navigate:start', {
          from: currentPage,
          to: targetPage,
          currentNotePath: currentNotePathRef.current,
          currentContentPreview: summarizeTraceContent(currentNoteContentRef.current)
        })

        if (currentPage === 'notes' && currentNotePathRef.current) {
          await persistCurrentNoteForPageLeave(targetPage)
        }

        await captureActiveWorkspaceSession()

        activePageRef.current = targetPage
        setActivePage(targetPage)
        setWorkspaceTabs((tabs) =>
          tabs.map((tab) =>
            tab.id === activeWorkspaceTabIdRef.current ? { ...tab, page: targetPage } : tab
          )
        )
        pushNoteSaveTrace('navigate:done', {
          from: currentPage,
          to: targetPage,
          currentNotePath: currentNotePathRef.current
        })
      }

      const queuedNavigation = pageNavigationQueueRef.current
        .catch(() => undefined)
        .then(runNavigation)

      pageNavigationQueueRef.current = queuedNavigation
      await queuedNavigation
    },
    [captureActiveWorkspaceSession, hasVault, persistCurrentNoteForPageLeave, platform]
  )

  const createWorkspaceTabId = useCallback((): string => {
    workspaceTabSequenceRef.current += 1
    return `workspace-tab-${workspaceTabSequenceRef.current}`
  }, [])

  const activateWorkspaceTab = useCallback(
    async (tabId: string, pageOverride?: AppPage): Promise<void> => {
      if (!hasVault || tabId === activeWorkspaceTabIdRef.current) {
        return
      }

      const targetTab = workspaceTabs.find((tab) => tab.id === tabId)
      const targetPage = pageOverride ?? targetTab?.page
      if (!targetPage || !workspaceTabSessionsRef.current[tabId]) {
        return
      }

      const runActivation = async (): Promise<void> => {
        await captureActiveWorkspaceSession()
        await stageCurrentNoteForBackgroundSave()

        activeWorkspaceTabIdRef.current = tabId
        activePageRef.current = targetPage
        setActiveWorkspaceTabId(tabId)
        setActivePage(targetPage)
        restoreWorkspaceSession(tabId)
      }

      const queuedActivation = pageNavigationQueueRef.current
        .catch(() => undefined)
        .then(runActivation)
      pageNavigationQueueRef.current = queuedActivation
      await queuedActivation
    },
    [
      captureActiveWorkspaceSession,
      hasVault,
      restoreWorkspaceSession,
      stageCurrentNoteForBackgroundSave,
      workspaceTabs
    ]
  )

  const handleCreateWorkspaceTab = useCallback((): void => {
    if (!hasVault) {
      return
    }

    const tabId = createWorkspaceTabId()
    workspaceTabSessionsRef.current[tabId] = createEmptyNotebookWorkspaceSession()
    setWorkspaceTabs((tabs) => [...tabs, { id: tabId, page: 'notes' }])
    void activateWorkspaceTab(tabId, 'notes')
  }, [activateWorkspaceTab, createWorkspaceTabId, hasVault])

  const handleSelectWorkspaceTab = useCallback(
    (tabId: string): void => {
      const tab = workspaceTabs.find((candidate) => candidate.id === tabId)
      if (!tab) {
        return
      }

      void activateWorkspaceTab(tab.id, tab.page)
    },
    [activateWorkspaceTab, workspaceTabs]
  )

  const handleSelectWorkspaceTabByIndex = useCallback(
    (index: number): void => {
      const tab = workspaceTabs[index]
      if (tab) {
        handleSelectWorkspaceTab(tab.id)
      }
    },
    [handleSelectWorkspaceTab, workspaceTabs]
  )

  const handleCloseWorkspaceTab = useCallback(
    (tabId: string): void => {
      const tabIds = workspaceTabs.map((tab) => tab.id)
      const nextTabId = getNextActiveWorkspaceTabId(tabIds, tabId)

      if (tabId !== activeWorkspaceTabIdRef.current) {
        delete workspaceTabSessionsRef.current[tabId]
        setWorkspaceTabs((tabs) => tabs.filter((tab) => tab.id !== tabId))
        return
      }

      const nextTab = workspaceTabs.find((tab) => tab.id === nextTabId)
      if (nextTab) {
        void activateWorkspaceTab(nextTab.id, nextTab.page).then(() => {
          delete workspaceTabSessionsRef.current[tabId]
          setWorkspaceTabs((tabs) => tabs.filter((tab) => tab.id !== tabId))
        })
        return
      }

      const replacementTabId = createWorkspaceTabId()
      workspaceTabSessionsRef.current[replacementTabId] = createEmptyNotebookWorkspaceSession()
      void activateWorkspaceTab(replacementTabId, 'notes').then(() => {
        delete workspaceTabSessionsRef.current[tabId]
        setWorkspaceTabs([{ id: replacementTabId, page: 'notes' }])
      })
    },
    [activateWorkspaceTab, createWorkspaceTabId, workspaceTabs]
  )

  const refreshAfterHistoryOperation = useCallback(
    async (affected: HistoryAffectedAreas): Promise<void> => {
      if (!vaultApi) {
        return
      }

      if (affected.settings) {
        const nextSettings = await vaultApi.settings.get()
        calendarTasksRef.current = nextSettings.calendarTasks
        setSettings(nextSettings)
      }

      if (affected.notes) {
        const [nextNotes, nextTree] = await Promise.all([
          vaultApi.files.listNotes(),
          vaultApi.files.listTree()
        ])
        replaceNotes(nextNotes)
        setNoteTree(nextTree)

        if (
          currentNotePathRef.current &&
          !nextNotes.some((note) => note.relPath === currentNotePathRef.current)
        ) {
          delete getWorkspaceTabSession().noteEditorSessions[currentNotePathRef.current]
          delete persistedNoteFingerprintsRef.current[currentNotePathRef.current]
          currentNotePathRef.current = null
          currentNoteContentRef.current = ''
          currentNoteTagsRef.current = []
          setCurrentNotePath(null)
          resetCurrentNoteEditorSession()
          setCurrentNoteTagsState([])
          setCurrentNoteContent('')
          void persistLastOpenedNotePath(null, { history: false })
        }
      }
    },
    [
      getWorkspaceTabSession,
      persistLastOpenedNotePath,
      replaceNotes,
      resetCurrentNoteEditorSession,
      setCurrentNoteContent,
      setCurrentNotePath,
      setSettings,
      setNoteTree,
      vaultApi
    ]
  )

  const runHistoryOperation = useCallback(
    async (action: 'undo' | 'redo'): Promise<void> => {
      if (!vaultApi) {
        return
      }

      try {
        const result =
          action === 'undo' ? await vaultApi.history.undo() : await vaultApi.history.redo()
        if (!result.performed) {
          pushToast('info', action === 'undo' ? 'Nothing to undo' : 'Nothing to redo')
          return
        }
        await refreshAfterHistoryOperation(result.affected)
        pushToast(
          'success',
          `${action === 'undo' ? 'Undid' : 'Redid'} ${formatHistoryLabel(result.label)}`
        )
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [pushToast, refreshAfterHistoryOperation, vaultApi]
  )

  useWorkspaceShellShortcuts({
    enabled: hasVault,
    hasRightPanel,
    activePage,
    onOpenSearchPalette: () => {
      setCommandPaletteInitialQuery('')
      setCommandPaletteOpen(true)
    },
    onOpenCommandPalette: () => {
      setCommandPaletteInitialQuery('>')
      setCommandPaletteOpen(true)
    },
    onToggleRightPanel: () => {
      setIsRightPanelCollapsed((current) => !current)
    },
    onToggleFocusMode: () => {
      setIsFocusMode((current) => !current)
    },
    onRunUndo: () => {
      void runHistoryOperation('undo')
    },
    onRunRedo: () => {
      void runHistoryOperation('redo')
    },
    onToggleCalendarView: () => {
      setCalendarViewMode((current) => (current === 'month' ? 'week' : 'month'))
    },
    onCreateWorkspaceTab: handleCreateWorkspaceTab,
    onCloseActiveWorkspaceTab: () => handleCloseWorkspaceTab(activeWorkspaceTabId),
    onSelectWorkspaceTab: handleSelectWorkspaceTabByIndex,
    onNavigateToPage: (page) => {
      void navigateToPage(page as AppPage)
    },
    isPageAvailable: (page) => isPageAvailable(platform, page as AppPage),
    isTypingTarget: isEditableWorkspaceUndoTarget
  })

  useEffect(() => {
    const previousActivePage = previousActivePageRef.current
    previousActivePageRef.current = activePage

    if (
      previousActivePage === activePage ||
      previousActivePage !== 'notes' ||
      !currentNotePathRef.current ||
      !hasPendingCurrentNoteSave()
    ) {
      return
    }

    void flushCurrentNote({ force: true }).catch((error: unknown) => {
      pushToast('error', String(error))
    })
  }, [activePage, flushCurrentNote, hasPendingCurrentNoteSave, pushToast])

  useEffect(() => {
    const flushPendingNote = (): void => {
      void flushCurrentNote({ force: true }).catch(() => undefined)
    }

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') {
        flushPendingNote()
      }
    }

    window.addEventListener('beforeunload', flushPendingNote)
    window.addEventListener('pagehide', flushPendingNote)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', flushPendingNote)
      window.removeEventListener('pagehide', flushPendingNote)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [flushCurrentNote])

  const updateEditorVimMode = async (enabled: boolean): Promise<void> => {
    if (!vaultApi) {
      return
    }

    try {
      const nextSettings = await vaultApi.settings.update({ editorVimModeEnabled: enabled })
      patchSettings({ editorVimModeEnabled: nextSettings.editorVimModeEnabled })
      pushToast('success', enabled ? 'Vim mode enabled' : 'Vim mode disabled')
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const updateEditorVimKeyMappings = async (
    editorVimKeyMappings: NoteVimKeyMapping[]
  ): Promise<void> => {
    if (!vaultApi) {
      return
    }

    try {
      const nextSettings = await vaultApi.settings.update({ editorVimKeyMappings })
      patchSettings({ editorVimKeyMappings: nextSettings.editorVimKeyMappings })
      pushToast('success', 'Vim key mappings updated')
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const updateProfileName = async (name: string): Promise<void> => {
    if (!vaultApi) {
      return
    }

    try {
      const nextSettings = await vaultApi.settings.update({
        profile: {
          name
        }
      })
      patchSettings({ profile: nextSettings.profile })
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const updateMistralApiKey = async (mistralApiKey: string): Promise<void> => {
    if (!vaultApi) {
      return
    }

    try {
      const nextSettings = await vaultApi.settings.update({
        ai: {
          mistralApiKey
        }
      })
      patchSettings({ ai: nextSettings.ai })
      pushToast('success', mistralApiKey ? 'Mistral API key saved' : 'Mistral API key cleared')
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const persistCalendarTasks = async (calendarTasks: CalendarTask[]): Promise<void> => {
    if (!vaultApi) {
      return
    }

    try {
      const normalizedTasks = normalizeCalendarTasks(calendarTasks)
      const nextSettings = await vaultApi.settings.update({
        tasks: normalizedTasks,
        calendarTasks: normalizedTasks
      })
      patchSettings({
        tasks: nextSettings.tasks ?? nextSettings.calendarTasks,
        calendarTasks: nextSettings.calendarTasks
      })
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const updateCalendarTasks = async (
    updater: (tasks: CalendarTask[]) => CalendarTask[]
  ): Promise<CalendarTask[]> => {
    const nextTasks = normalizeCalendarTasks(updater(calendarTasksRef.current))
    calendarTasksRef.current = nextTasks
    setSettings({
      ...useVaultStore.getState().settings,
      calendarTasks: nextTasks,
      tasks: nextTasks
    })
    await persistCalendarTasks(nextTasks)
    return nextTasks
  }

  const persistProjects = async (nextProjects: Project[]): Promise<boolean> => {
    if (!vaultApi) {
      return false
    }

    settingsMutationVersionRef.current += 1
    const currentSettings = useVaultStore.getState().settings
    const currentProjects = currentSettings.projects
    flushSync(() => {
      setSettings({
        ...currentSettings,
        projects: nextProjects
      })
    })

    try {
      for (const nextProject of nextProjects) {
        const currentProject = currentProjects.find((project) => project.id === nextProject.id)
        if (!currentProject) continue
        if (currentProject.state !== nextProject.state) {
          await vaultApi.projects.setState({
            projectId: nextProject.id,
            state: nextProject.state
          })
        }
        if (
          currentProject.name !== nextProject.name ||
          currentProject.description !== nextProject.description ||
          currentProject.icon.color !== nextProject.icon.color ||
          currentProject.icon.glyph !== nextProject.icon.glyph
        ) {
          await vaultApi.projects.update({
            projectId: nextProject.id,
            name: nextProject.name,
            description: nextProject.description,
            icon: nextProject.icon
          })
        }
      }
      return true
    } catch (error) {
      setSettings(currentSettings)
      pushToast('error', String(error))
      return false
    }
  }

  const persistProjectData = async (
    nextProjects: Project[],
    nextProjectIcons: Record<string, ProjectIconStyle>,
    lastOpenedProjectId?: string | null
  ): Promise<boolean> => {
    const persisted = await persistProjects(nextProjects)
    if (!persisted) return false
    const currentSettings = useVaultStore.getState().settings
    setSettings({
      ...currentSettings,
      projectIcons: nextProjectIcons,
      ...(lastOpenedProjectId === undefined ? {} : { lastOpenedProjectId })
    })
    return true
  }

  // (was addCalendarTask) Add scheduled task via modal prompt — removed in favor of header input for unscheduled tasks

  const createCalendarTask = async (
    title: string,
    date?: string,
    time?: string,
    endTime?: string,
    projectId?: string
  ): Promise<CalendarTask> => {
    if (!vaultApi) {
      throw new Error('No vault is open')
    }

    const trimmed = title.trim() || 'New Task'
    const nextTask = await vaultApi.tasks.create({
      title: trimmed,
      projectId,
      date,
      time,
      endTime
    })
    const nextTasks = normalizeCalendarTasks([...calendarTasksRef.current, nextTask])
    calendarTasksRef.current = nextTasks
    setSettings({
      ...useVaultStore.getState().settings,
      calendarTasks: nextTasks,
      tasks: nextTasks
    })
    return nextTask
  }

  const createProjectTask = async (
    projectId: string | undefined,
    title: string
  ): Promise<CalendarTask> => {
    try {
      return await createCalendarTask(title, undefined, undefined, undefined, projectId)
    } catch (error) {
      pushToast('error', String(error))
      throw error
    }
  }

  const updateProjectTask = (taskId: string, patch: Partial<CalendarTask>): void => {
    void updateCalendarTasks((tasks) =>
      tasks.map((task) => {
        if (task.id !== taskId) return task
        const next = { ...task, ...patch }
        if ('date' in patch || 'endDate' in patch) {
          const nextDate = patch.date
          const nextEndDate =
            nextDate && patch.endDate && patch.endDate >= nextDate ? patch.endDate : undefined
          next.date = nextDate
          next.endDate = nextEndDate
        }
        const status = next.status ?? (next.completed ? 'completed' : 'pending')
        return { ...next, status, completed: status === 'completed' }
      })
    )
    if (patch.date) {
      setSelectedCalendarDate(patch.date)
    }
  }

  const addUnscheduledFromHeader = async (): Promise<void> => {
    const trimmed = calendarHeaderNewTask.trim()
    if (!trimmed) return
    await createCalendarTask(trimmed)
    setCalendarHeaderNewTask('')
  }

  const createTaskForDate = async (date: string): Promise<CalendarTask> => {
    return createCalendarTask('New Task', date)
  }

  const createTaskForWeeklyTime = async (schedule: {
    date: string
    endDate: undefined
    time: string
    endTime: string
  }): Promise<CalendarTask> => {
    return createCalendarTask('New Task', schedule.date, schedule.time, schedule.endTime)
  }

  const toggleCalendarTask = async (taskId: string): Promise<void> => {
    await updateCalendarTasks((tasks) =>
      tasks.map((task) => {
        if (task.id !== taskId) return task
        const completed = !task.completed
        return { ...task, completed, status: completed ? 'completed' : 'pending' }
      })
    )
  }

  const removeCalendarTask = async (taskId: string): Promise<void> => {
    await updateCalendarTasks((tasks) => tasks.filter((task) => task.id !== taskId))
  }

  const renameCalendarTask = async (taskId: string, newTitle: string): Promise<void> => {
    const trimmed = newTitle.trim()
    if (!trimmed) return
    await updateCalendarTasks((tasks) =>
      tasks.map((task) => (task.id === taskId ? { ...task, title: trimmed } : task))
    )
  }

  const updateCalendarTaskType = async (
    taskId: string,
    taskType: CalendarTaskType
  ): Promise<void> => {
    await updateCalendarTasks((tasks) =>
      tasks.map((task) => (task.id === taskId ? { ...task, taskType } : task))
    )
  }

  const updateCalendarTaskPriority = async (
    taskId: string,
    priority: TaskPriority
  ): Promise<void> => {
    await updateCalendarTasks((tasks) =>
      tasks.map((task) => (task.id === taskId ? { ...task, priority } : task))
    )
  }

  const updateCalendarTaskTime = async (
    taskId: string,
    time: string | undefined
  ): Promise<void> => {
    await updateCalendarTasks((tasks) =>
      tasks.map((task) => (task.id === taskId ? { ...task, time } : task))
    )
  }

  const updateCalendarTaskSchedule = async (
    taskId: string,
    schedule: {
      date: string | undefined
      endDate: string | undefined
      time: string | undefined
      endTime: string | undefined
    }
  ): Promise<void> => {
    await updateCalendarTasks((tasks) =>
      tasks.map((task) => {
        if (task.id !== taskId) {
          return task
        }

        const nextDate = schedule.date
        const nextEndDate =
          nextDate && schedule.endDate
            ? schedule.endDate >= nextDate
              ? schedule.endDate
              : nextDate
            : undefined

        return {
          ...task,
          date: nextDate,
          endDate: nextEndDate,
          time: schedule.time,
          endTime: schedule.endTime
        }
      })
    )

    if (schedule.date) {
      setSelectedCalendarDate(schedule.date)
    }
  }

  const updateCalendarTaskReminders = async (
    taskId: string,
    reminders: TaskReminder[]
  ): Promise<void> => {
    await updateCalendarTasks((tasks) =>
      tasks.map((task) => (task.id === taskId ? { ...task, reminders } : task))
    )
  }

  const rescheduleCalendarTask = async (
    taskId: string,
    newDate: string | undefined
  ): Promise<void> => {
    await updateCalendarTasks((tasks) =>
      tasks.map((task) => {
        if (task.id !== taskId) {
          return task
        }

        if (!newDate) {
          return { ...task, date: undefined, endDate: undefined }
        }

        if (!task.date) {
          return { ...task, date: newDate, endDate: undefined }
        }

        const existingEndDate = task.endDate && task.endDate >= task.date ? task.endDate : task.date
        const durationDays = diffIsoDays(task.date, existingEndDate)
        const movedEndDate = addIsoDays(newDate, durationDays)

        return {
          ...task,
          date: newDate,
          endDate: durationDays > 0 ? movedEndDate : undefined
        }
      })
    )
    // If scheduling to a date, switch to that date
    if (newDate) {
      setSelectedCalendarDate(newDate)
    }
  }

  const resizeCalendarTaskStart = async (taskId: string, newStartDate: string): Promise<void> => {
    await updateCalendarTasks((tasks) =>
      tasks.map((task) => {
        if (task.id !== taskId || !task.date) {
          return task
        }

        const currentEnd = task.endDate && task.endDate >= task.date ? task.endDate : task.date
        const clampedStart = newStartDate > currentEnd ? currentEnd : newStartDate

        return {
          ...task,
          date: clampedStart,
          endDate: currentEnd > clampedStart ? currentEnd : undefined
        }
      })
    )
  }

  const resizeCalendarTaskEnd = async (taskId: string, newEndDate: string): Promise<void> => {
    await updateCalendarTasks((tasks) =>
      tasks.map((task) => {
        if (task.id !== taskId || !task.date) {
          return task
        }

        const clampedEnd = newEndDate < task.date ? task.date : newEndDate

        return {
          ...task,
          endDate: clampedEnd > task.date ? clampedEnd : undefined
        }
      })
    )
  }

  const goToPrevCalendarPeriod = (): void => {
    setSelectedCalendarDate(
      calendarViewMode === 'week'
        ? addIsoDays(selectedCalendarDate, -7)
        : shiftIsoMonthClamped(selectedCalendarDate, -1)
    )
  }

  const goToNextCalendarPeriod = (): void => {
    setSelectedCalendarDate(
      calendarViewMode === 'week'
        ? addIsoDays(selectedCalendarDate, 7)
        : shiftIsoMonthClamped(selectedCalendarDate, 1)
    )
  }

  const goToToday = (): void => {
    setSelectedCalendarDate(toIsoDate(new Date()))
  }

  const openVaultSwapper = useCallback((): void => {
    if (!platform.capabilities.supportsVaultPicker || !vaultApi) {
      pushToast('error', 'Vault management is only available inside the Electron app')
      return
    }

    setIsVaultSwapperOpen(true)
  }, [platform.capabilities.supportsVaultPicker, pushToast, vaultApi])

  const applyOpenNoteSession = useCallback(
    (relPath: string, session: NoteEditorSessionSnapshot): void => {
      const nextTags = [...session.tags]
      const activeSession = getWorkspaceTabSession()
      activeSession.currentNotePath = relPath
      activeSession.currentExcalidrawPath = null
      activeSession.currentNoteContent = session.content
      activeSession.currentNoteTags = nextTags
      activeSession.currentNoteEditorDraft = session.content
      activeSession.selectedNoteTreeEntries = [{ kind: 'note', relPath }]
      currentNotePathRef.current = relPath
      currentNoteContentRef.current = session.content
      currentNoteTagsRef.current = nextTags
      currentExcalidrawPathRef.current = null
      currentNoteEditorDirtyRef.current =
        getStoredNoteFingerprint(session) !== persistedNoteFingerprintsRef.current[relPath]
      const editor = currentNoteEditorRef.current
      editor?.loadDocument({
        content: session.content,
        notePath: relPath,
        preserveFocus: editor.hasFocusIntent()
      })
      setCurrentExcalidrawPath(null)
      setCurrentNotePath(relPath)
      setCurrentNoteContent(session.content)
      setCurrentNoteTagsState(nextTags)
      setCurrentNoteEditorDraft(session.content)
      setSelectedNoteTreeEntries([{ kind: 'note', relPath }])
    },
    [
      getStoredNoteFingerprint,
      getWorkspaceTabSession,
      setCurrentExcalidrawPath,
      setCurrentNoteContent,
      setCurrentNotePath
    ]
  )

  const openNote = useCallback(
    async (relPath: string): Promise<void> => {
      if (!vaultApi) {
        return
      }

      const requestId = ++openNoteRequestIdRef.current

      if (currentNotePathRef.current === relPath) {
        pushNoteSaveTrace('open-note:skip-current', {
          targetRelPath: relPath,
          currentContentPreview: summarizeTraceContent(currentNoteContentRef.current)
        })
        currentNoteEditorRef.current?.focus()
        void persistLastOpenedNotePath(relPath)
        return
      }

      try {
        pushNoteSaveTrace('open-note:start', {
          targetRelPath: relPath,
          currentNotePath: currentNotePathRef.current,
          currentContentPreview: summarizeTraceContent(currentNoteContentRef.current)
        })
        if (currentNotePathRef.current && currentNotePathRef.current !== relPath) {
          await stageCurrentNoteForBackgroundSave()
        }

        const cachedSession = getWorkspaceTabSession().noteEditorSessions[relPath]
        if (cachedSession) {
          pushNoteSaveTrace('open-note:use-session', {
            relPath,
            tagCount: cachedSession.tags.length,
            contentPreview: summarizeTraceContent(cachedSession.content)
          })
          if (requestId !== openNoteRequestIdRef.current) {
            return
          }
          applyOpenNoteSession(relPath, cachedSession)
          void persistLastOpenedNotePath(relPath)
          return
        }

        const document = await vaultApi.files.readNoteDocument(relPath)
        if (requestId !== openNoteRequestIdRef.current) {
          return
        }
        const content = splitNoteContent(document.markdown).body
        pushNoteSaveTrace('open-note:read-disk', {
          relPath,
          tagCount: document.tags.length,
          contentPreview: summarizeTraceContent(content)
        })
        const nextSession = {
          content,
          tags: [...document.tags]
        }
        getWorkspaceTabSession().noteEditorSessions[relPath] = nextSession
        persistedNoteFingerprintsRef.current[relPath] = serializeStoredNoteDocument(document)
        applyOpenNoteSession(relPath, nextSession)
        void persistLastOpenedNotePath(relPath)
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [
      applyOpenNoteSession,
      getWorkspaceTabSession,
      stageCurrentNoteForBackgroundSave,
      vaultApi,
      pushToast,
      persistLastOpenedNotePath
    ]
  )

  const openExcalidrawFile = useCallback(
    async (relPath: string): Promise<void> => {
      if (!vaultApi) {
        return
      }

      try {
        if (currentNotePathRef.current) {
          await flushCurrentNote({ force: true, settleEditor: true })
        }

        const activeSession = getWorkspaceTabSession()
        activeSession.currentExcalidrawPath = relPath
        activeSession.currentNotePath = null
        activeSession.currentNoteContent = ''
        activeSession.currentNoteTags = []
        activeSession.currentNoteEditorDraft = null
        activeSession.selectedNoteTreeEntries = [{ kind: 'excalidraw', relPath }]
        currentExcalidrawPathRef.current = relPath
        currentNotePathRef.current = null
        currentNoteContentRef.current = ''
        currentNoteTagsRef.current = []
        setCurrentExcalidrawPath(relPath)
        setCurrentNotePath(null)
        resetCurrentNoteEditorSession()
        setCurrentNoteTagsState([])
        setCurrentNoteContent('')
        setSelectedNoteTreeEntries([{ kind: 'excalidraw', relPath }])
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [
      flushCurrentNote,
      getWorkspaceTabSession,
      pushToast,
      resetCurrentNoteEditorSession,
      setCurrentExcalidrawPath,
      setCurrentNoteContent,
      setCurrentNotePath,
      vaultApi
    ]
  )

  const openNotebookPath = useCallback(
    async (relPath: string): Promise<void> => {
      if (isExcalidrawPath(relPath)) {
        await openExcalidrawFile(relPath)
        return
      }

      await openNote(relPath)
    },
    [openExcalidrawFile, openNote]
  )

  useEffect(() => {
    if (!settingsLoaded) {
      return
    }

    if (favoriteNotePaths.length === favoriteNotePathSettings.length) {
      return
    }

    void persistFavoriteNotePaths(favoriteNotePaths)
  }, [settingsLoaded, favoriteNotePaths, favoriteNotePathSettings.length, persistFavoriteNotePaths])

  const loadNoteTree = useCallback(async (): Promise<void> => {
    if (!vaultApi || !vault) {
      setNoteTree([])
      return
    }

    try {
      const nextTree = await vaultApi.files.listTree()
      setNoteTree(nextTree)
    } catch (error) {
      pushToast('error', String(error))
    }
  }, [pushToast, setNoteTree, vault, vaultApi])

  const refreshSavedVaultCount = useCallback(
    async (options?: { notifyOnError?: boolean }): Promise<void> => {
      if (!vaultApi) {
        setSavedVaultCount(0)
        return
      }

      try {
        const state = await vaultApi.vault.listSaved()
        setSavedVaultCount(state.vaults.length)
      } catch (error) {
        if (options?.notifyOnError) {
          pushToast('error', String(error))
        }
      }
    },
    [pushToast, vaultApi]
  )

  const resetVaultScopedUiState = useCallback((): void => {
    workspaceTabSessionsRef.current = {
      [INITIAL_WORKSPACE_TAB_ID]: createEmptyNotebookWorkspaceSession()
    }
    workspaceTabSequenceRef.current = 1
    activeWorkspaceTabIdRef.current = INITIAL_WORKSPACE_TAB_ID
    activePageRef.current = 'notes'
    setWorkspaceTabs([{ id: INITIAL_WORKSPACE_TAB_ID, page: 'notes' }])
    setActiveWorkspaceTabId(INITIAL_WORKSPACE_TAB_ID)
    setActivePage('notes')
    currentNotePathRef.current = null
    currentExcalidrawPathRef.current = null
    currentNoteContentRef.current = ''
    currentNoteTagsRef.current = []
    currentNoteEditorDirtyRef.current = false
    pendingNoteSaveRef.current = null
    persistedNoteFingerprintsRef.current = {}
    openNoteRequestIdRef.current += 1
    if (noteSaveTimerRef.current) {
      window.clearTimeout(noteSaveTimerRef.current)
      noteSaveTimerRef.current = null
    }
    setCurrentNotePath(null)
    setCurrentExcalidrawPath(null)
    resetCurrentNoteEditorSession()
    setCurrentNoteTagsState([])
    setCurrentNoteContent('')
    setCurrentNoteEditorDraft(null)
    setSearchQuery('')
    setSearchResults([])
    setNoteTree([])
    setFleetingNotes([])
    setSelectedNoteTreeEntries([])
    selectedProjectIdRef.current = null
    setSelectedProjectId(null)
  }, [
    setActivePage,
    setActiveWorkspaceTabId,
    setWorkspaceTabs,
    resetCurrentNoteEditorSession,
    setCurrentExcalidrawPath,
    setCurrentNoteContent,
    setCurrentNotePath,
    setSearchQuery,
    setSearchResults,
    setNoteTree,
    setFleetingNotes
  ])

  const applyVaultActivationResult = useCallback(
    async (result: VaultOpenResult, successMessage?: string): Promise<void> => {
      setSettingsLoaded(false)
      resetVaultScopedUiState()
      setVault(result.info)
      replaceNotes(result.notes)
      setNoteTree(result.tree)
      await refreshSavedVaultCount()
      if (successMessage) {
        pushToast('success', successMessage)
      }
    },
    [
      pushToast,
      replaceNotes,
      refreshSavedVaultCount,
      resetVaultScopedUiState,
      setNoteTree,
      setVault
    ]
  )

  const clearActiveVaultState = useCallback(
    async (successMessage?: string): Promise<void> => {
      setSettingsLoaded(false)
      setVault(null)
      replaceNotes([])
      resetVaultScopedUiState()
      await refreshSavedVaultCount()
      if (successMessage) {
        pushToast('success', successMessage)
      }
    },
    [pushToast, refreshSavedVaultCount, replaceNotes, resetVaultScopedUiState, setVault]
  )

  const activateVaultFromNoVaultPage = useCallback(
    async (mode: 'open' | 'create'): Promise<void> => {
      if (!vaultApi || !platform.capabilities.supportsVaultPicker) {
        return
      }

      try {
        const result = mode === 'open' ? await vaultApi.vault.open() : await vaultApi.vault.create()
        if (!result) {
          return
        }

        await applyVaultActivationResult(
          result,
          mode === 'open'
            ? `Vault ready at ${result.info.rootPath}`
            : `Created vault at ${result.info.rootPath}`
        )
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [applyVaultActivationResult, platform.capabilities.supportsVaultPicker, pushToast, vaultApi]
  )

  useEffect(() => {
    if (!vaultApi || hasAttemptedVaultRestoreRef.current) {
      return
    }
    hasAttemptedVaultRestoreRef.current = true

    void (async () => {
      try {
        const restored = await vaultApi.vault.restoreLast()
        if (!restored) {
          const nextSettings = await vaultApi.settings.get()
          setSettings(nextSettings)
          return
        }
        await applyVaultActivationResult(restored, `Restored vault ${restored.info.rootPath}`)
      } catch (error) {
        pushToast('error', String(error))
      }
    })()
  }, [applyVaultActivationResult, pushToast, setSettings, vaultApi])

  useEffect(() => {
    void refreshSavedVaultCount()
  }, [refreshSavedVaultCount])

  useEffect(() => {
    if (!isVaultSwapperOpen) {
      void refreshSavedVaultCount()
    }
  }, [isVaultSwapperOpen, refreshSavedVaultCount])

  useEffect(() => {
    if (!vaultApi || !vault) {
      setNoteTree([])
      setSelectedNoteTreeEntries([])
      return
    }

    void loadNoteTree()
  }, [loadNoteTree, notes, projects, vault, vaultApi])

  useEffect(() => {
    const session = getWorkspaceTabSession()
    if (session.selectedNoteTreeEntries.length > 0) {
      setSelectedNoteTreeEntries(session.selectedNoteTreeEntries.map((entry) => ({ ...entry })))
      return
    }

    if (currentExcalidrawPath) {
      const nextSelection = [{ kind: 'excalidraw' as const, relPath: currentExcalidrawPath }]
      session.selectedNoteTreeEntries = nextSelection
      setSelectedNoteTreeEntries(nextSelection)
      return
    }

    if (!currentNotePath) {
      return
    }

    const nextSelection = [{ kind: 'note' as const, relPath: currentNotePath }]
    session.selectedNoteTreeEntries = nextSelection
    setSelectedNoteTreeEntries(nextSelection)
  }, [currentExcalidrawPath, currentNotePath, getWorkspaceTabSession])

  const createNote = async (): Promise<void> => {
    if (!vaultApi) {
      pushToast('error', 'Create note is only available inside the Electron app')
      return
    }

    if (!vault) {
      pushToast('error', 'Select a vault in Settings before creating notes')
      void navigateToPage('settings')
      return
    }

    try {
      const relPath = await createNoteWithFallbackName()
      const nextNotes = await vaultApi.files.listNotes()
      replaceNotes(nextNotes)
      setSearchQuery('')
      setSearchResults([])
      await navigateToPage('notes')
      await openNote(relPath)
      setNoteTitleEditTarget({ relPath, token: Date.now() })
      pushToast('success', 'Note created')
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  createNoteRef.current = createNote

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!hasVault) {
        return
      }

      const isNewNoteShortcut =
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === 'n'

      if (!isNewNoteShortcut) {
        return
      }

      event.preventDefault()
      void createNoteRef.current?.()
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [hasVault])

  const importNotes = async (): Promise<void> => {
    if (!vaultApi) {
      pushToast('error', 'Note import is only available inside the Electron app')
      return
    }

    if (!vault) {
      pushToast('error', 'Select a vault in Settings before importing notes')
      void navigateToPage('settings')
      return
    }

    try {
      const result = await vaultApi.files.importNotes()
      if (result.imported.length === 0 && result.failed.length === 0) {
        return
      }

      const nextNotes = await vaultApi.files.listNotes()
      replaceNotes(nextNotes)
      setSearchQuery('')
      setSearchResults([])
      await navigateToPage('notes')

      if (result.imported.length === 1) {
        await openNote(result.imported[0].relPath)
      }

      pushNoteImportToast(result)
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const migrateBlockNoteNotes = async (): Promise<void> => {
    if (!vaultApi) {
      pushToast('error', 'Note migration is only available inside the Electron app')
      return
    }

    if (!vault) {
      pushToast('error', 'Select a vault in Settings before migrating notes')
      void navigateToPage('settings')
      return
    }

    const confirmed = window.confirm(
      'Convert old BlockNote JSON notes in this vault to markdown? This rewrites detected .md files in notebooks/.'
    )
    if (!confirmed) {
      return
    }

    const openPath = currentNotePathRef.current

    try {
      await flushCurrentNote({ force: true, settleEditor: true })
      const result = await vaultApi.files.migrateBlockNoteNotes()
      Object.values(workspaceTabSessionsRef.current).forEach((session) => {
        session.noteEditorSessions = {}
      })
      persistedNoteFingerprintsRef.current = {}
      await refreshNotesAndTree()

      if (openPath) {
        await openNote(openPath)
      }

      const failedLabel = result.failed.length > 0 ? `, ${result.failed.length} failed` : ''
      pushToast(
        result.failed.length > 0 ? 'error' : 'success',
        `Converted ${result.converted} old note${result.converted === 1 ? '' : 's'}${failedLabel}`
      )
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const migrateTaggedNoteBodyFrontmatter = async (): Promise<void> => {
    if (!vaultApi) {
      pushToast('error', 'Note migration is only available inside the Electron app')
      return
    }

    if (!vault) {
      pushToast('error', 'Select a vault in Settings before migrating notes')
      void navigateToPage('settings')
      return
    }

    const confirmed = window.confirm(
      'Normalize notes that still have tag frontmatter in the visible body? This rewrites the matching .md files in notebooks/.'
    )
    if (!confirmed) {
      return
    }

    const openPath = currentNotePathRef.current

    try {
      await flushCurrentNote({ force: true, settleEditor: true })
      const result = await vaultApi.files.migrateTaggedNoteBodyFrontmatter()
      Object.values(workspaceTabSessionsRef.current).forEach((session) => {
        session.noteEditorSessions = {}
      })
      persistedNoteFingerprintsRef.current = {}
      await refreshNotesAndTree()

      if (openPath) {
        await openNote(openPath)
      }

      const failedLabel = result.failed.length > 0 ? `, ${result.failed.length} failed` : ''
      pushToast(
        result.failed.length > 0 ? 'error' : 'success',
        `Normalized ${result.converted} note${result.converted === 1 ? '' : 's'}${failedLabel}`
      )
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const importLegacyExcalidrawSessions = async (): Promise<void> => {
    if (!vaultApi) {
      pushToast('error', 'Drawing migration is only available inside the Electron app')
      return
    }

    if (!vault) {
      pushToast('error', 'Select a vault in Settings before importing drawings')
      void navigateToPage('settings')
      return
    }

    const confirmed = window.confirm(
      'Import legacy standalone Excalidraw sessions into notebooks/Imported Drawings as .excalidraw files? Existing legacy data will be kept.'
    )
    if (!confirmed) {
      return
    }

    try {
      const result = await vaultApi.excalidraw.importLegacySessions()
      await refreshNotesAndTree()

      if (result.imported.length === 0 && result.failed.length === 0) {
        pushToast('info', 'No legacy drawings found to import')
        return
      }

      const failedLabel = result.failed.length > 0 ? `, ${result.failed.length} failed` : ''
      pushToast(
        result.failed.length > 0 ? 'error' : 'success',
        `Imported ${result.imported.length} drawing${result.imported.length === 1 ? '' : 's'}${failedLabel}`
      )
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const runSearch = async (query: string): Promise<void> => {
    if (!vaultApi) {
      return
    }

    const trimmedQuery = query.trim()
    if (trimmedQuery && activePageRef.current === 'notes' && currentNotePathRef.current) {
      try {
        await flushCurrentNote({ force: true, settleEditor: true })
      } catch (error) {
        pushToast('error', String(error))
        return
      }
    }

    setSearchQuery(query)
    if (!trimmedQuery) {
      setSearchResults([])
      return
    }

    try {
      const results = await vaultApi.search.query(query)
      setSearchResults(results)
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const runCommandPaletteSearch = useCallback(
    async (query: string): Promise<void> => {
      const searchInput = parseCommandPaletteSearchInput(query)
      const requestId = commandPaletteSearchRequestRef.current + 1
      commandPaletteSearchRequestRef.current = requestId

      if (!searchInput.query) {
        setCommandPaletteResults([])
        setCommandPaletteLoading(false)
        return
      }

      if (searchInput.mode === 'name') {
        const noteResults = rankCommandPaletteNotes(notes, searchInput.query, searchInput.mode)
          .slice(0, 10)
          .map<CommandPaletteSearchResult>((note) => ({
            id: `note:${note.relPath}`,
            kind: 'note',
            title: note.title,
            subtitle: note.relPath,
            value: `note:${note.relPath}`,
            keywords: [
              note.title,
              note.fileName,
              note.relPath,
              ...note.aliases,
              ...note.pathSegments
            ],
            tags: note.tags,
            updatedAt: note.updatedAt
          }))

        const projectResults = rankCommandPaletteProjects(projects, searchInput.query)
          .slice(0, 10)
          .map<CommandPaletteSearchResult>((project) => ({
            id: `project:${project.id}`,
            kind: 'project',
            title: project.name,
            subtitle: project.summary || 'Project',
            value: `project:${project.id}`,
            keywords: [
              project.name,
              project.summary,
              project.folderPath ?? '',
              ...getSearchPathSegments(project.folderPath ?? '')
            ]
          }))

        if (commandPaletteSearchRequestRef.current !== requestId) {
          return
        }

        setCommandPaletteLoading(false)
        setCommandPaletteResults([...noteResults, ...projectResults])
        return
      }

      setCommandPaletteLoading(true)

      try {
        let indexedNoteResults: Awaited<ReturnType<RendererVaultApi['search']['query']>> = []
        if (vaultApi) {
          try {
            indexedNoteResults = await vaultApi.search.query(`@${searchInput.query}`)
          } catch {
            indexedNoteResults = []
          }
        }
        const indexedNotePaths = new Set(indexedNoteResults.map((result) => result.relPath))
        const rankedNoteResults = rankCommandPaletteNotes(
          notes,
          searchInput.query,
          searchInput.mode
        ).filter((note) => !indexedNotePaths.has(note.relPath))
        const noteResults = [
          ...indexedNoteResults.map<CommandPaletteSearchResult>((result) => ({
            id: `note:${result.relPath}`,
            kind: 'note',
            title: result.title,
            subtitle: result.relPath,
            value: `note:${result.relPath}`,
            keywords: [result.title, result.relPath, result.snippet],
            tags: result.tags,
            updatedAt: result.updated
          })),
          ...rankedNoteResults.map<CommandPaletteSearchResult>((note) => ({
            id: `note:${note.relPath}`,
            kind: 'note',
            title: note.title,
            subtitle: note.relPath,
            value: `note:${note.relPath}`,
            keywords: [note.title, note.fileName, note.relPath, note.bodyPreview],
            tags: note.tags,
            updatedAt: note.updatedAt
          }))
        ].slice(0, 10)

        if (commandPaletteSearchRequestRef.current !== requestId) {
          return
        }

        setCommandPaletteResults(noteResults)
      } catch (error) {
        if (commandPaletteSearchRequestRef.current !== requestId) {
          return
        }
        pushToast('error', String(error))
      } finally {
        if (commandPaletteSearchRequestRef.current === requestId) {
          setCommandPaletteLoading(false)
        }
      }
    },
    [notes, projects, pushToast, vaultApi]
  )

  const runCommandPaletteAi = useCallback(
    async (prompt: string): Promise<boolean> => {
      if (!vaultApi) {
        pushToast('error', 'AI note completion is only available inside the Electron app')
        return false
      }

      const trimmedPrompt = prompt.trim()
      if (!trimmedPrompt) {
        pushToast('error', 'Type an AI instruction after ? to complete the current note')
        return false
      }

      if (!currentNotePath) {
        pushToast('error', 'Open a note before using AI note completion')
        return false
      }

      setCommandPaletteAiLoading(true)

      try {
        await checkpointCurrentNote()
        const noteContent = currentNoteContentRef.current
        const completion = await vaultApi.ai.completeNote({
          notePath: currentNotePath,
          noteContent,
          prompt: trimmedPrompt
        })

        setCurrentNoteEditorSession(appendTextToNoteMarkdown(noteContent, completion))
        currentNoteEditorDirtyRef.current = true
        scheduleCurrentNoteAutosave()
        pushToast('success', 'AI note completion added')
        return true
      } catch (error) {
        pushToast('error', String(error))
        return false
      } finally {
        setCommandPaletteAiLoading(false)
      }
    },
    [
      checkpointCurrentNote,
      currentNotePath,
      pushToast,
      scheduleCurrentNoteAutosave,
      setCurrentNoteEditorSession,
      vaultApi
    ]
  )

  useEffect(() => {
    if (!commandPaletteOpen) {
      commandPaletteSearchRequestRef.current += 1
      setCommandPaletteResults([])
      setCommandPaletteLoading(false)
      setCommandPaletteAiLoading(false)
    }
  }, [commandPaletteOpen])

  const toVaultFileUrl = useCallback(
    (vaultRelative: string): string | null => {
      if (!vault) {
        return null
      }

      const normalizedRoot = vault.rootPath.replace(/\\/g, '/').replace(/\/+$/, '')
      const normalizedRelative = vaultRelative.replace(/^\/+/, '')
      const absolutePath = `${normalizedRoot}/${normalizedRelative}`
      const normalizedAbsolutePath = absolutePath.startsWith('/')
        ? absolutePath
        : `/${absolutePath}`
      return `vault-file://${encodeURI(normalizedAbsolutePath)}`
    },
    [vault]
  )

  const importAttachment = async (sourcePath: string): Promise<string | null> => {
    if (!vaultApi) {
      return null
    }

    if (!currentNotePath) {
      pushToast('error', 'Open a note before importing attachments')
      return null
    }

    try {
      const vaultRelative = await vaultApi.attachments.import(sourcePath)
      return toVaultFileUrl(vaultRelative)
    } catch (error) {
      pushToast('error', String(error))
      return null
    }
  }

  const importImageFromBlob = async (
    imageBlob: Blob,
    fileExtension: string
  ): Promise<string | null> => {
    if (!vaultApi) {
      return null
    }

    if (!currentNotePath) {
      return null
    }

    if (!vault) {
      return null
    }

    try {
      // Convert Blob to Uint8Array
      const arrayBuffer = await imageBlob.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      const vaultRelative = await vaultApi.attachments.importFromBuffer(uint8Array, fileExtension)
      return toVaultFileUrl(vaultRelative)
    } catch (error) {
      console.error('Failed to import image from clipboard:', error)
      return null
    }
  }

  const addTagToCurrentNote = async (rawTag: string): Promise<void> => {
    if (!currentNotePath) {
      return
    }

    const normalized = normalizeTag(rawTag)
    if (!normalized) {
      pushToast('error', 'Tag can use letters, numbers, dash, underscore')
      return
    }

    if (currentNoteTags.includes(normalized)) {
      pushToast('info', `Tag #${normalized} already exists`)
      return
    }

    await checkpointCurrentNote()
    const nextTags = [...currentNoteTagsRef.current, normalized]
    currentNoteTagsRef.current = nextTags
    setCurrentNoteTagsState(nextTags)
    const relPath = currentNotePathRef.current
    if (relPath && getWorkspaceTabSession().noteEditorSessions[relPath]) {
      getWorkspaceTabSession().noteEditorSessions[relPath] = {
        ...getWorkspaceTabSession().noteEditorSessions[relPath],
        tags: nextTags
      }
    }
    currentNoteEditorDirtyRef.current = true
    scheduleCurrentNoteAutosave()
  }

  const removeTagFromCurrentNote = async (tag: string): Promise<void> => {
    if (!currentNotePath) {
      return
    }

    await checkpointCurrentNote()
    const next = currentNoteTags.filter((item) => item !== tag)
    currentNoteTagsRef.current = next
    setCurrentNoteTagsState(next)
    const relPath = currentNotePathRef.current
    if (relPath && getWorkspaceTabSession().noteEditorSessions[relPath]) {
      getWorkspaceTabSession().noteEditorSessions[relPath] = {
        ...getWorkspaceTabSession().noteEditorSessions[relPath],
        tags: next
      }
    }
    currentNoteEditorDirtyRef.current = true
    scheduleCurrentNoteAutosave()
  }

  const findByTag = (tag: string): void => {
    void runSearch(tag)
  }

  const updateProjectIcon = (projectId: string, nextIcon: ProjectIconStyle): void => {
    const normalizedIcon = normalizeProjectIcon(nextIcon, projectId)
    const nextProjects = projects.map((project) =>
      project.id === projectId
        ? { ...project, icon: normalizedIcon, updatedAt: new Date().toISOString() }
        : project
    )
    const nextProjectIcons = { ...projectIcons, [projectId]: normalizedIcon }
    void persistProjectData(nextProjects, nextProjectIcons)
  }

  const renameCurrentNote = async (newName: string): Promise<void> => {
    if (!vaultApi) {
      return
    }

    if (!currentNotePath) {
      return
    }

    try {
      const oldPath = currentNotePath
      const dir = currentNotePath.includes('/')
        ? currentNotePath.slice(0, currentNotePath.lastIndexOf('/'))
        : ''
      const newFileName = withNoteExtension(newName.trim())
      const newPath = dir ? `${dir}/${newFileName}` : newFileName
      const checkpoint = await checkpointCurrentNote()
      const content = checkpoint?.content ?? currentNoteContentRef.current
      const tags = [...currentNoteTagsRef.current]
      const document = {
        version: 1 as const,
        tags,
        markdown: content
      }

      await flushCurrentNote({ force: true })
      await vaultApi.files.rename(oldPath, newPath)
      const nextNotes = await vaultApi.files.listNotes()
      replaceNotes(nextNotes)
      getWorkspaceTabSession().noteEditorSessions[newPath] = {
        content,
        tags
      }
      delete getWorkspaceTabSession().noteEditorSessions[oldPath]
      persistedNoteFingerprintsRef.current[newPath] = serializeStoredNoteDocument(document)
      delete persistedNoteFingerprintsRef.current[oldPath]
      currentNotePathRef.current = newPath
      currentNoteContentRef.current = content
      currentNoteTagsRef.current = tags
      setCurrentNotePath(newPath)
      setCurrentNoteContent(content)
      setCurrentNoteTagsState(tags)
      setCurrentNoteEditorDraft(content)
      syncCurrentNoteDirtyState(newPath)
      void persistLastOpenedNotePath(newPath)
      if (favoriteNotePaths.includes(oldPath)) {
        void persistFavoriteNotePaths(
          favoriteNotePaths.map((relPath) => (relPath === oldPath ? newPath : relPath))
        )
      }
      pushToast('success', 'Note renamed')
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const deleteNoteByPath = async (relPath: string): Promise<void> => {
    if (!vaultApi) {
      return
    }

    const fileName = relPath.split('/').pop() ?? relPath
    const confirmed = window.confirm(
      `Delete note "${fileName}"? Moved to Trash. Use Undo to restore.`
    )
    if (!confirmed) {
      return
    }

    try {
      await vaultApi.files.delete(relPath)
      const nextNotes = await vaultApi.files.listNotes()
      replaceNotes(nextNotes)
      delete getWorkspaceTabSession().noteEditorSessions[relPath]
      delete persistedNoteFingerprintsRef.current[relPath]
      if (favoriteNotePaths.includes(relPath)) {
        void persistFavoriteNotePaths(
          favoriteNotePaths.filter((path) => path !== relPath),
          {
            history: false
          }
        )
      }
      if (currentNotePath === relPath) {
        currentNotePathRef.current = null
        currentNoteContentRef.current = ''
        currentNoteTagsRef.current = []
        setCurrentNotePath(null)
        resetCurrentNoteEditorSession()
        setCurrentNoteTagsState([])
        setCurrentNoteContent('')
        void persistLastOpenedNotePath(null, { history: false })
      }
      pushToast('success', 'Note deleted')
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const deleteCurrentNote = async (): Promise<void> => {
    if (!currentNotePath) {
      return
    }

    await deleteNoteByPath(currentNotePath)
  }

  const exportCurrentNote = async (format: NoteExportFormat): Promise<void> => {
    if (!vaultApi || !currentNotePath) {
      return
    }

    try {
      setIsNoteExporting(true)
      await flushCurrentNote({ force: true })
      if (format === 'markdown') {
        const exportedPath = await vaultApi.files.exportNote(
          currentNotePath,
          currentNoteContentRef.current
        )
        if (!exportedPath) {
          return
        }
        pushToast('success', `Note exported to ${exportedPath}`)
        setIsNoteExportDialogOpen(false)
        return
      }

      const printableDocument = currentNoteEditorRef.current?.capturePrintableDocument()
      if (!printableDocument) {
        pushToast('error', 'The note editor is not ready for PDF export')
        return
      }

      const result = await vaultApi.files.exportNotePdf({
        relPath: currentNotePath,
        title: getNoteDisplayName(currentNotePath),
        ...printableDocument
      })
      if (!result.path) {
        return
      }

      pushToast('success', `Note exported to ${result.path}`)
      if (result.warnings.length > 0) {
        pushToast('info', `PDF exported with ${result.warnings.length} image warning(s)`)
      }
      setIsNoteExportDialogOpen(false)
    } catch (error) {
      pushToast('error', String(error))
    } finally {
      setIsNoteExporting(false)
    }
  }

  const exportFolderPdf = async (folderPath: string): Promise<void> => {
    if (!vaultApi || isFolderPdfExporting) {
      return
    }

    try {
      setIsFolderPdfExporting(true)
      await flushCurrentNote({ force: true })
      const result = await vaultApi.files.exportFolderPdf({ folderPath })

      if (result.noteCount === 0) {
        pushToast('info', 'No readable Markdown notes found in the selected folder')
        if (result.warnings.length > 0) {
          pushToast('info', `PDF export encountered ${result.warnings.length} warning(s)`)
        }
        return
      }

      if (!result.path) {
        return
      }

      const noteLabel = result.noteCount === 1 ? 'note' : 'notes'
      pushToast('success', `Exported ${result.noteCount} nested ${noteLabel} to ${result.path}`)
      if (result.warnings.length > 0) {
        pushToast('info', `PDF exported with ${result.warnings.length} warning(s)`)
      }
    } catch (error) {
      pushToast('error', String(error))
    } finally {
      setIsFolderPdfExporting(false)
    }
  }

  const copyCurrentNoteMarkdown = async (): Promise<void> => {
    if (!currentNotePath) {
      return
    }

    try {
      await flushCurrentNote({ force: true })
      await navigator.clipboard.writeText(currentNoteContentRef.current)
      pushToast('success', 'Raw markdown copied')
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const exportProject = async (project: Project): Promise<void> => {
    if (!vaultApi) {
      pushToast('error', 'Project export is only available inside the Electron app')
      return
    }

    try {
      const exportContent = [
        `# ${project.name}`,
        '',
        `- Last updated: ${new Date(project.updatedAt).toISOString()}`,
        '',
        '## Description',
        '',
        project.description?.trim() || project.summary.trim() || '_No description provided._',
        ''
      ].join('\n')

      const exportedPath = await vaultApi.files.exportProject(project.name, exportContent)
      if (!exportedPath) {
        return
      }
      pushToast('success', `Project exported to ${exportedPath}`)
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const setProjectFolderPath = async (
    projectId: string,
    nextFolderPath?: string
  ): Promise<boolean> => {
    const normalizedFolderPath = nextFolderPath?.trim() || undefined
    const existing = projects.find((project) => project.id === projectId)
    if (!existing) {
      return false
    }

    if ((existing.folderPath ?? undefined) === normalizedFolderPath) {
      return true
    }

    const nextProjects = projects.map((project) =>
      project.id === projectId
        ? {
            ...project,
            folderPath: normalizedFolderPath,
            updatedAt: new Date().toISOString()
          }
        : project
    )

    return persistProjects(nextProjects)
  }

  const chooseProjectFolder = async (project: Project): Promise<string | null> => {
    if (!vaultApi) {
      pushToast('error', 'Project folder links are only available inside the Electron app')
      return null
    }

    try {
      return await vaultApi.desktop.chooseDirectory(`Link folder for ${project.name}`)
    } catch (error) {
      pushToast('error', String(error))
      return null
    }
  }

  const linkProjectFolder = async (project: Project): Promise<void> => {
    const selectedFolderPath = await chooseProjectFolder(project)
    if (!selectedFolderPath) {
      return
    }

    const saved = await setProjectFolderPath(project.id, selectedFolderPath)
    if (!saved) {
      return
    }

    pushToast('success', 'Project folder linked')
  }

  const openProjectFolder = async (project: Project): Promise<void> => {
    const folderPath = project.folderPath?.trim()
    if (!folderPath) {
      await linkProjectFolder(project)
      return
    }

    if (!vaultApi) {
      pushToast('error', 'Project folder links are only available inside the Electron app')
      return
    }

    try {
      await vaultApi.desktop.openPath(folderPath)
    } catch (error) {
      pushToast('error', `Could not open linked folder: ${String(error)}`)
    }
  }

  const openCurrentNoteFolderInWarp = async (): Promise<void> => {
    if (!vaultApi) {
      pushToast('error', 'Warp is only available inside the Electron app')
      return
    }

    if (!currentNotePath) {
      pushToast('error', 'Open a note before opening its folder in Warp')
      return
    }

    try {
      await vaultApi.desktop.openWarpAtNotePath(currentNotePath)
      pushToast('success', 'Opened current note folder in Warp')
    } catch (error) {
      pushToast('error', `Could not open Warp: ${String(error)}`)
    }
  }

  const toggleCurrentNoteFavorite = (): void => {
    if (!currentNotePath) {
      return
    }

    const nextFavoritePaths = currentNoteIsFavorite
      ? favoriteNotePaths.filter((relPath) => relPath !== currentNotePath)
      : [currentNotePath, ...favoriteNotePaths]

    void persistFavoriteNotePaths(nextFavoritePaths)
  }

  const withComputedProjectState = (project: Project): Project => project

  const createProject = async (input?: {
    name?: string
    description?: string
    icon?: ProjectIconStyle
  }): Promise<string> => {
    if (!vaultApi) {
      throw new Error('No vault is open')
    }

    try {
      settingsMutationVersionRef.current += 1
      const createdProject = await vaultApi.projects.create(input ?? {})
      const nextProject = withComputedProjectState(createdProject)
      const currentSettings = useVaultStore.getState().settings
      const nextProjects = [
        nextProject,
        ...currentSettings.projects.filter((project) => project.id !== nextProject.id)
      ]
      setSettings({
        ...currentSettings,
        projects: nextProjects,
        projectIcons: { ...currentSettings.projectIcons, [nextProject.id]: nextProject.icon },
        lastOpenedProjectId: nextProject.id
      })
      selectedProjectIdRef.current = nextProject.id
      setSelectedProjectId(nextProject.id)
      pushToast('success', 'Project created')
      return nextProject.id
    } catch (error) {
      pushToast('error', String(error))
      throw error
    }
  }

  const createProjectFromToolbar = async (): Promise<void> => {
    if (isCreatingProject) {
      return
    }

    setIsCreatingProject(true)
    try {
      await createProject()
    } catch {
      // The parent reports persistence errors through the existing toast flow.
    } finally {
      setIsCreatingProject(false)
    }
  }

  const renameProject = (projectId: string, nextName: string): void => {
    const normalizedName = nextName.trim()
    if (!normalizedName) {
      return
    }

    const existing = projects.find((project) => project.id === projectId)
    if (!existing || existing.name === normalizedName) {
      return
    }

    const nextProjects = projects.map((project) =>
      project.id === projectId
        ? { ...project, name: normalizedName, updatedAt: new Date().toISOString() }
        : project
    )
    void persistProjects(nextProjects)
  }

  const saveProject = (
    projectId: string,
    draft: { name: string; description: string; icon: ProjectIconStyle }
  ): void => {
    if (!vaultApi) {
      return
    }

    const normalizedName = draft.name.trim()
    if (!normalizedName) {
      return
    }

    const currentSettings = useVaultStore.getState().settings
    const previousProject = currentSettings.projects.find((project) => project.id === projectId)
    if (!previousProject) {
      return
    }

    const icon = normalizeProjectIcon(draft.icon, projectId)
    const optimisticProject = withComputedProjectState({
      ...previousProject,
      name: normalizedName,
      summary: draft.description.trim(),
      description: draft.description.trim(),
      icon,
      updatedAt: new Date().toISOString()
    })
    const mutationVersion = (projectMutationVersionRef.current.get(projectId) ?? 0) + 1
    projectMutationVersionRef.current.set(projectId, mutationVersion)
    setSettings({
      ...currentSettings,
      projects: currentSettings.projects.map((project) =>
        project.id === projectId ? optimisticProject : project
      ),
      projectIcons: { ...currentSettings.projectIcons, [projectId]: icon }
    })

    void vaultApi.projects
      .update({
        projectId,
        name: normalizedName,
        description: draft.description.trim(),
        icon
      })
      .then((updatedProject) => {
        if (projectMutationVersionRef.current.get(projectId) !== mutationVersion) {
          return
        }
        const latestSettings = useVaultStore.getState().settings
        const normalizedProject = withComputedProjectState(updatedProject)
        setSettings({
          ...latestSettings,
          projects: latestSettings.projects.map((project) =>
            project.id === projectId ? normalizedProject : project
          ),
          projectIcons: {
            ...latestSettings.projectIcons,
            [projectId]: normalizedProject.icon
          }
        })
      })
      .catch((error: unknown) => {
        if (projectMutationVersionRef.current.get(projectId) === mutationVersion) {
          const latestSettings = useVaultStore.getState().settings
          setSettings({
            ...latestSettings,
            projects: latestSettings.projects.map((project) =>
              project.id === projectId ? previousProject : project
            ),
            projectIcons: {
              ...latestSettings.projectIcons,
              [projectId]: previousProject.icon
            }
          })
        }
        pushToast('error', String(error))
      })
  }

  const saveProjectProperties = (projectId: string, patch: ProjectPropertiesPatch): void => {
    if (!vaultApi) {
      return
    }

    const currentSettings = useVaultStore.getState().settings
    const previousProject = currentSettings.projects.find((project) => project.id === projectId)
    if (!previousProject) {
      return
    }

    const startDate =
      patch.startDate === null ? undefined : (patch.startDate ?? previousProject.startDate)
    const endDate = patch.endDate === null ? undefined : (patch.endDate ?? previousProject.endDate)
    if (startDate && endDate && endDate < startDate) {
      pushToast('error', 'Project end date cannot be earlier than the start date')
      return
    }

    const optimisticProject = withComputedProjectState({
      ...previousProject,
      startDate,
      endDate,
      tags: patch.tags ?? previousProject.tags,
      resources: patch.resources ?? previousProject.resources,
      updatedAt: new Date().toISOString()
    })
    const mutationVersion = (projectMutationVersionRef.current.get(projectId) ?? 0) + 1
    projectMutationVersionRef.current.set(projectId, mutationVersion)
    setSettings({
      ...currentSettings,
      projects: currentSettings.projects.map((project) =>
        project.id === projectId ? optimisticProject : project
      )
    })

    void vaultApi.projects
      .update({ projectId, ...patch })
      .then((updatedProject) => {
        if (projectMutationVersionRef.current.get(projectId) !== mutationVersion) {
          return
        }
        const latestSettings = useVaultStore.getState().settings
        setSettings({
          ...latestSettings,
          projects: latestSettings.projects.map((project) =>
            project.id === projectId ? withComputedProjectState(updatedProject) : project
          )
        })
      })
      .catch((error: unknown) => {
        if (projectMutationVersionRef.current.get(projectId) === mutationVersion) {
          const latestSettings = useVaultStore.getState().settings
          setSettings({
            ...latestSettings,
            projects: latestSettings.projects.map((project) =>
              project.id === projectId ? previousProject : project
            )
          })
        }
        pushToast('error', String(error))
      })
  }

  const updateProjectSummary = (projectId: string, nextSummary: string): void => {
    const normalizedSummary = nextSummary.trim()

    const existing = projects.find((project) => project.id === projectId)
    if (!existing || existing.summary === normalizedSummary) {
      return
    }

    const nextProjects = projects.map((project) =>
      project.id === projectId
        ? { ...project, summary: normalizedSummary, updatedAt: new Date().toISOString() }
        : project
    )
    void persistProjects(nextProjects)
  }

  void [updateProjectIcon, exportProject, openProjectFolder, renameProject, updateProjectSummary]

  const removeProjectById = async (projectId: string): Promise<void> => {
    if (!vaultApi) {
      return
    }

    const project = projects.find((item) => item.id === projectId)
    if (!project) {
      return
    }

    const confirmed = window.confirm(
      `Remove project "${project.name}" from this workspace? Notebook files are unaffected. Use Undo to restore.`
    )
    if (!confirmed) {
      return
    }

    const linkedTasks = calendarTasksRef.current.filter((task) => task.projectId === projectId)
    const deleteLinkedTasks =
      linkedTasks.length > 0 &&
      window.confirm(
        `Delete ${linkedTasks.length} linked ${linkedTasks.length === 1 ? 'task' : 'tasks'} too? Choose Cancel to keep them as unassigned tasks.`
      )

    try {
      const result = await vaultApi.projects.delete({
        projectId,
        linkedTasks: deleteLinkedTasks ? 'delete' : 'unassign'
      })
      const removedTaskIds = new Set(result.removedTaskIds)
      const unassignedTaskIds = new Set(result.unassignedTaskIds)
      const currentSettings = useVaultStore.getState().settings
      const nextTasks = currentSettings.calendarTasks
        .filter((task) => !removedTaskIds.has(task.id))
        .map((task) => (unassignedTaskIds.has(task.id) ? { ...task, projectId: undefined } : task))
      const nextProjectIcons = { ...currentSettings.projectIcons }
      delete nextProjectIcons[result.deletedProjectId]
      calendarTasksRef.current = nextTasks
      setSettings({
        ...currentSettings,
        projects: currentSettings.projects.filter(
          (project) => project.id !== result.deletedProjectId
        ),
        projectIcons: nextProjectIcons,
        favoriteProjectIds: currentSettings.favoriteProjectIds.filter(
          (id) => id !== result.deletedProjectId
        ),
        calendarTasks: nextTasks,
        tasks: nextTasks,
        lastOpenedProjectId: result.nextSelectedProjectId
      })
      if (selectedProjectIdRef.current === result.deletedProjectId) {
        selectedProjectIdRef.current = result.nextSelectedProjectId
        setSelectedProjectId(result.nextSelectedProjectId)
      }
    } catch (error) {
      pushToast('error', String(error))
      return
    }
    pushToast('success', 'Project removed')
  }

  const toggleProjectFavoriteById = (projectId: string): void => {
    if (!vaultApi) {
      return
    }

    const currentSettings = useVaultStore.getState().settings
    const favorite = !currentSettings.favoriteProjectIds.includes(projectId)
    const previousFavoriteProjectIds = currentSettings.favoriteProjectIds
    const nextFavoriteProjectIds = favorite
      ? [projectId, ...previousFavoriteProjectIds.filter((id) => id !== projectId)]
      : previousFavoriteProjectIds.filter((id) => id !== projectId)
    const mutationVersion = (favoriteProjectMutationVersionRef.current.get(projectId) ?? 0) + 1
    favoriteProjectMutationVersionRef.current.set(projectId, mutationVersion)
    setSettings({ ...currentSettings, favoriteProjectIds: nextFavoriteProjectIds })

    void vaultApi.projects.setFavorite({ projectId, favorite }).catch((error: unknown) => {
      if (favoriteProjectMutationVersionRef.current.get(projectId) === mutationVersion) {
        const latestSettings = useVaultStore.getState().settings
        setSettings({ ...latestSettings, favoriteProjectIds: previousFavoriteProjectIds })
      }
      pushToast('error', String(error))
    })
  }

  const toggleProjectArchiveById = (projectId: string): void => {
    if (!vaultApi) {
      return
    }

    const currentSettings = useVaultStore.getState().settings
    const existing = currentSettings.projects.find((project) => project.id === projectId)
    if (!existing) return
    const archived = existing.state === 'archived'
    const nextState: ProjectState = archived ? 'active' : 'archived'
    const optimisticProject = {
      ...existing,
      state: nextState,
      updatedAt: new Date().toISOString()
    }
    const mutationVersion = (projectMutationVersionRef.current.get(projectId) ?? 0) + 1
    projectMutationVersionRef.current.set(projectId, mutationVersion)
    setSettings({
      ...currentSettings,
      projects: currentSettings.projects.map((project) =>
        project.id === projectId ? optimisticProject : project
      )
    })

    void vaultApi.projects
      .setState({ projectId, state: nextState })
      .then((updatedProject) => {
        if (projectMutationVersionRef.current.get(projectId) !== mutationVersion) return
        const latestSettings = useVaultStore.getState().settings
        setSettings({
          ...latestSettings,
          projects: latestSettings.projects.map((project) =>
            project.id === projectId ? updatedProject : project
          )
        })
        pushToast('success', archived ? 'Project unarchived' : 'Project archived')
      })
      .catch((error: unknown) => {
        if (projectMutationVersionRef.current.get(projectId) === mutationVersion) {
          const latestSettings = useVaultStore.getState().settings
          setSettings({
            ...latestSettings,
            projects: latestSettings.projects.map((project) =>
              project.id === projectId ? existing : project
            )
          })
        }
        pushToast('error', String(error))
      })
  }

  const createNoteWithFallbackName = async (): Promise<string> => {
    if (!vaultApi) {
      throw new Error('Vault API unavailable')
    }

    const base = buildDefaultNoteName()
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const suffix = attempt === 0 ? '' : `-${attempt + 1}`
      const candidate = `${base}${suffix}`
      try {
        return await vaultApi.files.createNote(candidate)
      } catch (error) {
        if (!String(error).includes('EEXIST')) {
          throw error
        }
      }
    }

    throw new Error('Could not create a unique note name')
  }

  const createNoteAtPathWithFallback = useCallback(
    async (parentDir: string): Promise<string> => {
      if (!vaultApi) {
        throw new Error('Vault API unavailable')
      }

      const base = buildDefaultNoteName()
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const suffix = attempt === 0 ? '' : `-${attempt + 1}`
        const fileName = withNoteExtension(`${base}${suffix}`)
        const candidate = parentDir ? `${parentDir}/${fileName}` : fileName
        try {
          return await vaultApi.files.createNoteAtPath(candidate)
        } catch (error) {
          if (!String(error).includes('EEXIST')) {
            throw error
          }
        }
      }

      throw new Error('Could not create a unique note name')
    },
    [vaultApi]
  )

  const createExcalidrawAtPathWithFallback = useCallback(
    async (parentDir: string): Promise<string> => {
      if (!vaultApi) {
        throw new Error('Vault API unavailable')
      }

      const base = 'untitled-drawing'
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const suffix = attempt === 0 ? '' : `-${attempt + 1}`
        const fileName = withExcalidrawExtension(`${base}${suffix}`)
        const candidate = parentDir ? `${parentDir}/${fileName}` : fileName
        try {
          return await vaultApi.files.createExcalidrawFileAtPath(candidate)
        } catch (error) {
          if (!String(error).includes('EEXIST')) {
            throw error
          }
        }
      }

      throw new Error('Could not create a unique drawing name')
    },
    [vaultApi]
  )

  const createNoteAtExactPathWithFallback = useCallback(
    async (relPath: string): Promise<string> => {
      if (!vaultApi) {
        throw new Error('Vault API unavailable')
      }

      const normalizedPath = withNoteExtension(relPath.trim().replace(/^\/+/, ''))
      if (!normalizedPath) {
        throw new Error('Note path is required')
      }

      try {
        return await vaultApi.files.createNoteAtPath(normalizedPath)
      } catch (error) {
        if (!String(error).includes('EEXIST')) {
          throw error
        }

        return normalizedPath
      }
    },
    [vaultApi]
  )

  const createFolderWithFallback = useCallback(
    async (parentDir: string): Promise<string> => {
      if (!vaultApi) {
        throw new Error('Vault API unavailable')
      }

      const base = 'untitled-folder'
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const suffix = attempt === 0 ? '' : `-${attempt + 1}`
        const folderName = `${base}${suffix}`
        const candidate = parentDir ? `${parentDir}/${folderName}` : folderName
        try {
          return await vaultApi.files.createFolder(candidate)
        } catch (error) {
          if (!String(error).includes('EEXIST')) {
            throw error
          }
        }
      }

      throw new Error('Could not create a unique folder name')
    },
    [vaultApi]
  )

  const refreshNotesAndTree = useCallback(async (): Promise<NoteTreeNode[]> => {
    if (!vaultApi) {
      return []
    }

    const [nextNotes, nextTree] = await Promise.all([
      vaultApi.files.listNotes(),
      vaultApi.files.listTree()
    ])

    replaceNotes(nextNotes)
    setNoteTree(nextTree)
    if (
      currentNotePathRef.current &&
      !nextNotes.some((note) => note.relPath === currentNotePathRef.current)
    ) {
      delete getWorkspaceTabSession().noteEditorSessions[currentNotePathRef.current]
      delete persistedNoteFingerprintsRef.current[currentNotePathRef.current]
      currentNotePathRef.current = null
      currentNoteContentRef.current = ''
      currentNoteTagsRef.current = []
      setCurrentNotePath(null)
      resetCurrentNoteEditorSession()
      setCurrentNoteTagsState([])
      setCurrentNoteContent('')
      void persistLastOpenedNotePath(null, { history: false })
    }
    if (
      currentExcalidrawPathRef.current &&
      !treeContainsPath(nextTree, currentExcalidrawPathRef.current)
    ) {
      currentExcalidrawPathRef.current = null
      setCurrentExcalidrawPath(null)
    }
    return nextTree
  }, [
    getWorkspaceTabSession,
    persistLastOpenedNotePath,
    replaceNotes,
    resetCurrentNoteEditorSession,
    setCurrentExcalidrawPath,
    setCurrentNoteContent,
    setCurrentNotePath,
    setNoteTree,
    vaultApi
  ])

  const createFleetingNote = useCallback(
    async (content: string): Promise<void> => {
      if (!vaultApi) {
        throw new Error('Vault API unavailable')
      }

      const note = await vaultApi.fleeting.create(content)
      setFleetingNotes((current) => [note, ...current])
      pushToast('success', 'Captured')
    },
    [pushToast, vaultApi]
  )

  const convertFleetingNote = useCallback(
    async (
      relPath: string,
      target: FleetingConversionTarget
    ): Promise<FleetingConversionResult> => {
      if (!vaultApi) {
        throw new Error('Vault API unavailable')
      }

      const result = await vaultApi.fleeting.convert({ relPath, target })
      setFleetingNotes((current) => current.filter((note) => note.relPath !== relPath))

      if (target === 'note') {
        await refreshNotesAndTree()
        pushToast('success', 'Converted to note')
      } else {
        const nextSettings = await vaultApi.settings.get()
        setSettings(nextSettings)
        pushToast('success', 'Converted to task')
      }

      return result
    },
    [pushToast, refreshNotesAndTree, setSettings, vaultApi]
  )

  useEffect(() => {
    if (!vaultApi || !vault) {
      return
    }

    void refreshNotesAndTree()
  }, [projects, refreshNotesAndTree, vault, vaultApi])

  const getTreeTargetDirectory = useCallback((): string => {
    if (!primarySelectedNoteTreeEntry) {
      return ''
    }

    if (primarySelectedNoteTreeEntry.kind === 'folder') {
      return primarySelectedNoteTreeEntry.relPath
    }

    const slashIndex = primarySelectedNoteTreeEntry.relPath.lastIndexOf('/')
    return slashIndex >= 0 ? primarySelectedNoteTreeEntry.relPath.slice(0, slashIndex) : ''
  }, [primarySelectedNoteTreeEntry])

  const createNoteFromTree = useCallback(
    async (targetDir?: string): Promise<void> => {
      if (!vaultApi) {
        pushToast('error', 'Create note is only available inside the Electron app')
        return
      }

      if (!vault) {
        pushToast('error', 'Select a vault in Settings before creating notes')
        void navigateToPage('settings')
        return
      }

      try {
        const relPath = await createNoteAtPathWithFallback(targetDir ?? getTreeTargetDirectory())
        await refreshNotesAndTree()
        setSelectedNoteTreeEntries([{ kind: 'note', relPath }])
        setSearchQuery('')
        setSearchResults([])
        await navigateToPage('notes')
        await openNote(relPath)
        setNoteTitleEditTarget({ relPath, token: Date.now() })
        pushToast('success', 'Note created')
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [
      createNoteAtPathWithFallback,
      getTreeTargetDirectory,
      navigateToPage,
      openNote,
      pushToast,
      refreshNotesAndTree,
      setSearchQuery,
      setSearchResults,
      vault,
      vaultApi
    ]
  )

  const createExcalidrawFromTree = useCallback(
    async (targetDir?: string): Promise<void> => {
      if (!vaultApi) {
        pushToast('error', 'Create drawing is only available inside the Electron app')
        return
      }

      if (!vault) {
        pushToast('error', 'Select a vault in Settings before creating drawings')
        void navigateToPage('settings')
        return
      }

      try {
        const relPath = await createExcalidrawAtPathWithFallback(
          targetDir ?? getTreeTargetDirectory()
        )
        await refreshNotesAndTree()
        setSelectedNoteTreeEntries([{ kind: 'excalidraw', relPath }])
        setSearchQuery('')
        setSearchResults([])
        await navigateToPage('notes')
        await openExcalidrawFile(relPath)
        pushToast('success', 'Drawing created')
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [
      createExcalidrawAtPathWithFallback,
      getTreeTargetDirectory,
      navigateToPage,
      openExcalidrawFile,
      pushToast,
      refreshNotesAndTree,
      setSearchQuery,
      setSearchResults,
      vault,
      vaultApi
    ]
  )

  const openOrCreateNoteMention = useCallback(
    async (rawTarget: string): Promise<void> => {
      if (!vaultApi) {
        pushToast('error', 'Note links are only available inside the Electron app')
        return
      }

      if (!vault) {
        pushToast('error', 'Select a vault in Settings before following note links')
        void navigateToPage('settings')
        return
      }

      const target = stripNoteExtension(rawTarget.trim()).replace(/^\/+/, '').replace(/\/+$/, '')
      if (!target) {
        return
      }

      const normalizedTarget = normalizeMentionTarget(target)
      const exactMatch = notes.find(
        (note) => normalizeMentionTarget(note.relPath) === normalizedTarget
      )
      const byNameMatches = notes.filter(
        (note) => normalizeMentionTarget(note.name) === normalizedTarget
      )
      const targetDir = target.includes('/')
        ? target.split('/').slice(0, -1).join('/')
        : currentNotePath
          ? currentNotePath.split('/').slice(0, -1).join('/')
          : ''
      const preferredPath = target.includes('/')
        ? target
        : targetDir
          ? `${targetDir}/${target}`
          : target

      try {
        const matchedRelPath =
          exactMatch?.relPath ?? (byNameMatches.length === 1 ? byNameMatches[0].relPath : null)
        const relPath = matchedRelPath ?? (await createNoteAtExactPathWithFallback(preferredPath))

        await refreshNotesAndTree()
        setSearchQuery('')
        setSearchResults([])
        await navigateToPage('notes')
        setSelectedNoteTreeEntries([{ kind: 'note', relPath }])
        await openNote(relPath)

        if (!matchedRelPath) {
          setNoteTitleEditTarget({ relPath, token: Date.now() })
          pushToast('success', 'Note created')
        }
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [
      createNoteAtExactPathWithFallback,
      currentNotePath,
      navigateToPage,
      notes,
      openNote,
      pushToast,
      refreshNotesAndTree,
      setSearchQuery,
      setSearchResults,
      vault,
      vaultApi
    ]
  )

  const createFolderFromTree = useCallback(
    async (targetDir?: string): Promise<void> => {
      if (!vaultApi) {
        pushToast('error', 'Create folder is only available inside the Electron app')
        return
      }

      if (!vault) {
        pushToast('error', 'Select a vault in Settings before creating folders')
        void navigateToPage('settings')
        return
      }

      try {
        const relPath = await createFolderWithFallback(targetDir ?? getTreeTargetDirectory())
        await refreshNotesAndTree()
        setSelectedNoteTreeEntries([{ kind: 'folder', relPath }])
        setPendingNoteTreeEditId(`folder:${relPath}`)
        pushToast('success', 'Folder created')
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [
      createFolderWithFallback,
      getTreeTargetDirectory,
      navigateToPage,
      pushToast,
      refreshNotesAndTree,
      vault,
      vaultApi
    ]
  )

  const renameTreePath = useCallback(
    async (
      relPath: string,
      nextName: string,
      kind: 'note' | 'excalidraw' | 'folder'
    ): Promise<void> => {
      if (!vaultApi) {
        return
      }

      const trimmed = nextName.trim()
      if (!trimmed) {
        return
      }

      const slashIndex = relPath.lastIndexOf('/')
      const parentDir = slashIndex >= 0 ? relPath.slice(0, slashIndex) : ''
      const normalizedName =
        kind === 'note'
          ? withNoteExtension(trimmed)
          : kind === 'excalidraw'
            ? withExcalidrawExtension(trimmed)
            : trimmed
      const nextRelPath = parentDir ? `${parentDir}/${normalizedName}` : normalizedName

      if (nextRelPath === relPath) {
        return
      }

      const isCurrentExcalidraw =
        kind === 'excalidraw' && currentExcalidrawPathRef.current === relPath

      try {
        if (isCurrentExcalidraw) {
          await currentExcalidrawEditorRef.current?.prepareForPathMutation()
        }

        Object.values(workspaceTabSessionsRef.current).forEach((session) => {
          remapNotebookWorkspaceSessionPaths(session, relPath, nextRelPath)
        })
        Object.entries(persistedNoteFingerprintsRef.current).forEach(([path, fingerprint]) => {
          const remappedPath = remapNestedPath(path, relPath, nextRelPath)
          if (remappedPath && remappedPath !== path) {
            persistedNoteFingerprintsRef.current[remappedPath] = fingerprint
            delete persistedNoteFingerprintsRef.current[path]
          }
        })

        await vaultApi.files.renamePath(relPath, nextRelPath)

        if (isCurrentExcalidraw) {
          currentExcalidrawPathRef.current = nextRelPath
          setCurrentExcalidrawPath(nextRelPath)
        }

        await refreshNotesAndTree()
        setSelectedNoteTreeEntries([{ kind, relPath: nextRelPath }])
        const activeSession = getWorkspaceTabSession()
        const nextCurrentNotePath = activeSession.currentNotePath
        const nextCurrentExcalidrawPath = activeSession.currentExcalidrawPath
        if (nextCurrentNotePath !== currentNotePath) {
          currentNotePathRef.current = nextCurrentNotePath
          setCurrentNotePath(nextCurrentNotePath)
          void persistLastOpenedNotePath(nextCurrentNotePath)
        }
        if (nextCurrentExcalidrawPath !== currentExcalidrawPath) {
          currentExcalidrawPathRef.current = nextCurrentExcalidrawPath
          setCurrentExcalidrawPath(nextCurrentExcalidrawPath)
        }
        const nextFavoritePaths =
          kind === 'note'
            ? favoriteNotePaths.map((path) => (path === relPath ? nextRelPath : path))
            : favoriteNotePaths.map((path) => remapNestedPath(path, relPath, nextRelPath) ?? path)
        if (nextFavoritePaths.some((path, index) => path !== favoriteNotePaths[index])) {
          void persistFavoriteNotePaths(nextFavoritePaths, { history: false })
        }
        pushToast(
          'success',
          kind === 'folder'
            ? 'Folder renamed'
            : kind === 'excalidraw'
              ? 'Drawing renamed'
              : 'Note renamed'
        )
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [
      currentExcalidrawPath,
      currentNotePath,
      favoriteNotePaths,
      getWorkspaceTabSession,
      persistFavoriteNotePaths,
      persistLastOpenedNotePath,
      pushToast,
      refreshNotesAndTree,
      setCurrentExcalidrawPath,
      setCurrentNotePath,
      vaultApi
    ]
  )

  const deleteTreeEntries = useCallback(
    async (entries: NoteTreeSelection): Promise<void> => {
      if (!vaultApi) {
        return
      }

      const normalizedEntries = normalizeNoteTreeSelection(entries)
      if (normalizedEntries.length === 0) {
        return
      }

      const singleEntry = normalizedEntries[0]
      const confirmed = window.confirm(
        normalizedEntries.length === 1
          ? singleEntry?.kind === 'folder'
            ? `Delete folder "${singleEntry.relPath.split('/').pop() ?? singleEntry.relPath}" and all nested files? Moved to Trash. Use Undo to restore.`
            : `Delete ${singleEntry?.kind === 'excalidraw' ? 'drawing' : 'note'} "${singleEntry?.relPath.split('/').pop() ?? singleEntry?.relPath}"? Moved to Trash. Use Undo to restore.`
          : `Delete ${normalizedEntries.length} selected items? Nested files inside selected folders will also be moved to Trash. Use Undo to restore.`
      )
      if (!confirmed) {
        return
      }

      try {
        const isCurrentExcalidraw = normalizedEntries.some(
          (entry) =>
            entry.kind === 'excalidraw' &&
            entry.relPath === currentExcalidrawPathRef.current
        )
        if (isCurrentExcalidraw) {
          await currentExcalidrawEditorRef.current?.prepareForPathMutation()
        }

        await vaultApi.files.deletePaths(normalizedEntries.map((entry) => entry.relPath))

        await refreshNotesAndTree()
        setSelectedNoteTreeEntries([])

        const removedPaths = normalizedEntries
          .filter((entry) => entry.kind === 'folder')
          .map((entry) => entry.relPath)
        const removedFoldersSet = new Set(removedPaths)
        const removedNotes = normalizedEntries
          .filter((entry) => entry.kind === 'note')
          .map((entry) => entry.relPath)
        const removedNotesSet = new Set(removedNotes)

        const nextFavoritePaths = favoriteNotePaths.filter((path) => {
          if (removedNotesSet.has(path)) {
            return false
          }

          return !Array.from(removedFoldersSet).some((folderPath) => isNestedPath(path, folderPath))
        })

        if (nextFavoritePaths.length !== favoriteNotePaths.length) {
          void persistFavoriteNotePaths(nextFavoritePaths)
        }

        const activeSession = getWorkspaceTabSession()
        const previousActiveNotePath = activeSession.currentNotePath
        const previousActiveExcalidrawPath = activeSession.currentExcalidrawPath
        const removedSessionPaths = normalizedEntries.map((entry) => entry.relPath)
        Object.values(workspaceTabSessionsRef.current).forEach((session) => {
          removeNotebookWorkspaceSessionPaths(session, removedSessionPaths)
        })
        const shouldClearCurrent =
          previousActiveNotePath !== activeSession.currentNotePath ||
          previousActiveExcalidrawPath !== activeSession.currentExcalidrawPath

        Object.keys(persistedNoteFingerprintsRef.current).forEach((path) => {
          const shouldDeleteFingerprint = removedSessionPaths.some((removedPath) =>
            isNestedPath(path, removedPath)
          )
          if (shouldDeleteFingerprint) {
            delete persistedNoteFingerprintsRef.current[path]
          }
        })

        if (shouldClearCurrent) {
          currentNotePathRef.current = null
          currentExcalidrawPathRef.current = null
          currentNoteContentRef.current = ''
          currentNoteTagsRef.current = []
          setCurrentExcalidrawPath(null)
          setCurrentNotePath(null)
          resetCurrentNoteEditorSession()
          setCurrentNoteTagsState([])
          setCurrentNoteContent('')
          void persistLastOpenedNotePath(null, { history: false })
        }

        pushToast(
          'success',
          normalizedEntries.length === 1
            ? singleEntry?.kind === 'folder'
              ? 'Folder deleted'
              : singleEntry?.kind === 'excalidraw'
                ? 'Drawing deleted'
                : 'Note deleted'
            : `${normalizedEntries.length} items deleted`
        )
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [
      favoriteNotePaths,
      getWorkspaceTabSession,
      persistFavoriteNotePaths,
      persistLastOpenedNotePath,
      pushToast,
      refreshNotesAndTree,
      resetCurrentNoteEditorSession,
      setCurrentExcalidrawPath,
      setCurrentNoteContent,
      setCurrentNotePath,
      vaultApi
    ]
  )

  const moveTreeEntries = useCallback(
    async (entries: NoteTreeSelection, targetFolderPath: string): Promise<void> => {
      if (!vaultApi) {
        return
      }

      const normalizedEntries = normalizeNoteTreeSelection(entries)
      const moveOperations = normalizedEntries
        .map((entry) => ({
          ...entry,
          toRelPath: joinRelPath(targetFolderPath, entry.relPath.split('/').pop() ?? entry.relPath)
        }))
        .filter((entry) => entry.toRelPath !== entry.relPath)

      if (moveOperations.length === 0) {
        return
      }

      const currentExcalidrawMove = moveOperations.find(
        (operation) =>
          operation.kind === 'excalidraw' &&
          operation.relPath === currentExcalidrawPathRef.current
      )
      if (currentExcalidrawMove) {
        await currentExcalidrawEditorRef.current?.prepareForPathMutation()
      }

      for (const operation of moveOperations) {
        Object.values(workspaceTabSessionsRef.current).forEach((session) => {
          remapNotebookWorkspaceSessionPaths(session, operation.relPath, operation.toRelPath)
        })
        Object.entries(persistedNoteFingerprintsRef.current).forEach(([path, fingerprint]) => {
          const remappedPath = remapNestedPath(path, operation.relPath, operation.toRelPath)
          if (remappedPath && remappedPath !== path) {
            persistedNoteFingerprintsRef.current[remappedPath] = fingerprint
            delete persistedNoteFingerprintsRef.current[path]
          }
        })
      }

      const activeSession = getWorkspaceTabSession()
      const nextCurrentNotePath = activeSession.currentNotePath
      const nextCurrentExcalidrawPath = activeSession.currentExcalidrawPath

      if (nextCurrentNotePath !== currentNotePath) {
        currentNotePathRef.current = nextCurrentNotePath
      }
      if (nextCurrentExcalidrawPath !== currentExcalidrawPath) {
        currentExcalidrawPathRef.current = nextCurrentExcalidrawPath
      }

      for (const operation of moveOperations) {
        await vaultApi.files.renamePath(operation.relPath, operation.toRelPath)
      }

      if (currentExcalidrawMove) {
        currentExcalidrawPathRef.current = currentExcalidrawMove.toRelPath
        setCurrentExcalidrawPath(currentExcalidrawMove.toRelPath)
      }

      await refreshNotesAndTree()
      setSelectedNoteTreeEntries(
        moveOperations.map((operation) => ({
          kind: operation.kind,
          relPath: operation.toRelPath
        }))
      )

      if (nextCurrentNotePath !== currentNotePath) {
        currentNotePathRef.current = nextCurrentNotePath
        setCurrentNotePath(nextCurrentNotePath)
        void persistLastOpenedNotePath(nextCurrentNotePath)
      }
      if (nextCurrentExcalidrawPath !== currentExcalidrawPath) {
        currentExcalidrawPathRef.current = nextCurrentExcalidrawPath
        setCurrentExcalidrawPath(nextCurrentExcalidrawPath)
      }

      const nextFavoritePaths = favoriteNotePaths.map((path) => {
        return moveOperations.reduce((nextPath, operation) => {
          if (operation.kind === 'note') {
            return nextPath === operation.relPath ? operation.toRelPath : nextPath
          }

          return remapNestedPath(nextPath, operation.relPath, operation.toRelPath) ?? nextPath
        }, path)
      })

      if (nextFavoritePaths.some((path, index) => path !== favoriteNotePaths[index])) {
        void persistFavoriteNotePaths(nextFavoritePaths)
      }
    },
    [
      currentExcalidrawPath,
      currentNotePath,
      favoriteNotePaths,
      getWorkspaceTabSession,
      persistFavoriteNotePaths,
      persistLastOpenedNotePath,
      refreshNotesAndTree,
      setCurrentExcalidrawPath,
      setCurrentNotePath,
      vaultApi
    ]
  )

  const pushNoteImportToast = (result: NoteImportResult): void => {
    const renamedCount = result.imported.filter((item) => item.renamed).length

    if (result.imported.length > 0 && result.failed.length === 0) {
      const message =
        result.imported.length === 1
          ? renamedCount > 0
            ? `Imported 1 note with a renamed file name`
            : 'Imported 1 note'
          : renamedCount > 0
            ? `Imported ${result.imported.length} notes (${renamedCount} renamed)`
            : `Imported ${result.imported.length} notes`
      pushToast('success', message)
      return
    }

    if (result.imported.length > 0) {
      pushToast('info', `Imported ${result.imported.length} notes, ${result.failed.length} failed`)
      return
    }

    pushToast(
      'error',
      `Import failed for ${result.failed.length} note${result.failed.length === 1 ? '' : 's'}`
    )
  }

  const paletteSurfaceClass = ''
  const headerPageLabel =
    hasVault && activePage === 'subscriptions'
      ? 'Finance'
      : hasVault
        ? PAGE_LABELS[activePage]
        : 'Vault'
  const getWorkspaceTabLabel = (tab: WorkspacePageTab): string => {
    if (!hasVault) {
      return 'Vault'
    }

    if (tab.page !== 'notes') {
      return PAGE_LABELS[tab.page]
    }

    const session = getWorkspaceTabSession(tab.id)
    const notePath =
      tab.id === activeWorkspaceTabId
        ? (currentNotePath ?? currentExcalidrawPath)
        : (session.currentNotePath ?? session.currentExcalidrawPath)

    return notePath ? `${PAGE_LABELS.notes} · ${getNoteDisplayName(notePath)}` : PAGE_LABELS.notes
  }
  const handleSidebarPageChange = useCallback(
    (page: AppPage): void => {
      void navigateToPage(page)
    },
    [navigateToPage]
  )
  const handleOpenSearchPalette = useCallback((): void => {
    if (!hasVault) {
      return
    }

    setCommandPaletteInitialQuery('')
    setCommandPaletteOpen(true)
  }, [hasVault, setCommandPaletteOpen])

  const handleSidebarInteract = useCallback((): void => {
    if (commandPaletteOpen) {
      setCommandPaletteOpen(false)
    }
  }, [commandPaletteOpen, setCommandPaletteOpen])

  const openNativeNoteActionsMenu = async (): Promise<void> => {
    if (!useNativeMenus || !noteActionsButtonRef.current) {
      return
    }

    const items: NativeMenuItemDescriptor[] = [
      { id: 'new-note', label: 'New note' },
      { id: 'new-drawing', label: 'New drawing' },
      { id: 'new-folder', label: 'New folder' },
      { type: 'separator' },
      { id: 'import-markdown', label: 'Import markdown' }
    ]
    const actionId = await showNativeMenu(
      items,
      getElementMenuPosition(noteActionsButtonRef.current, 'start')
    )

    if (actionId === 'new-note') {
      void createNoteFromTree()
      return
    }
    if (actionId === 'new-drawing') {
      void createExcalidrawFromTree()
      return
    }
    if (actionId === 'new-folder') {
      void createFolderFromTree()
      return
    }
    if (actionId === 'import-markdown') {
      void importNotes()
    }
  }

  return (
    <div className="flex h-screen">
      {hasVault ? (
        <SidebarProvider
          className="h-full"
          data-focus-mode={isFocusMode ? 'true' : 'false'}
          open={isFocusMode ? false : isSidebarOpen}
          onOpenChange={setIsSidebarOpen}
        >
          <AppSidebar
            activePage={activePage}
            onChange={handleSidebarPageChange}
            onOpenSearchPalette={handleOpenSearchPalette}
            onOpenVaultManager={openVaultSwapper}
            onSidebarInteract={handleSidebarInteract}
            vaultName={vault?.rootPath ? getVaultDisplayName(vault.rootPath) : null}
            notesCount={notes.length}
            projectsCount={projects.length}
            calendarUndoneCount={calendarUndoneCount}
            isLocked={!hasVault}
            availablePages={availablePages}
            className={paletteSurfaceClass}
            collapsible={isFocusMode ? 'offcanvas' : 'min'}
            macosTrafficLightInset={platform.api?.ui.platform === 'darwin'}
          />

          <SidebarInset className="!min-h-0 overflow-hidden p-2 text-foreground antialiased">
            <div className="flex h-full min-w-0 flex-col gap-2">
              <WorkspaceContextProvider
                hasPanel={hasRightPanel}
                panelCollapsed={isRightPanelCollapsed}
                onTogglePanel={() => setIsRightPanelCollapsed((current) => !current)}
              >
                <WorkspaceTabManager
                  tabs={workspaceTabs.map((tab, index) => ({
                    id: tab.id,
                    label: getWorkspaceTabLabel(tab),
                    icon: hasVault ? PAGE_TAB_ICONS[tab.page] : FolderOpen,
                    shortcut: index < 9 ? ['cmd', String(index + 1)] : undefined
                  }))}
                  activeTabId={activeWorkspaceTabId}
                  onSelectTab={handleSelectWorkspaceTab}
                  onCloseTab={handleCloseWorkspaceTab}
                  onAddTab={handleCreateWorkspaceTab}
                  addDisabled={!hasVault}
                />
                <DocumentWorkspace hasPanel={hasRightPanel}>
                  <DocumentWorkspaceMainHeader
                    breadcrumb={
                      <div className="flex min-w-0 items-center gap-2">
                        {activePage === 'projects' || activePage === 'calendar' ? null : (
                          <Breadcrumb>
                            <BreadcrumbList className="text-muted-foreground">
                              <BreadcrumbItem>
                                <BreadcrumbPage className="text-sm text-muted-foreground">
                                  {headerPageLabel}
                                </BreadcrumbPage>
                              </BreadcrumbItem>
                              {noteHeaderBreadcrumbSegments ? (
                                noteHeaderBreadcrumbSegments.map((segment, index) => {
                                  const isLast = index === noteHeaderBreadcrumbSegments.length - 1

                                  return (
                                    <Fragment key={`${segment}:${index}`}>
                                      <BreadcrumbSeparator className="text-muted-foreground" />
                                      <BreadcrumbItem>
                                        <BreadcrumbPage
                                          className={
                                            isLast
                                              ? 'max-w-[220px] truncate text-sm font-semibold text-foreground'
                                              : 'max-w-[140px] truncate text-sm text-muted-foreground'
                                          }
                                        >
                                          {segment}
                                        </BreadcrumbPage>
                                      </BreadcrumbItem>
                                    </Fragment>
                                  )
                                })
                              ) : middleHeaderBreadcrumbItem ? (
                                <>
                                  <BreadcrumbSeparator className="text-muted-foreground" />
                                  <BreadcrumbItem>
                                    <BreadcrumbPage className="max-w-[320px] truncate text-sm font-semibold text-foreground">
                                      {middleHeaderBreadcrumbItem}
                                    </BreadcrumbPage>
                                  </BreadcrumbItem>
                                </>
                              ) : null}
                            </BreadcrumbList>
                          </Breadcrumb>
                        )}
                      </div>
                    }
                    secondaryActions={
                      activePage === 'calendar' ? (
                        <div
                          data-testid="calendar-workspace-toolbar"
                          className="flex min-w-max items-center gap-3"
                        >
                          <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
                            <div className="flex h-3.5 items-center justify-center bg-primary px-2 text-center text-xs font-extrabold leading-none text-primary-foreground">
                              {calendarTodayHeader.monthShort}
                            </div>
                            <div className="flex h-4 items-center justify-center border-t border-border px-2 text-center">
                              <span className="block text-sm font-medium leading-none text-foreground">
                                {calendarTodayHeader.dayNumber}
                              </span>
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold leading-4 text-foreground">
                              {calendarCurrentPeriodTitle}
                            </p>
                          </div>
                          <ToggleGroup
                            type="single"
                            value={calendarContentFilter}
                            onValueChange={(value) =>
                              value && setCalendarContentFilter(value as CalendarContentFilter)
                            }
                            variant="outline"
                            size="sm"
                            aria-label="Calendar content filter"
                          >
                            {calendarContentFilterOptions.map((option) => (
                              <ToggleGroupItem key={option.value} value={option.value}>
                                <span className="inline-flex items-center gap-2">
                                  <span>{option.label}</span>
                                  <Badge
                                    variant="secondary"
                                    className="h-5 min-w-5 justify-center px-1 text-xs"
                                  >
                                    {option.count}
                                  </Badge>
                                </span>
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                          <ButtonGroup
                            variant="outline"
                            size="sm"
                            className="[&>button]:border-0"
                            aria-label="Calendar period navigation"
                          >
                            <WorkspaceIconButton
                              onClick={goToPrevCalendarPeriod}
                              title={
                                calendarViewMode === 'week' ? 'Previous week' : 'Previous month'
                              }
                              icon={<ChevronLeft size={18} />}
                            />
                            <WorkspaceIconButton
                              onClick={goToToday}
                              title={
                                calendarViewMode === 'week'
                                  ? 'Go to current week'
                                  : 'Go to current month'
                              }
                              aria-label={
                                calendarViewMode === 'week'
                                  ? 'Go to current week'
                                  : 'Go to current month'
                              }
                              icon={<CalendarDays size={18} />}
                              label={calendarViewMode === 'week' ? 'Current week' : 'Current month'}
                            />
                            <WorkspaceIconButton
                              onClick={goToNextCalendarPeriod}
                              title={calendarViewMode === 'week' ? 'Next week' : 'Next month'}
                              icon={<ChevronRight size={18} />}
                            />
                          </ButtonGroup>
                        </div>
                      ) : null
                    }
                    actions={
                      noteIsOpen && activePage === 'notes' && !searchQuery.trim() ? (
                        <WorkspaceHeaderActions>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <WorkspaceIconButton
                                title="Show backlinks"
                                aria-label="Show backlinks"
                                icon={<Link2 size={18} />}
                              />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-72">
                              {currentNoteBacklinks.length > 0 ? (
                                currentNoteBacklinks.map((note) => (
                                  <DropdownMenuItem
                                    key={note.relPath}
                                    onSelect={() => {
                                      void openNote(note.relPath)
                                    }}
                                    className="flex flex-col items-start gap-0.5"
                                  >
                                    <span className="max-w-full truncate font-medium">
                                      {getNoteDisplayName(note.relPath)}
                                    </span>
                                    <span className="max-w-full truncate text-xs text-muted-foreground">
                                      {stripNoteExtension(note.relPath)}
                                    </span>
                                  </DropdownMenuItem>
                                ))
                              ) : (
                                <DropdownMenuItem disabled>No backlinks yet</DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <WorkspaceIconButton
                            onClick={() => {
                              void copyCurrentNoteMarkdown()
                            }}
                            title="Copy Raw Markdown"
                            aria-label="Copy Raw Markdown"
                            icon={<Copy size={18} />}
                          />
                          <WorkspaceIconButton
                            onClick={() => {
                              setIsNoteExportDialogOpen(true)
                            }}
                            title="Export Note"
                            aria-label="Export Note"
                            icon={<Download size={18} />}
                          />
                          <WorkspaceHeaderActionDivider />
                          <WorkspaceHeaderActionGroup>
                            <WorkspaceIconButton
                              onClick={toggleCurrentNoteFavorite}
                              title={
                                currentNoteIsFavorite ? 'Remove from Favorites' : 'Add to Favorites'
                              }
                              className={
                                currentNoteIsFavorite
                                  ? 'border-border bg-accent text-muted-foreground hover:text-muted-foreground'
                                  : 'hover:border-border hover:bg-accent hover:text-muted-foreground'
                              }
                              icon={
                                <Star
                                  size={18}
                                  className={currentNoteIsFavorite ? 'fill-current' : ''}
                                />
                              }
                            />
                          </WorkspaceHeaderActionGroup>
                          <WorkspaceHeaderActionDivider />
                          <WorkspaceHeaderActionGroup>
                            <WorkspaceIconButton
                              onClick={() => {
                                void deleteCurrentNote()
                              }}
                              title="Delete Note"
                              icon={<Trash2 size={18} />}
                            />
                          </WorkspaceHeaderActionGroup>
                        </WorkspaceHeaderActions>
                      ) : activePage === 'projects' ? (
                        <WorkspaceHeaderActions>
                          <WorkspaceHeaderActionGroup>
                            <WorkspaceIconButton
                              onClick={() => void createProjectFromToolbar()}
                              disabled={isCreatingProject}
                              data-testid="new-project-button"
                              icon={<Plus size={16} />}
                              label="New Project"
                              aria-label="New Project"
                              title="New Project"
                            />
                          </WorkspaceHeaderActionGroup>
                          <ProjectsWorkspaceHeaderActions
                            project={selectedProjectForHeader}
                            onDelete={() => {
                              if (selectedProjectForHeader) {
                                void removeProjectById(selectedProjectForHeader.id)
                              }
                            }}
                          />
                        </WorkspaceHeaderActions>
                      ) : activePage === 'calendar' ? (
                        <WorkspaceHeaderActions>
                          <WorkspaceHeaderActionGroup>
                            <ToggleGroup
                              type="single"
                              value={calendarViewMode}
                              onValueChange={(value) =>
                                value && setCalendarViewMode(value as CalendarViewMode)
                              }
                              variant="outline"
                              size="sm"
                              aria-label="Calendar view"
                            >
                              {CALENDAR_VIEW_MODE_OPTIONS.map((option) => (
                                <ToggleGroupItem key={option.value} value={option.value}>
                                  <span className="inline-flex items-center gap-2">
                                    {option.value === 'month' ? (
                                      <LayoutGrid
                                        size={15}
                                        className="shrink-0"
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <CalendarDays
                                        size={15}
                                        className="shrink-0"
                                        aria-hidden="true"
                                      />
                                    )}
                                    {option.label}
                                  </span>
                                </ToggleGroupItem>
                              ))}
                              <Shortcut
                                keys={['option', 'tab']}
                                data-testid="workspace-shortcut:calendar-view-toggle"
                                className="shrink-0"
                              />
                            </ToggleGroup>
                          </WorkspaceHeaderActionGroup>
                        </WorkspaceHeaderActions>
                      ) : null
                    }
                  />

                  <DocumentWorkspaceMain className={paletteSurfaceClass}>
                    <WorkspaceResizableLayout
                      hasPanel={hasRightPanel}
                      panelWidth={rightPanelWidth}
                      panelCollapsed={isRightPanelCollapsed}
                      panelHidden={isFocusMode}
                      onPanelWidthChange={(width) => {
                        setRightPanelWidth(clampWorkspaceRightPanelWidth(width))
                      }}
                      onPanelCollapsedChange={setIsRightPanelCollapsed}
                    >
                      <DocumentWorkspaceMainContent
                        className={
                          activePage === 'calendar'
                            ? 'overflow-y-auto overflow-x-hidden'
                            : activePage === 'notes' &&
                                !searchQuery.trim() &&
                                noteIsOpen &&
                                !currentExcalidrawPath
                              ? '!overflow-hidden'
                              : undefined
                        }
                      >
                        <div
                          key={`${activeWorkspaceTabId}:${activePage}`}
                          className={`motion-workspace-content w-full ${activePage === 'calendar' ? '' : 'h-full'}`.trim()}
                        >
                          {activePage === 'capture' ? (
                            <CapturePage
                              notes={fleetingNotes}
                              isLoading={fleetingNotesLoading}
                              onCapture={createFleetingNote}
                              onConvert={convertFleetingNote}
                            />
                          ) : activePage === 'notes' ? (
                            searchQuery.trim() ? (
                              <SearchPage
                                results={searchResults}
                                onOpen={(relPath) => {
                                  void openNotebookPath(relPath)
                                  setSearchQuery('')
                                  setSearchResults([])
                                }}
                              />
                            ) : currentExcalidrawPath ? (
                              <ExcalidrawFileEditor
                                ref={currentExcalidrawEditorRef}
                                notePath={currentExcalidrawPath}
                                vaultApi={vaultApi}
                                pushToast={pushToast}
                              />
                            ) : noteIsOpen && currentNotePath ? (
                              <EditorPage
                                editorRef={currentNoteEditorRef}
                                initialContent={currentNoteEditorDraft}
                                notePath={currentNotePath}
                                tags={currentNoteTags}
                                notes={notes}
                                onDirty={handleCurrentNoteEditorDirty}
                                onSnapshotChange={handleCurrentNoteSnapshotChange}
                                onDropFile={(sourcePath) => importAttachment(sourcePath)}
                                onPasteImage={importImageFromBlob}
                                onAddTag={addTagToCurrentNote}
                                onRemoveTag={removeTagFromCurrentNote}
                                onFindByTag={findByTag}
                                onOpenNoteLink={(target) => {
                                  void openOrCreateNoteMention(target)
                                }}
                                onRename={renameCurrentNote}
                                titleEditToken={
                                  noteTitleEditTarget?.relPath === currentNotePath
                                    ? noteTitleEditTarget.token
                                    : 0
                                }
                                vimModeEnabled={editorVimModeEnabled}
                                vimKeyMappings={editorVimKeyMappings}
                              />
                            ) : (
                              <div className="p-5 text-sm text-muted-foreground">
                                Pick a note or drawing from the right panel to open it
                              </div>
                            )
                          ) : activePage === 'knowledge' ? (
                            <KnowledgePage
                              notes={notes}
                              orphanRingRadiusPx={knowledgeOrphanRingRadiusPx}
                              onOpenNote={(relPath) => {
                                void navigateToPage('notes')
                                setSearchQuery('')
                                setSearchResults([])
                                void openNote(relPath)
                              }}
                            />
                          ) : activePage === 'projects' ? (
                            <ProjectsWorkspacePage
                              projects={projects}
                              tasks={calendarTasks}
                              favoriteProjectIds={favoriteProjectIds}
                              selectedProjectId={selectedProjectId}
                              filterMode={projectFilterMode}
                              onFilterModeChange={setProjectFilterMode}
                              onCreateTask={createProjectTask}
                              onUpdateProject={(projectId, draft) =>
                                saveProject(projectId, {
                                  name: draft.name,
                                  description: draft.description,
                                  icon: draft.icon
                                })
                              }
                              onUpdateProjectProperties={saveProjectProperties}
                              onUpdateTask={updateProjectTask}
                              onDeleteTask={(taskId) => void removeCalendarTask(taskId)}
                            />
                          ) : activePage === 'subscriptions' ? (
                            <SubscriptionsPage vaultApi={vaultApi} pushToast={pushToast} />
                          ) : activePage === 'calendar' ? (
                            <div className="min-h-full">
                              <section
                                data-testid={
                                  calendarViewMode === 'week'
                                    ? 'calendar-week-shell'
                                    : 'calendar-month-shell'
                                }
                                className="min-h-full rounded-lg"
                              >
                                <div>
                                  {calendarViewMode === 'week' ? (
                                    <CalendarWeekView
                                      selectedDate={selectedCalendarDate}
                                      tasks={visibleCalendarTasks}
                                      projects={projects}
                                      onSelectDate={setSelectedCalendarDate}
                                      onCreateTask={createTaskForWeeklyTime}
                                      onRescheduleTask={(taskId, newDate) => {
                                        void rescheduleCalendarTask(taskId, newDate)
                                      }}
                                      onDeleteTask={(taskId) => {
                                        void removeCalendarTask(taskId)
                                      }}
                                      onUpdateTask={updateProjectTask}
                                      onRenameTask={(taskId, newTitle) => {
                                        void renameCalendarTask(taskId, newTitle)
                                      }}
                                      onUpdateTaskPriority={(taskId, priority) => {
                                        void updateCalendarTaskPriority(taskId, priority)
                                      }}
                                      onUpdateTaskType={(taskId, taskType) => {
                                        void updateCalendarTaskType(taskId, taskType)
                                      }}
                                      onUpdateTaskProject={(taskId, projectId) => {
                                        void updateProjectTask(taskId, { projectId })
                                      }}
                                      onUpdateTaskSchedule={(taskId, schedule) => {
                                        void updateCalendarTaskSchedule(taskId, schedule)
                                      }}
                                    />
                                  ) : (
                                    <CalendarMonthView
                                      selectedDate={selectedCalendarDate}
                                      tasks={visibleScheduledCalendarTasks}
                                      projects={projects}
                                      onSelectDate={setSelectedCalendarDate}
                                      onCreateTask={createTaskForDate}
                                      onRescheduleTask={(taskId, newDate) => {
                                        void rescheduleCalendarTask(taskId, newDate)
                                      }}
                                      onResizeTaskStart={(taskId, newStartDate) => {
                                        void resizeCalendarTaskStart(taskId, newStartDate)
                                      }}
                                      onResizeTaskEnd={(taskId, newEndDate) => {
                                        void resizeCalendarTaskEnd(taskId, newEndDate)
                                      }}
                                      onToggleTask={(taskId) => {
                                        void toggleCalendarTask(taskId)
                                      }}
                                      onDeleteTask={(taskId) => {
                                        void removeCalendarTask(taskId)
                                      }}
                                      onUpdateTask={updateProjectTask}
                                      onRenameTask={(taskId, newTitle) => {
                                        void renameCalendarTask(taskId, newTitle)
                                      }}
                                      onUpdateTaskPriority={(taskId, priority) => {
                                        void updateCalendarTaskPriority(taskId, priority)
                                      }}
                                      onUpdateTaskType={(taskId, taskType) => {
                                        void updateCalendarTaskType(taskId, taskType)
                                      }}
                                      onUpdateTaskProject={(taskId, projectId) => {
                                        void updateProjectTask(taskId, { projectId })
                                      }}
                                      onUpdateTaskTime={(taskId, time) => {
                                        void updateCalendarTaskTime(taskId, time)
                                      }}
                                      onUpdateTaskSchedule={(taskId, schedule) => {
                                        void updateCalendarTaskSchedule(taskId, schedule)
                                      }}
                                      onUpdateTaskReminders={(taskId, reminders) => {
                                        void updateCalendarTaskReminders(taskId, reminders)
                                      }}
                                    />
                                  )}
                                </div>
                              </section>
                            </div>
                          ) : activePage === 'designAudit' ? (
                            <DesignAuditPage themeVersion={`${isDarkMode}:${fontFamily}`} />
                          ) : activePage === 'settings' ? (
                            <SettingsPage
                              profileName={profileName}
                              mistralApiKey={mistralApiKey}
                              editorVimModeEnabled={editorVimModeEnabled}
                              editorVimKeyMappings={editorVimKeyMappings}
                              vaultLocation={vault?.rootPath ?? lastVaultPath}
                              savedVaultCount={savedVaultCount}
                              onSaveProfile={(name) => {
                                void updateProfileName(name)
                              }}
                              onSaveMistralApiKey={(apiKey) => {
                                void updateMistralApiKey(apiKey)
                              }}
                              onToggleEditorVimMode={(enabled) => {
                                void updateEditorVimMode(enabled)
                              }}
                              onUpdateEditorVimKeyMappings={(mappings) => {
                                void updateEditorVimKeyMappings(mappings)
                              }}
                              onManageVaults={openVaultSwapper}
                              onMigrateBlockNoteNotes={() => {
                                void migrateBlockNoteNotes()
                              }}
                              onMigrateTaggedNoteBodyFrontmatter={() => {
                                void migrateTaggedNoteBodyFrontmatter()
                              }}
                              onImportLegacyExcalidrawSessions={() => {
                                void importLegacyExcalidrawSessions()
                              }}
                              onOpenDesignAudit={() => {
                                void navigateToPage('designAudit')
                              }}
                            />
                          ) : (
                            <div className="p-5 text-sm text-muted-foreground">
                              {activePage} workspace ready. Notes remain fully functional.
                            </div>
                          )}
                        </div>
                      </DocumentWorkspaceMainContent>
                      <DocumentWorkspacePanel
                        data-panel-state={shouldSlideWorkspacePanelOut ? 'collapsed' : 'open'}
                        className={`h-full w-full basis-auto ${hasRightPanel ? 'flex' : 'hidden'} overflow-hidden ${
                          shouldSlideWorkspacePanelOut
                            ? 'pointer-events-none translate-x-full opacity-0'
                            : 'translate-x-0 opacity-100'
                        } ${paletteSurfaceClass}`}
                        data-panel-resizable={hasRightPanel ? 'true' : undefined}
                        style={
                          shouldSlideWorkspacePanelOut
                            ? { width: '0px', flexBasis: '0px', borderWidth: '0px' }
                            : undefined
                        }
                      >
                        <div
                          key={`${activeWorkspaceTabId}:${activePage}`}
                          className="flex h-full flex-col"
                        >
                          <DocumentWorkspacePanelHeader
                            actions={
                              hasVault && activePage === 'notes' ? (
                                <WorkspaceHeaderActions>
                                  <WorkspaceIconButton
                                    aria-label={
                                      areAllNoteFoldersCollapsed
                                        ? 'Expand all folders'
                                        : 'Collapse all folders'
                                    }
                                    title={
                                      areAllNoteFoldersCollapsed
                                        ? 'Expand all folders'
                                        : 'Collapse all folders'
                                    }
                                    icon={
                                      areAllNoteFoldersCollapsed ? (
                                        <ChevronDown size={18} aria-hidden="true" />
                                      ) : (
                                        <ChevronUp size={18} aria-hidden="true" />
                                      )
                                    }
                                    onClick={() => {
                                      setAreAllNoteFoldersCollapsed((current) => !current)
                                      setCollapseAllNotesTreeToken((current) => current + 1)
                                    }}
                                  />
                                  {useNativeMenus ? (
                                    <WorkspaceIconButton
                                      ref={noteActionsButtonRef}
                                      onClick={() => {
                                        void openNativeNoteActionsMenu()
                                      }}
                                      aria-label="Notebook actions"
                                      title="Notebook actions"
                                      icon={<Plus size={18} aria-hidden="true" />}
                                    />
                                  ) : (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <WorkspaceIconButton
                                          aria-label="Notebook actions"
                                          title="Notebook actions"
                                          icon={<Plus size={18} aria-hidden="true" />}
                                        />
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="start">
                                        <DropdownMenuItem
                                          onClick={() => {
                                            void createNoteFromTree()
                                          }}
                                        >
                                          New note
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => {
                                            void createExcalidrawFromTree()
                                          }}
                                        >
                                          New drawing
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => {
                                            void createFolderFromTree()
                                          }}
                                        >
                                          New folder
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => {
                                            void importNotes()
                                          }}
                                        >
                                          Import markdown
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </WorkspaceHeaderActions>
                              ) : null
                            }
                          />

                          <DocumentWorkspacePanelContent>
                            {!hasVault ? (
                              <WorkspacePanelStack className="h-full">
                                <WorkspacePanelSection>
                                  <WorkspaceContextEmptyState
                                    className="m-0 border-0 bg-transparent p-0"
                                    description="Select a vault to see workspace properties and secondary tools."
                                  />
                                </WorkspacePanelSection>
                              </WorkspacePanelStack>
                            ) : activePage === 'notes' ? (
                              <WorkspacePanelStack className="h-full">
                                <WorkspacePanelSection className="min-h-0 flex-1 overflow-hidden p-0">
                                  <NotesTreeView
                                    tree={visibleNoteTree}
                                    searchTerm={searchQuery}
                                    activeNotePath={currentNotePath ?? currentExcalidrawPath}
                                    selectedEntries={selectedNoteTreeEntries}
                                    collapseAllToken={collapseAllNotesTreeToken}
                                    shouldCollapseAllFolders={areAllNoteFoldersCollapsed}
                                    pendingEditId={pendingNoteTreeEditId}
                                    onPendingEditHandled={handlePendingNoteTreeEditHandled}
                                    onSelectionChange={setSelectedNoteTreeEntries}
                                    onOpenNote={(relPath) => {
                                      setSearchQuery('')
                                      setSearchResults([])
                                      void openNotebookPath(relPath)
                                    }}
                                    onCreateNote={(parentDir) => {
                                      setSelectedNoteTreeEntries(
                                        parentDir ? [{ kind: 'folder', relPath: parentDir }] : []
                                      )
                                      void createNoteFromTree(parentDir)
                                    }}
                                    onCreateExcalidraw={(parentDir) => {
                                      setSelectedNoteTreeEntries(
                                        parentDir ? [{ kind: 'folder', relPath: parentDir }] : []
                                      )
                                      void createExcalidrawFromTree(parentDir)
                                    }}
                                    onCreateFolder={(parentDir) => {
                                      setSelectedNoteTreeEntries(
                                        parentDir ? [{ kind: 'folder', relPath: parentDir }] : []
                                      )
                                      void createFolderFromTree(parentDir)
                                    }}
                                    onExportFolderPdf={(folderPath) => {
                                      void exportFolderPdf(folderPath)
                                    }}
                                    onRenamePath={(relPath, nextName, kind) => {
                                      void renameTreePath(relPath, nextName, kind)
                                    }}
                                    onDeleteEntries={(entries) => {
                                      void deleteTreeEntries(entries)
                                    }}
                                    onMoveEntries={moveTreeEntries}
                                  />
                                </WorkspacePanelSection>
                              </WorkspacePanelStack>
                            ) : activePage === 'knowledge' ? (
                              <WorkspacePanelStack>
                                <WorkspacePanelSection data-testid="knowledge-graph-editor">
                                  <WorkspacePanelSectionHeader
                                    heading="Graph view"
                                    description="Configure how disconnected notes are arranged."
                                  />
                                  <div className="space-y-2">
                                    <label
                                      htmlFor="knowledge-orphan-radius-input"
                                      className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                                    >
                                      Orphan ring radius
                                    </label>
                                    <div className="flex items-center gap-2">
                                      <Input
                                        id="knowledge-orphan-radius-input"
                                        data-testid="knowledge-orphan-radius-input"
                                        type="number"
                                        min={72}
                                        step={1}
                                        value={knowledgeOrphanRingRadiusInput}
                                        onChange={(event) => {
                                          setKnowledgeOrphanRingRadiusInput(event.target.value)
                                        }}
                                        placeholder="Auto"
                                        className="min-w-0 flex-1"
                                        aria-label="Orphan ring radius in pixels"
                                      />
                                      <span className="text-xs text-muted-foreground">px</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                                    <p className="text-xs text-muted-foreground">
                                      Applied radius:{' '}
                                      {knowledgeOrphanRingRadiusPx == null
                                        ? 'Auto'
                                        : `${knowledgeOrphanRingRadiusPx}px`}
                                    </p>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setKnowledgeOrphanRingRadiusInput('')
                                      }}
                                    >
                                      Reset
                                    </Button>
                                  </div>
                                </WorkspacePanelSection>
                              </WorkspacePanelStack>
                            ) : activePage === 'projects' ? (
                              <ProjectsWorkspaceRightPanel
                                projects={projects}
                                favoriteProjectIds={favoriteProjectIds}
                                selectedProjectId={selectedProjectId}
                                filterMode={projectFilterMode}
                                onSelectProject={selectProject}
                                onToggleProjectFavorite={toggleProjectFavoriteById}
                                onToggleProjectArchive={toggleProjectArchiveById}
                                onUpdateProjectProperties={saveProjectProperties}
                              />
                            ) : activePage === 'calendar' ? (
                              <WorkspacePanelStack className="h-full">
                                <WorkspacePanelSection className="min-h-0 flex-1 overflow-hidden p-0">
                                  <UnscheduledTaskList
                                    tasks={unscheduledTasks}
                                    projects={projects}
                                    selectedDate={selectedCalendarDate}
                                    newTaskValue={calendarHeaderNewTask}
                                    onNewTaskValueChange={setCalendarHeaderNewTask}
                                    onToggle={(taskId) => {
                                      void toggleCalendarTask(taskId)
                                    }}
                                    onDelete={(taskId) => {
                                      void removeCalendarTask(taskId)
                                    }}
                                    onRename={(taskId, newTitle) => {
                                      void renameCalendarTask(taskId, newTitle)
                                    }}
                                    onUpdatePriority={(taskId, priority) => {
                                      void updateCalendarTaskPriority(taskId, priority)
                                    }}
                                    onUpdateTaskType={(taskId, taskType) => {
                                      void updateCalendarTaskType(taskId, taskType)
                                    }}
                                    onUpdateStatus={(taskId, status) => {
                                      void updateProjectTask(taskId, {
                                        status,
                                        completed: status === 'completed'
                                      })
                                    }}
                                    onUpdateTaskProject={(taskId, projectId) => {
                                      void updateProjectTask(taskId, { projectId })
                                    }}
                                    onUpdateTime={(taskId, time) => {
                                      void updateCalendarTaskTime(taskId, time)
                                    }}
                                    onUpdateReminders={(taskId, reminders) => {
                                      void updateCalendarTaskReminders(taskId, reminders)
                                    }}
                                    onScheduleTask={(taskId, date) => {
                                      void rescheduleCalendarTask(taskId, date)
                                    }}
                                    onUnscheduleTask={(taskId) => {
                                      void rescheduleCalendarTask(taskId, undefined)
                                    }}
                                    onInsertTask={() => {
                                      void addUnscheduledFromHeader()
                                    }}
                                  />
                                </WorkspacePanelSection>
                              </WorkspacePanelStack>
                            ) : activePage === 'settings' ? (
                              <SettingsRightPanelSections />
                            ) : (
                              <WorkspacePanelStack className="h-full">
                                <WorkspacePanelSection>
                                  <WorkspaceContextEmptyState
                                    className="m-0 border-0 bg-transparent p-0"
                                    description="Properties, activity, and secondary tools for this workspace will appear here."
                                  />
                                </WorkspacePanelSection>
                              </WorkspacePanelStack>
                            )}
                          </DocumentWorkspacePanelContent>
                        </div>
                      </DocumentWorkspacePanel>
                    </WorkspaceResizableLayout>
                  </DocumentWorkspaceMain>
                </DocumentWorkspace>
                <WorkspaceFooter />
              </WorkspaceContextProvider>
            </div>
          </SidebarInset>
        </SidebarProvider>
      ) : (
        <NoVaultPage
          lastVaultPath={lastVaultPath}
          platformKind={platform.kind}
          supportsVaultPicker={platform.capabilities.supportsVaultPicker}
          onOpenExistingVault={() => activateVaultFromNoVaultPage('open')}
          onCreateNewVault={() => activateVaultFromNoVaultPage('create')}
          onManageSavedVaults={openVaultSwapper}
        />
      )}
      <SonnerBridge />
      <NoteExportDialog
        open={isNoteExportDialogOpen}
        format={noteExportFormat}
        isExporting={isNoteExporting}
        onOpenChange={setIsNoteExportDialogOpen}
        onFormatChange={setNoteExportFormat}
        onExport={() => {
          void exportCurrentNote(noteExportFormat)
        }}
      />
      <CommandPalette
        open={hasVault && commandPaletteOpen}
        initialQuery={commandPaletteInitialQuery}
        notes={notes}
        searchResults={commandPaletteResults}
        searchLoading={commandPaletteLoading}
        aiLoading={commandPaletteAiLoading}
        activeNotePath={currentNotePath}
        onClose={() => setCommandPaletteOpen(false)}
        onCreate={() => {
          void createNote()
        }}
        onQueryChange={runCommandPaletteSearch}
        onRunAiPrompt={runCommandPaletteAi}
        onOpenNote={(relPath) => {
          setSearchQuery('')
          setSearchResults([])
          void navigateToPage('notes')
          void openNote(relPath)
        }}
        onOpenProject={(projectId) => {
          selectProject(projectId)
          void navigateToPage('projects')
        }}
        onOpenPage={(page) => {
          void navigateToPage(page)
        }}
        onOpenWarpAtNoteFolder={openCurrentNoteFolderInWarp}
        onManageVaults={() => {
          setCommandPaletteOpen(false)
          openVaultSwapper()
        }}
      />
      <VaultSwapperDialog
        open={isVaultSwapperOpen}
        vaultApi={vaultApi}
        activeVaultPath={vault?.rootPath ?? null}
        onOpenChange={setIsVaultSwapperOpen}
        onVaultActivated={async (result, successMessage) => {
          await applyVaultActivationResult(result, successMessage)
        }}
        onVaultClosed={() => {
          void clearActiveVaultState()
        }}
        pushToast={pushToast}
      />
    </div>
  )
}

export default App

function getVaultDisplayName(rootPath: string): string {
  const normalizedPath = rootPath.replace(/[\\/]+$/, '')
  return normalizedPath.split(/[\\/]/).filter(Boolean).pop() ?? 'Vault'
}

function startOfWeekIso(date: Date): string {
  const copy = new Date(date)
  const day = copy.getDay()
  const offset = day
  copy.setDate(copy.getDate() - offset)
  return toIsoDate(copy)
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseIsoDate(iso: string): Date {
  const parsed = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return new Date()
  }
  return parsed
}

function diffIsoDays(startIso: string, endIso: string): number {
  const start = parseIsoDate(startIso)
  const end = parseIsoDate(endIso)
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
}

function addIsoDays(iso: string, days: number): string {
  const date = parseIsoDate(iso)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

function getCalendarHeaderDateParts(isoDate: string): {
  monthShort: string
  dayNumber: string
  weekday: string
  fullDate: string
} {
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return {
      monthShort: 'N/A',
      dayNumber: '--',
      weekday: isoDate,
      fullDate: isoDate
    }
  }

  return {
    monthShort: parsed.toLocaleDateString(undefined, { month: 'short' }).replace('.', ''),
    dayNumber: parsed.toLocaleDateString(undefined, { day: 'numeric' }),
    weekday: parsed.toLocaleDateString(undefined, { weekday: 'long' }),
    fullDate: parsed.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }
}

type RankedCommandPaletteNote = {
  relPath: string
  title: string
  fileName: string
  tags: string[]
  aliases: string[]
  pathSegments: string[]
  bodyPreview: string
  updatedAt: string
}

type CommandPaletteSearchMode = 'name' | 'body'

function parseCommandPaletteSearchInput(input: string): {
  mode: CommandPaletteSearchMode
  query: string
} {
  const trimmedInput = input.trim()
  if (trimmedInput.startsWith('@')) {
    return {
      mode: 'body',
      query: trimmedInput.slice(1).trim()
    }
  }

  return {
    mode: 'name',
    query: trimmedInput
  }
}

function rankCommandPaletteNotes(
  notes: NoteListItem[],
  query: string,
  mode: CommandPaletteSearchMode = 'name'
): RankedCommandPaletteNote[] {
  const terms = tokenizeSearchQuery(query)

  return notes
    .map((note) => {
      const title = stripNoteExtension(note.name)
      const aliases = note.mentionTargets ?? []
      const pathSegments = getSearchPathSegments(note.relPath)
      const score = scoreSearchDocument(
        terms,
        mode === 'body'
          ? [{ text: note.bodyPreview ?? '', weight: 7 }]
          : [
              { text: title, weight: 7 },
              { text: note.name, weight: 6 },
              { text: aliases.join(' '), weight: 5 },
              { text: pathSegments.join(' '), weight: 4 },
              { text: note.relPath, weight: 3 }
            ]
      )

      if (score === 0) {
        return null
      }

      return {
        score,
        note: {
          relPath: note.relPath,
          title,
          fileName: note.name,
          tags: note.tags,
          aliases,
          pathSegments,
          bodyPreview: note.bodyPreview ?? '',
          updatedAt: note.updatedAt
        }
      }
    })
    .filter(
      (
        result
      ): result is {
        score: number
        note: RankedCommandPaletteNote
      } => result !== null
    )
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return right.note.updatedAt.localeCompare(left.note.updatedAt)
    })
    .map((result) => result.note)
}

function rankCommandPaletteProjects(projects: Project[], query: string): Project[] {
  const terms = tokenizeSearchQuery(query)

  return projects
    .map((project) => {
      const folderPath = project.folderPath ?? ''
      const score = scoreSearchDocument(terms, [
        { text: project.name, weight: 7 },
        { text: folderPath, weight: 4 },
        { text: getSearchPathSegments(folderPath).join(' '), weight: 4 }
      ])

      return score > 0 ? { score, project } : null
    })
    .filter((result): result is { score: number; project: Project } => result !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return right.project.updatedAt.localeCompare(left.project.updatedAt)
    })
    .map((result) => result.project)
}

function tokenizeSearchQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s/_.-]+/)
    .map((term) => term.trim())
    .filter(Boolean)
}

function getSearchPathSegments(input: string): string[] {
  if (!input) {
    return []
  }

  return input
    .split('/')
    .flatMap((segment) => stripNoteExtension(segment).split(/[\s_.-]+/))
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean)
}

function scoreSearchDocument(
  terms: string[],
  fields: Array<{
    text: string
    weight: number
  }>
): number {
  if (terms.length === 0) {
    return 0
  }

  let totalScore = 0

  for (const term of terms) {
    let bestTermScore = 0

    for (const field of fields) {
      const fieldScore = scoreSearchField(term, field.text) * field.weight
      if (fieldScore > bestTermScore) {
        bestTermScore = fieldScore
      }
    }

    if (bestTermScore === 0) {
      return 0
    }

    totalScore += bestTermScore
  }

  return totalScore
}

function scoreSearchField(term: string, rawFieldText: string): number {
  const fieldText = rawFieldText.toLowerCase().trim()
  if (!term || !fieldText) {
    return 0
  }

  if (fieldText === term) {
    return 140
  }

  if (fieldText.startsWith(term)) {
    return 110
  }

  const words = fieldText.split(/[\s/_.-]+/).filter(Boolean)
  if (words.some((word) => word === term)) {
    return 95
  }

  if (words.some((word) => word.startsWith(term))) {
    return 78
  }

  const includesIndex = fieldText.indexOf(term)
  if (includesIndex >= 0) {
    return Math.max(52 - includesIndex, 28)
  }

  return scoreSubsequenceMatch(term, fieldText)
}

function scoreSubsequenceMatch(term: string, fieldText: string): number {
  let searchIndex = 0
  let firstMatchIndex = -1
  let lastMatchIndex = -1

  for (const char of term) {
    const nextIndex = fieldText.indexOf(char, searchIndex)
    if (nextIndex === -1) {
      return 0
    }

    if (firstMatchIndex === -1) {
      firstMatchIndex = nextIndex
    }

    lastMatchIndex = nextIndex
    searchIndex = nextIndex + 1
  }

  const span = lastMatchIndex - firstMatchIndex + 1
  return Math.max(26 - (span - term.length) - Math.floor(firstMatchIndex / 2), 8)
}

function isNestedPath(candidate: string | null, parentPath: string): boolean {
  if (!candidate) {
    return false
  }

  return candidate === parentPath || candidate.startsWith(`${parentPath}/`)
}

function treeContainsPath(tree: NoteTreeNode[], relPath: string): boolean {
  return tree.some((node) => {
    if (node.relPath === relPath) {
      return true
    }

    return node.kind === 'folder' ? treeContainsPath(node.children, relPath) : false
  })
}

function remapNestedPath(
  candidate: string | null,
  fromPath: string,
  toPath: string
): string | null {
  if (!candidate) {
    return candidate
  }

  if (candidate === fromPath) {
    return toPath
  }

  if (!candidate.startsWith(`${fromPath}/`)) {
    return candidate
  }

  return `${toPath}${candidate.slice(fromPath.length)}`
}

function joinRelPath(parentDir: string, name: string): string {
  return parentDir ? `${parentDir}/${name}` : name
}

function isEditableWorkspaceUndoTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.getAttribute('role') === 'textbox' ||
    Boolean(target.closest('[data-testid="note-block-editor"]'))
  )
}

function formatHistoryLabel(label: string | null): string {
  if (!label) {
    return 'last action'
  }

  return `${label.charAt(0).toLowerCase()}${label.slice(1)}`
}

function buildDefaultNoteName(): string {
  const now = new Date()
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `note-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours()
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}
