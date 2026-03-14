export type TriggerType = 'manual' | 'daily' | 'every' | 'cron' | 'on_app_start'

export interface TriggerConfig {
  type: TriggerType
  // daily
  time?: string // "HH:mm"
  timezone?: string
  // every
  intervalMinutes?: number
  // cron
  expression?: string
}

export type RuntimeType = 'javascript' | 'python'
export type OutputMode = 'auto_apply' | 'review_before_apply'

export type SchedulePermission =
  | 'network'
  | 'readNotes'
  | 'createNotes'
  | 'updateNotes'
  | 'createTasks'
  | 'updateTasks'
  | 'createCalendarItems'
  | 'updateProjects'
  | 'useSecrets'

export const ALL_PERMISSIONS: SchedulePermission[] = [
  'network',
  'readNotes',
  'createNotes',
  'updateNotes',
  'createTasks',
  'updateTasks',
  'createCalendarItems',
  'updateProjects',
  'useSecrets'
]

export type RunStatus = 'idle' | 'running' | 'success' | 'error' | 'review' | 'cancelled'

// ── Script output actions ──────────────────────────────────────────────────

export interface TaskCreateAction {
  type: 'task.create'
  title: string
  date?: string
  time?: string
  priority?: 'low' | 'medium' | 'high'
  taskType?: string
  automationSource: string
  automationSourceKey: string
}

export interface TaskUpdateAction {
  type: 'task.update'
  automationSource: string
  automationSourceKey: string
  title?: string
  date?: string
  completed?: boolean
}

export interface NoteCreateAction {
  type: 'note.create'
  name: string
  body: string
  tags?: string[]
  automationSource: string
  automationSourceKey: string
}

export interface NoteAppendAction {
  type: 'note.append'
  name: string // match existing note by name
  body: string
}

export interface CalendarEventCreateAction {
  type: 'calendar.event.create'
  title: string
  date: string
  endDate?: string
  time?: string
  taskType?: string
  automationSource: string
  automationSourceKey: string
}

export type ScriptAction =
  | TaskCreateAction
  | TaskUpdateAction
  | NoteCreateAction
  | NoteAppendAction
  | CalendarEventCreateAction

// ── Core entities ──────────────────────────────────────────────────────────

export interface ScheduleJob {
  id: string
  name: string
  enabled: boolean
  trigger: TriggerConfig
  runtime: RuntimeType
  code: string
  permissions: SchedulePermission[]
  outputMode: OutputMode
  createdAt: string
  updatedAt: string
  lastRunAt?: string
  nextRunAt?: string
  lastStatus?: RunStatus
}

export interface ScheduleRunRecord {
  id: string
  jobId: string
  startedAt: string
  endedAt?: string
  status: RunStatus
  stdout: string
  stderr: string
  errorMessage?: string
  proposedActions: ScriptAction[]
  appliedActions: ScriptAction[]
}

// ── Renderer API ───────────────────────────────────────────────────────────

export interface ScheduleJobInput {
  id?: string
  name: string
  enabled: boolean
  trigger: TriggerConfig
  runtime: RuntimeType
  code: string
  permissions: SchedulePermission[]
  outputMode: OutputMode
}

export interface RendererScheduleApi {
  listJobs: () => Promise<ScheduleJob[]>
  saveJob: (input: ScheduleJobInput) => Promise<ScheduleJob>
  deleteJob: (id: string) => Promise<void>
  runNow: (id: string) => Promise<ScheduleRunRecord>
  listRuns: (jobId: string) => Promise<ScheduleRunRecord[]>
  applyActions: (runId: string) => Promise<void>
  dismissRun: (runId: string) => Promise<void>
}
