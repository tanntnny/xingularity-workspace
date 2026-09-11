import fs from 'node:fs/promises'
import path from 'node:path'
import { parseNoteContent } from './indexer/noteParser'
import { collectVaultDiagnostics } from './vaultDiagnostics'
import { getVaultDomainDefinitions } from './vaultDomainCatalog'
import {
  VaultRecoveryStore,
  type VaultConflictRecord,
  type VaultQuarantineRecord
} from './vaultRecoveryStore'
import {
  checksumVaultManifest,
  VAULT_MANIFEST_RELATIVE_PATH,
  validateVaultManifest,
  type VaultManifest
} from './vaultManifest'
import { isTaskDone } from '../shared/taskStatus'
import { assertSafeRelativePath } from '../shared/pathSafety'
import { isNotePath } from '../shared/noteDocument'

export const VAULT_CONTEXT_SCHEMA_VERSION = 1 as const
export const DEFAULT_VAULT_CONTEXT_LIMIT = 20
export const DEFAULT_VAULT_CONTEXT_MAX_CHARS = 24_000
export const MAX_VAULT_CONTEXT_LIMIT = 100
export const MAX_VAULT_CONTEXT_MAX_CHARS = 200_000

const MAX_SOURCE_FILES = 10_000
const MAX_NOTE_BYTES = 1_000_000
const MAX_JSON_BYTES = 5_000_000

export interface VaultContextOptions {
  query?: string
  project?: string
  note?: string
  limit?: number
  maxChars?: number
  includeDiagnostics?: boolean
}

export interface VaultManifestReport {
  path: typeof VAULT_MANIFEST_RELATIVE_PATH
  present: boolean
  valid: boolean
  checksum: string | null
  manifest: VaultManifest | null
  errors: string[]
}

export interface VaultContextNote {
  id: string
  path: string
  title: string
  tags: string[]
  updatedAt: string
  size: number
  excerpt?: string
  truncated?: boolean
}

export interface VaultContextProjectEntry {
  id: string
  path: string
  name: string
  description?: string
  state: string
  tags: string[]
  startDate?: string
  endDate?: string
  folderPath?: string
  updatedAt: string
  taskCount: number
  openTaskCount: number
  milestones: Array<{
    id: string
    title: string
    endDate?: string
  }>
  updates: Array<{
    id: string
    status?: string
    content?: string
    updatedAt?: string
  }>
  meetings: Array<{
    id: string
    type?: string
    outcome?: string
    content?: string
    updatedAt?: string
  }>
}

export interface VaultContextTask {
  id: string
  path: string
  title: string
  description?: string
  status: string
  completed: boolean
  priority?: string
  taskType?: string
  projectId?: string
  milestoneId?: string
  tags: string[]
  date?: string
  endDate?: string
  time?: string
  endTime?: string
  updatedAt: string
}

export interface VaultContextCalendarEvent {
  id: string
  title: string
  allDay: boolean
  start: string
  end: string
  source: string
  status?: string
  location?: string
  projectId?: string
  updatedAt: string
}

export interface VaultContextCalendarConnection {
  id: string
  provider: string
  name: string
  status: string
  selectedCalendarIds: string[]
  lastSyncAt?: string
}

export interface VaultContextWeeklyPlan {
  weeks: Array<{
    id: string
    startDate: string
    endDate: string
    focus?: string
    priorities: Array<{
      id: string
      title: string
      status: string
      order: number
      linkedProjectId?: string
      linkedTaskId?: string
    }>
    review?: {
      wins?: string
      misses?: string
      blockers?: string
      nextWeek?: string
    }
  }>
  totalWeeks: number
  totalPriorities: number
  totalReviews: number
}

export interface VaultContextResource {
  id: string
  title: string
  provider: string
  kind: string
  uri: string
  state: string
  access: string
  projectIds: string[]
  updatedAt: string
  lastSeenAt?: string
  freshness?: string
}

export interface VaultContextSubscription {
  id: string
  name: string
  provider?: string
  category?: string
  amount?: number
  currency?: string
  billingCycle?: string
  nextRenewalAt?: string
  status?: string
  reviewFlag?: string
  tags: string[]
}

export interface VaultContextSchedule {
  id: string
  name: string
  enabled?: boolean
  runtime?: string
  trigger?: string
  permissions: string[]
  latestRun?: {
    status?: string
    startedAt?: string
    endedAt?: string
  }
}

export interface VaultContextAgentRun {
  id: string
  agentName?: string
  source?: string
  status?: string
  startedAt?: string
  endedAt?: string
  model?: string
}

export interface VaultContextRecoverySummary {
  conflicts: Array<{
    id: string
    path: string
    detectedAt: string
    reason?: string
    payloadRoles: string[]
  }>
  quarantine: Array<{
    id: string
    path: string
    quarantinedAt: string
    reason: string
    payloadPath: string
  }>
}

export interface VaultContextBundle {
  schemaVersion: typeof VAULT_CONTEXT_SCHEMA_VERSION
  generatedAt: string
  rootPath: string
  scope: {
    query?: string
    project?: string
    note?: string
    limit: number
    maxChars: number
  }
  vault: {
    manifest: VaultManifestReport
    schemaVersion: number
    domains: Array<{
      id: string
      canonicalRoots: string[]
      derivedPaths: string[]
      portable: boolean
      editPolicy: string
    }>
  }
  summary: {
    notes: { total: number; included: number }
    projects: { total: number; included: number }
    tasks: { total: number; included: number; open: number; overdue: number }
    calendar: { events: number; included: number; connections: number }
    weeklyPlan: { weeks: number; priorities: number; reviews: number }
    resources: { total: number; included: number; relations: number }
    subscriptions: { total: number; included: number }
    schedules: { total: number; included: number }
    agent: { runs: number; sessions: number }
  }
  notes: VaultContextNote[]
  projects: VaultContextProjectEntry[]
  tasks: VaultContextTask[]
  calendar: {
    events: VaultContextCalendarEvent[]
    connections: VaultContextCalendarConnection[]
  }
  weeklyPlan: VaultContextWeeklyPlan
  resources: VaultContextResource[]
  resourceRelations: Array<{
    id: string
    type: string
    fromId: string
    toId: string
    confidence?: string
    note?: string
  }>
  subscriptions: VaultContextSubscription[]
  schedules: VaultContextSchedule[]
  agent: {
    recentRuns: VaultContextAgentRun[]
    sessions: Array<{
      id: string
      title: string
      updatedAt?: string
      messageCount: number
    }>
  }
  recovery: VaultContextRecoverySummary
  health: {
    issueCounts: { total: number; errors: number; warnings: number; info: number }
    legacyPaths: string[]
    orphanedPaths: string[]
  }
  budget: {
    maxChars: number
    contentChars: number
    truncated: boolean
  }
  warnings: string[]
}

export interface VaultNoteReadResult {
  path: string
  title: string
  tags: string[]
  content: string
  size: number
  updatedAt: string
  truncated: boolean
}

export interface VaultSearchResult {
  id: string
  kind: 'note' | 'project' | 'task' | 'calendar' | 'resource' | 'subscription'
  path?: string
  title: string
  snippet: string
  updatedAt?: string
  matchFields: string[]
  projectId?: string
}

interface SafeFile {
  relPath: string
  absolutePath: string
  size: number
  mtimeMs: number
}

interface BoundedFileRead {
  content: string
  size: number
  mtimeMs: number
  truncated: boolean
}

interface ProjectRecord {
  id: string
  path: string
  name: string
  description: string
  state: string
  tags: string[]
  startDate?: string
  endDate?: string
  folderPath?: string
  updatedAt: string
  milestones: VaultContextProjectEntry['milestones']
  updates: VaultContextProjectEntry['updates']
  meetings: VaultContextProjectEntry['meetings']
}

interface TaskRecord {
  id: string
  path: string
  title: string
  description?: string
  status: string
  completed: boolean
  priority?: string
  taskType?: string
  projectId?: string
  milestoneId?: string
  tags: string[]
  date?: string
  endDate?: string
  time?: string
  endTime?: string
  updatedAt: string
}

interface ProjectSelection {
  requested?: string
  id?: string
  name?: string
  folderPath?: string
}

