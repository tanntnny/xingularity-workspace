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
  reminders: TaskReminder[]
  time?: string // Optional time in HH:mm format
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
  completed: boolean
  createdAt: string
  dueDate?: string
}

export interface ProjectMilestone {
  id: string
  title: string
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
  fontFamily: string
  calendarTasks: CalendarTask[]
  projectIcons: Record<string, ProjectIconStyle>
  projects: Project[]
}

export interface AppSettingsUpdate {
  isSidebarCollapsed?: boolean // Optional
  fontFamily?: string
  calendarTasks?: CalendarTask[]
  projectIcons?: Record<string, ProjectIconStyle>
  projects?: Project[]
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
}
