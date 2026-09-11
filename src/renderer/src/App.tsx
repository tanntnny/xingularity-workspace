import { Fragment, ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  ChevronDown,
  Copy,
  Download,
  LayoutGrid,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  FolderOpen,
  ChevronUp,
  Star,
  StarOutline,
  FileText,
  PenTool,
  ListTodo,
  RefreshCw
} from './components/ui/icons'
import {
  CalendarTask,
  CondaEnvironment,
  FleetingConversionResult,
  FleetingConversionTarget,
  FleetingNote,
  NoteVimKeyMapping,
  NoteListItem,
  NoteImportResult,
  NoteTreeNode,
  Project,
  ProjectIconStyle,
  ProjectMeetingOutcome,
  ProjectMeetingType,
  ProjectMilestone,
  UpdateProjectMilestoneInput,
  ProjectPropertiesPatch,
  ProjectState,
  ProjectUpdateStatus,
  NativeMenuItemDescriptor,
  RendererVaultApi,
  TaskPriority,
  TaskRecurrenceDraft,
  TaskReminder,
  TaskScheduleOverride,
  CalendarTaskType,
  HistoryAffectedAreas,
  VaultOpenResult,
  ResourceRef,
  ResourceRelation,
  ResourceLocator,
  ResourceInput,
  ResourceUpdateInput,
  GoogleDriveFileCandidate,
  WorkspaceFeatureFlags,
  WorkspaceView,
  WorkspaceViewSource
} from '../../shared/types'
import { isExcalidrawPath, stripNotebookFileExtension } from '../../shared/excalidrawFile'
import { normalizeProjectIcon } from '../../shared/projectIcons'
import type { FolderColorMap } from '../../shared/folderColors'
import { createWorkspaceView } from '../../shared/workspaceViews'
import { notebookPathFromResource } from '../../shared/resourceDomain'
import { normalizeCalendarEndDate } from '../../shared/calendarTaskDates'
import { validateTaskDependencies } from '../../shared/projectPlanning'
import { isTaskDone, isTaskStatusDone } from '../../shared/taskStatus'
import { normalizeTaskTags } from '../../shared/taskTags'
import {
  appendTextToNoteMarkdown,
  getNoteDisplayName,
  isNotePath,
  parseStoredNoteDocument,
  serializeStoredNoteDocument,
  stripNoteExtension,
  withNoteExtension
} from '../../shared/noteDocument'
import { splitNoteContent } from '../../shared/noteContent'
import { mergeMarkdownThreeWay } from '../../shared/markdownMerge'
import { normalizeTag } from '../../shared/noteTags'
import {
  getAppFontOption,
  getCodeFontOption,
  type AppFontId
} from '../../shared/fontCatalog'
import {
  createNoteMentionResolver,
  extractMentionTargetsFromMarkdown
} from '../../shared/noteMentions'
import { CalendarMonthView } from './components/CalendarMonthView'
import { CalendarWeekView } from './components/CalendarWeekView'
import { CalendarDayView } from './components/CalendarDayView'
import { CalendarTaskPanel } from './components/CalendarTaskPanel'
import { TaskEditDialog } from './components/TaskEditDialog'
import type { WeeklyTimedCreateSchedule } from './lib/calendarWeekDrag'
import { TaskPropertiesPanel } from './components/TaskPropertiesPanel'
import { CalendarTaskFilter } from './components/CalendarTaskFilter'
import { CommandPalette, type CommandPaletteSearchResult } from './components/CommandPalette'
import { NotesTreeView } from './components/NotesTreeView'
import { NotebookCardBrowser } from './components/NotebookCardBrowser'
import { NotebookFolderIcon } from './components/ui/notebook-folder-icon'
import { NoteShapeIcon } from './components/NoteShapeIcon'
import { NoteOutlinePanel } from './components/NoteOutlinePanel'
import { NoteBacklinksPanel } from './components/NoteBacklinksPanel'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from './components/ui/dropdown-menu'
import { ActionMenuItems } from './components/ui/action-menu'
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
  WorkspaceIconButton,
  WorkspaceHeaderActionGroup,
  WorkspaceHeaderActions,
  WorkspaceHeaderSecondaryActionsRight,
  WorkspacePageContextMenu
} from './components/ui/document-workspace'
import { EmptyState } from './components/ui/empty-state'
import {
  CollapsibleWorkspacePanelSection,
  WorkspacePanelSection
} from './components/ui/workspace-panel-section'
import { TabToggleGroup, TabToggleGroupItem } from './components/ui/tab-toggle-group'
import { EditorPage } from './pages/EditorPage'
import {
  ProjectsWorkspaceBreadcrumb,
  ProjectsWorkspacePage,
  ProjectsWorkspaceRightPanel,
  ProjectsWorkspaceSecondaryActions,
  type ProjectsWorkspaceView
} from './pages/ProjectsWorkspacePage'
import { getProjectResourceRows } from './lib/projectResources'
import { SearchPage } from './pages/SearchPage'
import { ResourcesPage } from './pages/ResourcesPage'
import { TasksPage } from './pages/TasksPage'
import { SettingsPage, type SettingsTabId } from './pages/SettingsPage'
import {
  SchedulingContextMenuItems,
  SchedulingAddAutomationButton,
  SchedulingPage,
  SchedulingRightPanel,
  SchedulingTopbarActions,
  SchedulingWorkspaceBreadcrumb,
  SchedulingWorkspaceProvider
} from './pages/SchedulingPage'
import { SchedulingApiGuidePage } from './pages/SchedulingApiGuidePage'
import { SchedulingViewTabs } from './components/scheduling/SchedulingViewTabs'
import { SchedulingPythonTrustPopover } from './components/scheduling/SchedulingPythonTrustPopover'
import type { SchedulingView } from './components/scheduling/types'
import { SubscriptionsPage } from './pages/SubscriptionsPage'
import {
  ExcalidrawFileEditor,
  type ExcalidrawFileEditorHandle
} from './components/ExcalidrawFileEditor'
import { NoteExportDialog, type NoteExportFormat } from './components/NoteExportDialog'
import { KnowledgePage } from './pages/KnowledgePage'
import {
  KnowledgeGraphSettingsPanel,
  KnowledgeOrphanVisibilityPanel
} from './components/KnowledgeWorkspaceRightPanels'
import { DesignAuditRightPanel } from './components/DesignAuditRightPanel'
import { DesignAuditPage } from './pages/DesignAuditPage'
import { TaskPage } from './pages/TaskPage'
import { MilestonePage } from './pages/MilestonePage'
import { NoVaultPage } from './pages/NoVaultPage'
import { CapturePage } from './pages/CapturePage'
import type { VaultSyncPageActions } from './pages/VaultSyncPage'
import { WorkspaceViewPage, type WorkspaceViewUpdate } from './pages/WorkspaceViewPage'
import type {
  VaultSyncChange,
  VaultSyncConflict,
  VaultSyncRepair,
  VaultSyncSnapshot as VaultSyncPageSnapshot
} from './lib/vaultSyncPresentation'
import type {
  VaultChangeEvent,
  VaultFileRevision,
  VaultSyncSnapshot as VaultProtocolSnapshot
} from '../../shared/vaultProtocol'
import type { ProjectMenuActionHandlers } from './lib/projectMenu'
import { getProjectMenuGroups } from './lib/projectMenu'
import { VaultSwapperDialog } from './components/VaultSwapperDialog'
import { WorkspaceViewBreadcrumb } from './components/WorkspaceViewBreadcrumb'
import { useVaultStore } from './state/store'
import { usePersistentState } from './hooks/usePersistentState'
import { useWorkspaceShellShortcuts } from './hooks/useWorkspaceShellShortcuts'
import type { TaskOpenOptions } from './lib/taskOpenOptions'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbButton,
  BreadcrumbIconLabel,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from './components/ui/breadcrumb'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from './components/ui/alert-dialog'
import {
  filterCalendarTasks,
  filterCalendarTasksByTags,
  getCalendarTaskTagOptions,
  isCalendarTaskOnDate,
  normalizeCalendarTasks,
  type CalendarContentFilter
} from './lib/calendarTasks'
import { APP_PAGE_ICONS } from './lib/pageIcons'
import { DEFAULT_DESIGN_AUDIT_TAB, type DesignAuditTabId } from './lib/designAuditCatalog'
import { type NoteEditorSnapshot, type NoteEditorSessionSnapshot } from './lib/noteEditorSession'
import { extractNoteOutlineFromMarkdown } from './lib/noteOutline'
import { createLatestRefreshCoordinator } from './lib/latestRefreshCoordinator'
import { createNoteSaveCoordinator, NoteSaveConflictError } from './lib/noteSaveCoordinator'
import { createProjectSaveCoordinator } from './lib/projectSaveCoordinator'
import { getNotebookFolderContents } from './lib/notebookFolderContents'
import { formatWeekRange, shiftIsoMonthClamped } from './lib/calendarDate'
import {
  getPrimaryNoteTreeSelectionEntry,
  normalizeNoteTreeSelection,
  type NoteTreeSelection
} from './lib/noteTreeSelection'
import { canUseNativeMenus, getElementMenuPosition, showNativeMenu } from './lib/nativeMenu'
import { buildRenamedNotebookPath } from './lib/notebookPathRename'
import { type ProjectsWorkspaceFilterMode } from './pages/ProjectsWorkspacePage'
import {
  createEmptyNotebookWorkspaceSession,
  getNextActiveWorkspaceTabId,
  type NotebookWorkspaceSession,
  remapNotebookWorkspaceSessionPaths,
  removeNotebookWorkspaceSessionPaths
} from './lib/workspaceTabs'
import {
  rememberRecentNotebookPath as rememberNotebookPath,
  remapRecentNotebookPaths,
  removeRecentNotebookPaths
} from '../../shared/recentNotebookFiles'
import {
  getRecentPageTargetId,
  normalizeRecentPageTargets,
  rememberRecentPageTarget,
  remapRecentPageTargets,
  removeRecentPageTargets,
  type RecentPageTarget
} from '../../shared/recentPages'
const PAGE_LABELS: Record<AppPage, string> = {
  capture: 'Capture',
  knowledge: 'Knowledge',
  notes: 'Notebooks',
  projects: 'Projects',
  tasks: 'Tasks',
  resources: 'Resources',
  subscriptions: 'Subscriptions',
  calendar: 'Calendar',
  schedules: 'Scheduling',
  schedulingGuide: 'API Guide',
  designAudit: 'Design Audit',
  settings: 'Settings'
}

function toVaultSyncPageSnapshot(snapshot: VaultProtocolSnapshot): VaultSyncPageSnapshot {
  const status = snapshot.status
  const watcherStatus =
    status.state === 'offline'
      ? 'offline'
      : status.state === 'needs-repair' || status.state === 'conflict'
        ? 'error'
        : 'watching'
  const reconcileStatus =
    status.state === 'reconciling'
      ? 'running'
      : status.lastError
        ? 'failed'
        : status.lastScanAt
          ? 'complete'
          : 'idle'
  const externalChanges: VaultSyncChange[] = snapshot.events.map((event) => ({
    id: `${event.transactionId}:${event.sequence}`,
    path: event.path,
    domain: event.domain,
    kind: event.kind === 'repair' ? 'change' : event.kind,
    observedAt: event.observedAt,
    source: event.source,
    previousPath: event.previousPath,
    transactionId: event.transactionId
  }))
  const conflicts: VaultSyncConflict[] = snapshot.conflicts.map((conflict) => ({
    id: conflict.id,
    path: conflict.path,
    domain: conflict.domain,
    kind:
      conflict.kind === 'binary'
        ? 'binary'
        : conflict.kind === 'delete-update'
          ? 'delete-update'
          : conflict.kind === 'add-add'
            ? 'add-add'
            : conflict.domain === 'notes'
              ? 'content'
              : 'structured',
    summary: `A ${conflict.kind} conflict is waiting for review.`,
    createdAt: conflict.detectedAt
  }))
  const repairs: VaultSyncRepair[] = snapshot.quarantine.map((record) => ({
    id: record.id,
    path: record.path,
    domain: record.domain,
    kind: 'quarantine',
    summary: record.reason,
    createdAt: record.quarantinedAt
  }))

  return {
    vaultPath: status.vaultPath,
    vaultId: status.vaultId,
    watcher: {
      status: watcherStatus,
      watchedRoots: status.watchedRoots ?? 0,
      lastEventAt: snapshot.events.at(-1)?.observedAt ?? null,
      message: status.lastError ?? null
    },
    reconcile: {
      status: reconcileStatus,
      message: status.lastError ?? null
    },
    lastScanAt: status.lastScanAt,
    lastCommittedSequence: status.lastCommittedSequence,
    externalChanges,
    conflicts,
    repairs,
    portableScope: {
      includedCategories: ['notes', 'drawings', 'attachments', 'structured records'],
      excludedCategories: ['indexes', 'device state', 'secrets', 'recovery payloads']
    }
  }
}

interface NoteConflictState {
  path: string
  message: string
  actualRevision: VaultFileRevision | null
}

type CalendarViewMode = 'month' | 'week' | 'day'

type CalendarTaskSchedule = {
  date?: string
  endDate?: string
  time?: string
  endTime?: string
}

type WorkspacePageTab = {
  id: string
  page: AppPage
  workspaceViewId: string | null
  projectId: string | null
  projectView: ProjectsWorkspaceView
  calendarDate: string
  calendarViewMode: CalendarViewMode
}

type TaskOrigin =
  | {
      source: 'calendar'
      selectedDate: string
      viewMode: CalendarViewMode
      contentFilter: CalendarContentFilter
      tags: string[]
    }
  | { source: 'tasks'; workspaceViewId?: string }
  | { source: 'projects'; projectId: string | null; milestoneId?: string }

type TaskOriginRequest =
  | { source: 'calendar' }
  | { source: 'tasks'; workspaceViewId?: string }
  | { source: 'projects'; projectId: string | null; milestoneId?: string }

const INITIAL_WORKSPACE_TAB_ID = 'workspace-tab-1'

function createWorkspacePageTab(
  id: string,
  page: AppPage,
  context: Partial<
    Pick<
      WorkspacePageTab,
      'workspaceViewId' | 'projectId' | 'projectView' | 'calendarDate' | 'calendarViewMode'
    >
  > = {}
): WorkspacePageTab {
  return {
    id,
    page,
    workspaceViewId: null,
    projectId: null,
    projectView: 'list',
    calendarDate: toIsoDate(new Date()),
    calendarViewMode: 'month',
    ...context
  }
}

const WORKSPACE_RIGHT_PANEL_DEFAULT_WIDTH = 300
const WORKSPACE_RIGHT_PANEL_MIN_WIDTH = 220
const WORKSPACE_RIGHT_PANEL_MAX_WIDTH = 480
const WORKSPACE_RIGHT_PANEL_STORAGE_KEY = 'workspace_right_panel_width'
const WORKSPACE_RIGHT_PANEL_PAGES: AppPage[] = [
  'capture',
  'knowledge',
  'notes',
  'projects',
  'subscriptions',
  'calendar',
  'schedules',
  'schedulingGuide',
  'designAudit',
  'settings'
]

type WorkspaceRightPanelWidthMap = Partial<Record<AppPage, number>>
type StoredWorkspaceRightPanelWidth = number | WorkspaceRightPanelWidthMap

function clampWorkspaceRightPanelWidth(width: number): number {
  if (!Number.isFinite(width)) {
    return WORKSPACE_RIGHT_PANEL_DEFAULT_WIDTH
  }

  return Math.min(
    WORKSPACE_RIGHT_PANEL_MAX_WIDTH,
    Math.max(WORKSPACE_RIGHT_PANEL_MIN_WIDTH, Math.round(width))
  )
}

function isValidWorkspaceRightPanelWidth(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= WORKSPACE_RIGHT_PANEL_MIN_WIDTH &&
    value <= WORKSPACE_RIGHT_PANEL_MAX_WIDTH
  )
}