/**
 * Build a bounded, read-only representation of the user-authored vault.
 *
 * This intentionally reads explicit canonical domains instead of returning
 * arbitrary JSON files. That keeps settings, credentials, locators, indexes,
 * scripts, and agent transcript bodies outside the agent context boundary.
 */
export async function buildVaultContext(
  rootPath: string,
  options: VaultContextOptions = {}
): Promise<VaultContextBundle> {
  const root = await assertReadableVaultRoot(rootPath)
  const normalized = normalizeContextOptions(options)
  const warnings: string[] = []
  const budget = new ContentBudget(normalized.maxChars)
  const manifest = await readVaultManifestReport(root)

  const diagnostics = normalized.includeDiagnostics
    ? await collectVaultDiagnostics(root).catch((error: unknown) => {
        warnings.push(`Diagnostics unavailable: ${describeError(error)}`)
        return null
      })
    : null

  const schemaVersion = await readSchemaVersion(root, manifest, warnings)
  const notes = await readNotes(root, warnings)
  const projects = await readProjects(root, warnings)
  const tasks = await readTasks(root, warnings)
  const projectSelection = resolveProjectSelection(projects, normalized.project, warnings)
  const selectedProjects = projects.filter((project) =>
    matchesProjectSelection(project, projectSelection, normalized)
  )
  const selectedTasks = tasks.filter((task) =>
    matchesTaskSelection(task, normalized, projectSelection)
  )
  const selectedNotes = notes.filter((note) =>
    matchesNoteSelection(note, normalized, projectSelection, selectedProjects)
  )
  const selectedProjectsWithCounts = selectedProjects.map((project) =>
    toContextProject(project, tasks, budget)
  )
  const selectedTasksOutput = selectedTasks
    .slice()
    .sort(compareTasks)
    .slice(0, normalized.limit)
    .map((task) => toContextTask(task, budget))
  const selectedNotesOutput = selectedNotes
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, normalized.limit)
    .map((note) => toContextNote(note, budget, normalized.query))

  const calendar = await readCalendar(root, normalized, projectSelection, warnings)
  const weeklyPlan = await readWeeklyPlan(root, normalized, projectSelection, budget, warnings)
  const resourceData = await readResources(root, normalized, projectSelection, warnings)
  const subscriptions = await readSubscriptions(root, normalized, warnings)
  const schedules = await readSchedules(root, normalized, warnings)
  const agent = await readAgentContext(root, normalized, warnings)
  const recovery = await readRecoveryContext(root, warnings)

  const taskCount = tasks.filter((task) => matchesTaskSelection(task, normalized, projectSelection))
  const today = toIsoDate(new Date())
  const issueCounts = diagnostics
    ? summarizeIssueCounts(diagnostics.issues)
    : { total: 0, errors: 0, warnings: 0, info: 0 }

  const context: VaultContextBundle = {
    schemaVersion: VAULT_CONTEXT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    rootPath: root,
    scope: {
      ...(normalized.query ? { query: normalized.query } : {}),
      ...(normalized.project ? { project: normalized.project } : {}),
      ...(normalized.note ? { note: normalizeNotePath(normalized.note) } : {}),
      limit: normalized.limit,
      maxChars: normalized.maxChars
    },
    vault: {
      manifest,
      schemaVersion,
      domains: getVaultDomainDefinitions().map((definition) => ({
        id: definition.id,
        canonicalRoots: definition.canonicalRoots,
        derivedPaths: definition.derivedPaths,
        portable: definition.portable,
        editPolicy: definition.editPolicy
      }))
    },
    summary: {
      notes: { total: selectedNotes.length, included: selectedNotesOutput.length },
      projects: { total: selectedProjects.length, included: selectedProjectsWithCounts.length },
      tasks: {
        total: taskCount.length,
        included: selectedTasksOutput.length,
        open: taskCount.filter((task) => !task.completed).length,
        overdue: taskCount.filter(
          (task) => !task.completed && Boolean(task.date && task.date < today)
        ).length
      },
      calendar: {
        events: calendar.totalEvents,
        included: calendar.events.length,
        connections: calendar.connections.length
      },
      weeklyPlan: {
        weeks: weeklyPlan.totalWeeks,
        priorities: weeklyPlan.totalPriorities,
        reviews: weeklyPlan.totalReviews
      },
      resources: {
        total: resourceData.total,
        included: resourceData.resources.length,
        relations: resourceData.relations.length
      },
      subscriptions: { total: subscriptions.total, included: subscriptions.records.length },
      schedules: { total: schedules.total, included: schedules.records.length },
      agent: { runs: agent.totalRuns, sessions: agent.totalSessions }
    },
    notes: selectedNotesOutput,
    projects: selectedProjectsWithCounts,
    tasks: selectedTasksOutput,
    calendar: {
      events: calendar.events,
      connections: calendar.connections
    },
    weeklyPlan,
    resources: resourceData.resources,
    resourceRelations: resourceData.relations,
    subscriptions: subscriptions.records,
    schedules: schedules.records,
    agent: {
      recentRuns: agent.runs,
      sessions: agent.sessions
    },
    recovery,
    health: {
      issueCounts,
      legacyPaths: diagnostics?.legacyPaths ?? [],
      orphanedPaths: diagnostics?.orphanedPaths ?? []
    },
    budget: {
      maxChars: normalized.maxChars,
      contentChars: budget.used,
      truncated:
        budget.truncated ||
        selectedNotes.length > selectedNotesOutput.length ||
        selectedTasks.length > selectedTasksOutput.length ||
        resourceData.wasTruncated ||
        subscriptions.wasTruncated ||
        schedules.wasTruncated ||
        agent.wasTruncated ||
        calendar.wasTruncated
    },
    warnings: uniqueStrings(warnings)
  }

  return context
}

export async function readVaultNote(
  rootPath: string,
  notePath: string,
  options: { maxChars?: number } = {}
): Promise<VaultNoteReadResult> {
  const root = await assertReadableVaultRoot(rootPath)
  const normalizedPath = normalizeNotePath(notePath)
  const filePath = await resolveSafeFile(root, normalizedPath)
  const read = await readBoundedTextFile(filePath, normalizeMaxChars(options.maxChars) * 4 + 4)
  const parsed = parseNoteContent(read.content, normalizedPath)
  return {
    path: normalizedPath,
    title: parsed.metadata.title,
    tags: parsed.metadata.tags,
    content: truncateText(read.content, normalizeMaxChars(options.maxChars)),
    size: read.size,
    updatedAt: new Date(read.mtimeMs).toISOString(),
    truncated: read.truncated || read.content.length > normalizeMaxChars(options.maxChars)
  }
}

