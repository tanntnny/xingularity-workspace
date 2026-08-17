export type Maybe<T> = T | null

export interface VaultInfo {
  rootPath: string
  notebooksPath: string
  // Compatibility alias for older renderer/main call sites.
  notesPath: string
  attachmentsPath: string
}

export interface VaultSettings {
  version: number
  createdAt: string
}

export interface NoteMetadata {
  title: string
  tags: string[]
  created?: string
  updated?: string
}

export interface StoredNoteDocument {
  version: 1
  tags: string[]
  markdown: string
}

export interface NoteRecord {
  id: string
  relPath: string
  metadata: NoteMetadata
  body: StoredNoteDocument
}

export interface NotePdfExportImage {
  id: string
  src: string
}

export const NOTE_PDF_IMAGE_URI_PREFIX = 'xingularity-export-image://'

export interface NotePdfExportInput {
  relPath: string
  title: string
  html: string
  images: NotePdfExportImage[]
}

export interface NotePdfExportResult {
  path: Maybe<string>
  warnings: string[]
}

export interface FolderPdfExportInput {
  folderPath: string
}

export interface FolderPdfExportResult {
  path: Maybe<string>
  noteCount: number
  warnings: string[]
}

export interface FolderMarkdownExportInput {
  folderPath: string
}

export interface FolderMarkdownExportResult {
  path: Maybe<string>
  noteCount: number
  warnings: string[]
}

export type ProjectIconShape = 'circle' | 'square' | 'triangle' | 'diamond' | 'hex'
export type ProjectIconSet = 'tabler'
export type LegacyProjectIconSet = 'shape' | 'lucide'
export type ProjectIconSymbol = string
export type ProjectIconVariant = 'filled' | 'outlined'
export type ProjectIconGlyph = ProjectIconShape | ProjectIconSymbol

export interface ProjectIconStyle {
  set?: ProjectIconSet
  glyph?: ProjectIconSymbol
  // Compatibility alias for legacy stored shape icons.
  shape?: ProjectIconShape
  variant: 'filled'
  color: string
}

export interface ProjectIconInput {
  set?: ProjectIconSet | LegacyProjectIconSet
  glyph?: ProjectIconGlyph
  shape?: ProjectIconShape
  variant?: ProjectIconVariant
  color?: string
}

export interface NoteListItem {
  relPath: string
  name: string
  dir: string
  createdAt: string
  updatedAt: string
  tags: string[]
  bodyPreview?: string
  mentionTargets?: string[]
}

export interface FleetingNote {
  type: 'fleeting'
  id: string
  relPath: string
  content: string
  createdAt: string
  updatedAt: string
}

export type FleetingConversionTarget = 'note' | 'task'

export interface FleetingConversionResult {
  sourceRelPath: string
  target: FleetingConversionTarget
  noteRelPath?: string
  task?: CalendarTask
}

interface NoteTreeEntryBase {
  id: string
  relPath: string
  name: string
  isProtected?: boolean
  protectionKind?: import('./projectFolders').ProjectTreeProtectionKind | null
  projectId?: string
}

export interface NoteTreeFolder extends NoteTreeEntryBase {
  kind: 'folder'
  isLinked: boolean
  children: NoteTreeNode[]
}

interface NoteTreeFileBase extends NoteTreeEntryBase {
  createdAt: string
  updatedAt: string
}

export interface NoteTreeFile extends NoteTreeFileBase {
  kind: 'note'
  note: NoteListItem
}

export interface NoteTreeExcalidrawFile extends NoteTreeFileBase {
  kind: 'excalidraw'
}

export type NoteTreeNode = NoteTreeFolder | NoteTreeFile | NoteTreeExcalidrawFile

export interface SearchResult {
  id: string
  relPath: string
  title: string
  tags: string[]
  updated: string
  snippet: string
}

export const NOTE_VIM_MAPPING_MODE_VALUES = ['insert', 'normal', 'visual', 'visualLine'] as const
export type NoteVimMappingMode = (typeof NOTE_VIM_MAPPING_MODE_VALUES)[number]

