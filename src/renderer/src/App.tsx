import {
  CSSProperties,
  Fragment,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { flushSync } from 'react-dom'
import {
  ChevronDown,
  Copy,
  Download,
  Keyboard,
  LayoutGrid,
  ListTodo,
  Paintbrush,
  Trash2,
  Plus,
  Type,
  Link2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Target,
  FolderOpen,
  ChevronUp,
  Star,
  SlidersHorizontal
} from 'lucide-react'
import {
  CALENDAR_TASK_TYPE_OPTIONS,
  CalendarTask,
  CreateWeeklyPlanWeekInput,
  NoteVimKeyMapping,
  NoteListItem,
  NoteImportResult,
  NoteTreeNode,
  Project,
  ProjectIconStyle,
  ProjectMilestone,
  ProjectStatus,
  ProjectSubtask,
  NativeMenuItemDescriptor,
  RendererVaultApi,
  TaskPriority,
  TaskReminder,
  CalendarTaskType,
  WeeklyPlanWeek,
  HistoryAffectedAreas,
  VaultOpenResult
} from '../../shared/types'
import type { ProfileColor } from '../../shared/profileColors'
import {
  isExcalidrawPath,
  stripNotebookFileExtension,
  withExcalidrawExtension
} from '../../shared/excalidrawFile'
import { createRandomProjectIcon } from '../../shared/projectIcons'
import { resolveProfileAccent } from './lib/profileColors'
import {
  appendTextToNoteMarkdown,
  getNoteDisplayName,
  serializeStoredNoteDocument,
  stripNoteExtension,
  withNoteExtension
} from '../../shared/noteDocument'
import { splitNoteContent } from '../../shared/noteContent'
import { generateProjectTag, normalizeTag } from '../../shared/noteTags'
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
import { type AppPlatformKind, useAppPlatform } from './platform'
import {
  getAvailablePages,
  isPageAvailable,
  normalizePageForPlatform
} from './platform/pageAvailability'
import { SidebarProvider, SidebarInset } from './components/ui/sidebar'
import { Popover, PopoverContent, PopoverTrigger } from './components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './components/ui/dropdown-menu'
import {
  DocumentWorkspaceMain,
  DocumentWorkspaceMainContent,
  DocumentWorkspaceMainHeader,
  DocumentWorkspacePanel,
  DocumentWorkspacePanelContent,
  DocumentWorkspacePanelHeader,
  WorkspaceActionButton,
  WorkspaceHeaderActions,
  WorkspaceHeaderActionDivider,
  WorkspaceHeaderActionGroup
} from './components/ui/document-workspace'
import {
  WorkspacePanelSection,
  WorkspacePanelSectionHeader
} from './components/ui/workspace-panel-section'
import { SelectionMenu, type SelectionMenuOption } from './components/ui/selection-menu'
import { TabMenu, TabMenuCountBadge, TabMenuItem } from './components/ui/tab-menu'
import { EditorPage } from './pages/EditorPage'
import { ProjectsWorkspacePage, type ProjectsWorkspaceTab } from './pages/ProjectsWorkspacePage'
import { SearchPage } from './pages/SearchPage'
import { FontOption, SettingsPage } from './pages/SettingsPage'
import { AgentHistoryPage } from './pages/AgentHistoryPage'
import { SchedulesPage } from './pages/SchedulesPage'
import { SubscriptionsPage } from './pages/SubscriptionsPage'
import {
  ScheduleDocumentationPage,
  SCHEDULE_DOCUMENTATION_MARKDOWN
} from './pages/ScheduleDocumentationPage'
import { WeeklyPlanWorkspace, WeeklyPlanSidebar } from './pages/WeeklyPlanPage'
import { ExcalidrawFileEditor } from './components/ExcalidrawFileEditor'
import { NoteExportDialog, type NoteExportFormat } from './components/NoteExportDialog'
import { KnowledgePage } from './pages/KnowledgePage'
import { VaultSwapperDialog } from './components/VaultSwapperDialog'
import { useVaultStore } from './state/store'
import { useWeeklyPlan } from './hooks/useWeeklyPlan'
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
import { buildMilestoneCalendarEvents, normalizeCalendarTasks } from './lib/calendarTasks'
import { type NoteEditorSnapshot, type NoteEditorSessionSnapshot } from './lib/noteEditorSession'
import { createNoteSaveCoordinator } from './lib/noteSaveCoordinator'
import {
  computeProjectProgress,
  deriveMilestoneStatus,
  getProjectHealthSummary,
  toLocalIsoDate
} from './lib/projectStatus'
import { findWeekForDate, formatWeekRange, getSortedWeeks } from './lib/weeklyPlan'
import { shiftIsoMonthClamped } from './lib/calendarDate'
import {
  getPrimaryNoteTreeSelectionEntry,
  normalizeNoteTreeSelection,
  type NoteTreeSelection
} from './lib/noteTreeSelection'
import { hideManagedProjectTree } from './lib/noteTreeVisibility'
import { canUseNativeMenus, getElementMenuPosition, showNativeMenu } from './lib/nativeMenu'
import { type ProjectsWorkspaceFilterMode } from './lib/projectTaskRows'

const PAGE_LABELS: Record<AppPage, string> = {
  knowledge: 'Knowledge',
  notes: 'Notebooks',
  projects: 'Projects',
  subscriptions: 'Subscriptions',
  weeklyPlan: 'Weekly Plan',
  calendar: 'Calendar',
  settings: 'Settings',
  schedules: 'Schedules',
  scheduleDocs: 'Schedule API Guide',
  agentHistory: 'Agent Chat'
}

type CalendarViewMode = 'month' | 'week'
type CalendarContentFilter = 'all' | 'tasks' | 'milestones'

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

const FONT_OPTIONS: FontOption[] = [
  {
    label: 'Iowan Serif',
    value: "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Palatino, serif"
  },
  { label: 'Inter', value: "Inter, 'Segoe UI', sans-serif" },
  { label: 'Atkinson Hyperlegible', value: "'Atkinson Hyperlegible', 'Segoe UI', sans-serif" },
  { label: 'Source Sans', value: "'Source Sans 3', 'Gill Sans', 'Trebuchet MS', sans-serif" },
  {
    label: 'JetBrains Mono',
    value: "'JetBrains Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace"
  },
  { label: 'Charter', value: "'Charter', 'Georgia', 'Times New Roman', serif" }
]

const CALENDAR_BULK_SCOPE_OPTIONS = [
  { value: 'day', label: 'This day' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' }
] as const

const CALENDAR_VIEW_MODE_OPTIONS: SelectionMenuOption[] = [
  { value: 'month', label: 'Monthly' },
  { value: 'week', label: 'Weekly' }
]

const CALENDAR_BULK_SCOPE_SELECTION_OPTIONS: SelectionMenuOption[] =
  CALENDAR_BULK_SCOPE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))

const CALENDAR_TASK_TYPE_SELECTION_OPTIONS: SelectionMenuOption[] = CALENDAR_TASK_TYPE_OPTIONS.map(
  (option) => ({ value: option.value, label: option.label })
)

const NOTE_AUTOSAVE_DELAY_MS = 1200

