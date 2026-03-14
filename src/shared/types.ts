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

export interface NoteRecord {
  id: string
  relPath: string
  metadata: NoteMetadata
  body: string
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
}

export interface SearchResult {
  id: string
  relPath: string
  title: string
  tags: string[]
  updated: string
  snippet: string
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
  createdAt: string
}

export interface ProjectMilestone {
  id: string
  title: string
  description?: string
  collapsed?: boolean
  dueDate: string
  status: 'pending' | 'in-progress' | 'completed' | 'blocked'
  subtasks: ProjectSubtask[]
}

export interface Project {
  id: string
  name: string
  summary: string
  status: ProjectStatus
  updatedAt: string
  progress: number
  milestones: ProjectMilestone[]
  icon: ProjectIconStyle
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
  profile: {
    name: string
  }
  fontFamily: string
  calendarTasks: CalendarTask[]
  projectIcons: Record<string, ProjectIconStyle>
  projects: Project[]
}

export interface AppSettingsUpdate {
  isSidebarCollapsed?: boolean // Optional
  profile?: {
    name: string
  }
  fontFamily?: string
  calendarTasks?: CalendarTask[]
  projectIcons?: Record<string, ProjectIconStyle>
  projects?: Project[]
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

export interface VaultOpenResult {
  info: VaultInfo
  notes: NoteListItem[]
}

export interface RendererVaultApi {
  vault: {
    open: () => Promise<Maybe<VaultOpenResult>>
    create: () => Promise<Maybe<VaultOpenResult>>
    restoreLast: () => Promise<Maybe<VaultOpenResult>>
  }
  files: {
    listNotes: () => Promise<NoteListItem[]>
    readNote: (relPath: string) => Promise<string>
    writeNote: (relPath: string, content: string) => Promise<void>
    createNote: (name: string) => Promise<string>
    createNoteWithTags: (name: string, tags: string[]) => Promise<string>
    rename: (fromRelPath: string, toRelPath: string) => Promise<void>
    delete: (relPath: string) => Promise<void>
    exportNote: (relPath: string, content: string) => Promise<Maybe<string>>
  }
  search: {
    query: (query: string) => Promise<SearchResult[]>
  }
  attachments: {
    import: (sourcePath: string) => Promise<string>
    importFromBuffer: (buffer: Uint8Array, fileExtension: string) => Promise<string>
  }
  settings: {
    get: () => Promise<AppSettings>
    update: (next: AppSettingsUpdate) => Promise<AppSettings>
  }
  schedules: import('./scheduleTypes').RendererScheduleApi
  weeklyPlan: RendererWeeklyPlanApi
}