export const NOTE_VIM_MAPPING_ACTION_VALUES = [
  'enterNormalMode',
  'enterInsertMode',
  'appendAfterCursor',
  'appendLineEnd',
  'openLineBelow',
  'openLineAbove',
  'pasteAfterCursor',
  'pasteBeforeCursor',
  'deleteSelection',
  'yankSelection'
] as const
export type NoteVimMappingAction = (typeof NOTE_VIM_MAPPING_ACTION_VALUES)[number]

export interface NoteVimKeyMapping {
  id: string
  mode: NoteVimMappingMode
  sequence: string
  action: NoteVimMappingAction
}

export interface AppErrorEvent {
  source: 'ipc' | 'main' | 'renderer'
  message: string
  stack?: string
  channel?: string
}

export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskStatus = 'pending' | 'backlog' | 'in-progress' | 'blocked' | 'completed'

export const TASK_STATUS_VALUES: TaskStatus[] = [
  'pending',
  'backlog',
  'in-progress',
  'blocked',
  'completed'
]

export const TASK_STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'completed', label: 'Completed' }
]
export const CALENDAR_TASK_TYPE_VALUES = [
  'meeting',
  'assignment',
  'review',
  'personal',
  'deep-work',
  'errand',
  'follow-up',
  'other'
] as const

export type CalendarTaskType = (typeof CALENDAR_TASK_TYPE_VALUES)[number]

export type WeeklyHeightMode = 'duration' | 'content'

export const CALENDAR_TASK_TYPE_OPTIONS: Array<{ value: CalendarTaskType; label: string }> = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'review', label: 'Review' },
  { value: 'personal', label: 'Personal' },
  { value: 'deep-work', label: 'Deep Work' },
  { value: 'errand', label: 'Errand' },
  { value: 'follow-up', label: 'Follow-up' },
  { value: 'other', label: 'Other' }
]

export function formatCalendarTaskType(taskType: CalendarTaskType): string {
  return CALENDAR_TASK_TYPE_OPTIONS.find((option) => option.value === taskType)?.label ?? taskType
}

export interface TaskReminder {
  id: string
  type: 'minutes' | 'hours' | 'days'
  value: number
  enabled: boolean
}

export interface CalendarTask {
  id: string
  title: string
  description?: string
  projectId?: string
  milestoneId?: string
  tags: string[]
  date?: string // Optional - undefined means unscheduled
  endDate?: string // Optional - spans from `date` through `endDate`, or acts as a deadline when `date` is absent
  // Compatibility field for older vaults. New records use status as the source of truth.
  completed: boolean
  status?: TaskStatus
  createdAt: string
  priority: TaskPriority
  taskType?: CalendarTaskType
  reminders: TaskReminder[]
  time?: string // Optional time in HH:mm format
  endTime?: string // Optional end time in HH:mm format
  weeklyHeightMode?: WeeklyHeightMode
  // Automation deduplication fields (set by schedule runner)
  automationSource?: string
  automationSourceKey?: string
}

export interface CreateTaskInput {
  title: string
  projectId?: string
  milestoneId?: string
  tags?: string[]
  date?: string
  endDate?: string
  time?: string
  endTime?: string
  priority?: TaskPriority
  taskType?: CalendarTaskType
  reminders?: TaskReminder[]
}

// CalendarTask remains as a compatibility alias while the renderer and persisted data
// transition to the domain-neutral Task name.
export type Task = CalendarTask

export type ProjectState = 'active' | 'archived'

export interface ProjectMilestone {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  name: string
  // Description replaces summary in the redesigned project model.
  description?: string
  summary: string
  folderPath?: string
  state: ProjectState
  startDate?: string
  endDate?: string
  tags?: string[]
  resources?: string[]
  updatedAt: string
  // Tasks are resolved from Task.projectId at runtime; this optional field is only
  // used by project-focused renderer projections.
  tasks?: CalendarTask[]
  milestones?: ProjectMilestone[]
  icon: ProjectIconStyle
}

