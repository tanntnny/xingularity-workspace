export type Maybe<T> = T | null

export interface VaultInfo {
  rootPath: string
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
  blocks: unknown[]
}

export interface NoteRecord {
  id: string
  relPath: string
  metadata: NoteMetadata
  body: StoredNoteDocument
}

export type ProjectIconShape = 'circle' | 'square' | 'triangle' | 'diamond' | 'hex'
export type ProjectIconVariant = 'filled' | 'outlined'

export interface ProjectIconStyle {
  shape: ProjectIconShape
  variant: ProjectIconVariant
  color: string
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
  children: NoteTreeNode[]
}

export interface NoteTreeFile extends NoteTreeEntryBase {
  kind: 'note'
  note: NoteListItem
}

export type NoteTreeNode = NoteTreeFolder | NoteTreeFile

export interface SearchResult {
  id: string
  relPath: string
  title: string
  tags: string[]
  updated: string
  snippet: string
}

export interface AppErrorEvent {
  source: 'ipc' | 'main' | 'renderer'
  message: string
  stack?: string
  channel?: string
}

export type TaskPriority = 'low' | 'medium' | 'high'
export type CalendarTaskType = 'meeting' | 'assignment' | 'review' | 'personal' | 'other'

export interface TaskReminder {
  id: string
  type: 'minutes' | 'hours' | 'days'
  value: number
  enabled: boolean
}

export interface CalendarTask {
  id: string
  title: string
  date?: string // Optional - undefined means unscheduled
  endDate?: string // Optional - if set, task spans from `date` through `endDate`
  completed: boolean
  createdAt: string
  priority: TaskPriority
  taskType?: CalendarTaskType
  reminders: TaskReminder[]
  time?: string // Optional time in HH:mm format
  // Automation deduplication fields (set by schedule runner)
  automationSource?: string
  automationSourceKey?: string
}

// Unified calendar item for displaying tasks, milestones, and subtasks together
export type CalendarItemType = 'task' | 'milestone' | 'subtask'

export interface CalendarItem {
  id: string
  type: CalendarItemType
  title: string
  date: string
  completed: boolean
  priority?: TaskPriority
  // For milestones/subtasks
  projectId?: string
  projectName?: string
  milestoneId?: string
  milestoneName?: string
}

export type ProjectStatus = 'on-track' | 'at-risk' | 'blocked' | 'completed'

export interface ProjectSubtask {
  id: string
  title: string
  description?: string
  completed: boolean
  priority?: TaskPriority
  createdAt: string
  dueDate?: string
}

export interface ProjectMilestone {
  id: string
  title: string
  description?: string
  collapsed?: boolean
  dueDate?: string
  priority?: TaskPriority
  status: 'pending' | 'in-progress' | 'completed' | 'blocked'
  subtasks: ProjectSubtask[]
}