function isStoredWorkspaceRightPanelWidth(value: unknown): value is StoredWorkspaceRightPanelWidth {
  if (isValidWorkspaceRightPanelWidth(value)) {
    return true
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  return Object.entries(value).every(
    ([page, width]) =>
      WORKSPACE_RIGHT_PANEL_PAGES.includes(page as AppPage) &&
      isValidWorkspaceRightPanelWidth(width)
  )
}

function seedWorkspaceRightPanelWidths(width: number): WorkspaceRightPanelWidthMap {
  const seededWidth = clampWorkspaceRightPanelWidth(width)

  return WORKSPACE_RIGHT_PANEL_PAGES.reduce<WorkspaceRightPanelWidthMap>((widths, page) => {
    widths[page] = seededWidth
    return widths
  }, {})
}

function getWorkspaceRightPanelWidth(
  storedWidth: StoredWorkspaceRightPanelWidth,
  page: AppPage
): number {
  if (typeof storedWidth === 'number') {
    return clampWorkspaceRightPanelWidth(storedWidth)
  }

  return clampWorkspaceRightPanelWidth(storedWidth[page] ?? WORKSPACE_RIGHT_PANEL_DEFAULT_WIDTH)
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
  { value: 'week', label: 'Weekly' },
  { value: 'day', label: 'Daily' }
]

const NOTE_AUTOSAVE_DELAY_MS = 1200
const EMPTY_FEATURE_FLAGS: Partial<WorkspaceFeatureFlags> = {}

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
  const workspaceViews = useVaultStore((state) => state.settings.workspaceViews ?? [])
  const lastOpenedNotePath = useVaultStore((state) => state.settings.lastOpenedNotePath)
  const recentNotebookPaths = useVaultStore((state) => state.settings.recentNotebookPaths)
  const recentPageTargets = useVaultStore((state) => state.settings.recentPageTargets ?? [])
  const favoriteNotePathSettings = useVaultStore((state) => state.settings.favoriteNotePaths)
  const favoriteProjectIdSettings = useVaultStore((state) => state.settings.favoriteProjectIds)
  const fontFamily = useVaultStore((state) => state.settings.fontFamily)
  const codeFontFamily = useVaultStore((state) => state.settings.codeFontFamily)
  const featureFlags = useVaultStore((state) => state.settings.featureFlags ?? EMPTY_FEATURE_FLAGS)
  const [googleDriveConnected, setGoogleDriveConnected] = useState(false)
  const editorVimModeEnabled = useVaultStore((state) => state.settings.editorVimModeEnabled)
  const editorVimKeyMappings = useVaultStore((state) => state.settings.editorVimKeyMappings)
  const profileName = useVaultStore((state) => state.settings.profile.name)
  const lastVaultPath = useVaultStore((state) => state.settings.lastVaultPath)
  const projectIcons = useVaultStore((state) => state.settings.projectIcons)
  const folderColors = useVaultStore((state) => state.settings.folderColors)
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

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--app-font-family',
      getAppFontOption(fontFamily).cssFamily
    )
  }, [fontFamily])

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--code-font-family',
      getCodeFontOption(codeFontFamily).cssFamily
    )
  }, [codeFontFamily])
  const [activePage, setActivePage] = useState<AppPage>('notes')
  const [settingsTabRequest, setSettingsTabRequest] = useState<SettingsTabId>('profile')
  const [activeDesignAuditTab, setActiveDesignAuditTab] =
    useState<DesignAuditTabId>(DEFAULT_DESIGN_AUDIT_TAB)
  const [vaultSyncPageStatus, setVaultSyncPageStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  )
  const [vaultSyncSnapshot, setVaultSyncSnapshot] = useState<VaultSyncPageSnapshot | null>(null)
  const [noteConflict, setNoteConflict] = useState<NoteConflictState | null>(null)
  const [openTaskDialogId, setOpenTaskDialogId] = useState<string | null>(null)
  const [taskDialogOrigin, setTaskDialogOrigin] = useState<TaskOriginRequest | null>(null)
  const [taskDialogIsNewTask, setTaskDialogIsNewTask] = useState(false)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [taskOrigin, setTaskOrigin] = useState<TaskOrigin | null>(null)
  const [openMilestoneDialogId, setOpenMilestoneDialogId] = useState<string | null>(null)
  const [milestoneDialogIsNew, setMilestoneDialogIsNew] = useState(false)
  const taskOriginRef = useRef<TaskOrigin | null>(null)
  const [isTaskDeleteDialogOpen, setIsTaskDeleteDialogOpen] = useState(false)
  const [schedulingReviewCount, setSchedulingReviewCount] = useState(0)
  const schedulingReviewRequestRef = useRef(0)
  const [schedulingView, setSchedulingView] = useState<SchedulingView>('list')
  useEffect(() => {
    if (activePage !== 'schedules') {
      setSchedulingView('list')
    }
  }, [activePage])

  const refreshSchedulingReviewCount = useCallback(async (): Promise<void> => {
    const requestId = ++schedulingReviewRequestRef.current
    const requestedVaultRoot = vault?.rootPath ?? null

    if (!vaultApi || !requestedVaultRoot) {
      setSchedulingReviewCount(0)
      return
    }

    try {
      const jobs = await vaultApi.schedules.listJobs()
      if (requestId !== schedulingReviewRequestRef.current) {
        return
      }
      setSchedulingReviewCount(jobs.filter((job) => job.lastStatus === 'review').length)
    } catch {
      // Keep the last known count when the non-critical indicator cannot refresh.
    }
  }, [vault?.rootPath, vaultApi])

  useEffect(() => {
    void refreshSchedulingReviewCount()

    if (!vaultApi || !vault?.rootPath) {
      return
    }

    const interval = window.setInterval(() => {
      void refreshSchedulingReviewCount()
    }, 5000)

    return () => window.clearInterval(interval)
  }, [refreshSchedulingReviewCount, vault?.rootPath, vaultApi])
  const [workspaceTabs, setWorkspaceTabs] = useState<WorkspacePageTab[]>([
    createWorkspacePageTab(INITIAL_WORKSPACE_TAB_ID, 'notes')
  ])
  const [activeWorkspaceTabId, setActiveWorkspaceTabId] = useState(INITIAL_WORKSPACE_TAB_ID)
  const workspaceTabSequenceRef = useRef(1)
  const activeWorkspaceTabIdRef = useRef(INITIAL_WORKSPACE_TAB_ID)
  const activeWorkspaceViewIdRef = useRef<string | null>(null)
  const workspaceViewsWriteVersionRef = useRef(0)
  const workspaceTabSessionsRef = useRef<Record<string, NotebookWorkspaceSession>>({
    [INITIAL_WORKSPACE_TAB_ID]: createEmptyNotebookWorkspaceSession()
  })
  const [knowledgeOrphanRingRadiusInput, setKnowledgeOrphanRingRadiusInput] = useState('')
  const [knowledgeShowOrphans, setKnowledgeShowOrphans] = useState(true)
  const availablePages = useMemo(() => getAvailablePages(platform), [platform])
  const useNativeMenus = platform.capabilities.supportsNativeMenus && canUseNativeMenus()
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [mistralApiKeyConfigured, setMistralApiKeyConfigured] = useState(false)
  const pythonCondaEnvironmentPath = useVaultStore(
    (state) => state.settings.pythonCondaEnvironmentPath
  )
  const pythonCondaExecutablePath = useVaultStore(
    (state) => state.settings.pythonCondaExecutablePath
  )
  const [condaEnvironments, setCondaEnvironments] = useState<CondaEnvironment[]>([])
  const [condaEnvironmentsLoading, setCondaEnvironmentsLoading] = useState(false)
  const [condaEnvironmentsError, setCondaEnvironmentsError] = useState<string | null>(null)
  const [detectedCondaExecutablePath, setDetectedCondaExecutablePath] = useState<string | null>(
    null
  )

  useEffect(() => {
    if (!vaultApi || !vault?.rootPath) {
      setMistralApiKeyConfigured(false)
      return
    }

    let cancelled = false
    void vaultApi.credentials
      .status('mistral')
      .then((status) => {
        if (!cancelled) {
          setMistralApiKeyConfigured(status.configured)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMistralApiKeyConfigured(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [vault?.rootPath, vaultApi])
  const settingsMutationVersionRef = useRef(0)
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => toIsoDate(new Date()))
  const [calendarViewMode, setCalendarViewMode] = usePersistentState<CalendarViewMode>(
    'calendar-view-mode',
    'month',
    {
      validate: (value): value is CalendarViewMode =>
        value === 'month' || value === 'week' || value === 'day'
    }
  )
  const [calendarContentFilter, setCalendarContentFilter] =
    usePersistentState<CalendarContentFilter>('calendar-content-filter', 'all', {
      validate: (value): value is CalendarContentFilter =>
        value === 'all' || value === 'projectTasks' || value === 'nonProjectTasks'
    })
  const [calendarTaskTagSettings, setCalendarTaskTagSettings] = usePersistentState<string[]>(
    'calendar-task-tags',
    [],
    {
      validate: (value): value is string[] =>
        Array.isArray(value) && value.every((tag) => typeof tag === 'string')
    }
  )
  const restoreTaskOrigin = useCallback((): void => {
    const origin = taskOriginRef.current
    if (!origin || origin.source !== 'calendar') {
      return
    }

    setSelectedCalendarDate(origin.selectedDate)
    setCalendarViewMode(origin.viewMode)
    setCalendarContentFilter(origin.contentFilter)
    setCalendarTaskTagSettings(origin.tags)
  }, [setCalendarContentFilter, setCalendarTaskTagSettings, setCalendarViewMode])
  const [calendarHeaderNewTask, setCalendarHeaderNewTask] = useState('')
  const [fleetingNotes, setFleetingNotes] = useState<FleetingNote[]>([])
  const [fleetingNotesLoading, setFleetingNotesLoading] = useState(false)
  const [resourceSnapshot, setResourceSnapshot] = useState<{
    resources: ResourceRef[]
    relations: ResourceRelation[]
    locators: ResourceLocator[]
  }>({ resources: [], relations: [], locators: [] })
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
  const [isFolderExporting, setIsFolderExporting] = useState(false)
  const [isProjectContextExporting, setIsProjectContextExporting] = useState(false)

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
  const [browseFolderPath, setBrowseFolderPath] = useState<string | null>(null)
  const primarySelectedNoteTreeEntry = getPrimaryNoteTreeSelectionEntry(selectedNoteTreeEntries)
  const [pendingNoteTreeEditId, setPendingNoteTreeEditId] = useState<string | null>(null)
  const handlePendingNoteTreeEditHandled = useCallback((): void => {
    setPendingNoteTreeEditId(null)
  }, [])
  const visibleNoteTree = noteTree
  const handleNotebookBrowseFolder = useCallback(
    (requestedPath: string | null): void => {
      const nextPath = getNotebookFolderContents(noteTree, requestedPath).path
      setBrowseFolderPath(nextPath)
      setSelectedNoteTreeEntries(nextPath ? [{ kind: 'folder', relPath: nextPath }] : [])
    },
    [noteTree]
  )
  const handleNoteTreeSelectionChange = useCallback((entries: NoteTreeSelection): void => {
    setSelectedNoteTreeEntries(entries)
    const primaryEntry = getPrimaryNoteTreeSelectionEntry(entries)
    if (primaryEntry?.kind === 'folder') {
      setBrowseFolderPath(primaryEntry.relPath)
    }
  }, [])
  const projects = settingsProjects
  const hasVault = Boolean(vault?.rootPath)
  const activeWorkspaceViewId = useMemo(
    () => workspaceTabs.find((tab) => tab.id === activeWorkspaceTabId)?.workspaceViewId ?? null,
    [activeWorkspaceTabId, workspaceTabs]
  )
  const activeWorkspaceView = useMemo(
    () => workspaceViews.find((view) => view.id === activeWorkspaceViewId) ?? null,
    [activeWorkspaceViewId, workspaceViews]
  )
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const selectedProjectIdRef = useRef<string | null>(null)
  const [projectView, setProjectView] = useState<ProjectsWorkspaceView>('list')
  const [resourceAddRequestProjectId, setResourceAddRequestProjectId] = useState<string | null>(
    null
  )
  const [resourceAddRequest, setResourceAddRequest] = useState(false)
  const [isRefreshingResourceHealth, setIsRefreshingResourceHealth] = useState(false)
  const handleResourceAddRequestHandled = useCallback((): void => {
    setResourceAddRequestProjectId(null)
  }, [])

  useEffect(() => {
    if (activePage === 'projects' && projectView === 'resources' && selectedProjectId) return
    setResourceAddRequestProjectId(null)
  }, [activePage, projectView, selectedProjectId])

  useEffect(() => {
    if (activePage === 'resources') return
    setResourceAddRequest(false)
  }, [activePage])

  const projectMutationVersionRef = useRef(new Map<string, number>())
  const projectMilestoneMutationVersionRef = useRef(new Map<string, number>())
  const favoriteProjectMutationVersionRef = useRef(new Map<string, number>())
  const [projectFilterMode, setProjectFilterMode] = useState<ProjectsWorkspaceFilterMode>('all')
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
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
  const [workspaceViewToDelete, setWorkspaceViewToDelete] = useState<WorkspaceView | null>(null)
  const [storedRightPanelWidth, setStoredRightPanelWidth] =
    usePersistentState<StoredWorkspaceRightPanelWidth>(
      WORKSPACE_RIGHT_PANEL_STORAGE_KEY,
      WORKSPACE_RIGHT_PANEL_DEFAULT_WIDTH,
      { validate: isStoredWorkspaceRightPanelWidth }
    )
  const rightPanelWidth = getWorkspaceRightPanelWidth(storedRightPanelWidth, activePage)

  useEffect(() => {
    if (typeof storedRightPanelWidth !== 'number') {
      return
    }

    setStoredRightPanelWidth(seedWorkspaceRightPanelWidths(storedRightPanelWidth))
  }, [setStoredRightPanelWidth, storedRightPanelWidth])

  const commandPaletteSearchRequestRef = useRef(0)
  const noteActionsButtonRef = useRef<HTMLButtonElement | null>(null)
  const createNoteRef = useRef<(() => Promise<void>) | null>(null)
  const notesRef = useRef(notes)
  const recentNotebookPathsRef = useRef(recentNotebookPaths)
  const recentNotebookWriteVersionRef = useRef(0)
  const recentPageTargetsRef = useRef(recentPageTargets)
  const recentPageWriteVersionRef = useRef(0)
  const currentNotePathRef = useRef(currentNotePath)
  const currentExcalidrawPathRef = useRef(currentExcalidrawPath)
  const currentNoteContentRef = useRef(currentNoteContent)
  const currentNoteTagsRef = useRef<string[]>([])
  const currentNoteEditorRef = useRef<NoteEditorHandle | null>(null)
  const currentExcalidrawEditorRef = useRef<ExcalidrawFileEditorHandle | null>(null)
  const currentNoteEditorDirtyRef = useRef(false)
  const persistedNoteFingerprintsRef = useRef<Record<string, string>>({})
  const persistedNoteRevisionsRef = useRef<Record<string, string | null>>({})
  const pendingNoteSaveRef = useRef<{ relPath: string; content: string } | null>(null)
  const noteSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteSaveInFlightRef = useRef<Promise<void> | null>(null)
  const openNoteRequestIdRef = useRef(0)
  const externalNoteRefreshRequestRef = useRef(0)
  const previousActivePageRef = useRef(activePage)
  const activePageRef = useRef(activePage)
  const pageNavigationQueueRef = useRef<Promise<void>>(Promise.resolve())
  const taskFlushRef = useRef<(() => Promise<void>) | null>(null)
  const notebookRefreshQueueRef = useRef<Promise<void>>(Promise.resolve())
  const calendarTasksRef = useRef(calendarTasks)
  const hasAttemptedVaultRestoreRef = useRef(false)
  const hasRightPanel =
    Boolean(openTaskId) ||
    (activePage !== 'capture' &&
      activePage !== 'resources' &&
      activePage !== 'tasks' &&
      activePage !== 'schedulingGuide' &&
      activePage !== 'settings' &&
      !(activePage === 'schedules' && schedulingView === 'list') &&
      !(activePage === 'projects' && (projectView === 'list' || projectView === 'resources')))
  const isRightPanelOpen = hasRightPanel && !isRightPanelCollapsed && !isFocusMode
  const workspacePanelKey = [
    activeWorkspaceTabId,
    activePage,
    openTaskId ?? 'workspace',
    activePage === 'schedules'
      ? schedulingView
      : activePage === 'projects'
        ? projectView
        : 'default'
  ].join(':')

  const toggleRightPanel = useCallback((): void => {
    if (isFocusMode) {
      setIsFocusMode(false)
      setIsRightPanelCollapsed(false)
      return
    }

    setIsRightPanelCollapsed((current) => !current)
  }, [isFocusMode])

  const loadCondaEnvironments = useCallback(async (): Promise<void> => {
    if (!vaultApi?.python) {
      setCondaEnvironments([])
      setCondaEnvironmentsError('Conda environment selection is only available in the desktop app.')
      setDetectedCondaExecutablePath(null)
      return
    }

    setCondaEnvironmentsLoading(true)
    setCondaEnvironmentsError(null)
    try {
      const result = await vaultApi.python.listCondaEnvironments()
      setCondaEnvironments(result.environments)
      setDetectedCondaExecutablePath(result.executablePath)
      setCondaEnvironmentsError(result.error)
    } catch (error) {
      setCondaEnvironments([])
      setDetectedCondaExecutablePath(null)
      setCondaEnvironmentsError(String(error))
    } finally {
      setCondaEnvironmentsLoading(false)
    }
  }, [vaultApi])

  useEffect(() => {
    if (activePage !== 'settings') {
      return
    }

    void loadCondaEnvironments()
  }, [activePage, loadCondaEnvironments])

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

  useEffect(() => {
    activeWorkspaceViewIdRef.current = activeWorkspaceViewId
  }, [activeWorkspaceViewId])

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

  const updateActiveWorkspaceTabContext = useCallback(
    (
      patch: Partial<
        Pick<WorkspacePageTab, 'projectId' | 'projectView' | 'calendarDate' | 'calendarViewMode'>
      >
    ): void => {
      const activeTabId = activeWorkspaceTabIdRef.current
      setWorkspaceTabs((tabs) =>
        tabs.map((tab) => (tab.id === activeTabId ? { ...tab, ...patch } : tab))
      )
    },
    []
  )

  useEffect(() => {
    updateActiveWorkspaceTabContext({
      projectId: selectedProjectId,
      projectView,
      calendarDate: selectedCalendarDate,
      calendarViewMode
    })
  }, [
    activeWorkspaceTabId,
    calendarViewMode,
    projectView,
    selectedCalendarDate,
    selectedProjectId,
    updateActiveWorkspaceTabContext
  ])

  useEffect(() => {
    const session = getWorkspaceTabSession()
    session.currentNotePath = currentNotePath
    session.currentExcalidrawPath = currentExcalidrawPath
    session.browseFolderPath = browseFolderPath
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
    browseFolderPath,
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

  useEffect(() => {
    recentNotebookPathsRef.current = recentNotebookPaths
  }, [recentNotebookPaths])

  useEffect(() => {
    recentPageTargetsRef.current = recentPageTargets
  }, [recentPageTargets])

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

  const persistRecentNotebookPaths = useCallback(
    async (paths: readonly string[]): Promise<void> => {
      if (!vaultApi) {
        return
      }

      const nextPaths = Array.from(new Set(paths)).slice(0, 5)
      const currentPaths = recentNotebookPathsRef.current
      if (
        nextPaths.length === currentPaths.length &&
        nextPaths.every((relPath, index) => relPath === currentPaths[index])
      ) {
        return
      }

      recentNotebookPathsRef.current = nextPaths
      patchSettings({ recentNotebookPaths: nextPaths })
      const writeVersion = ++recentNotebookWriteVersionRef.current

      try {
        const nextSettings = await vaultApi.settings.update(
          { recentNotebookPaths: nextPaths },
          { history: false }
        )

        if (writeVersion === recentNotebookWriteVersionRef.current) {
          recentNotebookPathsRef.current = nextSettings.recentNotebookPaths
          patchSettings({ recentNotebookPaths: nextSettings.recentNotebookPaths })
        }
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [patchSettings, pushToast, vaultApi]
  )

  const rememberRecentNotebookFile = useCallback(
    (relPath: string): void => {
      void persistRecentNotebookPaths(rememberNotebookPath(recentNotebookPathsRef.current, relPath))
    },
    [persistRecentNotebookPaths]
  )

  const persistRecentPageTargets = useCallback(
    async (targets: readonly RecentPageTarget[]): Promise<void> => {
      if (!vaultApi) {
        return
      }

      const nextTargets = normalizeRecentPageTargets(targets)
      const currentTargets = normalizeRecentPageTargets(recentPageTargetsRef.current)
      if (
        nextTargets.length === currentTargets.length &&
        nextTargets.every(
          (target, index) => getRecentPageTargetId(target) === getRecentPageTargetId(currentTargets[index])
        )
      ) {
        return
      }

      recentPageTargetsRef.current = nextTargets
      patchSettings({ recentPageTargets: nextTargets })
      const writeVersion = ++recentPageWriteVersionRef.current

      try {
        const nextSettings = await vaultApi.settings.update(
          { recentPageTargets: nextTargets },
          { history: false }
        )

        if (writeVersion === recentPageWriteVersionRef.current) {
          const persistedTargets = normalizeRecentPageTargets(nextSettings.recentPageTargets)
          recentPageTargetsRef.current = persistedTargets
          patchSettings({ recentPageTargets: persistedTargets })
        }
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [patchSettings, pushToast, vaultApi]
  )

  const rememberRecentTarget = useCallback(
    (target: RecentPageTarget): void => {
      void persistRecentPageTargets(
        rememberRecentPageTarget(recentPageTargetsRef.current, target)
      )
    },
    [persistRecentPageTargets]
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

  const updateFolderColor = useCallback(
    async (folderPath: string, color: string | null): Promise<void> => {
      if (!vaultApi) {
        return
      }

      const currentSettings = useVaultStore.getState().settings
      const nextFolderColors: FolderColorMap = { ...currentSettings.folderColors }
      if (color) {
        nextFolderColors[folderPath] = color
      } else {
        delete nextFolderColors[folderPath]
      }

      if (JSON.stringify(nextFolderColors) === JSON.stringify(currentSettings.folderColors)) {
        return
      }

      const mutationVersion = ++settingsMutationVersionRef.current
      flushSync(() => {
        setSettings({ ...currentSettings, folderColors: nextFolderColors })
      })

      try {
        const nextSettings = await vaultApi.settings.update({ folderColors: nextFolderColors })
        if (mutationVersion === settingsMutationVersionRef.current) {
          setSettings(nextSettings)
        }
      } catch (error) {
        if (mutationVersion === settingsMutationVersionRef.current) {
          try {
            setSettings(await vaultApi.settings.get())
          } catch {
            setSettings(currentSettings)
          }
        }
        pushToast('error', String(error))
      }
    },
    [pushToast, setSettings, vaultApi]
  )

  const updateFeatureFlag = useCallback(
    async (key: keyof WorkspaceFeatureFlags, enabled: boolean): Promise<void> => {
      if (!vaultApi) return
      try {
        const nextSettings = await vaultApi.settings.update({ featureFlags: { [key]: enabled } })
        setSettings(nextSettings)
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [pushToast, setSettings, vaultApi]
  )

  const selectProject = useCallback(
    (projectId: string | null): void => {
      const previousProjectId = selectedProjectIdRef.current
      selectedProjectIdRef.current = projectId
      setSelectedProjectId(projectId)
      setOpenMilestoneDialogId(null)
      setMilestoneDialogIsNew(false)
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

  const openProject = useCallback(
    (projectId: string): void => {
      if (projects.some((project) => project.id === projectId)) {
        rememberRecentTarget({ kind: 'project', projectId })
      }
      selectProject(projectId)
      setProjectView('home')
    },
    [projects, rememberRecentTarget, selectProject]
  )

  const openProjectPulse = useCallback(
    (projectId: string): void => {
      selectProject(projectId)
      setProjectView('pulse')
    },
    [selectProject]
  )

  const openProjectMeetings = useCallback(
    (projectId: string): void => {
      selectProject(projectId)
      setProjectView('meetings')
    },
    [selectProject]
  )

  const openProjectResources = useCallback(
    (projectId: string): void => {
      selectProject(projectId)
      setProjectView('resources')
    },
    [selectProject]
  )

  const openAllProjects = useCallback((): void => {
    selectedProjectIdRef.current = null
    setSelectedProjectId(null)
    setProjectView('list')
    setOpenMilestoneDialogId(null)
    setMilestoneDialogIsNew(false)
  }, [])

  const noteIsOpen = Boolean(currentNotePath)
  const currentNoteOutline = useMemo(
    () =>
      noteIsOpen && activePage === 'notes' && !searchQuery.trim() && !currentExcalidrawPath
        ? extractNoteOutlineFromMarkdown(currentNoteContent)
        : [],
    [activePage, currentExcalidrawPath, currentNoteContent, noteIsOpen, searchQuery]
  )
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
    const capturedTabId = activeWorkspaceTabIdRef.current
    const session = getWorkspaceTabSession(capturedTabId)
    let checkpointedSession: NoteEditorSessionSnapshot | null = null
    if (currentNotePathRef.current) {
      checkpointedSession = await checkpointCurrentNote({ updateDraftState: false })
    }

    session.currentNotePath = currentNotePathRef.current
    session.currentExcalidrawPath = currentExcalidrawPathRef.current
    session.browseFolderPath = browseFolderPath
    session.currentNoteContent = checkpointedSession?.content ?? currentNoteContentRef.current
    session.currentNoteTags = [...(checkpointedSession?.tags ?? currentNoteTagsRef.current)]
    session.currentNoteEditorDraft = checkpointedSession?.content ?? currentNoteEditorDraft
    session.searchQuery = searchQuery
    session.searchResults = [...searchResults]
    session.selectedNoteTreeEntries = selectedNoteTreeEntries.map((entry) => ({ ...entry }))
    setWorkspaceTabs((tabs) =>
      tabs.map((tab) =>
        tab.id === capturedTabId
          ? {
              ...tab,
              projectId: selectedProjectId,
              projectView,
              calendarDate: selectedCalendarDate,
              calendarViewMode
            }
          : tab
      )
    )
  }, [
    calendarViewMode,
    checkpointCurrentNote,
    currentNoteEditorDraft,
    getWorkspaceTabSession,
    browseFolderPath,
    projectView,
    selectedCalendarDate,
    selectedProjectId,
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
      setBrowseFolderPath(session.browseFolderPath)
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
      setBrowseFolderPath,
      setCurrentNoteContent,
      setCurrentNotePath,
      setSearchQuery,
      setSearchResults
    ]
  )

  const normalizedCalendarTasks = useMemo(
    () => normalizeCalendarTasks(calendarTasks),
    [calendarTasks]
  )

  const activeTask = useMemo(
    () =>
      openTaskId ? (normalizedCalendarTasks.find((task) => task.id === openTaskId) ?? null) : null,
    [normalizedCalendarTasks, openTaskId]
  )
  const taskDialogTask = useMemo(
    () =>
      openTaskDialogId
        ? (normalizedCalendarTasks.find((task) => task.id === openTaskDialogId) ?? null)
        : null,
    [normalizedCalendarTasks, openTaskDialogId]
  )
  const activeTaskProject = useMemo(
    () =>
      taskOrigin?.source === 'projects' && taskOrigin.projectId
        ? (projects.find((project) => project.id === taskOrigin.projectId) ?? null)
        : null,
    [projects, taskOrigin]
  )
  const taskOriginWorkspaceView = useMemo(
    () =>
      taskOrigin?.source === 'tasks' && taskOrigin.workspaceViewId
        ? (workspaceViews.find((view) => view.id === taskOrigin.workspaceViewId) ?? null)
        : null,
    [taskOrigin, workspaceViews]
  )
  const milestoneDialogProject = useMemo(
    () =>
      selectedProjectId
        ? (projects.find((project) => project.id === selectedProjectId) ?? null)
        : null,
    [projects, selectedProjectId]
  )
  const milestoneDialogMilestone = useMemo(
    () =>
      milestoneDialogProject && openMilestoneDialogId
        ? ((milestoneDialogProject.milestones ?? []).find(
            (milestone) => milestone.id === openMilestoneDialogId
          ) ?? null)
        : null,
    [milestoneDialogProject, openMilestoneDialogId]
  )

  useEffect(() => {
    if (openMilestoneDialogId && !milestoneDialogMilestone) {
      setOpenMilestoneDialogId(null)
      setMilestoneDialogIsNew(false)
    }
  }, [milestoneDialogMilestone, openMilestoneDialogId])

  useEffect(() => {
    taskOriginRef.current = taskOrigin
  }, [taskOrigin])

  useEffect(() => {
    if (
      !openTaskId ||
      activeTask ||
      calendarTasksRef.current.some((task) => task.id === openTaskId)
    ) {
      return
    }

    setOpenTaskId(null)
    setTaskOrigin(null)
  }, [activeTask, openTaskId])

  useEffect(() => {
    if (
      !openTaskDialogId ||
      taskDialogTask ||
      calendarTasksRef.current.some((task) => task.id === openTaskDialogId)
    ) {
      return
    }

    setOpenTaskDialogId(null)
    setTaskDialogOrigin(null)
    setTaskDialogIsNewTask(false)
  }, [openTaskDialogId, taskDialogTask])

  const openTaskDialog = useCallback(
    (taskId: string, origin: TaskOriginRequest, options: TaskOpenOptions = {}): void => {
      setTaskDialogOrigin(origin)
      setTaskDialogIsNewTask(options.isNewTask === true)
      setOpenTaskDialogId(taskId)
    },
    []
  )

  const openMilestoneDialog = useCallback(
    (projectId: string, milestoneId: string, isNew = false): void => {
      selectProject(projectId)
      setProjectView('home')
      setOpenMilestoneDialogId(milestoneId)
      setMilestoneDialogIsNew(isNew)
    },
    [selectProject]
  )

  const closeMilestoneDialog = useCallback((): void => {
    setOpenMilestoneDialogId(null)
    setMilestoneDialogIsNew(false)
  }, [])

  const openTaskPage = useCallback(
    (taskId: string, origin: TaskOriginRequest): void => {
      const nextOrigin: TaskOrigin =
        origin.source === 'calendar'
          ? {
              source: 'calendar',
              selectedDate: selectedCalendarDate,
              viewMode: calendarViewMode,
              contentFilter: calendarContentFilter,
              tags: [...calendarTaskTagSettings]
            }
          : origin
      setOpenTaskDialogId(null)
      setTaskDialogOrigin(null)
      setTaskDialogIsNewTask(false)
      taskOriginRef.current = nextOrigin
      setTaskOrigin(nextOrigin)
      setOpenTaskId(taskId)
    },
    [calendarContentFilter, calendarTaskTagSettings, calendarViewMode, selectedCalendarDate]
  )

  const closeTaskPage = useCallback(async (): Promise<void> => {
    await taskFlushRef.current?.()
    taskFlushRef.current = null
    setOpenTaskDialogId(null)
    setTaskDialogOrigin(null)
    setTaskDialogIsNewTask(false)
    restoreTaskOrigin()
    taskOriginRef.current = null
    setOpenTaskId(null)
    setTaskOrigin(null)
  }, [restoreTaskOrigin])

  const registerTaskFlush = useCallback((flush: (() => Promise<void>) | null): void => {
    taskFlushRef.current = flush
  }, [])

  // Unscheduled tasks have neither a start date nor a deadline.
  const unscheduledTasks = useMemo(() => {
    return normalizedCalendarTasks.filter((task) => !task.date && !task.endDate)
  }, [normalizedCalendarTasks])

  const projectCalendarTasks = useMemo(
    () => normalizedCalendarTasks.filter((task) => Boolean(task.projectId)),
    [normalizedCalendarTasks]
  )
  const nonProjectCalendarTasks = useMemo(
    () => normalizedCalendarTasks.filter((task) => !task.projectId),
    [normalizedCalendarTasks]
  )
  const calendarContentFilterOptions = useMemo(
    () => [
      {
        value: 'all' as const,
        label: 'All',
        count: normalizedCalendarTasks.length
      },
      {
        value: 'projectTasks' as const,
        label: 'Project Tasks',
        count: projectCalendarTasks.length
      },
      {
        value: 'nonProjectTasks' as const,
        label: 'Non-project Tasks',
        count: nonProjectCalendarTasks.length
      }
    ],
    [nonProjectCalendarTasks.length, normalizedCalendarTasks.length, projectCalendarTasks.length]
  )
  const calendarTaskTagOptions = useMemo(
    () => getCalendarTaskTagOptions(normalizedCalendarTasks),
    [normalizedCalendarTasks]
  )
  const calendarTaskTagValues = useMemo(
    () => calendarTaskTagOptions.map((option) => option.value),
    [calendarTaskTagOptions]
  )
  const availableCalendarTaskTags = useMemo(
    () => new Set(calendarTaskTagValues),
    [calendarTaskTagValues]
  )
  const activeCalendarTaskTags = useMemo(
    () =>
      normalizeTaskTags(calendarTaskTagSettings).filter((tag) =>
        availableCalendarTaskTags.has(tag)
      ),
    [availableCalendarTaskTags, calendarTaskTagSettings]
  )
  useEffect(() => {
    if (!settingsLoaded) {
      return
    }

    const tagsChanged =
      activeCalendarTaskTags.length !== calendarTaskTagSettings.length ||
      activeCalendarTaskTags.some((tag, index) => tag !== calendarTaskTagSettings[index])

    if (tagsChanged) {
      setCalendarTaskTagSettings(activeCalendarTaskTags)
    }
  }, [activeCalendarTaskTags, calendarTaskTagSettings, setCalendarTaskTagSettings, settingsLoaded])
  const tagFilteredCalendarTasks = useMemo(
    () => filterCalendarTasksByTags(normalizedCalendarTasks, activeCalendarTaskTags),
    [activeCalendarTaskTags, normalizedCalendarTasks]
  )
  const visibleCalendarTasks = useMemo(
    () => filterCalendarTasks(tagFilteredCalendarTasks, calendarContentFilter),
    [calendarContentFilter, tagFilteredCalendarTasks]
  )
  const visibleUnscheduledTasks = useMemo(
    () =>
      filterCalendarTasks(
        filterCalendarTasksByTags(unscheduledTasks, activeCalendarTaskTags),
        calendarContentFilter
      ),
    [activeCalendarTaskTags, calendarContentFilter, unscheduledTasks]
  )
  const calendarActiveFilterCount =
    activeCalendarTaskTags.length + (calendarContentFilter === 'all' ? 0 : 1)
  const hasActiveCalendarFilter = calendarActiveFilterCount > 0
  const calendarUndoneCount = useMemo(() => {
    return calendarTasks.filter((task) => !isTaskDone(task)).length
  }, [calendarTasks])

  const favoriteProjectIds = useMemo(
    () =>
      favoriteProjectIdSettings.filter((projectId) =>
        projects.some((project) => project.id === projectId)
      ),
    [favoriteProjectIdSettings, projects]
  )
  const selectedProjectForHeader = useMemo(() => {
    if (activePage !== 'projects' || projectView === 'list') {
      return null
    }

    return projects.find((project) => project.id === selectedProjectId) ?? null
  }, [activePage, projectView, projects, selectedProjectId])
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
  const notebookBrowseBreadcrumbSegments = useMemo(() => {
    if (activePage !== 'notes' || searchQuery.trim() || currentNotePath || currentExcalidrawPath) {
      return null
    }

    return browseFolderPath?.split('/').filter(Boolean) ?? []
  }, [activePage, browseFolderPath, currentExcalidrawPath, currentNotePath, searchQuery])

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
    if (!vaultApi || !vault?.rootPath) {
      setResourceSnapshot({ resources: [], relations: [], locators: [] })
      return
    }

    let cancelled = false
    void vaultApi.resources
      .list()
      .then((snapshot) => {
        if (!cancelled) setResourceSnapshot(snapshot)
      })
      .catch((error: unknown) => {
        if (!cancelled) pushToast('error', String(error))
      })

    return () => {
      cancelled = true
    }
  }, [pushToast, vault?.rootPath, vaultApi])

  useEffect(() => {
    if (!vaultApi || !vault?.rootPath) {
      setGoogleDriveConnected(false)
      return
    }

    let cancelled = false
    void vaultApi.credentials
      .status('google-drive')
      .then((status) => {
        if (!cancelled) setGoogleDriveConnected(status.configured)
      })
      .catch(() => {
        if (!cancelled) setGoogleDriveConnected(false)
      })

    return () => {
      cancelled = true
    }
  }, [vault?.rootPath, vaultApi])

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

    if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
      if (selectedProjectId !== null) {
        selectedProjectIdRef.current = null
        setSelectedProjectId(null)
      }
    }
  }, [settingsLoaded, projects, selectedProjectId, setSelectedProjectId])

  const noteSaveCoordinator = useMemo(() => {
    if (!vaultApi) {
      return null
    }

    return createNoteSaveCoordinator({
      writeNote: async ({ relPath, document, baseHash, clientMutationId }) => {
        pushNoteSaveTrace('coordinator:write-start', {
          relPath,
          tagCount: document.tags.length,
          contentPreview: summarizeTraceContent(document.markdown)
        })
        const result = await vaultApi.files.writeNoteDocumentWithRevision({
          path: relPath,
          document,
          baseHash: baseHash ?? null,
          clientMutationId: clientMutationId ?? `${Date.now()}-${Math.random()}`
        })
        if (result.ok) {
          persistedNoteRevisionsRef.current[relPath] = result.revision.contentHash
        }
        pushNoteSaveTrace('coordinator:write-done', {
          relPath,
          tagCount: document.tags.length,
          ok: result.ok
        })
        return result
      }
    })
  }, [pushNoteSaveTrace, vaultApi])

  const projectSaveCoordinator = useMemo(() => {
    if (!vaultApi) {
      return null
    }

    return createProjectSaveCoordinator({
      updateProject: (request) => vaultApi.projects.update(request)
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
        document,
        baseHash: persistedNoteRevisionsRef.current[relPath] ?? null,
        clientMutationId: `${Date.now()}-${Math.random()}`
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
        if (error instanceof NoteSaveConflictError && currentNotePathRef.current === relPath) {
          setNoteConflict({
            path: error.result.path.startsWith('notebooks/')
              ? error.result.path
              : `notebooks/${error.result.path}`,
            message: error.result.error.message,
            actualRevision:
              error.result.error.code === 'compare-and-swap-conflict'
                ? error.result.error.actualRevision
                : null
          })
          pushToast(
            'warning',
            'This note changed outside Xingularity. Review the disk version before saving again.'
          )
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
      pushToast,
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
      const activeElement = document.activeElement
      const editorRoot = document.querySelector<HTMLElement>(
        '[data-testid="note-block-editor"] [contenteditable="true"]'
      )
      const focusIsInEditor = Boolean(
        editorRoot && activeElement && editorRoot.contains(activeElement)
      )
      const focusIsUnclaimed = activeElement === document.body || activeElement === null
      if (shouldRestoreEditorFocus && (focusIsInEditor || focusIsUnclaimed)) {
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

  const handleNotebookBreadcrumbFolderClick = useCallback(
    async (requestedPath: string | null): Promise<void> => {
      try {
        await flushCurrentNote({ force: true, settleEditor: true })
      } catch (error) {
        pushToast('error', String(error))
        return
      }

      const nextPath = getNotebookFolderContents(noteTree, requestedPath).path
      const activeSession = getWorkspaceTabSession()
      activeSession.currentNotePath = null
      activeSession.currentExcalidrawPath = null
      activeSession.currentNoteContent = ''
      activeSession.currentNoteTags = []
      activeSession.currentNoteEditorDraft = null
      activeSession.browseFolderPath = nextPath
      activeSession.selectedNoteTreeEntries = nextPath
        ? [{ kind: 'folder', relPath: nextPath }]
        : []
      if (!nextPath) {
        activeSession.searchQuery = ''
        activeSession.searchResults = []
      }

      currentNotePathRef.current = null
      currentExcalidrawPathRef.current = null
      currentNoteContentRef.current = ''
      currentNoteTagsRef.current = []
      setCurrentNotePath(null)
      setCurrentExcalidrawPath(null)
      setCurrentNoteContent('')
      setCurrentNoteTagsState([])
      resetCurrentNoteEditorSession()
      setBrowseFolderPath(nextPath)
      setSelectedNoteTreeEntries(nextPath ? [{ kind: 'folder', relPath: nextPath }] : [])
      if (!nextPath) {
        setSearchQuery('')
        setSearchResults([])
      }
    },
    [
      flushCurrentNote,
      getWorkspaceTabSession,
      noteTree,
      pushToast,
      resetCurrentNoteEditorSession,
      setCurrentExcalidrawPath,
      setCurrentNoteContent,
      setCurrentNotePath,
      setSearchQuery,
      setSearchResults
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
    async (page: AppPage, workspaceViewId: string | null = null): Promise<void> => {
      const runNavigation = async (): Promise<void> => {
        if (!hasVault) {
          return
        }

        const targetPage = normalizePageForPlatform(platform, page)
        const currentPage = activePageRef.current
        if (targetPage !== 'settings') {
          setSettingsTabRequest('profile')
        }
        await taskFlushRef.current?.()
        taskFlushRef.current = null
        setOpenTaskDialogId(null)
        setTaskDialogOrigin(null)
        restoreTaskOrigin()
        taskOriginRef.current = null
        setOpenTaskId(null)
        setTaskOrigin(null)
        setOpenMilestoneDialogId(null)
        setMilestoneDialogIsNew(false)
        if (targetPage === currentPage && workspaceViewId === activeWorkspaceViewIdRef.current) {
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
        activeWorkspaceViewIdRef.current = workspaceViewId
        setActivePage(targetPage)
        if (targetPage === 'projects') {
          selectedProjectIdRef.current = null
          setSelectedProjectId(null)
          setProjectView('list')
        }
        setWorkspaceTabs((tabs) =>
          tabs.map((tab) =>
            tab.id === activeWorkspaceTabIdRef.current
              ? {
                  ...tab,
                  page: targetPage,
                  workspaceViewId,
                  ...(targetPage === 'projects'
                    ? {
                        projectId: null,
                        projectView: 'list' as ProjectsWorkspaceView
                      }
                    : {})
                }
              : tab
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
    [
      captureActiveWorkspaceSession,
      hasVault,
      persistCurrentNoteForPageLeave,
      platform,
      restoreTaskOrigin
    ]
  )

  const openSettingsTab = useCallback(
    (tab: SettingsTabId): void => {
      setSettingsTabRequest(tab)
      void navigateToPage('settings')
    },
    [navigateToPage]
  )

  useEffect(() => {
    if (!vaultApi || !vault) {
      return
    }

    return vaultApi.reminders.onClick((target) => {
      setSelectedCalendarDate(target.selectedDate)
      setCalendarViewMode(target.view)
      void navigateToPage(target.page).then(() => {
        openTaskDialog(target.taskId, { source: 'calendar' })
      })
    })
  }, [navigateToPage, openTaskDialog, setCalendarViewMode, vault, vaultApi])

  const createWorkspaceTabId = useCallback((): string => {
    workspaceTabSequenceRef.current += 1
    return `workspace-tab-${workspaceTabSequenceRef.current}`
  }, [])

  const getRecentTargetForWorkspaceTab = useCallback(
    (tab: WorkspacePageTab): RecentPageTarget | null => {
      if (tab.workspaceViewId) {
        return { kind: 'view', viewId: tab.workspaceViewId }
      }

      const isActiveTab = tab.id === activeWorkspaceTabIdRef.current
      const projectId = isActiveTab ? selectedProjectIdRef.current : tab.projectId
      const currentProjectView = isActiveTab ? projectView : tab.projectView
      if (tab.page === 'projects' && projectId && currentProjectView === 'home') {
        return { kind: 'project', projectId }
      }

      if (tab.page === 'notes') {
        const session = getWorkspaceTabSession(tab.id)
        const path = isActiveTab
          ? (currentNotePathRef.current ?? currentExcalidrawPathRef.current)
          : (session.currentNotePath ?? session.currentExcalidrawPath)
        if (path) {
          return { kind: isExcalidrawPath(path) ? 'drawing' : 'note', path }
        }
      }

      return null
    },
    [getWorkspaceTabSession, projectView]
  )

  const activateWorkspaceTab = useCallback(
    async (
      tabId: string,
      pageOverride?: AppPage,
      workspaceViewIdOverride?: string | null
    ): Promise<void> => {
      if (!hasVault) {
        return
      }

      const targetTab = workspaceTabs.find((tab) => tab.id === tabId)
      const targetPage = pageOverride ?? targetTab?.page
      const targetWorkspaceViewId =
        workspaceViewIdOverride !== undefined
          ? workspaceViewIdOverride
          : (targetTab?.workspaceViewId ?? null)
      if (!targetPage || !workspaceTabSessionsRef.current[tabId]) {
        return
      }

      if (targetTab) {
        const recentTarget = getRecentTargetForWorkspaceTab({
          ...targetTab,
          page: targetPage,
          workspaceViewId: targetWorkspaceViewId
        })
        if (recentTarget) {
          rememberRecentTarget(recentTarget)
        }
      }

      if (tabId === activeWorkspaceTabIdRef.current) {
        return
      }

      const runActivation = async (): Promise<void> => {
        await taskFlushRef.current?.()
        taskFlushRef.current = null
        setOpenTaskDialogId(null)
        setTaskDialogOrigin(null)
        restoreTaskOrigin()
        taskOriginRef.current = null
        setOpenTaskId(null)
        setTaskOrigin(null)
        setOpenMilestoneDialogId(null)
        setMilestoneDialogIsNew(false)
        await captureActiveWorkspaceSession()
        await stageCurrentNoteForBackgroundSave()

        activeWorkspaceTabIdRef.current = tabId
        activePageRef.current = targetPage
        activeWorkspaceViewIdRef.current = targetWorkspaceViewId
        if (targetPage === 'projects') {
          const targetProjectView = targetTab?.projectView ?? 'list'
          const targetProjectId =
            targetProjectView === 'list'
              ? null
              : targetTab?.projectId &&
                  projects.some((project) => project.id === targetTab.projectId)
                ? targetTab.projectId
                : null
          setProjectView(targetProjectView)
          selectProject(targetProjectId)
        }
        if (targetPage === 'calendar') {
          setSelectedCalendarDate(targetTab?.calendarDate ?? selectedCalendarDate)
          setCalendarViewMode(targetTab?.calendarViewMode ?? calendarViewMode)
        }
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
      calendarViewMode,
      getRecentTargetForWorkspaceTab,
      hasVault,
      projects,
      restoreWorkspaceSession,
      stageCurrentNoteForBackgroundSave,
      restoreTaskOrigin,
      rememberRecentTarget,
      selectProject,
      selectedCalendarDate,
      setCalendarViewMode,
      setSelectedCalendarDate,
      workspaceTabs
    ]
  )

  const openWorkspaceView = useCallback(
    (viewId: string): void => {
      if (!hasVault) {
        return
      }

      const view = (useVaultStore.getState().settings.workspaceViews ?? []).find(
        (candidate) => candidate.id === viewId
      )
      if (!view) {
        return
      }

      rememberRecentTarget({ kind: 'view', viewId: view.id })
      void navigateToPage(view.source, view.id)
    },
    [hasVault, navigateToPage, rememberRecentTarget]
  )

  const updateWorkspaceView = useCallback(
    async (viewId: string, update: WorkspaceViewUpdate): Promise<void> => {
      if (!vaultApi) {
        return
      }

      const currentSettings = useVaultStore.getState().settings
      const currentViews = currentSettings.workspaceViews ?? []
      const currentView = currentViews.find((view) => view.id === viewId)
      if (!currentView) {
        return
      }

      const updatedAt = new Date().toISOString()
      const updatedView: WorkspaceView =
        currentView.source === 'tasks'
          ? {
              ...currentView,
              ...(update.name !== undefined ? { name: update.name } : {}),
              ...(update.icon ? { icon: update.icon } : {}),
              ...(update.config && 'groupBy' in update.config ? { config: update.config } : {}),
              updatedAt
            }
          : {
              ...currentView,
              ...(update.name !== undefined ? { name: update.name } : {}),
              ...(update.icon ? { icon: update.icon } : {}),
              ...(update.config && 'labelFilters' in update.config
                ? { config: update.config }
                : {}),
              updatedAt
            }
      const nextViews = currentViews.map((view) => (view.id === viewId ? updatedView : view))
      const writeVersion = ++workspaceViewsWriteVersionRef.current
      setSettings({ ...currentSettings, workspaceViews: nextViews })

      try {
        const nextSettings = await vaultApi.settings.update(
          { workspaceViews: nextViews },
          { history: false }
        )
        if (writeVersion === workspaceViewsWriteVersionRef.current) {
          setSettings(nextSettings)
        }
      } catch (error) {
        if (writeVersion === workspaceViewsWriteVersionRef.current) {
          try {
            setSettings(await vaultApi.settings.get())
          } catch {
            setSettings(currentSettings)
          }
        }
        pushToast('error', String(error))
      }
    },
    [pushToast, setSettings, vaultApi]
  )

  const handleCreateWorkspaceView = useCallback(
    async (source: WorkspaceViewSource): Promise<void> => {
      if (!vaultApi || !hasVault) {
        return
      }

      const currentSettings = useVaultStore.getState().settings
      const currentViews = currentSettings.workspaceViews ?? []
      const view = createWorkspaceView(
        `workspace-view-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        source,
        currentViews
      )
      const nextViews = [...currentViews, view]
      const writeVersion = ++workspaceViewsWriteVersionRef.current
      setSettings({ ...currentSettings, workspaceViews: nextViews })

      try {
        const nextSettings = await vaultApi.settings.update(
          { workspaceViews: nextViews },
          { history: false }
        )
        if (writeVersion === workspaceViewsWriteVersionRef.current) {
          setSettings(nextSettings)
        }
        openWorkspaceView(view.id)
      } catch (error) {
        if (writeVersion === workspaceViewsWriteVersionRef.current) {
          try {
            setSettings(await vaultApi.settings.get())
          } catch {
            setSettings(currentSettings)
          }
        }
        pushToast('error', String(error))
      }
    },
    [hasVault, openWorkspaceView, pushToast, setSettings, vaultApi]
  )

  const requestDeleteWorkspaceView = useCallback((viewId: string): void => {
    const view = (useVaultStore.getState().settings.workspaceViews ?? []).find(
      (candidate) => candidate.id === viewId
    )
    if (view) {
      setWorkspaceViewToDelete(view)
    }
  }, [])

  const deleteWorkspaceView = useCallback(async (): Promise<void> => {
    if (!vaultApi || !workspaceViewToDelete) {
      return
    }

    const view = workspaceViewToDelete
    const currentSettings = useVaultStore.getState().settings
    const currentViews = currentSettings.workspaceViews ?? []
    const nextViews = currentViews.filter((candidate) => candidate.id !== view.id)
    const writeVersion = ++workspaceViewsWriteVersionRef.current

    try {
      const nextSettings = await vaultApi.settings.update(
        { workspaceViews: nextViews },
        { history: false }
      )
      if (writeVersion !== workspaceViewsWriteVersionRef.current) {
        return
      }

      const isActive = activeWorkspaceViewIdRef.current === view.id
      if (isActive) {
        await closeTaskPage()
        activeWorkspaceViewIdRef.current = null
        activePageRef.current = view.source
        setActivePage(view.source)
      }
      setWorkspaceTabs((tabs) =>
        tabs.flatMap((tab) => {
          if (tab.workspaceViewId !== view.id) {
            return [tab]
          }
          return tab.id === activeWorkspaceTabIdRef.current
            ? [{ ...tab, page: view.source, workspaceViewId: null }]
            : []
        })
      )
      setSettings(nextSettings)
      void persistRecentPageTargets(
        recentPageTargets.filter((target) => target.kind !== 'view' || target.viewId !== view.id)
      )
      setWorkspaceViewToDelete(null)
    } catch (error) {
      pushToast('error', String(error))
    }
  }, [
    closeTaskPage,
    persistRecentPageTargets,
    pushToast,
    recentPageTargets,
    setSettings,
    vaultApi,
    workspaceViewToDelete
  ])

  const handleCreateWorkspaceTab = useCallback((): void => {
    if (!hasVault) {
      return
    }

    const tabId = createWorkspaceTabId()
    workspaceTabSessionsRef.current[tabId] = createEmptyNotebookWorkspaceSession()
    setWorkspaceTabs((tabs) => [
      ...tabs,
      createWorkspacePageTab(tabId, 'notes', {
        projectId: selectedProjectId,
        calendarDate: selectedCalendarDate,
        calendarViewMode
      })
    ])
    void activateWorkspaceTab(tabId, 'notes')
  }, [
    activateWorkspaceTab,
    calendarViewMode,
    createWorkspaceTabId,
    hasVault,
    selectedCalendarDate,
    selectedProjectId
  ])

  const handleSelectWorkspaceTab = useCallback(
    (tabId: string): void => {
      const tab = workspaceTabs.find((candidate) => candidate.id === tabId)
      if (!tab) {
        return
      }

      void activateWorkspaceTab(tab.id, tab.page, tab.workspaceViewId)
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
        void activateWorkspaceTab(nextTab.id, nextTab.page, nextTab.workspaceViewId).then(() => {
          delete workspaceTabSessionsRef.current[tabId]
          setWorkspaceTabs((tabs) => tabs.filter((tab) => tab.id !== tabId))
        })
        return
      }

      const replacementTabId = createWorkspaceTabId()
      workspaceTabSessionsRef.current[replacementTabId] = createEmptyNotebookWorkspaceSession()
      void activateWorkspaceTab(replacementTabId, 'notes').then(() => {
        delete workspaceTabSessionsRef.current[tabId]
        setWorkspaceTabs([
          createWorkspacePageTab(replacementTabId, 'notes', {
            projectId: selectedProjectId,
            calendarDate: selectedCalendarDate,
            calendarViewMode
          })
        ])
      })
    },
    [
      activateWorkspaceTab,
      calendarViewMode,
      createWorkspaceTabId,
      selectedCalendarDate,
      selectedProjectId,
      workspaceTabs
    ]
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
          delete persistedNoteRevisionsRef.current[currentNotePathRef.current]
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
    onToggleRightPanel: toggleRightPanel,
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
      setCalendarViewMode((current) =>
        current === 'month' ? 'week' : current === 'week' ? 'day' : 'month'
      )
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

  const updateAppFont = async (fontId: AppFontId): Promise<void> => {
    if (!vaultApi) {
      return
    }

    try {
      const nextSettings = await vaultApi.settings.update({ fontFamily: fontId })
      patchSettings({ fontFamily: nextSettings.fontFamily })
      pushToast('success', `${getAppFontOption(fontId).label} selected`)
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const updateCodeFont = async (fontId: AppFontId): Promise<void> => {
    if (!vaultApi) {
      return
    }

    try {
      const nextSettings = await vaultApi.settings.update({ codeFontFamily: fontId })
      patchSettings({ codeFontFamily: nextSettings.codeFontFamily })
      pushToast('success', `${getCodeFontOption(fontId).label} selected for code`)
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const updateMistralApiKey = async (mistralApiKey: string): Promise<void> => {
    if (!vaultApi) {
      return
    }

    try {
      if (mistralApiKey) {
        await vaultApi.credentials.set('mistral', mistralApiKey)
        setMistralApiKeyConfigured(true)
      } else {
        await vaultApi.credentials.delete('mistral')
        setMistralApiKeyConfigured(false)
      }
      pushToast('success', mistralApiKey ? 'Mistral API key saved' : 'Mistral API key cleared')
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const updatePythonCondaEnvironment = async (path: string | null): Promise<void> => {
    if (!vaultApi) {
      return
    }

    try {
      const nextSettings = await vaultApi.settings.update({
        pythonCondaEnvironmentPath: path
      })
      patchSettings({ pythonCondaEnvironmentPath: nextSettings.pythonCondaEnvironmentPath })
      pushToast('success', path ? 'Conda environment selected' : 'Using system Python')
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const choosePythonCondaExecutable = async (): Promise<void> => {
    if (!vaultApi?.python) {
      return
    }

    try {
      const result = await vaultApi.python.chooseCondaExecutable()
      if (result.error) {
        setCondaEnvironmentsError(result.error)
        return
      }

      if (!result.path) {
        return
      }

      const nextSettings = await vaultApi.settings.update({
        pythonCondaExecutablePath: result.path
      })
      patchSettings({ pythonCondaExecutablePath: nextSettings.pythonCondaExecutablePath })
      pushToast('success', 'Conda executable selected')
      await loadCondaEnvironments()
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const resetPythonCondaExecutable = async (): Promise<void> => {
    if (!vaultApi) {
      return
    }

    try {
      const nextSettings = await vaultApi.settings.update({
        pythonCondaExecutablePath: null
      })
      patchSettings({ pythonCondaExecutablePath: nextSettings.pythonCondaExecutablePath })
      pushToast('success', 'Using automatic Conda discovery')
      await loadCondaEnvironments()
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
      const dependencyErrors = validateTaskDependencies(normalizedTasks)
      if (dependencyErrors.length > 0) {
        throw new Error(`Task dependency validation failed: ${dependencyErrors[0]}`)
      }
      const nextSettings = await vaultApi.settings.update({
        tasks: normalizedTasks,
        calendarTasks: normalizedTasks
      })
      patchSettings({
        tasks: nextSettings.tasks ?? nextSettings.calendarTasks,
        calendarTasks: nextSettings.calendarTasks,
        projects: nextSettings.projects,
        projectIcons: nextSettings.projectIcons
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
      setSettings(await vaultApi.settings.get())
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
    schedule: CalendarTaskSchedule = {},
    projectId?: string,
    milestoneId?: string
  ): Promise<CalendarTask> => {
    if (!vaultApi) {
      throw new Error('No vault is open')
    }

    const trimmed = title.trim() || 'New Task'
    const nextTask = await vaultApi.tasks.create({
      title: trimmed,
      projectId,
      milestoneId,
      ...schedule
    })
    const nextSettings = await vaultApi.settings.get()
    const nextTasks = normalizeCalendarTasks(nextSettings.calendarTasks)
    calendarTasksRef.current = nextTasks
    setSettings({
      ...nextSettings,
      calendarTasks: nextTasks,
      tasks: nextTasks
    })
    return nextTask
  }

  const createProjectTask = async (
    projectId: string | undefined,
    title: string,
    milestoneId?: string
  ): Promise<CalendarTask> => {
    try {
      return await createCalendarTask(title, {}, projectId, milestoneId)
    } catch (error) {
      pushToast('error', String(error))
      throw error
    }
  }

  const duplicateTask = async (
    taskId: string,
    schedule?: TaskScheduleOverride
  ): Promise<CalendarTask> => {
    if (!vaultApi) {
      throw new Error('No vault is open')
    }

    try {
      const nextTask = await vaultApi.tasks.duplicate({ taskId, schedule })
      const nextSettings = await vaultApi.settings.get()
      const nextTasks = normalizeCalendarTasks(nextSettings.calendarTasks)
      calendarTasksRef.current = nextTasks
      setSettings({
        ...nextSettings,
        calendarTasks: nextTasks,
        tasks: nextTasks
      })
      pushToast('success', `Duplicated task “${nextTask.title}”`)
      return nextTask
    } catch (error) {
      pushToast('error', String(error))
      throw error
    }
  }

  const duplicateTaskInDialog = async (
    taskId: string,
    origin: TaskOriginRequest
  ): Promise<void> => {
    try {
      const nextTask = await duplicateTask(taskId)
      openTaskDialog(nextTask.id, origin)
    } catch {
      // The duplicate operation reports its own persistence error.
    }
  }

  const duplicateActiveTask = async (): Promise<void> => {
    if (!activeTask) return

    try {
      await taskFlushRef.current?.()
      const nextTask = await duplicateTask(activeTask.id)
      openTaskPage(nextTask.id, taskOrigin ?? { source: 'tasks' })
    } catch {
      // The duplicate operation reports its own persistence error.
    }
  }

  const copyTaskToSchedule = async (
    taskId: string,
    schedule: TaskScheduleOverride
  ): Promise<void> => {
    try {
      await duplicateTask(taskId, schedule)
      const targetDate = schedule.date ?? schedule.endDate
      if (targetDate) {
        setSelectedCalendarDate(targetDate)
      }
    } catch {
      // The duplicate operation reports its own persistence error.
    }
  }

  const createTaskFromTasksPage = async (): Promise<void> => {
    if (isCreatingTask) return

    setIsCreatingTask(true)
    try {
      const task = await createProjectTask(undefined, 'New Task')
      openTaskDialog(
        task.id,
        { source: 'tasks', workspaceViewId: activeWorkspaceView?.id },
        { isNewTask: true }
      )
    } catch {
      // The parent reports persistence errors.
    } finally {
      setIsCreatingTask(false)
    }
  }

  const createProjectMilestone = async (
    projectId: string,
    title: string
  ): Promise<ProjectMilestone> => {
    if (!vaultApi) {
      throw new Error('No vault is open')
    }

    try {
      settingsMutationVersionRef.current += 1
      const milestone = await vaultApi.projects.createMilestone({
        projectId,
        title: title.trim() || 'New Milestone'
      })
      const nextSettings = await vaultApi.settings.get()
      setSettings(nextSettings)
      return milestone
    } catch (error) {
      pushToast('error', String(error))
      throw error
    }
  }

  const updateProjectMilestone = async (
    projectId: string,
    milestoneId: string,
    patch: Pick<UpdateProjectMilestoneInput, 'title' | 'endDate'>
  ): Promise<void> => {
    if (!vaultApi) return

    const normalizedTitle = patch.title.trim()
    if (!normalizedTitle) return

    const currentSettings = useVaultStore.getState().settings
    const previousProject = currentSettings.projects.find((project) => project.id === projectId)
    const previousMilestone = previousProject?.milestones?.find(
      (milestone) => milestone.id === milestoneId
    )
    if (!previousProject || !previousMilestone) return

    const mutationKey = projectId
    const mutationVersion = (projectMilestoneMutationVersionRef.current.get(mutationKey) ?? 0) + 1
    projectMilestoneMutationVersionRef.current.set(mutationKey, mutationVersion)
    const updatedAt = new Date().toISOString()
    const optimisticMilestone = {
      ...previousMilestone,
      title: normalizedTitle,
      ...(patch.endDate !== undefined ? { endDate: patch.endDate ?? undefined } : {}),
      updatedAt
    }
    const optimisticProject = {
      ...previousProject,
      milestones: (previousProject.milestones ?? []).map((milestone) =>
        milestone.id === milestoneId ? optimisticMilestone : milestone
      ),
      updatedAt
    }
    setSettings({
      ...currentSettings,
      projects: currentSettings.projects.map((project) =>
        project.id === projectId ? optimisticProject : project
      )
    })

    try {
      await vaultApi.projects.updateMilestone({
        projectId,
        milestoneId,
        title: normalizedTitle,
        endDate: patch.endDate
      })
      if (projectMilestoneMutationVersionRef.current.get(mutationKey) !== mutationVersion) {
        return
      }
      setSettings(await vaultApi.settings.get())
    } catch (error: unknown) {
      if (projectMilestoneMutationVersionRef.current.get(mutationKey) === mutationVersion) {
        const latestSettings = useVaultStore.getState().settings
        setSettings({
          ...latestSettings,
          projects: latestSettings.projects.map((project) =>
            project.id === projectId ? previousProject : project
          )
        })
      }
      pushToast('error', String(error))
    }
  }

  const createProjectMilestoneFromPanel = async (projectId: string): Promise<void> => {
    try {
      const milestone = await createProjectMilestone(projectId, 'New Milestone')
      openMilestoneDialog(projectId, milestone.id, true)
    } catch {
      // The parent reports persistence errors.
    }
  }

  const deleteProjectMilestone = async (projectId: string, milestoneId: string): Promise<void> => {
    if (!vaultApi) {
      return
    }

    try {
      settingsMutationVersionRef.current += 1
      await vaultApi.projects.deleteMilestone({ projectId, milestoneId })
      const nextSettings = await vaultApi.settings.get()
      const nextTasks = normalizeCalendarTasks(nextSettings.calendarTasks)
      calendarTasksRef.current = nextTasks
      setSettings({
        ...nextSettings,
        calendarTasks: nextTasks,
        tasks: nextTasks
      })
      pushToast('success', 'Milestone removed')
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const reorderProjectMilestones = async (
    projectId: string,
    milestoneIds: string[]
  ): Promise<boolean> => {
    if (!vaultApi) {
      return false
    }

    const currentSettings = useVaultStore.getState().settings
    const previousProject = currentSettings.projects.find((project) => project.id === projectId)
    if (!previousProject) {
      return false
    }

    const mutationKey = projectId
    const mutationVersion = (projectMilestoneMutationVersionRef.current.get(mutationKey) ?? 0) + 1
    projectMilestoneMutationVersionRef.current.set(mutationKey, mutationVersion)
    settingsMutationVersionRef.current += 1

    const optimisticProject = {
      ...previousProject,
      milestones: milestoneIds.flatMap((milestoneId) =>
        (previousProject.milestones ?? []).filter((milestone) => milestone.id === milestoneId)
      ),
      updatedAt: new Date().toISOString()
    }
    const previousSettings = currentSettings
    setSettings({
      ...currentSettings,
      projects: currentSettings.projects.map((project) =>
        project.id === projectId ? optimisticProject : project
      )
    })

    try {
      await vaultApi.projects.reorderMilestones({ projectId, milestoneIds })
      if (projectMilestoneMutationVersionRef.current.get(mutationKey) !== mutationVersion) {
        return true
      }
      setSettings(await vaultApi.settings.get())
      return true
    } catch (error) {
      if (projectMilestoneMutationVersionRef.current.get(mutationKey) === mutationVersion) {
        try {
          setSettings(await vaultApi.settings.get())
        } catch {
          setSettings(previousSettings)
        }
      }
      pushToast('error', String(error))
      return false
    }
  }

  const updateProjectTask = async (taskId: string, patch: Partial<CalendarTask>): Promise<void> => {
    await updateCalendarTasks((tasks) =>
      tasks.map((task) => {
        if (task.id !== taskId) return task
        const next = { ...task, ...patch }
        if ('date' in patch || 'endDate' in patch) {
          const nextDate = next.date
          const nextEndDate = normalizeCalendarEndDate(nextDate, next.endDate)
          next.date = nextDate
          next.endDate = nextEndDate
        }
        const status = next.status ?? (next.completed ? 'completed' : 'pending')
        return { ...next, status, completed: isTaskStatusDone(status) }
      })
    )
    if (patch.date) {
      setSelectedCalendarDate(patch.date)
    }
  }

  const configureTaskRecurrence = async (
    taskId: string,
    recurrence: TaskRecurrenceDraft | null
  ): Promise<void> => {
    if (!vaultApi) {
      throw new Error('No vault is open')
    }

    try {
      await vaultApi.tasks.configureRecurrence({ taskId, recurrence })
      const nextSettings = await vaultApi.settings.get()
      const nextTasks = normalizeCalendarTasks(nextSettings.calendarTasks)
      calendarTasksRef.current = nextTasks
      setSettings({
        ...nextSettings,
        calendarTasks: nextTasks,
        tasks: nextTasks
      })
    } catch (error) {
      pushToast('error', String(error))
      throw error
    }
  }

  const addUnscheduledFromHeader = async (): Promise<void> => {
    const trimmed = calendarHeaderNewTask.trim()
    if (!trimmed) return
    await createCalendarTask(trimmed)
    setCalendarHeaderNewTask('')
  }

  const createTaskForDate = async (date: string): Promise<CalendarTask> => {
    return createCalendarTask('New Task', { endDate: date })
  }

  const createTaskForWeeklyTime = async (
    schedule: WeeklyTimedCreateSchedule
  ): Promise<CalendarTask> => {
    return createCalendarTask('New Task', schedule)
  }

  const removeCalendarTask = async (taskId: string): Promise<void> => {
    await updateCalendarTasks((tasks) => tasks.filter((task) => task.id !== taskId))
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
      weeklyHeightMode?: 'duration' | 'content'
    }
  ): Promise<void> => {
    await updateCalendarTasks((tasks) =>
      tasks.map((task) => {
        if (task.id !== taskId) {
          return task
        }

        const nextDate = schedule.date
        const nextEndDate = normalizeCalendarEndDate(nextDate, schedule.endDate)

        return {
          ...task,
          date: nextDate,
          endDate: nextEndDate,
          time: schedule.time,
          endTime: schedule.endTime,
          ...(schedule.weeklyHeightMode ? { weeklyHeightMode: schedule.weeklyHeightMode } : {})
        }
      })
    )

    const targetDate = schedule.date ?? schedule.endDate
    if (targetDate) {
      setSelectedCalendarDate(targetDate)
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
          return {
            ...task,
            date: undefined,
            endDate: newDate,
            time: undefined,
            endTime: undefined
          }
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
        if (task.id !== taskId || (!task.date && !task.endDate)) {
          return task
        }

        const currentEnd =
          task.endDate && (!task.date || task.endDate >= task.date)
            ? task.endDate
            : (task.date ?? newStartDate)
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
        if (task.id !== taskId) {
          return task
        }

        if (!task.date) {
          return task.endDate ? { ...task, endDate: newEndDate } : task
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
        : calendarViewMode === 'day'
          ? addIsoDays(selectedCalendarDate, -1)
          : shiftIsoMonthClamped(selectedCalendarDate, -1)
    )
  }

  const goToNextCalendarPeriod = (): void => {
    setSelectedCalendarDate(
      calendarViewMode === 'week'
        ? addIsoDays(selectedCalendarDate, 7)
        : calendarViewMode === 'day'
          ? addIsoDays(selectedCalendarDate, 1)
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

  const openVaultRootInFinder = useCallback(async (): Promise<void> => {
    if (!vaultApi || !vault?.rootPath) {
      pushToast('error', 'Open a vault before opening its folder')
      return
    }

    try {
      await vaultApi.desktop.openPath(vault.rootPath)
    } catch (error) {
      pushToast('error', `Could not open the vault folder: ${String(error)}`)
    }
  }, [pushToast, vault?.rootPath, vaultApi])

  const openVaultRootInTerminal = useCallback(async (): Promise<void> => {
    if (!vaultApi || !vault?.rootPath) {
      pushToast('error', 'Open a vault before opening its terminal')
      return
    }

    try {
      await vaultApi.desktop.openTerminal()
    } catch (error) {
      pushToast('error', `Could not open a vault terminal: ${String(error)}`)
    }
  }, [pushToast, vault?.rootPath, vaultApi])

  const reconcileVaultSync = useCallback(async (): Promise<void> => {
    if (!vaultApi) {
      return
    }

    await vaultApi.vault.reconcile()
    const nextSnapshot = await vaultApi.vault.getSyncSnapshot()
    setVaultSyncSnapshot(toVaultSyncPageSnapshot(nextSnapshot))
    setVaultSyncPageStatus('ready')
  }, [vaultApi])

  const reconcileVaultFromCommandPalette = useCallback(async (): Promise<void> => {
    if (!vaultApi || !vault?.rootPath) {
      pushToast('error', 'Open a vault before reconciling it')
      return
    }

    try {
      await reconcileVaultSync()
      openSettingsTab('sync')
      pushToast('success', 'Vault reconciled')
    } catch (error) {
      pushToast('error', `Could not reconcile the vault: ${String(error)}`)
    }
  }, [openSettingsTab, pushToast, reconcileVaultSync, vault?.rootPath, vaultApi])

  const createVaultBackupFromCommandPalette = useCallback(async (): Promise<void> => {
    if (!vaultApi || !vault?.rootPath) {
      pushToast('error', 'Open a vault before creating a backup')
      return
    }

    try {
      const backup = await vaultApi.vault.createBackup()
      pushToast('success', `Portable backup created at ${backup.path}`)
    } catch (error) {
      pushToast('error', `Could not create a vault backup: ${String(error)}`)
    }
  }, [pushToast, vault?.rootPath, vaultApi])

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
        rememberRecentNotebookFile(relPath)
        rememberRecentTarget({ kind: 'note', path: relPath })
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
          rememberRecentNotebookFile(relPath)
          rememberRecentTarget({ kind: 'note', path: relPath })
          return
        }

        const readResult = await vaultApi.files.readNoteDocumentWithRevision(relPath)
        if (requestId !== openNoteRequestIdRef.current) {
          return
        }
        const document = readResult.document
        persistedNoteRevisionsRef.current[relPath] = readResult.revision.contentHash
        noteSaveCoordinator?.setBaseRevision(relPath, readResult.revision.contentHash)
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
        rememberRecentNotebookFile(relPath)
        rememberRecentTarget({ kind: 'note', path: relPath })
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [
      applyOpenNoteSession,
      getWorkspaceTabSession,
      stageCurrentNoteForBackgroundSave,
      noteSaveCoordinator,
      vaultApi,
      pushToast,
      persistLastOpenedNotePath,
      rememberRecentNotebookFile,
      rememberRecentTarget
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
        rememberRecentNotebookFile(relPath)
        rememberRecentTarget({ kind: 'drawing', path: relPath })
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
      vaultApi,
      rememberRecentNotebookFile,
      rememberRecentTarget
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

  const openNotebookResource = useCallback(
    async (resourceId: string): Promise<void> => {
      const resource = resourceSnapshot.resources.find((candidate) => candidate.id === resourceId)
      if (!resource || resource.type !== 'notebook') {
        pushToast('error', 'Notebook resource not found')
        return
      }

      const requestedPath = notebookPathFromResource(resource)
      if (!requestedPath) {
        pushToast('error', 'Invalid notebook resource')
        return
      }

      if (!treeContainsPath(noteTree, requestedPath)) {
        pushToast('info', `Linked notebook folder not found for ${resource.title}`)
        return
      }

      await navigateToPage('notes')
      try {
        await flushCurrentNote({ force: true, settleEditor: true })
      } catch (error) {
        pushToast('error', String(error))
        return
      }

      const nextPath = getNotebookFolderContents(noteTree, requestedPath).path
      const activeSession = getWorkspaceTabSession()
      activeSession.currentNotePath = null
      activeSession.currentExcalidrawPath = null
      activeSession.currentNoteContent = ''
      activeSession.currentNoteTags = []
      activeSession.currentNoteEditorDraft = null
      activeSession.browseFolderPath = nextPath
      activeSession.selectedNoteTreeEntries = nextPath
        ? [{ kind: 'folder', relPath: nextPath }]
        : []

      currentNotePathRef.current = null
      currentExcalidrawPathRef.current = null
      currentNoteContentRef.current = ''
      currentNoteTagsRef.current = []
      setCurrentNotePath(null)
      setCurrentExcalidrawPath(null)
      setCurrentNoteContent('')
      setCurrentNoteTagsState([])
      resetCurrentNoteEditorSession()
      setBrowseFolderPath(nextPath)
      setSelectedNoteTreeEntries(nextPath ? [{ kind: 'folder', relPath: nextPath }] : [])
    },
    [
      flushCurrentNote,
      getWorkspaceTabSession,
      navigateToPage,
      noteTree,
      pushToast,
      resetCurrentNoteEditorSession,
      resourceSnapshot.resources,
      setCurrentExcalidrawPath,
      setCurrentNoteContent,
      setCurrentNotePath
    ]
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

  const enqueueNotebookRefresh = useCallback(function enqueueNotebookRefresh<T>(
    task: () => Promise<T>
  ): Promise<T> {
    const run = notebookRefreshQueueRef.current.then(task, task)
    notebookRefreshQueueRef.current = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }, [])

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
    activeWorkspaceViewIdRef.current = null
    activePageRef.current = 'notes'
    setWorkspaceTabs([createWorkspacePageTab(INITIAL_WORKSPACE_TAB_ID, 'notes')])
    setActiveWorkspaceTabId(INITIAL_WORKSPACE_TAB_ID)
    setActivePage('notes')
    currentNotePathRef.current = null
    currentExcalidrawPathRef.current = null
    currentNoteContentRef.current = ''
    currentNoteTagsRef.current = []
    currentNoteEditorDirtyRef.current = false
    pendingNoteSaveRef.current = null
    persistedNoteFingerprintsRef.current = {}
    persistedNoteRevisionsRef.current = {}
    openNoteRequestIdRef.current += 1
    if (noteSaveTimerRef.current) {
      window.clearTimeout(noteSaveTimerRef.current)
      noteSaveTimerRef.current = null
    }
    setCurrentNotePath(null)
    setCurrentExcalidrawPath(null)
    setBrowseFolderPath(null)
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
    setProjectView('list')
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
    }
  }, [setNoteTree, setSelectedNoteTreeEntries, vault, vaultApi])

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
      persistedNoteRevisionsRef.current = {}
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
      persistedNoteRevisionsRef.current = {}
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

  const migrateNoteImagePaths = async (): Promise<void> => {
    if (!vaultApi) {
      pushToast('error', 'Note migration is only available inside the Electron app')
      return
    }

    if (!vault) {
      pushToast('error', 'Select a vault in Settings before migrating note images')
      void navigateToPage('settings')
      return
    }

    const confirmed = window.confirm(
      'Repair image paths in this vault? This rewrites legacy image links and copies missing attachments when their original files are still available.'
    )
    if (!confirmed) {
      return
    }

    const openPath = currentNotePathRef.current

    try {
      await flushCurrentNote({ force: true, settleEditor: true })
      const result = await vaultApi.files.migrateNoteImagePaths()
      Object.values(workspaceTabSessionsRef.current).forEach((session) => {
        session.noteEditorSessions = {}
      })
      persistedNoteFingerprintsRef.current = {}
      persistedNoteRevisionsRef.current = {}
      await refreshNotesAndTree()

      if (openPath) {
        await openNote(openPath)
      }

      const failedLabel = result.failed.length > 0 ? `, ${result.failed.length} failed` : ''
      pushToast(
        result.failed.length > 0 ? 'error' : 'success',
        `Repaired ${result.imagesConverted} image path${result.imagesConverted === 1 ? '' : 's'} in ${result.converted} note${result.converted === 1 ? '' : 's'}${result.attachmentsCopied > 0 ? ` and copied ${result.attachmentsCopied} attachment${result.attachmentsCopied === 1 ? '' : 's'}` : ''}${failedLabel}`
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

    if (currentNoteTagsRef.current.includes(normalized)) {
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
    const next = currentNoteTagsRef.current.filter((item) => item !== tag)
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
      persistedNoteRevisionsRef.current[newPath] =
        persistedNoteRevisionsRef.current[oldPath] ?? null
      delete persistedNoteRevisionsRef.current[oldPath]
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
      delete persistedNoteRevisionsRef.current[relPath]
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
    if (!vaultApi || isFolderExporting) {
      return
    }

    try {
      setIsFolderExporting(true)
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
      setIsFolderExporting(false)
    }
  }

  const exportFolderMarkdown = async (folderPath: string): Promise<void> => {
    if (!vaultApi || isFolderExporting) {
      return
    }

    try {
      setIsFolderExporting(true)
      await flushCurrentNote({ force: true })
      const result = await vaultApi.files.exportFolderMarkdown({ folderPath })

      if (result.noteCount === 0) {
        pushToast('info', 'No readable Markdown notes found in the selected folder')
        if (result.warnings.length > 0) {
          pushToast('info', `Markdown export encountered ${result.warnings.length} warning(s)`)
        }
        return
      }

      if (!result.path) {
        return
      }

      const noteLabel = result.noteCount === 1 ? 'note' : 'notes'
      pushToast('success', `Exported ${result.noteCount} nested ${noteLabel} to ${result.path}`)
      if (result.warnings.length > 0) {
        pushToast('info', `Markdown export encountered ${result.warnings.length} warning(s)`)
      }
    } catch (error) {
      pushToast('error', String(error))
    } finally {
      setIsFolderExporting(false)
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

  const exportProjectContext = async (project: Project): Promise<void> => {
    if (isProjectContextExporting) {
      return
    }
    if (!vaultApi) {
      pushToast('error', 'Project export is only available inside the Electron app')
      return
    }

    try {
      setIsProjectContextExporting(true)
      await flushCurrentNote({ force: true })
      const result = await vaultApi.files.exportProjectContext({ projectId: project.id })
      if (!result.path) {
        return
      }
      const noteLabel = result.noteCount === 1 ? 'note' : 'notes'
      const taskLabel = result.taskCount === 1 ? 'task' : 'tasks'
      const updateLabel = result.updateCount === 1 ? 'update' : 'updates'
      const meetingLabel = result.meetingCount === 1 ? 'meeting' : 'meetings'
      const externalDocumentLabel =
        result.externalDocumentCount === 1 ? 'Google Doc' : 'Google Docs'
      pushToast(
        'success',
        `Exported project context to ${result.path} (${result.noteCount} ${noteLabel}, ${result.taskCount} ${taskLabel}, ${result.updateCount} ${updateLabel}, ${result.meetingCount} ${meetingLabel}, ${result.externalDocumentCount} ${externalDocumentLabel})`
      )
      if (result.warnings.length > 0) {
        pushToast('info', `Project context export encountered ${result.warnings.length} warning(s)`)
      }
    } catch (error) {
      pushToast('error', String(error))
    } finally {
      setIsProjectContextExporting(false)
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
      setProjectView('home')
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

  const applyProjectResult = useCallback(
    (updatedProject: Project): void => {
      const currentSettings = useVaultStore.getState().settings
      setSettings({
        ...currentSettings,
        projects: currentSettings.projects.map((project) =>
          project.id === updatedProject.id ? updatedProject : project
        ),
        projectIcons: {
          ...currentSettings.projectIcons,
          [updatedProject.id]: updatedProject.icon
        }
      })
    },
    [setSettings]
  )

  const createProjectUpdate = useCallback(
    async (
      projectId: string,
      input: { markdown: string; status: ProjectUpdateStatus }
    ): Promise<void> => {
      if (!vaultApi) return

      try {
        const updatedProject = await vaultApi.projects.createUpdate({ projectId, ...input })
        applyProjectResult(updatedProject)
        pushToast('success', 'Project update posted')
      } catch (error) {
        pushToast('error', String(error))
        throw error
      }
    },
    [applyProjectResult, pushToast, vaultApi]
  )

  const updateProjectUpdate = useCallback(
    async (
      projectId: string,
      updateId: string,
      input: { markdown: string; status: ProjectUpdateStatus }
    ): Promise<void> => {
      if (!vaultApi) return

      try {
        const updatedProject = await vaultApi.projects.updateUpdate({
          projectId,
          updateId,
          ...input
        })
        applyProjectResult(updatedProject)
        pushToast('success', 'Project update saved')
      } catch (error) {
        pushToast('error', String(error))
        throw error
      }
    },
    [applyProjectResult, pushToast, vaultApi]
  )

  const deleteProjectUpdate = useCallback(
    async (projectId: string, updateId: string): Promise<void> => {
      if (!vaultApi) return

      try {
        const updatedProject = await vaultApi.projects.deleteUpdate({ projectId, updateId })
        applyProjectResult(updatedProject)
        pushToast('success', 'Project update deleted')
      } catch (error) {
        pushToast('error', String(error))
        throw error
      }
    },
    [applyProjectResult, pushToast, vaultApi]
  )

  const createProjectMeeting = useCallback(
    async (
      projectId: string,
      input: { markdown: string; type: ProjectMeetingType; outcome: ProjectMeetingOutcome }
    ): Promise<void> => {
      if (!vaultApi) return

      try {
        const updatedProject = await vaultApi.projects.createMeeting({ projectId, ...input })
        applyProjectResult(updatedProject)
        pushToast('success', 'Project meeting posted')
      } catch (error) {
        pushToast('error', String(error))
        throw error
      }
    },
    [applyProjectResult, pushToast, vaultApi]
  )

  const updateProjectMeeting = useCallback(
    async (
      projectId: string,
      meetingId: string,
      input: { markdown: string; type: ProjectMeetingType; outcome: ProjectMeetingOutcome }
    ): Promise<void> => {
      if (!vaultApi) return

      try {
        const updatedProject = await vaultApi.projects.updateMeeting({
          projectId,
          meetingId,
          ...input
        })
        applyProjectResult(updatedProject)
        pushToast('success', 'Project meeting saved')
      } catch (error) {
        pushToast('error', String(error))
        throw error
      }
    },
    [applyProjectResult, pushToast, vaultApi]
  )

  const deleteProjectMeeting = useCallback(
    async (projectId: string, meetingId: string): Promise<void> => {
      if (!vaultApi) return

      try {
        const updatedProject = await vaultApi.projects.deleteMeeting({ projectId, meetingId })
        applyProjectResult(updatedProject)
        pushToast('success', 'Project meeting deleted')
      } catch (error) {
        pushToast('error', String(error))
        throw error
      }
    },
    [applyProjectResult, pushToast, vaultApi]
  )

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
    if (!vaultApi || !projectSaveCoordinator) {
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

    void projectSaveCoordinator
      .enqueue({
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
    if (!vaultApi || !projectSaveCoordinator) {
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
      resourceRefs: patch.resourceRefs ?? previousProject.resourceRefs,
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

    void projectSaveCoordinator
      .enqueue({ projectId, ...patch })
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

  void [
    updateProjectIcon,
    exportProjectContext,
    openProjectFolder,
    renameProject,
    updateProjectSummary
  ]

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
      void persistRecentPageTargets(
        recentPageTargets.filter(
          (target) => target.kind !== 'project' || target.projectId !== result.deletedProjectId
        )
      )
      if (selectedProjectIdRef.current === result.deletedProjectId) {
        selectedProjectIdRef.current = result.nextSelectedProjectId
        setSelectedProjectId(result.nextSelectedProjectId)
        setProjectView('list')
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

      const candidate = parentDir ? `${parentDir}/untitled-drawing` : 'untitled-drawing'
      return vaultApi.files.createExcalidrawFileAtPath(candidate)
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

  const notebookRefreshCoordinator = useMemo(
    () =>
      createLatestRefreshCoordinator(
        () => {
          const api = vaultApi
          if (!api) {
            return Promise.reject(new Error('Vault API unavailable'))
          }

          return enqueueNotebookRefresh(() =>
            Promise.all([api.files.listNotes(), api.files.listTree()]).then(
              ([nextNotes, nextTree]) => ({ nextNotes, nextTree })
            )
          )
        },
        ({ nextNotes, nextTree }) => {
          replaceNotes(nextNotes)
          setNoteTree(nextTree)
          if (
            currentNotePathRef.current &&
            !nextNotes.some((note) => note.relPath === currentNotePathRef.current)
          ) {
            delete getWorkspaceTabSession().noteEditorSessions[currentNotePathRef.current]
            delete persistedNoteFingerprintsRef.current[currentNotePathRef.current]
            delete persistedNoteRevisionsRef.current[currentNotePathRef.current]
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
        }
      ),
    [
      enqueueNotebookRefresh,
      getWorkspaceTabSession,
      persistLastOpenedNotePath,
      replaceNotes,
      resetCurrentNoteEditorSession,
      setCurrentExcalidrawPath,
      setCurrentNoteContent,
      setCurrentNotePath,
      setNoteTree,
      vaultApi
    ]
  )

  const refreshNotesAndTree = useCallback(async (): Promise<NoteTreeNode[]> => {
    if (!vaultApi) {
      return []
    }

    const { nextTree } = await notebookRefreshCoordinator()
    return nextTree
  }, [notebookRefreshCoordinator, vaultApi])

  const refreshNotesOnly = useCallback(async (): Promise<void> => {
    if (!vaultApi) {
      return
    }

    const nextNotes = await enqueueNotebookRefresh(() => vaultApi.files.listNotes())
    replaceNotes(nextNotes)
  }, [enqueueNotebookRefresh, replaceNotes, vaultApi])

  useEffect(() => {
    if (!vaultApi || !vault || typeof vaultApi.files.onTreeChanged !== 'function') {
      return
    }

    let refreshScheduled = false
    const unsubscribe = vaultApi.files.onTreeChanged(() => {
      if (refreshScheduled) {
        return
      }

      refreshScheduled = true
      void Promise.resolve().then(async () => {
        refreshScheduled = false
        try {
          await refreshNotesAndTree()
        } catch (error) {
          pushToast('error', String(error))
        }
      })
    })

    return unsubscribe
  }, [pushToast, refreshNotesAndTree, vault, vaultApi])

  useEffect(() => {
    if (!vaultApi || !vault?.rootPath || typeof vaultApi.files.onVaultChanged !== 'function') {
      return
    }

    const unsubscribe = vaultApi.files.onVaultChanged((event: VaultChangeEvent) => {
      if (
        (event.source !== 'external' && event.source !== 'reconcile') ||
        event.domain !== 'notes' ||
        !event.path.startsWith('notebooks/')
      ) {
        return
      }

      const relPath = event.path.slice('notebooks/'.length)
      if (!isNotePath(relPath)) {
        return
      }

      if (currentNotePathRef.current !== relPath) {
        if (event.kind === 'change') {
          void refreshNotesOnly().catch((error: unknown) => {
            pushToast('error', String(error))
          })
        }
        return
      }

      const requestId = ++externalNoteRefreshRequestRef.current
      const hasDraft =
        currentNoteEditorDirtyRef.current ||
        pendingNoteSaveRef.current?.relPath === relPath ||
        Boolean(noteSaveInFlightRef.current)

      if (event.kind === 'delete') {
        if (hasDraft) {
          setNoteConflict({
            path: event.path,
            message: 'The open note was deleted outside Xingularity.',
            actualRevision: null
          })
          return
        }

        void refreshNotesAndTree().catch((error: unknown) => {
          pushToast('error', String(error))
        })
        return
      }

      void vaultApi.files
        .readNoteDocumentWithRevision(relPath)
        .then((readResult) => {
          if (
            requestId !== externalNoteRefreshRequestRef.current ||
            currentNotePathRef.current !== relPath
          ) {
            return
          }

          if (
            currentNoteEditorDirtyRef.current ||
            pendingNoteSaveRef.current?.relPath === relPath ||
            Boolean(noteSaveInFlightRef.current)
          ) {
            setNoteConflict({
              path: event.path,
              message: 'The open note changed outside Xingularity.',
              actualRevision: readResult.revision
            })
            return
          }

          const nextSession = {
            content: splitNoteContent(readResult.document.markdown).body,
            tags: [...readResult.document.tags]
          }
          getWorkspaceTabSession().noteEditorSessions[relPath] = nextSession
          persistedNoteFingerprintsRef.current[relPath] = serializeStoredNoteDocument(
            readResult.document
          )
          persistedNoteRevisionsRef.current[relPath] = readResult.revision.contentHash
          noteSaveCoordinator?.setBaseRevision(relPath, readResult.revision.contentHash)
          updateNoteListEntryFromDocument(relPath, readResult.document)
          applyOpenNoteSession(relPath, nextSession)
        })
        .catch((error: unknown) => {
          if (requestId !== externalNoteRefreshRequestRef.current) {
            return
          }
          if (String(error).includes('ENOENT')) {
            if (hasDraft) {
              setNoteConflict({
                path: event.path,
                message: 'The open note was deleted outside Xingularity.',
                actualRevision: null
              })
              return
            }
            void refreshNotesAndTree().catch((refreshError: unknown) => {
              pushToast('error', String(refreshError))
            })
            return
          }
          pushToast('error', String(error))
        })
    })

    return unsubscribe
  }, [
    applyOpenNoteSession,
    getWorkspaceTabSession,
    noteSaveCoordinator,
    pushToast,
    refreshNotesOnly,
    refreshNotesAndTree,
    updateNoteListEntryFromDocument,
    vault?.rootPath,
    vaultApi
  ])

  useEffect(() => {
    if (!vaultApi || !vault?.rootPath || typeof vaultApi.files.onVaultChanged !== 'function') {
      return
    }

    const unsubscribe = vaultApi.files.onVaultChanged((event: VaultChangeEvent) => {
      if (event.source !== 'external' && event.source !== 'reconcile') {
        return
      }

      if (event.domain === 'settings' || event.domain === 'projects' || event.domain === 'tasks') {
        void vaultApi.settings
          .get()
          .then((nextSettings) => {
            calendarTasksRef.current = nextSettings.calendarTasks
            setSettings(nextSettings)
          })
          .catch((error: unknown) => pushToast('error', String(error)))
      }

      if (event.domain === 'fleeting') {
        void vaultApi.fleeting
          .list()
          .then((nextNotes) => setFleetingNotes(nextNotes))
          .catch((error: unknown) => pushToast('error', String(error)))
      }

      if (event.domain === 'resources') {
        void vaultApi.resources
          .list()
          .then((nextSnapshot) => setResourceSnapshot(nextSnapshot))
          .catch((error: unknown) => pushToast('error', String(error)))
      }

      if (event.domain === 'schedules') {
        void refreshSchedulingReviewCount()
      }
    })

    return unsubscribe
  }, [pushToast, refreshSchedulingReviewCount, setSettings, vault?.rootPath, vaultApi])

  useEffect(() => {
    let cancelled = false
    if (!vaultApi || !vault?.rootPath || typeof vaultApi.vault.getSyncSnapshot !== 'function') {
      setVaultSyncSnapshot(null)
      setVaultSyncPageStatus('loading')
      return
    }

    setVaultSyncPageStatus('loading')
    const loadSnapshot = async (): Promise<void> => {
      try {
        const nextSnapshot = await vaultApi.vault.getSyncSnapshot()
        if (cancelled) {
          return
        }
        setVaultSyncSnapshot(toVaultSyncPageSnapshot(nextSnapshot))
        setVaultSyncPageStatus('ready')
      } catch (error) {
        if (cancelled) {
          return
        }
        setVaultSyncPageStatus('error')
        pushToast('error', String(error))
      }
    }

    void loadSnapshot()
    const unsubscribe =
      typeof vaultApi.files.onVaultChanged === 'function'
        ? vaultApi.files.onVaultChanged(() => {
            void loadSnapshot()
          })
        : undefined

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [pushToast, vault?.rootPath, vaultApi])

  const refreshAutomationWorkspace = useCallback(async (): Promise<void> => {
    if (!vaultApi) {
      return
    }

    const [nextSettings] = await Promise.all([
      vaultApi.settings.get(),
      refreshNotesAndTree(),
      refreshSchedulingReviewCount()
    ])
    calendarTasksRef.current = nextSettings.calendarTasks
    setSettings(nextSettings)
  }, [refreshNotesAndTree, refreshSchedulingReviewCount, setSettings, vaultApi])

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

  const removeFleetingNote = useCallback(
    async (relPath: string): Promise<void> => {
      if (!vaultApi) {
        throw new Error('Vault API unavailable')
      }

      await vaultApi.fleeting.remove(relPath)
      setFleetingNotes((current) => current.filter((note) => note.relPath !== relPath))
      pushToast('success', 'Removed capture')
    },
    [pushToast, vaultApi]
  )

  const updateFleetingNote = useCallback(
    async (
      relPath: string,
      patch: Partial<Pick<FleetingNote, 'priority' | 'triageState'>>
    ): Promise<void> => {
      if (!vaultApi) {
        throw new Error('Vault API unavailable')
      }
      const updated = await vaultApi.fleeting.update({ relPath, ...patch })
      setFleetingNotes((current) =>
        current.map((note) => (note.relPath === relPath ? updated : note))
      )
    },
    [vaultApi]
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

  const openNoteMention = useCallback(
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

      const target = rawTarget.trim()
      if (!target) {
        return
      }

      try {
        let relPath = createNoteMentionResolver(notesRef.current)(target)
        if (!relPath) {
          await refreshNotesAndTree()
          relPath = createNoteMentionResolver(notesRef.current)(target)
        }

        if (!relPath) {
          pushToast('error', `Could not resolve note link: ${target}`)
          return
        }

        setSearchQuery('')
        setSearchResults([])
        await navigateToPage('notes')
        setSelectedNoteTreeEntries([{ kind: 'note', relPath }])
        await openNote(relPath)
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [
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

      const nextRelPath = buildRenamedNotebookPath(relPath, nextName, kind)
      if (!nextRelPath) {
        return
      }

      if (treeContainsPath(noteTree, nextRelPath)) {
        pushToast('error', `A file or folder already exists at ${nextRelPath}`)
        return
      }

      const isCurrentExcalidraw =
        kind === 'excalidraw' && currentExcalidrawPathRef.current === relPath
      let pathMutationPrepared = false
      let renameCommitted = false

      try {
        if (isCurrentExcalidraw) {
          pathMutationPrepared = true
          await currentExcalidrawEditorRef.current?.prepareForPathMutation()
        }

        await vaultApi.files.renamePath(relPath, nextRelPath)
        renameCommitted = true

        Object.values(workspaceTabSessionsRef.current).forEach((session) => {
          remapNotebookWorkspaceSessionPaths(session, relPath, nextRelPath)
        })
        Object.entries(persistedNoteFingerprintsRef.current).forEach(([path, fingerprint]) => {
          const remappedPath = remapNestedPath(path, relPath, nextRelPath)
          if (remappedPath && remappedPath !== path) {
            persistedNoteFingerprintsRef.current[remappedPath] = fingerprint
            delete persistedNoteFingerprintsRef.current[path]
            persistedNoteRevisionsRef.current[remappedPath] =
              persistedNoteRevisionsRef.current[path] ?? null
            delete persistedNoteRevisionsRef.current[path]
          }
        })

        if (isCurrentExcalidraw) {
          currentExcalidrawPathRef.current = nextRelPath
          setCurrentExcalidrawPath(nextRelPath)
        }

        await refreshNotesAndTree()
        setSettings(await vaultApi.settings.get())
        const nextRecentPaths = remapRecentNotebookPaths(recentNotebookPaths, relPath, nextRelPath)
        if (nextRecentPaths.some((path, index) => path !== recentNotebookPaths[index])) {
          void persistRecentNotebookPaths(nextRecentPaths)
        }
        void persistRecentPageTargets(
          remapRecentPageTargets(recentPageTargets, relPath, nextRelPath)
        )
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
        if (pathMutationPrepared && !renameCommitted) {
          currentExcalidrawEditorRef.current?.cancelPathMutation()
        }
        pushToast('error', String(error))
      }
    },
    [
      currentExcalidrawPath,
      currentNotePath,
      favoriteNotePaths,
      getWorkspaceTabSession,
      noteTree,
      persistFavoriteNotePaths,
      persistLastOpenedNotePath,
      persistRecentPageTargets,
      persistRecentNotebookPaths,
      pushToast,
      recentNotebookPaths,
      recentPageTargets,
      refreshNotesAndTree,
      setSettings,
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

      let pathMutationPrepared = false
      try {
        const isCurrentExcalidraw = normalizedEntries.some((entry) =>
          entry.kind === 'folder'
            ? isNestedPath(currentExcalidrawPathRef.current, entry.relPath)
            : entry.kind === 'excalidraw' && entry.relPath === currentExcalidrawPathRef.current
        )
        if (isCurrentExcalidraw) {
          pathMutationPrepared = true
          await currentExcalidrawEditorRef.current?.prepareForPathMutation()
        }

        await vaultApi.files.deletePaths(normalizedEntries.map((entry) => entry.relPath))

        await refreshNotesAndTree()
        setSettings(await vaultApi.settings.get())
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
        const nextRecentPaths = removeRecentNotebookPaths(recentNotebookPaths, removedSessionPaths)
        if (
          nextRecentPaths.length !== recentNotebookPaths.length ||
          nextRecentPaths.some((path, index) => path !== recentNotebookPaths[index])
        ) {
          void persistRecentNotebookPaths(nextRecentPaths)
        }
        void persistRecentPageTargets(removeRecentPageTargets(recentPageTargets, removedSessionPaths))
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
            delete persistedNoteRevisionsRef.current[path]
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
        if (pathMutationPrepared) {
          currentExcalidrawEditorRef.current?.cancelPathMutation()
        }
        pushToast('error', String(error))
      }
    },
    [
      favoriteNotePaths,
      getWorkspaceTabSession,
      persistFavoriteNotePaths,
      persistLastOpenedNotePath,
      persistRecentPageTargets,
      persistRecentNotebookPaths,
      pushToast,
      recentNotebookPaths,
      recentPageTargets,
      refreshNotesAndTree,
      resetCurrentNoteEditorSession,
      setSettings,
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
          operation.kind === 'excalidraw' && operation.relPath === currentExcalidrawPathRef.current
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
            persistedNoteRevisionsRef.current[remappedPath] =
              persistedNoteRevisionsRef.current[path] ?? null
            delete persistedNoteRevisionsRef.current[path]
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
      setSettings(await vaultApi.settings.get())
      const nextRecentPaths = moveOperations.reduce(
        (paths, operation) =>
          remapRecentNotebookPaths(paths, operation.relPath, operation.toRelPath),
        recentNotebookPaths
      )
      if (
        nextRecentPaths.length !== recentNotebookPaths.length ||
        nextRecentPaths.some((path, index) => path !== recentNotebookPaths[index])
      ) {
        void persistRecentNotebookPaths(nextRecentPaths)
      }
      const nextRecentPageTargets = moveOperations.reduce(
        (targets, operation) =>
          remapRecentPageTargets(targets, operation.relPath, operation.toRelPath),
        recentPageTargets
      )
      void persistRecentPageTargets(nextRecentPageTargets)
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
      persistRecentPageTargets,
      persistRecentNotebookPaths,
      refreshNotesAndTree,
      recentNotebookPaths,
      recentPageTargets,
      setSettings,
      setCurrentExcalidrawPath,
      setCurrentNotePath,
      vaultApi
    ]
  )

  const refreshResourceSnapshot = useCallback(async (): Promise<void> => {
    if (!vaultApi) return
    const snapshot = await vaultApi.resources.list()
    setResourceSnapshot(snapshot)
  }, [vaultApi])

  const addProjectResource = useCallback(
    async (projectId: string, input: ResourceInput): Promise<void> => {
      if (!vaultApi) return
      try {
        await vaultApi.resources.add({ ...input, projectId })
        await refreshResourceSnapshot()
        const nextSettings = await vaultApi.settings.get()
        setSettings(nextSettings)
        pushToast('success', 'Resource linked to project')
      } catch (error) {
        pushToast('error', String(error))
        throw error
      }
    },
    [pushToast, refreshResourceSnapshot, setSettings, vaultApi]
  )

  const createResource = useCallback(
    async (input: ResourceInput): Promise<void> => {
      if (!vaultApi) return
      try {
        await vaultApi.resources.add(input)
        await refreshResourceSnapshot()
        setSettings(await vaultApi.settings.get())
        pushToast('success', 'Resource added')
      } catch (error) {
        pushToast('error', String(error))
        throw error
      }
    },
    [pushToast, refreshResourceSnapshot, setSettings, vaultApi]
  )

  const listGoogleDriveFiles = useCallback(async (): Promise<GoogleDriveFileCandidate[]> => {
    if (!vaultApi) throw new Error('No vault is open')
    return vaultApi.resources.drive.listFiles()
  }, [vaultApi])

  const attachGoogleDriveResources = useCallback(
    async (projectId: string, fileIds: string[]): Promise<void> => {
      if (!vaultApi) throw new Error('No vault is open')
      try {
        const resources = await vaultApi.resources.drive.attach({ fileIds, projectId })
        await refreshResourceSnapshot()
        setSettings(await vaultApi.settings.get())
        const count = resources.length
        pushToast(
          'success',
          count === 1
            ? 'Google Doc attached to project'
            : `${count} Google Docs attached to project`
        )
      } catch (error) {
        pushToast('error', String(error))
        throw error
      }
    },
    [pushToast, refreshResourceSnapshot, setSettings, vaultApi]
  )

  const setProjectNotebookResource = useCallback(
    async (projectId: string, notebookPath: string): Promise<void> => {
      if (!vaultApi) return
      try {
        await vaultApi.resources.setProjectNotebook({ projectId, notebookPath })
        await refreshResourceSnapshot()
        setSettings(await vaultApi.settings.get())
        pushToast('success', 'Notebook resource linked to project')
      } catch (error) {
        pushToast('error', String(error))
        throw error
      }
    },
    [pushToast, refreshResourceSnapshot, setSettings, vaultApi]
  )

  const updateProjectResource = useCallback(
    async (input: ResourceUpdateInput): Promise<void> => {
      if (!vaultApi) return
      try {
        await vaultApi.resources.update(input)
        await refreshResourceSnapshot()
        setSettings(await vaultApi.settings.get())
        pushToast('success', 'Resource updated')
      } catch (error) {
        pushToast('error', String(error))
        throw error
      }
    },
    [pushToast, refreshResourceSnapshot, setSettings, vaultApi]
  )

  const setResourceProjectLinks = useCallback(
    async (input: { resourceId: string; projectIds: string[] }): Promise<void> => {
      if (!vaultApi) return
      try {
        await vaultApi.resources.setProjectLinks(input)
        await refreshResourceSnapshot()
        setSettings(await vaultApi.settings.get())
        pushToast('success', 'Resource project links updated')
      } catch (error) {
        pushToast('error', String(error))
        throw error
      }
    },
    [pushToast, refreshResourceSnapshot, setSettings, vaultApi]
  )

  const removeResource = useCallback(
    async (resourceId: string): Promise<void> => {
      if (!vaultApi) return
      try {
        await vaultApi.resources.remove(resourceId)
        await refreshResourceSnapshot()
        setSettings(await vaultApi.settings.get())
        pushToast('success', 'Resource deleted')
      } catch (error) {
        pushToast('error', String(error))
        throw error
      }
    },
    [pushToast, refreshResourceSnapshot, setSettings, vaultApi]
  )

  const detachProjectResource = useCallback(
    async (projectId: string, resourceId: string): Promise<void> => {
      if (!vaultApi) return
      try {
        await vaultApi.resources.detachFromProject({ projectId, resourceId })
        await refreshResourceSnapshot()
        setSettings(await vaultApi.settings.get())
        pushToast('success', 'Resource removed from project')
      } catch (error) {
        pushToast('error', String(error))
        throw error
      }
    },
    [pushToast, refreshResourceSnapshot, setSettings, vaultApi]
  )

  const captureResource = useCallback(
    async (canonicalUri: string): Promise<void> => {
      if (!vaultApi) return
      try {
        await vaultApi.resources.add({ canonicalUri })
        await refreshResourceSnapshot()
        pushToast('success', 'Source captured for review')
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [pushToast, refreshResourceSnapshot, vaultApi]
  )

  const locateResource = useCallback(
    async (resourceId: string): Promise<void> => {
      if (!vaultApi) return
      try {
        const selectedPath = await vaultApi.desktop.choosePath('Locate resource')
        if (!selectedPath) return
        await vaultApi.resources.locate(resourceId, selectedPath)
        await refreshResourceSnapshot()
        pushToast('success', 'Resource location updated')
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [pushToast, refreshResourceSnapshot, vaultApi]
  )

  const openResource = useCallback(
    async (resourceId: string): Promise<void> => {
      if (!vaultApi) return
      try {
        await vaultApi.resources.open(resourceId)
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [pushToast, vaultApi]
  )

  const revealResource = useCallback(
    async (resourceId: string): Promise<void> => {
      if (!vaultApi) return
      try {
        await vaultApi.resources.reveal(resourceId)
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [pushToast, vaultApi]
  )

  const refreshResource = useCallback(
    async (resourceId: string): Promise<void> => {
      if (!vaultApi) return
      try {
        await vaultApi.resources.refresh(resourceId)
        await refreshResourceSnapshot()
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [pushToast, refreshResourceSnapshot, vaultApi]
  )

  const refreshAllProjectResourceHealth = useCallback(async (): Promise<void> => {
    if (!vaultApi || !selectedProjectForHeader || isRefreshingResourceHealth) return

    const rows = getProjectResourceRows(
      selectedProjectForHeader,
      resourceSnapshot.resources,
      resourceSnapshot.relations
    )
    if (rows.length === 0) {
      pushToast('success', 'No project resources to refresh')
      return
    }

    setIsRefreshingResourceHealth(true)
    try {
      const results = await Promise.allSettled(
        rows.map(({ resource }) => vaultApi.resources.refresh(resource.id))
      )
      await refreshResourceSnapshot()

      const failedCount = results.filter((result) => result.status === 'rejected').length
      if (failedCount > 0) {
        pushToast(
          'error',
          `${failedCount} ${failedCount === 1 ? 'resource' : 'resources'} failed to refresh`
        )
      } else {
        pushToast(
          'success',
          `Refreshed health for ${rows.length} ${rows.length === 1 ? 'resource' : 'resources'}`
        )
      }
    } catch (error) {
      pushToast('error', String(error))
    } finally {
      setIsRefreshingResourceHealth(false)
    }
  }, [
    isRefreshingResourceHealth,
    pushToast,
    refreshResourceSnapshot,
    resourceSnapshot.relations,
    resourceSnapshot.resources,
    selectedProjectForHeader,
    vaultApi
  ])

  const refreshAllResourceHealth = useCallback(async (): Promise<void> => {
    if (!vaultApi || isRefreshingResourceHealth) return

    const resourcesToRefresh = resourceSnapshot.resources
    if (resourcesToRefresh.length === 0) {
      pushToast('success', 'No resources to refresh')
      return
    }

    setIsRefreshingResourceHealth(true)
    try {
      const results = await Promise.allSettled(
        resourcesToRefresh.map((resource) => vaultApi.resources.refresh(resource.id))
      )
      await refreshResourceSnapshot()

      const failedCount = results.filter((result) => result.status === 'rejected').length
      if (failedCount > 0) {
        pushToast(
          'error',
          `${failedCount} ${failedCount === 1 ? 'resource' : 'resources'} failed to refresh`
        )
      } else {
        pushToast(
          'success',
          `Refreshed health for ${resourcesToRefresh.length} ${
            resourcesToRefresh.length === 1 ? 'resource' : 'resources'
          }`
        )
      }
    } catch (error) {
      pushToast('error', String(error))
    } finally {
      setIsRefreshingResourceHealth(false)
    }
  }, [
    isRefreshingResourceHealth,
    pushToast,
    refreshResourceSnapshot,
    resourceSnapshot.resources,
    vaultApi
  ])

  const previewResource = useCallback(
    async (resourceId: string) => {
      if (!vaultApi) {
        throw new Error('No vault is open')
      }
      try {
        return await vaultApi.resources.preview(resourceId, true)
      } catch (error) {
        pushToast('error', String(error))
        throw error
      }
    },
    [pushToast, vaultApi]
  )

  const startGoogleDriveAuthorization = useCallback(async () => {
    if (!vaultApi) throw new Error('No vault is open')
    return vaultApi.resources.drive.startAuthorization()
  }, [vaultApi])

  const completeGoogleDriveAuthorization = useCallback(
    async (input: { connectionId: string; code: string; state: string }): Promise<void> => {
      if (!vaultApi) throw new Error('No vault is open')
      await vaultApi.resources.drive.completeAuthorization(input)
      setGoogleDriveConnected(true)
      await refreshResourceSnapshot()
      pushToast('success', 'Google Drive connected')
    },
    [pushToast, refreshResourceSnapshot, vaultApi]
  )

  const disconnectGoogleDrive = useCallback(async (): Promise<void> => {
    if (!vaultApi) throw new Error('No vault is open')
    await vaultApi.resources.drive.disconnect()
    setGoogleDriveConnected(false)
    await refreshResourceSnapshot()
    pushToast('success', 'Google Drive disconnected')
  }, [pushToast, refreshResourceSnapshot, vaultApi])

  const openExternal = useCallback(
    async (url: string): Promise<void> => {
      if (!vaultApi) throw new Error('No vault is open')
      await vaultApi.desktop.openExternal(url)
    },
    [vaultApi]
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
  const HeaderPageIcon = hasVault ? APP_PAGE_ICONS[activePage] : FolderOpen
  const headerPageIcon = <HeaderPageIcon size={14} strokeWidth={1.8} aria-hidden="true" />
  const headerPageLabelContent = (
    <BreadcrumbIconLabel icon={headerPageIcon}>{headerPageLabel}</BreadcrumbIconLabel>
  )
  const getWorkspaceTabPresentation = (
    tab: WorkspacePageTab
  ): {
    label: string
    icon: ReactElement
  } => {
    if (!hasVault) {
      return {
        label: 'Vault',
        icon: <FolderOpen size={16} strokeWidth={1.8} aria-hidden="true" />
      }
    }

    const workspaceView = tab.workspaceViewId
      ? workspaceViews.find((view) => view.id === tab.workspaceViewId)
      : null
    if (workspaceView) {
      return {
        label: workspaceView.name,
        icon: <NoteShapeIcon icon={workspaceView.icon} size={18} />
      }
    }

    if (tab.page === 'notes') {
      const session = getWorkspaceTabSession(tab.id)
      const notePath =
        tab.id === activeWorkspaceTabId
          ? (currentNotePath ?? currentExcalidrawPath)
          : (session.currentNotePath ?? session.currentExcalidrawPath)

      if (notePath) {
        const isDrawing = isExcalidrawPath(notePath)
        return {
          label: getNoteDisplayName(notePath),
          icon: isDrawing ? (
            <PenTool size={16} strokeWidth={1.8} aria-hidden="true" />
          ) : (
            <FileText size={16} strokeWidth={1.8} aria-hidden="true" />
          )
        }
      }

      const folderPath =
        tab.id === activeWorkspaceTabId ? browseFolderPath : session.browseFolderPath
      if (folderPath) {
        return {
          label: getNotebookFolderContents(noteTree, folderPath).name,
          icon: <NotebookFolderIcon variant="open" color={folderColors[folderPath]} size={16} />
        }
      }

      return {
        label: 'New note',
        icon: <FileText size={16} strokeWidth={1.8} aria-hidden="true" />
      }
    }

    if (tab.page === 'projects') {
      if ((tab.projectView ?? 'list') === 'list') {
        return {
          label: 'All Projects',
          icon: <APP_PAGE_ICONS.projects size={16} strokeWidth={1.8} aria-hidden="true" />
        }
      }
      const project =
        projects.find((candidate) => candidate.id === tab.projectId) ??
        (tab.id === activeWorkspaceTabId
          ? (projects.find((candidate) => candidate.id === selectedProjectId) ??
            selectedProjectForHeader)
          : null)

      return project
        ? {
            label:
              tab.projectView === 'pulse'
                ? `${project.name} · Activity`
                : tab.projectView === 'meetings'
                  ? `${project.name} · Meeting`
                  : project.name,
            icon: <NoteShapeIcon icon={project.icon} size={18} />
          }
        : {
            label: PAGE_LABELS.projects,
            icon: <APP_PAGE_ICONS.projects size={16} strokeWidth={1.8} aria-hidden="true" />
          }
    }

    if (tab.page === 'calendar') {
      return {
        label: formatCalendarTabPeriodTitle(tab.calendarDate, tab.calendarViewMode),
        icon: <CalendarDays size={16} strokeWidth={1.8} aria-hidden="true" />
      }
    }

    const PageIcon = APP_PAGE_ICONS[tab.page]
    return {
      label: PAGE_LABELS[tab.page],
      icon: <PageIcon size={16} strokeWidth={1.8} aria-hidden="true" />
    }
  }
  const presentedWorkspaceTabs = workspaceTabs.map((tab, index) => {
    const presentation = getWorkspaceTabPresentation(tab)
    return {
      id: tab.id,
      label: presentation.label,
      icon: presentation.icon,
      shortcut: index < 9 ? ['cmd', String(index + 1)] : undefined
    }
  })
  const presentedRecentPages = recentPageTargets.flatMap((target) => {
    if (target.kind === 'note' || target.kind === 'drawing') {
      if (!treeContainsPath(noteTree, target.path)) {
        return []
      }

      return [
        {
          id: getRecentPageTargetId(target),
          label: getNoteDisplayName(target.path),
          icon:
            target.kind === 'drawing' ? (
              <PenTool size={16} strokeWidth={1.8} aria-hidden="true" />
            ) : (
              <FileText size={16} strokeWidth={1.8} aria-hidden="true" />
            )
        }
      ]
    }

    if (target.kind === 'project') {
      const project = projects.find((candidate) => candidate.id === target.projectId)
      return project
        ? [
            {
              id: getRecentPageTargetId(target),
              label: project.name,
              icon: <NoteShapeIcon icon={project.icon} size={18} />
            }
          ]
        : []
    }

    const view = workspaceViews.find((candidate) => candidate.id === target.viewId)
    return view
      ? [
          {
            id: getRecentPageTargetId(target),
            label: view.name,
            icon: <NoteShapeIcon icon={view.icon} size={18} />
          }
        ]
      : []
  })
  const activeRecentTarget: RecentPageTarget | null = activeWorkspaceViewId
    ? { kind: 'view', viewId: activeWorkspaceViewId }
    : activePage === 'notes' && (currentNotePath || currentExcalidrawPath)
      ? currentExcalidrawPath
        ? { kind: 'drawing', path: currentExcalidrawPath }
        : { kind: 'note', path: currentNotePath as string }
      : activePage === 'projects' && projectView === 'home' && selectedProjectId
        ? { kind: 'project', projectId: selectedProjectId }
        : null
  const activeRecentPageId = activeRecentTarget
    ? getRecentPageTargetId(activeRecentTarget)
    : null
  const handleSidebarPageChange = useCallback(
    (page: AppPage): void => {
      if (page === 'notes') {
        void navigateToPage('notes').then(() => handleNotebookBreadcrumbFolderClick(null))
        return
      }

      if (page === 'projects') {
        void navigateToPage('projects').then(() => {
          openAllProjects()
        })
        return
      }

      if (page === 'settings') {
        openSettingsTab('profile')
        return
      }

      void navigateToPage(page)
    },
    [handleNotebookBreadcrumbFolderClick, navigateToPage, openAllProjects, openSettingsTab]
  )
  const handleOpenRecentPage = useCallback(
    (targetId: string): void => {
      const target = recentPageTargets.find(
        (candidate) => getRecentPageTargetId(candidate) === targetId
      )
      if (!target) {
        return
      }

      if (target.kind === 'note' || target.kind === 'drawing') {
        if (!treeContainsPath(noteTree, target.path)) {
          return
        }
        void navigateToPage('notes').then(() => openNotebookPath(target.path))
        return
      }

      if (target.kind === 'project') {
        if (!projects.some((project) => project.id === target.projectId)) {
          return
        }
        void navigateToPage('projects').then(() => openProject(target.projectId))
        return
      }

      openWorkspaceView(target.viewId)
    },
    [
      navigateToPage,
      noteTree,
      openNotebookPath,
      openProject,
      openWorkspaceView,
      projects,
      recentPageTargets
    ]
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

  const calendarViewToggle = (
    <div className="flex min-w-max items-center gap-1.5">
      <TabToggleGroup
        value={calendarViewMode}
        onValueChange={(value) => value && setCalendarViewMode(value as CalendarViewMode)}
        aria-label="Calendar view"
        data-testid="calendar-view-toggle"
        className="max-w-none"
      >
        {CALENDAR_VIEW_MODE_OPTIONS.map((option) => (
          <TabToggleGroupItem
            key={option.value}
            value={option.value}
            id={`calendar-view-tab-${option.value}`}
            aria-controls="calendar-view-panel"
          >
            {option.label}
          </TabToggleGroupItem>
        ))}
      </TabToggleGroup>
    </div>
  )

  const calendarPeriodNoun =
    calendarViewMode === 'week' ? 'week' : calendarViewMode === 'day' ? 'day' : 'month'
  const calendarPeriodLabels = {
    previous: `Previous ${calendarPeriodNoun}`,
    current: `Current ${calendarPeriodNoun}`,
    next: `Next ${calendarPeriodNoun}`
  }
  const calendarPeriodNavigation =
    !activeTask && activePage === 'calendar' ? (
      <WorkspaceHeaderActionGroup
        size="sm"
        aria-label="Calendar period navigation"
        data-testid="calendar-period-navigation"
      >
        <WorkspaceIconButton
          icon={<ChevronLeft size={16} aria-hidden="true" />}
          aria-label={calendarPeriodLabels.previous}
          title={calendarPeriodLabels.previous}
          data-testid="calendar-period-previous"
          onClick={goToPrevCalendarPeriod}
        />
        <WorkspaceIconButton
          icon={<CalendarDays size={16} aria-hidden="true" />}
          label={calendarPeriodLabels.current}
          aria-label={calendarPeriodLabels.current}
          title={calendarPeriodLabels.current}
          data-testid="calendar-period-current"
          onClick={goToToday}
        />
        <WorkspaceIconButton
          icon={<ChevronRight size={16} aria-hidden="true" />}
          aria-label={calendarPeriodLabels.next}
          title={calendarPeriodLabels.next}
          data-testid="calendar-period-next"
          onClick={goToNextCalendarPeriod}
        />
      </WorkspaceHeaderActionGroup>
    ) : null

  const projectPageMenuHandlers: ProjectMenuActionHandlers | null = selectedProjectForHeader
    ? {
        isFavorite: favoriteProjectIds.includes(selectedProjectForHeader.id),
        isExporting: isProjectContextExporting,
        onOpen: (project) => openProject(project.id),
        onToggleFavorite: (project) => toggleProjectFavoriteById(project.id),
        onToggleArchive: (project) => toggleProjectArchiveById(project.id),
        onExport: (project) => void exportProjectContext(project),
        onDelete: (project) => void removeProjectById(project.id)
      }
    : null

  const pageContextMenuItems = activeTask ? (
    <ActionMenuItems
      variant="dropdown"
      groups={[
        {
          id: 'destructive',
          items: [
            {
              id: 'delete-task',
              label: 'Delete task',
              icon: <Trash2 aria-hidden="true" />,
              testId: 'workspace-page-context-menu-item:delete-task',
              destructive: true,
              onSelect: () => setIsTaskDeleteDialogOpen(true)
            }
          ]
        }
      ]}
    />
  ) : activePage === 'schedules' ? (
    <SchedulingContextMenuItems
      activeView={schedulingView}
      onOpenApiGuide={() => {
        void navigateToPage('schedulingGuide')
      }}
    />
  ) : noteIsOpen && activePage === 'notes' && !searchQuery.trim() ? (
    <ActionMenuItems
      variant="dropdown"
      groups={[
        {
          id: 'content',
          items: [
            {
              id: 'copy-markdown',
              label: 'Copy raw Markdown',
              icon: <Copy aria-hidden="true" />,
              testId: 'workspace-page-context-menu-item:copy-markdown',
              onSelect: () => {
                void copyCurrentNoteMarkdown()
              }
            },
            {
              id: 'export-note',
              label: 'Export note',
              icon: <Download aria-hidden="true" />,
              testId: 'workspace-page-context-menu-item:export-note',
              onSelect: () => setIsNoteExportDialogOpen(true)
            }
          ]
        },
        {
          id: 'state',
          items: [
            {
              id: 'favorite-note',
              label: currentNoteIsFavorite ? 'Remove favorite' : 'Add favorite',
              icon: currentNoteIsFavorite ? (
                <Star aria-hidden="true" />
              ) : (
                <StarOutline aria-hidden="true" />
              ),
              testId: 'workspace-page-context-menu-item:favorite-note',
              onSelect: toggleCurrentNoteFavorite
            }
          ]
        },
        {
          id: 'destructive',
          items: [
            {
              id: 'delete-note',
              label: 'Delete note',
              icon: <Trash2 aria-hidden="true" />,
              testId: 'workspace-page-context-menu-item:delete-note',
              destructive: true,
              onSelect: () => {
                void deleteCurrentNote()
              }
            }
          ]
        }
      ]}
    />
  ) : activePage === 'projects' ? (
    <ActionMenuItems
      variant="dropdown"
      groups={[
        {
          id: 'creation',
          items: [
            {
              id: 'new-project',
              label: 'New project',
              icon: <Plus aria-hidden="true" />,
              testId: 'workspace-page-context-menu-item:new-project',
              disabled: isCreatingProject,
              onSelect: () => {
                void createProjectFromToolbar()
              }
            }
          ]
        },
        ...(selectedProjectForHeader && projectPageMenuHandlers
          ? getProjectMenuGroups(selectedProjectForHeader, projectPageMenuHandlers, {
              includeOpen: false
            })
          : [])
      ]}
    />
  ) : activePage === 'calendar' ? (
    <ActionMenuItems
      variant="dropdown"
      groups={[
        {
          id: 'navigation',
          items: [
            {
              id: 'previous-period',
              label: calendarPeriodLabels.previous,
              icon: <ChevronLeft aria-hidden="true" />,
              testId: 'workspace-page-context-menu-item:previous-period',
              onSelect: goToPrevCalendarPeriod
            },
            {
              id: 'current-period',
              label: calendarPeriodLabels.current,
              icon: <CalendarDays aria-hidden="true" />,
              testId: 'workspace-page-context-menu-item:current-period',
              onSelect: goToToday
            },
            {
              id: 'next-period',
              label: calendarPeriodLabels.next,
              icon: <ChevronRight aria-hidden="true" />,
              testId: 'workspace-page-context-menu-item:next-period',
              onSelect: goToNextCalendarPeriod
            }
          ]
        }
      ]}
    />
  ) : null

  const pageContextMenu = pageContextMenuItems ? (
    <WorkspacePageContextMenu>{pageContextMenuItems}</WorkspacePageContextMenu>
  ) : null
  const reloadNoteConflictFromDisk = useCallback(async (): Promise<void> => {
    if (!noteConflict || !vaultApi) {
      return
    }

    const relPath = noteConflict.path.replace(/^notebooks\//, '')
    const readResult = await vaultApi.files.readNoteDocumentWithRevision(relPath)
    const nextSession = {
      content: splitNoteContent(readResult.document.markdown).body,
      tags: [...readResult.document.tags]
    }
    getWorkspaceTabSession().noteEditorSessions[relPath] = nextSession
    persistedNoteFingerprintsRef.current[relPath] = serializeStoredNoteDocument(readResult.document)
    persistedNoteRevisionsRef.current[relPath] = readResult.revision.contentHash
    noteSaveCoordinator?.setBaseRevision(relPath, readResult.revision.contentHash)
    applyOpenNoteSession(relPath, nextSession)
    setNoteConflict(null)
  }, [applyOpenNoteSession, getWorkspaceTabSession, noteConflict, noteSaveCoordinator, vaultApi])
  const mergeNoteConflictFromDisk = useCallback(async (): Promise<void> => {
    if (!noteConflict || !vaultApi) {
      return
    }

    const relPath = noteConflict.path.replace(/^notebooks\//, '')
    const baseSerialized = persistedNoteFingerprintsRef.current[relPath]
    if (!baseSerialized) {
      pushToast(
        'warning',
        'The original note version is unavailable, so this conflict cannot be merged.'
      )
      return
    }

    const session = getWorkspaceTabSession().noteEditorSessions[relPath] ?? {
      content: currentNoteContentRef.current,
      tags: [...currentNoteTagsRef.current]
    }
    const baseDocument = parseStoredNoteDocument(baseSerialized)
    const externalRead = await vaultApi.files.readNoteDocumentWithRevision(relPath)
    const mergeResult = mergeMarkdownThreeWay(
      splitNoteContent(baseDocument.markdown).body,
      session.content,
      splitNoteContent(externalRead.document.markdown).body
    )

    if (mergeResult.status === 'conflict') {
      pushToast(
        'warning',
        'The note has overlapping edits. Keep one version or resolve it manually.'
      )
      return
    }

    const nextSession = {
      content: mergeResult.content,
      tags: [...session.tags]
    }
    getWorkspaceTabSession().noteEditorSessions[relPath] = nextSession
    persistedNoteRevisionsRef.current[relPath] = externalRead.revision.contentHash
    noteSaveCoordinator?.setBaseRevision(relPath, externalRead.revision.contentHash)
    updateNoteListEntryFromDocument(relPath, {
      markdown: mergeResult.content,
      tags: nextSession.tags
    })
    applyOpenNoteSession(relPath, nextSession)
    setNoteConflict(null)
    pushToast('success', 'Non-overlapping note edits were merged. Save to commit the result.')
  }, [
    applyOpenNoteSession,
    getWorkspaceTabSession,
    noteConflict,
    noteSaveCoordinator,
    pushToast,
    updateNoteListEntryFromDocument,
    vaultApi
  ])
  const vaultSyncActions: VaultSyncPageActions = {
    onReconcile: reconcileVaultSync,
    onValidate: reconcileVaultSync,
    onOpenFinder: async () => {
      if (vaultApi && vault?.rootPath) {
        await vaultApi.desktop.openPath(vault.rootPath)
      }
    },
    onOpenTerminal: async () => {
      if (vaultApi) {
        await vaultApi.desktop.openTerminal()
      }
    },
    onCreateBackup: async () => {
      if (!vaultApi) {
        return
      }

      const backup = await vaultApi.vault.createBackup()
      pushToast('success', `Portable backup created at ${backup.path}`)
    },
    onReviewConflict: async (conflict) => {
      const notePath = conflict.path.replace(/^notebooks\//, '')
      if (notePath.endsWith('.md')) {
        await navigateToPage('notes')
        await openNote(notePath)
      } else {
        pushToast('info', `Review ${conflict.path} in the vault folder.`)
      }
    },
    onRepairItem: async (repair) => {
      pushToast('warning', `Repair required for ${repair.path}`)
    }
  }
  const calendarCurrentPeriodLabel =
    !activeTask && activePage === 'calendar'
      ? formatCalendarTabPeriodTitle(selectedCalendarDate, calendarViewMode)
      : null

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
            schedulingReviewCount={schedulingReviewCount}
            isLocked={!hasVault}
            availablePages={availablePages}
            workspaceViews={workspaceViews}
            activeWorkspaceViewId={activeWorkspaceViewId}
            onOpenWorkspaceView={openWorkspaceView}
            onCreateWorkspaceView={(source) => {
              void handleCreateWorkspaceView(source)
            }}
            onDeleteWorkspaceView={requestDeleteWorkspaceView}
            resourceViewsEnabled={featureFlags.resources !== false}
            recentPages={presentedRecentPages}
            activeRecentPageId={activeRecentPageId}
            onOpenRecentPage={handleOpenRecentPage}
            className={paletteSurfaceClass}
            collapsible={isFocusMode ? 'offcanvas' : 'min'}
            macosTrafficLightInset={platform.api?.ui.platform === 'darwin'}
          />

          <SidebarInset className="!min-h-0 overflow-hidden p-2 pr-4 text-foreground antialiased">
            <div className="flex h-full min-w-0 flex-col gap-2">
              <WorkspaceContextProvider
                hasPanel={hasRightPanel}
                panelOpen={isRightPanelOpen}
                onTogglePanel={toggleRightPanel}
              >
                <WorkspaceTabManager
                  macosTrafficLightInset={isFocusMode && platform.api?.ui.platform === 'darwin'}
                  tabs={presentedWorkspaceTabs}
                  activeTabId={activeWorkspaceTabId}
                  onSelectTab={handleSelectWorkspaceTab}
                  onCloseTab={handleCloseWorkspaceTab}
                  onAddTab={handleCreateWorkspaceTab}
                  addDisabled={!hasVault}
                />
                <DocumentWorkspace hasPanel={hasRightPanel}>
                  <SchedulingWorkspaceProvider
                    enabled={activePage === 'schedules'}
                    vaultApi={vaultApi}
                    vaultRoot={vault?.rootPath ?? null}
                    pushToast={pushToast}
                    onWorkspaceDataChanged={refreshAutomationWorkspace}
                  >
                    <DocumentWorkspaceMainHeader
                      breadcrumb={
                        <div className="flex min-w-0 items-center gap-2">
                          {activeTask ? (
                            <Breadcrumb>
                              <BreadcrumbList className="text-muted-foreground">
                                <BreadcrumbItem>
                                  <BreadcrumbButton
                                    onClick={() => {
                                      void closeTaskPage()
                                    }}
                                    className="text-sm text-muted-foreground"
                                  >
                                    <BreadcrumbIconLabel
                                      icon={
                                        taskOrigin?.source === 'projects' ? (
                                          <APP_PAGE_ICONS.projects
                                            size={14}
                                            strokeWidth={1.8}
                                            aria-hidden="true"
                                          />
                                        ) : taskOrigin?.source === 'tasks' ? (
                                          taskOriginWorkspaceView ? (
                                            <NoteShapeIcon
                                              icon={taskOriginWorkspaceView.icon}
                                              size={16}
                                            />
                                          ) : (
                                            <APP_PAGE_ICONS.tasks
                                              size={14}
                                              strokeWidth={1.8}
                                              aria-hidden="true"
                                            />
                                          )
                                        ) : (
                                          <APP_PAGE_ICONS.calendar
                                            size={14}
                                            strokeWidth={1.8}
                                            aria-hidden="true"
                                          />
                                        )
                                      }
                                    >
                                      {taskOrigin?.source === 'projects'
                                        ? 'Projects'
                                        : taskOrigin?.source === 'tasks'
                                          ? (taskOriginWorkspaceView?.name ?? 'Tasks')
                                          : 'Calendar'}
                                    </BreadcrumbIconLabel>
                                  </BreadcrumbButton>
                                </BreadcrumbItem>
                                {taskOrigin?.source === 'projects' && activeTaskProject ? (
                                  <>
                                    <BreadcrumbSeparator className="text-muted-foreground" />
                                    <BreadcrumbItem>
                                      <BreadcrumbButton
                                        onClick={() => {
                                          selectProject(activeTaskProject.id)
                                          void closeTaskPage()
                                        }}
                                        className="max-w-[180px] text-sm text-muted-foreground"
                                      >
                                        <BreadcrumbIconLabel
                                          icon={
                                            <NoteShapeIcon
                                              icon={activeTaskProject.icon}
                                              size={16}
                                            />
                                          }
                                        >
                                          {activeTaskProject.name}
                                        </BreadcrumbIconLabel>
                                      </BreadcrumbButton>
                                    </BreadcrumbItem>
                                  </>
                                ) : null}
                                <BreadcrumbSeparator className="text-muted-foreground" />
                                <BreadcrumbItem>
                                  <BreadcrumbPage className="max-w-[260px] text-sm font-semibold text-foreground">
                                    <BreadcrumbIconLabel
                                      icon={
                                        <ListTodo size={14} strokeWidth={1.8} aria-hidden="true" />
                                      }
                                    >
                                      {activeTask.title}
                                    </BreadcrumbIconLabel>
                                  </BreadcrumbPage>
                                </BreadcrumbItem>
                              </BreadcrumbList>
                            </Breadcrumb>
                          ) : activePage === 'schedules' ? (
                            <SchedulingWorkspaceBreadcrumb
                              value={schedulingView}
                              onNavigate={setSchedulingView}
                            />
                          ) : activePage === 'projects' ? (
                            <ProjectsWorkspaceBreadcrumb
                              project={selectedProjectForHeader}
                              view={projectView}
                              onOpenAllProjects={openAllProjects}
                              onOpenProjectHome={() => {
                                if (selectedProjectForHeader) {
                                  openProject(selectedProjectForHeader.id)
                                }
                              }}
                            />
                          ) : activeWorkspaceView ? (
                            <WorkspaceViewBreadcrumb
                              key={activeWorkspaceView.id}
                              view={activeWorkspaceView}
                              onUpdateView={(update) => {
                                void updateWorkspaceView(activeWorkspaceView.id, update)
                              }}
                            />
                          ) : (
                            <Breadcrumb>
                              <BreadcrumbList className="text-muted-foreground">
                                <BreadcrumbItem>
                                  {noteHeaderBreadcrumbSegments ? (
                                    <BreadcrumbButton
                                      onClick={() => {
                                        void handleNotebookBreadcrumbFolderClick(null)
                                      }}
                                      className="text-sm text-muted-foreground"
                                      data-testid="notebook-breadcrumb:root"
                                    >
                                      {headerPageLabelContent}
                                    </BreadcrumbButton>
                                  ) : notebookBrowseBreadcrumbSegments && browseFolderPath ? (
                                    <BreadcrumbButton
                                      onClick={() => handleNotebookBrowseFolder(null)}
                                      className="text-sm text-muted-foreground"
                                      data-testid="notebook-breadcrumb:root"
                                    >
                                      {headerPageLabelContent}
                                    </BreadcrumbButton>
                                  ) : (
                                    <BreadcrumbPage className="text-sm text-muted-foreground">
                                      {headerPageLabelContent}
                                    </BreadcrumbPage>
                                  )}
                                </BreadcrumbItem>
                                {notebookBrowseBreadcrumbSegments ? (
                                  notebookBrowseBreadcrumbSegments.map((segment, index) => {
                                    const isLast =
                                      index === notebookBrowseBreadcrumbSegments.length - 1
                                    const path = notebookBrowseBreadcrumbSegments
                                      .slice(0, index + 1)
                                      .join('/')

                                    return (
                                      <Fragment key={`${path}:${index}`}>
                                        <BreadcrumbSeparator className="text-muted-foreground" />
                                        <BreadcrumbItem>
                                          {isLast ? (
                                            <BreadcrumbPage
                                              className="max-w-[220px] text-sm font-semibold text-foreground"
                                              data-testid={`notebook-breadcrumb:current:${path}`}
                                            >
                                              <BreadcrumbIconLabel
                                                icon={
                                                  <NotebookFolderIcon
                                                    variant="open"
                                                    color={folderColors[path]}
                                                    size={14}
                                                  />
                                                }
                                              >
                                                {segment}
                                              </BreadcrumbIconLabel>
                                            </BreadcrumbPage>
                                          ) : (
                                            <BreadcrumbButton
                                              onClick={() => handleNotebookBrowseFolder(path)}
                                              className="max-w-[140px] text-sm text-muted-foreground"
                                              data-testid={`notebook-breadcrumb:ancestor:${path}`}
                                            >
                                              <BreadcrumbIconLabel
                                                icon={
                                                  <NotebookFolderIcon
                                                    variant="closed"
                                                    color={folderColors[path]}
                                                    size={14}
                                                  />
                                                }
                                              >
                                                {segment}
                                              </BreadcrumbIconLabel>
                                            </BreadcrumbButton>
                                          )}
                                        </BreadcrumbItem>
                                      </Fragment>
                                    )
                                  })
                                ) : noteHeaderBreadcrumbSegments ? (
                                  noteHeaderBreadcrumbSegments.map((segment, index) => {
                                    const isLast = index === noteHeaderBreadcrumbSegments.length - 1
                                    const path = noteHeaderBreadcrumbSegments
                                      .slice(0, index + 1)
                                      .join('/')

                                    return (
                                      <Fragment key={`${segment}:${index}`}>
                                        <BreadcrumbSeparator className="text-muted-foreground" />
                                        <BreadcrumbItem>
                                          {isLast ? (
                                            <BreadcrumbPage className="max-w-[220px] text-sm font-semibold text-foreground">
                                              <BreadcrumbIconLabel
                                                icon={
                                                  currentExcalidrawPath ? (
                                                    <PenTool
                                                      size={14}
                                                      strokeWidth={1.8}
                                                      aria-hidden="true"
                                                    />
                                                  ) : (
                                                    <FileText
                                                      size={14}
                                                      strokeWidth={1.8}
                                                      aria-hidden="true"
                                                    />
                                                  )
                                                }
                                              >
                                                {segment}
                                              </BreadcrumbIconLabel>
                                            </BreadcrumbPage>
                                          ) : (
                                            <BreadcrumbButton
                                              onClick={() => {
                                                void handleNotebookBreadcrumbFolderClick(path)
                                              }}
                                              className="max-w-[140px] text-sm text-muted-foreground"
                                              data-testid={`notebook-breadcrumb:ancestor:${path}`}
                                            >
                                              <BreadcrumbIconLabel
                                                icon={
                                                  <NotebookFolderIcon
                                                    variant="closed"
                                                    color={folderColors[path]}
                                                    size={14}
                                                  />
                                                }
                                              >
                                                {segment}
                                              </BreadcrumbIconLabel>
                                            </BreadcrumbButton>
                                          )}
                                        </BreadcrumbItem>
                                      </Fragment>
                                    )
                                  })
                                ) : middleHeaderBreadcrumbItem ? (
                                  <>
                                    <BreadcrumbSeparator className="text-muted-foreground" />
                                    <BreadcrumbItem>
                                      <BreadcrumbPage className="max-w-[320px] text-sm font-semibold text-foreground">
                                        <BreadcrumbIconLabel icon={headerPageIcon}>
                                          {middleHeaderBreadcrumbItem}
                                        </BreadcrumbIconLabel>
                                      </BreadcrumbPage>
                                    </BreadcrumbItem>
                                  </>
                                ) : null}
                              </BreadcrumbList>
                            </Breadcrumb>
                          )}
                        </div>
                      }
                      primaryRightActions={
                        activeTask ? (
                          <WorkspaceIconButton
                            icon={<Copy size={18} aria-hidden="true" />}
                            label="Duplicate task"
                            data-testid="duplicate-task-button"
                            aria-label="Duplicate task"
                            title="Duplicate task"
                            borderless
                            disabled={!vaultApi}
                            onClick={() => void duplicateActiveTask()}
                          />
                        ) : activePage === 'resources' ? (
                          <WorkspaceIconButton
                            icon={<Plus size={18} aria-hidden="true" />}
                            label="Add resource"
                            variant="accent"
                            data-testid="add-resource-button"
                            aria-label="Add resource"
                            title="Add resource"
                            borderless
                            disabled={!vaultApi}
                            onClick={() => setResourceAddRequest(true)}
                          />
                        ) : !activeTask && activePage === 'projects' ? (
                          projectView === 'resources' && selectedProjectForHeader ? (
                            <WorkspaceIconButton
                              icon={<Plus size={18} aria-hidden="true" />}
                              label="Add resource"
                              variant="accent"
                              data-testid="add-resource-button"
                              aria-label="Add resource"
                              title="Add resource"
                              borderless
                              disabled={!vaultApi}
                              onClick={() =>
                                setResourceAddRequestProjectId(selectedProjectForHeader.id)
                              }
                            />
                          ) : projectView === 'home' && selectedProjectForHeader ? (
                            <WorkspaceIconButton
                              icon={<Download size={18} aria-hidden="true" />}
                              variant="muted"
                              data-testid="export-project-context-button"
                              aria-label="Export project context"
                              title="Export project context"
                              borderless
                              disabled={!vaultApi || isProjectContextExporting}
                              onClick={() => {
                                void exportProjectContext(selectedProjectForHeader)
                              }}
                            />
                          ) : projectView === 'list' ? (
                            <WorkspaceIconButton
                              icon={<Plus size={18} aria-hidden="true" />}
                              label="New project"
                              variant="accent"
                              data-testid="new-project-button"
                              aria-label="New project"
                              title="New project"
                              borderless
                              disabled={!vaultApi || isCreatingProject}
                              onClick={() => void createProjectFromToolbar()}
                            />
                          ) : null
                        ) : !activeTask && activePage === 'tasks' ? (
                          <WorkspaceIconButton
                            icon={<Plus size={18} aria-hidden="true" />}
                            label="New task"
                            variant="accent"
                            data-testid="new-task-button"
                            aria-label="New task"
                            title="New task"
                            borderless
                            disabled={!vaultApi || isCreatingTask}
                            onClick={() => void createTaskFromTasksPage()}
                          />
                        ) : !activeTask && activePage === 'schedules' ? (
                          schedulingView === 'list' ? (
                            <SchedulingAddAutomationButton
                              onCreate={() => setSchedulingView('automation')}
                            />
                          ) : (
                            <SchedulingTopbarActions activeView={schedulingView} />
                          )
                        ) : null
                      }
                      secondaryActions={
                        activeTask ? null : activePage === 'projects' ? (
                          <>
                            <ProjectsWorkspaceSecondaryActions
                              project={selectedProjectForHeader}
                              view={projectView}
                              onViewChange={(nextView) => {
                                if (selectedProjectForHeader) {
                                  if (nextView === 'pulse') {
                                    openProjectPulse(selectedProjectForHeader.id)
                                  } else if (nextView === 'meetings') {
                                    openProjectMeetings(selectedProjectForHeader.id)
                                  } else if (nextView === 'resources') {
                                    openProjectResources(selectedProjectForHeader.id)
                                  } else {
                                    openProject(selectedProjectForHeader.id)
                                  }
                                }
                              }}
                            />
                            {projectView === 'resources' && selectedProjectForHeader ? (
                              <WorkspaceHeaderSecondaryActionsRight>
                                <WorkspaceIconButton
                                  icon={
                                    <RefreshCw
                                      size={18}
                                      aria-hidden="true"
                                      className={
                                        isRefreshingResourceHealth ? 'animate-spin' : undefined
                                      }
                                    />
                                  }
                                  aria-label="Refresh all resource health"
                                  title="Refresh all resource health"
                                  data-testid="refresh-all-resource-health-button"
                                  bordered
                                  disabled={!vaultApi || isRefreshingResourceHealth}
                                  onClick={() => void refreshAllProjectResourceHealth()}
                                />
                              </WorkspaceHeaderSecondaryActionsRight>
                            ) : null}
                          </>
                        ) : activePage === 'resources' ? (
                          <WorkspaceHeaderSecondaryActionsRight>
                            <WorkspaceIconButton
                              icon={
                                <RefreshCw
                                  size={18}
                                  aria-hidden="true"
                                  className={
                                    isRefreshingResourceHealth ? 'animate-spin' : undefined
                                  }
                                />
                              }
                              aria-label="Refresh all resource health"
                              title="Refresh all resource health"
                              data-testid="refresh-all-resource-health-button"
                              bordered
                              disabled={!vaultApi || isRefreshingResourceHealth}
                              onClick={() => void refreshAllResourceHealth()}
                            />
                          </WorkspaceHeaderSecondaryActionsRight>
                        ) : activePage === 'schedules' ? (
                          <>
                            <div className="flex min-w-max items-center gap-1.5">
                              {schedulingView !== 'list' ? (
                                <SchedulingViewTabs
                                  value={schedulingView}
                                  onValueChange={setSchedulingView}
                                  reviewCount={schedulingReviewCount}
                                />
                              ) : null}
                              {schedulingView === 'automation' ? (
                                <SchedulingPythonTrustPopover vaultRoot={vault?.rootPath ?? null} />
                              ) : null}
                            </div>
                          </>
                        ) : activePage === 'calendar' ? (
                          <>
                            <div className="flex min-w-max items-center gap-1.5">
                              {calendarViewToggle}
                              <CalendarTaskFilter
                                tagOptions={calendarTaskTagOptions}
                                contentFilterOptions={calendarContentFilterOptions}
                                contentFilter={calendarContentFilter}
                                onContentFilterChange={setCalendarContentFilter}
                                selectedTags={activeCalendarTaskTags}
                                onSelectedTagsChange={setCalendarTaskTagSettings}
                              />
                            </div>
                            <WorkspaceHeaderSecondaryActionsRight>
                              {calendarPeriodNavigation}
                            </WorkspaceHeaderSecondaryActionsRight>
                          </>
                        ) : null
                      }
                      pageContextMenu={pageContextMenu}
                      pageContextMenuTrailing={
                        calendarCurrentPeriodLabel ? (
                          <span
                            className="text-sm font-semibold text-foreground"
                            data-testid="calendar-current-period"
                            title={calendarCurrentPeriodLabel}
                          >
                            {calendarCurrentPeriodLabel}
                          </span>
                        ) : null
                      }
                    />

                    <DocumentWorkspaceMain className={paletteSurfaceClass}>
                      <WorkspaceResizableLayout
                        hasPanel={hasRightPanel}
                        panelWidth={rightPanelWidth}
                        panelKey={workspacePanelKey}
                        panelCollapsed={isRightPanelCollapsed}
                        panelHidden={isFocusMode}
                        onPanelWidthChange={(width) => {
                          setStoredRightPanelWidth((current) => {
                            const pageWidths =
                              typeof current === 'number'
                                ? seedWorkspaceRightPanelWidths(current)
                                : current

                            return {
                              ...pageWidths,
                              [activePage]: clampWorkspaceRightPanelWidth(width)
                            }
                          })
                        }}
                        onPanelCollapsedChange={setIsRightPanelCollapsed}
                      >
                        <DocumentWorkspaceMainContent
                          className={
                            activeTask
                              ? '!overflow-hidden'
                              : activePage === 'calendar'
                                ? 'overflow-y-auto overflow-x-hidden'
                                : activePage === 'schedules'
                                  ? '!overflow-hidden'
                                  : activePage === 'notes' &&
                                      !searchQuery.trim() &&
                                      noteIsOpen &&
                                      !currentExcalidrawPath
                                    ? '!overflow-hidden'
                                    : undefined
                          }
                        >
                          <div
                            key={`${activeWorkspaceTabId}:${activePage}:${activeTask?.id ?? 'workspace'}`}
                            className={`motion-workspace-content w-full ${activeTask || activePage !== 'calendar' ? 'h-full' : ''}`.trim()}
                          >
                            {activeTask ? (
                              <TaskPage
                                task={activeTask}
                                onUpdateTask={updateProjectTask}
                                onRegisterFlush={registerTaskFlush}
                                vimModeEnabled={editorVimModeEnabled}
                                vimKeyMappings={editorVimKeyMappings}
                              />
                            ) : activePage === 'capture' ? (
                              <CapturePage
                                notes={fleetingNotes}
                                isLoading={fleetingNotesLoading}
                                onCapture={createFleetingNote}
                                onRemove={removeFleetingNote}
                                onUpdate={updateFleetingNote}
                                onConvert={convertFleetingNote}
                                resources={resourceSnapshot.resources}
                                onCaptureResource={captureResource}
                                onOpenResource={openResource}
                              />
                            ) : activePage === 'notes' ? (
                              searchQuery.trim() ? (
                                <SearchPage
                                  results={searchResults}
                                  onOpen={(result) => {
                                    if (result.entityType === 'resource' && result.resourceId) {
                                      void openResource(result.resourceId)
                                      return
                                    }
                                    void openNotebookPath(result.relPath)
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
                                    void openNoteMention(target)
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
                                <NotebookCardBrowser
                                  tree={visibleNoteTree}
                                  folderPath={browseFolderPath}
                                  folderColors={folderColors}
                                  selectedEntries={selectedNoteTreeEntries}
                                  onBrowseFolder={handleNotebookBrowseFolder}
                                  onSelectionChange={setSelectedNoteTreeEntries}
                                  onOpenPath={(relPath) => {
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
                                  onExportFolderMarkdown={(folderPath) => {
                                    void exportFolderMarkdown(folderPath)
                                  }}
                                  onRenamePath={(relPath, nextName, kind) => {
                                    void renameTreePath(relPath, nextName, kind)
                                  }}
                                  onDeleteEntries={(entries) => {
                                    void deleteTreeEntries(entries)
                                  }}
                                  onMoveEntries={moveTreeEntries}
                                  onFolderColorChange={(folderPath, color) => {
                                    void updateFolderColor(folderPath, color)
                                  }}
                                />
                              )
                            ) : activePage === 'knowledge' ? (
                              <KnowledgePage
                                notes={notes}
                                projects={projects}
                                tasks={calendarTasks}
                                resources={resourceSnapshot.resources}
                                orphanRingRadiusPx={knowledgeOrphanRingRadiusPx}
                                showOrphans={knowledgeShowOrphans}
                                onOpenNote={(relPath) => {
                                  void navigateToPage('notes')
                                  setSearchQuery('')
                                  setSearchResults([])
                                  void openNote(relPath)
                                }}
                                onOpenEntity={(kind, id) => {
                                  if (kind === 'task') {
                                    openTaskDialog(id, { source: 'calendar' })
                                  } else if (kind === 'resource') {
                                    void openResource(id)
                                  } else {
                                    void navigateToPage('projects').then(() => openProject(id))
                                  }
                                }}
                              />
                            ) : activeWorkspaceView ? (
                              <WorkspaceViewPage
                                key={activeWorkspaceView.id}
                                view={activeWorkspaceView}
                                projects={projects}
                                tasks={calendarTasks}
                                onOpenTask={(taskId) =>
                                  openTaskDialog(taskId, {
                                    source: 'tasks',
                                    workspaceViewId: activeWorkspaceView.id
                                  })
                                }
                                onDuplicateTask={(taskId) =>
                                  duplicateTaskInDialog(taskId, {
                                    source: 'tasks',
                                    workspaceViewId: activeWorkspaceView.id
                                  })
                                }
                                onUpdateView={(update) => {
                                  void updateWorkspaceView(activeWorkspaceView.id, update)
                                }}
                                resourcePageProps={{
                                  projects,
                                  noteTree,
                                  folderColors,
                                  resources: resourceSnapshot.resources,
                                  relations: resourceSnapshot.relations,
                                  addResourceRequest: resourceAddRequest,
                                  onAddResourceRequestHandled: () => setResourceAddRequest(false),
                                  onCreateResource: createResource,
                                  onUpdateResource: updateProjectResource,
                                  onSetResourceProjectLinks: setResourceProjectLinks,
                                  onRemoveResource: removeResource,
                                  onOpenResource: openResource,
                                  onOpenNotebookResource: (resourceId) => {
                                    void openNotebookResource(resourceId)
                                  },
                                  onLocateResource: locateResource,
                                  onRevealResource: revealResource,
                                  onRefreshResource: refreshResource,
                                  onPreviewResource: previewResource
                                }}
                              />
                            ) : activePage === 'resources' ? (
                              <ResourcesPage
                                projects={projects}
                                noteTree={noteTree}
                                folderColors={folderColors}
                                resources={resourceSnapshot.resources}
                                relations={resourceSnapshot.relations}
                                addResourceRequest={resourceAddRequest}
                                onAddResourceRequestHandled={() => setResourceAddRequest(false)}
                                onCreateResource={createResource}
                                onUpdateResource={updateProjectResource}
                                onSetResourceProjectLinks={setResourceProjectLinks}
                                onRemoveResource={removeResource}
                                onOpenResource={openResource}
                                onOpenNotebookResource={(resourceId) => {
                                  void openNotebookResource(resourceId)
                                }}
                                onLocateResource={locateResource}
                                onRevealResource={revealResource}
                                onRefreshResource={refreshResource}
                                onPreviewResource={previewResource}
                              />
                            ) : activePage === 'tasks' ? (
                              <TasksPage
                                projects={projects}
                                tasks={calendarTasks}
                                onOpenTask={(taskId) => openTaskDialog(taskId, { source: 'tasks' })}
                                onDuplicateTask={(taskId) =>
                                  duplicateTaskInDialog(taskId, { source: 'tasks' })
                                }
                              />
                            ) : activePage === 'projects' ? (
                              <ProjectsWorkspacePage
                                projects={projects}
                                tasks={calendarTasks}
                                favoriteProjectIds={favoriteProjectIds}
                                selectedProjectId={selectedProjectId}
                                view={projectView}
                                filterMode={projectFilterMode}
                                onFilterModeChange={setProjectFilterMode}
                                onUpdateProjectProperties={saveProjectProperties}
                                onOpenProject={openProject}
                                onToggleProjectFavorite={toggleProjectFavoriteById}
                                onToggleProjectArchive={toggleProjectArchiveById}
                                onExportProjectContext={(project) =>
                                  void exportProjectContext(project)
                                }
                                onDeleteProject={(projectId) => void removeProjectById(projectId)}
                                isProjectContextExporting={isProjectContextExporting}
                                onOpenProjectUpdates={openProjectPulse}
                                onCreateProjectUpdate={createProjectUpdate}
                                onUpdateProjectUpdate={updateProjectUpdate}
                                onDeleteProjectUpdate={deleteProjectUpdate}
                                onCreateProjectMeeting={createProjectMeeting}
                                onUpdateProjectMeeting={updateProjectMeeting}
                                onDeleteProjectMeeting={deleteProjectMeeting}
                                noteTree={noteTree}
                                folderColors={folderColors}
                                resources={resourceSnapshot.resources}
                                relations={resourceSnapshot.relations}
                                onAddResource={addProjectResource}
                                addResourceRequestProjectId={resourceAddRequestProjectId}
                                onAddResourceRequestHandled={handleResourceAddRequestHandled}
                                onSetProjectNotebook={setProjectNotebookResource}
                                onUpdateResource={updateProjectResource}
                                onDetachResource={detachProjectResource}
                                onOpenResource={openResource}
                                onOpenNotebookResource={(resourceId) => {
                                  void openNotebookResource(resourceId)
                                }}
                                onLocateResource={locateResource}
                                onRevealResource={revealResource}
                                onRefreshResource={refreshResource}
                                onPreviewResource={previewResource}
                                googleDriveEnabled={featureFlags.googleDriveResources}
                                googleDriveConnected={googleDriveConnected}
                                onListGoogleDriveFiles={listGoogleDriveFiles}
                                onAttachGoogleDriveResources={attachGoogleDriveResources}
                                notes={notes}
                                vimModeEnabled={editorVimModeEnabled}
                                vimKeyMappings={editorVimKeyMappings}
                                onOpenNoteLink={(target) => {
                                  void openNoteMention(target)
                                }}
                                onCreateTask={createProjectTask}
                                onCreateMilestone={createProjectMilestone}
                                onUpdateMilestone={updateProjectMilestone}
                                onDeleteMilestone={deleteProjectMilestone}
                                onReorderMilestones={reorderProjectMilestones}
                                onOpenMilestoneDialog={openMilestoneDialog}
                                onUpdateProject={(projectId, draft) =>
                                  saveProject(projectId, {
                                    name: draft.name,
                                    description: draft.description,
                                    icon: draft.icon
                                  })
                                }
                                onUpdateTask={updateProjectTask}
                                onDeleteTask={(taskId) => void removeCalendarTask(taskId)}
                                onDuplicateTask={(taskId) =>
                                  duplicateTaskInDialog(taskId, {
                                    source: 'projects',
                                    projectId: selectedProjectForHeader?.id ?? selectedProjectId
                                  })
                                }
                                onOpenTask={(taskId, options) => {
                                  openTaskDialog(
                                    taskId,
                                    {
                                      source: 'projects',
                                      projectId: selectedProjectForHeader?.id ?? selectedProjectId
                                    },
                                    options
                                  )
                                }}
                              />
                            ) : activePage === 'subscriptions' ? (
                              vaultApi ? (
                                <SubscriptionsPage vaultApi={vaultApi} pushToast={pushToast} />
                              ) : null
                            ) : activePage === 'schedules' ? (
                              <SchedulingPage
                                activeView={schedulingView}
                                onViewChange={setSchedulingView}
                              />
                            ) : activePage === 'schedulingGuide' ? (
                              <SchedulingApiGuidePage />
                            ) : activePage === 'calendar' ? (
                              <div className="min-h-full">
                                <section
                                  id="calendar-view-panel"
                                  role="tabpanel"
                                  aria-labelledby={`calendar-view-tab-${calendarViewMode}`}
                                  data-testid={`calendar-${calendarViewMode}-shell`}
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
                                        onOpenTask={(taskId, options) => {
                                          openTaskDialog(taskId, { source: 'calendar' }, options)
                                        }}
                                        onDuplicateTask={(taskId) =>
                                          duplicateTaskInDialog(taskId, { source: 'calendar' })
                                        }
                                        onCopyTaskToSchedule={copyTaskToSchedule}
                                        onRescheduleTask={(taskId, newDate) => {
                                          void rescheduleCalendarTask(taskId, newDate)
                                        }}
                                        onDeleteTask={(taskId) => {
                                          void removeCalendarTask(taskId)
                                        }}
                                        onUpdateTask={updateProjectTask}
                                        onUpdateTaskSchedule={(taskId, schedule) => {
                                          void updateCalendarTaskSchedule(taskId, schedule)
                                        }}
                                      />
                                    ) : calendarViewMode === 'day' ? (
                                      <CalendarDayView
                                        selectedDate={selectedCalendarDate}
                                        tasks={visibleCalendarTasks.filter((task) => {
                                          return isCalendarTaskOnDate(task, selectedCalendarDate)
                                        })}
                                        onSelectDate={setSelectedCalendarDate}
                                        onRescheduleTask={(taskId, newDate) => {
                                          void rescheduleCalendarTask(taskId, newDate)
                                        }}
                                        onOpenTask={(taskId) => {
                                          openTaskDialog(taskId, { source: 'calendar' })
                                        }}
                                        onDuplicateTask={(taskId) =>
                                          duplicateTaskInDialog(taskId, { source: 'calendar' })
                                        }
                                        onDeleteTask={(taskId) => {
                                          void removeCalendarTask(taskId)
                                        }}
                                        onUpdateTask={updateProjectTask}
                                      />
                                    ) : (
                                      <CalendarMonthView
                                        selectedDate={selectedCalendarDate}
                                        tasks={visibleCalendarTasks}
                                        projects={projects}
                                        onSelectDate={setSelectedCalendarDate}
                                        onCreateTask={createTaskForDate}
                                        onOpenTask={(taskId, options) => {
                                          openTaskDialog(taskId, { source: 'calendar' }, options)
                                        }}
                                        onDuplicateTask={(taskId) =>
                                          duplicateTaskInDialog(taskId, { source: 'calendar' })
                                        }
                                        onCopyTaskToSchedule={copyTaskToSchedule}
                                        onRescheduleTask={(taskId, newDate) => {
                                          void rescheduleCalendarTask(taskId, newDate)
                                        }}
                                        onResizeTaskStart={(taskId, newStartDate) => {
                                          void resizeCalendarTaskStart(taskId, newStartDate)
                                        }}
                                        onResizeTaskEnd={(taskId, newEndDate) => {
                                          void resizeCalendarTaskEnd(taskId, newEndDate)
                                        }}
                                        onDeleteTask={(taskId) => {
                                          void removeCalendarTask(taskId)
                                        }}
                                        onUpdateTask={updateProjectTask}
                                        onUpdateTaskPriority={(taskId, priority) => {
                                          void updateCalendarTaskPriority(taskId, priority)
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
                                    )}
                                  </div>
                                </section>
                              </div>
                            ) : activePage === 'designAudit' ? (
                              <DesignAuditPage
                                themeVersion={`dark:${fontFamily}:${codeFontFamily}`}
                                activeTab={activeDesignAuditTab}
                                onTabChange={setActiveDesignAuditTab}
                              />
                            ) : activePage === 'settings' ? (
                              <SettingsPage
                                initialTab={settingsTabRequest}
                                syncHealth={
                                  platform.kind === 'desktop' && vaultApi
                                    ? {
                                        status: vaultSyncPageStatus,
                                        snapshot: vaultSyncSnapshot,
                                        actions: vaultSyncActions
                                      }
                                    : undefined
                                }
                                profileName={profileName}
                                mistralApiKeyConfigured={mistralApiKeyConfigured}
                                editorVimModeEnabled={editorVimModeEnabled}
                                editorVimKeyMappings={editorVimKeyMappings}
                                vaultLocation={vault?.rootPath ?? lastVaultPath}
                                savedVaultCount={savedVaultCount}
                                onSaveProfile={(name) => {
                                  void updateProfileName(name)
                                }}
                                fontFamily={fontFamily}
                                onSaveFont={(fontId) => {
                                  void updateAppFont(fontId)
                                }}
                                codeFontFamily={codeFontFamily}
                                onSaveCodeFont={(fontId) => {
                                  void updateCodeFont(fontId)
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
                                onMigrateNoteImagePaths={() => {
                                  void migrateNoteImagePaths()
                                }}
                                onImportLegacyExcalidrawSessions={() => {
                                  void importLegacyExcalidrawSessions()
                                }}
                                onOpenDesignAudit={() => {
                                  void navigateToPage('designAudit')
                                }}
                                pythonCondaEnvironmentPath={pythonCondaEnvironmentPath}
                                pythonCondaExecutablePath={pythonCondaExecutablePath}
                                detectedCondaExecutablePath={detectedCondaExecutablePath}
                                condaEnvironments={condaEnvironments}
                                condaEnvironmentsLoading={condaEnvironmentsLoading}
                                condaEnvironmentsError={condaEnvironmentsError}
                                onRefreshCondaEnvironments={() => {
                                  void loadCondaEnvironments()
                                }}
                                onSelectCondaEnvironment={(path) => {
                                  void updatePythonCondaEnvironment(path)
                                }}
                                onChooseCondaExecutable={() => {
                                  void choosePythonCondaExecutable()
                                }}
                                onResetCondaExecutable={() => {
                                  void resetPythonCondaExecutable()
                                }}
                                featureFlags={featureFlags}
                                onUpdateFeatureFlag={(key, enabled) => {
                                  void updateFeatureFlag(key, enabled)
                                }}
                                googleDriveConnected={googleDriveConnected}
                                onStartGoogleDriveAuthorization={startGoogleDriveAuthorization}
                                onCompleteGoogleDriveAuthorization={
                                  completeGoogleDriveAuthorization
                                }
                                onDisconnectGoogleDrive={disconnectGoogleDrive}
                                onOpenExternal={openExternal}
                              />
                            ) : (
                              <div className="p-5 text-sm text-muted-foreground">
                                {activePage} workspace ready. Notes remain fully functional.
                              </div>
                            )}
                          </div>
                        </DocumentWorkspaceMainContent>
                        {activePage === 'knowledge' ? (
                          [
                            <KnowledgeGraphSettingsPanel
                              key="knowledge-graph-settings"
                              orphanRingRadiusInput={knowledgeOrphanRingRadiusInput}
                              orphanRingRadiusPx={knowledgeOrphanRingRadiusPx}
                              onOrphanRingRadiusInputChange={setKnowledgeOrphanRingRadiusInput}
                              onResetOrphanRingRadius={() => {
                                setKnowledgeOrphanRingRadiusInput('')
                              }}
                            />,
                            <KnowledgeOrphanVisibilityPanel
                              key="knowledge-orphan-visibility"
                              showOrphans={knowledgeShowOrphans}
                              onShowOrphansChange={setKnowledgeShowOrphans}
                            />
                          ]
                        ) : (
                          <DocumentWorkspacePanel className={paletteSurfaceClass}>
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
                                            <ActionMenuItems
                                              variant="dropdown"
                                              groups={[
                                                {
                                                  id: 'creation',
                                                  items: [
                                                    {
                                                      id: 'new-note',
                                                      label: 'New note',
                                                      icon: <FileText aria-hidden="true" />,
                                                      onSelect: () => {
                                                        void createNoteFromTree()
                                                      }
                                                    },
                                                    {
                                                      id: 'new-drawing',
                                                      label: 'New drawing',
                                                      icon: <PenTool aria-hidden="true" />,
                                                      onSelect: () => {
                                                        void createExcalidrawFromTree()
                                                      }
                                                    },
                                                    {
                                                      id: 'new-folder',
                                                      label: 'New folder',
                                                      icon: <NotebookFolderIcon variant="closed" size={16} />,
                                                      onSelect: () => {
                                                        void createFolderFromTree()
                                                      }
                                                    }
                                                  ]
                                                },
                                                {
                                                  id: 'import',
                                                  items: [
                                                    {
                                                      id: 'import-markdown',
                                                      label: 'Import markdown',
                                                      icon: <Download aria-hidden="true" />,
                                                      onSelect: () => {
                                                        void importNotes()
                                                      }
                                                    }
                                                  ]
                                                }
                                              ]}
                                            />
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      )}
                                    </WorkspaceHeaderActions>
                                  ) : null
                                }
                              />

                              <DocumentWorkspacePanelContent
                                className="overflow-hidden"
                                data-testid="workspace-right-panel-content"
                              >
                                {!hasVault ? (
                                  <WorkspacePanelStack>
                                    <WorkspacePanelSection>
                                      <EmptyState
                                        className="m-0 border-0 bg-transparent p-3"
                                        icon={LayoutGrid}
                                        title="Context"
                                        description="Select a vault to see workspace properties and secondary tools."
                                      />
                                    </WorkspacePanelSection>
                                  </WorkspacePanelStack>
                                ) : activeTask ? (
                                  <TaskPropertiesPanel
                                    task={activeTask}
                                    projects={projects}
                                    availableTags={calendarTaskTagValues}
                                    onUpdateTask={updateProjectTask}
                                    onConfigureRecurrence={configureTaskRecurrence}
                                  />
                                ) : activePage === 'designAudit' ? (
                                  <DesignAuditRightPanel
                                    activeTab={activeDesignAuditTab}
                                    onTabChange={setActiveDesignAuditTab}
                                  />
                                ) : activePage === 'notes' ? (
                                  <WorkspacePanelStack data-testid="notes-panel-stack">
                                    <CollapsibleWorkspacePanelSection
                                      data-testid="note-file-tree-panel"
                                      heading="Explorer"
                                      className="overflow-hidden p-0"
                                    >
                                      <NotesTreeView
                                        tree={visibleNoteTree}
                                        folderColors={folderColors}
                                        searchTerm={searchQuery}
                                        activeNotePath={currentNotePath ?? currentExcalidrawPath}
                                        selectedEntries={selectedNoteTreeEntries}
                                        collapseAllToken={collapseAllNotesTreeToken}
                                        shouldCollapseAllFolders={areAllNoteFoldersCollapsed}
                                        pendingEditId={pendingNoteTreeEditId}
                                        onPendingEditHandled={handlePendingNoteTreeEditHandled}
                                        onSelectionChange={handleNoteTreeSelectionChange}
                                        onOpenNote={(relPath) => {
                                          setSearchQuery('')
                                          setSearchResults([])
                                          void openNotebookPath(relPath)
                                        }}
                                        onCreateNote={(parentDir) => {
                                          setSelectedNoteTreeEntries(
                                            parentDir
                                              ? [{ kind: 'folder', relPath: parentDir }]
                                              : []
                                          )
                                          void createNoteFromTree(parentDir)
                                        }}
                                        onCreateExcalidraw={(parentDir) => {
                                          setSelectedNoteTreeEntries(
                                            parentDir
                                              ? [{ kind: 'folder', relPath: parentDir }]
                                              : []
                                          )
                                          void createExcalidrawFromTree(parentDir)
                                        }}
                                        onCreateFolder={(parentDir) => {
                                          setSelectedNoteTreeEntries(
                                            parentDir
                                              ? [{ kind: 'folder', relPath: parentDir }]
                                              : []
                                          )
                                          void createFolderFromTree(parentDir)
                                        }}
                                        onExportFolderPdf={(folderPath) => {
                                          void exportFolderPdf(folderPath)
                                        }}
                                        onExportFolderMarkdown={(folderPath) => {
                                          void exportFolderMarkdown(folderPath)
                                        }}
                                        onRenamePath={(relPath, nextName, kind) => {
                                          void renameTreePath(relPath, nextName, kind)
                                        }}
                                        onDeleteEntries={(entries) => {
                                          void deleteTreeEntries(entries)
                                        }}
                                        onMoveEntries={moveTreeEntries}
                                        onFolderColorChange={(folderPath, color) => {
                                          void updateFolderColor(folderPath, color)
                                        }}
                                      />
                                    </CollapsibleWorkspacePanelSection>
                                    {noteIsOpen && !searchQuery.trim() && !currentExcalidrawPath ? (
                                      <CollapsibleWorkspacePanelSection
                                        key={currentNotePath ?? 'note-outline'}
                                        data-testid="note-outline-panel"
                                        heading="Outline"
                                        className="shrink-0 overflow-hidden p-0"
                                      >
                                        <NoteOutlinePanel
                                          items={currentNoteOutline}
                                          onJumpToIndex={(index) => {
                                            currentNoteEditorRef.current?.jumpToOutlineIndex(index)
                                          }}
                                        />
                                      </CollapsibleWorkspacePanelSection>
                                    ) : null}
                                    {noteIsOpen && !searchQuery.trim() && !currentExcalidrawPath ? (
                                      <CollapsibleWorkspacePanelSection
                                        key={`backlinks:${currentNotePath ?? 'note-backlinks'}`}
                                        data-testid="note-backlinks-panel"
                                        heading="Backlinks"
                                        className="shrink-0 overflow-hidden p-0"
                                      >
                                        <NoteBacklinksPanel
                                          backlinks={currentNoteBacklinks}
                                          onOpenBacklink={(relPath) => {
                                            void openNote(relPath)
                                          }}
                                        />
                                      </CollapsibleWorkspacePanelSection>
                                    ) : null}
                                  </WorkspacePanelStack>
                                ) : activePage === 'projects' ? (
                                  <ProjectsWorkspaceRightPanel
                                    projects={projects}
                                    tasks={calendarTasks}
                                    favoriteProjectIds={favoriteProjectIds}
                                    selectedProjectId={selectedProjectId}
                                    onToggleProjectFavorite={toggleProjectFavoriteById}
                                    onToggleProjectArchive={toggleProjectArchiveById}
                                    onUpdateProjectProperties={saveProjectProperties}
                                    onCreateMilestone={createProjectMilestoneFromPanel}
                                    onOpenMilestone={openMilestoneDialog}
                                  />
                                ) : activePage === 'calendar' ? (
                                  <CalendarTaskPanel
                                    tasks={visibleUnscheduledTasks}
                                    dragPreview={calendarViewMode === 'week' ? 'floating' : 'clone'}
                                    hasActiveFilter={hasActiveCalendarFilter}
                                    projects={projects}
                                    selectedDate={selectedCalendarDate}
                                    newTaskValue={calendarHeaderNewTask}
                                    onNewTaskValueChange={setCalendarHeaderNewTask}
                                    onOpenTask={(taskId) => {
                                      openTaskDialog(taskId, { source: 'calendar' })
                                    }}
                                    onDuplicateTask={(taskId) =>
                                      duplicateTaskInDialog(taskId, { source: 'calendar' })
                                    }
                                    onCopyTaskToSchedule={copyTaskToSchedule}
                                    onDelete={(taskId) => {
                                      void removeCalendarTask(taskId)
                                    }}
                                    onUpdatePriority={(taskId, priority) => {
                                      void updateCalendarTaskPriority(taskId, priority)
                                    }}
                                    onUpdateTaskType={(taskId, taskType) => {
                                      void updateCalendarTaskType(taskId, taskType)
                                    }}
                                    onUpdateTask={(taskId, patch) => {
                                      void updateProjectTask(taskId, patch)
                                    }}
                                    onUpdateStatus={(taskId, status) => {
                                      void updateProjectTask(taskId, {
                                        status,
                                        completed: isTaskStatusDone(status)
                                      })
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
                                ) : activePage === 'schedules' ? (
                                  <SchedulingRightPanel activeView={schedulingView} />
                                ) : (
                                  <WorkspacePanelStack>
                                    <WorkspacePanelSection>
                                      <EmptyState
                                        className="m-0 border-0 bg-transparent p-3"
                                        icon={LayoutGrid}
                                        title="Context"
                                        description="Properties, activity, and secondary tools for this workspace will appear here."
                                      />
                                    </WorkspacePanelSection>
                                  </WorkspacePanelStack>
                                )}
                              </DocumentWorkspacePanelContent>
                            </div>
                          </DocumentWorkspacePanel>
                        )}
                      </WorkspaceResizableLayout>
                    </DocumentWorkspaceMain>
                  </SchedulingWorkspaceProvider>
                </DocumentWorkspace>
                <WorkspaceFooter />
              </WorkspaceContextProvider>
            </div>
          </SidebarInset>
        </SidebarProvider>
      ) : (
        <NoVaultPage
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
      {taskDialogTask ? (
        <TaskEditDialog
          key={taskDialogTask.id}
          task={taskDialogTask}
          isNewTask={taskDialogIsNewTask}
          projects={projects}
          tasks={calendarTasks}
          availableTags={calendarTaskTagValues}
          vimModeEnabled={editorVimModeEnabled}
          vimKeyMappings={editorVimKeyMappings}
          onClose={() => {
            setOpenTaskDialogId(null)
            setTaskDialogOrigin(null)
            setTaskDialogIsNewTask(false)
          }}
          onSave={updateProjectTask}
          onDuplicate={(taskId) =>
            taskDialogOrigin ? duplicateTaskInDialog(taskId, taskDialogOrigin) : Promise.resolve()
          }
          onConfigureRecurrence={configureTaskRecurrence}
          onDelete={(taskId) => {
            setOpenTaskDialogId(null)
            setTaskDialogOrigin(null)
            setTaskDialogIsNewTask(false)
            void removeCalendarTask(taskId)
          }}
          onOpenFullPage={() => {
            if (!taskDialogOrigin) {
              return
            }

            openTaskPage(taskDialogTask.id, taskDialogOrigin)
          }}
        />
      ) : null}
      {milestoneDialogProject && milestoneDialogMilestone ? (
        <MilestonePage
          key={`${milestoneDialogMilestone.id}:${milestoneDialogIsNew ? 'new' : 'existing'}`}
          project={milestoneDialogProject}
          milestone={milestoneDialogMilestone}
          tasks={calendarTasks}
          isNewMilestone={milestoneDialogIsNew}
          onClose={closeMilestoneDialog}
          onUpdateMilestone={(milestoneId, patch) =>
            updateProjectMilestone(milestoneDialogProject.id, milestoneId, patch)
          }
          onDeleteMilestone={() => {
            const childTaskCount = calendarTasks.filter(
              (task) =>
                task.projectId === milestoneDialogProject.id &&
                task.milestoneId === milestoneDialogMilestone.id
            ).length
            if (
              childTaskCount > 0 &&
              !window.confirm(
                `Delete milestone "${milestoneDialogMilestone.title}" and move its ${childTaskCount} ${childTaskCount === 1 ? 'task' : 'tasks'} to the project?`
              )
            ) {
              return false
            }

            void deleteProjectMilestone(milestoneDialogProject.id, milestoneDialogMilestone.id)
            return true
          }}
          onCreateTask={(milestoneId) =>
            createProjectTask(milestoneDialogProject.id, 'New Task', milestoneId)
          }
          onOpenTask={(taskId, options) => {
            closeMilestoneDialog()
            openTaskDialog(
              taskId,
              {
                source: 'projects',
                projectId: milestoneDialogProject.id,
                milestoneId: milestoneDialogMilestone.id
              },
              options
            )
          }}
          onUpdateTask={updateProjectTask}
          onDeleteTask={(taskId) => void removeCalendarTask(taskId)}
        />
      ) : null}
      <AlertDialog open={isTaskDeleteDialogOpen} onOpenChange={setIsTaskDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes “{activeTask?.title ?? 'this task'}” from the calendar and
              project views.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const taskId = activeTask?.id
                setIsTaskDeleteDialogOpen(false)
                if (!taskId) {
                  return
                }

                void closeTaskPage().then(() => removeCalendarTask(taskId))
              }}
            >
              Delete task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(noteConflict)}
        onOpenChange={(open) => {
          if (!open) {
            setNoteConflict(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Note changed outside Xingularity</AlertDialogTitle>
            <AlertDialogDescription>
              {noteConflict?.message ?? 'The disk version changed after this note was opened.'} Your
              draft is still kept in the editor; choose whether to reload the disk version or keep
              editing locally.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                if (!noteConflict) {
                  return
                }
                const relPath = noteConflict.path.replace(/^notebooks\//, '')
                const nextBaseHash = noteConflict.actualRevision?.contentHash ?? null
                persistedNoteRevisionsRef.current[relPath] = nextBaseHash
                noteSaveCoordinator?.setBaseRevision(relPath, nextBaseHash)
                syncCurrentNoteDirtyState(relPath)
                setNoteConflict(null)
              }}
            >
              Keep local draft
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void mergeNoteConflictFromDisk().catch((error) => {
                  pushToast('error', String(error))
                })
              }}
            >
              Merge edits
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                void reloadNoteConflictFromDisk().catch((error) => {
                  pushToast('error', String(error))
                })
              }}
            >
              Reload disk version
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(workspaceViewToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setWorkspaceViewToDelete(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete saved view?</AlertDialogTitle>
            <AlertDialogDescription>
              {workspaceViewToDelete
                ? `“${workspaceViewToDelete.name}” will be removed from this vault. Its table data will remain unchanged.`
                : 'This saved view will be removed from this vault.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void deleteWorkspaceView()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="workspace-view-delete-confirm"
            >
              Delete view
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
          if (page === 'settings') {
            openSettingsTab('profile')
            return
          }

          void navigateToPage(page)
        }}
        onOpenSyncHealth={
          platform.kind === 'desktop' && vaultApi ? () => openSettingsTab('sync') : undefined
        }
        onOpenWarpAtNoteFolder={openCurrentNoteFolderInWarp}
        onOpenVaultFinder={openVaultRootInFinder}
        onOpenVaultTerminal={openVaultRootInTerminal}
        onReconcileVault={reconcileVaultFromCommandPalette}
        onCreateVaultBackup={createVaultBackupFromCommandPalette}
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

function formatCalendarTabPeriodTitle(dateIso: string, viewMode: CalendarViewMode): string {
  if (viewMode === 'week') {
    const start = startOfWeekIso(parseIsoDate(dateIso))
    return formatWeekRange(start, addIsoDays(start, 6))
  }

  if (viewMode === 'day') {
    return parseIsoDate(dateIso).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return parseIsoDate(dateIso).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric'
  })
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
