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

export interface WorkspaceFeatureFlags {
  resources: boolean
  filesystemResources: boolean
  filesystemContentIndexing: boolean
  googleDriveResources: boolean
  googleDriveContentIndexing: boolean
  captureReview: boolean
  externalWrites: boolean
  agentContextBundles: boolean
}

export interface VaultMigrationReport {
  generatedAt: string
  schemaVersion: number
  migrations: {
    version: number
    copiedFromLegacyNotesAt?: string
    copiedFromLegacySystemAt?: string
  }
  canonicalPaths: string[]
  legacyPathsFound: string[]
  conflicts: string[]
  counts: Record<string, number>
  rollbackGuidance: string
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

export interface ProjectContextMarkdownExportInput {
  projectId: string
}

export interface ProjectContextMarkdownExportResult {
  path: Maybe<string>
  noteCount: number
  taskCount: number
  updateCount: number
  externalDocumentCount: number
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
  variant: ProjectIconVariant
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
  source?: 'manual' | 'shortcut' | 'clipboard' | 'import'
  priority?: TaskPriority
  tags?: string[]
  dueDate?: string
  projectId?: string
  triageState?: 'inbox' | 'in-progress' | 'converted' | 'archived'
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

export type ResourceProvider = 'xingularity' | 'google-drive' | 'filesystem' | 'web'

export type ResourceType = 'notebook' | 'external'

export type ExternalProduct =
  | 'google-docs'
  | 'google-sheets'
  | 'google-slides'
  | 'google-drive'
  | 'canva'
  | 'generic'

export type ResourceKind =
  | 'note'
  | 'notebook'
  | 'project'
  | 'task'
  | 'local-file'
  | 'local-folder'
  | 'google-doc'
  | 'google-sheet'
  | 'google-slide'
  | 'drive-file'
  | 'url'

export type ResourceAccess = 'read-only' | 'read-write' | 'unknown'

export type ResourceState =
  | 'available'
  | 'stale'
  | 'moved'
  | 'offline'
  | 'permission-denied'
  | 'reauthorization-required'
  | 'missing'
  | 'conflict'
  | 'unindexed'

export type ResourceFreshness = 'live' | 'periodic' | 'manual' | 'unknown'

export type ResourceSourceOfTruth = 'xingularity' | 'external'

export interface ResourceLabel {
  key: string
  value: string
}

export interface ResourceRef {
  id: string
  type: ResourceType
  provider: ResourceProvider
  kind: ResourceKind
  title: string
  canonicalUri: string
  externalProduct?: ExternalProduct
  externalId?: string
  mimeType?: string
  sourceOfTruth: ResourceSourceOfTruth
  access: ResourceAccess
  state: ResourceState
  projectIds?: string[]
  createdAt: string
  updatedAt: string
  lastSeenAt?: string
  lastIndexedAt?: string
  sourceModifiedAt?: string
  freshness?: ResourceFreshness
  labels?: ResourceLabel[]
  metadata?: Record<string, string | number | boolean | null>
}

export interface ResourceLocator {
  resourceId: string
  deviceId: string
  provider: 'filesystem' | 'google-drive'
  path?: string
  bookmarkOrHandle?: string
  fileId?: string
  observedName?: string
  observedParent?: string
  updatedAt: string
}

export type ResourceRelationType =
  | 'project_contains_resource'
  | 'task_derived_from_resource'
  | 'note_references_resource'
  | 'decision_supported_by_resource'
  | 'milestone_delivered_by_resource'
  | 'resource_related_to_resource'
  | 'resource_snapshot_of_external'
  | 'resource_supersedes_resource'
  | 'capture_came_from_resource'

export type ResourceRelationConfidence = 'suggested' | 'confirmed'

export interface ResourceRelation {
  id: string
  type: ResourceRelationType
  fromId: string
  fromKind: SearchEntityType | 'resource'
  toId: string
  toKind: SearchEntityType | 'resource'
  createdAt: string
  createdBy: 'user' | 'system' | 'agent'
  confidence: ResourceRelationConfidence
  sourceLocation?: string
  note?: string
}

export interface ResourcePreview {
  resourceId: string
  kind: ResourceKind
  mimeType?: string
  sizeBytes?: number
  modifiedAt?: string
  text?: string
  truncated: boolean
  error?: string
}

export interface ResourceInput {
  type?: ResourceType
  provider?: ResourceProvider
  kind?: ResourceKind
  title?: string
  canonicalUri: string
  externalProduct?: ExternalProduct
  externalId?: string
  mimeType?: string
  sourceOfTruth?: ResourceSourceOfTruth
  access?: ResourceAccess
  labels?: ResourceLabel[]
  metadata?: Record<string, string | number | boolean | null>
  projectId?: string
  projectIds?: string[]
}

export interface ResourceUpdateInput {
  resourceId: string
  canonicalUri?: string
  title?: string
  labels?: ResourceLabel[]
}

export interface ResourceProjectLinksInput {
  resourceId: string
  projectIds: string[]
}

export interface ResourceHealth {
  resourceId: string
  state: ResourceState
  checkedAt: string
  message?: string
  locator?: ResourceLocator
}

export interface ResourceContextBundle {
  projectId?: string
  generatedAt: string
  resources: ResourceRef[]
  relations: ResourceRelation[]
  citations: Array<{
    resourceId: string
    uri: string
    title: string
    excerpt?: string
    observedAt?: string
  }>
  allowedActions: Array<'open' | 'reveal' | 'refresh' | 'create-task' | 'create-note'>
}

export type ResourceWriteOperation = 'create' | 'replace' | 'append'

export interface ResourceWriteInput {
  resourceId?: string
  targetPath: string
  operation: ResourceWriteOperation
  content: string
  authorizedRoot: string
  expectedHash?: string
  label?: string
}

export interface ResourceWritePreview {
  targetPath: string
  operation: ResourceWriteOperation
  contentLength: number
  existing: boolean
  existingHash?: string
  nextHash: string
  requiresConfirmation: boolean
  warning?: string
}

export interface ResourceWriteAuditRecord {
  id: string
  createdAt: string
  targetPath: string
  operation: ResourceWriteOperation
  expectedHash?: string
  previousHash?: string
  nextHash: string
  result: 'applied' | 'rejected'
  reason?: string
}

export interface GoogleDriveAuthorizationStart {
  connectionId: string
  request: {
    url: string
    state: string
    scopes: string[]
  }
}

export interface GoogleDriveFileCandidate {
  id: string
  name: string
  mimeType?: string
  modifiedTime?: string
  webViewLink?: string
}

export type SearchEntityType =
  | 'note'
  | 'task'
  | 'project'
  | 'resource'
  | 'calendar-event'
  | 'subscription'
  | 'schedule'
  | 'agent-run'
  | 'drawing'
  | 'capture'

export interface SearchResult {
  id: string
  relPath: string
  title: string
  tags: string[]
  updated: string
  snippet: string
  entityType: SearchEntityType
  target: {
    kind: SearchEntityType
    id: string
    relPath?: string
  }
  status?: string
  date?: string
  projectId?: string
  resourceId?: string
  provider?: string
  freshness?: string
  access?: string
  state?: string
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
export type TaskStatus =
  | 'pending'
  | 'backlog'
  | 'in-progress'
  | 'blocked'
  | 'canceled'
  | 'completed'

export const TASK_STATUS_VALUES: TaskStatus[] = [
  'pending',
  'backlog',
  'in-progress',
  'blocked',
  'canceled',
  'completed'
]

export const TASK_STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'canceled', label: 'Canceled' },
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

export interface ReminderClickTarget {
  page: 'calendar'
  taskId: string
  selectedDate: string
  view: 'month'
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
  updatedAt?: string
  dependencyIds?: string[]
  parentTaskId?: string
  estimateMinutes?: number
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
  description?: string
  dependencyIds?: string[]
  parentTaskId?: string
  estimateMinutes?: number
}

// CalendarTask remains as a compatibility alias while the renderer and persisted data
// transition to the domain-neutral Task name.
export type Task = CalendarTask

export type CalendarSource = 'local' | 'google'
export type CalendarEventAccess = 'read-write' | 'read-only'

export interface CalendarRecurrence {
  rrule: string
  timezone?: string
  until?: string
  exceptions?: string[]
}

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  allDay: boolean
  start: string
  end: string
  timezone?: string
  recurrence?: CalendarRecurrence
  location?: string
  attendees: Array<{ email: string; name?: string; responseStatus?: string }>
  organizer?: { email: string; name?: string }
  source: CalendarSource
  calendarId?: string
  externalId?: string
  etag?: string
  access: CalendarEventAccess
  status?: 'confirmed' | 'tentative' | 'cancelled'
  updatedAt: string
}

export interface CalendarLink {
  id: string
  taskId: string
  eventId: string
  ownership: 'task' | 'event' | 'manual'
  syncState: 'linked' | 'pending' | 'conflict' | 'unlinked'
  updatedAt: string
}

export interface ExternalCalendar {
  id: string
  connectionId: string
  provider: 'google'
  name: string
  color?: string
  selected: boolean
  access: CalendarEventAccess
  timezone?: string
}

export interface CalendarConnection {
  id: string
  provider: 'google'
  accountLabel: string
  email?: string
  status: 'connected' | 'reauthorization-required' | 'disconnected' | 'error'
  selectedCalendarIds: string[]
  syncCursor?: string
  lastSyncAt?: string
  lastError?: string
  createdAt: string
  updatedAt: string
}

export interface CalendarState {
  events: CalendarEvent[]
  links: CalendarLink[]
  connections: CalendarConnection[]
  calendars: ExternalCalendar[]
}

export interface CalendarEventInput {
  title: string
  description?: string
  allDay: boolean
  start: string
  end: string
  timezone?: string
  recurrence?: CalendarRecurrence
  location?: string
  attendees?: Array<{ email: string; name?: string; responseStatus?: string }>
  projectId?: string
}

export interface CalendarSyncResult {
  connectionId: string
  imported: number
  updated: number
  deleted: number
  skipped: number
  nextCursor?: string
  warnings: string[]
}

export type ProjectState = 'active' | 'archived'

export interface ProjectMilestone {
  id: string
  title: string
  endDate?: string
  createdAt: string
  updatedAt: string
}

export interface ProjectTaskDependency {
  taskId: string
  dependsOnTaskId: string
  createdAt: string
}

export interface ProjectSavedView {
  id: string
  name: string
  filters: {
    statuses?: TaskStatus[]
    priorities?: TaskPriority[]
    tags?: string[]
    milestoneId?: string
    blockedOnly?: boolean
  }
  createdAt: string
  updatedAt: string
}

export type ProjectUpdateStatus = 'on-track' | 'at-risk' | 'off-track'

export interface ProjectUpdate {
  id: string
  projectId: string
  markdown: string
  status: ProjectUpdateStatus
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
  /** Typed resources attached to this project. */
  resourceRefs?: ResourceRef[]
  updatedAt: string
  // Tasks are resolved from Task.projectId at runtime; this optional field is only
  // used by project-focused renderer projections.
  tasks?: CalendarTask[]
  milestones?: ProjectMilestone[]
  savedViews?: ProjectSavedView[]
  taskDependencies?: ProjectTaskDependency[]
  timeBudgetMinutes?: number
  updates?: ProjectUpdate[]
  icon: ProjectIconStyle
}

export interface CreateProjectInput {
  name?: string
  description?: string
  icon?: ProjectIconInput
  startDate?: string
  endDate?: string
  tags?: string[]
  resourceRefs?: ResourceRef[]
  timeBudgetMinutes?: number
}

export interface UpdateProjectInput {
  projectId: string
  name?: string
  description?: string
  icon?: ProjectIconInput
  startDate?: string | null
  endDate?: string | null
  tags?: string[]
  resourceRefs?: ResourceRef[]
  timeBudgetMinutes?: number | null
}

export interface ProjectPropertiesPatch {
  startDate?: string | null
  endDate?: string | null
  tags?: string[]
  resourceRefs?: ResourceRef[]
  timeBudgetMinutes?: number | null
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
  endDate?: string
}

export interface UpdateProjectMilestoneInput {
  projectId: string
  milestoneId: string
  title: string
  endDate?: string | null
}

export interface ReorderProjectMilestonesInput {
  projectId: string
  milestoneIds: string[]
}

export interface DeleteProjectMilestoneInput {
  projectId: string
  milestoneId: string
}

export interface DeleteProjectMilestoneResult {
  deletedMilestoneId: string
  movedTaskIds: string[]
}

export interface CreateProjectUpdateInput {
  projectId: string
  markdown: string
  status: ProjectUpdateStatus
}

export interface UpdateProjectUpdateInput {
  projectId: string
  updateId: string
  markdown: string
  status: ProjectUpdateStatus
}

export interface DeleteProjectUpdateInput {
  projectId: string
  updateId: string
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
  metadata?: ExcalidrawMetadata
}

export interface ExcalidrawMetadata {
  title?: string
  description?: string
  tags?: string[]
  projectId?: string
  backlinks?: string[]
  assetIds?: string[]
  updatedAt?: string
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
    /** @deprecated Legacy vault field. New versions never persist credential material here. */
    mistralApiKey?: string
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
  featureFlags?: Partial<WorkspaceFeatureFlags>
}

export interface AppSettingsUpdate {
  isSidebarCollapsed?: boolean // Optional
  profile?: {
    name?: string
  }
  ai?: {
    /** @deprecated Accepted only to migrate old vaults; it is never written back. */
    mistralApiKey?: string
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
  featureFlags?: Partial<WorkspaceFeatureFlags>
}

export interface AppSettingsUpdateOptions {
  history?: boolean
}

export type RendererSettingsUpdate = Omit<
  AppSettingsUpdate,
  'projects' | 'projectIcons' | 'lastOpenedProjectId' | 'favoriteProjectIds'
>

export interface CredentialStatus {
  provider: string
  configured: boolean
  scope: 'device' | 'vault'
  updatedAt?: string
}

export interface VaultDiagnosticIssue {
  severity: 'error' | 'warning' | 'info'
  code: string
  path?: string
  message: string
  recoverable: boolean
}

export interface VaultDiagnosticsReport {
  generatedAt: string
  schemaVersion: number
  vaultRoot: string
  recordCounts: Record<string, number>
  checksums: Record<string, string>
  legacyPaths: string[]
  orphanedPaths: string[]
  issues: VaultDiagnosticIssue[]
}

export interface VaultBackupResult {
  path: string
  createdAt: string
  fileCount: number
  checksum: string
}

export interface VaultTransferManifest {
  version: 1
  createdAt: string
  schemaVersion: number
  files: Array<{ path: string; size: number; checksum: string }>
  excludes: string[]
}

export interface VaultSyncStatus {
  mode: 'local-only' | 'ready' | 'syncing' | 'offline' | 'conflict'
  deviceId: string
  lastSyncAt?: string
  conflicts: Array<{
    path: string
    localChecksum: string
    remoteChecksum: string
  }>
}

export interface PluginCapabilityManifest {
  id: string
  version: string
  name: string
  provider: 'calendar' | 'task-import' | 'note-export' | 'automation'
  capabilities: string[]
  permissions: Array<'network' | 'read-vault' | 'write-vault' | 'secrets'>
  entrypoint?: string
}

export interface AssistiveSuggestion {
  id: string
  kind: 'capture-task' | 'capture-note' | 'duplicate-subscription' | 'calendar-conflict' | 'summary'
  title: string
  explanation: string
  sourceIds: string[]
  confidence: number
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
}

export interface HistoryAffectedAreas {
  notes?: boolean
  settings?: boolean
  weeklyPlan?: boolean
}

export type MutationKind =
  | 'create'
  | 'update'
  | 'delete'
  | 'archive'
  | 'restore'
  | 'import'
  | 'migrate'

export interface MutationEnvelope {
  id: string
  kind: MutationKind
  domain: 'notes' | 'tasks' | 'projects' | 'calendar' | 'settings' | 'weekly-plan' | 'vault'
  entityId?: string
  label: string
  createdAt: string
  reversible: boolean
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

export interface RendererWeeklyPlanApi {
  getState: () => Promise<WeeklyPlanState>
  createWeek: (input: CreateWeeklyPlanWeekInput) => Promise<WeeklyPlanState>
  updateWeek: (input: UpdateWeeklyPlanWeekInput) => Promise<WeeklyPlanState>
  deleteWeek: (input: DeleteWeeklyPlanWeekInput) => Promise<WeeklyPlanState>
  addPriority: (input: CreateWeeklyPlanPriorityInput) => Promise<WeeklyPlanState>
  updatePriority: (input: UpdateWeeklyPlanPriorityInput) => Promise<WeeklyPlanState>
  deletePriority: (priorityId: string) => Promise<WeeklyPlanState>
  reorderPriorities: (input: ReorderWeeklyPlanPrioritiesInput) => Promise<WeeklyPlanState>
  upsertReview: (input: UpsertWeeklyPlanReviewInput) => Promise<WeeklyPlanState>
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
  renewalReminderDays?: number[]
  calendarEventId?: string
  cancellationUrl?: string
  cancellationContact?: string
  currencyRate?: number
  currencyRateSource?: string
  currencyRateAsOf?: string
  usageReviewState?: 'not-reviewed' | 'keep' | 'cancel' | 'snooze'
  paymentHistory?: Array<{
    id: string
    paidAt: string
    amount: number
    currency: string
    note?: string
  }>
  attachments?: string[]
}

export interface SubscriptionListResult {
  records: SubscriptionRecord[]
  migrationWarnings: string[]
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
  renewalReminderDays?: number[]
  cancellationUrl?: string
  cancellationContact?: string
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
  renewalReminderDays?: number[]
  calendarEventId?: string | null
  cancellationUrl?: string | null
  cancellationContact?: string | null
  usageReviewState?: SubscriptionRecord['usageReviewState']
}

export interface AddSubscriptionPaymentInput {
  subscriptionId: string
  paidAt: string
  amount: number
  currency?: string
  note?: string
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
  list: () => Promise<SubscriptionListResult>
  get: (id: string) => Promise<Maybe<SubscriptionRecord>>
  create: (input: CreateSubscriptionInput) => Promise<SubscriptionRecord>
  update: (input: UpdateSubscriptionInput) => Promise<SubscriptionRecord>
  delete: (id: string) => Promise<void>
  archive: (id: string) => Promise<SubscriptionRecord>
  addPayment: (input: AddSubscriptionPaymentInput) => Promise<SubscriptionRecord>
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

export type AgentRunStatus = 'running' | 'success' | 'error' | 'cancelled'

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
    getMigrationReport: () => Promise<VaultMigrationReport>
    listSaved: () => Promise<SavedVaultState>
    switchSaved: (rootPath: string) => Promise<VaultOpenResult>
    toggleFavoriteSaved: (rootPath: string) => Promise<SavedVaultState>
    removeSaved: (rootPath: string) => Promise<VaultRemoveResult>
  }
  desktop: {
    chooseDirectory: (title: string) => Promise<Maybe<string>>
    choosePath: (title: string) => Promise<Maybe<string>>
    openExternal: (url: string) => Promise<void>
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
    exportProjectContext: (
      input: ProjectContextMarkdownExportInput
    ) => Promise<ProjectContextMarkdownExportResult>
  }
  reminders: {
    onClick: (listener: (target: ReminderClickTarget) => void) => () => void
  }
  fleeting: {
    list: () => Promise<FleetingNote[]>
    create: (content: string) => Promise<FleetingNote>
    update: (input: {
      relPath: string
      content?: string
      priority?: TaskPriority
      tags?: string[]
      dueDate?: string
      projectId?: string
      triageState?: FleetingNote['triageState']
    }) => Promise<FleetingNote>
    remove: (relPath: string) => Promise<void>
    convert: (input: {
      relPath: string
      target: FleetingConversionTarget
    }) => Promise<FleetingConversionResult>
  }
  search: {
    query: (query: string) => Promise<SearchResult[]>
  }
  resources: {
    list: () => Promise<{
      resources: ResourceRef[]
      relations: ResourceRelation[]
      locators: ResourceLocator[]
    }>
    add: (input: ResourceInput) => Promise<ResourceRef>
    update: (input: ResourceUpdateInput) => Promise<ResourceRef>
    setProjectLinks: (input: ResourceProjectLinksInput) => Promise<ResourceRef>
    setProjectNotebook: (input: { projectId: string; notebookPath: string }) => Promise<ResourceRef>
    detachFromProject: (input: { projectId: string; resourceId: string }) => Promise<void>
    remove: (resourceId: string) => Promise<void>
    refresh: (resourceId: string) => Promise<ResourceHealth>
    locate: (resourceId: string, nextPath: string) => Promise<ResourceRef>
    preview: (resourceId: string, allowContent?: boolean) => Promise<ResourcePreview>
    relate: (input: {
      type: ResourceRelationType
      fromId: string
      fromKind: ResourceRelation['fromKind']
      toId: string
      toKind: ResourceRelation['toKind']
      confidence?: ResourceRelation['confidence']
    }) => Promise<ResourceRelation>
    projectContext: (projectId: string) => Promise<ResourceContextBundle>
    open: (resourceId: string) => Promise<void>
    reveal: (resourceId: string) => Promise<void>
    previewWrite: (input: ResourceWriteInput) => Promise<ResourceWritePreview>
    applyWrite: (input: ResourceWriteInput, confirmation: boolean) => Promise<ResourceWritePreview>
    writeAudit: () => Promise<ResourceWriteAuditRecord[]>
    drive: {
      startAuthorization: () => Promise<GoogleDriveAuthorizationStart>
      completeAuthorization: (input: {
        connectionId: string
        code: string
        state: string
      }) => Promise<void>
      listFiles: () => Promise<GoogleDriveFileCandidate[]>
      attach: (input: { fileIds: string[]; projectId?: string }) => Promise<ResourceRef[]>
      refresh: (pageToken: string) => Promise<{
        resources: ResourceRef[]
        nextPageToken?: string
        newStartPageToken?: string
      }>
      disconnect: () => Promise<void>
    }
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
    cancel: (requestId: string) => Promise<boolean>
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
  credentials: {
    status: (provider: string) => Promise<CredentialStatus>
    set: (provider: string, value: string) => Promise<CredentialStatus>
    delete: (provider: string) => Promise<void>
  }
  calendar: RendererCalendarApi
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
    reorderMilestones: (input: ReorderProjectMilestonesInput) => Promise<Project>
    deleteMilestone: (input: DeleteProjectMilestoneInput) => Promise<DeleteProjectMilestoneResult>
    createUpdate: (input: CreateProjectUpdateInput) => Promise<Project>
    updateUpdate: (input: UpdateProjectUpdateInput) => Promise<Project>
    deleteUpdate: (input: DeleteProjectUpdateInput) => Promise<Project>
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
  weeklyPlan: RendererWeeklyPlanApi
  subscriptions: RendererSubscriptionsApi
  agentTools: RendererAgentToolsApi
}

export interface RendererCalendarApi {
  getState: () => Promise<import('./calendarDomain').CalendarDomainState>
  startGoogleAuthorization: (accountLabel?: string) => Promise<{
    connectionId: string
    request: { url: string; state: string; scopes: string[] }
    connection: import('./calendarDomain').CalendarConnectionRecord
  }>
  completeGoogleAuthorization: (input: {
    connectionId: string
    callback: string
  }) => Promise<import('./calendarDomain').CalendarConnectionRecord>
  cancelGoogleAuthorization: (
    connectionId: string
  ) => Promise<import('./calendarDomain').CalendarConnectionRecord>
  selectGoogleCalendars: (input: {
    connectionId: string
    calendarIds: string[]
  }) => Promise<import('./calendarDomain').CalendarConnectionRecord>
  syncGoogleConnection: (
    connectionId: string
  ) => Promise<
    CalendarSyncResult & { connection: import('./calendarDomain').CalendarConnectionRecord }
  >
  createLocalEvent: (
    input: import('./calendarDomain').CalendarEventDraft
  ) => Promise<import('./calendarDomain').CalendarEventRecord>
  updateLocalEvent: (input: {
    eventId: string
    draft: import('./calendarDomain').CalendarEventDraft
  }) => Promise<import('./calendarDomain').CalendarEventRecord>
  linkTaskToEvent: (input: {
    taskId: string
    eventId: string
    id?: string
    ownership?: 'task' | 'event' | 'manual'
    fieldOwnership?: import('./calendarDomain').CalendarFieldOwnership
  }) => Promise<import('./calendarDomain').CalendarLinkRecord>
  unlinkTaskFromEvent: (linkId: string) => Promise<boolean>
  deleteLocalCache: (connectionId: string) => Promise<number>
  disconnectGoogleConnection: (input: {
    connectionId: string
    deleteCache?: boolean
  }) => Promise<import('./calendarDomain').CalendarConnectionRecord>
  revokeGoogleConnection: (input: {
    connectionId: string
    deleteCache?: boolean
  }) => Promise<import('./calendarDomain').CalendarConnectionRecord>
}