export interface Project {
  id: string
  name: string
  summary: string
  folderPath?: string
  status: ProjectStatus
  updatedAt: string
  progress: number
  milestones: ProjectMilestone[]
  icon: ProjectIconStyle
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

export interface FileMapEntry {
  id: string
  hash: string
  lastIndexedAt: string
}

export type FileMap = Record<string, FileMapEntry>

export interface AppSettings {
  isSidebarCollapsed: boolean // Tracks if the calendar sidebar is collapsed
  lastVaultPath: Maybe<string>
  lastOpenedNotePath: Maybe<string>
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
  calendarTasks: CalendarTask[]
  projectIcons: Record<string, ProjectIconStyle>
  projects: Project[]
  gridBoard: GridBoardState
}

export interface AppSettingsUpdate {
  isSidebarCollapsed?: boolean // Optional
  profile?: {
    name: string
  }
  ai?: {
    mistralApiKey: string
  }
  fontFamily?: string
  calendarTasks?: CalendarTask[]
  projectIcons?: Record<string, ProjectIconStyle>
  projects?: Project[]
  gridBoard?: GridBoardState
  lastOpenedNotePath?: Maybe<string>
  lastOpenedProjectId?: Maybe<string>
  favoriteNotePaths?: string[]
  favoriteProjectIds?: string[]
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
  linkedMilestoneId?: string
  linkedSubtaskId?: string
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
  linkedMilestoneId?: string
  linkedSubtaskId?: string
  linkedTaskId?: string
}

export interface UpdateWeeklyPlanPriorityInput {
  id: string
  title?: string
  status?: WeeklyPlanPriorityStatus
  linkedProjectId?: string | null
  linkedMilestoneId?: string | null
  linkedSubtaskId?: string | null
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
      summary?: string
      status?: ProjectStatus
      icon?: ProjectIconStyle
    }) => Promise<Project>
    update: (input: {
      projectId?: string
      projectName?: string
      name?: string
      summary?: string
      status?: ProjectStatus
      icon?: ProjectIconStyle
    }) => Promise<Project>
  }
  milestone: {
    create: (input: {
      projectId?: string
      projectName?: string
      title: string
      description?: string
      dueDate?: string
      collapsed?: boolean
    }) => Promise<ProjectMilestone>
    update: (input: {
      projectId?: string
      projectName?: string
      milestoneId?: string
      milestoneTitle?: string
      title?: string
      description?: string
      dueDate?: string | null
      collapsed?: boolean
      status?: ProjectMilestone['status']
    }) => Promise<ProjectMilestone>
  }
  subtask: {
    create: (input: {
      projectId?: string
      projectName?: string
      milestoneId?: string
      milestoneTitle?: string
      title: string
      description?: string
      dueDate?: string
      completed?: boolean
    }) => Promise<ProjectSubtask>
    update: (input: {
      projectId?: string
      projectName?: string
      milestoneId?: string
      milestoneTitle?: string
      subtaskId?: string
      subtaskTitle?: string
      title?: string
      description?: string
      dueDate?: string | null
      completed?: boolean
    }) => Promise<ProjectSubtask>
  }
  calendarTask: {
    create: (input: {
      title: string
      date?: string
      endDate?: string
      time?: string
      priority?: TaskPriority
      taskType?: CalendarTaskType
      reminders?: TaskReminder[]
      completed?: boolean
    }) => Promise<CalendarTask>
    update: (input: {
      taskId?: string
      titleMatch?: string
      title?: string
      date?: string | null
      endDate?: string | null
      time?: string | null
      priority?: TaskPriority
      taskType?: CalendarTaskType | null
      reminders?: TaskReminder[]
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
      linkedMilestoneId?: string
      linkedSubtaskId?: string
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

export interface RendererVaultApi {
  ui: {
    platform: string
    showNativeMenu: (
      items: NativeMenuItemDescriptor[],
      position: NativeMenuPosition
    ) => Promise<string | null>
  }
  vault: {
    open: () => Promise<Maybe<VaultOpenResult>>
    create: () => Promise<Maybe<VaultOpenResult>>
    restoreLast: () => Promise<Maybe<VaultOpenResult>>
  }
  desktop: {
    chooseDirectory: (title: string) => Promise<Maybe<string>>
    openPath: (targetPath: string) => Promise<void>
  }
  files: {
    listNotes: () => Promise<NoteListItem[]>
    listTree: () => Promise<NoteTreeNode[]>
    readNote: (relPath: string) => Promise<string>
    readNoteDocument: (relPath: string) => Promise<StoredNoteDocument>
    writeNote: (relPath: string, content: string) => Promise<void>
    writeNoteDocument: (relPath: string, document: StoredNoteDocument) => Promise<void>
    createNote: (name: string) => Promise<string>
    createNoteAtPath: (relPath: string) => Promise<string>
    createNoteWithTags: (name: string, tags: string[]) => Promise<string>
    createFolder: (relPath: string) => Promise<string>
    importNotes: () => Promise<NoteImportResult>
    rename: (fromRelPath: string, toRelPath: string) => Promise<void>
    renamePath: (fromRelPath: string, toRelPath: string) => Promise<void>
    delete: (relPath: string) => Promise<void>
    deletePath: (relPath: string) => Promise<void>
    exportNote: (relPath: string, content: string) => Promise<Maybe<string>>
    exportProject: (projectName: string, content: string) => Promise<Maybe<string>>
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
  settings: {
    get: () => Promise<AppSettings>
    update: (next: AppSettingsUpdate) => Promise<AppSettings>
  }
  schedules: import('./scheduleTypes').RendererScheduleApi
  weeklyPlan: RendererWeeklyPlanApi
  agentTools: RendererAgentToolsApi
}
