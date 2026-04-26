import type { VaultRuntime } from './runtime'
import { ScheduleStore } from './scheduleStore'
import { runScript } from './scheduleRunner'
import { stripNoteExtension } from '../shared/noteDocument'
import type {
  ScheduleJob,
  ScheduleJobInput,
  ScheduleRunRecord,
  ScriptAction,
  RunStatus,
  TriggerConfig
} from '../shared/scheduleTypes'
import type { CalendarTask } from '../shared/types'

const TICK_INTERVAL_MS = 60_000 // check every minute

export class ScheduleService {
  private runtime: VaultRuntime
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private vaultRoot: string | null = null

  constructor(runtime: VaultRuntime) {
    this.runtime = runtime
  }

  async init(): Promise<void> {
    // Wait for vault selection via handleVaultChange
  }

  destroy(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }
    this.vaultRoot = null
  }

  async handleVaultChange(vaultRoot: string | null): Promise<void> {
    if (this.tickTimer) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }

    this.vaultRoot = vaultRoot

    if (!vaultRoot) {
      return
    }

    const store = this.createStore()
    const jobs = await store.readJobs()
    for (const job of jobs) {
      if (job.enabled && job.trigger.type === 'on_app_start') {
        void this.executeJob(job)
      }
    }

    this.tickTimer = setInterval(() => {
      void this.tick()
    }, TICK_INTERVAL_MS)
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async listJobs(): Promise<ScheduleJob[]> {
    return this.createStore().readJobs()
  }

  async saveJob(input: ScheduleJobInput): Promise<ScheduleJob> {
    const now = new Date().toISOString()
    const store = this.createStore()
    const existing = input.id ? (await store.readJobs()).find((j) => j.id === input.id) : null

    const job: ScheduleJob = {
      id: input.id ?? `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: input.name.trim() || 'Untitled Job',
      enabled: input.enabled,
      trigger: input.trigger,
      runtime: input.runtime,
      code: input.code,
      permissions: input.permissions,
      outputMode: input.outputMode,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastRunAt: existing?.lastRunAt,
      lastStatus: existing?.lastStatus,
      nextRunAt: computeNextRunAt(input.trigger)
    }

    await store.upsertJob(job)
    return job
  }

  async deleteJob(id: string): Promise<void> {
    await this.createStore().deleteJob(id)
  }

  async runNow(id: string): Promise<ScheduleRunRecord> {
    const store = this.createStore()
    const jobs = await store.readJobs()
    const job = jobs.find((j) => j.id === id)
    if (!job) {
      throw new Error(`Schedule job not found: ${id}`)
    }
    return this.executeJob(job)
  }

  async listRuns(jobId: string): Promise<ScheduleRunRecord[]> {
    return this.createStore().readRunsForJob(jobId)
  }

  async applyActions(runId: string): Promise<void> {
    const store = this.createStore()
    const run = await store.findRun(runId)
    if (!run) throw new Error(`Run not found: ${runId}`)
    if (run.status !== 'review') throw new Error(`Run ${runId} is not in review status`)

    const jobs = await store.readJobs()
    const job = jobs.find((j) => j.id === run.jobId)
    if (!job) throw new Error(`Job not found for run ${runId}`)

    const applied = await this.applyScriptActions(run.proposedActions, job)

    const updatedRun: ScheduleRunRecord = {
      ...run,
      status: 'success',
      appliedActions: applied
    }
    await store.upsertRun(updatedRun)
  }

  async dismissRun(runId: string): Promise<void> {
    const store = this.createStore()
    const run = await store.findRun(runId)
    if (!run) throw new Error(`Run not found: ${runId}`)

    await store.upsertRun({ ...run, status: 'cancelled' })
  }

  // ── Internal execution ─────────────────────────────────────────────────────

  private async tick(): Promise<void> {
    if (!this.vaultRoot) {
      return
    }
    const now = new Date()
    const jobs = await this.createStore().readJobs()

    for (const job of jobs) {
      if (!job.enabled) continue
      if (job.trigger.type === 'manual' || job.trigger.type === 'on_app_start') continue
      if (!job.nextRunAt) continue
      if (new Date(job.nextRunAt) <= now) {
        void this.executeJob(job)
      }
    }
  }

  private async executeJob(job: ScheduleJob): Promise<ScheduleRunRecord> {
    const startedAt = new Date().toISOString()
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const store = this.createStore()

    await store.upsertJob({
      ...job,
      lastStatus: 'running',
      lastRunAt: startedAt,
      nextRunAt: computeNextRunAt(job.trigger)
    })

    let run: ScheduleRunRecord = {
      id: runId,
      jobId: job.id,
      startedAt,
      status: 'running',
      stdout: '',
      stderr: '',
      proposedActions: [],
      appliedActions: []
    }
    await store.upsertRun(run)

    try {
      const result = await runScript(job)
      const endedAt = new Date().toISOString()

      let finalStatus: RunStatus = 'success'
      let appliedActions: ScriptAction[] = []

      if (result.error) {
        finalStatus = 'error'
      } else if (job.outputMode === 'review_before_apply') {
        finalStatus = result.actions.length > 0 ? 'review' : 'success'
      } else {
        // auto_apply
        appliedActions = await this.applyScriptActions(result.actions, job)
        finalStatus = 'success'
      }

      run = {
        ...run,
        endedAt,
        status: finalStatus,
        stdout: result.stdout,
        stderr: result.stderr,
        errorMessage: result.error,
        proposedActions: result.actions,
        appliedActions
      }
    } catch (err) {
      run = {
        ...run,
        endedAt: new Date().toISOString(),
        status: 'error',
        errorMessage: err instanceof Error ? err.message : String(err)
      }
    }

    await store.upsertRun(run)

    // Update job status
    const jobs = await store.readJobs()
    const currentJob = jobs.find((j) => j.id === job.id)
    if (currentJob) {
      await store.upsertJob({
        ...currentJob,
        lastStatus: run.status,
        lastRunAt: run.startedAt
      })
    }

    return run
  }

  private async applyScriptActions(
    actions: ScriptAction[],
    job: ScheduleJob
  ): Promise<ScriptAction[]> {
    const applied: ScriptAction[] = []

    for (const action of actions) {
      try {
        const ok = await this.applyOneAction(action, job)
        if (ok) applied.push(action)
      } catch (err) {
        console.error(`[ScheduleService] Failed to apply action ${action.type}:`, err)
      }
    }

    return applied
  }

  private async applyOneAction(action: ScriptAction, job: ScheduleJob): Promise<boolean> {
    switch (action.type) {
      case 'task.create':
        return this.applyTaskCreate(action, job)
      case 'task.update':
        return this.applyTaskUpdate(action, job)
      case 'note.create':
        return this.applyNoteCreate(action, job)
      case 'note.append':
        return this.applyNoteAppend(action, job)
      case 'calendar.event.create':
        return this.applyCalendarEventCreate(action, job)
      default:
        console.warn('[ScheduleService] Unknown action type:', (action as { type: string }).type)
        return false
    }
  }

  private async applyTaskCreate(
    action: import('../shared/scheduleTypes').TaskCreateAction,
    job: ScheduleJob
  ): Promise<boolean> {
    if (!job.permissions.includes('createTasks')) return false

    const settings = await this.runtime.getSettings()
    const existing = settings.calendarTasks.find(
      (t) =>
        t.automationSource === action.automationSource &&
        t.automationSourceKey === action.automationSourceKey
    )
    if (existing) return false // dedup

    const newTask: CalendarTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: action.title,
      date: action.date,
      time: action.time,
      completed: false,
      createdAt: new Date().toISOString(),
      priority: action.priority ?? 'low',
      taskType: (action.taskType as CalendarTask['taskType']) ?? 'other',
      reminders: [],
      automationSource: action.automationSource,
      automationSourceKey: action.automationSourceKey
    }

    await this.runtime.updateSettings({
      calendarTasks: [...settings.calendarTasks, newTask]
    })
    return true
  }

  private async applyTaskUpdate(
    action: import('../shared/scheduleTypes').TaskUpdateAction,
    job: ScheduleJob
  ): Promise<boolean> {
    if (!job.permissions.includes('updateTasks')) return false

    const settings = await this.runtime.getSettings()
    const idx = settings.calendarTasks.findIndex(
      (t) =>
        t.automationSource === action.automationSource &&
        t.automationSourceKey === action.automationSourceKey
    )
    if (idx < 0) return false

    const updated = [...settings.calendarTasks]
    updated[idx] = {
      ...updated[idx],
      ...(action.title !== undefined ? { title: action.title } : {}),
      ...(action.date !== undefined ? { date: action.date } : {}),
      ...(action.completed !== undefined ? { completed: action.completed } : {})
    }

    await this.runtime.updateSettings({ calendarTasks: updated })
    return true
  }

  private async applyNoteCreate(
    action: import('../shared/scheduleTypes').NoteCreateAction,
    job: ScheduleJob
  ): Promise<boolean> {
    if (!job.permissions.includes('createNotes')) return false

    try {
      // Check if a note with the same automation source key already exists
      const notes = await this.runtime.listNotes()
      const automationComment = `<!-- automation:${action.automationSource}:${action.automationSourceKey} -->`
      for (const note of notes) {
        try {
          const content = await this.runtime.readNote(note.relPath)
          if (content.includes(automationComment)) return false // dedup
        } catch {
          // skip unreadable notes
        }
      }

      // Build content with frontmatter tags
      const tagLine =
        action.tags && action.tags.length > 0
          ? `---\ntags: [${action.tags.map((t) => `"${t}"`).join(', ')}]\n---\n\n`
          : ''
      const fullContent = `${tagLine}${automationComment}\n\n${action.body}`

      const relPath = await this.runtime.createNote(action.name)
      await this.runtime.writeNote(relPath, fullContent)
      return true
    } catch {
      return false
    }
  }

  private async applyNoteAppend(
    action: import('../shared/scheduleTypes').NoteAppendAction,
    job: ScheduleJob
  ): Promise<boolean> {
    if (!job.permissions.includes('updateNotes')) return false

    try {
      const notes = await this.runtime.listNotes()
      const match = notes.find(
        (n) =>
          stripNoteExtension(n.name).toLowerCase() === stripNoteExtension(action.name).toLowerCase()
      )
      if (!match) return false

      const existing = await this.runtime.readNote(match.relPath)
      await this.runtime.writeNote(match.relPath, `${existing}\n\n${action.body}`)
      return true
    } catch {
      return false
    }
  }

  private async applyCalendarEventCreate(
    action: import('../shared/scheduleTypes').CalendarEventCreateAction,
    job: ScheduleJob
  ): Promise<boolean> {
    if (!job.permissions.includes('createCalendarItems')) return false

    const settings = await this.runtime.getSettings()
    const existing = settings.calendarTasks.find(
      (t) =>
        t.automationSource === action.automationSource &&
        t.automationSourceKey === action.automationSourceKey
    )
    if (existing) return false // dedup

    const newTask: CalendarTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: action.title,
      date: action.date,
      endDate: action.endDate,
      time: action.time,
      completed: false,
      createdAt: new Date().toISOString(),
      priority: 'low',
      taskType: (action.taskType as CalendarTask['taskType']) ?? 'meeting',
      reminders: [],
      automationSource: action.automationSource,
      automationSourceKey: action.automationSourceKey
    }

    await this.runtime.updateSettings({
      calendarTasks: [...settings.calendarTasks, newTask]
    })
    return true
  }

  private createStore(): ScheduleStore {
    if (!this.vaultRoot) {
      throw new Error('No vault selected for schedule operations')
    }
    return new ScheduleStore(this.vaultRoot)
  }
}

// ── Trigger scheduling ─────────────────────────────────────────────────────

export function computeNextRunAt(trigger: TriggerConfig): string | undefined {
  const now = new Date()

  switch (trigger.type) {
    case 'manual':
    case 'on_app_start':
      return undefined

    case 'daily': {
      const [hours, minutes] = (trigger.time ?? '09:00').split(':').map(Number)
      const next = new Date(now)
      next.setHours(hours, minutes, 0, 0)
      if (next <= now) {
        next.setDate(next.getDate() + 1)
      }
      return next.toISOString()
    }

    case 'every': {
      const intervalMs = (trigger.intervalMinutes ?? 60) * 60 * 1000
      return new Date(now.getTime() + intervalMs).toISOString()
    }

    case 'cron': {
      return computeNextCronRun(trigger.expression ?? '0 9 * * *', now)
    }

    default:
      return undefined
  }
}

// ── Minimal cron parser ────────────────────────────────────────────────────
// Supports: * */N N N,M N-M  (5-field: min hour dom month dow)

function computeNextCronRun(expression: string, from: Date): string {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) {
    // fall back to +1 hour if invalid
    return new Date(from.getTime() + 3_600_000).toISOString()
  }

  const [minExpr, hourExpr, domExpr, monExpr, dowExpr] = parts

  // Search up to 1 year ahead, minute by minute (but we'll use hour increments for perf)
  const limit = new Date(from.getTime() + 366 * 24 * 60 * 60 * 1000)
  const candidate = new Date(from)
  candidate.setSeconds(0, 0)
  candidate.setMinutes(candidate.getMinutes() + 1)

  while (candidate < limit) {
    if (
      matchCronField(monExpr, candidate.getMonth() + 1, 1, 12) &&
      matchCronField(domExpr, candidate.getDate(), 1, 31) &&
      matchCronField(dowExpr, candidate.getDay(), 0, 6) &&
      matchCronField(hourExpr, candidate.getHours(), 0, 23) &&
      matchCronField(minExpr, candidate.getMinutes(), 0, 59)
    ) {
      return candidate.toISOString()
    }
    candidate.setMinutes(candidate.getMinutes() + 1)
  }

  return new Date(from.getTime() + 3_600_000).toISOString()
}

function matchCronField(expr: string, value: number, min: number, max: number): boolean {
  if (expr === '*') return true

  // */N — every N
  if (expr.startsWith('*/')) {
    const n = parseInt(expr.slice(2), 10)
    return value % n === 0
  }

  // List: N,M,...
  if (expr.includes(',')) {
    return expr.split(',').some((part) => matchCronField(part.trim(), value, min, max))
  }

  // Range: N-M
  if (expr.includes('-')) {
    const [lo, hi] = expr.split('-').map(Number)
    return value >= lo && value <= hi
  }

  // Exact
  return parseInt(expr, 10) === value
}