export async function searchVaultContext(
  rootPath: string,
  query: string,
  options: Omit<VaultContextOptions, 'query'> = {}
): Promise<VaultSearchResult[]> {
  const normalizedQuery = normalizeQuery(query)
  if (!normalizedQuery) {
    throw new Error('A non-empty search query is required')
  }

  const limit = normalizeLimit(options.limit ?? 50)
  const context = await buildVaultContext(rootPath, {
    ...options,
    query: normalizedQuery,
    limit: Math.max(limit, DEFAULT_VAULT_CONTEXT_LIMIT),
    maxChars: Math.max(options.maxChars ?? DEFAULT_VAULT_CONTEXT_MAX_CHARS, 12_000),
    includeDiagnostics: false
  })
  const results: VaultSearchResult[] = []

  for (const note of context.notes) {
    const match = scoreSearch(normalizedQuery, {
      title: note.title,
      path: note.path,
      tags: note.tags.join(' '),
      body: note.excerpt ?? ''
    })
    results.push({
      id: note.id,
      kind: 'note',
      path: note.path,
      title: note.title,
      snippet: note.excerpt ?? note.title,
      updatedAt: note.updatedAt,
      matchFields: match?.fields.length ? match.fields : ['content']
    })
  }

  for (const project of context.projects) {
    const match = scoreSearch(normalizedQuery, {
      title: project.name,
      path: project.path,
      description: project.description ?? '',
      tags: project.tags.join(' '),
      updates: project.updates.map((update) => update.content ?? '').join(' '),
      meetings: project.meetings.map((meeting) => meeting.content ?? '').join(' ')
    })
    results.push({
      id: project.id,
      kind: 'project',
      path: project.path,
      title: project.name,
      snippet:
        project.description ||
        project.updates.find((update) => update.content)?.content ||
        project.meetings.find((meeting) => meeting.content)?.content ||
        `${project.openTaskCount} open tasks`,
      updatedAt: project.updatedAt,
      matchFields: match?.fields.length ? match.fields : ['content']
    })
  }

  for (const task of context.tasks) {
    const match = scoreSearch(normalizedQuery, {
      title: task.title,
      path: task.path,
      description: task.description ?? '',
      tags: task.tags.join(' '),
      status: task.status
    })
    results.push({
      id: task.id,
      kind: 'task',
      path: task.path,
      title: task.title,
      snippet: task.description ?? `${task.status} · ${task.date ?? 'unscheduled'}`,
      updatedAt: task.updatedAt,
      matchFields: match?.fields.length ? match.fields : ['content'],
      ...(task.projectId ? { projectId: task.projectId } : {})
    })
  }

  for (const event of context.calendar.events) {
    const match = scoreSearch(normalizedQuery, {
      title: event.title,
      location: event.location ?? '',
      source: event.source,
      status: event.status ?? '',
      projectId: event.projectId ?? ''
    })
    results.push({
      id: event.id,
      kind: 'calendar',
      path: 'calendar/state.json',
      title: event.title,
      snippet: `${event.start} · ${event.source}${event.location ? ` · ${event.location}` : ''}`,
      updatedAt: event.updatedAt,
      matchFields: match?.fields.length ? match.fields : ['content'],
      ...(event.projectId ? { projectId: event.projectId } : {})
    })
  }

  for (const resource of context.resources) {
    const match = scoreSearch(normalizedQuery, {
      title: resource.title,
      uri: resource.uri,
      provider: resource.provider,
      state: resource.state
    })
    results.push({
      id: resource.id,
      kind: 'resource',
      title: resource.title,
      snippet: `${resource.provider} · ${resource.state} · ${resource.uri}`,
      updatedAt: resource.updatedAt,
      matchFields: match?.fields.length ? match.fields : ['content'],
      ...(resource.projectIds[0] ? { projectId: resource.projectIds[0] } : {})
    })
  }

  for (const subscription of context.subscriptions) {
    const match = scoreSearch(normalizedQuery, {
      title: subscription.name,
      provider: subscription.provider ?? '',
      category: subscription.category ?? '',
      tags: subscription.tags.join(' ')
    })
    results.push({
      id: subscription.id,
      kind: 'subscription',
      title: subscription.name,
      snippet: [subscription.category, subscription.status, subscription.nextRenewalAt]
        .filter(Boolean)
        .join(' · '),
      matchFields: match?.fields.length ? match.fields : ['content']
    })
  }

  return results
    .map((result) => ({ result, score: searchResultScore(result, normalizedQuery) }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        (right.result.updatedAt ?? '').localeCompare(left.result.updatedAt ?? '') ||
        left.result.title.localeCompare(right.result.title)
    )
    .slice(0, limit)
    .map(({ result }) => result)
}

export async function readVaultManifestReport(rootPath: string): Promise<VaultManifestReport> {
  const root = await assertReadableVaultRoot(rootPath)
  const report: VaultManifestReport = {
    path: VAULT_MANIFEST_RELATIVE_PATH,
    present: false,
    valid: false,
    checksum: null,
    manifest: null,
    errors: []
  }

  const systemPath = path.join(root, '.xingularity')
  const manifestPath = path.join(root, VAULT_MANIFEST_RELATIVE_PATH)
  let systemStats: import('node:fs').Stats
  try {
    systemStats = await fs.lstat(systemPath)
  } catch (error) {
    if (isMissingPathError(error)) return report
    throw error
  }
  if (systemStats.isSymbolicLink() || !systemStats.isDirectory()) {
    report.present = true
    report.errors.push('The .xingularity manifest directory must be a regular directory')
    return report
  }

  let manifestStats: import('node:fs').Stats
  try {
    manifestStats = await fs.lstat(manifestPath)
  } catch (error) {
    if (isMissingPathError(error)) return report
    throw error
  }
  report.present = true
  if (manifestStats.isSymbolicLink() || !manifestStats.isFile()) {
    report.errors.push('The vault manifest must be a regular file')
    return report
  }

  const read = await readBoundedTextFile(manifestPath, MAX_JSON_BYTES)
  if (read.truncated) {
    report.errors.push(`Vault manifest exceeds the ${MAX_JSON_BYTES}-byte safety limit`)
    return report
  }
  const raw = read.content
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    report.errors.push(`Vault manifest is not valid JSON: ${describeError(error)}`)
    return report
  }
  const validation = validateVaultManifest(parsed)
  if (!validation.valid || !validation.manifest) {
    report.errors.push(...validation.errors)
    return report
  }
  report.valid = true
  report.manifest = validation.manifest
  report.checksum = checksumVaultManifest(validation.manifest)
  return report
}

async function readNotes(
  root: string,
  warnings: string[]
): Promise<Array<VaultContextNote & { bodyText: string; absolutePath: string }>> {
  const files = await walkSafeFiles(root, 'notebooks', warnings)
  const notes: Array<VaultContextNote & { bodyText: string; absolutePath: string }> = []
  for (const file of files) {
    if (!isNotePath(file.relPath) || file.relPath.endsWith('.md.bak')) continue
    try {
      const read = await readBoundedTextFile(file.absolutePath, MAX_NOTE_BYTES)
      const parsed = parseNoteContent(read.content, file.relPath)
      notes.push({
        id: `note:${file.relPath.toLowerCase()}`,
        path: file.relPath,
        title: parsed.metadata.title,
        tags: parsed.metadata.tags,
        updatedAt: new Date(read.mtimeMs).toISOString(),
        size: read.size,
        ...(read.truncated ? { truncated: true } : {}),
        bodyText: parsed.bodyText,
        absolutePath: file.absolutePath
      })
    } catch (error) {
      warnings.push(`Unable to read note ${file.relPath}: ${describeError(error)}`)
    }
  }

  return notes
}

async function readProjects(root: string, warnings: string[]): Promise<ProjectRecord[]> {
  const files = await walkSafeFiles(root, 'projects', warnings)
  const projects: ProjectRecord[] = []
  for (const file of files) {
    if (
      !file.relPath.toLowerCase().endsWith('.json') ||
      path.basename(file.relPath) === 'index.json'
    ) {
      continue
    }
    const parsed = await readJsonFile(file, warnings, 'project')
    if (!isRecord(parsed)) continue
    const id = stringValue(parsed.id)
    const name = stringValue(parsed.name)
    if (!id || !name) {
      warnings.push(`Ignored project without id and name: ${file.relPath}`)
      continue
    }
    const updates = recordArray(parsed.updates).flatMap((item) => {
      const updateId = stringValue(item.id)
      if (!updateId) return []
      return [
        {
          id: updateId,
          ...(stringValue(item.status) ? { status: stringValue(item.status) } : {}),
          ...(stringValue(item.markdown) ? { content: stringValue(item.markdown) } : {}),
          ...(stringValue(item.updatedAt) ? { updatedAt: stringValue(item.updatedAt) } : {})
        }
      ]
    })
    const meetings = recordArray(parsed.meetings).flatMap((item) => {
      const meetingId = stringValue(item.id)
      if (!meetingId) return []
      return [
        {
          id: meetingId,
          ...(stringValue(item.type) ? { type: stringValue(item.type) } : {}),
          ...(stringValue(item.outcome) ? { outcome: stringValue(item.outcome) } : {}),
          ...(stringValue(item.markdown) ? { content: stringValue(item.markdown) } : {}),
          ...(stringValue(item.updatedAt) ? { updatedAt: stringValue(item.updatedAt) } : {})
        }
      ]
    })
    projects.push({
      id,
      path: file.relPath,
      name,
      description: stringValue(parsed.description) ?? stringValue(parsed.summary) ?? '',
      state: stringValue(parsed.state) ?? 'active',
      tags: stringArray(parsed.tags),
      ...(stringValue(parsed.startDate) ? { startDate: stringValue(parsed.startDate) } : {}),
      ...(stringValue(parsed.endDate) ? { endDate: stringValue(parsed.endDate) } : {}),
      ...(stringValue(parsed.folderPath) ? { folderPath: stringValue(parsed.folderPath) } : {}),
      updatedAt: stringValue(parsed.updatedAt) ?? new Date(file.mtimeMs).toISOString(),
      milestones: recordArray(parsed.milestones).flatMap((item) => {
        const milestoneId = stringValue(item.id)
        const title = stringValue(item.title)
        if (!milestoneId || !title) return []
        return [
          {
            id: milestoneId,
            title,
            ...(stringValue(item.endDate) ? { endDate: stringValue(item.endDate) } : {})
          }
        ]
      }),
      updates,
      meetings
    })
  }

  return projects
}