export interface CreateProjectInput {
  name?: string
  description?: string
  icon?: ProjectIconInput
  startDate?: string
  endDate?: string
  tags?: string[]
  resources?: string[]
}

export interface UpdateProjectInput {
  projectId: string
  name?: string
  description?: string
  icon?: ProjectIconInput
  startDate?: string | null
  endDate?: string | null
  tags?: string[]
  resources?: string[]
}

export interface ProjectPropertiesPatch {
  startDate?: string | null
  endDate?: string | null
  tags?: string[]
  resources?: string[]
}

export interface DeleteProjectInput {
  projectId: string
  linkedTasks: 'delete' | 'unassign'
}

export interface DeleteProjectResult {
  deletedProjectId: string
  nextSelectedProjectId: string | null
  removedTaskIds: string[]
  unassignedTaskIds: string[]
}

export interface CreateProjectMilestoneInput {
  projectId: string
  title: string
}

export interface UpdateProjectMilestoneInput {
  projectId: string
  milestoneId: string
  title: string
}

export interface DeleteProjectMilestoneInput {
  projectId: string
  milestoneId: string
}

export interface DeleteProjectMilestoneResult {
  deletedMilestoneId: string
  movedTaskIds: string[]
}

export type GridBoardItemKind = 'note' | 'project' | 'text'

export interface GridBoardViewport {
  x: number
  y: number
  zoom: number
}

export interface GridTextStyle {
  fontSize?: 'sm' | 'md' | 'lg'
  isBold?: boolean
  isItalic?: boolean
  isUnderline?: boolean
  textAlign?: 'left' | 'center' | 'right'
  color?: 'default' | 'accent' | 'muted'
}

export interface GridBoardItem {
  id: string
  kind: GridBoardItemKind
  noteRelPath?: string
  projectId?: string
  textContent?: string
  textStyle?: GridTextStyle
  position: {
    x: number
    y: number
  }
  size?: {
    width: number
    height: number
  }
  zIndex: number
}

export interface GridBoardState {
  viewport: GridBoardViewport
  items: GridBoardItem[]
}

export interface ExcalidrawSessionScene {
  type?: string
  version?: number
  source?: string
  elements: unknown[]
  appState?: Record<string, unknown> | null
  files?: Record<string, unknown>
}

export interface ExcalidrawSession {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  scene: ExcalidrawSessionScene
}

export interface StoredExcalidrawFileDocument {
  version: 1
  scene: ExcalidrawSessionScene
}

export interface ExcalidrawFileReadResult {
  document: StoredExcalidrawFileDocument
  recovered: boolean
}

export interface FileMapEntry {
  id: string
  hash: string
  lastIndexedAt: string
}

export type FileMap = Record<string, FileMapEntry>

export interface CondaEnvironment {
  name: string
  path: string
}

export interface CondaEnvironmentListResult {
  environments: CondaEnvironment[]
  executablePath: string | null
  error: string | null
}

export interface CondaExecutablePickerResult {
  path: string | null
  error: string | null
}

export interface AppSettings {
  isSidebarCollapsed: boolean // Tracks if the calendar sidebar is collapsed
  lastVaultPath: Maybe<string>
  lastOpenedNotePath: Maybe<string>
  recentNotebookPaths: string[]
  lastOpenedProjectId: Maybe<string>
  favoriteNotePaths: string[]
  favoriteProjectIds: string[]
  profile: {
    name: string
  }
  ai: {
    mistralApiKey: string
  }
  fontFamily: string
  pythonCondaEnvironmentPath: Maybe<string>
  pythonCondaExecutablePath: Maybe<string>
  editorVimModeEnabled: boolean
  editorVimKeyMappings: NoteVimKeyMapping[]
  calendarTasks: CalendarTask[]
  // Canonical task projection. calendarTasks is retained for compatibility with
  // existing renderer consumers during the migration.
  tasks?: CalendarTask[]
  projectIcons: Record<string, ProjectIconStyle>
  projects: Project[]
  gridBoard: GridBoardState
}

