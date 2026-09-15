import type { VaultRuntime } from './runtime'
import { ScheduleStore } from './scheduleStore'
import { ScheduleSecretsStore } from './scheduleSecretsStore'
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
import { normalizeTaskTags } from '../shared/taskTags'
import { normalizeCalendarEndDate } from '../shared/calendarTaskDates'
import { isTaskStatusDone } from '../shared/taskStatus'
import {
  addDateOnlyDays,
  localDateTimeToInstant,
  resolveDefaultCalendarTimezone
} from '../shared/calendarDomain'
import {
  evaluateScheduleCapabilities,
  normalizeSchedulePermissions
} from '../shared/schedulePolicy'

const TICK_INTERVAL_MS = 60_000 // check every minute

interface ScheduleContext {
  generation: number
  rootPath: string
  store: ScheduleStore
}

interface RunningJob {
  controller: AbortController
}

class ScheduleVaultChangedError extends Error {
  constructor() {
    super('Vault changed while the scheduled job was running')
    this.name = 'ScheduleVaultChangedError'
  }
}

export class ScheduleService {
  private runtime: VaultRuntime
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private vaultRoot: string | null = null
  private vaultGeneration = 0
  private readonly runningJobs = new Map<string, RunningJob>()

  constructor(runtime: VaultRuntime) {
    this.runtime = runtime
  }

  async init(): Promise<void> {
    // Wait for vault selection via handleVaultChange
  }