async function readTasks(root: string, warnings: string[]): Promise<TaskRecord[]> {
  const files = await walkSafeFiles(root, 'tasks', warnings)
  const candidates = files.filter(
    (file) => file.relPath.toLowerCase().endsWith('.json') && !file.relPath.endsWith('index.json')
  )
  const tasks: TaskRecord[] = []

  if (candidates.length > 0) {
    for (const file of candidates) {
      const parsed = await readJsonFile(file, warnings, 'task')
      if (isRecord(parsed)) {
        const task = normalizeTaskRecord(parsed, file)
        if (task) tasks.push(task)
      }
    }
  } else {
    for (const fallbackPath of ['calendar/tasks.json', 'tasks.json']) {
      const fallbackFile = await safeFileIfPresent(root, fallbackPath, warnings)
      if (!fallbackFile) continue
      warnings.push(`Using legacy task source: ${fallbackPath}`)
      const parsed = await readJsonFile(fallbackFile, warnings, 'task')
      const records = Array.isArray(parsed)
        ? parsed
        : isRecord(parsed)
          ? [...recordArray(parsed.tasks), ...recordArray(parsed.calendarTasks)]
          : []
      for (const item of records) {
        const task = normalizeTaskRecord(item, fallbackFile)
        if (task) tasks.push(task)
      }
      if (tasks.length > 0) break
    }
  }

  return tasks
}

async function readCalendar(
  root: string,
  options: NormalizedContextOptions,
  project: ProjectSelection,
  warnings: string[]
): Promise<{
  totalEvents: number
  events: VaultContextCalendarEvent[]
  connections: VaultContextCalendarConnection[]
  wasTruncated: boolean
}> {
  const stateSource = await safeFileIfPresent(root, 'calendar/state.json', warnings)
  const eventsSource = await safeFileIfPresent(root, 'calendar/events.json', warnings)
  const connectionsSource = await safeFileIfPresent(root, 'calendar/connections.json', warnings)
  const parsedState = stateSource
    ? await readJsonFile(stateSource, warnings, 'calendar state')
    : null
  const parsedEvents = eventsSource
    ? await readJsonFile(eventsSource, warnings, 'calendar events')
    : null
  const parsedConnections = connectionsSource
    ? await readJsonFile(connectionsSource, warnings, 'calendar connections')
    : null
  const state =
    isRecord(parsedState) && isRecord(parsedState.state) ? parsedState.state : parsedState
  const hasCanonicalEvents =
    isRecord(state) && (Array.isArray(state.events) || isRecord(state.events))
  const fallbackEvents = hasCanonicalEvents
    ? collectionRecords(state.events)
    : collectionRecords(parsedEvents)
  const hasCanonicalConnections =
    isRecord(state) && (Array.isArray(state.connections) || isRecord(state.connections))
  const fallbackConnections = hasCanonicalConnections
    ? collectionRecords(state.connections)
    : collectionRecords(parsedConnections)
  const fallbackUpdatedAt = new Date(
    (stateSource ?? eventsSource ?? connectionsSource)?.mtimeMs ?? Date.now()
  ).toISOString()
  const events = fallbackEvents.flatMap((event) => {
    const id = stringValue(event.id)
    const title = stringValue(event.title)
    const start = stringValue(event.start)
    const end = stringValue(event.end) ?? start
    if (!id || !title || !start || !end) return []
    const projectId = stringValue(event.projectId)
    if (project.requested && (!project.id || projectId !== project.id)) return []
    if (
      options.query &&
      !scoreSearch(options.query, {
        title,
        description: stringValue(event.description) ?? '',
        location: stringValue(event.location) ?? '',
        source: stringValue(event.source) ?? '',
        status: stringValue(event.status) ?? ''
      })
    )
      return []
    return [
      {
        id,
        title: truncateText(title, 300),
        allDay: event.allDay === true,
        start,
        end,
        source: stringValue(event.source) ?? 'local',
        ...(stringValue(event.status) ? { status: stringValue(event.status) } : {}),
        ...(stringValue(event.location)
          ? { location: truncateText(stringValue(event.location), 500) }
          : {}),
        ...(projectId ? { projectId } : {}),
        updatedAt: stringValue(event.updatedAt) ?? fallbackUpdatedAt
      }
    ]
  })
  const connections = fallbackConnections.flatMap((connection) => {
    const id = stringValue(connection.id)
    const name = stringValue(connection.accountLabel) ?? stringValue(connection.name)
    const status = stringValue(connection.status)
    if (!id || !name || !status) return []
    return [
      {
        id,
        provider: stringValue(connection.provider) ?? 'unknown',
        name: truncateText(name, 200),
        status,
        selectedCalendarIds: stringArray(connection.selectedCalendarIds).slice(0, 50),
        ...(stringValue(connection.lastSyncAt)
          ? { lastSyncAt: stringValue(connection.lastSyncAt) }
          : {})
      }
    ]
  })
  const limitedEvents = events
    .sort((left, right) => left.start.localeCompare(right.start))
    .slice(0, options.limit)
  const limitedConnections = connections.slice(0, options.limit)
  return {
    totalEvents: fallbackEvents.length,
    events: limitedEvents,
    connections: limitedConnections,
    wasTruncated:
      events.length > limitedEvents.length || connections.length > limitedConnections.length
  }
}

async function readWeeklyPlan(
  root: string,
  options: NormalizedContextOptions,
  project: ProjectSelection,
  budget: ContentBudget,
  warnings: string[]
): Promise<VaultContextWeeklyPlan> {
  const source =
    (await safeFileIfPresent(root, 'weekly-plan/state.json', warnings)) ??
    (await safeFileIfPresent(root, 'weekly-plan.json', warnings))
  if (!source) return { weeks: [], totalWeeks: 0, totalPriorities: 0, totalReviews: 0 }
  if (source.relPath === 'weekly-plan.json')
    warnings.push('Using legacy weekly plan source: weekly-plan.json')
  const parsed = await readJsonFile(source, warnings, 'weekly plan')
  if (!isRecord(parsed)) return { weeks: [], totalWeeks: 0, totalPriorities: 0, totalReviews: 0 }
  const priorities = recordArray(parsed.priorities)
  const reviews = recordArray(parsed.reviews)
  const weeks = recordArray(parsed.weeks).flatMap((week) => {
    const id = stringValue(week.id)
    const startDate = stringValue(week.startDate)
    const endDate = stringValue(week.endDate)
    if (!id || !startDate || !endDate) return []
    const weekPriorities = priorities
      .filter((priority) => stringValue(priority.weekId) === id)
      .filter((priority) => {
        if (!project.requested) return true
        return Boolean(project.id && stringValue(priority.linkedProjectId) === project.id)
      })
      .map((priority) => ({
        id: stringValue(priority.id) ?? `priority:${id}:${stringValue(priority.title) ?? ''}`,
        title: stringValue(priority.title) ?? 'Untitled priority',
        status: stringValue(priority.status) ?? 'planned',
        order: numberValue(priority.order) ?? 0,
        ...(stringValue(priority.linkedProjectId)
          ? { linkedProjectId: stringValue(priority.linkedProjectId) }
          : {}),
        ...(stringValue(priority.linkedTaskId)
          ? { linkedTaskId: stringValue(priority.linkedTaskId) }
          : {})
      }))
      .sort((left, right) => left.order - right.order)
    const review = reviews.find((item) => stringValue(item.weekId) === id)
    const searchable = [
      stringValue(week.focus),
      ...weekPriorities.map((priority) => priority.title),
      review ? stringValue(review.wins) : undefined,
      review ? stringValue(review.misses) : undefined,
      review ? stringValue(review.blockers) : undefined,
      review ? stringValue(review.nextWeek) : undefined
    ]
    if (
      options.query &&
      !scoreSearch(options.query, { content: searchable.filter(Boolean).join(' ') })
    ) {
      return []
    }
    return [
      {
        id,
        startDate,
        endDate,
        ...(budget.take(stringValue(week.focus), 800) ? { focus: budget.last } : {}),
        priorities: weekPriorities.slice(0, options.limit),
        ...(review
          ? {
              review: {
                ...(budget.take(stringValue(review.wins), 700) ? { wins: budget.last } : {}),
                ...(budget.take(stringValue(review.misses), 700) ? { misses: budget.last } : {}),
                ...(budget.take(stringValue(review.blockers), 700)
                  ? { blockers: budget.last }
                  : {}),
                ...(budget.take(stringValue(review.nextWeek), 700) ? { nextWeek: budget.last } : {})
              }
            }
          : {})
      }
    ]
  })

  return {
    weeks: weeks
      .sort((left, right) => right.startDate.localeCompare(left.startDate))
      .slice(0, options.limit),
    totalWeeks: weeks.length,
    totalPriorities: priorities.length,
    totalReviews: reviews.length
  }
}

