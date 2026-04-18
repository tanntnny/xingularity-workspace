import { Fragment, ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Download,
  Funnel,
  Keyboard,
  Paintbrush,
  Trash2,
  Plus,
  RotateCcw,
  Search,
  Type,
  Link2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Target,
  FolderOpen,
  ChevronUp,
  List,
  Star
} from 'lucide-react'
import {
  CalendarTask,
  CreateWeeklyPlanWeekInput,
  GridBoardState,
  GridTextStyle,
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
  TaskReminder,
  CalendarTaskType,
  WeeklyPlanWeek
} from '../../shared/types'
import {
  createRandomProjectIcon,
  PROJECT_ICON_COLORS,
  PROJECT_ICON_SHAPES,
  PROJECT_ICON_VARIANTS
} from '../../shared/projectIcons'
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
import { UnscheduledTaskList } from './components/UnscheduledTaskList'
import { CommandPalette, type CommandPaletteSearchResult } from './components/CommandPalette'
import { NoteShapeIcon } from './components/NoteShapeIcon'
import {
  NotePreviewList,
  type NoteFilterMode,
  type NoteSortDirection,
  type NoteSortField
} from './components/NotePreviewList'
import { NotesTreeView } from './components/NotesTreeView'
import type { NoteEditorHandle } from './components/Editor'
import {
  ProjectPreviewList,
  type ProjectFilterMode,
  type ProjectSortDirection,
  type ProjectSortField
} from './components/ProjectPreviewList'
import { SonnerBridge } from './components/SonnerBridge'
import { AppSidebar } from './components/AppSidebar'
import type { AppPage } from './components/AppSidebar'
import { SidebarProvider, SidebarInset } from './components/ui/sidebar'
import { Popover, PopoverContent, PopoverTrigger } from './components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
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
import { ToggleGroup, ToggleGroupItem } from './components/ui/toggle-group'
import { EditorPage } from './pages/EditorPage'
import { ProjectDetailsPage } from './pages/ProjectDetailsPage'
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
import { DashboardPage } from './pages/DashboardPage'
import { GridPage, type GridWorkspaceActions } from './pages/GridPage'
import { KnowledgePage } from './pages/KnowledgePage'
import { useVaultStore } from './state/store'
import { useWeeklyPlan } from './hooks/useWeeklyPlan'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from './components/ui/breadcrumb'
import { buildMilestoneCalendarEvents, normalizeCalendarTasks } from './lib/calendarTasks'
import { type NoteEditorSnapshot, type NoteEditorSessionSnapshot } from './lib/noteEditorSession'
import { createNoteSaveCoordinator } from './lib/noteSaveCoordinator'
import {
  computeProjectProgress,
  deriveMilestoneStatus,
  getProjectHealthSummary,
  toLocalIsoDate
} from './lib/projectStatus'
import {
  findWeekForDate,
  formatWeekRange,
  getSortedWeeks,
  getWeekPriorities
} from './lib/weeklyPlan'
import { shiftIsoMonthClamped } from './lib/calendarDate'
import { GRID_PAGE_ENABLED } from './lib/featureFlags'
import type { NoteOutlineItem } from './lib/noteOutline'
import { hideManagedProjectTree } from './lib/noteTreeVisibility'
import { canUseNativeMenus, getElementMenuPosition, showNativeMenu } from './lib/nativeMenu'

const PAGE_LABELS: Record<AppPage, string> = {
  dashboard: 'Dashboard',
  knowledge: 'Knowledge',
  notes: 'Notes',
  projects: 'Projects',
  subscriptions: 'Subscriptions',
  grid: 'Grid',
  weeklyPlan: 'Weekly Plan',
  calendar: 'Calendar',
  settings: 'Settings',
  schedules: 'Schedules',
  scheduleDocs: 'Schedule API Guide',
  agentHistory: 'Agent Chat'
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

const CALENDAR_TASK_TYPE_OPTIONS: Array<{ value: CalendarTaskType; label: string }> = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'review', label: 'Review' },
  { value: 'personal', label: 'Personal' },
  { value: 'other', label: 'Other' }
]