export interface AppSettingsUpdate {
  isSidebarCollapsed?: boolean // Optional
  profile?: {
    name?: string
  }
  ai?: {
    mistralApiKey: string
  }
  fontFamily?: string
  pythonCondaEnvironmentPath?: Maybe<string>
  pythonCondaExecutablePath?: Maybe<string>
  editorVimModeEnabled?: boolean
  editorVimKeyMappings?: NoteVimKeyMapping[]
  calendarTasks?: CalendarTask[]
  tasks?: CalendarTask[]
  projectIcons?: Record<string, ProjectIconStyle>
  projects?: Project[]
  gridBoard?: GridBoardState
  lastOpenedNotePath?: Maybe<string>
  recentNotebookPaths?: string[]
  lastOpenedProjectId?: Maybe<string>
  favoriteNotePaths?: string[]
  favoriteProjectIds?: string[]
}

export interface AppSettingsUpdateOptions {
  history?: boolean
}

export type RendererSettingsUpdate = Omit<
  AppSettingsUpdate,
  'projects' | 'projectIcons' | 'lastOpenedProjectId' | 'favoriteProjectIds'
>

export interface HistoryAffectedAreas {
  notes?: boolean
  settings?: boolean
  weeklyPlan?: boolean
}

export interface HistoryOperationResult {
  performed: boolean
  action: 'undo' | 'redo'
  label: string | null
  affected: HistoryAffectedAreas
}

export interface HistoryStatus {
  canUndo: boolean
  canRedo: boolean
  undoLabel: string | null
  redoLabel: string | null
}

export type WeeklyPlanPriorityStatus = 'planned' | 'in_progress' | 'done'

export interface WeeklyPlanWeek {
  id: string
  startDate: string
  endDate: string
  focus?: string
  createdAt: string
  updatedAt: string
}

export interface WeeklyPlanPriority {
  id: string
  weekId: string
  title: string
  status: WeeklyPlanPriorityStatus
  order: number
  linkedProjectId?: string
  linkedTaskId?: string
  createdAt: string
  updatedAt: string
}

export interface WeeklyPlanReview {
  id: string
  weekId: string
  wins?: string
  misses?: string
  blockers?: string
  nextWeek?: string
  createdAt: string
  updatedAt: string
}

export interface WeeklyPlanState {
  weeks: WeeklyPlanWeek[]
  priorities: WeeklyPlanPriority[]
  reviews: WeeklyPlanReview[]
}

export interface CreateWeeklyPlanWeekInput {
  startDate: string
  endDate?: string
  focus?: string
}

export interface UpdateWeeklyPlanWeekInput {
  id: string
  startDate?: string
  endDate?: string
  focus?: string | null
}

export interface DeleteWeeklyPlanWeekInput {
  id: string
}

export interface CreateWeeklyPlanPriorityInput {
  weekId: string
  title: string
  linkedProjectId?: string
  linkedTaskId?: string
}

export interface UpdateWeeklyPlanPriorityInput {
  id: string
  title?: string
  status?: WeeklyPlanPriorityStatus
  linkedProjectId?: string | null
  linkedTaskId?: string | null
}

export interface ReorderWeeklyPlanPrioritiesInput {
  weekId: string
  priorityIds: string[]
}

export interface UpsertWeeklyPlanReviewInput {
  weekId: string
  reviewId?: string
  wins?: string | null
  misses?: string | null
  blockers?: string | null
  nextWeek?: string | null
}

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'archived'
export type SubscriptionBillingCycle = 'monthly' | 'quarterly' | 'yearly' | 'custom'
export type SubscriptionReviewFlag = 'none' | 'review' | 'unused' | 'duplicate' | 'expensive'