async function readResources(
  root: string,
  options: NormalizedContextOptions,
  project: ProjectSelection,
  warnings: string[]
): Promise<{
  total: number
  resources: VaultContextResource[]
  relations: VaultContextBundle['resourceRelations']
  wasTruncated: boolean
}> {
  const resourceFile = await safeFileIfPresent(root, 'resources/resources.json', warnings)
  const relationFile = await safeFileIfPresent(root, 'resources/relations.json', warnings)
  const parsedResources = resourceFile
    ? await readJsonFile(resourceFile, warnings, 'resources')
    : null
  const parsedRelations = relationFile
    ? await readJsonFile(relationFile, warnings, 'resource relations')
    : null
  const rawResources = isRecord(parsedResources) ? recordArray(parsedResources.resources) : []
  const resources = rawResources.flatMap((resource) => {
    const id = stringValue(resource.id)
    const title = stringValue(resource.title)
    const uri = stringValue(resource.canonicalUri)
    if (!id || !title || !uri) return []
    const projectIds = stringArray(resource.projectIds)
    if (project.requested && (!project.id || !projectIds.includes(project.id))) return []
    if (
      options.query &&
      !scoreSearch(options.query, {
        title,
        uri: safeResourceUri(uri),
        provider: stringValue(resource.provider) ?? '',
        state: stringValue(resource.state) ?? ''
      })
    )
      return []
    return [
      {
        id,
        title,
        provider: stringValue(resource.provider) ?? 'unknown',
        kind: stringValue(resource.kind) ?? 'external',
        uri: safeResourceUri(uri),
        state: stringValue(resource.state) ?? 'unknown',
        access: stringValue(resource.access) ?? 'unknown',
        projectIds,
        updatedAt: stringValue(resource.updatedAt) ?? '',
        ...(stringValue(resource.lastSeenAt)
          ? { lastSeenAt: stringValue(resource.lastSeenAt) }
          : {}),
        ...(stringValue(resource.freshness) ? { freshness: stringValue(resource.freshness) } : {})
      }
    ]
  })
  const rawRelations = isRecord(parsedRelations) ? recordArray(parsedRelations.relations) : []
  const resourceIds = new Set(resources.map((resource) => resource.id))
  const relations = rawRelations.flatMap((relation) => {
    const id = stringValue(relation.id)
    const fromId = stringValue(relation.fromId)
    const toId = stringValue(relation.toId)
    const type = stringValue(relation.type)
    if (!id || !fromId || !toId || !type || (!resourceIds.has(fromId) && !resourceIds.has(toId)))
      return []
    return [
      {
        id,
        type,
        fromId,
        toId,
        ...(stringValue(relation.confidence)
          ? { confidence: stringValue(relation.confidence) }
          : {}),
        ...(stringValue(relation.note) ? { note: stringValue(relation.note) } : {})
      }
    ]
  })
  return {
    total: rawResources.length,
    resources: resources.slice(0, options.limit),
    relations: relations.slice(0, options.limit * 2),
    wasTruncated: resources.length > options.limit || relations.length > options.limit * 2
  }
}

async function readSubscriptions(
  root: string,
  options: NormalizedContextOptions,
  warnings: string[]
): Promise<{ total: number; records: VaultContextSubscription[]; wasTruncated: boolean }> {
  const source = await safeFileIfPresent(root, 'subscriptions/data.json', warnings)
  const parsed = source ? await readJsonFile(source, warnings, 'subscriptions') : null
  const rawRecords = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed)
      ? recordArray(parsed.records)
      : []
  const records = rawRecords.flatMap((record) => {
    const id = stringValue(record.id)
    const name = stringValue(record.name)
    if (!id || !name) return []
    if (
      options.query &&
      !scoreSearch(options.query, {
        name,
        provider: stringValue(record.provider) ?? '',
        category: stringValue(record.category) ?? '',
        tags: stringArray(record.tags).join(' '),
        notes: stringValue(record.notes) ?? ''
      })
    )
      return []
    return [
      {
        id,
        name,
        ...(stringValue(record.provider) ? { provider: stringValue(record.provider) } : {}),
        ...(stringValue(record.category) ? { category: stringValue(record.category) } : {}),
        ...(numberValue(record.amount) !== undefined ? { amount: numberValue(record.amount) } : {}),
        ...(stringValue(record.currency) ? { currency: stringValue(record.currency) } : {}),
        ...(stringValue(record.billingCycle)
          ? { billingCycle: stringValue(record.billingCycle) }
          : {}),
        ...(stringValue(record.nextRenewalAt)
          ? { nextRenewalAt: stringValue(record.nextRenewalAt) }
          : {}),
        ...(stringValue(record.status) ? { status: stringValue(record.status) } : {}),
        ...(stringValue(record.reviewFlag) ? { reviewFlag: stringValue(record.reviewFlag) } : {}),
        tags: stringArray(record.tags).slice(0, 20)
      }
    ]
  })
  return {
    total: rawRecords.length,
    records: records.slice(0, options.limit),
    wasTruncated: records.length > options.limit
  }
}

async function readSchedules(
  root: string,
  options: NormalizedContextOptions,
  warnings: string[]
): Promise<{ total: number; records: VaultContextSchedule[]; wasTruncated: boolean }> {
  const jobsSource = await safeFileIfPresent(root, 'schedules/jobs.json', warnings)
  const runsSource = await safeFileIfPresent(root, 'schedules/runs.json', warnings)
  const parsedJobs = jobsSource ? await readJsonFile(jobsSource, warnings, 'schedules') : null
  const parsedRuns = runsSource ? await readJsonFile(runsSource, warnings, 'schedule runs') : null
  const rawJobs = Array.isArray(parsedJobs)
    ? parsedJobs
    : isRecord(parsedJobs)
      ? recordArray(parsedJobs.jobs)
      : []
  const rawRuns = Array.isArray(parsedRuns)
    ? parsedRuns
    : isRecord(parsedRuns)
      ? recordArray(parsedRuns.runs)
      : []
  const records = rawJobs.flatMap((job) => {
    const id = stringValue(job.id)
    const name = stringValue(job.name) ?? stringValue(job.title)
    if (!id || !name) return []
    if (
      options.query &&
      !scoreSearch(options.query, {
        name,
        runtime: stringValue(job.runtime) ?? '',
        trigger: formatScheduleTrigger(job.trigger) ?? ''
      })
    )
      return []
    const latestRun = rawRuns
      .filter((run) => stringValue(run.jobId) === id || stringValue(run.scheduleId) === id)
      .sort((left, right) =>
        (stringValue(right.startedAt) ?? '').localeCompare(stringValue(left.startedAt) ?? '')
      )[0]
    return [
      {
        id,
        name: truncateText(name, 200),
        ...(typeof job.enabled === 'boolean' ? { enabled: job.enabled } : {}),
        ...(stringValue(job.runtime) ? { runtime: stringValue(job.runtime) } : {}),
        ...(formatScheduleTrigger(job.trigger)
          ? { trigger: formatScheduleTrigger(job.trigger) }
          : {}),
        permissions: stringArray(job.permissions).slice(0, 20),
        ...(latestRun
          ? {
              latestRun: {
                ...(stringValue(latestRun.status) ? { status: stringValue(latestRun.status) } : {}),
                ...(stringValue(latestRun.startedAt)
                  ? { startedAt: stringValue(latestRun.startedAt) }
                  : {}),
                ...(stringValue(latestRun.endedAt)
                  ? { endedAt: stringValue(latestRun.endedAt) }
                  : {})
              }
            }
          : {})
      }
    ]
  })
  return {
    total: rawJobs.length,
    records: records.slice(0, options.limit),
    wasTruncated: records.length > options.limit
  }
}