const CALENDAR_BULK_SCOPE_OPTIONS = [
  { value: 'day', label: 'This day' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' }
] as const

const NOTE_AUTOSAVE_DELAY_MS = 1200

type NotePanelView = 'cards' | 'tree'

type NoteTreeSelection = {
  kind: 'note' | 'folder'
  relPath: string
} | null

function App(): ReactElement {
  const vaultApi = (window as unknown as { vaultApi?: RendererVaultApi }).vaultApi
  const vault = useVaultStore((state) => state.vault)
  const notes = useVaultStore((state) => state.notes)
  const currentNotePath = useVaultStore((state) => state.currentNotePath)
  const currentNoteContent = useVaultStore((state) => state.currentNoteContent)
  const searchQuery = useVaultStore((state) => state.searchQuery)
  const searchResults = useVaultStore((state) => state.searchResults)
  const commandPaletteOpen = useVaultStore((state) => state.commandPaletteOpen)
  const settingsProjects = useVaultStore((state) => state.settings.projects)
  const gridBoardSettings = useVaultStore((state) => state.settings.gridBoard)
  const calendarTasks = useVaultStore((state) => state.settings.calendarTasks)
  const lastOpenedNotePath = useVaultStore((state) => state.settings.lastOpenedNotePath)
  const lastOpenedProjectId = useVaultStore((state) => state.settings.lastOpenedProjectId)
  const favoriteNotePathSettings = useVaultStore((state) => state.settings.favoriteNotePaths)
  const favoriteProjectIdSettings = useVaultStore((state) => state.settings.favoriteProjectIds)
  const fontFamily = useVaultStore((state) => state.settings.fontFamily)
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
  const pushToast = useVaultStore((state) => state.pushToast)
  const [activePage, setActivePage] = useState<AppPage>('notes')
  const useNativeMenus = canUseNativeMenus()
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => toIsoDate(new Date()))
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
  const [currentNoteOutline, setCurrentNoteOutline] = useState<NoteOutlineItem[]>([])
  const [currentNoteTagsState, setCurrentNoteTagsState] = useState<string[]>([])
  const [currentNoteEditorDraft, setCurrentNoteEditorDraft] = useState<string | null>(null)
  const [currentNoteEditorVersion, setCurrentNoteEditorVersion] = useState(0)
  const [noteTitleEditTarget, setNoteTitleEditTarget] = useState<{
    relPath: string
    token: number
  } | null>(null)
  const [jumpToNoteHeading, setJumpToNoteHeading] = useState<((blockId: string) => void) | null>(
    null
  )
  const [noteFilterMode, setNoteFilterMode] = useState<NoteFilterMode>('all')
  const [noteSortField, setNoteSortField] = useState<NoteSortField>('created')
  const [noteSortDirection, setNoteSortDirection] = useState<NoteSortDirection>('desc')
  const [notePanelView, setNotePanelView] = useState<NotePanelView>('tree')
  const [collapseAllNotesTreeToken, setCollapseAllNotesTreeToken] = useState(0)
  const [noteTree, setNoteTree] = useState<NoteTreeNode[]>([])
  const [selectedNoteTreeEntry, setSelectedNoteTreeEntry] = useState<NoteTreeSelection>(null)
  const [pendingNoteTreeEditId, setPendingNoteTreeEditId] = useState<string | null>(null)
  const handlePendingNoteTreeEditHandled = useCallback((): void => {
    setPendingNoteTreeEditId(null)
  }, [])
  const visibleNoteTree = useMemo(() => hideManagedProjectTree(noteTree), [noteTree])
  const projects = settingsProjects
  const hasVault = Boolean(vault?.rootPath)
  const gridBoard = useMemo(
    () => sanitizeGridBoardState(gridBoardSettings, notes, projects),
    [gridBoardSettings, notes, projects]
  )
  const [gridBoardDraft, setGridBoardDraft] = useState<GridBoardState>(gridBoard)
  const [gridWorkspaceActions, setGridWorkspaceActions] = useState<GridWorkspaceActions | null>(
    null
  )
  const [isGridAddPopoverOpen, setIsGridAddPopoverOpen] = useState(false)
  const [gridAddMode, setGridAddMode] = useState<'note' | 'project'>('note')
  const [gridAddQuery, setGridAddQuery] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [projectNameEditTarget, setProjectNameEditTarget] = useState<{
    projectId: string
    token: number
  } | null>(null)
  const [projectFilterMode, setProjectFilterMode] = useState<ProjectFilterMode>('all')
  const [projectSortField, setProjectSortField] = useState<ProjectSortField>('name')
  const [projectSortDirection, setProjectSortDirection] = useState<ProjectSortDirection>('asc')
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
    upsertReview
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
  const currentWeekPriorities = useMemo(
    () => getWeekPriorities(weeklyPlanState, weeklyPlanCurrentWeekId),
    [weeklyPlanState, weeklyPlanCurrentWeekId]
  )
  const nextWeeklyPlanStart = useMemo(
    () => getNextWeeklyPlanStart(weeklyPlanWeeks),
    [weeklyPlanWeeks]
  )
  const [projectSearchQuery, setProjectSearchQuery] = useState('')
  const [commandPaletteResults, setCommandPaletteResults] = useState<CommandPaletteSearchResult[]>(
    []
  )
  const [commandPaletteInitialQuery, setCommandPaletteInitialQuery] = useState('')
  const [commandPaletteLoading, setCommandPaletteLoading] = useState(false)
  const [commandPaletteAiLoading, setCommandPaletteAiLoading] = useState(false)
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false)
  const [isProjectIconPickerOpen, setIsProjectIconPickerOpen] = useState(false)
  const commandPaletteSearchRequestRef = useRef(0)
  const noteActionsButtonRef = useRef<HTMLButtonElement | null>(null)
  const noteFilterButtonRef = useRef<HTMLButtonElement | null>(null)
  const noteSortButtonRef = useRef<HTMLButtonElement | null>(null)
  const projectFilterButtonRef = useRef<HTMLButtonElement | null>(null)
  const projectSortButtonRef = useRef<HTMLButtonElement | null>(null)
  const lastPersistedNoteRef = useRef<{ relPath: string; fingerprint: string } | null>(null)
  const createNoteRef = useRef<(() => Promise<void>) | null>(null)
  const notesRef = useRef(notes)
  const currentNotePathRef = useRef(currentNotePath)
  const currentNoteContentRef = useRef(currentNoteContent)
  const currentNoteTagsRef = useRef<string[]>([])
  const currentNoteEditorRef = useRef<NoteEditorHandle | null>(null)
  const currentNoteEditorDirtyRef = useRef(false)
  const noteEditorSessionsRef = useRef<Record<string, NoteEditorSessionSnapshot>>({})
  const pendingNoteSaveRef = useRef<{ relPath: string; content: string } | null>(null)
  const noteSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteSaveInFlightRef = useRef<Promise<void> | null>(null)
  const previousActivePageRef = useRef(activePage)
  const activePageRef = useRef(activePage)
  const pageNavigationQueueRef = useRef<Promise<void>>(Promise.resolve())
  const calendarTasksRef = useRef(calendarTasks)
  const shouldAnimateWorkspacePane =
    hasVault &&
    (activePage === 'dashboard' ||
      activePage === 'knowledge' ||
      (activePage === 'notes' && notePanelView !== 'tree') ||
      activePage === 'projects' ||
      activePage === 'grid' ||
      activePage === 'calendar')
  const showWorkspacePanel =
    hasVault &&
    (activePage === 'notes' ||
      activePage === 'projects' ||
      activePage === 'calendar' ||
      activePage === 'weeklyPlan')
  const hasRightPanel =
    showWorkspacePanel || activePage === 'schedules' || activePage === 'agentHistory'

  useEffect(() => {
    currentNotePathRef.current = currentNotePath
  }, [currentNotePath])

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
    setGridBoardDraft(gridBoard)
  }, [gridBoard])

  useEffect(() => {
    if (activePage !== 'grid') {
      setIsGridAddPopoverOpen(false)
      setGridAddQuery('')
    }
  }, [activePage])

  const gridBoardNoteItemIds = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of gridBoardDraft.items) {
      if (item.kind === 'note' && item.noteRelPath) {
        map.set(item.noteRelPath, item.id)
      }
    }
    return map
  }, [gridBoardDraft.items])

  const gridBoardProjectItemIds = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of gridBoardDraft.items) {
      if (item.kind === 'project' && item.projectId) {
        map.set(item.projectId, item.id)
      }
    }
    return map
  }, [gridBoardDraft.items])

  const filteredGridAddNotes = useMemo(() => {
    const query = gridAddQuery.trim().toLowerCase()
    return notes.filter((note) => {
      if (!query) {
        return true
      }
      return (
        note.name.toLowerCase().includes(query) ||
        note.relPath.toLowerCase().includes(query) ||
        note.tags.some((tag) => tag.toLowerCase().includes(query))
      )
    })
  }, [gridAddQuery, notes])

  const filteredGridAddProjects = useMemo(() => {
    const query = gridAddQuery.trim().toLowerCase()
    return projects.filter((project) => {
      if (!query) {
        return true
      }
      return (
        project.name.toLowerCase().includes(query) || project.summary.toLowerCase().includes(query)
      )
    })
  }, [gridAddQuery, projects])

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

  const persistLastOpenedNotePath = useCallback(
    async (relPath: string | null): Promise<void> => {
      if (!vaultApi) {
        return
      }

      if (lastOpenedNotePath === relPath) {
        return
      }

      try {
        const nextSettings = await vaultApi.settings.update({ lastOpenedNotePath: relPath })
        setSettings(nextSettings)
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [vaultApi, lastOpenedNotePath, setSettings, pushToast]
  )

  const persistLastOpenedProjectId = useCallback(
    async (projectId: string | null): Promise<void> => {
      if (!vaultApi) {
        return
      }

      if (lastOpenedProjectId === projectId) {
        return
      }

      try {
        const nextSettings = await vaultApi.settings.update({ lastOpenedProjectId: projectId })
        setSettings(nextSettings)
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [vaultApi, lastOpenedProjectId, setSettings, pushToast]
  )

  const persistFavoriteNotePaths = useCallback(
    async (favoritePaths: string[]): Promise<void> => {
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
        const nextSettings = await vaultApi.settings.update({ favoriteNotePaths: normalized })
        setSettings(nextSettings)
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [vaultApi, favoriteNotePathSettings, setSettings, pushToast]
  )

  const persistFavoriteProjectIds = useCallback(
    async (favoriteProjectIds: string[]): Promise<void> => {
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
        const nextSettings = await vaultApi.settings.update({ favoriteProjectIds: normalized })
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

  const handleProjectListSelect = useCallback(
    (projectId: string): void => {
      selectProject(projectId)
    },
    [selectProject]
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
    if (!window.confirm('Delete this week plan? This cannot be undone.')) {
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
  useEffect(() => {
    if (!noteIsOpen) {
      setCurrentNoteOutline([])
      setJumpToNoteHeading(null)
    }
  }, [noteIsOpen, currentNotePath])
  const currentNoteTags = currentNoteTagsState

  const resetCurrentNoteEditorSession = useCallback((): void => {
    currentNoteEditorDirtyRef.current = false
    setCurrentNoteEditorDraft(null)
    setCurrentNoteEditorVersion((current) => current + 1)
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
      currentNoteEditorDirtyRef.current = false
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
      setCurrentNoteEditorVersion((current) => current + 1)
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
  const calendarUndoneCount = useMemo(() => {
    return calendarTasks.filter((task) => !task.completed).length
  }, [calendarTasks])

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  )
  const favoriteProjectIds = useMemo(
    () =>
      favoriteProjectIdSettings.filter((projectId) =>
        projects.some((project) => project.id === projectId)
      ),
    [favoriteProjectIdSettings, projects]
  )
  const currentProjectIsFavorite = selectedProjectId
    ? favoriteProjectIds.includes(selectedProjectId)
    : false
  const favoriteNotePaths = useMemo(
    () =>
      favoriteNotePathSettings.filter((relPath) => notes.some((note) => note.relPath === relPath)),
    [favoriteNotePathSettings, notes]
  )
  const currentNoteIsFavorite = currentNotePath
    ? favoriteNotePaths.includes(currentNotePath)
    : false
  const shouldRestoreLastOpenedNote =
    settingsLoaded &&
    !currentNotePath &&
    Boolean(lastOpenedNotePath) &&
    notes.some((note) => note.relPath === lastOpenedNotePath)
  const middleHeaderBreadcrumbItem = useMemo(() => {
    if (!hasVault) {
      return 'Select Vault'
    }

    if (activePage === 'notes') {
      if (searchQuery.trim()) {
        return 'Search Results'
      }

      if (shouldRestoreLastOpenedNote) {
        return 'Opening Last Note'
      }

      if (!currentNotePath) {
        return 'No Note Selected'
      }

      return null
    }

    if (activePage === 'projects') {
      return selectedProject?.name ?? 'No Project Selected'
    }

    if (activePage === 'grid') {
      return GRID_PAGE_ENABLED ? 'Spatial Board' : 'Unavailable in This Version'
    }

    if (activePage === 'knowledge') {
      return 'Note graph'
    }

    if (activePage === 'dashboard') {
      return currentWeeklyPlanWeek
        ? formatWeekRange(currentWeeklyPlanWeek.startDate, currentWeeklyPlanWeek.endDate)
        : 'Overview'
    }

    if (activePage === 'calendar') {
      return formatCalendarDateLabel(selectedCalendarDate)
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
    currentNotePath,
    selectedCalendarDate,
    currentWeeklyPlanWeek,
    selectedProject,
    shouldRestoreLastOpenedNote,
    selectedWeeklyPlanWeek
  ])
  const noteHeaderBreadcrumbSegments = useMemo(() => {
    if (
      activePage !== 'notes' ||
      searchQuery.trim() ||
      shouldRestoreLastOpenedNote ||
      !currentNotePath
    ) {
      return null
    }

    return stripNoteExtension(currentNotePath).split('/').filter(Boolean)
  }, [activePage, currentNotePath, searchQuery, shouldRestoreLastOpenedNote])

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
    document.documentElement.style.setProperty('--app-font-family', fontFamily)
  }, [fontFamily])

  useEffect(() => {
    calendarTasksRef.current = calendarTasks
  }, [calendarTasks])

  useEffect(() => {
    if (!vaultApi) {
      return
    }

    void (async () => {
      try {
        const restored = await vaultApi.vault.restoreLast()
        if (!restored) {
          return
        }
        const restoredTree = await vaultApi.files.listTree()
        setVault(restored.info)
        setNotes(restored.notes)
        setNoteTree(restoredTree)
        pushToast('success', `Restored vault ${restored.info.rootPath}`)
      } catch (error) {
        pushToast('error', String(error))
      }
    })()
  }, [vaultApi, setNoteTree, setNotes, setVault, pushToast])

  useEffect(() => {
    if (hasVault || !commandPaletteOpen) {
      return
    }

    setCommandPaletteOpen(false)
  }, [commandPaletteOpen, hasVault, setCommandPaletteOpen])

  useEffect(() => {
    if (activePage !== 'projects' || !selectedProject) {
      setIsProjectIconPickerOpen(false)
    }
  }, [activePage, selectedProject])

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
      },
      onPersisted: async ({ relPath, document }) => {
        lastPersistedNoteRef.current = {
          relPath,
          fingerprint: serializeStoredNoteDocument(document)
        }
        pushNoteSaveTrace('coordinator:on-persisted', {
          relPath,
          tagCount: document.tags.length,
          contentPreview: summarizeTraceContent(document.markdown)
        })
        const nextNotes = await vaultApi.files.listNotes()
        replaceNotes(nextNotes)
      }
    })
  }, [replaceNotes, vaultApi])

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
        const content = checkpoint?.content ?? currentNoteContentRef.current
        const document = {
          version: 1 as const,
          tags: [...currentNoteTagsRef.current],
          markdown: content
        }

        const lastPersisted = lastPersistedNoteRef.current
        if (
          lastPersisted?.relPath === relPath &&
          lastPersisted.fingerprint === serializeStoredNoteDocument(document)
        ) {
          pushNoteSaveTrace('flush:skip-unchanged', {
            relPath,
            contentPreview: summarizeTraceContent(content),
            tagCount: document.tags.length
          })
          return
        }

        pushNoteSaveTrace('flush:enqueue', {
          relPath,
          contentPreview: summarizeTraceContent(content),
          tagCount: document.tags.length
        })
        await noteSaveCoordinator.enqueue({
          relPath,
          content,
          document
        })
      })()

      noteSaveInFlightRef.current = savePromise

      try {
        await savePromise
        if (
          shouldRestoreEditorFocus ||
          (!settleEditor && document.activeElement === document.body)
        ) {
          currentNoteEditorRef.current?.focus()
        }
        pushNoteSaveTrace('flush:done', {
          relPath,
          currentContentPreview: summarizeTraceContent(currentNoteContentRef.current)
        })
      } finally {
        if (noteSaveInFlightRef.current === savePromise) {
          noteSaveInFlightRef.current = null
        }
      }
    },
    [checkpointCurrentNote, hasPendingCurrentNoteSave, noteSaveCoordinator, settleCurrentNoteEditor]
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
        const content = checkpoint?.content ?? currentNoteContentRef.current
        const document = {
          version: 1 as const,
          tags: [...currentNoteTagsRef.current],
          markdown: content
        }
        const fingerprint = serializeStoredNoteDocument(document)

        pageLeaveSaveDebugState.attempted = true
        pageLeaveSaveDebugState.snapshotContent = content
        pageLeaveSaveDebugState.fingerprint = fingerprint

        if (noteSaveInFlightRef.current) {
          await noteSaveInFlightRef.current
        }

        const lastPersisted = lastPersistedNoteRef.current
        if (lastPersisted?.relPath === relPath && lastPersisted.fingerprint === fingerprint) {
          pageLeaveSaveDebugState.skippedReason = 'unchanged'
          pageLeaveSaveDebugState.writeCompleted = true
          pushNoteSaveTrace('page-leave:skip-unchanged', {
            requestedPage: page,
            relPath,
            contentPreview: summarizeTraceContent(content)
          })
          return
        }

        pushNoteSaveTrace('page-leave:enqueue', {
          requestedPage: page,
          relPath,
          contentPreview: summarizeTraceContent(content),
          tagCount: document.tags.length
        })
        const savePromise = noteSaveCoordinator.enqueue({
          relPath,
          content,
          document
        })
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
    [checkpointCurrentNote, noteSaveCoordinator, settleCurrentNoteEditor]
  )

  const navigateToPage = useCallback(
    async (page: AppPage): Promise<void> => {
      const runNavigation = async (): Promise<void> => {
        if (!hasVault) {
          return
        }

        const currentPage = activePageRef.current
        if (page === currentPage) {
          return
        }

        pushNoteSaveTrace('navigate:start', {
          from: currentPage,
          to: page,
          currentNotePath: currentNotePathRef.current,
          currentContentPreview: summarizeTraceContent(currentNoteContentRef.current)
        })

        if (currentPage === 'notes' && currentNotePathRef.current) {
          await persistCurrentNoteForPageLeave(page)
        }

        activePageRef.current = page
        setActivePage(page)
        pushNoteSaveTrace('navigate:done', {
          from: currentPage,
          to: page,
          currentNotePath: currentNotePathRef.current
        })
      }

      const queuedNavigation = pageNavigationQueueRef.current
        .catch(() => undefined)
        .then(runNavigation)

      pageNavigationQueueRef.current = queuedNavigation
      await queuedNavigation
    },
    [hasVault, persistCurrentNoteForPageLeave]
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!hasVault) {
        return
      }

      const isModifierPressed = event.metaKey || event.ctrlKey
      const isSearchPalette =
        isModifierPressed && !event.shiftKey && event.key.toLowerCase() === 'p'
      if (isSearchPalette) {
        event.preventDefault()
        setCommandPaletteInitialQuery('')
        setCommandPaletteOpen(true)
        return
      }

      const isCommandPalette =
        isModifierPressed && event.shiftKey && event.key.toLowerCase() === 'p'
      if (isCommandPalette) {
        event.preventDefault()
        setCommandPaletteInitialQuery('>')
        setCommandPaletteOpen(true)
        return
      }

      const isRightPanelShortcut = event.altKey && event.key.toLowerCase() === 'b'
      if (isRightPanelShortcut) {
        if (!hasRightPanel) {
          return
        }
        event.preventDefault()
        setIsRightPanelCollapsed((current) => !current)
        return
      }

      if (!isModifierPressed) {
        return
      }

      const normalizedKey = event.key.length === 1 ? event.key.toLowerCase() : event.key
      const pageByCode: Partial<Record<string, AppPage>> = {
        KeyD: 'dashboard',
        KeyK: 'knowledge',
        ...(GRID_PAGE_ENABLED ? { KeyG: 'grid' } : {}),
        Digit1: 'notes',
        Digit2: 'projects',
        Digit3: 'calendar',
        Digit4: 'weeklyPlan',
        Digit5: 'schedules',
        KeyI: 'agentHistory',
        Comma: 'settings'
      }
      const pageByKey: Partial<Record<string, AppPage>> = {
        d: 'dashboard',
        k: 'knowledge',
        ...(GRID_PAGE_ENABLED ? { g: 'grid' } : {}),
        '1': 'notes',
        '2': 'projects',
        '3': 'calendar',
        '4': 'weeklyPlan',
        '5': 'schedules',
        i: 'agentHistory',
        ',': 'settings'
      }
      const nextPage = pageByKey[normalizedKey] ?? pageByCode[event.code]
      if (nextPage) {
        event.preventDefault()
        void navigateToPage(nextPage)
        return
      }

      const target = event.target
      const isTypingTarget =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.getAttribute('role') === 'textbox')

      if (isTypingTarget) {
        return
      }
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [
    hasRightPanel,
    hasVault,
    navigateToPage,
    setCommandPaletteInitialQuery,
    setCommandPaletteOpen
  ])

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
    await persistCalendarTasks(nextTasks)
    return nextTasks
  }

  const persistProjects = async (nextProjects: Project[]): Promise<boolean> => {
    if (!vaultApi) {
      return false
    }

    try {
      const nextSettings = await vaultApi.settings.update({ projects: nextProjects })
      setSettings(nextSettings)
      return true
    } catch (error) {
      pushToast('error', String(error))
      return false
    }
  }

  const persistGridBoard = useCallback(
    async (nextGridBoard: GridBoardState): Promise<boolean> => {
      if (!vaultApi) {
        return false
      }

      try {
        const nextSettings = await vaultApi.settings.update({ gridBoard: nextGridBoard })
        setSettings(nextSettings)
        return true
      } catch (error) {
        pushToast('error', String(error))
        return false
      }
    },
    [pushToast, setSettings, vaultApi]
  )

  const handleGridBoardChange = useCallback(
    (nextGridBoard: GridBoardState): void => {
      if (isGridBoardStateEqual(gridBoardDraft, nextGridBoard)) {
        return
      }

      setGridBoardDraft(nextGridBoard)
      void persistGridBoard(nextGridBoard)
    },
    [gridBoardDraft, persistGridBoard]
  )

  const openGridAddPicker = useCallback((mode: 'note' | 'project'): void => {
    setGridAddMode(mode)
    setGridAddQuery('')
    setIsGridAddPopoverOpen(true)
  }, [])

  const handleAddGridText = useCallback((): void => {
    gridWorkspaceActions?.addText()
    setIsGridAddPopoverOpen(false)
    setGridAddQuery('')
  }, [gridWorkspaceActions])

  const handleAddGridNote = useCallback(
    (relPath: string): void => {
      gridWorkspaceActions?.addNote(relPath)
      setIsGridAddPopoverOpen(false)
      setGridAddQuery('')
    },
    [gridWorkspaceActions]
  )

  const handleAddGridProject = useCallback(
    (projectId: string): void => {
      gridWorkspaceActions?.addProject(projectId)
      setIsGridAddPopoverOpen(false)
      setGridAddQuery('')
    },
    [gridWorkspaceActions]
  )

  useEffect(() => {
    if (!settingsLoaded || !vaultApi || isGridBoardStateEqual(gridBoardSettings, gridBoard)) {
      return
    }

    void persistGridBoard(gridBoard)
  }, [gridBoard, gridBoardSettings, persistGridBoard, settingsLoaded, vaultApi])

  const persistProjectData = async (
    nextProjects: Project[],
    nextProjectIcons: Record<string, ProjectIconStyle>
  ): Promise<boolean> => {
    if (!vaultApi) {
      return false
    }

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

  const createCalendarTask = async (title: string, date?: string): Promise<CalendarTask> => {
    const trimmed = title.trim() || 'New Task'
    const nextTask: CalendarTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: trimmed,
      date,
      completed: false,
      createdAt: new Date().toISOString(),
      priority: 'medium',
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

  const updateCalendarTaskTime = async (
    taskId: string,
    time: string | undefined
  ): Promise<void> => {
    await updateCalendarTasks((tasks) =>
      tasks.map((task) => (task.id === taskId ? { ...task, time } : task))
    )
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

  const goToPrevMonth = (): void => {
    setSelectedCalendarDate(shiftIsoMonthClamped(selectedCalendarDate, -1))
  }

  const goToNextMonth = (): void => {
    setSelectedCalendarDate(shiftIsoMonthClamped(selectedCalendarDate, 1))
  }

  const goToToday = (): void => {
    setSelectedCalendarDate(toIsoDate(new Date()))
  }

  const openMilestoneFromCalendar = useCallback(
    (projectId: string, milestoneId: string): void => {
      selectProject(projectId)
      setFocusedMilestoneTarget({
        projectId,
        milestoneId,
        token: Date.now()
      })
      void navigateToPage('projects')
    },
    [navigateToPage, selectProject]
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

  const openVault = async (mode: 'open' | 'create'): Promise<void> => {
    if (!vaultApi) {
      pushToast('error', 'Vault actions are only available inside the Electron app')
      return
    }

    try {
      const result = mode === 'open' ? await vaultApi.vault.open() : await vaultApi.vault.create()
      if (!result) {
        return
      }
      const openedTree = await vaultApi.files.listTree()
      setSettingsLoaded(false)
      setVault(result.info)
      setNotes(result.notes)
      setNoteTree(openedTree)
      noteEditorSessionsRef.current = {}
      currentNotePathRef.current = null
      currentNoteContentRef.current = ''
      currentNoteTagsRef.current = []
      setCurrentNotePath(null)
      resetCurrentNoteEditorSession()
      setCurrentNoteTagsState([])
      setCurrentNoteContent('')
      pushToast('success', `Vault ready at ${result.info.rootPath}`)
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const openNote = useCallback(
    async (relPath: string): Promise<void> => {
      if (!vaultApi) {
        return
      }

      try {
        pushNoteSaveTrace('open-note:start', {
          targetRelPath: relPath,
          currentNotePath: currentNotePathRef.current,
          currentContentPreview: summarizeTraceContent(currentNoteContentRef.current)
        })
        if (currentNotePathRef.current && currentNotePathRef.current !== relPath) {
          await flushCurrentNote({ force: true, settleEditor: true })
        }

        const cachedSession = noteEditorSessionsRef.current[relPath]
        if (cachedSession) {
          pushNoteSaveTrace('open-note:use-session', {
            relPath,
            tagCount: cachedSession.tags.length,
            contentPreview: summarizeTraceContent(cachedSession.content)
          })
          currentNotePathRef.current = relPath
          currentNoteContentRef.current = cachedSession.content
          currentNoteTagsRef.current = cachedSession.tags
          currentNoteEditorDirtyRef.current = false
          setCurrentNotePath(relPath)
          setCurrentNoteContent(cachedSession.content)
          setCurrentNoteTagsState(cachedSession.tags)
          setCurrentNoteEditorDraft(cachedSession.content)
          setCurrentNoteEditorVersion((current) => current + 1)
          void persistLastOpenedNotePath(relPath)
          return
        }

        const document = await vaultApi.files.readNoteDocument(relPath)
        const content = splitNoteContent(document.markdown).body
        pushNoteSaveTrace('open-note:read-disk', {
          relPath,
          tagCount: document.tags.length,
          contentPreview: summarizeTraceContent(content)
        })
        noteEditorSessionsRef.current[relPath] = {
          content,
          tags: [...document.tags]
        }

        lastPersistedNoteRef.current = {
          relPath,
          fingerprint: serializeStoredNoteDocument(document)
        }
        currentNotePathRef.current = relPath
        currentNoteContentRef.current = content
        currentNoteTagsRef.current = document.tags
        currentNoteEditorDirtyRef.current = false
        setCurrentNotePath(relPath)
        setCurrentNoteContent(content)
        setCurrentNoteTagsState(document.tags)
        setCurrentNoteEditorDraft(content)
        setCurrentNoteEditorVersion((current) => current + 1)
        void persistLastOpenedNotePath(relPath)
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [
      flushCurrentNote,
      vaultApi,
      setCurrentNotePath,
      setCurrentNoteContent,
      pushToast,
      persistLastOpenedNotePath
    ]
  )

  useEffect(() => {
    if (!settingsLoaded) {
      return
    }

    if (currentNotePath) {
      return
    }

    const lastPath = lastOpenedNotePath
    if (!lastPath) {
      return
    }

    const exists = notes.some((note) => note.relPath === lastPath)
    if (!exists) {
      void persistLastOpenedNotePath(null)
      return
    }

    void openNote(lastPath)
  }, [
    settingsLoaded,
    currentNotePath,
    lastOpenedNotePath,
    notes,
    openNote,
    persistLastOpenedNotePath
  ])

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

  useEffect(() => {
    if (!vaultApi || !vault) {
      setNoteTree([])
      setSelectedNoteTreeEntry(null)
      return
    }

    void loadNoteTree()
  }, [loadNoteTree, notes, projects, vault, vaultApi])

  useEffect(() => {
    if (!currentNotePath) {
      return
    }

    setSelectedNoteTreeEntry({ kind: 'note', relPath: currentNotePath })
  }, [currentNotePath])

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
      setNotes(nextNotes)
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

  const createProjectNote = async (project: Project): Promise<void> => {
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
      let relPath: string | null = null
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const suffix = attempt === 0 ? '' : ` ${attempt + 1}`
        try {
          relPath = await vaultApi.files.createNoteWithTags(`${project.name}${suffix}`, [
            generateProjectTag(project.id)
          ])
          break
        } catch (error) {
          if (!String(error).includes('EEXIST')) {
            throw error
          }
        }
      }

      if (!relPath) {
        throw new Error('Could not create a unique project note name')
      }
      await refreshNotesAndTree()
      await navigateToPage('notes')
      await openNote(relPath)
      setNoteTitleEditTarget({ relPath, token: Date.now() })
      pushToast('success', 'Project note created')
    } catch (error) {
      pushToast('error', String(error))
    }
  }

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
      setNotes(nextNotes)
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
      'Convert old BlockNote JSON notes in this vault to markdown? This rewrites detected .md files in notes/.'
    )
    if (!confirmed) {
      return
    }

    const openPath = currentNotePathRef.current

    try {
      await flushCurrentNote({ force: true, settleEditor: true })
      const result = await vaultApi.files.migrateBlockNoteNotes()
      noteEditorSessionsRef.current = {}
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
      'Normalize notes that still have tag frontmatter in the visible body? This rewrites the matching .md files in notes/.'
    )
    if (!confirmed) {
      return
    }

    const openPath = currentNotePathRef.current

    try {
      await flushCurrentNote({ force: true, settleEditor: true })
      const result = await vaultApi.files.migrateTaggedNoteBodyFrontmatter()
      noteEditorSessionsRef.current = {}
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

  const runSearch = async (query: string): Promise<void> => {
    if (!vaultApi) {
      return
    }

    setSearchQuery(query)
    if (!query.trim()) {
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

  const randomizeProjectIcon = (projectId: string): void => {
    const seed = `${projectId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
    updateProjectIcon(projectId, createRandomProjectIcon(seed))
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
      setNotes(nextNotes)
      noteEditorSessionsRef.current[newPath] = {
        content,
        tags
      }
      delete noteEditorSessionsRef.current[oldPath]
      lastPersistedNoteRef.current = {
        relPath: newPath,
        fingerprint: serializeStoredNoteDocument(document)
      }
      currentNotePathRef.current = newPath
      currentNoteContentRef.current = content
      currentNoteTagsRef.current = tags
      setCurrentNotePath(newPath)
      setCurrentNoteContent(content)
      setCurrentNoteTagsState(tags)
      setCurrentNoteEditorDraft(content)
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
    const confirmed = window.confirm(`Delete note "${fileName}"? This cannot be undone.`)
    if (!confirmed) {
      return
    }

    try {
      await vaultApi.files.delete(relPath)
      const nextNotes = await vaultApi.files.listNotes()
      setNotes(nextNotes)
      delete noteEditorSessionsRef.current[relPath]
      if (favoriteNotePaths.includes(relPath)) {
        void persistFavoriteNotePaths(favoriteNotePaths.filter((path) => path !== relPath))
      }
      if (currentNotePath === relPath) {
        currentNotePathRef.current = null
        currentNoteContentRef.current = ''
        currentNoteTagsRef.current = []
        setCurrentNotePath(null)
        resetCurrentNoteEditorSession()
        setCurrentNoteTagsState([])
        setCurrentNoteContent('')
        void persistLastOpenedNotePath(null)
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

  const exportCurrentNote = async (): Promise<void> => {
    if (!vaultApi || !currentNotePath) {
      return
    }

    try {
      await flushCurrentNote({ force: true })
      const exportedPath = await vaultApi.files.exportNote(
        currentNotePath,
        currentNoteContentRef.current
      )
      if (!exportedPath) {
        return
      }
      pushToast('success', `Note exported to ${exportedPath}`)
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

  const createProject = (): void => {
    const baseName = 'Untitled Project'
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
      summary: 'Add project details here.',
      status: 'on-track',
      icon: createRandomProjectIcon(nextName),
      updatedAt: new Date().toISOString(),
      progress: 0,
      milestones: []
    }

    const nextProjects = [withComputedProjectState(nextProject), ...projects]
    const nextProjectIcons = { ...projectIcons, [nextProject.id]: nextProject.icon }
    void persistProjectData(nextProjects, nextProjectIcons)
    selectProject(nextProject.id)
    setProjectNameEditTarget({ projectId: nextProject.id, token: Date.now() })
    setProjectSearchQuery('')
    void navigateToPage('projects')
    pushToast('success', 'Project created')
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

  const addMilestoneToProject = (projectId: string, title: string, dueDate?: string): void => {
    const normalizedTitle = title.trim()
    const normalizedDueDate = dueDate?.trim() || undefined
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
        description: '',
        collapsed: false,
        dueDate: normalizedDueDate,
        priority: 'medium',
        status: 'pending',
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

  const toggleProjectMilestoneCollapsed = (projectId: string, milestoneId: string): void => {
    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) =>
        milestone.id === milestoneId
          ? { ...milestone, collapsed: !(milestone.collapsed ?? false) }
          : milestone
      )

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })

    setSettings({
      ...useVaultStore.getState().settings,
      projects: nextProjects
    })
    void persistProjects(nextProjects)
  }

  const cycleProjectMilestonePriority = (projectId: string, milestoneId: string): void => {
    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) =>
        milestone.id === milestoneId
          ? { ...milestone, priority: getNextTaskPriority(milestone.priority) }
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

  const moveProjectMilestone = (
    projectId: string,
    milestoneId: string,
    direction: 'up' | 'down'
  ): void => {
    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const currentIndex = project.milestones.findIndex((milestone) => milestone.id === milestoneId)
      if (currentIndex < 0) {
        return project
      }

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
      if (targetIndex < 0 || targetIndex >= project.milestones.length) {
        return project
      }

      const nextMilestones = [...project.milestones]
      const [movingMilestone] = nextMilestones.splice(currentIndex, 1)
      nextMilestones.splice(targetIndex, 0, movingMilestone)

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const reorderProjectMilestones = (projectId: string, orderedMilestoneIds: string[]): void => {
    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const milestoneById = new Map(
        project.milestones.map((milestone) => [milestone.id, milestone])
      )
      const reorderedMilestones = orderedMilestoneIds
        .map((milestoneId) => milestoneById.get(milestoneId))
        .filter((milestone): milestone is ProjectMilestone => Boolean(milestone))

      if (reorderedMilestones.length !== project.milestones.length) {
        return project
      }

      return withComputedProjectState({
        ...project,
        milestones: reorderedMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const addSubtaskToMilestone = (projectId: string, milestoneId: string, title: string): void => {
    const normalizedTitle = title.trim()
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
                  description: '',
                  completed: false,
                  priority: 'medium',
                  createdAt: new Date().toISOString()
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

  const cycleMilestoneSubtaskPriority = (
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
                subtask.id === subtaskId
                  ? {
                      ...subtask,
                      priority: getNextTaskPriority(subtask.priority)
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

  const moveMilestoneSubtask = (
    projectId: string,
    milestoneId: string,
    subtaskId: string,
    direction: 'up' | 'down'
  ): void => {
    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) => {
        if (milestone.id !== milestoneId) {
          return milestone
        }

        const currentIndex = milestone.subtasks.findIndex((subtask) => subtask.id === subtaskId)
        if (currentIndex < 0) {
          return milestone
        }

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
        if (targetIndex < 0 || targetIndex >= milestone.subtasks.length) {
          return milestone
        }

        const nextSubtasks = [...milestone.subtasks]
        const [movingSubtask] = nextSubtasks.splice(currentIndex, 1)
        nextSubtasks.splice(targetIndex, 0, movingSubtask)

        return {
          ...milestone,
          subtasks: nextSubtasks
        }
      })

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const reorderMilestoneSubtasks = (
    projectId: string,
    milestoneId: string,
    orderedSubtaskIds: string[]
  ): void => {
    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) => {
        if (milestone.id !== milestoneId) {
          return milestone
        }

        const subtaskById = new Map(milestone.subtasks.map((subtask) => [subtask.id, subtask]))
        const reorderedSubtasks = orderedSubtaskIds
          .map((subtaskId) => subtaskById.get(subtaskId))
          .filter((subtask): subtask is ProjectSubtask => Boolean(subtask))

        if (reorderedSubtasks.length !== milestone.subtasks.length) {
          return milestone
        }

        return {
          ...milestone,
          subtasks: reorderedSubtasks
        }
      })

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

  const removeSelectedProject = async (): Promise<void> => {
    if (!selectedProject) {
      return
    }

    await removeProjectById(selectedProject.id)
  }

  const removeProjectById = async (projectId: string): Promise<void> => {
    const project = projects.find((item) => item.id === projectId)
    if (!project) {
      return
    }

    const confirmed = window.confirm(
      `Remove project "${project.name}" from this workspace? Tagged notes will stay in the vault. This cannot be undone.`
    )
    if (!confirmed) {
      return
    }

    const nextProjects = projects.filter((item) => item.id !== projectId)
    const nextSelectedProject =
      nextProjects.find((item) => item.id === selectedProjectId) ?? nextProjects[0] ?? null
    const nextProjectIcons = { ...projectIcons }
    delete nextProjectIcons[projectId]
    const saved = await persistProjectData(nextProjects, nextProjectIcons)
    if (!saved) {
      return
    }
    if (favoriteProjectIds.includes(projectId)) {
      void persistFavoriteProjectIds(favoriteProjectIds.filter((id) => id !== projectId))
    }
    if (selectedProjectId === projectId) {
      selectProject(nextSelectedProject?.id ?? null)
    }
    pushToast('success', 'Project removed')
  }

  const toggleCurrentProjectFavorite = (): void => {
    if (!selectedProjectId) {
      return
    }

    const nextFavoriteProjectIds = currentProjectIsFavorite
      ? favoriteProjectIds.filter((projectId) => projectId !== selectedProjectId)
      : [selectedProjectId, ...favoriteProjectIds]

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

    setNotes(nextNotes)
    setNoteTree(nextTree)
    if (
      currentNotePathRef.current &&
      !nextNotes.some((note) => note.relPath === currentNotePathRef.current)
    ) {
      currentNotePathRef.current = null
      currentNoteContentRef.current = ''
      currentNoteTagsRef.current = []
      setCurrentNotePath(null)
      resetCurrentNoteEditorSession()
      setCurrentNoteTagsState([])
      setCurrentNoteContent('')
      void persistLastOpenedNotePath(null)
    }
    return nextTree
  }, [
    persistLastOpenedNotePath,
    resetCurrentNoteEditorSession,
    setCurrentNoteContent,
    setCurrentNotePath,
    setNotes,
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
    if (!selectedNoteTreeEntry) {
      return ''
    }

    if (selectedNoteTreeEntry.kind === 'folder') {
      return selectedNoteTreeEntry.relPath
    }

    const slashIndex = selectedNoteTreeEntry.relPath.lastIndexOf('/')
    return slashIndex >= 0 ? selectedNoteTreeEntry.relPath.slice(0, slashIndex) : ''
  }, [selectedNoteTreeEntry])

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
        setSelectedNoteTreeEntry({ kind: 'note', relPath })
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
        setSelectedNoteTreeEntry({ kind: 'note', relPath })
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
        setSelectedNoteTreeEntry({ kind: 'folder', relPath })
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
    async (relPath: string, nextName: string, kind: 'note' | 'folder'): Promise<void> => {
      if (!vaultApi) {
        return
      }

      const trimmed = nextName.trim()
      if (!trimmed) {
        return
      }

      const slashIndex = relPath.lastIndexOf('/')
      const parentDir = slashIndex >= 0 ? relPath.slice(0, slashIndex) : ''
      const normalizedName = kind === 'note' ? withNoteExtension(trimmed) : trimmed
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

        if (kind === 'note') {
          const existingSession = noteEditorSessionsRef.current[relPath]
          if (existingSession) {
            noteEditorSessionsRef.current[nextRelPath] = existingSession
            delete noteEditorSessionsRef.current[relPath]
          }
        } else {
          Object.entries(noteEditorSessionsRef.current).forEach(([path, session]) => {
            const remappedPath = remapNestedPath(path, relPath, nextRelPath)
            if (remappedPath && remappedPath !== path) {
              noteEditorSessionsRef.current[remappedPath] = session
              delete noteEditorSessionsRef.current[path]
            }
          })
        }

        if (nextCurrentNotePath !== currentNotePath) {
          currentNotePathRef.current = nextCurrentNotePath
        }

        await vaultApi.files.renamePath(relPath, nextRelPath)
        await refreshNotesAndTree()
        setSelectedNoteTreeEntry({ kind, relPath: nextRelPath })
        if (nextCurrentNotePath !== currentNotePath) {
          currentNotePathRef.current = nextCurrentNotePath
          setCurrentNotePath(nextCurrentNotePath)
          void persistLastOpenedNotePath(nextCurrentNotePath)
        }
        const nextFavoritePaths =
          kind === 'note'
            ? favoriteNotePaths.map((path) => (path === relPath ? nextRelPath : path))
            : favoriteNotePaths.map((path) => remapNestedPath(path, relPath, nextRelPath) ?? path)
        if (nextFavoritePaths.some((path, index) => path !== favoriteNotePaths[index])) {
          void persistFavoriteNotePaths(nextFavoritePaths)
        }
        pushToast('success', `${kind === 'folder' ? 'Folder' : 'Note'} renamed`)
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [
      currentNotePath,
      favoriteNotePaths,
      persistFavoriteNotePaths,
      persistLastOpenedNotePath,
      pushToast,
      refreshNotesAndTree,
      setCurrentNotePath,
      vaultApi
    ]
  )

  const deleteTreePath = useCallback(
    async (relPath: string, kind: 'note' | 'folder'): Promise<void> => {
      if (!vaultApi) {
        return
      }

      const itemName = relPath.split('/').pop() ?? relPath
      const confirmed = window.confirm(
        kind === 'folder'
          ? `Delete folder "${itemName}" and all nested notes? This cannot be undone.`
          : `Delete note "${itemName}"? This cannot be undone.`
      )
      if (!confirmed) {
        return
      }

      try {
        await vaultApi.files.deletePath(relPath)
        await refreshNotesAndTree()
        setSelectedNoteTreeEntry(null)
        const nextFavoritePaths =
          kind === 'note'
            ? favoriteNotePaths.filter((path) => path !== relPath)
            : favoriteNotePaths.filter((path) => !isNestedPath(path, relPath))
        if (nextFavoritePaths.length !== favoriteNotePaths.length) {
          void persistFavoriteNotePaths(nextFavoritePaths)
        }
        const shouldClearCurrent =
          kind === 'note' ? currentNotePath === relPath : isNestedPath(currentNotePath, relPath)
        if (kind === 'note') {
          delete noteEditorSessionsRef.current[relPath]
        } else {
          Object.keys(noteEditorSessionsRef.current).forEach((path) => {
            if (isNestedPath(path, relPath)) {
              delete noteEditorSessionsRef.current[path]
            }
          })
        }
        if (shouldClearCurrent) {
          currentNotePathRef.current = null
          currentNoteContentRef.current = ''
          currentNoteTagsRef.current = []
          setCurrentNotePath(null)
          resetCurrentNoteEditorSession()
          setCurrentNoteTagsState([])
          setCurrentNoteContent('')
          void persistLastOpenedNotePath(null)
        }
        pushToast('success', `${kind === 'folder' ? 'Folder' : 'Note'} deleted`)
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [
      currentNotePath,
      favoriteNotePaths,
      persistFavoriteNotePaths,
      persistLastOpenedNotePath,
      pushToast,
      refreshNotesAndTree,
      resetCurrentNoteEditorSession,
      setCurrentNoteContent,
      setCurrentNotePath,
      vaultApi
    ]
  )

  const moveTreePath = useCallback(
    async (fromRelPath: string, toRelPath: string): Promise<void> => {
      if (!vaultApi) {
        return
      }

      const movedKind = fromRelPath === withNoteExtension(fromRelPath) ? 'note' : 'folder'
      const nextCurrentNotePath =
        movedKind === 'note'
          ? currentNotePath === fromRelPath
            ? toRelPath
            : currentNotePath
          : remapNestedPath(currentNotePath, fromRelPath, toRelPath)

      if (movedKind === 'note') {
        const existingSession = noteEditorSessionsRef.current[fromRelPath]
        if (existingSession) {
          noteEditorSessionsRef.current[toRelPath] = existingSession
          delete noteEditorSessionsRef.current[fromRelPath]
        }
      } else {
        Object.entries(noteEditorSessionsRef.current).forEach(([path, session]) => {
          const remappedPath = remapNestedPath(path, fromRelPath, toRelPath)
          if (remappedPath && remappedPath !== path) {
            noteEditorSessionsRef.current[remappedPath] = session
            delete noteEditorSessionsRef.current[path]
          }
        })
      }

      if (nextCurrentNotePath !== currentNotePath) {
        currentNotePathRef.current = nextCurrentNotePath
      }

      await vaultApi.files.renamePath(fromRelPath, toRelPath)
      await refreshNotesAndTree()
      setSelectedNoteTreeEntry({ kind: movedKind, relPath: toRelPath })
      if (nextCurrentNotePath !== currentNotePath) {
        currentNotePathRef.current = nextCurrentNotePath
        setCurrentNotePath(nextCurrentNotePath)
        void persistLastOpenedNotePath(nextCurrentNotePath)
      }
      const nextFavoritePaths =
        movedKind === 'note'
          ? favoriteNotePaths.map((path) => (path === fromRelPath ? toRelPath : path))
          : favoriteNotePaths.map((path) => remapNestedPath(path, fromRelPath, toRelPath) ?? path)
      if (nextFavoritePaths.some((path, index) => path !== favoriteNotePaths[index])) {
        void persistFavoriteNotePaths(nextFavoritePaths)
      }
    },
    [
      currentNotePath,
      favoriteNotePaths,
      persistFavoriteNotePaths,
      persistLastOpenedNotePath,
      refreshNotesAndTree,
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
  const paletteBlurClass = commandPaletteOpen ? ' search-palette-surface-blur' : ''
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
      ...(notePanelView === 'tree' ? [{ id: 'new-folder', label: 'New folder' }] : []),
      { type: 'separator' },
      { id: 'import-markdown', label: 'Import markdown' }
    ]
    const actionId = await showNativeMenu(
      items,
      getElementMenuPosition(noteActionsButtonRef.current, 'start')
    )

    if (actionId === 'new-note') {
      void (notePanelView === 'tree' ? createNoteFromTree() : createNote())
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

  const openNativeNoteFilterMenu = async (): Promise<void> => {
    if (!useNativeMenus || !noteFilterButtonRef.current) {
      return
    }

    const actionId = await showNativeMenu(
      [
        { id: 'all', type: 'checkbox', label: 'All', checked: noteFilterMode === 'all' },
        { id: 'tagged', type: 'checkbox', label: 'Tagged', checked: noteFilterMode === 'tagged' },
        {
          id: 'untagged',
          type: 'checkbox',
          label: 'Untagged',
          checked: noteFilterMode === 'untagged'
        }
      ],
      getElementMenuPosition(noteFilterButtonRef.current, 'start')
    )

    if (actionId === 'all' || actionId === 'tagged' || actionId === 'untagged') {
      setNoteFilterMode(actionId)
    }
  }

  const openNativeNoteSortMenu = async (): Promise<void> => {
    if (!useNativeMenus || !noteSortButtonRef.current) {
      return
    }

    const actionId = await showNativeMenu(
      [
        { id: 'name', type: 'checkbox', label: 'Name', checked: noteSortField === 'name' },
        { id: 'created', type: 'checkbox', label: 'Created', checked: noteSortField === 'created' },
        { id: 'updated', type: 'checkbox', label: 'Updated', checked: noteSortField === 'updated' },
        { type: 'separator' },
        {
          id: 'toggle-direction',
          label: `Direction: ${noteSortDirection === 'asc' ? 'Ascending' : 'Descending'}`
        }
      ],
      getElementMenuPosition(noteSortButtonRef.current, 'start')
    )

    if (actionId === 'name' || actionId === 'created' || actionId === 'updated') {
      setNoteSortField(actionId)
      setNoteSortDirection(actionId === 'name' ? 'asc' : 'desc')
      return
    }
    if (actionId === 'toggle-direction') {
      setNoteSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
    }
  }

  const openNativeProjectFilterMenu = async (): Promise<void> => {
    if (!useNativeMenus || !projectFilterButtonRef.current) {
      return
    }

    const actionId = await showNativeMenu(
      [
        { id: 'all', type: 'checkbox', label: 'All', checked: projectFilterMode === 'all' },
        {
          id: 'favorites',
          type: 'checkbox',
          label: 'Favorites',
          checked: projectFilterMode === 'favorites'
        },
        {
          id: 'active',
          type: 'checkbox',
          label: 'In Progress',
          checked: projectFilterMode === 'active'
        },
        {
          id: 'completed',
          type: 'checkbox',
          label: 'Done',
          checked: projectFilterMode === 'completed'
        }
      ],
      getElementMenuPosition(projectFilterButtonRef.current, 'start')
    )

    if (
      actionId === 'all' ||
      actionId === 'favorites' ||
      actionId === 'active' ||
      actionId === 'completed'
    ) {
      setProjectFilterMode(actionId)
    }
  }

  const openNativeProjectSortMenu = async (): Promise<void> => {
    if (!useNativeMenus || !projectSortButtonRef.current) {
      return
    }

    const actionId = await showNativeMenu(
      [
        { id: 'name', type: 'checkbox', label: 'Name', checked: projectSortField === 'name' },
        {
          id: 'updated',
          type: 'checkbox',
          label: 'Updated',
          checked: projectSortField === 'updated'
        },
        { type: 'separator' },
        {
          id: 'toggle-direction',
          label: `Direction: ${projectSortDirection === 'asc' ? 'Ascending' : 'Descending'}`
        }
      ],
      getElementMenuPosition(projectSortButtonRef.current, 'start')
    )

    if (actionId === 'name' || actionId === 'updated') {
      setProjectSortField(actionId)
      setProjectSortDirection(actionId === 'name' ? 'asc' : 'desc')
      return
    }
    if (actionId === 'toggle-direction') {
      setProjectSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
    }
  }

  return (
    <div className="flex h-screen">
      <SidebarProvider className="h-full">
        <AppSidebar
          activePage={activePage}
          onChange={handleSidebarPageChange}
          onOpenSearchPalette={handleOpenSearchPalette}
          onSidebarInteract={handleSidebarInteract}
          notesCount={notes.length}
          projectsCount={projects.length}
          calendarUndoneCount={calendarUndoneCount}
          profileName={profileName}
          isLocked={!hasVault}
          className={`${paletteSurfaceClass}${paletteBlurClass}`}
        />

        <SidebarInset className="!min-h-0 overflow-hidden text-[var(--text)] antialiased [font-family:var(--app-font-family)]">
          <div className="flex h-full min-w-0">
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
            <DocumentWorkspaceMain
              className={`${isStandalonePage ? 'hidden ' : ''}${paletteSurfaceClass}${paletteBlurClass}`.trim()}
            >
              <DocumentWorkspaceMainHeader
                breadcrumb={
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
                        {currentNoteOutline.length > 0 && jumpToNoteHeading ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <WorkspaceActionButton
                                title="Navigate headings"
                                aria-label="Navigate headings"
                                icon={<List size={18} />}
                              />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="max-h-80 w-72 overflow-y-auto"
                            >
                              {currentNoteOutline.map((item) => (
                                <DropdownMenuItem
                                  key={item.id}
                                  onSelect={() => jumpToNoteHeading(item.id)}
                                  className="text-[var(--text)]"
                                  style={{
                                    paddingLeft: `${0.75 + Math.max(0, item.level - 1) * 0.75}rem`
                                  }}
                                >
                                  <span className="mr-2 text-xs text-[var(--muted)]">
                                    H{item.level}
                                  </span>
                                  <span className="truncate">{item.label}</span>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                        <WorkspaceActionButton
                          onClick={() => {
                            void exportCurrentNote()
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
                          active={currentNoteIsFavorite}
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
                  ) : activePage === 'projects' && selectedProject ? (
                    <WorkspaceHeaderActions>
                      <WorkspaceHeaderActionGroup>
                        <WorkspaceActionButton
                          onClick={() => {
                            void openProjectFolder(selectedProject)
                          }}
                          title={
                            selectedProject.folderPath?.trim()
                              ? `Open linked folder\n${selectedProject.folderPath}`
                              : 'Link project folder'
                          }
                          aria-label={
                            selectedProject.folderPath?.trim()
                              ? 'Open linked project folder'
                              : 'Link project folder'
                          }
                          icon={<FolderOpen size={18} />}
                        />
                        <Popover
                          open={isProjectIconPickerOpen}
                          onOpenChange={setIsProjectIconPickerOpen}
                        >
                          <PopoverTrigger asChild>
                            <WorkspaceActionButton
                              title="Customize project icon"
                              aria-label="Customize project icon"
                              icon={
                                <NoteShapeIcon
                                  icon={selectedProject.icon}
                                  size={18}
                                  className="shrink-0"
                                />
                              }
                            />
                          </PopoverTrigger>
                          <PopoverContent
                            align="end"
                            className="w-64 border border-[var(--line)] bg-[var(--panel)] p-3 text-[var(--text)] shadow-xl"
                          >
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                              Shape
                            </div>
                            <div className="mb-3 flex flex-wrap gap-1.5">
                              {PROJECT_ICON_SHAPES.map((shape) => {
                                const isActive = selectedProject.icon.shape === shape
                                return (
                                  <button
                                    key={shape}
                                    type="button"
                                    className={`inline-flex items-center justify-center rounded-md border p-1.5 ${
                                      isActive
                                        ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
                                        : 'border-[var(--line)] bg-[var(--panel-2)] hover:border-[var(--accent)]'
                                    }`}
                                    onClick={() =>
                                      updateProjectIcon(selectedProject.id, {
                                        ...selectedProject.icon,
                                        shape
                                      })
                                    }
                                    title={shape}
                                  >
                                    <NoteShapeIcon
                                      icon={{ ...selectedProject.icon, shape }}
                                      size={15}
                                    />
                                  </button>
                                )
                              })}
                            </div>
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                              Style
                            </div>
                            <div className="mb-3 flex gap-1.5">
                              {PROJECT_ICON_VARIANTS.map((variant) => {
                                const isActive = selectedProject.icon.variant === variant
                                return (
                                  <button
                                    key={variant}
                                    type="button"
                                    className={`rounded-md border px-2 py-1 text-xs font-medium ${
                                      isActive
                                        ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--text)]'
                                        : 'border-[var(--line)] bg-[var(--panel-2)] text-[var(--muted)] hover:border-[var(--accent)]'
                                    }`}
                                    onClick={() =>
                                      updateProjectIcon(selectedProject.id, {
                                        ...selectedProject.icon,
                                        variant
                                      })
                                    }
                                  >
                                    {variant}
                                  </button>
                                )
                              })}
                            </div>
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                              Color
                            </div>
                            <div className="mb-3 flex flex-wrap gap-1.5">
                              {PROJECT_ICON_COLORS.map((color) => {
                                const isActive = selectedProject.icon.color === color
                                return (
                                  <button
                                    key={color}
                                    type="button"
                                    className={`h-6 w-6 rounded-full border-2 ${
                                      isActive
                                        ? 'border-[var(--text)] ring-1 ring-[var(--line)]'
                                        : 'border-transparent'
                                    }`}
                                    style={{ backgroundColor: color }}
                                    onClick={() =>
                                      updateProjectIcon(selectedProject.id, {
                                        ...selectedProject.icon,
                                        color
                                      })
                                    }
                                    title={color}
                                  />
                                )
                              })}
                            </div>
                            <button
                              type="button"
                              className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-2)] px-2.5 py-1.5 text-xs font-medium hover:border-[var(--accent)]"
                              onClick={() => randomizeProjectIcon(selectedProject.id)}
                            >
                              Randomize icon
                            </button>
                          </PopoverContent>
                        </Popover>
                        <WorkspaceActionButton
                          onClick={() => {
                            void exportProject(selectedProject)
                          }}
                          title="Export Project"
                          icon={<Download size={18} />}
                        />
                        <WorkspaceActionButton
                          onClick={() => toggleProjectDone(selectedProject.id)}
                          title={
                            selectedProject.status === 'completed'
                              ? 'Reopen Project'
                              : 'Mark Project Done'
                          }
                          aria-label={
                            selectedProject.status === 'completed'
                              ? 'Reopen project'
                              : 'Mark project done'
                          }
                          active={selectedProject.status === 'completed'}
                          icon={
                            selectedProject.status === 'completed' ? (
                              <RotateCcw size={18} />
                            ) : (
                              <Check size={18} />
                            )
                          }
                        />
                      </WorkspaceHeaderActionGroup>
                      <WorkspaceHeaderActionDivider />
                      <WorkspaceHeaderActionGroup>
                        <WorkspaceActionButton
                          onClick={toggleCurrentProjectFavorite}
                          title={
                            currentProjectIsFavorite
                              ? 'Remove Project from Favorites'
                              : 'Add Project to Favorites'
                          }
                          active={currentProjectIsFavorite}
                          icon={
                            <Star
                              size={18}
                              className={currentProjectIsFavorite ? 'fill-current' : ''}
                            />
                          }
                        />
                      </WorkspaceHeaderActionGroup>
                      <WorkspaceHeaderActionDivider />
                      <WorkspaceHeaderActionGroup>
                        <WorkspaceActionButton
                          onClick={() => {
                            void removeSelectedProject()
                          }}
                          title="Remove Project"
                          icon={<Trash2 size={18} />}
                        />
                      </WorkspaceHeaderActionGroup>
                    </WorkspaceHeaderActions>
                  ) : activePage === 'grid' ? (
                    <WorkspaceHeaderActions>
                      <WorkspaceHeaderActionGroup>
                        <Popover
                          open={isGridAddPopoverOpen}
                          onOpenChange={(open) => {
                            setIsGridAddPopoverOpen(open)
                            if (!open) {
                              setGridAddQuery('')
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <WorkspaceActionButton
                              title="Add to canvas"
                              aria-label="Add to canvas"
                              disabled={!gridWorkspaceActions}
                              icon={<Plus size={18} />}
                            />
                          </PopoverTrigger>
                          <PopoverContent
                            align="end"
                            className="w-80 border border-[var(--line)] bg-[var(--panel)] p-3 text-[var(--text)] shadow-xl"
                          >
                            <div className="mb-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openGridAddPicker('note')}
                                className={`rounded-lg border px-3 py-1.5 text-sm ${
                                  gridAddMode === 'note'
                                    ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]'
                                    : 'border-[var(--line)] bg-[var(--panel-2)] text-[var(--text)] hover:border-[var(--accent)]'
                                }`}
                              >
                                Add note
                              </button>
                              <button
                                type="button"
                                onClick={() => openGridAddPicker('project')}
                                className={`rounded-lg border px-3 py-1.5 text-sm ${
                                  gridAddMode === 'project'
                                    ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]'
                                    : 'border-[var(--line)] bg-[var(--panel-2)] text-[var(--text)] hover:border-[var(--accent)]'
                                }`}
                              >
                                Add project
                              </button>
                              <button
                                type="button"
                                onClick={handleAddGridText}
                                className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1.5 text-sm text-[var(--text)] hover:border-[var(--accent)]"
                              >
                                Add text
                              </button>
                            </div>
                            <label className="mb-3 flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-[var(--muted)]">
                              <Search size={14} aria-hidden="true" />
                              <input
                                value={gridAddQuery}
                                onChange={(event) => setGridAddQuery(event.currentTarget.value)}
                                placeholder={
                                  gridAddMode === 'note'
                                    ? 'Search notes by title, path, or tag'
                                    : 'Search projects by name or summary'
                                }
                                className="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                              />
                            </label>
                            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                              {gridAddMode === 'note'
                                ? filteredGridAddNotes.slice(0, 16).map((note) => {
                                    const existingItemId = gridBoardNoteItemIds.get(note.relPath)
                                    return (
                                      <button
                                        key={note.relPath}
                                        type="button"
                                        onClick={() => handleAddGridNote(note.relPath)}
                                        className="group w-full rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-3 text-left transition hover:border-[var(--accent)] hover:bg-[var(--panel)]"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <div className="truncate text-sm font-semibold text-[var(--text)]">
                                              {stripNoteExtension(note.name)}
                                            </div>
                                            <div className="mt-1 truncate text-xs text-[var(--muted)]">
                                              {note.relPath}
                                            </div>
                                          </div>
                                          <div className="rounded-full border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2 py-1 text-[10px] uppercase tracking-[0.24em] text-[var(--accent)]">
                                            {existingItemId ? 'On canvas' : 'Add'}
                                          </div>
                                        </div>
                                      </button>
                                    )
                                  })
                                : filteredGridAddProjects.slice(0, 16).map((project) => {
                                    const existingItemId = gridBoardProjectItemIds.get(project.id)
                                    return (
                                      <button
                                        key={project.id}
                                        type="button"
                                        onClick={() => handleAddGridProject(project.id)}
                                        className="group w-full rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-3 text-left transition hover:border-[var(--accent)] hover:bg-[var(--panel)]"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex min-w-0 gap-3">
                                            <NoteShapeIcon
                                              icon={project.icon}
                                              size={16}
                                              className="mt-0.5 shrink-0"
                                            />
                                            <div className="min-w-0">
                                              <div className="truncate text-sm font-semibold text-[var(--text)]">
                                                {project.name}
                                              </div>
                                              <div className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">
                                                {project.summary || 'Project'}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="rounded-full border border-[rgba(125,183,255,0.2)] bg-[rgba(125,183,255,0.1)] px-2 py-1 text-[10px] uppercase tracking-[0.24em] text-[var(--text)]">
                                            {existingItemId ? 'On canvas' : 'Add'}
                                          </div>
                                        </div>
                                      </button>
                                    )
                                  })}
                              {(
                                gridAddMode === 'note'
                                  ? filteredGridAddNotes.length === 0
                                  : filteredGridAddProjects.length === 0
                              ) ? (
                                <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--panel-2)] px-3 py-4 text-sm text-[var(--muted)]">
                                  No {gridAddMode}s match this search.
                                </div>
                              ) : null}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </WorkspaceHeaderActionGroup>
                      <WorkspaceHeaderActionDivider />
                      <WorkspaceHeaderActionGroup>
                        <WorkspaceActionButton
                          onClick={() => gridWorkspaceActions?.fitAllCards()}
                          title="Fit all cards"
                          aria-label="Fit all cards"
                          disabled={!gridWorkspaceActions}
                          icon={<Target size={18} />}
                        />
                        <WorkspaceActionButton
                          onClick={() => gridWorkspaceActions?.resetBoard()}
                          title="Reset board"
                          aria-label="Reset board"
                          disabled={!gridWorkspaceActions}
                          icon={<RotateCcw size={18} />}
                        />
                      </WorkspaceHeaderActionGroup>
                    </WorkspaceHeaderActions>
                  ) : activePage === 'calendar' ? (
                    <WorkspaceHeaderActions>
                      <WorkspaceHeaderActionGroup>
                        <WorkspaceActionButton
                          onClick={goToPrevMonth}
                          title="Previous month"
                          icon={<ChevronLeft size={18} />}
                        />
                        <WorkspaceActionButton
                          onClick={goToToday}
                          title="Go to today"
                          icon={<CalendarDays size={18} />}
                        />
                        <WorkspaceActionButton
                          onClick={goToNextMonth}
                          title="Next month"
                          icon={<ChevronRight size={18} />}
                        />
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
                  className={`${activePage === 'notes' ? '' : 'page-transition '}w-full ${
                    activePage === 'calendar' ? '' : 'h-full'
                  }`.trim()}
                >
                  {!hasVault ? (
                    <VaultSelectionPage
                      lastVaultPath={lastVaultPath}
                      onOpenVault={() => {
                        void openVault('open')
                      }}
                      onCreateVault={() => {
                        void openVault('create')
                      }}
                    />
                  ) : activePage === 'notes' ? (
                    searchQuery.trim() ? (
                      <SearchPage
                        results={searchResults}
                        onOpen={(relPath) => {
                          void openNote(relPath)
                          setSearchQuery('')
                          setSearchResults([])
                        }}
                      />
                    ) : noteIsOpen && currentNotePath ? (
                      <EditorPage
                        editorRef={currentNoteEditorRef}
                        editorSessionKey={currentNoteEditorVersion}
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
                        onOutlineChange={setCurrentNoteOutline}
                        onJumpToHeadingChange={(next) => setJumpToNoteHeading(() => next)}
                      />
                    ) : shouldRestoreLastOpenedNote ? (
                      <div className="p-5 text-sm text-[var(--muted)]">Opening your last note…</div>
                    ) : (
                      <div className="p-5 text-sm text-[var(--muted)]">
                        Pick a note from the right panel to open details
                      </div>
                    )
                  ) : activePage === 'dashboard' ? (
                    <DashboardPage
                      projects={projects}
                      currentWeek={currentWeeklyPlanWeek}
                      currentWeekPriorities={currentWeekPriorities}
                      tasks={calendarTasks}
                      weeklyPlanLoading={weeklyPlanLoading}
                      weeklyPlanReady={weeklyPlanReady}
                      onOpenProject={(projectId) => {
                        selectProject(projectId)
                        void navigateToPage('projects')
                      }}
                      onOpenProjects={() => {
                        void navigateToPage('projects')
                      }}
                      onOpenWeeklyPlan={() => {
                        void navigateToPage('weeklyPlan')
                      }}
                    />
                  ) : activePage === 'knowledge' ? (
                    <KnowledgePage
                      notes={notes}
                      onOpenNote={(relPath) => {
                        void navigateToPage('notes')
                        setSearchQuery('')
                        setSearchResults([])
                        void openNote(relPath)
                      }}
                    />
                  ) : activePage === 'projects' ? (
                    selectedProject ? (
                      <ProjectDetailsPage
                        project={selectedProject}
                        notes={notes}
                        focusedMilestoneId={
                          focusedMilestoneTarget?.projectId === selectedProject.id
                            ? focusedMilestoneTarget.milestoneId
                            : null
                        }
                        focusedMilestoneToken={
                          focusedMilestoneTarget?.projectId === selectedProject.id
                            ? focusedMilestoneTarget.token
                            : 0
                        }
                        nameEditToken={
                          projectNameEditTarget?.projectId === selectedProject.id
                            ? projectNameEditTarget.token
                            : 0
                        }
                        onRename={(nextName) => renameProject(selectedProject.id, nextName)}
                        onUpdateSummary={(nextSummary) =>
                          updateProjectSummary(selectedProject.id, nextSummary)
                        }
                        onAddMilestone={(title, dueDate) =>
                          addMilestoneToProject(selectedProject.id, title, dueDate)
                        }
                        onRenameMilestone={(milestoneId, nextTitle) =>
                          renameProjectMilestone(selectedProject.id, milestoneId, nextTitle)
                        }
                        onUpdateMilestoneDueDate={(milestoneId, nextDueDate) =>
                          updateProjectMilestoneDueDate(
                            selectedProject.id,
                            milestoneId,
                            nextDueDate
                          )
                        }
                        onUpdateMilestoneDescription={(milestoneId, nextDescription) =>
                          updateProjectMilestoneDescription(
                            selectedProject.id,
                            milestoneId,
                            nextDescription
                          )
                        }
                        onToggleMilestoneCollapsed={(milestoneId) =>
                          toggleProjectMilestoneCollapsed(selectedProject.id, milestoneId)
                        }
                        onCycleMilestonePriority={(milestoneId) =>
                          cycleProjectMilestonePriority(selectedProject.id, milestoneId)
                        }
                        onMoveMilestone={(milestoneId, direction) =>
                          moveProjectMilestone(selectedProject.id, milestoneId, direction)
                        }
                        onReorderMilestones={(orderedMilestoneIds) =>
                          reorderProjectMilestones(selectedProject.id, orderedMilestoneIds)
                        }
                        onRemoveMilestone={(milestoneId) =>
                          removeProjectMilestone(selectedProject.id, milestoneId)
                        }
                        onAddSubtask={(milestoneId, title) =>
                          addSubtaskToMilestone(selectedProject.id, milestoneId, title)
                        }
                        onToggleSubtask={(milestoneId, subtaskId) =>
                          toggleMilestoneSubtask(selectedProject.id, milestoneId, subtaskId)
                        }
                        onCycleSubtaskPriority={(milestoneId, subtaskId) =>
                          cycleMilestoneSubtaskPriority(selectedProject.id, milestoneId, subtaskId)
                        }
                        onRenameSubtask={(milestoneId, subtaskId, nextTitle) =>
                          renameMilestoneSubtask(
                            selectedProject.id,
                            milestoneId,
                            subtaskId,
                            nextTitle
                          )
                        }
                        onUpdateSubtaskDescription={(milestoneId, subtaskId, nextDescription) =>
                          updateMilestoneSubtaskDescription(
                            selectedProject.id,
                            milestoneId,
                            subtaskId,
                            nextDescription
                          )
                        }
                        onMoveSubtask={(milestoneId, subtaskId, direction) =>
                          moveMilestoneSubtask(
                            selectedProject.id,
                            milestoneId,
                            subtaskId,
                            direction
                          )
                        }
                        onReorderSubtasks={(milestoneId, orderedSubtaskIds) =>
                          reorderMilestoneSubtasks(
                            selectedProject.id,
                            milestoneId,
                            orderedSubtaskIds
                          )
                        }
                        onRemoveSubtask={(milestoneId, subtaskId) =>
                          removeMilestoneSubtask(selectedProject.id, milestoneId, subtaskId)
                        }
                        onCreateProjectNote={() => {
                          void createProjectNote(selectedProject)
                        }}
                        onOpenNote={(relPath) => {
                          void navigateToPage('notes')
                          void openNote(relPath)
                        }}
                      />
                    ) : (
                      <div className="p-5 text-sm text-[var(--muted)]">
                        Pick a project from the right panel to open details
                      </div>
                    )
                  ) : activePage === 'subscriptions' ? (
                    <SubscriptionsPage vaultApi={vaultApi} pushToast={pushToast} />
                  ) : activePage === 'grid' ? (
                    GRID_PAGE_ENABLED ? (
                      <GridPage
                        board={gridBoardDraft}
                        notes={notes}
                        projects={projects}
                        onActionsChange={setGridWorkspaceActions}
                        onBoardChange={handleGridBoardChange}
                        onOpenNote={(relPath) => {
                          void navigateToPage('notes')
                          setSearchQuery('')
                          setSearchResults([])
                          void openNote(relPath)
                        }}
                        onOpenProject={(projectId) => {
                          void navigateToPage('projects')
                          selectProject(projectId)
                        }}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-8">
                        <div className="max-w-lg rounded-3xl border border-[var(--line)] bg-[var(--panel)] px-8 py-9 text-center shadow-[0_24px_80px_rgba(7,5,18,0.16)]">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                            Unavailable
                          </div>
                          <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">
                            Grid is disabled in this version
                          </h2>
                          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                            The Grid page remains in the codebase, but it is not exposed as an
                            active workspace in this release.
                          </p>
                        </div>
                      </div>
                    )
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
                    <CalendarMonthView
                      selectedDate={selectedCalendarDate}
                      tasks={scheduledCalendarTasks}
                      milestoneEvents={milestoneCalendarEvents}
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
                      onUpdateTaskType={(taskId, taskType) => {
                        void updateCalendarTaskType(taskId, taskType)
                      }}
                      onUpdateTaskTime={(taskId, time) => {
                        void updateCalendarTaskTime(taskId, time)
                      }}
                      onUpdateTaskReminders={(taskId, reminders) => {
                        void updateCalendarTaskReminders(taskId, reminders)
                      }}
                    />
                  ) : activePage === 'settings' ? (
                    <SettingsPage
                      profileName={profileName}
                      mistralApiKey={mistralApiKey}
                      fontOptions={FONT_OPTIONS}
                      selectedFontFamily={fontFamily}
                      vaultLocation={vault?.rootPath ?? lastVaultPath}
                      onSaveProfile={(name) => {
                        void updateProfileName(name)
                      }}
                      onSaveMistralApiKey={(apiKey) => {
                        void updateMistralApiKey(apiKey)
                      }}
                      onSelectFont={(fontFamily) => {
                        void updateFontFamily(fontFamily)
                      }}
                      onChangeVaultLocation={() => {
                        void openVault('open')
                      }}
                      onMigrateBlockNoteNotes={() => {
                        void migrateBlockNoteNotes()
                      }}
                      onMigrateTaggedNoteBodyFrontmatter={() => {
                        void migrateTaggedNoteBodyFrontmatter()
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
              className={`${!showWorkspacePanel || isStandalonePage || isRightPanelCollapsed ? 'hidden' : 'flex'} ${paletteSurfaceClass}${paletteBlurClass}`}
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
                            {notePanelView === 'tree' ? (
                              <WorkspaceActionButton
                                aria-label="Collapse all folders"
                                title="Collapse all folders"
                                icon={<ChevronUp size={18} aria-hidden="true" />}
                                onClick={() =>
                                  setCollapseAllNotesTreeToken((current) => current + 1)
                                }
                              />
                            ) : null}
                            {useNativeMenus ? (
                              <WorkspaceActionButton
                                ref={noteActionsButtonRef}
                                onClick={() => {
                                  void openNativeNoteActionsMenu()
                                }}
                                aria-label="Note actions"
                                title="Note actions"
                                icon={<Plus size={18} aria-hidden="true" />}
                              />
                            ) : (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <WorkspaceActionButton
                                    aria-label="Note actions"
                                    title="Note actions"
                                    icon={<Plus size={18} aria-hidden="true" />}
                                  />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      void (notePanelView === 'tree'
                                        ? createNoteFromTree()
                                        : createNote())
                                    }}
                                  >
                                    New note
                                  </DropdownMenuItem>
                                  {notePanelView === 'tree' ? (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        void createFolderFromTree()
                                      }}
                                    >
                                      New folder
                                    </DropdownMenuItem>
                                  ) : null}
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
                          {notePanelView === 'cards' ? (
                            <>
                              <WorkspaceHeaderActionDivider />
                              <WorkspaceHeaderActionGroup>
                                {useNativeMenus ? (
                                  <WorkspaceActionButton
                                    ref={noteFilterButtonRef}
                                    onClick={() => {
                                      void openNativeNoteFilterMenu()
                                    }}
                                    aria-label={`Filter notes: ${formatNoteFilterMode(noteFilterMode)}`}
                                    title={`Filter notes: ${formatNoteFilterMode(noteFilterMode)}`}
                                    icon={<Funnel size={18} aria-hidden="true" />}
                                  />
                                ) : (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <WorkspaceActionButton
                                        aria-label={`Filter notes: ${formatNoteFilterMode(noteFilterMode)}`}
                                        title={`Filter notes: ${formatNoteFilterMode(noteFilterMode)}`}
                                        icon={<Funnel size={18} aria-hidden="true" />}
                                      />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                      <DropdownMenuRadioGroup
                                        value={noteFilterMode}
                                        onValueChange={(value) =>
                                          setNoteFilterMode(value as NoteFilterMode)
                                        }
                                      >
                                        <DropdownMenuRadioItem value="all">
                                          All
                                        </DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="tagged">
                                          Tagged
                                        </DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="untagged">
                                          Untagged
                                        </DropdownMenuRadioItem>
                                      </DropdownMenuRadioGroup>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                                {useNativeMenus ? (
                                  <WorkspaceActionButton
                                    ref={noteSortButtonRef}
                                    onClick={() => {
                                      void openNativeNoteSortMenu()
                                    }}
                                    aria-label={`Sort notes: ${formatNoteSortLabel(noteSortField, noteSortDirection)}`}
                                    title={`Sort notes: ${formatNoteSortLabel(noteSortField, noteSortDirection)}`}
                                    icon={<ArrowUpDown size={18} aria-hidden="true" />}
                                  />
                                ) : (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <WorkspaceActionButton
                                        aria-label={`Sort notes: ${formatNoteSortLabel(noteSortField, noteSortDirection)}`}
                                        title={`Sort notes: ${formatNoteSortLabel(noteSortField, noteSortDirection)}`}
                                        icon={<ArrowUpDown size={18} aria-hidden="true" />}
                                      />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                      <DropdownMenuRadioGroup
                                        value={noteSortField}
                                        onValueChange={(value) => {
                                          const field = value as NoteSortField
                                          setNoteSortField(field)
                                          setNoteSortDirection(field === 'name' ? 'asc' : 'desc')
                                        }}
                                      >
                                        <DropdownMenuRadioItem value="name">
                                          Name
                                        </DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="created">
                                          Created
                                        </DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="updated">
                                          Updated
                                        </DropdownMenuRadioItem>
                                      </DropdownMenuRadioGroup>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() =>
                                          setNoteSortDirection((current) =>
                                            current === 'asc' ? 'desc' : 'asc'
                                          )
                                        }
                                      >
                                        {noteSortDirection === 'asc' ? (
                                          <ArrowUp size={12} aria-hidden="true" />
                                        ) : (
                                          <ArrowDown size={12} aria-hidden="true" />
                                        )}
                                        Direction:{' '}
                                        {noteSortDirection === 'asc' ? 'Ascending' : 'Descending'}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </WorkspaceHeaderActionGroup>
                            </>
                          ) : null}
                          <WorkspaceHeaderActionDivider />
                          <WorkspaceHeaderActionGroup>
                            <ToggleGroup
                              type="single"
                              value={notePanelView}
                              onValueChange={(value) => {
                                if (value === 'cards' || value === 'tree') {
                                  setNotePanelView(value)
                                }
                              }}
                              variant="outline"
                              size="sm"
                            >
                              <ToggleGroupItem
                                value="cards"
                                aria-label="Card view"
                                data-testid="note-panel-toggle:cards"
                              >
                                <List size={14} aria-hidden="true" />
                              </ToggleGroupItem>
                              <ToggleGroupItem
                                value="tree"
                                aria-label="Tree view"
                                data-testid="note-panel-toggle:tree"
                              >
                                <FolderOpen size={14} aria-hidden="true" />
                              </ToggleGroupItem>
                            </ToggleGroup>
                          </WorkspaceHeaderActionGroup>
                        </WorkspaceHeaderActions>
                      ) : activePage === 'projects' ? (
                        <WorkspaceHeaderActions>
                          <WorkspaceHeaderActionGroup>
                            <WorkspaceActionButton
                              onClick={createProject}
                              aria-label="Add new project"
                              title="Add new project"
                              icon={<Plus size={18} aria-hidden="true" />}
                            />
                          </WorkspaceHeaderActionGroup>
                          <WorkspaceHeaderActionDivider />
                          <WorkspaceHeaderActionGroup>
                            {useNativeMenus ? (
                              <WorkspaceActionButton
                                ref={projectFilterButtonRef}
                                onClick={() => {
                                  void openNativeProjectFilterMenu()
                                }}
                                aria-label={`Filter projects: ${formatProjectFilterMode(projectFilterMode)}`}
                                title={`Filter projects: ${formatProjectFilterMode(projectFilterMode)}`}
                                icon={<Funnel size={18} aria-hidden="true" />}
                              />
                            ) : (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <WorkspaceActionButton
                                    aria-label={`Filter projects: ${formatProjectFilterMode(projectFilterMode)}`}
                                    title={`Filter projects: ${formatProjectFilterMode(projectFilterMode)}`}
                                    icon={<Funnel size={18} aria-hidden="true" />}
                                  />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  <DropdownMenuRadioGroup
                                    value={projectFilterMode}
                                    onValueChange={(value) =>
                                      setProjectFilterMode(value as ProjectFilterMode)
                                    }
                                  >
                                    <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="favorites">
                                      Favorites
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="active">
                                      In Progress
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="completed">
                                      Done
                                    </DropdownMenuRadioItem>
                                  </DropdownMenuRadioGroup>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            {useNativeMenus ? (
                              <WorkspaceActionButton
                                ref={projectSortButtonRef}
                                onClick={() => {
                                  void openNativeProjectSortMenu()
                                }}
                                aria-label={`Sort projects: ${formatProjectSortLabel(projectSortField, projectSortDirection)}`}
                                title={`Sort projects: ${formatProjectSortLabel(projectSortField, projectSortDirection)}`}
                                icon={<ArrowUpDown size={18} aria-hidden="true" />}
                              />
                            ) : (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <WorkspaceActionButton
                                    aria-label={`Sort projects: ${formatProjectSortLabel(projectSortField, projectSortDirection)}`}
                                    title={`Sort projects: ${formatProjectSortLabel(projectSortField, projectSortDirection)}`}
                                    icon={<ArrowUpDown size={18} aria-hidden="true" />}
                                  />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  <DropdownMenuRadioGroup
                                    value={projectSortField}
                                    onValueChange={(value) => {
                                      const field = value as ProjectSortField
                                      setProjectSortField(field)
                                      setProjectSortDirection(field === 'name' ? 'asc' : 'desc')
                                    }}
                                  >
                                    <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="updated">
                                      Updated
                                    </DropdownMenuRadioItem>
                                  </DropdownMenuRadioGroup>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setProjectSortDirection((current) =>
                                        current === 'asc' ? 'desc' : 'asc'
                                      )
                                    }
                                  >
                                    {projectSortDirection === 'asc' ? (
                                      <ArrowUp size={12} aria-hidden="true" />
                                    ) : (
                                      <ArrowDown size={12} aria-hidden="true" />
                                    )}
                                    Direction:{' '}
                                    {projectSortDirection === 'asc' ? 'Ascending' : 'Descending'}
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
                                    <select
                                      value={calendarBulkScope}
                                      onChange={(event) =>
                                        setCalendarBulkScope(
                                          event.currentTarget
                                            .value as (typeof CALENDAR_BULK_SCOPE_OPTIONS)[number]['value']
                                        )
                                      }
                                      className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--text)]"
                                    >
                                      {CALENDAR_BULK_SCOPE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                                      Task Type
                                    </span>
                                    <select
                                      value={calendarBulkTaskType}
                                      onChange={(event) =>
                                        setCalendarBulkTaskType(
                                          event.currentTarget.value as CalendarTaskType
                                        )
                                      }
                                      className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--text)]"
                                    >
                                      {CALENDAR_TASK_TYPE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
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
                      notePanelView === 'tree' ? (
                        <NotesTreeView
                          tree={visibleNoteTree}
                          searchTerm={searchQuery}
                          activeNotePath={currentNotePath}
                          selectedEntry={selectedNoteTreeEntry}
                          collapseAllToken={collapseAllNotesTreeToken}
                          pendingEditId={pendingNoteTreeEditId}
                          onPendingEditHandled={handlePendingNoteTreeEditHandled}
                          onSelectionChange={setSelectedNoteTreeEntry}
                          onOpenNote={(relPath) => {
                            setSearchQuery('')
                            setSearchResults([])
                            void openNote(relPath)
                          }}
                          onCreateNote={(parentDir) => {
                            setSelectedNoteTreeEntry(
                              parentDir ? { kind: 'folder', relPath: parentDir } : null
                            )
                            void createNoteFromTree(parentDir)
                          }}
                          onCreateFolder={(parentDir) => {
                            setSelectedNoteTreeEntry(
                              parentDir ? { kind: 'folder', relPath: parentDir } : null
                            )
                            void createFolderFromTree(parentDir)
                          }}
                          onRenamePath={(relPath, nextName, kind) => {
                            void renameTreePath(relPath, nextName, kind)
                          }}
                          onDeletePath={(relPath, kind) => {
                            void deleteTreePath(relPath, kind)
                          }}
                          onMovePath={moveTreePath}
                        />
                      ) : (
                        <NotePreviewList
                          notes={notes}
                          favoritePaths={favoriteNotePaths}
                          selectedPath={currentNotePath}
                          filter={searchQuery}
                          filterMode={noteFilterMode}
                          sortField={noteSortField}
                          sortDirection={noteSortDirection}
                          onOpen={(relPath) => {
                            setSearchQuery('')
                            setSearchResults([])
                            void openNote(relPath)
                          }}
                          onDelete={(relPath) => {
                            void deleteNoteByPath(relPath)
                          }}
                        />
                      )
                    ) : activePage === 'projects' ? (
                      <ProjectPreviewList
                        projects={projects}
                        favoriteProjectIds={favoriteProjectIds}
                        selectedProjectId={selectedProjectId}
                        filter={projectSearchQuery}
                        filterMode={projectFilterMode}
                        sortField={projectSortField}
                        sortDirection={projectSortDirection}
                        onSelect={handleProjectListSelect}
                        onDelete={(projectId) => {
                          void removeProjectById(projectId)
                        }}
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
                      <div className="flex h-full flex-col gap-4 p-3">
                        <WorkspacePanelSection className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3.5">
                          <WorkspacePanelSectionHeader
                            icon={<Paintbrush size={16} aria-hidden="true" />}
                            heading="Appearance"
                            description="Theme and surface defaults for the workspace"
                          />
                        </WorkspacePanelSection>
                        <WorkspacePanelSection className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3.5">
                          <WorkspacePanelSectionHeader
                            icon={<Type size={16} aria-hidden="true" />}
                            heading="Editor Defaults"
                            description="Type, writing, and editing preferences"
                          />
                        </WorkspacePanelSection>
                        <WorkspacePanelSection className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3.5">
                          <WorkspacePanelSectionHeader
                            icon={<Keyboard size={16} aria-hidden="true" />}
                            heading="Shortcuts"
                            description="Keyboard actions available across the app"
                          />
                        </WorkspacePanelSection>
                      </div>
                    )}
                  </DocumentWorkspacePanelContent>
                </div>
              )}
            </DocumentWorkspacePanel>
          </div>

          <SonnerBridge />
        </SidebarInset>
      </SidebarProvider>
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
          void navigateToPage('projects')
          selectProject(projectId)
        }}
        onOpenPage={(page) => {
          void navigateToPage(page)
        }}
      />
    </div>
  )
}

export default App

function VaultSelectionPage({
  lastVaultPath,
  onOpenVault,
  onCreateVault
}: {
  lastVaultPath: string | null
  onOpenVault: () => void
  onCreateVault: () => void
}): ReactElement {
  return (
    <div data-testid="vault-required-page" className="flex h-full items-center justify-center p-8">
      <div className="max-w-2xl rounded-[28px] border border-[var(--line)] bg-[var(--panel)] px-8 py-9 text-center shadow-[0_24px_80px_rgba(7,5,18,0.12)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]">
          <FolderOpen size={26} />
        </div>
        <h2 className="mt-5 text-3xl font-semibold text-[var(--text)]">Select a vault first</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Open an existing vault or create a new one before accessing notes, projects, calendar,
          grid, and automation pages.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            data-testid="vault-required-open"
            onClick={onOpenVault}
            className="rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] px-4 py-2.5 text-sm font-medium text-[var(--accent)] hover:border-[var(--accent)]"
          >
            Open Existing Vault
          </button>
          <button
            type="button"
            data-testid="vault-required-create"
            onClick={onCreateVault}
            className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:border-[var(--accent)]"
          >
            Create New Vault
          </button>
        </div>
        <div className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-3 text-left text-sm text-[var(--muted)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
            Last Known Vault
          </div>
          <div className="mt-2 break-words text-[var(--text)]">
            {lastVaultPath ?? 'No previous vault remembered on this device.'}
          </div>
        </div>
      </div>
    </div>
  )
}

function sanitizeGridBoardState(
  board: GridBoardState | undefined,
  notes: NoteListItem[],
  projects: Project[]
): GridBoardState {
  const notePaths = new Set(notes.map((note) => note.relPath))
  const projectIds = new Set(projects.map((project) => project.id))
  const fallback: GridBoardState = {
    viewport: {
      x: 0,
      y: 0,
      zoom: 1
    },
    items: []
  }

  if (!board) {
    return fallback
  }

  const viewport = {
    x: Number.isFinite(board.viewport?.x) ? board.viewport.x : fallback.viewport.x,
    y: Number.isFinite(board.viewport?.y) ? board.viewport.y : fallback.viewport.y,
    zoom: Number.isFinite(board.viewport?.zoom) ? board.viewport.zoom : fallback.viewport.zoom
  }

  const items = Array.isArray(board.items)
    ? board.items.flatMap((item) => {
        if (
          !item ||
          typeof item.id !== 'string' ||
          (item.kind !== 'note' && item.kind !== 'project' && item.kind !== 'text') ||
          !Number.isFinite(item.position?.x) ||
          !Number.isFinite(item.position?.y) ||
          !Number.isFinite(item.zIndex)
        ) {
          return []
        }

        if (item.kind === 'note') {
          if (!(typeof item.noteRelPath === 'string' && notePaths.has(item.noteRelPath))) {
            return []
          }
        } else if (item.kind === 'project') {
          if (!(typeof item.projectId === 'string' && projectIds.has(item.projectId))) {
            return []
          }
        } else if (!(item.textContent === undefined || typeof item.textContent === 'string')) {
          return []
        }

        const textStyle = sanitizeGridTextStyle(item.textStyle)
        const rawWidth = item.size?.width
        const rawHeight = item.size?.height
        const size =
          typeof rawWidth === 'number' &&
          Number.isFinite(rawWidth) &&
          typeof rawHeight === 'number' &&
          Number.isFinite(rawHeight) &&
          rawWidth > 0 &&
          rawHeight > 0
            ? {
                width: rawWidth,
                height: rawHeight
              }
            : undefined

        return [
          {
            ...item,
            textStyle,
            size
          }
        ]
      })
    : fallback.items

  return {
    viewport,
    items
  }
}

function isGridBoardStateEqual(left: GridBoardState | undefined, right: GridBoardState): boolean {
  if (!left) {
    return (
      right.items.length === 0 &&
      right.viewport.x === 0 &&
      right.viewport.y === 0 &&
      right.viewport.zoom === 1
    )
  }

  if (
    left.viewport.x !== right.viewport.x ||
    left.viewport.y !== right.viewport.y ||
    left.viewport.zoom !== right.viewport.zoom ||
    left.items.length !== right.items.length
  ) {
    return false
  }

  return left.items.every((item, index) => isGridBoardItemEqual(item, right.items[index]))
}

function isGridBoardItemEqual(
  left: GridBoardState['items'][number],
  right: GridBoardState['items'][number] | undefined
): boolean {
  if (!right) {
    return false
  }

  const leftWidth = left.size?.width
  const leftHeight = left.size?.height
  const rightWidth = right.size?.width
  const rightHeight = right.size?.height

  return (
    left.id === right.id &&
    left.kind === right.kind &&
    left.noteRelPath === right.noteRelPath &&
    left.projectId === right.projectId &&
    left.textContent === right.textContent &&
    isGridTextStyleEqual(left.textStyle, right.textStyle) &&
    left.position.x === right.position.x &&
    left.position.y === right.position.y &&
    left.zIndex === right.zIndex &&
    leftWidth === rightWidth &&
    leftHeight === rightHeight
  )
}

function sanitizeGridTextStyle(style: GridTextStyle | undefined): GridTextStyle | undefined {
  if (!style || typeof style !== 'object') {
    return undefined
  }

  const nextStyle: GridTextStyle = {}

  if (style.fontSize === 'sm' || style.fontSize === 'md' || style.fontSize === 'lg') {
    nextStyle.fontSize = style.fontSize
  }
  if (style.isBold === true) {
    nextStyle.isBold = true
  }
  if (style.isItalic === true) {
    nextStyle.isItalic = true
  }
  if (style.isUnderline === true) {
    nextStyle.isUnderline = true
  }
  if (style.textAlign === 'left' || style.textAlign === 'center' || style.textAlign === 'right') {
    nextStyle.textAlign = style.textAlign
  }
  if (style.color === 'default' || style.color === 'accent' || style.color === 'muted') {
    nextStyle.color = style.color
  }

  return Object.keys(nextStyle).length > 0 ? nextStyle : undefined
}

function isGridTextStyleEqual(
  left: GridTextStyle | undefined,
  right: GridTextStyle | undefined
): boolean {
  return (
    left?.fontSize === right?.fontSize &&
    left?.isBold === right?.isBold &&
    left?.isItalic === right?.isItalic &&
    left?.isUnderline === right?.isUnderline &&
    left?.textAlign === right?.textAlign &&
    left?.color === right?.color
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

function formatCalendarDateLabel(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return isoDate
  }

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatNoteFilterMode(mode: NoteFilterMode): string {
  if (mode === 'tagged') return 'Tagged'
  if (mode === 'untagged') return 'Untagged'
  return 'All'
}

function formatNoteSortLabel(field: NoteSortField, direction: NoteSortDirection): string {
  const label = field === 'name' ? 'Name' : field === 'created' ? 'Created' : 'Updated'
  return `${label} ${direction === 'asc' ? '↑' : '↓'}`
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

function formatProjectFilterMode(mode: ProjectFilterMode): string {
  if (mode === 'favorites') return 'Favorites'
  if (mode === 'active') return 'In Progress'
  if (mode === 'completed') return 'Done'
  return 'All'
}

function formatProjectSortLabel(field: ProjectSortField, direction: ProjectSortDirection): string {
  return `${field === 'name' ? 'Name' : 'Updated'} ${direction === 'asc' ? '↑' : '↓'}`
}

function isNestedPath(candidate: string | null, parentPath: string): boolean {
  if (!candidate) {
    return false
  }

  return candidate === parentPath || candidate.startsWith(`${parentPath}/`)
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

function buildDefaultNoteName(): string {
  const now = new Date()
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `note-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours()
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

function getNextTaskPriority(
  priority: CalendarTaskType extends never ? never : 'low' | 'medium' | 'high' | undefined
): 'low' | 'medium' | 'high' {
  if (priority === 'low') {
    return 'medium'
  }
  if (priority === 'medium') {
    return 'high'
  }
  return 'low'
}