function SettingsRightPanelSections(): ReactElement {
  const revealItemIds = ['settings-appearance', 'settings-editor-defaults', 'settings-shortcuts']
  const { containerRef, getRevealItemProps } = useStaggeredScrollReveal(revealItemIds, {
    resetKey: 'settings-right-panel'
  })
  const sections = [
    {
      id: 'settings-appearance',
      icon: <Paintbrush size={16} aria-hidden="true" />,
      iconContainerClassName: 'bg-rose-500/12 text-rose-500',
      heading: 'Appearance',
      description: 'Theme and surface defaults for the workspace'
    },
    {
      id: 'settings-editor-defaults',
      icon: <Type size={16} aria-hidden="true" />,
      iconContainerClassName: 'bg-cyan-500/12 text-cyan-500',
      heading: 'Editor Defaults',
      description: 'Type, writing, and editing preferences'
    },
    {
      id: 'settings-shortcuts',
      icon: <Keyboard size={16} aria-hidden="true" />,
      iconContainerClassName: 'bg-violet-500/12 text-violet-500',
      heading: 'Shortcuts',
      description: 'Keyboard actions available across the app'
    }
  ]

  return (
    <div ref={containerRef} className="flex h-full flex-col gap-4 p-3">
      {sections.map((section) => {
        const revealProps = getRevealItemProps(section.id)
        return (
          <WorkspacePanelSection
            key={section.id}
            ref={revealProps.ref}
            style={revealProps.style}
            className={`${revealProps.className} rounded-xl`}
          >
            <WorkspacePanelSectionHeader
              icon={section.icon}
              iconContainerClassName={section.iconContainerClassName}
              heading={section.heading}
              description={section.description}
            />
          </WorkspacePanelSection>
        )
      })}
    </div>
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
  const performanceModeEnabled = useVaultStore((state) => state.settings.performanceModeEnabled)
  const editorVimModeEnabled = useVaultStore((state) => state.settings.editorVimModeEnabled)
  const editorVimKeyMappings = useVaultStore((state) => state.settings.editorVimKeyMappings)
  const profileName = useVaultStore((state) => state.settings.profile.name)
  const profileColor = useVaultStore((state) => state.settings.profile.color)
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
  const pushToast = useVaultStore((state) => state.pushToast)
  const [activePage, setActivePage] = useState<AppPage>('notes')
  const [knowledgeOrphanRingRadiusInput, setKnowledgeOrphanRingRadiusInput] = useState('')
  const availablePages = useMemo(() => getAvailablePages(platform), [platform])
  const useNativeMenus = platform.capabilities.supportsNativeMenus && canUseNativeMenus()
  const [isDarkMode, setIsDarkMode] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  )
  const profileAccent = resolveProfileAccent(profileColor, isDarkMode)
  const accentCssVars = useMemo(
    () =>
      ({
        ['--accent' as string]: profileAccent.accent,
        ['--accent-soft' as string]: profileAccent.soft,
        ['--accent-line' as string]: profileAccent.line,
        ['--accent-color' as string]: profileAccent.soft,
        ['--accent-foreground' as string]: profileAccent.accent,
        ['--ring' as string]: profileAccent.line,
        ['--sidebar-primary' as string]: profileAccent.accent,
        ['--sidebar-accent' as string]: profileAccent.soft,
        ['--sidebar-accent-foreground' as string]: profileAccent.accent
      }) as CSSProperties,
    [profileAccent]
  )
  const shellAccentStyle = accentCssVars
  const [settingsLoaded, setSettingsLoaded] = useState(false)
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
      validate: (value): value is CalendarContentFilter =>
        value === 'all' || value === 'tasks' || value === 'milestones'
    })
  const [focusedMilestoneTarget, setFocusedMilestoneTarget] = useState<{
    projectId: string
    milestoneId: string
    token: number
  } | null>(null)
  const [calendarHeaderNewTask, setCalendarHeaderNewTask] = useState('')
  const [calendarBulkTaskType, setCalendarBulkTaskType] = useState<CalendarTaskType>('assignment')
  const [calendarBulkScope, setCalendarBulkScope] =
    useState<(typeof CALENDAR_BULK_SCOPE_OPTIONS)[number]['value']>('day')
  const [isCalendarBulkActionOpen, setIsCalendarBulkActionOpen] = useState(false)
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

  useEffect(() => {
    const rootStyle = document.documentElement.style
    for (const [name, value] of Object.entries(accentCssVars)) {
      rootStyle.setProperty(name, String(value))
    }

    return () => {
      for (const name of Object.keys(accentCssVars)) {
        rootStyle.removeProperty(name)
      }
    }
  }, [accentCssVars])
  const [collapseAllNotesTreeToken, setCollapseAllNotesTreeToken] = useState(0)
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
  const visibleNoteTree = useMemo(() => hideManagedProjectTree(noteTree), [noteTree])
  const projects = settingsProjects
  const hasVault = Boolean(vault?.rootPath)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [projectFilterMode, setProjectFilterMode] = useState<ProjectsWorkspaceFilterMode>('all')
  const [projectsWorkspaceTab, setProjectsWorkspaceTab] = usePersistentState<ProjectsWorkspaceTab>(
    'projects-workspace-tab',
    'board',
    {
      validate: (value): value is ProjectsWorkspaceTab => value === 'board' || value === 'taskList'
    }
  )
  const [projectDrawerRequest, setProjectDrawerRequest] = useState<{
    projectId: string
    token: number
  } | null>(null)
  const [newProjectRequest, setNewProjectRequest] = useState<{ token: number } | null>(null)
  const [newSubtaskRequest] = useState<{
    projectId: string
    milestoneId: string
    token: number
  } | null>(null)
  const [projectTaskListCollapseAllRequest, setProjectTaskListCollapseAllRequest] = useState<{
    token: number
    collapsed: boolean
  } | null>(null)
  const [areProjectTaskListGroupsCollapsed, setAreProjectTaskListGroupsCollapsed] = useState(false)
  const [, setProjectsWorkspaceMilestoneContext] = useState<{
    projectId: string
    milestoneId: string
  } | null>(null)
  const {
    data: weeklyPlanState,
    loading: weeklyPlanLoading,
    isReady: weeklyPlanReady,
    createWeek,
    updateWeek,
    deleteWeek,
    addPriority,
    updatePriority,
    deletePriority,
    reorderPriorities,
    upsertReview,
    refresh: refreshWeeklyPlan
  } = useWeeklyPlan(vaultApi, pushToast, vault)
  const [selectedWeeklyPlanWeekId, setSelectedWeeklyPlanWeekId] = useState<string | null>(null)
  const [pendingWeekStart, setPendingWeekStart] = useState<string | null>(null)
  const weeklyPlanWeeks = useMemo(() => getSortedWeeks(weeklyPlanState), [weeklyPlanState])
  const todayIso = toLocalIsoDate(new Date())
  const currentWeeklyPlanWeek = useMemo(
    () => findWeekForDate(weeklyPlanWeeks, todayIso) ?? null,
    [weeklyPlanWeeks, todayIso]
  )
  const weeklyPlanCurrentWeekId = currentWeeklyPlanWeek?.id ?? null
  const selectedWeeklyPlanWeek = useMemo(
    () => weeklyPlanWeeks.find((week) => week.id === selectedWeeklyPlanWeekId) ?? null,
    [weeklyPlanWeeks, selectedWeeklyPlanWeekId]
  )
  const nextWeeklyPlanStart = useMemo(
    () => getNextWeeklyPlanStart(weeklyPlanWeeks),
    [weeklyPlanWeeks]
  )
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
  const commandPaletteSearchRequestRef = useRef(0)
  const noteActionsButtonRef = useRef<HTMLButtonElement | null>(null)
  const createNoteRef = useRef<(() => Promise<void>) | null>(null)
  const notesRef = useRef(notes)
  const currentNotePathRef = useRef(currentNotePath)
  const currentExcalidrawPathRef = useRef(currentExcalidrawPath)
  const currentNoteContentRef = useRef(currentNoteContent)
  const currentNoteTagsRef = useRef<string[]>([])
  const currentNoteEditorRef = useRef<NoteEditorHandle | null>(null)
  const currentNoteEditorDirtyRef = useRef(false)
  const noteEditorSessionsRef = useRef<Record<string, NoteEditorSessionSnapshot>>({})
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
  const shouldAnimateWorkspacePane =
    hasVault &&
    (activePage === 'knowledge' ||
      activePage === 'notes' ||
      activePage === 'projects' ||
      activePage === 'calendar')
  const showWorkspacePanel =
    hasVault && (activePage === 'notes' || activePage === 'calendar' || activePage === 'weeklyPlan')
  const shouldSlideWorkspacePanelOut = showWorkspacePanel && (isRightPanelCollapsed || isFocusMode)
  const hasRightPanel =
    showWorkspacePanel || activePage === 'schedules' || activePage === 'agentHistory'

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

      const session = noteEditorSessionsRef.current[relPath]
      const persistedFingerprint = persistedNoteFingerprintsRef.current[relPath]
      currentNoteEditorDirtyRef.current = Boolean(
        session && getStoredNoteFingerprint(session) !== persistedFingerprint
      )
    },
    [getStoredNoteFingerprint]
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
        setSettings(nextSettings)
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [vaultApi, lastOpenedNotePath, setSettings, pushToast]
  )

  const persistLastOpenedProjectId = useCallback(
    async (projectId: string | null, options?: { history?: boolean }): Promise<void> => {
      if (!vaultApi) {
        return
      }

      if (lastOpenedProjectId === projectId) {
        return
      }

      try {
        const nextSettings = await vaultApi.settings.update(
          { lastOpenedProjectId: projectId },
          options
        )
        setSettings(nextSettings)
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [vaultApi, lastOpenedProjectId, setSettings, pushToast]
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
        setSettings(nextSettings)
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [vaultApi, favoriteNotePathSettings, setSettings, pushToast]
  )

  const persistFavoriteProjectIds = useCallback(
    async (favoriteProjectIds: string[], options?: { history?: boolean }): Promise<void> => {
      if (!vaultApi) {
        return
      }

      const normalized = Array.from(new Set(favoriteProjectIds))
      const current = favoriteProjectIdSettings
      if (
        normalized.length === current.length &&
        normalized.every((projectId, index) => projectId === current[index])
      ) {
        return
      }

      try {
        const nextSettings = await vaultApi.settings.update(
          { favoriteProjectIds: normalized },
          options
        )
        setSettings(nextSettings)
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [vaultApi, favoriteProjectIdSettings, setSettings, pushToast]
  )

  const selectProject = useCallback(
    (projectId: string | null): void => {
      setSelectedProjectId(projectId)
      void persistLastOpenedProjectId(projectId)
    },
    [persistLastOpenedProjectId]
  )

  const handleCreateWeeklyPlanWeek = async (input: CreateWeeklyPlanWeekInput): Promise<void> => {
    if (!weeklyPlanReady) {
      pushToast('error', 'Weekly Plan is unavailable. Restart Beacon after updating to enable it.')
      return
    }
    setPendingWeekStart(startOfWeekIso(parseIsoDate(input.startDate)))
    await createWeek(input)
  }

  const handleDeleteSelectedWeeklyPlanWeek = async (): Promise<void> => {
    if (!selectedWeeklyPlanWeek) {
      return
    }
    if (!window.confirm('Delete this week plan? Moved to Trash. Use Undo to restore.')) {
      return
    }
    await deleteWeek({ id: selectedWeeklyPlanWeek.id })
  }

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
        const existingSession = noteEditorSessionsRef.current[relPath] ?? null
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

      noteEditorSessionsRef.current[relPath] = nextSession
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
    [setCurrentNoteContent]
  )

  const setCurrentNoteEditorSession = useCallback(
    (nextContent: string): void => {
      const relPath = currentNotePathRef.current
      const nextSession: NoteEditorSessionSnapshot = {
        content: nextContent,
        tags: [...currentNoteTagsRef.current]
      }

      if (relPath) {
        noteEditorSessionsRef.current[relPath] = nextSession
        updateNoteMentionTargets(relPath, nextSession.content)
      }

      currentNoteContentRef.current = nextSession.content
      setCurrentNoteContent(nextSession.content)
      setCurrentNoteEditorDraft(nextSession.content)
      currentNoteEditorDirtyRef.current = true
    },
    [setCurrentNoteContent, updateNoteMentionTargets]
  )

  const handleCurrentNoteSnapshotChange = useCallback(
    (snapshot: NoteEditorSnapshot): void => {
      const relPath = currentNotePathRef.current
      const nextSession: NoteEditorSessionSnapshot = {
        content: snapshot.content,
        tags: [...currentNoteTagsRef.current]
      }

      if (relPath) {
        noteEditorSessionsRef.current[relPath] = nextSession
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
    [setCurrentNoteContent, updateNoteMentionTargets]
  )
  // Unscheduled tasks (no date assigned)
  const unscheduledTasks = useMemo(() => {
    return normalizeCalendarTasks(calendarTasks).filter((task) => !task.date)
  }, [calendarTasks])

  const scheduledCalendarTasks = useMemo(() => {
    return normalizeCalendarTasks(calendarTasks).filter((task) => Boolean(task.date))
  }, [calendarTasks])
  const milestoneCalendarEvents = useMemo(() => buildMilestoneCalendarEvents(projects), [projects])
  const calendarContentFilterOptions = useMemo(
    () => [
      {
        value: 'all' as const,
        label: 'All',
        count: scheduledCalendarTasks.length + milestoneCalendarEvents.length
      },
      {
        value: 'tasks' as const,
        label: 'Tasks',
        count: scheduledCalendarTasks.length
      },
      {
        value: 'milestones' as const,
        label: 'Milestones',
        count: milestoneCalendarEvents.length
      }
    ],
    [milestoneCalendarEvents.length, scheduledCalendarTasks.length]
  )
  const visibleCalendarTasks = useMemo(() => {
    if (calendarContentFilter === 'milestones') {
      return []
    }
    return calendarTasks
  }, [calendarContentFilter, calendarTasks])
  const visibleScheduledCalendarTasks = useMemo(() => {
    if (calendarContentFilter === 'milestones') {
      return []
    }
    return scheduledCalendarTasks
  }, [calendarContentFilter, scheduledCalendarTasks])
  const visibleMilestoneCalendarEvents = useMemo(() => {
    if (calendarContentFilter === 'tasks') {
      return []
    }
    return milestoneCalendarEvents
  }, [calendarContentFilter, milestoneCalendarEvents])
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

    if (activePage === 'weeklyPlan') {
      return selectedWeeklyPlanWeek
        ? formatWeekRange(selectedWeeklyPlanWeek.startDate, selectedWeeklyPlanWeek.endDate)
        : 'No Week Selected'
    }

    if (activePage === 'subscriptions') {
      return 'Subscriptions'
    }

    return null
  }, [
    activePage,
    hasVault,
    searchQuery,
    currentExcalidrawPath,
    currentNotePath,
    selectedWeeklyPlanWeek
  ])
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
  const calendarCurrentPeriodSubtitle = useMemo(
    () => (calendarViewMode === 'week' ? 'Week view' : 'Month view'),
    [calendarViewMode]
  )
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
    if (!weeklyPlanWeeks.length) {
      setSelectedWeeklyPlanWeekId(null)
      return
    }
    if (
      selectedWeeklyPlanWeekId &&
      weeklyPlanWeeks.some((week) => week.id === selectedWeeklyPlanWeekId)
    ) {
      return
    }
    const fallback =
      findWeekForDate(weeklyPlanWeeks, todayIso) ?? weeklyPlanWeeks[weeklyPlanWeeks.length - 1]
    setSelectedWeeklyPlanWeekId(fallback.id)
  }, [weeklyPlanWeeks, selectedWeeklyPlanWeekId, todayIso])

  useEffect(() => {
    if (!pendingWeekStart || !weeklyPlanState) {
      return
    }
    const match = weeklyPlanState.weeks.find((week) => week.startDate === pendingWeekStart)
    if (match) {
      setSelectedWeeklyPlanWeekId(match.id)
      setPendingWeekStart(null)
    }
  }, [pendingWeekStart, weeklyPlanState])

  useEffect(() => {
    if (!vaultApi || !vault?.rootPath) {
      setSettingsLoaded(false)
      return
    }

    let cancelled = false
    setSettingsLoaded(false)
    void vaultApi.settings
      .get()
      .then((nextSettings) => {
        if (!cancelled) {
          setSettings(nextSettings)
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
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const syncColorScheme = (): void => setIsDarkMode(mediaQuery.matches)

    syncColorScheme()
    mediaQuery.addEventListener('change', syncColorScheme)

    return () => {
      mediaQuery.removeEventListener('change', syncColorScheme)
    }
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-family', fontFamily)
  }, [fontFamily])

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
        setSelectedProjectId(storedId)
      }
      return
    }

    if (!projects.length) {
      if (selectedProjectId !== null || lastOpenedProjectId !== null) {
        selectProject(null)
      }
      return
    }

    if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
      selectProject(projects[0].id)
    }
  }, [
    settingsLoaded,
    lastOpenedProjectId,
    projects,
    selectedProjectId,
    selectProject,
    setSelectedProjectId
  ])

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

        activePageRef.current = targetPage
        setActivePage(targetPage)
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
    [hasVault, persistCurrentNoteForPageLeave, platform]
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
          delete noteEditorSessionsRef.current[currentNotePathRef.current]
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

      if (affected.weeklyPlan) {
        await refreshWeeklyPlan()
      }
    },
    [
      persistLastOpenedNotePath,
      replaceNotes,
      refreshWeeklyPlan,
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
    onToggleProjectsView: () => {
      setProjectsWorkspaceTab((current) => (current === 'board' ? 'taskList' : 'board'))
    },
    onToggleCalendarView: () => {
      setCalendarViewMode((current) => (current === 'month' ? 'week' : 'month'))
    },
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

  useEffect(() => {
    if (!vaultApi) {
      return
    }

    void vaultApi.ui.applyPerformanceMode(performanceModeEnabled).catch(() => undefined)
  }, [performanceModeEnabled, vaultApi])

  useEffect(() => {
    const nextValue = performanceModeEnabled ? 'on' : 'off'
    document.documentElement.dataset.performanceMode = nextValue
    document.body.dataset.performanceMode = nextValue

    return () => {
      delete document.documentElement.dataset.performanceMode
      delete document.body.dataset.performanceMode
    }
  }, [performanceModeEnabled])

  const updateFontFamily = async (fontFamily: string): Promise<void> => {
    if (!vaultApi) {
      return
    }

    try {
      const nextSettings = await vaultApi.settings.update({ fontFamily })
      setSettings(nextSettings)
      pushToast('success', 'Font updated')
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const updatePerformanceMode = async (enabled: boolean): Promise<void> => {
    if (!vaultApi) {
      return
    }

    try {
      const nextSettings = await vaultApi.settings.update({ performanceModeEnabled: enabled })
      setSettings(nextSettings)
      pushToast('success', enabled ? 'Performance mode enabled' : 'Performance mode disabled')
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const updateEditorVimMode = async (enabled: boolean): Promise<void> => {
    if (!vaultApi) {
      return
    }

    try {
      const nextSettings = await vaultApi.settings.update({ editorVimModeEnabled: enabled })
      setSettings(nextSettings)
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
      setSettings(nextSettings)
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
      setSettings(nextSettings)
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const updateProfileColor = async (color: ProfileColor): Promise<void> => {
    if (!vaultApi) {
      return
    }

    try {
      const nextSettings = await vaultApi.settings.update({
        profile: {
          color
        }
      })
      setSettings(nextSettings)
      pushToast('success', 'Color style updated')
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
      setSettings(nextSettings)
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
      const nextSettings = await vaultApi.settings.update({ calendarTasks: normalizedTasks })
      setSettings(nextSettings)
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
      calendarTasks: nextTasks
    })
    await persistCalendarTasks(nextTasks)
    return nextTasks
  }

  const persistProjects = async (nextProjects: Project[]): Promise<boolean> => {
    if (!vaultApi) {
      return false
    }

    flushSync(() => {
      setSettings({
        ...useVaultStore.getState().settings,
        projects: nextProjects
      })
    })

    try {
      const nextSettings = await vaultApi.settings.update({ projects: nextProjects })
      setSettings(nextSettings)
      return true
    } catch (error) {
      pushToast('error', String(error))
      return false
    }
  }

  const persistProjectData = async (
    nextProjects: Project[],
    nextProjectIcons: Record<string, ProjectIconStyle>
  ): Promise<boolean> => {
    if (!vaultApi) {
      return false
    }

    flushSync(() => {
      setSettings({
        ...useVaultStore.getState().settings,
        projects: nextProjects,
        projectIcons: nextProjectIcons
      })
    })

    try {
      const nextSettings = await vaultApi.settings.update({
        projects: nextProjects,
        projectIcons: nextProjectIcons
      })
      setSettings(nextSettings)
      return true
    } catch (error) {
      pushToast('error', String(error))
      return false
    }
  }

  // (was addCalendarTask) Add scheduled task via modal prompt — removed in favor of header input for unscheduled tasks

  const createCalendarTask = async (
    title: string,
    date?: string,
    time?: string,
    endTime?: string
  ): Promise<CalendarTask> => {
    const trimmed = title.trim() || 'New Task'
    const nextTask: CalendarTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: trimmed,
      date,
      time,
      endTime,
      completed: false,
      createdAt: new Date().toISOString(),
      priority: 'low',
      taskType: 'assignment',
      reminders: []
    }

    const nextTasks = normalizeCalendarTasks([...calendarTasksRef.current, nextTask])
    calendarTasksRef.current = nextTasks
    await persistCalendarTasks(nextTasks)
    return nextTask
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
      tasks.map((task) => (task.id === taskId ? { ...task, completed: !task.completed } : task))
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

  const openMilestoneFromCalendar = useCallback(
    (projectId: string, milestoneId: string): void => {
      setProjectsWorkspaceTab('taskList')
      selectProject(projectId)
      setFocusedMilestoneTarget({
        projectId,
        milestoneId,
        token: Date.now()
      })
      void navigateToPage('projects')
    },
    [navigateToPage, selectProject, setProjectsWorkspaceTab]
  )

  const reassignCalendarTaskTypeForScope = async (
    scope: (typeof CALENDAR_BULK_SCOPE_OPTIONS)[number]['value'],
    taskType: CalendarTaskType
  ): Promise<void> => {
    let updatedCount = 0
    const range = getCalendarScopeRange(scope, selectedCalendarDate)

    await updateCalendarTasks((tasks) =>
      tasks.map((task) => {
        if (
          !calendarTaskOverlapsRange(task, range.start, range.end) ||
          task.taskType === taskType
        ) {
          return task
        }

        updatedCount += 1
        return { ...task, taskType }
      })
    )

    if (updatedCount === 0) {
      pushToast('info', `No tasks found for ${scope}`)
      return
    }

    setIsCalendarBulkActionOpen(false)
    pushToast('success', `Updated ${updatedCount} task${updatedCount === 1 ? '' : 's'}`)
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
      currentNotePathRef.current = relPath
      currentNoteContentRef.current = session.content
      currentNoteTagsRef.current = nextTags
      currentExcalidrawPathRef.current = null
      currentNoteEditorDirtyRef.current =
        getStoredNoteFingerprint(session) !== persistedNoteFingerprintsRef.current[relPath]
      currentNoteEditorRef.current?.loadDocument({
        content: session.content,
        notePath: relPath,
        preserveFocus: currentNoteEditorRef.current.hasFocusIntent()
      })
      setCurrentExcalidrawPath(null)
      setCurrentNotePath(relPath)
      setCurrentNoteContent(session.content)
      setCurrentNoteTagsState(nextTags)
      setCurrentNoteEditorDraft(session.content)
    },
    [getStoredNoteFingerprint, setCurrentExcalidrawPath, setCurrentNoteContent, setCurrentNotePath]
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

        const cachedSession = noteEditorSessionsRef.current[relPath]
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
        noteEditorSessionsRef.current[relPath] = nextSession
        persistedNoteFingerprintsRef.current[relPath] = serializeStoredNoteDocument(document)
        applyOpenNoteSession(relPath, nextSession)
        void persistLastOpenedNotePath(relPath)
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [
      applyOpenNoteSession,
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

        currentExcalidrawPathRef.current = relPath
        currentNotePathRef.current = null
        currentNoteContentRef.current = ''
        currentNoteTagsRef.current = []
        setCurrentExcalidrawPath(relPath)
        setCurrentNotePath(null)
        resetCurrentNoteEditorSession()
        setCurrentNoteTagsState([])
        setCurrentNoteContent('')
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [
      flushCurrentNote,
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

  useEffect(() => {
    if (!settingsLoaded) {
      return
    }

    if (favoriteProjectIds.length === favoriteProjectIdSettings.length) {
      return
    }

    void persistFavoriteProjectIds(favoriteProjectIds)
  }, [
    settingsLoaded,
    favoriteProjectIds,
    favoriteProjectIdSettings.length,
    persistFavoriteProjectIds
  ])

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
    noteEditorSessionsRef.current = {}
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
    setSelectedNoteTreeEntries([])
    setSelectedProjectId(null)
  }, [
    resetCurrentNoteEditorSession,
    setCurrentExcalidrawPath,
    setCurrentNoteContent,
    setCurrentNotePath,
    setSearchQuery,
    setSearchResults,
    setNoteTree
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

  const runVaultMigration = useCallback(async (): Promise<void> => {
    if (!vaultApi) {
      pushToast('error', 'Vault migration is only available inside the Electron app')
      return
    }

    if (!vault) {
      pushToast('error', 'Select a vault in Settings before running migration')
      void navigateToPage('settings')
      return
    }

    try {
      const result = await vaultApi.vault.runMigration()
      await applyVaultActivationResult(result, `Migrated vault ${result.info.rootPath}`)
    } catch (error) {
      pushToast('error', String(error))
    }
  }, [applyVaultActivationResult, navigateToPage, pushToast, vault, vaultApi])

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
    if (currentExcalidrawPath) {
      setSelectedNoteTreeEntries([{ kind: 'excalidraw', relPath: currentExcalidrawPath }])
      return
    }

    if (!currentNotePath) {
      return
    }

    setSelectedNoteTreeEntries([{ kind: 'note', relPath: currentNotePath }])
  }, [currentExcalidrawPath, currentNotePath])

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
      noteEditorSessionsRef.current = {}
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
      noteEditorSessionsRef.current = {}
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
    if (relPath && noteEditorSessionsRef.current[relPath]) {
      noteEditorSessionsRef.current[relPath] = {
        ...noteEditorSessionsRef.current[relPath],
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
    if (relPath && noteEditorSessionsRef.current[relPath]) {
      noteEditorSessionsRef.current[relPath] = {
        ...noteEditorSessionsRef.current[relPath],
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
    const nextProjects = projects.map((project) =>
      project.id === projectId
        ? { ...project, icon: nextIcon, updatedAt: new Date().toISOString() }
        : project
    )
    const nextProjectIcons = { ...projectIcons, [projectId]: nextIcon }
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
      noteEditorSessionsRef.current[newPath] = {
        content,
        tags
      }
      delete noteEditorSessionsRef.current[oldPath]
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
      delete noteEditorSessionsRef.current[relPath]
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

  const downloadScheduleDocumentation = async (): Promise<void> => {
    if (!vaultApi) {
      pushToast('error', 'Documentation export is only available inside the Electron app')
      return
    }

    try {
      const exportedPath = await vaultApi.files.exportNote(
        'Schedule API Guide.md',
        SCHEDULE_DOCUMENTATION_MARKDOWN
      )
      if (!exportedPath) {
        return
      }
      pushToast('success', `Guide exported to ${exportedPath}`)
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const exportProject = async (project: Project): Promise<void> => {
    if (!vaultApi) {
      pushToast('error', 'Project export is only available inside the Electron app')
      return
    }

    const projectTag = generateProjectTag(project.id)
    const projectNotes = notes
      .filter((note) => note.tags.includes(projectTag))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))

    try {
      const noteSections = await Promise.all(
        projectNotes.map(async (note) => {
          const noteContent = await vaultApi.files.readNote(note.relPath)
          return [`### ${note.name}`, '', `Source: ${note.relPath}`, '', noteContent.trim()].join(
            '\n'
          )
        })
      )

      const milestoneLines =
        project.milestones.length === 0
          ? ['- None yet']
          : project.milestones.flatMap((milestone) => {
              const lines = [
                `- ${milestone.title} (${milestone.status})${milestone.dueDate ? ` - due ${milestone.dueDate}` : ''}`
              ]
              if (milestone.description?.trim()) {
                lines.push(`  Description: ${milestone.description.trim()}`)
              }
              if (milestone.subtasks.length === 0) {
                lines.push('  Subtasks: none')
                return lines
              }
              lines.push(
                ...milestone.subtasks.map((subtask) => {
                  const detailParts = [
                    subtask.completed ? 'done' : 'open',
                    subtask.dueDate ? `due ${subtask.dueDate}` : null
                  ].filter((part): part is string => Boolean(part))
                  return `  - ${subtask.title}${detailParts.length > 0 ? ` (${detailParts.join(', ')})` : ''}`
                })
              )
              return lines
            })

      const projectNotesSection =
        noteSections.length > 0
          ? noteSections.join('\n\n---\n\n')
          : '_No notes tagged for this project yet._'

      const exportContent = [
        `# ${project.name}`,
        '',
        `- Status: ${project.status}`,
        `- Progress: ${project.progress}%`,
        `- Last updated: ${new Date(project.updatedAt).toISOString()}`,
        '',
        '## Summary',
        '',
        project.summary.trim() || '_No summary provided._',
        '',
        '## Milestones',
        '',
        ...milestoneLines,
        '',
        '## Project Notes',
        '',
        projectNotesSection,
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

  const withComputedProjectState = (project: Project): Project => {
    const milestones = project.milestones.map((milestone) => {
      const normalizedSubtasks = (milestone.subtasks ?? []).map((subtask) => ({
        ...subtask,
        description: subtask.description ?? ''
      }))

      const normalizedMilestone: ProjectMilestone = {
        ...milestone,
        description: milestone.description ?? '',
        collapsed: milestone.collapsed ?? false,
        subtasks: normalizedSubtasks,
        status: deriveMilestoneStatus({ ...milestone, subtasks: normalizedSubtasks })
      }

      return normalizedMilestone
    })

    const health = getProjectHealthSummary({ milestones }, todayIso)
    const nextStatus: ProjectStatus =
      project.status === 'completed' && health.status !== 'completed' ? 'completed' : health.status

    return {
      ...project,
      status: nextStatus,
      milestones,
      progress: computeProjectProgress(milestones, nextStatus)
    }
  }

  const createProject = (input?: {
    name?: string
    summary?: string
    icon?: ProjectIconStyle
  }): string => {
    const baseName = input?.name?.trim() || 'Untitled Project'
    const existingNames = new Set(projects.map((project) => project.name.toLowerCase()))

    let nextName = baseName
    let suffix = 2
    while (existingNames.has(nextName.toLowerCase())) {
      nextName = `${baseName} ${suffix}`
      suffix += 1
    }

    const nextProject: Project = {
      id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: nextName,
      summary: input?.summary?.trim() ?? 'Add project details here.',
      status: 'on-track',
      icon: input?.icon ?? createRandomProjectIcon(nextName),
      updatedAt: new Date().toISOString(),
      progress: 0,
      milestones: []
    }

    const nextProjects = [withComputedProjectState(nextProject), ...projects]
    const nextProjectIcons = { ...projectIcons, [nextProject.id]: nextProject.icon }
    void persistProjectData(nextProjects, nextProjectIcons)
    selectProject(nextProject.id)
    pushToast('success', 'Project created')
    return nextProject.id
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
    draft: { name: string; summary: string; icon: ProjectIconStyle }
  ): void => {
    const normalizedName = draft.name.trim()
    if (!normalizedName) {
      return
    }

    const nextProjects = projects.map((project) =>
      project.id === projectId
        ? {
            ...project,
            name: normalizedName,
            summary: draft.summary.trim(),
            icon: draft.icon,
            updatedAt: new Date().toISOString()
          }
        : project
    )
    const nextProjectIcons = { ...projectIcons, [projectId]: draft.icon }
    void persistProjectData(nextProjects, nextProjectIcons)
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

  const toggleProjectDone = (projectId: string): void => {
    const existing = projects.find((project) => project.id === projectId)
    if (!existing) {
      return
    }

    const derivedStatus = getProjectHealthSummary(
      { milestones: existing.milestones },
      todayIso
    ).status
    const nextStatus: ProjectStatus =
      existing.status === 'completed'
        ? derivedStatus === 'completed'
          ? 'on-track'
          : derivedStatus
        : 'completed'

    const nextProjects = projects.map((project) =>
      project.id === projectId
        ? withComputedProjectState({
            ...project,
            status: nextStatus,
            updatedAt: new Date().toISOString()
          })
        : project
    )

    void persistProjects(nextProjects)
    pushToast('success', nextStatus === 'completed' ? 'Project marked done' : 'Project reopened')
  }

  const addMilestoneToProject = (
    projectId: string,
    input: {
      title: string
      description?: string
      dueDate?: string
      priority?: TaskPriority
      status?: ProjectMilestone['status']
    }
  ): void => {
    const normalizedTitle = input.title.trim()
    const normalizedDueDate = input.dueDate?.trim() || undefined
    if (!normalizedTitle) {
      return
    }

    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestone: ProjectMilestone = {
        id: `milestone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: normalizedTitle,
        description: input.description?.trim() ?? '',
        collapsed: false,
        dueDate: normalizedDueDate,
        priority: input.priority ?? 'medium',
        status: input.status ?? 'pending',
        subtasks: []
      }

      return withComputedProjectState({
        ...project,
        milestones: [...project.milestones, nextMilestone],
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const renameProjectMilestone = (
    projectId: string,
    milestoneId: string,
    nextTitle: string
  ): void => {
    const normalizedTitle = nextTitle.trim()
    if (!normalizedTitle) {
      return
    }

    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) =>
        milestone.id === milestoneId ? { ...milestone, title: normalizedTitle } : milestone
      )

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const updateProjectMilestoneDueDate = (
    projectId: string,
    milestoneId: string,
    nextDueDate: string | undefined
  ): void => {
    const normalizedDueDate = nextDueDate?.trim() || undefined

    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) =>
        milestone.id === milestoneId ? { ...milestone, dueDate: normalizedDueDate } : milestone
      )

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const rescheduleProjectMilestoneFromCalendar = (
    projectId: string,
    milestoneId: string,
    nextDueDate: string
  ): void => {
    updateProjectMilestoneDueDate(projectId, milestoneId, nextDueDate)
    setSelectedCalendarDate(nextDueDate)
  }

  const updateProjectMilestoneDescription = (
    projectId: string,
    milestoneId: string,
    nextDescription: string
  ): void => {
    const normalizedDescription = nextDescription.trim()

    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) =>
        milestone.id === milestoneId
          ? { ...milestone, description: normalizedDescription }
          : milestone
      )

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const saveProjectMilestone = (
    projectId: string,
    milestoneId: string,
    draft: {
      title: string
      description: string
      dueDate: string
      status: 'pending' | 'blocked' | 'completed'
      priority: '' | TaskPriority
    }
  ): void => {
    const normalizedTitle = draft.title.trim()
    if (!normalizedTitle) {
      return
    }

    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) =>
        milestone.id === milestoneId
          ? {
              ...milestone,
              title: normalizedTitle,
              description: draft.description.trim(),
              dueDate: draft.dueDate || undefined,
              status: draft.status,
              priority: draft.priority || undefined
            }
          : milestone
      )

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const updateProjectMilestoneStatus = (
    projectId: string,
    milestoneId: string,
    nextStatus: ProjectMilestone['status']
  ): void => {
    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) =>
        milestone.id === milestoneId ? { ...milestone, status: nextStatus } : milestone
      )

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const updateProjectMilestonePriority = (
    projectId: string,
    milestoneId: string,
    nextPriority: TaskPriority | undefined
  ): void => {
    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) =>
        milestone.id === milestoneId ? { ...milestone, priority: nextPriority } : milestone
      )

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const removeProjectMilestone = (projectId: string, milestoneId: string): void => {
    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.filter((milestone) => milestone.id !== milestoneId)

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const addSubtaskToMilestone = (
    projectId: string,
    milestoneId: string,
    input: {
      title: string
      description?: string
      dueDate?: string
      completed?: boolean
      priority?: TaskPriority
    }
  ): void => {
    const normalizedTitle = input.title.trim()
    if (!normalizedTitle) {
      return
    }

    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) =>
        milestone.id === milestoneId
          ? {
              ...milestone,
              subtasks: [
                ...milestone.subtasks,
                {
                  id: `subtask-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  title: normalizedTitle,
                  description: input.description?.trim() ?? '',
                  completed: Boolean(input.completed),
                  priority: input.priority ?? 'medium',
                  createdAt: new Date().toISOString(),
                  dueDate: input.dueDate?.trim() || undefined
                } satisfies ProjectSubtask
              ]
            }
          : milestone
      )

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const toggleMilestoneSubtask = (
    projectId: string,
    milestoneId: string,
    subtaskId: string
  ): void => {
    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) =>
        milestone.id === milestoneId
          ? {
              ...milestone,
              subtasks: milestone.subtasks.map((subtask) =>
                subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask
              )
            }
          : milestone
      )

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const renameMilestoneSubtask = (
    projectId: string,
    milestoneId: string,
    subtaskId: string,
    nextTitle: string
  ): void => {
    const normalizedTitle = nextTitle.trim()
    if (!normalizedTitle) {
      return
    }

    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) =>
        milestone.id === milestoneId
          ? {
              ...milestone,
              subtasks: milestone.subtasks.map((subtask) =>
                subtask.id === subtaskId ? { ...subtask, title: normalizedTitle } : subtask
              )
            }
          : milestone
      )

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const updateMilestoneSubtaskDescription = (
    projectId: string,
    milestoneId: string,
    subtaskId: string,
    nextDescription: string
  ): void => {
    const normalizedDescription = nextDescription.trim()

    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) =>
        milestone.id === milestoneId
          ? {
              ...milestone,
              subtasks: milestone.subtasks.map((subtask) =>
                subtask.id === subtaskId
                  ? { ...subtask, description: normalizedDescription }
                  : subtask
              )
            }
          : milestone
      )

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const saveMilestoneSubtask = (
    projectId: string,
    milestoneId: string,
    subtaskId: string,
    draft: {
      title: string
      description: string
      dueDate: string
      completed: boolean
      priority: '' | TaskPriority
    }
  ): void => {
    const normalizedTitle = draft.title.trim()
    if (!normalizedTitle) {
      return
    }

    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) =>
        milestone.id === milestoneId
          ? {
              ...milestone,
              subtasks: milestone.subtasks.map((subtask) =>
                subtask.id === subtaskId
                  ? {
                      ...subtask,
                      title: normalizedTitle,
                      description: draft.description.trim(),
                      dueDate: draft.dueDate || undefined,
                      completed: draft.completed,
                      priority: draft.priority || undefined
                    }
                  : subtask
              )
            }
          : milestone
      )

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const updateMilestoneSubtaskDueDate = (
    projectId: string,
    milestoneId: string,
    subtaskId: string,
    nextDueDate: string | undefined
  ): void => {
    const normalizedDueDate = nextDueDate?.trim() || undefined
    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) =>
        milestone.id === milestoneId
          ? {
              ...milestone,
              subtasks: milestone.subtasks.map((subtask) =>
                subtask.id === subtaskId ? { ...subtask, dueDate: normalizedDueDate } : subtask
              )
            }
          : milestone
      )

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const updateMilestoneSubtaskPriority = (
    projectId: string,
    milestoneId: string,
    subtaskId: string,
    nextPriority: TaskPriority | undefined
  ): void => {
    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) =>
        milestone.id === milestoneId
          ? {
              ...milestone,
              subtasks: milestone.subtasks.map((subtask) =>
                subtask.id === subtaskId ? { ...subtask, priority: nextPriority } : subtask
              )
            }
          : milestone
      )

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const removeMilestoneSubtask = (
    projectId: string,
    milestoneId: string,
    subtaskId: string
  ): void => {
    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) =>
        milestone.id === milestoneId
          ? {
              ...milestone,
              subtasks: milestone.subtasks.filter((subtask) => subtask.id !== subtaskId)
            }
          : milestone
      )

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const removeProjectById = async (projectId: string): Promise<void> => {
    if (!vaultApi) {
      return
    }

    const project = projects.find((item) => item.id === projectId)
    if (!project) {
      return
    }

    const confirmed = window.confirm(
      `Remove project "${project.name}" from this workspace? Tagged notes will stay in the vault. Use Undo to restore.`
    )
    if (!confirmed) {
      return
    }

    const nextProjects = projects.filter((item) => item.id !== projectId)
    const nextSelectedProject =
      nextProjects.find((item) => item.id === selectedProjectId) ?? nextProjects[0] ?? null
    const nextProjectIcons = { ...projectIcons }
    delete nextProjectIcons[projectId]
    const nextFavoriteProjectIds = favoriteProjectIds.filter((id) => id !== projectId)
    const nextSelectedProjectId =
      selectedProjectId === projectId ? (nextSelectedProject?.id ?? null) : selectedProjectId
    const nextLastOpenedProjectId =
      lastOpenedProjectId === projectId ? nextSelectedProjectId : lastOpenedProjectId

    try {
      const nextSettings = await vaultApi.settings.update({
        projects: nextProjects,
        projectIcons: nextProjectIcons,
        favoriteProjectIds: nextFavoriteProjectIds,
        lastOpenedProjectId: nextLastOpenedProjectId
      })
      setSettings(nextSettings)
    } catch (error) {
      pushToast('error', String(error))
      return
    }

    if (selectedProjectId === projectId) {
      setSelectedProjectId(nextSelectedProjectId)
    }
    pushToast('success', 'Project removed')
  }

  const toggleProjectFavoriteById = (projectId: string): void => {
    const nextFavoriteProjectIds = favoriteProjectIds.includes(projectId)
      ? favoriteProjectIds.filter((currentProjectId) => currentProjectId !== projectId)
      : [projectId, ...favoriteProjectIds]
    void persistFavoriteProjectIds(nextFavoriteProjectIds)
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
      delete noteEditorSessionsRef.current[currentNotePathRef.current]
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
    persistLastOpenedNotePath,
    replaceNotes,
    resetCurrentNoteEditorSession,
    setCurrentExcalidrawPath,
    setCurrentNoteContent,
    setCurrentNotePath,
    setNoteTree,
    vaultApi
  ])

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

      try {
        const nextCurrentNotePath =
          kind === 'note'
            ? currentNotePath === relPath
              ? nextRelPath
              : currentNotePath
            : remapNestedPath(currentNotePath, relPath, nextRelPath)
        const nextCurrentExcalidrawPath =
          kind === 'excalidraw'
            ? currentExcalidrawPath === relPath
              ? nextRelPath
              : currentExcalidrawPath
            : remapNestedPath(currentExcalidrawPath, relPath, nextRelPath)

        if (kind === 'note') {
          const existingSession = noteEditorSessionsRef.current[relPath]
          if (existingSession) {
            noteEditorSessionsRef.current[nextRelPath] = existingSession
            delete noteEditorSessionsRef.current[relPath]
          }
          if (persistedNoteFingerprintsRef.current[relPath]) {
            persistedNoteFingerprintsRef.current[nextRelPath] =
              persistedNoteFingerprintsRef.current[relPath]
            delete persistedNoteFingerprintsRef.current[relPath]
          }
        } else {
          Object.entries(noteEditorSessionsRef.current).forEach(([path, session]) => {
            const remappedPath = remapNestedPath(path, relPath, nextRelPath)
            if (remappedPath && remappedPath !== path) {
              noteEditorSessionsRef.current[remappedPath] = session
              delete noteEditorSessionsRef.current[path]
            }
          })
          Object.entries(persistedNoteFingerprintsRef.current).forEach(([path, fingerprint]) => {
            const remappedPath = remapNestedPath(path, relPath, nextRelPath)
            if (remappedPath && remappedPath !== path) {
              persistedNoteFingerprintsRef.current[remappedPath] = fingerprint
              delete persistedNoteFingerprintsRef.current[path]
            }
          })
        }

        if (nextCurrentNotePath !== currentNotePath) {
          currentNotePathRef.current = nextCurrentNotePath
        }
        if (nextCurrentExcalidrawPath !== currentExcalidrawPath) {
          currentExcalidrawPathRef.current = nextCurrentExcalidrawPath
        }

        await vaultApi.files.renamePath(relPath, nextRelPath)
        await refreshNotesAndTree()
        setSelectedNoteTreeEntries([{ kind, relPath: nextRelPath }])
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

        const shouldClearCurrent = normalizedEntries.some((entry) =>
          entry.kind === 'note'
            ? currentNotePath === entry.relPath
            : entry.kind === 'excalidraw'
              ? currentExcalidrawPath === entry.relPath
              : isNestedPath(currentNotePath, entry.relPath) ||
                isNestedPath(currentExcalidrawPath, entry.relPath)
        )

        Object.keys(noteEditorSessionsRef.current).forEach((path) => {
          const shouldDeleteSession = normalizedEntries.some((entry) =>
            entry.kind === 'note' ? path === entry.relPath : isNestedPath(path, entry.relPath)
          )
          if (shouldDeleteSession) {
            delete noteEditorSessionsRef.current[path]
          }
        })
        Object.keys(persistedNoteFingerprintsRef.current).forEach((path) => {
          const shouldDeleteFingerprint = normalizedEntries.some((entry) =>
            entry.kind === 'note' ? path === entry.relPath : isNestedPath(path, entry.relPath)
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
      currentExcalidrawPath,
      currentNotePath,
      favoriteNotePaths,
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

      let nextCurrentNotePath = currentNotePath
      let nextCurrentExcalidrawPath = currentExcalidrawPath

      for (const operation of moveOperations) {
        nextCurrentNotePath =
          operation.kind === 'note'
            ? nextCurrentNotePath === operation.relPath
              ? operation.toRelPath
              : nextCurrentNotePath
            : remapNestedPath(nextCurrentNotePath, operation.relPath, operation.toRelPath)
        nextCurrentExcalidrawPath =
          operation.kind === 'excalidraw'
            ? nextCurrentExcalidrawPath === operation.relPath
              ? operation.toRelPath
              : nextCurrentExcalidrawPath
            : remapNestedPath(nextCurrentExcalidrawPath, operation.relPath, operation.toRelPath)

        if (operation.kind === 'note') {
          const existingSession = noteEditorSessionsRef.current[operation.relPath]
          if (existingSession) {
            noteEditorSessionsRef.current[operation.toRelPath] = existingSession
            delete noteEditorSessionsRef.current[operation.relPath]
          }
          if (persistedNoteFingerprintsRef.current[operation.relPath]) {
            persistedNoteFingerprintsRef.current[operation.toRelPath] =
              persistedNoteFingerprintsRef.current[operation.relPath]
            delete persistedNoteFingerprintsRef.current[operation.relPath]
          }
        } else {
          Object.entries(noteEditorSessionsRef.current).forEach(([path, session]) => {
            const remappedPath = remapNestedPath(path, operation.relPath, operation.toRelPath)
            if (remappedPath && remappedPath !== path) {
              noteEditorSessionsRef.current[remappedPath] = session
              delete noteEditorSessionsRef.current[path]
            }
          })
          Object.entries(persistedNoteFingerprintsRef.current).forEach(([path, fingerprint]) => {
            const remappedPath = remapNestedPath(path, operation.relPath, operation.toRelPath)
            if (remappedPath && remappedPath !== path) {
              persistedNoteFingerprintsRef.current[remappedPath] = fingerprint
              delete persistedNoteFingerprintsRef.current[path]
            }
          })
        }
      }

      if (nextCurrentNotePath !== currentNotePath) {
        currentNotePathRef.current = nextCurrentNotePath
      }
      if (nextCurrentExcalidrawPath !== currentExcalidrawPath) {
        currentExcalidrawPathRef.current = nextCurrentExcalidrawPath
      }

      for (const operation of moveOperations) {
        await vaultApi.files.renamePath(operation.relPath, operation.toRelPath)
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

  const isStandalonePage =
    activePage === 'schedules' || activePage === 'scheduleDocs' || activePage === 'agentHistory'
  const paletteSurfaceClass = 'transition-[filter,opacity] duration-200 ease-out'
  const paletteBlurClass =
    commandPaletteOpen && !performanceModeEnabled ? ' search-palette-surface-blur' : ''
  const headerPageLabel =
    hasVault && activePage === 'subscriptions'
      ? 'Finance'
      : hasVault
        ? PAGE_LABELS[activePage]
        : 'Vault'
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
    <div className="flex h-screen" data-performance-mode={performanceModeEnabled ? 'on' : 'off'}>
      <SidebarProvider
        className="h-full"
        style={shellAccentStyle}
        data-focus-mode={isFocusMode ? 'true' : 'false'}
        open={isFocusMode ? false : isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
      >
        <AppSidebar
          activePage={activePage}
          onChange={handleSidebarPageChange}
          onOpenSearchPalette={handleOpenSearchPalette}
          onSidebarInteract={handleSidebarInteract}
          notesCount={notes.length}
          projectsCount={projects.length}
          calendarUndoneCount={calendarUndoneCount}
          profileName={profileName}
          activeVaultPath={vault?.rootPath ?? null}
          isLocked={!hasVault}
          availablePages={availablePages}
          className={`${paletteSurfaceClass}${paletteBlurClass}`}
          collapsible={isFocusMode ? 'offcanvas' : 'icon'}
        />

        <SidebarInset
          data-workspace-vibrancy={performanceModeEnabled ? 'off' : 'on'}
          data-performance-mode={performanceModeEnabled ? 'on' : 'off'}
          className="!min-h-0 overflow-hidden text-[var(--text)] antialiased [font-family:var(--app-font-family)]"
        >
          <div className="workspace-vibrancy-scope flex h-full min-w-0">
            {hasVault && activePage === 'schedules' ? (
              <SchedulesPage
                vaultApi={vaultApi}
                pushToast={pushToast}
                isRightPanelCollapsed={isRightPanelCollapsed}
                onOpenDocumentation={() => {
                  void navigateToPage('scheduleDocs')
                }}
              />
            ) : null}
            {hasVault && activePage === 'scheduleDocs' ? (
              <ScheduleDocumentationPage
                onBack={() => {
                  void navigateToPage('schedules')
                }}
                onDownload={() => {
                  void downloadScheduleDocumentation()
                }}
              />
            ) : null}
            {hasVault && activePage === 'agentHistory' ? (
              <AgentHistoryPage
                vaultApi={vaultApi}
                pushToast={pushToast}
                notes={notes}
                projects={projects}
                isRightPanelCollapsed={isRightPanelCollapsed}
              />
            ) : null}
            <>
              <DocumentWorkspaceMain
                className={`${isStandalonePage ? 'hidden ' : ''}${currentExcalidrawPath ? 'excalidraw-workspace-main ' : ''}${paletteSurfaceClass}${paletteBlurClass}`.trim()}
              >
                <DocumentWorkspaceMainHeader
                  breadcrumb={
                    activePage === 'projects' ? (
                      <span className="workspace-page-title">Projects</span>
                    ) : activePage === 'calendar' ? (
                      <span className="workspace-page-title">Calendar</span>
                    ) : (
                      <Breadcrumb>
                        <BreadcrumbList className="text-[var(--muted)]">
                          <BreadcrumbItem>
                            <BreadcrumbPage className="text-sm text-[var(--muted)]">
                              {headerPageLabel}
                            </BreadcrumbPage>
                          </BreadcrumbItem>
                          {noteHeaderBreadcrumbSegments ? (
                            noteHeaderBreadcrumbSegments.map((segment, index) => {
                              const isLast = index === noteHeaderBreadcrumbSegments.length - 1

                              return (
                                <Fragment key={`${segment}:${index}`}>
                                  <BreadcrumbSeparator className="text-[var(--line-strong)]" />
                                  <BreadcrumbItem>
                                    <BreadcrumbPage
                                      className={
                                        isLast
                                          ? 'max-w-[220px] truncate text-sm font-semibold text-[var(--text)]'
                                          : 'max-w-[140px] truncate text-sm text-[var(--muted)]'
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
                              <BreadcrumbSeparator className="text-[var(--line-strong)]" />
                              <BreadcrumbItem>
                                <BreadcrumbPage className="max-w-[320px] truncate text-sm font-semibold text-[var(--text)]">
                                  {middleHeaderBreadcrumbItem}
                                </BreadcrumbPage>
                              </BreadcrumbItem>
                            </>
                          ) : null}
                        </BreadcrumbList>
                      </Breadcrumb>
                    )
                  }
                  actions={
                    noteIsOpen && activePage === 'notes' && !searchQuery.trim() ? (
                      <WorkspaceHeaderActions>
                        <WorkspaceHeaderActionGroup>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <WorkspaceActionButton
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
                                    <span className="max-w-full truncate text-xs text-[var(--muted)]">
                                      {stripNoteExtension(note.relPath)}
                                    </span>
                                  </DropdownMenuItem>
                                ))
                              ) : (
                                <DropdownMenuItem disabled>No backlinks yet</DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <WorkspaceActionButton
                            onClick={() => {
                              void copyCurrentNoteMarkdown()
                            }}
                            title="Copy Raw Markdown"
                            aria-label="Copy Raw Markdown"
                            icon={<Copy size={18} />}
                          />
                          <WorkspaceActionButton
                            onClick={() => {
                              setIsNoteExportDialogOpen(true)
                            }}
                            title="Export Note"
                            aria-label="Export Note"
                            icon={<Download size={18} />}
                          />
                        </WorkspaceHeaderActionGroup>
                        <WorkspaceHeaderActionDivider />
                        <WorkspaceHeaderActionGroup>
                          <WorkspaceActionButton
                            onClick={toggleCurrentNoteFavorite}
                            title={
                              currentNoteIsFavorite ? 'Remove from Favorites' : 'Add to Favorites'
                            }
                            className={
                              currentNoteIsFavorite
                                ? 'border-amber-400/40 bg-amber-500/12 text-amber-500 hover:text-amber-400'
                                : 'hover:border-amber-400/40 hover:bg-amber-500/10 hover:text-amber-500'
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
                          <WorkspaceActionButton
                            onClick={() => {
                              void deleteCurrentNote()
                            }}
                            title="Delete Note"
                            icon={<Trash2 size={18} />}
                          />
                        </WorkspaceHeaderActionGroup>
                      </WorkspaceHeaderActions>
                    ) : activePage === 'knowledge' ? (
                      <WorkspaceHeaderActions>
                        <WorkspaceHeaderActionGroup>
                          <Popover>
                            <PopoverTrigger asChild>
                              <WorkspaceActionButton
                                title="Open graph editor"
                                aria-label="Open graph editor"
                                icon={<SlidersHorizontal size={18} />}
                                data-testid="knowledge-graph-editor-trigger"
                              />
                            </PopoverTrigger>
                            <PopoverContent
                              align="end"
                              className="w-80 border border-[var(--line)] bg-[var(--panel)] p-4 text-[var(--text)] shadow-xl"
                            >
                              <div className="space-y-1">
                                <h2 className="text-sm font-semibold text-[var(--text)]">
                                  Graph editor
                                </h2>
                                <p className="text-xs text-[var(--muted)]">
                                  Configure the orphan ring radius in pixels. Leave blank to use the
                                  automatic canvas radius.
                                </p>
                              </div>
                              <div className="mt-4 space-y-2">
                                <label
                                  htmlFor="knowledge-orphan-radius-input"
                                  className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]"
                                >
                                  Orphan ring radius
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
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
                                    className="w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                                    aria-label="Orphan ring radius in pixels"
                                  />
                                  <span className="text-xs text-[var(--muted)]">px</span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs text-[var(--muted)]">
                                    Applied radius:{' '}
                                    {knowledgeOrphanRingRadiusPx == null
                                      ? 'Auto'
                                      : `${knowledgeOrphanRingRadiusPx}px`}
                                  </p>
                                  <button
                                    type="button"
                                    className="rounded-md border border-[var(--line)] px-2 py-1 text-xs text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                                    onClick={() => {
                                      setKnowledgeOrphanRingRadiusInput('')
                                    }}
                                  >
                                    Reset
                                  </button>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </WorkspaceHeaderActionGroup>
                      </WorkspaceHeaderActions>
                    ) : activePage === 'projects' ? (
                      <WorkspaceHeaderActions>
                        <WorkspaceHeaderActionGroup>
                          {projectsWorkspaceTab === 'taskList' ? (
                            <WorkspaceActionButton
                              onClick={() => {
                                setProjectTaskListCollapseAllRequest({
                                  token: Date.now(),
                                  collapsed: !areProjectTaskListGroupsCollapsed
                                })
                              }}
                              icon={
                                areProjectTaskListGroupsCollapsed ? (
                                  <ChevronDown size={16} />
                                ) : (
                                  <ChevronUp size={16} />
                                )
                              }
                              aria-label={
                                areProjectTaskListGroupsCollapsed
                                  ? 'Expand all groups'
                                  : 'Collapse all groups'
                              }
                              title={
                                areProjectTaskListGroupsCollapsed
                                  ? 'Expand all groups'
                                  : 'Collapse all groups'
                              }
                            />
                          ) : null}
                          <WorkspaceActionButton
                            onClick={() => {
                              setNewProjectRequest({ token: Date.now() })
                            }}
                            icon={<Plus size={16} />}
                            label="New Project"
                            aria-label="New Project"
                            title="New Project"
                          />
                        </WorkspaceHeaderActionGroup>
                        <WorkspaceHeaderActionDivider />
                        <WorkspaceHeaderActionGroup>
                          <TabMenu
                            variant="toolbar"
                            value={projectsWorkspaceTab}
                            onValueChange={(value) =>
                              setProjectsWorkspaceTab(value as ProjectsWorkspaceTab)
                            }
                            fullWidth={false}
                            withSpacer={false}
                            trailingAccessory={
                              <Shortcut
                                keys={['option', 'tab']}
                                data-testid="workspace-shortcut:projects-view-toggle"
                                className="shrink-0"
                              />
                            }
                          >
                            <TabMenuItem variant="toolbar" value="board">
                              <span className="inline-flex items-center gap-2">
                                <LayoutGrid size={15} className="shrink-0" aria-hidden="true" />
                                Project Board
                              </span>
                            </TabMenuItem>
                            <TabMenuItem variant="toolbar" value="taskList">
                              <span className="inline-flex items-center gap-2">
                                <ListTodo size={15} className="shrink-0" aria-hidden="true" />
                                Task List
                              </span>
                            </TabMenuItem>
                          </TabMenu>
                        </WorkspaceHeaderActionGroup>
                      </WorkspaceHeaderActions>
                    ) : activePage === 'calendar' ? (
                      <WorkspaceHeaderActions>
                        <WorkspaceHeaderActionGroup>
                          <TabMenu
                            variant="toolbar"
                            value={calendarViewMode}
                            onValueChange={(value) =>
                              setCalendarViewMode(value as CalendarViewMode)
                            }
                            fullWidth={false}
                            withSpacer={false}
                            trailingAccessory={
                              <Shortcut
                                keys={['option', 'tab']}
                                data-testid="workspace-shortcut:calendar-view-toggle"
                                className="shrink-0"
                              />
                            }
                          >
                            {CALENDAR_VIEW_MODE_OPTIONS.map((option) => (
                              <TabMenuItem
                                key={option.value}
                                variant="toolbar"
                                value={option.value}
                              >
                                <span className="inline-flex items-center gap-2">
                                  {option.value === 'month' ? (
                                    <LayoutGrid size={15} className="shrink-0" aria-hidden="true" />
                                  ) : (
                                    <CalendarDays
                                      size={15}
                                      className="shrink-0"
                                      aria-hidden="true"
                                    />
                                  )}
                                  {option.label}
                                </span>
                              </TabMenuItem>
                            ))}
                          </TabMenu>
                        </WorkspaceHeaderActionGroup>
                      </WorkspaceHeaderActions>
                    ) : activePage === 'weeklyPlan' && selectedWeeklyPlanWeek ? (
                      <WorkspaceHeaderActions>
                        <WorkspaceHeaderActionGroup>
                          <WorkspaceActionButton
                            onClick={() => {
                              void handleDeleteSelectedWeeklyPlanWeek()
                            }}
                            title="Delete week"
                            icon={<Trash2 size={18} />}
                          />
                        </WorkspaceHeaderActionGroup>
                      </WorkspaceHeaderActions>
                    ) : null
                  }
                />

                <DocumentWorkspaceMainContent
                  className={
                    activePage === 'calendar' ? 'overflow-y-auto overflow-x-hidden' : undefined
                  }
                >
                  <div
                    key={activePage}
                    className={`${
                      activePage === 'notes' ? '' : 'page-transition '
                    }w-full ${activePage === 'calendar' ? '' : 'h-full'}`.trim()}
                  >
                    {!hasVault ? (
                      <VaultSelectionPage
                        lastVaultPath={lastVaultPath}
                        platformKind={platform.kind}
                        supportsVaultPicker={platform.capabilities.supportsVaultPicker}
                        onManageVaults={openVaultSwapper}
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
                        <div className="p-5 text-sm text-[var(--muted)]">
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
                        favoriteProjectIds={favoriteProjectIds}
                        selectedProjectId={selectedProjectId}
                        activeTab={projectsWorkspaceTab}
                        filterMode={projectFilterMode}
                        newProjectRequest={newProjectRequest}
                        newSubtaskRequest={newSubtaskRequest}
                        taskListCollapseAllRequest={projectTaskListCollapseAllRequest}
                        projectDrawerRequest={projectDrawerRequest}
                        focusedMilestoneTarget={focusedMilestoneTarget}
                        onFilterModeChange={setProjectFilterMode}
                        onTaskListCollapseStateChange={setAreProjectTaskListGroupsCollapsed}
                        onMilestoneContextChange={setProjectsWorkspaceMilestoneContext}
                        onActiveTabChange={setProjectsWorkspaceTab}
                        onSelectProject={selectProject}
                        onCreateProject={createProject}
                        onRenameProject={renameProject}
                        onUpdateProjectSummary={updateProjectSummary}
                        onUpdateProjectIcon={updateProjectIcon}
                        onToggleProjectDone={toggleProjectDone}
                        onToggleProjectFavorite={toggleProjectFavoriteById}
                        onOpenProjectFolder={openProjectFolder}
                        onExportProject={exportProject}
                        onDeleteProject={removeProjectById}
                        onAddMilestone={addMilestoneToProject}
                        onRenameMilestone={renameProjectMilestone}
                        onUpdateMilestoneDescription={updateProjectMilestoneDescription}
                        onUpdateMilestoneDueDate={updateProjectMilestoneDueDate}
                        onUpdateMilestoneStatus={updateProjectMilestoneStatus}
                        onUpdateMilestonePriority={updateProjectMilestonePriority}
                        onRemoveMilestone={removeProjectMilestone}
                        onAddSubtask={addSubtaskToMilestone}
                        onToggleSubtask={toggleMilestoneSubtask}
                        onRenameSubtask={renameMilestoneSubtask}
                        onUpdateSubtaskDescription={updateMilestoneSubtaskDescription}
                        onUpdateSubtaskDueDate={updateMilestoneSubtaskDueDate}
                        onUpdateSubtaskPriority={updateMilestoneSubtaskPriority}
                        onRemoveSubtask={removeMilestoneSubtask}
                        onSaveProject={saveProject}
                        onSaveMilestone={saveProjectMilestone}
                        onSaveSubtask={saveMilestoneSubtask}
                      />
                    ) : activePage === 'subscriptions' ? (
                      <SubscriptionsPage vaultApi={vaultApi} pushToast={pushToast} />
                    ) : activePage === 'weeklyPlan' ? (
                      <WeeklyPlanWorkspace
                        state={weeklyPlanState}
                        loading={weeklyPlanLoading}
                        selectedWeekId={selectedWeeklyPlanWeekId}
                        isReady={weeklyPlanReady}
                        onUpdateWeek={(input) => updateWeek(input)}
                        onAddPriority={(input) => addPriority(input)}
                        onUpdatePriority={(input) => updatePriority(input)}
                        onDeletePriority={(priorityId) => deletePriority(priorityId)}
                        onReorderPriorities={(input) => reorderPriorities(input)}
                        onUpsertReview={(input) => upsertReview(input)}
                      />
                    ) : activePage === 'calendar' ? (
                      <div className="workspace-page-padding calendar-full flex min-h-full flex-col">
                        <section
                          data-testid={
                            calendarViewMode === 'week'
                              ? 'calendar-week-shell'
                              : 'calendar-month-shell'
                          }
                          className="workspace-table-row-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--line)]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] px-4 py-3">
                            <div className="min-w-0 flex flex-1 items-center gap-4">
                              <div className="overflow-hidden rounded-lg border-2 border-[#d32f2f] shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
                                <div className="flex h-6 items-center justify-center bg-[#d32f2f] px-3 text-center text-[13px] font-extrabold text-white">
                                  {calendarTodayHeader.monthShort}
                                </div>
                                <div className="flex h-6 items-center justify-center border-t-2 border-[color:rgba(217,90,78,0.28)] px-3 text-center">
                                  <span className="block text-lg font-medium leading-none text-[var(--text)]">
                                    {calendarTodayHeader.dayNumber}
                                  </span>
                                </div>
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-lg font-semibold text-[var(--text)]">
                                  {calendarCurrentPeriodTitle}
                                </p>
                                <p className="truncate text-sm text-[var(--muted)]">
                                  {calendarCurrentPeriodSubtitle}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-3">
                              <TabMenu
                                variant="toolbar"
                                value={calendarContentFilter}
                                onValueChange={(value) =>
                                  setCalendarContentFilter(value as CalendarContentFilter)
                                }
                                fullWidth={false}
                                withSpacer={false}
                              >
                                {calendarContentFilterOptions.map((option) => (
                                  <TabMenuItem
                                    key={option.value}
                                    variant="toolbar"
                                    value={option.value}
                                  >
                                    <span className="inline-flex items-center gap-2">
                                      <span>{option.label}</span>
                                      <TabMenuCountBadge count={option.count} />
                                    </span>
                                  </TabMenuItem>
                                ))}
                              </TabMenu>
                              <div className="workspace-subtle-surface flex items-center gap-0 overflow-hidden rounded-lg p-0">
                                <WorkspaceActionButton
                                  onClick={goToPrevCalendarPeriod}
                                  title={
                                    calendarViewMode === 'week' ? 'Previous week' : 'Previous month'
                                  }
                                  className="rounded-none border-y-0 border-l-0 border-r border-[var(--line)] hover:bg-[var(--accent-soft)]"
                                  icon={<ChevronLeft size={18} />}
                                />
                                <WorkspaceActionButton
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
                                  className="rounded-none border-0 hover:bg-[var(--accent-soft)]"
                                  icon={<CalendarDays size={18} />}
                                  label={
                                    calendarViewMode === 'week' ? 'Current week' : 'Current month'
                                  }
                                />
                                <WorkspaceActionButton
                                  onClick={goToNextCalendarPeriod}
                                  title={calendarViewMode === 'week' ? 'Next week' : 'Next month'}
                                  className="rounded-none border-y-0 border-r-0 border-l border-[var(--line)] hover:bg-[var(--accent-soft)]"
                                  icon={<ChevronRight size={18} />}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="min-h-0 flex-1">
                            {calendarViewMode === 'week' ? (
                              <CalendarWeekView
                                selectedDate={selectedCalendarDate}
                                tasks={visibleCalendarTasks}
                                milestoneEvents={visibleMilestoneCalendarEvents}
                                onSelectDate={setSelectedCalendarDate}
                                onOpenMilestone={openMilestoneFromCalendar}
                                onCreateTask={createTaskForWeeklyTime}
                                onRescheduleTask={(taskId, newDate) => {
                                  void rescheduleCalendarTask(taskId, newDate)
                                }}
                                onToggleTask={(taskId) => {
                                  void toggleCalendarTask(taskId)
                                }}
                                onDeleteTask={(taskId) => {
                                  void removeCalendarTask(taskId)
                                }}
                                onRenameTask={(taskId, newTitle) => {
                                  void renameCalendarTask(taskId, newTitle)
                                }}
                                onUpdateTaskPriority={(taskId, priority) => {
                                  void updateCalendarTaskPriority(taskId, priority)
                                }}
                                onUpdateTaskType={(taskId, taskType) => {
                                  void updateCalendarTaskType(taskId, taskType)
                                }}
                                onUpdateTaskSchedule={(taskId, schedule) => {
                                  void updateCalendarTaskSchedule(taskId, schedule)
                                }}
                              />
                            ) : (
                              <CalendarMonthView
                                selectedDate={selectedCalendarDate}
                                tasks={visibleScheduledCalendarTasks}
                                milestoneEvents={visibleMilestoneCalendarEvents}
                                onSelectDate={setSelectedCalendarDate}
                                onCreateTask={createTaskForDate}
                                onOpenMilestone={openMilestoneFromCalendar}
                                onRescheduleMilestone={rescheduleProjectMilestoneFromCalendar}
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
                                onRenameTask={(taskId, newTitle) => {
                                  void renameCalendarTask(taskId, newTitle)
                                }}
                                onUpdateTaskPriority={(taskId, priority) => {
                                  void updateCalendarTaskPriority(taskId, priority)
                                }}
                                onUpdateTaskType={(taskId, taskType) => {
                                  void updateCalendarTaskType(taskId, taskType)
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
                    ) : activePage === 'settings' ? (
                      <SettingsPage
                        profileName={profileName}
                        mistralApiKey={mistralApiKey}
                        fontOptions={FONT_OPTIONS}
                        selectedFontFamily={fontFamily}
                        profileColor={profileColor}
                        performanceModeEnabled={performanceModeEnabled}
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
                        onSelectFont={(fontFamily) => {
                          void updateFontFamily(fontFamily)
                        }}
                        onSelectProfileColor={(color) => {
                          void updateProfileColor(color)
                        }}
                        onTogglePerformanceMode={(enabled) => {
                          void updatePerformanceMode(enabled)
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
                      />
                    ) : (
                      <div className="p-5 text-sm text-[var(--muted)]">
                        {activePage} workspace ready. Notes remain fully functional.
                      </div>
                    )}
                  </div>
                </DocumentWorkspaceMainContent>
              </DocumentWorkspaceMain>

              <DocumentWorkspacePanel
                className={`${
                  !showWorkspacePanel || isStandalonePage ? 'hidden' : 'flex'
                } overflow-hidden border-l border-[var(--line)] transition-[transform,opacity,width,flex-basis] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  shouldSlideWorkspacePanelOut
                    ? 'pointer-events-none translate-x-full border-l-transparent opacity-0'
                    : 'translate-x-0 opacity-100'
                } ${paletteSurfaceClass}${paletteBlurClass}`}
                style={
                  shouldSlideWorkspacePanelOut ? { width: '0px', flexBasis: '0px' } : undefined
                }
              >
                {activePage === 'weeklyPlan' ? (
                  <WeeklyPlanSidebar
                    state={weeklyPlanState}
                    loading={weeklyPlanLoading}
                    selectedWeekId={selectedWeeklyPlanWeekId}
                    currentWeekId={weeklyPlanCurrentWeekId}
                    nextWeekStart={nextWeeklyPlanStart}
                    todayIso={todayIso}
                    isReady={weeklyPlanReady}
                    onSelectWeek={setSelectedWeeklyPlanWeekId}
                    onCreateWeek={(input) => handleCreateWeeklyPlanWeek(input)}
                  />
                ) : (
                  <div
                    key={shouldAnimateWorkspacePane ? `workspace-pane-${activePage}` : undefined}
                    className={`flex h-full flex-col${shouldAnimateWorkspacePane ? ' animate-workspace-pane' : ''}`}
                  >
                    <DocumentWorkspacePanelHeader
                      actions={
                        activePage === 'notes' ? (
                          <WorkspaceHeaderActions>
                            <WorkspaceHeaderActionGroup>
                              <WorkspaceActionButton
                                aria-label="Collapse all folders"
                                title="Collapse all folders"
                                icon={<ChevronUp size={18} aria-hidden="true" />}
                                onClick={() =>
                                  setCollapseAllNotesTreeToken((current) => current + 1)
                                }
                              />
                              {useNativeMenus ? (
                                <WorkspaceActionButton
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
                                    <WorkspaceActionButton
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
                            </WorkspaceHeaderActionGroup>
                          </WorkspaceHeaderActions>
                        ) : activePage === 'calendar' ? (
                          <WorkspaceHeaderActions>
                            <WorkspaceHeaderActionGroup>
                              <Popover
                                open={isCalendarBulkActionOpen}
                                onOpenChange={setIsCalendarBulkActionOpen}
                              >
                                <PopoverTrigger asChild>
                                  <WorkspaceActionButton
                                    title="Calendar bulk actions"
                                    aria-label="Calendar bulk actions"
                                    icon={<Target size={18} className="inline-block" />}
                                  />
                                </PopoverTrigger>
                                <PopoverContent
                                  align="start"
                                  className="w-64 border border-[var(--line)] bg-[var(--panel)] p-3 text-[var(--text)] shadow-xl"
                                >
                                  <div className="space-y-3">
                                    <label className="flex flex-col gap-1">
                                      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                                        Scope
                                      </span>
                                      <SelectionMenu
                                        value={calendarBulkScope}
                                        onValueChange={(value) =>
                                          setCalendarBulkScope(
                                            value as (typeof CALENDAR_BULK_SCOPE_OPTIONS)[number]['value']
                                          )
                                        }
                                        options={CALENDAR_BULK_SCOPE_SELECTION_OPTIONS}
                                        aria-label="Bulk action scope"
                                      />
                                    </label>
                                    <label className="flex flex-col gap-1">
                                      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                                        Task Type
                                      </span>
                                      <SelectionMenu
                                        value={calendarBulkTaskType}
                                        onValueChange={(value) =>
                                          setCalendarBulkTaskType(value as CalendarTaskType)
                                        }
                                        options={CALENDAR_TASK_TYPE_SELECTION_OPTIONS}
                                        aria-label="Bulk action task type"
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-sm font-medium hover:border-[var(--accent)]"
                                      onClick={() => {
                                        void reassignCalendarTaskTypeForScope(
                                          calendarBulkScope,
                                          calendarBulkTaskType
                                        )
                                      }}
                                    >
                                      Apply
                                    </button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </WorkspaceHeaderActionGroup>
                          </WorkspaceHeaderActions>
                        ) : activePage === 'settings' ? (
                          <WorkspaceActionButton
                            onClick={() => {
                              void updateFontFamily(FONT_OPTIONS[0].value)
                            }}
                            icon={<Type size={14} />}
                            label="Reset Font"
                          />
                        ) : null
                      }
                    />

                    <DocumentWorkspacePanelContent>
                      {activePage === 'notes' ? (
                        <NotesTreeView
                          tree={visibleNoteTree}
                          searchTerm={searchQuery}
                          activeNotePath={currentNotePath ?? currentExcalidrawPath}
                          selectedEntries={selectedNoteTreeEntries}
                          collapseAllToken={collapseAllNotesTreeToken}
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
                          onRenamePath={(relPath, nextName, kind) => {
                            void renameTreePath(relPath, nextName, kind)
                          }}
                          onDeleteEntries={(entries) => {
                            void deleteTreeEntries(entries)
                          }}
                          onMoveEntries={moveTreeEntries}
                        />
                      ) : activePage === 'calendar' ? (
                        <UnscheduledTaskList
                          tasks={unscheduledTasks}
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
                      ) : (
                        <SettingsRightPanelSections />
                      )}
                    </DocumentWorkspacePanelContent>
                  </div>
                )}
              </DocumentWorkspacePanel>
            </>
          </div>

          <SonnerBridge />
        </SidebarInset>
      </SidebarProvider>
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
          setProjectsWorkspaceTab('board')
          selectProject(projectId)
          setProjectDrawerRequest({
            projectId,
            token: Date.now()
          })
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
        onRunVaultMigration={() => {
          setCommandPaletteOpen(false)
          void runVaultMigration()
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

function VaultSelectionPage({
  lastVaultPath,
  platformKind,
  supportsVaultPicker,
  onManageVaults
}: {
  lastVaultPath: string | null
  platformKind: AppPlatformKind
  supportsVaultPicker: boolean
  onManageVaults: () => void
}): ReactElement {
  const isMobileShell = platformKind === 'mobile' || platformKind === 'web'

  return (
    <div data-testid="vault-required-page" className="flex h-full items-center justify-center p-8">
      <div className="max-w-2xl rounded-[28px] border border-[var(--line)] bg-[var(--panel)] px-8 py-9 text-center shadow-[0_24px_80px_rgba(7,5,18,0.12)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]">
          <FolderOpen size={26} />
        </div>
        <h2 className="mt-5 text-3xl font-semibold text-[var(--text)]">
          {supportsVaultPicker ? 'Select a vault first' : 'Workspace connection required'}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          {supportsVaultPicker
            ? 'Open an existing vault or create a new one before accessing notes, projects, calendar, and automation pages.'
            : 'This shell now runs outside Electron, but on-device workspace storage still needs a mobile implementation before notes and projects can open here.'}
        </p>
        {supportsVaultPicker ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              data-testid="vault-required-open"
              onClick={onManageVaults}
              className="rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] px-4 py-2.5 text-sm font-medium text-[var(--accent)] hover:border-[var(--accent)]"
            >
              Manage Vaults
            </button>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-[var(--accent-line)] bg-[var(--accent-soft)] px-4 py-3 text-left text-sm text-[var(--accent)]">
            {isMobileShell
              ? 'Mobile/web mode now shares the app shell and page system, but still needs a managed local workspace adapter.'
              : 'A platform workspace adapter must be connected before this build can open local data.'}
          </div>
        )}
        <div className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-3 text-left text-sm text-[var(--muted)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
            {supportsVaultPicker ? 'Last Known Vault' : 'Desktop Vault State'}
          </div>
          <div className="mt-2 break-words text-[var(--text)]">
            {lastVaultPath ??
              (supportsVaultPicker
                ? 'No previous vault remembered on this device.'
                : 'No desktop vault is available in this runtime.')}
          </div>
        </div>
      </div>
    </div>
  )
}

function getNextWeeklyPlanStart(weeks: WeeklyPlanWeek[]): string {
  if (!weeks.length) {
    return startOfWeekIso(new Date())
  }
  return startOfWeekIso(parseIsoDate(addIsoDays(weeks[weeks.length - 1]!.endDate, 1)))
}

function getCalendarScopeRange(
  scope: (typeof CALENDAR_BULK_SCOPE_OPTIONS)[number]['value'],
  selectedDate: string
): { start: string; end: string } {
  if (scope === 'day') {
    return { start: selectedDate, end: selectedDate }
  }

  if (scope === 'week') {
    const start = startOfWeekIso(parseIsoDate(selectedDate))
    return { start, end: addIsoDays(start, 6) }
  }

  const current = parseIsoDate(selectedDate)
  const monthStart = new Date(current.getFullYear(), current.getMonth(), 1)
  const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0)
  return {
    start: toIsoDate(monthStart),
    end: toIsoDate(monthEnd)
  }
}

function calendarTaskOverlapsRange(task: CalendarTask, start: string, end: string): boolean {
  if (!task.date) {
    return false
  }

  const taskEnd = task.endDate && task.endDate >= task.date ? task.endDate : task.date
  return task.date <= end && taskEnd >= start
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