async function readAgentContext(
  root: string,
  options: NormalizedContextOptions,
  warnings: string[]
): Promise<{
  totalRuns: number
  totalSessions: number
  runs: VaultContextAgentRun[]
  sessions: VaultContextBundle['agent']['sessions']
  wasTruncated: boolean
}> {
  const runsSource = await safeFileIfPresent(root, 'agent/runs.json', warnings)
  const chatsSource = await safeFileIfPresent(root, 'agent/chats.json', warnings)
  const parsedRuns = runsSource ? await readJsonFile(runsSource, warnings, 'agent runs') : null
  const parsedChats = chatsSource ? await readJsonFile(chatsSource, warnings, 'agent chats') : null
  const rawRuns = Array.isArray(parsedRuns) ? parsedRuns : []
  const rawChats = Array.isArray(parsedChats) ? parsedChats : []
  const runs = rawRuns
    .flatMap((run) => {
      const id = stringValue(run.id)
      if (!id) return []
      return [
        {
          id,
          ...(stringValue(run.agentName) ? { agentName: stringValue(run.agentName) } : {}),
          ...(stringValue(run.source) ? { source: stringValue(run.source) } : {}),
          ...(stringValue(run.status) ? { status: stringValue(run.status) } : {}),
          ...(stringValue(run.startedAt) ? { startedAt: stringValue(run.startedAt) } : {}),
          ...(stringValue(run.endedAt) ? { endedAt: stringValue(run.endedAt) } : {}),
          ...(stringValue(run.model) ? { model: stringValue(run.model) } : {})
        }
      ]
    })
    .sort((left, right) => (right.startedAt ?? '').localeCompare(left.startedAt ?? ''))
    .slice(0, options.limit)
  const sessions = rawChats
    .flatMap((session) => {
      const id = stringValue(session.id)
      const title = stringValue(session.title)
      if (!id || !title) return []
      return [
        {
          id,
          title: truncateText(title, 200),
          ...(stringValue(session.updatedAt) ? { updatedAt: stringValue(session.updatedAt) } : {}),
          messageCount: Array.isArray(session.messages) ? session.messages.length : 0
        }
      ]
    })
    .sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''))
    .slice(0, options.limit)
  return {
    totalRuns: rawRuns.length,
    totalSessions: rawChats.length,
    runs,
    sessions,
    wasTruncated: rawRuns.length > runs.length || rawChats.length > sessions.length
  }
}

async function readRecoveryContext(
  root: string,
  warnings: string[]
): Promise<VaultContextRecoverySummary> {
  try {
    const store = new VaultRecoveryStore(path.join(root, '.xingularity'))
    const [conflicts, quarantine] = await Promise.all([
      store.listConflicts(),
      store.listQuarantine()
    ])
    return {
      conflicts: conflicts.map((record) => summarizeConflict(record)),
      quarantine: quarantine.map((record) => summarizeQuarantine(record))
    }
  } catch (error) {
    warnings.push(`Recovery status unavailable: ${describeError(error)}`)
    return { conflicts: [], quarantine: [] }
  }
}

function toContextNote(
  note: VaultContextNote & { bodyText: string; absolutePath: string },
  budget: ContentBudget,
  query?: string
): VaultContextNote {
  const excerpt = budget.take(excerptAroundQuery(note.bodyText, query, 4_000), 4_000)
  const excerptTruncated = budget.lastWasTruncated
  return {
    id: note.id,
    path: note.path,
    title: truncateText(note.title, 300),
    tags: note.tags.slice(0, 50),
    updatedAt: note.updatedAt,
    size: note.size,
    ...(excerpt ? { excerpt } : {}),
    ...(note.truncated || excerptTruncated ? { truncated: true } : {})
  }
}

function toContextProject(
  project: ProjectRecord,
  tasks: TaskRecord[],
  budget: ContentBudget
): VaultContextProjectEntry {
  const projectTasks = tasks.filter((task) => task.projectId === project.id)
  return {
    id: project.id,
    path: project.path,
    name: truncateText(project.name, 300),
    ...(budget.take(project.description, 1_000) ? { description: budget.last } : {}),
    state: project.state,
    tags: project.tags.slice(0, 50),
    ...(project.startDate ? { startDate: project.startDate } : {}),
    ...(project.endDate ? { endDate: project.endDate } : {}),
    ...(project.folderPath ? { folderPath: project.folderPath } : {}),
    updatedAt: project.updatedAt,
    taskCount: projectTasks.length,
    openTaskCount: projectTasks.filter((task) => !task.completed).length,
    milestones: project.milestones.slice(0, 30).map((milestone) => ({
      id: milestone.id,
      title: truncateText(milestone.title, 300),
      ...(milestone.endDate ? { endDate: milestone.endDate } : {})
    })),
    updates: project.updates.slice(0, 5).map((update) => ({
      id: update.id,
      ...(update.status ? { status: update.status } : {}),
      ...(budget.take(update.content, 800) ? { content: budget.last } : {}),
      ...(update.updatedAt ? { updatedAt: update.updatedAt } : {})
    })),
    meetings: project.meetings.slice(0, 5).map((meeting) => ({
      id: meeting.id,
      ...(meeting.type ? { type: meeting.type } : {}),
      ...(meeting.outcome ? { outcome: meeting.outcome } : {}),
      ...(budget.take(meeting.content, 800) ? { content: budget.last } : {}),
      ...(meeting.updatedAt ? { updatedAt: meeting.updatedAt } : {})
    }))
  }
}

function toContextTask(task: TaskRecord, budget: ContentBudget): VaultContextTask {
  return {
    id: task.id,
    path: task.path,
    title: truncateText(task.title, 300),
    ...(budget.take(task.description, 800) ? { description: budget.last } : {}),
    status: task.status,
    completed: task.completed,
    ...(task.priority ? { priority: task.priority } : {}),
    ...(task.taskType ? { taskType: task.taskType } : {}),
    ...(task.projectId ? { projectId: task.projectId } : {}),
    ...(task.milestoneId ? { milestoneId: task.milestoneId } : {}),
    tags: task.tags.slice(0, 50),
    ...(task.date ? { date: task.date } : {}),
    ...(task.endDate ? { endDate: task.endDate } : {}),
    ...(task.time ? { time: task.time } : {}),
    ...(task.endTime ? { endTime: task.endTime } : {}),
    updatedAt: task.updatedAt
  }
}

function normalizeTaskRecord(raw: unknown, file: SafeFile): TaskRecord | null {
  if (!isRecord(raw)) return null
  const id = stringValue(raw.id)
  const title = stringValue(raw.title)
  if (!id || !title) return null
  const status = stringValue(raw.status) ?? (raw.completed === true ? 'completed' : 'pending')
  const completed = isTaskDone({
    status: status as import('../shared/types').TaskStatus,
    completed: raw.completed === true
  })
  return {
    id,
    path: file.relPath,
    title,
    ...(stringValue(raw.description) ? { description: stringValue(raw.description) } : {}),
    status,
    completed,
    ...(stringValue(raw.priority) ? { priority: stringValue(raw.priority) } : {}),
    ...(stringValue(raw.taskType) ? { taskType: stringValue(raw.taskType) } : {}),
    ...(stringValue(raw.projectId) ? { projectId: stringValue(raw.projectId) } : {}),
    ...(stringValue(raw.milestoneId) ? { milestoneId: stringValue(raw.milestoneId) } : {}),
    tags: stringArray(raw.tags),
    ...(stringValue(raw.date) ? { date: stringValue(raw.date) } : {}),
    ...(stringValue(raw.endDate) ? { endDate: stringValue(raw.endDate) } : {}),
    ...(stringValue(raw.time) ? { time: stringValue(raw.time) } : {}),
    ...(stringValue(raw.endTime) ? { endTime: stringValue(raw.endTime) } : {}),
    updatedAt: stringValue(raw.updatedAt) ?? new Date(file.mtimeMs).toISOString()
  }
}