export interface SubscriptionRecord {
  id: string
  name: string
  provider?: string
  category: string
  amount: number
  currency: string
  billingCycle: SubscriptionBillingCycle
  billingIntervalMonths: number
  normalizedMonthlyAmount: number
  nextRenewalAt?: string
  status: SubscriptionStatus
  reviewFlag?: SubscriptionReviewFlag
  lastUsedAt?: string
  tags?: string[]
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface CreateSubscriptionInput {
  name: string
  provider?: string
  category: string
  amount: number
  currency: string
  billingCycle: SubscriptionBillingCycle
  billingIntervalMonths?: number
  nextRenewalAt?: string
  status: SubscriptionStatus
  reviewFlag?: SubscriptionReviewFlag
  lastUsedAt?: string
  tags?: string[]
  notes?: string
}

export interface UpdateSubscriptionInput {
  id: string
  name?: string
  provider?: string | null
  category?: string
  amount?: number
  currency?: string
  billingCycle?: SubscriptionBillingCycle
  billingIntervalMonths?: number | null
  nextRenewalAt?: string | null
  status?: SubscriptionStatus
  reviewFlag?: SubscriptionReviewFlag
  lastUsedAt?: string | null
  tags?: string[]
  notes?: string | null
}

export interface SubscriptionAnalyticsFilters {
  search?: string
  categories?: string[]
  statuses?: SubscriptionStatus[]
  includeArchived?: boolean
}

export interface SubscriptionTreemapNode {
  id: string
  name: string
  value: number
  category: string
  status: SubscriptionStatus
  reviewFlag: SubscriptionReviewFlag
  renewalBucket?: 'soon' | 'later'
}

export interface SubscriptionAnalytics {
  totalMonthlyRecurring: number
  totalYearlyRecurring: number
  renewingSoonCount: number
  renewingSoonAmount: number
  reviewCount: number
  potentialSavingsMonthly: number
  treemapNodes: SubscriptionTreemapNode[]
}

export interface RendererSubscriptionsApi {
  list: () => Promise<SubscriptionRecord[]>
  get: (id: string) => Promise<Maybe<SubscriptionRecord>>
  create: (input: CreateSubscriptionInput) => Promise<SubscriptionRecord>
  update: (input: UpdateSubscriptionInput) => Promise<SubscriptionRecord>
  delete: (id: string) => Promise<void>
  archive: (id: string) => Promise<SubscriptionRecord>
  getAnalytics: (filters?: SubscriptionAnalyticsFilters) => Promise<SubscriptionAnalytics>
}

export interface RendererAgentToolsApi {
  note: {
    search: (input: { query: string }) => Promise<SearchResult[]>
    read: (input: { path: string }) => Promise<{ path: string; content: string }>
    create: (input: {
      name: string
      content?: string
      tags?: string[]
    }) => Promise<{ path: string; content: string }>
    update: (input: { path: string; content: string }) => Promise<{ path: string; content: string }>
    append: (input: {
      path: string
      content: string
      separator?: string
    }) => Promise<{ path: string; content: string }>
  }
  project: {
    create: (input: {
      name?: string
      description?: string
      icon?: ProjectIconStyle
    }) => Promise<Project>
    update: (input: {
      projectId?: string
      projectName?: string
      name?: string
      description?: string
      icon?: ProjectIconStyle
    }) => Promise<Project>
  }
  calendarTask: {
    create: (input: {
      title: string
      date?: string
      endDate?: string
      time?: string
      endTime?: string
      priority?: TaskPriority
      taskType?: CalendarTaskType
      reminders?: TaskReminder[]
      status?: TaskStatus
      completed?: boolean
    }) => Promise<CalendarTask>
    update: (input: {
      taskId?: string
      titleMatch?: string
      title?: string
      date?: string | null
      endDate?: string | null
      time?: string | null
      endTime?: string | null
      priority?: TaskPriority
      taskType?: CalendarTaskType | null
      reminders?: TaskReminder[]
      status?: TaskStatus
      completed?: boolean
    }) => Promise<CalendarTask>
  }
  task: {
    create: (input: {
      title: string
      description?: string
      projectId?: string
      projectName?: string
      date?: string
      endDate?: string
      time?: string
      endTime?: string
      priority?: TaskPriority
      taskType?: CalendarTaskType
      reminders?: TaskReminder[]
      status?: TaskStatus
      completed?: boolean
    }) => Promise<CalendarTask>
    update: (input: {
      taskId?: string
      titleMatch?: string
      title?: string
      description?: string
      projectId?: string | null
      date?: string | null
      endDate?: string | null
      time?: string | null
      endTime?: string | null
      priority?: TaskPriority
      taskType?: CalendarTaskType | null
      reminders?: TaskReminder[]
      status?: TaskStatus
      completed?: boolean
    }) => Promise<CalendarTask>
  }
  weeklyPlan: {
    createWeek: (input: CreateWeeklyPlanWeekInput) => Promise<WeeklyPlanWeek>
    createPriority: (input: {
      weekId?: string
      weekStartDate?: string
      title: string
      linkedProjectId?: string
      linkedTaskId?: string
    }) => Promise<WeeklyPlanPriority>
    upsertReview: (input: {
      weekId?: string
      weekStartDate?: string
      reviewId?: string
      wins?: string | null
      misses?: string | null
      blockers?: string | null
      nextWeek?: string | null
    }) => Promise<WeeklyPlanReview>
  }
}

export interface VaultOpenResult {
  info: VaultInfo
  notes: NoteListItem[]
  tree: NoteTreeNode[]
}

export interface SavedVaultSummary {
  rootPath: string
  name: string
  addedAt: string
  lastOpenedAt: Maybe<string>
  isFavorite: boolean
  isAvailable: boolean
}

export interface SavedVaultState {
  currentVaultPath: Maybe<string>
  vaults: SavedVaultSummary[]
}

export interface VaultRemoveResult {
  removedPath: string
  state: SavedVaultState
  activation: Maybe<VaultOpenResult>
}

export interface CompleteNoteWithAiInput {
  notePath: string
  noteContent: string
  prompt: string
}

export type AgentChatMentionKind = 'note' | 'project'

export interface AgentChatMentionRef {
  id: string
  kind: AgentChatMentionKind
  label: string
  notePath?: string
  projectId?: string
}

export interface AgentChatContextSummary {
  id: string
  kind: AgentChatMentionKind
  label: string
  detail: string
}

export interface AgentChatMessageInput {
  requestId?: string
  message: string
  mentions: AgentChatMentionRef[]
}

export interface AgentChatMessageResult {
  id: string
  role: 'assistant'
  content: string
  createdAt: string
  model: string
  contexts: AgentChatContextSummary[]
  toolSteps: AgentChatToolStep[]
}

export interface AgentChatToolApprovalRequest {
  requestId?: string
  stepId?: string
  toolName: string
  input: unknown
  sessionMessages?: AgentChatMessageRecord[]
}

export interface AgentChatApprovedToolResult {
  toolStep: AgentChatToolStep
  assistantMessage: AgentChatMessageRecord
}

export interface AgentChatMessageRecord {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  mentions?: AgentChatMentionRef[]
  contexts?: AgentChatContextSummary[]
  toolSteps?: AgentChatToolStep[]
  model?: string
}

export interface AgentChatSession {
  id: string
  title: string
  titleMode?: 'auto' | 'manual'
  createdAt: string
  updatedAt: string
  messages: AgentChatMessageRecord[]
}

export interface AgentChatToolStep {
  id: string
  toolName: string
  status: 'completed' | 'error' | 'approval-required' | 'rejected'
  inputSummary: string
  outputSummary: string
  approvalRequest?: AgentChatToolApprovalRequest
}

export type AgentChatEvent =
  | {
      requestId: string
      type: 'status'
      status: 'started' | 'thinking' | 'finished'
      message?: string
    }
  | {
      requestId: string
      type: 'text-delta'
      delta: string
    }
  | {
      requestId: string
      type: 'tool-step'
      toolStep: AgentChatToolStep
    }

export type AgentRunStatus = 'running' | 'success' | 'error'

export interface AgentRunContext {
  notePath?: string
  trigger?: string
}

export interface AgentRunRecord {
  id: string
  agentName: string
  source: string
  startedAt: string
  endedAt?: string
  status: AgentRunStatus
  input: string
  output: string
  errorMessage?: string
  model?: string
  context?: AgentRunContext
}

export interface NativeMenuPosition {
  x: number
  y: number
}

export interface NativeMenuItemDescriptor {
  id?: string
  type?: 'normal' | 'separator' | 'submenu' | 'checkbox'
  label?: string
  enabled?: boolean
  checked?: boolean
  accelerator?: string
  submenu?: NativeMenuItemDescriptor[]
}

export interface ImportedNoteResult {
  sourceName: string
  relPath: string
  renamed: boolean
}

export interface FailedNoteImportResult {
  sourceName: string
  error: string
}

export interface NoteImportResult {
  imported: ImportedNoteResult[]
  failed: FailedNoteImportResult[]
}

export interface BlockNoteMigrationResult {
  converted: number
  skipped: number
  failed: Array<{
    relPath: string
    error: string
  }>
}

export interface NoteBodyFrontmatterMigrationResult {
  converted: number
  skipped: number
  failed: Array<{
    relPath: string
    error: string
  }>
}

export interface NoteImagePathMigrationResult {
  converted: number
  skipped: number
  imagesConverted: number
  attachmentsCopied: number
  failed: Array<{
    relPath: string
    error: string
  }>
}

export interface LegacyExcalidrawImportResult {
  imported: Array<{
    sourceId: string
    relPath: string
  }>
  skipped: Array<{
    sourceId: string
    reason: string
  }>
  failed: Array<{
    sourceId: string
    error: string
  }>
}

export interface RendererVaultApi {
  ui: {
    platform: string
    showNativeMenu: (
      items: NativeMenuItemDescriptor[],
      position: NativeMenuPosition
    ) => Promise<string | null>
    reloadApp: () => Promise<void>
  }
  app: {
    onError: (listener: (event: AppErrorEvent) => void) => () => void
  }
  vault: {
    open: () => Promise<Maybe<VaultOpenResult>>
    create: () => Promise<Maybe<VaultOpenResult>>
    restoreLast: () => Promise<Maybe<VaultOpenResult>>
    runMigration: () => Promise<VaultOpenResult>
    listSaved: () => Promise<SavedVaultState>
    switchSaved: (rootPath: string) => Promise<VaultOpenResult>
    toggleFavoriteSaved: (rootPath: string) => Promise<SavedVaultState>
    removeSaved: (rootPath: string) => Promise<VaultRemoveResult>
  }
  desktop: {
    chooseDirectory: (title: string) => Promise<Maybe<string>>
    openPath: (targetPath: string) => Promise<void>
    openWarpAtNotePath: (relPath: string) => Promise<void>
  }
  files: {
    listNotes: () => Promise<NoteListItem[]>
    listTree: () => Promise<NoteTreeNode[]>
    onTreeChanged: (listener: () => void) => () => void
    readNote: (relPath: string) => Promise<string>
    readNoteDocument: (relPath: string) => Promise<StoredNoteDocument>
    readExcalidrawFileDocument: (relPath: string) => Promise<ExcalidrawFileReadResult>
    writeNote: (relPath: string, content: string) => Promise<void>
    writeNoteDocument: (relPath: string, document: StoredNoteDocument) => Promise<void>
    writeExcalidrawFileDocument: (
      relPath: string,
      document: StoredExcalidrawFileDocument
    ) => Promise<void>
    createNote: (name: string) => Promise<string>
    createNoteAtPath: (relPath: string) => Promise<string>
    createExcalidrawFileAtPath: (relPath: string) => Promise<string>
    createNoteWithTags: (name: string, tags: string[]) => Promise<string>
    createFolder: (relPath: string) => Promise<string>
    importNotes: () => Promise<NoteImportResult>
    migrateBlockNoteNotes: () => Promise<BlockNoteMigrationResult>
    migrateTaggedNoteBodyFrontmatter: () => Promise<NoteBodyFrontmatterMigrationResult>
    migrateNoteImagePaths: () => Promise<NoteImagePathMigrationResult>
    rename: (fromRelPath: string, toRelPath: string) => Promise<void>
    renamePath: (fromRelPath: string, toRelPath: string) => Promise<void>
    delete: (relPath: string) => Promise<void>
    deletePath: (relPath: string) => Promise<void>
    deletePaths: (relPaths: string[]) => Promise<void>
    exportNote: (relPath: string, content: string) => Promise<Maybe<string>>
    exportNotePdf: (input: NotePdfExportInput) => Promise<NotePdfExportResult>
    exportFolderPdf: (input: FolderPdfExportInput) => Promise<FolderPdfExportResult>
    exportFolderMarkdown: (input: FolderMarkdownExportInput) => Promise<FolderMarkdownExportResult>
    exportProject: (projectName: string, content: string) => Promise<Maybe<string>>
  }
  fleeting: {
    list: () => Promise<FleetingNote[]>
    create: (content: string) => Promise<FleetingNote>
    remove: (relPath: string) => Promise<void>
    convert: (input: {
      relPath: string
      target: FleetingConversionTarget
    }) => Promise<FleetingConversionResult>
  }
  search: {
    query: (query: string) => Promise<SearchResult[]>
  }
  attachments: {
    import: (sourcePath: string) => Promise<string>
    importFromBuffer: (buffer: Uint8Array, fileExtension: string) => Promise<string>
  }
  ai: {
    completeNote: (input: CompleteNoteWithAiInput) => Promise<string>
  }
  agentChat: {
    sendMessage: (input: AgentChatMessageInput) => Promise<AgentChatMessageResult>
    listSessions: () => Promise<AgentChatSession[]>
    saveSession: (session: AgentChatSession) => Promise<AgentChatSession>
    deleteSession: (sessionId: string) => Promise<void>
    approveTool: (
      input: AgentChatToolApprovalRequest & { stepId: string }
    ) => Promise<AgentChatApprovedToolResult>
    onEvent: (listener: (event: AgentChatEvent) => void) => () => void
  }
  agentHistory: {
    listRuns: () => Promise<AgentRunRecord[]>
  }
  excalidraw: {
    listSessions: () => Promise<ExcalidrawSession[]>
    saveSession: (session: ExcalidrawSession) => Promise<ExcalidrawSession>
    deleteSession: (sessionId: string) => Promise<void>
    importLegacySessions: () => Promise<LegacyExcalidrawImportResult>
  }
  settings: {
    get: () => Promise<AppSettings>
    update: (
      next: RendererSettingsUpdate,
      options?: AppSettingsUpdateOptions
    ) => Promise<AppSettings>
  }
  python: {
    listCondaEnvironments: () => Promise<CondaEnvironmentListResult>
    chooseCondaExecutable: () => Promise<CondaExecutablePickerResult>
  }
  projects: {
    create: (input: CreateProjectInput) => Promise<Project>
    select: (input: { projectId: string | null }) => Promise<{ projectId: string | null }>
    update: (input: UpdateProjectInput) => Promise<Project>
    setState: (input: { projectId: string; state: ProjectState }) => Promise<Project>
    setFavorite: (input: { projectId: string; favorite: boolean }) => Promise<{
      projectId: string
      favorite: boolean
    }>
    delete: (input: DeleteProjectInput) => Promise<DeleteProjectResult>
    createMilestone: (input: CreateProjectMilestoneInput) => Promise<ProjectMilestone>
    updateMilestone: (input: UpdateProjectMilestoneInput) => Promise<ProjectMilestone>
    deleteMilestone: (input: DeleteProjectMilestoneInput) => Promise<DeleteProjectMilestoneResult>
  }
  tasks: {
    create: (input: CreateTaskInput) => Promise<CalendarTask>
  }
  history: {
    undo: () => Promise<HistoryOperationResult>
    redo: () => Promise<HistoryOperationResult>
    status: () => Promise<HistoryStatus>
  }
  schedules: import('./scheduleTypes').RendererScheduleApi
  subscriptions: RendererSubscriptionsApi
  agentTools: RendererAgentToolsApi
}