  destroy(): void {
    this.vaultGeneration += 1
    if (this.tickTimer) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }
    this.vaultRoot = null
    for (const { controller } of this.runningJobs.values()) {
      controller.abort()
    }
    this.runningJobs.clear()
  }

  async handleVaultChange(vaultRoot: string | null): Promise<void> {
    const generation = ++this.vaultGeneration
    if (this.tickTimer) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }

    for (const { controller } of this.runningJobs.values()) {
      controller.abort()
    }
    this.runningJobs.clear()
    this.vaultRoot = vaultRoot

    if (!vaultRoot) {
      return
    }

    const context = this.createContextForVault(vaultRoot, generation)
    const jobs = await context.store.readJobs()
    if (!this.isCurrentContext(context)) {
      return
    }

    for (const job of jobs) {
      if (job.enabled && job.trigger.type === 'on_app_start') {
        void this.executeScheduledJob(job, context)
      }
    }

    if (!this.isCurrentContext(context)) {
      return
    }

    this.tickTimer = setInterval(() => {
      void this.tick()
    }, TICK_INTERVAL_MS)
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async listJobs(): Promise<ScheduleJob[]> {
    const context = await this.createReadContext()
    return context ? context.store.readJobs() : []
  }

  async saveJob(input: ScheduleJobInput): Promise<ScheduleJob> {
    const now = new Date().toISOString()
    const context = await this.createContext()
    const existing = input.id
      ? (await context.store.readJobs()).find((j) => j.id === input.id)
      : null

    const permissions = normalizeSchedulePermissions(input.permissions)
    const secretRefs = input.secretRefs ?? existing?.secretRefs ?? []
    const capabilityDecision = evaluateScheduleCapabilities({
      ...input,
      permissions,
      secretRefs
    })
    if (!capabilityDecision.allowed) {
      throw new Error(capabilityDecision.errors.join('; '))
    }

    const job: ScheduleJob = {
      id: input.id ?? `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: input.name.trim() || 'Untitled Job',
      enabled: input.enabled,
      trigger: input.trigger,
      runtime: input.runtime,
      code: input.code,
      permissions,
      secretRefs,
      outputMode: input.outputMode,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastRunAt: existing?.lastRunAt,
      lastStatus: existing?.lastStatus,
      nextRunAt: computeNextRunAt(input.trigger)
    }

    await context.store.upsertJob(job)
    return job
  }

  async deleteJob(id: string): Promise<void> {
    const context = await this.createContext()
    await context.store.deleteJob(id)
  }

  async runNow(id: string): Promise<ScheduleRunRecord> {
    const context = await this.createContext()
    const jobs = await context.store.readJobs()
    const job = jobs.find((j) => j.id === id)
    if (!job) {
      throw new Error(`Schedule job not found: ${id}`)
    }
    return this.executeJob(job, context)
  }

  async cancelRun(jobId: string): Promise<boolean> {
    const runningJob = this.runningJobs.get(jobId)
    if (!runningJob) {
      return false
    }
    runningJob.controller.abort()
    return true
  }

  async listRuns(jobId: string): Promise<ScheduleRunRecord[]> {
    const context = await this.createReadContext()
    return context ? context.store.readRunsForJob(jobId) : []
  }

  async listSecrets(): Promise<string[]> {
    return new ScheduleSecretsStore().listNames()
  }

  async saveSecret(name: string, value: string): Promise<void> {
    await new ScheduleSecretsStore().save(name, value)
  }

  async deleteSecret(name: string): Promise<void> {
    await new ScheduleSecretsStore().delete(name)
  }

  async applyActions(runId: string): Promise<void> {
    const context = await this.createContext()
    const run = await context.store.findRun(runId)
    if (!run) throw new Error(`Run not found: ${runId}`)
    if (run.status !== 'review') throw new Error(`Run ${runId} is not in review status`)

    const jobs = await context.store.readJobs()
    const job = jobs.find((j) => j.id === run.jobId)
    if (!job) throw new Error(`Job not found for run ${runId}`)

    const appliedResult = await this.applyScriptActions(run.proposedActions, job, context)

    const updatedRun: ScheduleRunRecord = {
      ...run,
      status: appliedResult.errors.length > 0 ? 'error' : 'success',
      appliedActions: appliedResult.applied,
      actionErrors: appliedResult.errors
    }
    await context.store.upsertRun(updatedRun)
    await this.syncJobStatusFromLatestRun(context.store, run.jobId)
  }

  async dismissRun(runId: string): Promise<void> {
    const context = await this.createContext()
    const run = await context.store.findRun(runId)
    if (!run) throw new Error(`Run not found: ${runId}`)

    await context.store.upsertRun({ ...run, status: 'cancelled' })
    await this.syncJobStatusFromLatestRun(context.store, run.jobId)
  }

  private async syncJobStatusFromLatestRun(store: ScheduleStore, jobId: string): Promise<void> {
    const [jobs, runs] = await Promise.all([store.readJobs(), store.readRunsForJob(jobId)])
    const job = jobs.find((item) => item.id === jobId)
    const latestRun = runs[0]

    if (!job || !latestRun) {
      return
    }

    await store.upsertJob({
      ...job,
      lastStatus: latestRun.status,
      lastRunAt: latestRun.startedAt
    })
  }

  // ── Internal execution ─────────────────────────────────────────────────────

  private async tick(): Promise<void> {
    const context = await this.createReadContext()
    if (!context || !this.isCurrentContext(context)) {
      return
    }
    const now = new Date()
    const jobs = await context.store.readJobs()
    if (!this.isCurrentContext(context)) {
      return
    }

    for (const job of jobs) {
      if (!job.enabled) continue
      if (job.trigger.type === 'manual' || job.trigger.type === 'on_app_start') continue
      if (!job.nextRunAt) continue
      if (new Date(job.nextRunAt) <= now) {
        void this.executeScheduledJob(job, context)
      }
    }
  }

  private async executeScheduledJob(job: ScheduleJob, context: ScheduleContext): Promise<void> {
    if (this.runningJobs.has(job.id)) {
      return
    }

    try {
      await this.executeJob(job, context)
    } catch (error) {
      console.error(`[ScheduleService] Scheduled job ${job.id} failed:`, error)
    }
  }

  private async executeJob(job: ScheduleJob, context: ScheduleContext): Promise<ScheduleRunRecord> {
    if (this.runningJobs.has(job.id)) {
      throw new Error(`Schedule job is already running: ${job.id}`)
    }

    this.assertCurrentContext(context)
    const controller = new AbortController()
    this.runningJobs.set(job.id, { controller })
    try {
      return await this.executeJobInternal(job, context, controller.signal)
    } finally {
      const runningJob = this.runningJobs.get(job.id)
      if (runningJob?.controller === controller) {
        this.runningJobs.delete(job.id)
      }
    }
  }

  private async executeJobInternal(
    job: ScheduleJob,
    context: ScheduleContext,
    signal: AbortSignal
  ): Promise<ScheduleRunRecord> {
    const startedAt = new Date().toISOString()
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    this.assertCurrentContext(context)
    const store = context.store

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
      appliedActions: [],
      actionErrors: []
    }
    await store.upsertRun(run)

    try {
      const secretEnv =
        job.permissions.includes('useSecrets') && job.secretRefs?.length
          ? await new ScheduleSecretsStore().resolve(job.secretRefs)
          : {}
      this.assertCurrentContext(context)
      const settings = await this.runtime.getSettings()
      this.assertCurrentContext(context)
      const result = await runScript(job, secretEnv, {
        condaEnvironmentPath: settings.pythonCondaEnvironmentPath,
        condaExecutablePath: settings.pythonCondaExecutablePath,
        signal
      })
      this.assertCurrentContext(context)
      const endedAt = new Date().toISOString()

      let finalStatus: RunStatus = result.cancelled ? 'cancelled' : 'success'
      let appliedActions: ScriptAction[] = []
      let actionErrors: string[] = []

      if (result.error) {
        finalStatus = 'error'
      } else if (result.cancelled) {
        finalStatus = 'cancelled'
      } else if (job.outputMode === 'review_before_apply') {
        finalStatus = result.actions.length > 0 ? 'review' : 'success'
      } else {
        // auto_apply
        const appliedResult = await this.applyScriptActions(result.actions, job, context)
        appliedActions = appliedResult.applied
        actionErrors = appliedResult.errors
        finalStatus = actionErrors.length > 0 ? 'error' : 'success'
      }

      run = {
        ...run,
        endedAt,
        status: finalStatus,
        stdout: result.stdout,
        stderr: result.stderr,
        errorMessage: result.error,
        proposedActions: result.actions,
        appliedActions,
        actionErrors
      }
    } catch (err) {
      const vaultChanged =
        err instanceof ScheduleVaultChangedError || !this.isCurrentContext(context)
      run = {
        ...run,
        endedAt: new Date().toISOString(),
        status: vaultChanged ? 'cancelled' : 'error',
        ...(vaultChanged ? {} : { errorMessage: err instanceof Error ? err.message : String(err) })
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
    job: ScheduleJob,
    context: ScheduleContext
  ): Promise<{ applied: ScriptAction[]; errors: string[] }> {
    const applied: ScriptAction[] = []
    const errors: string[] = []

    for (const action of actions) {
      this.assertCurrentContext(context)
      try {
        const ok = await this.applyOneAction(action, job)
        this.assertCurrentContext(context)
        if (ok) {
          applied.push(action)
        } else {
          errors.push(describeActionFailure(action))
        }
      } catch (err) {
        if (!this.isCurrentContext(context)) {
          throw new ScheduleVaultChangedError()
        }
        console.error(`[ScheduleService] Failed to apply action ${action.type}:`, err)
        errors.push(
          `${describeActionFailure(action)}: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }

    return { applied, errors }
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

    return this.runtime.mutateSettings(
      (settings) => {
        const existing = settings.calendarTasks.find(
          (t) =>
            t.automationSource === action.automationSource &&
            t.automationSourceKey === action.automationSourceKey
        )
        if (existing) {
          // Keep creates idempotent, but reconcile the deadline time when an
          // existing automation-owned task predates endTime support. The
          // update permission is required so create cannot mutate user tasks
          // beyond the schedule's declared capabilities.
          if (
            job.permissions.includes('updateTasks') &&
            action.endTime !== undefined &&
            existing.endTime !== action.endTime
          ) {
            return {
              next: {
                calendarTasks: settings.calendarTasks.map((task) =>
                  task.id === existing.id ? { ...task, endTime: action.endTime } : task
                )
              },
              result: true
            }
          }

          // Otherwise, an existing automation-owned task is already in the
          // desired collection, so treat the create as a successful no-op.
          return { next: {}, result: true }
        }

        const newTask: CalendarTask = {
          id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: action.title,
          description: action.description,
          projectId: action.projectId,
          tags: normalizeTaskTags(action.tags),
          date: action.date,
          endDate: normalizeCalendarEndDate(action.date, action.endDate),
          time: action.time,
          endTime: action.endTime,
          completed: isTaskStatusDone(action.status),
          status: action.status ?? 'pending',
          createdAt: new Date().toISOString(),
          priority: action.priority ?? 'low',
          taskType: (action.taskType as CalendarTask['taskType']) ?? 'other',
          reminders: [],
          automationSource: action.automationSource,
          automationSourceKey: action.automationSourceKey
        }

        return {
          next: { calendarTasks: [...settings.calendarTasks, newTask] },
          result: true
        }
      },
      { label: 'Apply scheduled task' }
    )
  }

  private async applyTaskUpdate(
    action: import('../shared/scheduleTypes').TaskUpdateAction,
    job: ScheduleJob
  ): Promise<boolean> {
    if (!job.permissions.includes('updateTasks')) return false

    return this.runtime.mutateSettings(
      (settings) => {
        const idx = settings.calendarTasks.findIndex(
          (t) =>
            t.automationSource === action.automationSource &&
            t.automationSourceKey === action.automationSourceKey
        )
        if (idx < 0) {
          return { next: {}, result: false }
        }

        const updated = [...settings.calendarTasks]
        const nextDate = action.date !== undefined ? action.date : updated[idx].date
        const nextEndDate =
          action.endDate !== undefined ? (action.endDate ?? undefined) : updated[idx].endDate
        const nextEndTime =
          action.endTime !== undefined ? (action.endTime ?? undefined) : updated[idx].endTime
        updated[idx] = {
          ...updated[idx],
          ...(action.title !== undefined ? { title: action.title } : {}),
          ...(action.description !== undefined ? { description: action.description } : {}),
          ...(action.projectId !== undefined ? { projectId: action.projectId || undefined } : {}),
          ...(action.tags !== undefined
            ? { tags: normalizeTaskTags([...(updated[idx].tags ?? []), ...action.tags]) }
            : {}),
          ...(action.date !== undefined || action.endDate !== undefined
            ? {
                date: nextDate,
                endDate: normalizeCalendarEndDate(nextDate, nextEndDate)
              }
            : {}),
          ...(action.endTime !== undefined ? { endTime: nextEndTime } : {}),
          ...(action.completed !== undefined
            ? { completed: action.completed, status: action.completed ? 'completed' : 'pending' }
            : {}),
          ...(action.status !== undefined
            ? { status: action.status, completed: isTaskStatusDone(action.status) }
            : {})
        }

        return {
          next: { calendarTasks: updated },
          result: true
        }
      },
      { label: 'Apply scheduled task update' }
    )
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

    return this.runtime.mutateSettings(
      (settings) => {
        const existing = settings.calendarTasks.find(
          (t) =>
            t.automationSource === action.automationSource &&
            t.automationSourceKey === action.automationSourceKey
        )
        if (existing) {
          // Idempotent create: an existing automation-owned event is already
          // in the desired collection, so treat the no-op as successful.
          return { next: {}, result: true }
        }

        const newTask: CalendarTask = {
          id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: action.title,
          description: action.description,
          projectId: action.projectId,
          tags: normalizeTaskTags(action.tags),
          date: action.date,
          endDate: action.endDate,
          time: action.time,
          completed: isTaskStatusDone(action.status),
          status: action.status ?? 'pending',
          createdAt: new Date().toISOString(),
          priority: 'low',
          taskType: (action.taskType as CalendarTask['taskType']) ?? 'meeting',
          reminders: [],
          automationSource: action.automationSource,
          automationSourceKey: action.automationSourceKey
        }

        return {
          next: { calendarTasks: [...settings.calendarTasks, newTask] },
          result: true
        }
      },
      { label: 'Apply scheduled calendar event' }
    )
  }

  private async createContext(): Promise<ScheduleContext> {
    const ready = await this.runtime.waitForVaultReady()
    if (!ready || !this.vaultRoot) {
      throw new Error('No vault selected for schedule operations')
    }
    return this.createContextForVault(this.vaultRoot, this.vaultGeneration)
  }

  private async createReadContext(): Promise<ScheduleContext | null> {
    const ready = await this.runtime.waitForVaultReady()
    if (!ready || !this.vaultRoot) {
      return null
    }
    return this.createContextForVault(this.vaultRoot, this.vaultGeneration)
  }

  private createContextForVault(rootPath: string, generation: number): ScheduleContext {
    return {
      generation,
      rootPath,
      store: new ScheduleStore(rootPath)
    }
  }

  private isCurrentContext(context: ScheduleContext): boolean {
    return context.generation === this.vaultGeneration && context.rootPath === this.vaultRoot
  }

  private assertCurrentContext(context: ScheduleContext): void {
    if (!this.isCurrentContext(context)) {
      throw new ScheduleVaultChangedError()
    }
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
      const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
      const timezone =
        trigger.timezone && trigger.timezone !== 'local'
          ? trigger.timezone
          : resolveDefaultCalendarTimezone()
      const currentDate = getDateInTimezone(now, timezone)
      let nextRunAt = localDateTimeToInstant(currentDate, time, timezone)

      if (Date.parse(nextRunAt) <= now.getTime()) {
        nextRunAt = localDateTimeToInstant(addDateOnlyDays(currentDate, 1), time, timezone)
      }

      return nextRunAt
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

function getDateInTimezone(value: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value)
  const getPart = (type: 'year' | 'month' | 'day'): string => {
    const part = parts.find((item) => item.type === type)?.value
    if (!part) {
      throw new Error(`Could not resolve ${type} in timezone ${timezone}`)
    }
    return part.padStart(2, '0')
  }

  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`
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

function describeActionFailure(action: ScriptAction): string {
  if ('automationSourceKey' in action) {
    return `${action.type} was not applied (${action.automationSourceKey})`
  }

  return `${action.type} was not applied`
}