function resolveProjectSelection(
  projects: ProjectRecord[],
  requested: string | undefined,
  warnings: string[]
): ProjectSelection {
  if (!requested) return {}
  const normalized = requested.trim().toLowerCase()
  const matches = projects.filter(
    (project) =>
      project.id.toLowerCase() === normalized || project.name.trim().toLowerCase() === normalized
  )
  if (matches.length === 1) {
    return {
      requested,
      id: matches[0].id,
      name: matches[0].name,
      folderPath: matches[0].folderPath
    }
  }
  if (matches.length > 1) {
    warnings.push(`Project selector is ambiguous: ${requested}`)
  } else {
    warnings.push(`Project not found: ${requested}`)
  }
  return { requested }
}

function matchesProjectSelection(
  project: ProjectRecord,
  selection: ProjectSelection,
  options: NormalizedContextOptions
): boolean {
  if (selection.requested) return project.id === selection.id
  if (!options.query) return true
  return Boolean(scoreSearch(options.query, projectSearchFields(project)))
}

function matchesTaskSelection(
  task: TaskRecord,
  options: NormalizedContextOptions,
  project: ProjectSelection
): boolean {
  if (project.requested && (!project.id || task.projectId !== project.id)) return false
  if (!options.query) return true
  return Boolean(
    scoreSearch(options.query, {
      title: task.title,
      path: task.path,
      description: task.description ?? '',
      tags: task.tags.join(' '),
      status: task.status
    })
  )
}

function matchesNoteSelection(
  note: VaultContextNote & { bodyText: string; absolutePath: string },
  options: NormalizedContextOptions,
  project: ProjectSelection,
  projects: ProjectRecord[]
): boolean {
  if (options.note && normalizeNotePath(options.note) !== note.path) return false
  if (project.requested) {
    if (!project.id) return false
    const selected = projects.find((item) => item.id === project.id)
    const folderPath = selected?.folderPath
      ?.replace(/\\/g, '/')
      .replace(/^\/+|\/+$/g, '')
      .replace(/^notebooks\//i, '')
    const projectSlug = selected?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const lowerPath = note.path.toLowerCase()
    const isInFolder = folderPath
      ? lowerPath.startsWith(`notebooks/${folderPath.toLowerCase()}/`)
      : false
    const isNamedForProject = Boolean(
      projectSlug && lowerPath.includes(`/${projectSlug.toLowerCase()}`)
    )
    if (!isInFolder && !isNamedForProject) return false
  }
  if (!options.query) return true
  return Boolean(
    scoreSearch(options.query, {
      title: note.title,
      path: note.path,
      tags: note.tags.join(' '),
      body: note.bodyText
    })
  )
}

function compareTasks(left: TaskRecord, right: TaskRecord): number {
  if (left.completed !== right.completed) return left.completed ? 1 : -1
  const leftDate = left.date ?? '9999-99-99'
  const rightDate = right.date ?? '9999-99-99'
  return leftDate.localeCompare(rightDate) || right.updatedAt.localeCompare(left.updatedAt)
}

function projectSearchFields(project: ProjectRecord): Record<string, string> {
  return {
    title: project.name,
    path: project.path,
    description: project.description,
    tags: project.tags.join(' '),
    updates: project.updates.map((update) => update.content ?? '').join(' '),
    meetings: project.meetings.map((meeting) => meeting.content ?? '').join(' ')
  }
}

function scoreSearch(
  query: string,
  fields: Record<string, string>
): { score: number; fields: string[] } | null {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const matches = Object.entries(fields).flatMap(([field, value]) => {
    if (!value.toLocaleLowerCase().includes(normalizedQuery)) return []
    return [field]
  })
  return matches.length ? { score: matches.length, fields: matches } : null
}

function searchResultScore(result: VaultSearchResult, query: string): number {
  const normalizedQuery = query.toLocaleLowerCase()
  const normalizedTitle = result.title.toLocaleLowerCase()
  const exactTitleMatch = normalizedTitle === normalizedQuery
  const titleMatch = normalizedTitle.includes(normalizedQuery)
  return result.matchFields.length + (exactTitleMatch ? 20 : titleMatch ? 10 : 0)
}

function formatScheduleTrigger(value: unknown): string | undefined {
  if (typeof value === 'string') return truncateText(value, 300)
  if (!isRecord(value)) return undefined
  const type = stringValue(value.type)
  if (!type) return undefined
  const details = [
    stringValue(value.time),
    stringValue(value.timezone),
    numberValue(value.intervalMinutes) !== undefined
      ? `every ${numberValue(value.intervalMinutes)} minutes`
      : undefined,
    stringValue(value.expression)
  ].filter(Boolean)
  return truncateText([type, ...details].join(' · '), 300)
}

async function readSchemaVersion(
  root: string,
  manifest: VaultManifestReport,
  warnings: string[]
): Promise<number> {
  if (manifest.manifest?.schemaVersion) return manifest.manifest.schemaVersion
  for (const relativePath of ['migrations.json', 'vault.json']) {
    const file = await safeFileIfPresent(root, relativePath, warnings)
    if (!file) continue
    const parsed = await readJsonFile(file, warnings, 'vault metadata')
    if (isRecord(parsed) && Number.isInteger(parsed.version) && Number(parsed.version) >= 1) {
      return Number(parsed.version)
    }
  }
  return 1
}

async function readJsonFile(file: SafeFile, warnings: string[], label: string): Promise<unknown> {
  try {
    const read = await readBoundedTextFile(file.absolutePath, MAX_JSON_BYTES)
    if (read.truncated) {
      warnings.push(`Ignored oversized ${label} file: ${file.relPath}`)
      return null
    }
    return JSON.parse(read.content) as unknown
  } catch (error) {
    warnings.push(`Unable to read ${label} file ${file.relPath}: ${describeError(error)}`)
    return null
  }
}

async function safeFileIfPresent(
  root: string,
  relativePath: string,
  warnings: string[]
): Promise<SafeFile | null> {
  try {
    const absolutePath = await resolveSafeFile(root, relativePath)
    const stats = await fs.stat(absolutePath)
    return {
      relPath: normalizeRelativePath(relativePath),
      absolutePath,
      size: stats.size,
      mtimeMs: stats.mtimeMs
    }
  } catch (error) {
    if (isMissingPathError(error)) return null
    warnings.push(`Skipped unsafe vault path ${relativePath}: ${describeError(error)}`)
    return null
  }
}

async function walkSafeFiles(
  root: string,
  relativeRoot: string,
  warnings: string[]
): Promise<SafeFile[]> {
  const files: SafeFile[] = []
  const absoluteRoot = path.resolve(root, relativeRoot)
  await walkSafeDirectory(root, absoluteRoot, normalizeRelativePath(relativeRoot), files, warnings)
  if (files.length >= MAX_SOURCE_FILES) {
    warnings.push(
      `Vault context limited to the first ${MAX_SOURCE_FILES} files under ${relativeRoot}`
    )
  }
  return files.slice(0, MAX_SOURCE_FILES)
}

async function walkSafeDirectory(
  _root: string,
  directoryPath: string,
  relativeDirectory: string,
  files: SafeFile[],
  warnings: string[]
): Promise<void> {
  if (files.length >= MAX_SOURCE_FILES) return
  let stats: import('node:fs').Stats
  try {
    stats = await fs.lstat(directoryPath)
  } catch (error) {
    if (!isMissingPathError(error))
      warnings.push(`Unable to inspect ${relativeDirectory}: ${describeError(error)}`)
    return
  }
  if (stats.isSymbolicLink()) {
    warnings.push(`Skipped symbolic link: ${relativeDirectory}`)
    return
  }
  if (stats.isFile()) {
    files.push({
      relPath: relativeDirectory,
      absolutePath: directoryPath,
      size: stats.size,
      mtimeMs: stats.mtimeMs
    })
    return
  }
  if (!stats.isDirectory()) return

  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(directoryPath, { withFileTypes: true })
  } catch (error) {
    warnings.push(`Unable to inspect ${relativeDirectory}: ${describeError(error)}`)
    return
  }
  entries.sort((left, right) => left.name.localeCompare(right.name))
  for (const entry of entries) {
    if (files.length >= MAX_SOURCE_FILES) return
    const childPath = path.join(directoryPath, entry.name)
    const childRelative = normalizeRelativePath(path.posix.join(relativeDirectory, entry.name))
    if (entry.isSymbolicLink()) {
      warnings.push(`Skipped symbolic link: ${childRelative}`)
      continue
    }
    if (entry.isDirectory()) {
      await walkSafeDirectory(_root, childPath, childRelative, files, warnings)
      continue
    }
    if (entry.isFile()) {
      const childStats = await fs.stat(childPath).catch(() => null)
      if (childStats) {
        files.push({
          relPath: childRelative,
          absolutePath: childPath,
          size: childStats.size,
          mtimeMs: childStats.mtimeMs
        })
      }
    }
  }
}

async function resolveSafeFile(root: string, relativePath: string): Promise<string> {
  const safeRelativePath = assertSafeRelativePath(relativePath)
  const parts = safeRelativePath.split('/')
  let current = path.resolve(root)
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part)
    const stats = await fs.lstat(current)
    if (stats.isSymbolicLink()) {
      throw new Error(`Symbolic links are not accepted in vault context paths: ${safeRelativePath}`)
    }
    if (index < parts.length - 1 && !stats.isDirectory()) {
      throw new Error(`Vault context path is not a directory: ${safeRelativePath}`)
    }
    if (index === parts.length - 1 && !stats.isFile()) {
      throw new Error(`Vault context path is not a regular file: ${safeRelativePath}`)
    }
  }
  return current
}

async function readBoundedTextFile(filePath: string, maxBytes: number): Promise<BoundedFileRead> {
  const handle = await fs.open(filePath, 'r')
  try {
    const stats = await handle.stat()
    const buffer = Buffer.alloc(Math.max(1, maxBytes + 1))
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    const truncated = bytesRead > maxBytes
    return {
      content: buffer.subarray(0, Math.min(bytesRead, maxBytes)).toString('utf8'),
      size: stats.size,
      mtimeMs: stats.mtimeMs,
      truncated
    }
  } finally {
    await handle.close()
  }
}

async function assertReadableVaultRoot(rootPath: string): Promise<string> {
  const root = path.resolve(rootPath)
  const stats = await fs.lstat(root)
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`Vault root must be a regular directory: ${root}`)
  }
  return root
}

function normalizeContextOptions(options: VaultContextOptions): NormalizedContextOptions {
  return {
    query: normalizeQuery(options.query),
    project: normalizeOptionalString(options.project),
    note: options.note ? normalizeNotePath(options.note) : undefined,
    limit: normalizeLimit(options.limit),
    maxChars: normalizeMaxChars(options.maxChars),
    includeDiagnostics: options.includeDiagnostics !== false
  }
}

interface NormalizedContextOptions {
  query?: string
  project?: string
  note?: string
  limit: number
  maxChars: number
  includeDiagnostics: boolean
}

function normalizeLimit(value: number | undefined): number {
  if (value === undefined) return DEFAULT_VAULT_CONTEXT_LIMIT
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_VAULT_CONTEXT_LIMIT) {
    throw new Error(`Context limit must be an integer between 1 and ${MAX_VAULT_CONTEXT_LIMIT}`)
  }
  return value
}

function normalizeMaxChars(value: number | undefined): number {
  if (value === undefined) return DEFAULT_VAULT_CONTEXT_MAX_CHARS
  if (!Number.isSafeInteger(value) || value < 1_000 || value > MAX_VAULT_CONTEXT_MAX_CHARS) {
    throw new Error(
      `Context maxChars must be an integer between 1000 and ${MAX_VAULT_CONTEXT_MAX_CHARS}`
    )
  }
  return value
}

function normalizeQuery(value: string | undefined): string | undefined {
  const normalized = normalizeOptionalString(value)
  return normalized ? normalized.slice(0, 200) : undefined
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

function normalizeNotePath(input: string): string {
  const safe = assertSafeRelativePath(input.trim())
  const normalized = safe.toLowerCase().startsWith('notebooks/') ? safe : `notebooks/${safe}`
  if (!normalized.startsWith('notebooks/') || !isNotePath(normalized)) {
    throw new Error('Only Markdown notes inside notebooks/ can be read as vault context')
  }
  return normalizeRelativePath(normalized)
}

function normalizeRelativePath(input: string): string {
  return input.replace(/\\/g, '/').replace(/^\.\//, '')
}

function truncateText(value: string | undefined, maxChars: number): string {
  const normalized = value?.trim() ?? ''
  if (!normalized || maxChars <= 0) return ''
  if (normalized.length <= maxChars) return normalized
  if (maxChars === 1) return '…'
  return `${normalized.slice(0, maxChars - 1).trimEnd()}…`
}

function excerptAroundQuery(value: string, query: string | undefined, maxChars: number): string {
  if (!query) return value
  const normalizedValue = value.toLocaleLowerCase()
  const normalizedQuery = query.toLocaleLowerCase()
  const matchIndex = normalizedValue.indexOf(normalizedQuery)
  if (matchIndex <= 0 || value.length <= maxChars) return value
  const before = Math.min(Math.floor(maxChars / 3), matchIndex)
  const start = matchIndex - before
  return value.slice(start, start + maxChars)
}

class ContentBudget {
  private remaining: number
  private _last = ''
  private _lastWasTruncated = false
  truncated = false

  constructor(readonly max: number) {
    this.remaining = max
  }

  get used(): number {
    return this.max - this.remaining
  }

  get last(): string {
    return this._last
  }

  get lastWasTruncated(): boolean {
    return this._lastWasTruncated
  }

  take(value: string | undefined, preferredMax: number): string {
    const normalized = value?.trim() ?? ''
    this._lastWasTruncated = false
    if (!normalized || this.remaining <= 0) {
      this._last = ''
      if (normalized) {
        this.truncated = true
        this._lastWasTruncated = true
      }
      return ''
    }
    const allowed = Math.min(preferredMax, this.remaining)
    const output = truncateText(normalized, allowed)
    this._last = output
    this.remaining -= output.length
    if (output.length < normalized.length) {
      this.truncated = true
      this._lastWasTruncated = true
    }
    return output
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function collectionRecords(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return recordArray(value)
  return isRecord(value) ? recordArray(value.records) : []
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function safeResourceUri(value: string): string {
  try {
    const parsed = new URL(value)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      parsed.username = ''
      parsed.password = ''
      parsed.search = ''
      parsed.hash = ''
      return parsed.toString()
    }
    if (parsed.protocol === 'file:') {
      return '[local file]'
    }
  } catch {
    return isLikelyLocalPath(value) ? '[local file]' : truncateText(value, 1_000)
  }
  return isLikelyLocalPath(value) ? '[local file]' : truncateText(value, 1_000)
}

function isLikelyLocalPath(value: string): boolean {
  return value.startsWith('/') || value.startsWith('\\\\') || /^[a-zA-Z]:[\\/]/.test(value)
}

function summarizeIssueCounts(
  issues: Array<{ severity: 'error' | 'warning' | 'info' }>
): VaultContextBundle['health']['issueCounts'] {
  return issues.reduce(
    (counts, issue) => {
      counts.total += 1
      if (issue.severity === 'error') counts.errors += 1
      else if (issue.severity === 'warning') counts.warnings += 1
      else counts.info += 1
      return counts
    },
    { total: 0, errors: 0, warnings: 0, info: 0 }
  )
}

function summarizeConflict(
  record: VaultConflictRecord
): VaultContextRecoverySummary['conflicts'][number] {
  return {
    id: record.id,
    path: record.path,
    detectedAt: record.detectedAt,
    ...(record.reason ? { reason: truncateText(record.reason, 500) } : {}),
    payloadRoles: Object.entries(record.payloads)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([role]) => role)
  }
}

function summarizeQuarantine(
  record: VaultQuarantineRecord
): VaultContextRecoverySummary['quarantine'][number] {
  return {
    id: record.id,
    path: record.path,
    quarantinedAt: record.quarantinedAt,
    reason: truncateText(record.reason, 500),
    payloadPath: typeof record.payload === 'string' ? record.payload : record.payload.path
  }
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

function isMissingPathError(error: unknown): boolean {
  return isNodeError(error) && error.code === 'ENOENT'
}
