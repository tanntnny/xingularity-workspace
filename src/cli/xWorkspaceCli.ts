import fs from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
import path from 'node:path'
import {
  XWorkspaceBindingStore,
  manifestFingerprint,
  workspaceContentFingerprint
} from './xWorkspaceBinding'
import { XWorkspaceError, isXWorkspaceError } from './xWorkspaceErrors'
import { WorkspaceService, type WorkspaceOperationInput } from '../main/workspaceService'
import { repairWorkspaceLock } from '../main/workspaceMutationLock'

export const X_WORKSPACE_EXIT_CODES = {
  success: 0,
  usage: 2,
  validation: 3,
  operational: 4,
  conflict: 5
} as const

export interface XWorkspaceResponse<T = unknown> {
  ok: boolean
  command: string
  exitCode: number
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

export interface XWorkspaceCliOptions {
  configDir?: string
  now?: () => Date
  cwd?: string
  lockWaitMs?: number
}

export interface ParsedXWorkspaceArgs {
  command: string
  positionals: string[]
  flags: Map<string, string | boolean>
}

interface PendingPlan {
  version: 1
  id: string
  tokenHash: string
  operation: WorkspaceOperationInput['operation']
  input: unknown
  rootPath: string
  vaultId: string
  manifestChecksum: string
  contentFingerprint: string
  createdAt: string
  expiresAt: string
}

const PLAN_TTL_MS = 5 * 60 * 1000

export function parseXWorkspaceArgs(argv: string[]): ParsedXWorkspaceArgs {
  const positionals: string[] = []
  const flags = new Map<string, string | boolean>()
  const knownValueFlags = new Set([
    'input',
    'path',
    'query',
    'project',
    'project-id',
    'id',
    'limit',
    'max-chars',
    'name',
    'title',
    'description',
    'markdown',
    'state',
    'status',
    'linked-tasks',
    'relations',
    'start-date',
    'end-date',
    'tags',
    'time-budget-minutes',
    'date',
    'end-date',
    'time',
    'end-time',
    'priority',
    'task-type',
    'estimate-minutes',
    'dependency-ids',
    'parent-task-id',
    'type',
    'outcome',
    'from-id',
    'to-id',
    'from-kind',
    'to-kind',
    'confidence',
    'created-by',
    'note',
    'canonical-uri'
  ])
  const knownBooleanFlags = new Set(['pretty', 'confirm', 'content', 'no-diagnostics', 'help'])

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) {
      positionals.push(token)
      continue
    }
    const name = token.slice(2)
    if (knownBooleanFlags.has(name)) {
      flags.set(name, true)
      continue
    }
    if (!knownValueFlags.has(name)) {
      throw new XWorkspaceError('invalid-command', `Unknown x-workspace option: --${name}`)
    }
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) {
      throw new XWorkspaceError('invalid-input', `--${name} requires a value`)
    }
    flags.set(name, value)
    index += 1
  }

  const command = positionals.slice(0, 4).join(' ')
  return { command, positionals, flags }
}

export async function runXWorkspace(
  argv: string[],
  options: XWorkspaceCliOptions = {}
): Promise<XWorkspaceResponse> {
  let parsed: ParsedXWorkspaceArgs
  try {
    parsed = parseXWorkspaceArgs(argv)
  } catch (error) {
    return toErrorResponse(
      argv.filter((token) => !token.startsWith('--')).join(' ') || 'x-workspace',
      error
    )
  }
  const command = commandLabel(parsed)

  try {
    const bindingStore = new XWorkspaceBindingStore({
      configDir: options.configDir,
      now: options.now
    })
    const data = await dispatch(parsed, bindingStore, options)
    return { ok: true, command, exitCode: X_WORKSPACE_EXIT_CODES.success, data }
  } catch (error) {
    return toErrorResponse(command, error)
  }
}

export function serializeXWorkspaceResponse(
  response: XWorkspaceResponse,
  options: { pretty?: boolean } = {}
): string {
  return JSON.stringify(response, null, options.pretty ? 2 : undefined)
}

async function dispatch(
  parsed: ParsedXWorkspaceArgs,
  bindingStore: XWorkspaceBindingStore,
  options: XWorkspaceCliOptions
): Promise<unknown> {
  const { positionals, flags } = parsed
  const rootCommand = positionals[0]

  if (!rootCommand || rootCommand === 'help' || flags.has('help')) {
    return getHelp()
  }

  if (rootCommand === 'apply') {
    return applyPlan(positionals[1], bindingStore, options)
  }

  if (rootCommand === 'vault') {
    return dispatchVault(positionals.slice(1), flags, bindingStore, options)
  }

  const binding = await bindingStore.require()
  const service = new WorkspaceService({
    rootPath: binding.rootPath,
    now: options.now,
    lockWaitMs: options.lockWaitMs
  })

  switch (rootCommand) {
    case 'status':
      return service.status()
    case 'context':
      return service.context({
        query: stringFlag(flags, 'query'),
        project: stringFlag(flags, 'project') ?? stringFlag(flags, 'project-id'),
        note: stringFlag(flags, 'path'),
        limit: numberFlag(flags, 'limit'),
        maxChars: numberFlag(flags, 'max-chars'),
        includeDiagnostics: !flags.has('no-diagnostics')
      })
    case 'search': {
      const query = stringFlag(flags, 'query') ?? positionals[1]
      if (!query) throw new XWorkspaceError('invalid-input', 'Search requires a query')
      return service.search(query, { limit: numberFlag(flags, 'limit') })
    }
    case 'note':
      return dispatchNote(positionals.slice(1), flags, service, binding, bindingStore)
    case 'project':
      return dispatchProject(positionals.slice(1), flags, service, binding, bindingStore)
    case 'task':
      return dispatchTask(positionals.slice(1), flags, service, binding, bindingStore)
    case 'resource':
      return dispatchResource(positionals.slice(1), flags, service, binding, bindingStore)
    default:
      throw new XWorkspaceError(
        'invalid-command',
        'Use vault, status, context, search, note, project, task, or resource'
      )
  }
}

async function dispatchVault(
  positionals: string[],
  flags: Map<string, string | boolean>,
  bindingStore: XWorkspaceBindingStore,
  options: XWorkspaceCliOptions
): Promise<unknown> {
  const action = positionals[0]
  switch (action) {
    case 'init': {
      requireConfirmation(flags, 'Vault initialization requires --confirm')
      const root = positionals[1]
      if (!root) throw new XWorkspaceError('invalid-input', 'vault init requires a path')
      const binding = await bindingStore.createAndBind(root)
      return { bound: true, ...binding }
    }
    case 'set': {
      requireConfirmation(flags, 'Vault binding requires --confirm')
      const root = positionals[1]
      if (!root) throw new XWorkspaceError('invalid-input', 'vault set requires a path')
      const binding = await bindingStore.bindExisting(root)
      return { bound: true, ...binding }
    }
    case 'current': {
      const binding = await bindingStore.require()
      return { bound: true, ...binding }
    }
    case 'status': {
      const binding = await bindingStore.read()
      if (!binding) return { bound: false, binding: null }
      const service = new WorkspaceService({ rootPath: binding.rootPath, now: options.now })
      return { bound: true, binding, workspace: await service.status() }
    }
    case 'reset':
      requireConfirmation(flags, 'Vault reset requires --confirm')
      await bindingStore.reset()
      return { bound: false, reset: true }
    case 'repair-lock': {
      requireConfirmation(flags, 'Lock repair requires --confirm')
      const binding = await bindingStore.require()
      await repairWorkspaceLock(binding.rootPath, true)
      return { repaired: true, rootPath: binding.rootPath }
    }
    default:
      throw new XWorkspaceError(
        'invalid-command',
        'Use vault init, set, current, status, reset, or repair-lock'
      )
  }
}

async function dispatchNote(
  positionals: string[],
  flags: Map<string, string | boolean>,
  service: WorkspaceService,
  binding: Awaited<ReturnType<XWorkspaceBindingStore['require']>>,
  bindingStore: XWorkspaceBindingStore
): Promise<unknown> {
  const action = positionals[0]
  if (action === 'list') return service.listNotes()
  if (action === 'read' || action === 'get') {
    const notePath = stringFlag(flags, 'path') ?? positionals[1]
    if (!notePath) throw new XWorkspaceError('invalid-input', 'note read requires --path')
    return service.readNote(notePath)
  }
  if (action === 'search') {
    const query = stringFlag(flags, 'query') ?? positionals[1]
    if (!query) throw new XWorkspaceError('invalid-input', 'note search requires a query')
    return service.search(query, { limit: numberFlag(flags, 'limit') })
  }
  const operation = (
    {
      create: 'note.create',
      update: 'note.update',
      append: 'note.append',
      delete: 'note.delete'
    } as const
  )[action as 'create' | 'update' | 'append' | 'delete']
  if (!operation)
    throw new XWorkspaceError(
      'invalid-command',
      'Use note list, read, search, create, update, append, or delete'
    )
  const input = mutationInput(flags, noteInput(flags, positionals, action))
  return createPlan(operation, input, service, bindingStore, binding)
}

async function dispatchProject(
  positionals: string[],
  flags: Map<string, string | boolean>,
  service: WorkspaceService,
  binding: Awaited<ReturnType<XWorkspaceBindingStore['require']>>,
  bindingStore: XWorkspaceBindingStore
): Promise<unknown> {
  const action = positionals[0]
  const child = positionals[1]
  if (['task', 'milestone', 'update', 'meeting'].includes(action)) {
    return dispatchProjectChild(action, positionals.slice(1), flags, service, binding, bindingStore)
  }
  if (action === 'list') return service.listProjects()
  if (action === 'get') {
    const projectId = stringFlag(flags, 'id') ?? positionals[1]
    if (!projectId) throw new XWorkspaceError('invalid-input', 'project get requires an ID')
    return service.getProject(projectId)
  }
  const operation = (
    {
      create: 'project.create',
      edit: 'project.update',
      update: 'project.update',
      archive: 'project.archive',
      delete: 'project.delete'
    } as const
  )[action as 'create' | 'edit' | 'update' | 'archive' | 'delete']
  if (!operation || child)
    throw new XWorkspaceError(
      'invalid-command',
      'Use project list, get, create, edit, archive, delete, or a project child command'
    )
  const input = mutationInput(flags, projectInput(flags, positionals))
  return createPlan(operation, input, service, bindingStore, binding)
}

async function dispatchProjectChild(
  childType: string,
  positionals: string[],
  flags: Map<string, string | boolean>,
  service: WorkspaceService,
  binding: Awaited<ReturnType<XWorkspaceBindingStore['require']>>,
  bindingStore: XWorkspaceBindingStore
): Promise<unknown> {
  const action = positionals[0]
  const projectId =
    stringFlag(flags, 'project-id') ?? stringFlag(flags, 'project') ?? positionals[1]
  if (action === 'list' || action === 'get') {
    if (!projectId)
      throw new XWorkspaceError(
        'invalid-input',
        `project ${childType} ${action} requires a project ID`
      )
    if (action === 'list') {
      if (childType === 'task') return service.listTasks(projectId)
      if (childType === 'milestone') return service.listProjectMilestones(projectId)
      if (childType === 'update') return service.listProjectUpdates(projectId)
      return service.listProjectMeetings(projectId)
    }
    const childId = stringFlag(flags, 'id') ?? positionals[2]
    if (!childId)
      throw new XWorkspaceError('invalid-input', `project ${childType} get requires an ID`)
    if (childType === 'task') return service.getTask(childId)
    if (childType === 'milestone') return service.getProjectMilestone(projectId, childId)
    if (childType === 'update') return service.getProjectUpdate(projectId, childId)
    return service.getProjectMeeting(projectId, childId)
  }
  const operation = `project.${childType}.${action}` as WorkspaceOperationInput['operation']
  const supported = new Set([
    'project.task.create',
    'project.task.update',
    'project.task.delete',
    'project.milestone.create',
    'project.milestone.update',
    'project.milestone.delete',
    'project.update.create',
    'project.update.update',
    'project.update.delete',
    'project.meeting.create',
    'project.meeting.update',
    'project.meeting.delete'
  ])
  if (!supported.has(operation))
    throw new XWorkspaceError(
      'invalid-command',
      `Unsupported project ${childType} action: ${action}`
    )
  const input = mutationInput(flags, childInput(childType, action, flags, positionals, projectId))
  return createPlan(operation, input, service, bindingStore, binding)
}

async function dispatchTask(
  positionals: string[],
  flags: Map<string, string | boolean>,
  service: WorkspaceService,
  binding: Awaited<ReturnType<XWorkspaceBindingStore['require']>>,
  bindingStore: XWorkspaceBindingStore
): Promise<unknown> {
  const action = positionals[0]
  if (action === 'list')
    return service.listTasks(stringFlag(flags, 'project-id') ?? stringFlag(flags, 'project'))
  if (action === 'get') return service.getTask(stringFlag(flags, 'id') ?? positionals[1] ?? '')
  const operation = `project.task.${action}` as WorkspaceOperationInput['operation']
  if (!['project.task.create', 'project.task.update', 'project.task.delete'].includes(operation)) {
    throw new XWorkspaceError('invalid-command', 'Use task list, get, create, update, or delete')
  }
  const projectId = stringFlag(flags, 'project-id') ?? stringFlag(flags, 'project')
  const input = mutationInput(
    flags,
    childInput('task', action, flags, [positionals[0], projectId ?? '', positionals[1]], projectId)
  )
  return createPlan(operation, input, service, bindingStore, binding)
}

async function dispatchResource(
  positionals: string[],
  flags: Map<string, string | boolean>,
  service: WorkspaceService,
  binding: Awaited<ReturnType<XWorkspaceBindingStore['require']>>,
  bindingStore: XWorkspaceBindingStore
): Promise<unknown> {
  const action = positionals[0]
  if (action === 'list') return service.listResources()
  if (action === 'get') return service.getResource(stringFlag(flags, 'id') ?? positionals[1] ?? '')
  if (action === 'preview')
    return service.resourcePreview(
      stringFlag(flags, 'id') ?? positionals[1] ?? '',
      Boolean(flags.get('content'))
    )
  if (action === 'refresh') {
    const input = { resourceId: stringFlag(flags, 'id') ?? positionals[1] ?? '' }
    return createPlan('resource.refresh', input, service, bindingStore, binding)
  }
  const operation = (
    {
      create: 'resource.create',
      edit: 'resource.update',
      update: 'resource.update',
      delete: 'resource.delete',
      link: 'resource.link',
      relate: 'resource.relate'
    } as const
  )[action as 'create' | 'edit' | 'update' | 'delete' | 'link' | 'relate']
  if (!operation)
    throw new XWorkspaceError(
      'invalid-command',
      'Use resource list, get, preview, refresh, create, edit, delete, link, or relate'
    )
  const input = mutationInput(flags, resourceInput(action, flags, positionals))
  return createPlan(operation, input, service, bindingStore, binding)
}

async function createPlan(
  operation: WorkspaceOperationInput['operation'],
  input: unknown,
  service: WorkspaceService,
  bindingStore: XWorkspaceBindingStore,
  binding: Awaited<ReturnType<XWorkspaceBindingStore['require']>>
): Promise<unknown> {
  const preview = await service.previewOperation(operation, input)
  const token = randomBytes(24).toString('base64url')
  const now = bindingStore.currentTime()
  const plan: PendingPlan = {
    version: 1,
    id: randomBytes(12).toString('hex'),
    tokenHash: hashToken(token),
    operation,
    input,
    rootPath: binding.rootPath,
    vaultId: binding.vaultId,
    manifestChecksum: binding.manifestChecksum,
    contentFingerprint: await workspaceContentFingerprint(binding.rootPath),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + PLAN_TTL_MS).toISOString()
  }
  await fs.mkdir(bindingStore.plansDir, { recursive: true, mode: 0o700 })
  await fs.writeFile(planPath(bindingStore, plan.id), `${JSON.stringify(plan, null, 2)}\n`, {
    mode: 0o600
  })
  return {
    kind: 'preview',
    approvalToken: token,
    expiresAt: plan.expiresAt,
    vaultId: binding.vaultId,
    ...preview
  }
}

async function applyPlan(
  token: string | undefined,
  bindingStore: XWorkspaceBindingStore,
  options: XWorkspaceCliOptions
): Promise<unknown> {
  if (!token) throw new XWorkspaceError('invalid-input', 'apply requires an approval token')
  const binding = await bindingStore.require()
  const plan = await findPlan(bindingStore, token)
  if (new Date(plan.expiresAt).getTime() <= (options.now ?? (() => new Date()))().getTime()) {
    await fs.rm(planPath(bindingStore, plan.id), { force: true })
    throw new XWorkspaceError('plan-expired', 'The approval token has expired')
  }
  const assertPlanFresh = async (): Promise<void> => {
    const currentBinding = await bindingStore.require()
    if (
      plan.rootPath !== currentBinding.rootPath ||
      plan.vaultId !== currentBinding.vaultId ||
      plan.manifestChecksum !== (await manifestFingerprint(currentBinding.rootPath)) ||
      plan.contentFingerprint !== (await workspaceContentFingerprint(currentBinding.rootPath))
    ) {
      throw new XWorkspaceError(
        'plan-stale',
        'The approval token belongs to a different vault state'
      )
    }
  }
  try {
    await assertPlanFresh()
    const service = new WorkspaceService({
      rootPath: binding.rootPath,
      now: options.now,
      lockWaitMs: options.lockWaitMs
    })
    await service.previewOperation(plan.operation, plan.input)
    const committed = await service.applyOperation(plan.operation, plan.input, {
      beforeApply: assertPlanFresh
    })
    await fs.rm(planPath(bindingStore, plan.id), { force: true })
    return {
      kind: 'commit',
      operation: plan.operation,
      transactionId: committed.transactionId,
      result: committed.result
    }
  } catch (error) {
    if (isXWorkspaceError(error) && error.code === 'plan-stale') {
      await fs.rm(planPath(bindingStore, plan.id), { force: true })
    }
    throw error
  }
}

async function findPlan(bindingStore: XWorkspaceBindingStore, token: string): Promise<PendingPlan> {
  let entries: string[]
  try {
    entries = await fs.readdir(bindingStore.plansDir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new XWorkspaceError('plan-invalid', 'Approval token was not found')
    }
    throw error
  }
  const tokenHash = hashToken(token)
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue
    try {
      const plan = JSON.parse(
        await fs.readFile(path.join(bindingStore.plansDir, entry), 'utf8')
      ) as PendingPlan
      if (plan.version === 1 && plan.tokenHash === tokenHash) return plan
    } catch {
      // Ignore malformed abandoned plans; they cannot be applied.
    }
  }
  throw new XWorkspaceError('plan-invalid', 'Approval token was not found')
}

function planPath(bindingStore: XWorkspaceBindingStore, id: string): string {
  return path.join(bindingStore.plansDir, `${id}.json`)
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function commandLabel(parsed: ParsedXWorkspaceArgs): string {
  if (parsed.positionals[0] === 'apply') return 'apply'
  if (parsed.positionals[0] === 'vault') return `vault ${parsed.positionals[1] ?? ''}`.trim()
  return parsed.positionals.slice(0, 4).join(' ') || 'x-workspace'
}

function requireConfirmation(flags: Map<string, string | boolean>, message: string): void {
  if (!flags.has('confirm')) throw new XWorkspaceError('invalid-input', message)
}

function stringFlag(flags: Map<string, string | boolean>, name: string): string | undefined {
  const value = flags.get(name)
  return typeof value === 'string' ? value : undefined
}

function numberFlag(flags: Map<string, string | boolean>, name: string): number | undefined {
  const value = stringFlag(flags, name)
  if (value === undefined) return undefined
  const number = Number(value)
  if (!Number.isFinite(number))
    throw new XWorkspaceError('invalid-input', `--${name} must be numeric`)
  return number
}

function mutationInput(
  flags: Map<string, string | boolean>,
  fallback: Record<string, unknown>
): unknown {
  const raw = stringFlag(flags, 'input')
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw === '-' ? readFileSync(0, 'utf8') : raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('Input must be a JSON object')
    return parsed
  } catch (error) {
    throw new XWorkspaceError(
      'invalid-input',
      `--input must be valid JSON: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

function getHelp(): Record<string, unknown> {
  return {
    usage: 'x-workspace <command> [options]',
    commands: [
      'vault init|set|current|status|reset|repair-lock',
      'status',
      'context',
      'search <query>',
      'note list|read|search|create|update|append|delete',
      'project list|get|create|edit|archive|delete',
      'project task|milestone|update|meeting list|get|create|update|delete',
      'task list|get|create|update|delete',
      'resource list|get|preview|refresh|create|edit|delete|link|relate',
      'apply <approval-token>'
    ],
    safety: 'Mutations preview first and require apply with the returned approval token.',
    options: ['--input <json|->', '--pretty', '--confirm', '--limit <n>', '--max-chars <n>']
  }
}

function noteInput(
  flags: Map<string, string | boolean>,
  positionals: string[],
  action: string
): Record<string, unknown> {
  return {
    ...(stringFlag(flags, 'path') || positionals[1]
      ? { path: stringFlag(flags, 'path') ?? positionals[1] }
      : {}),
    ...(stringFlag(flags, 'name') ? { name: stringFlag(flags, 'name') } : {}),
    ...(stringFlag(flags, 'markdown') ? { markdown: stringFlag(flags, 'markdown') } : {}),
    ...(stringFlag(flags, 'tags') ? { tags: commaSeparatedFlag(flags, 'tags') } : {}),
    ...(action === 'delete' ? {} : {})
  }
}

function projectInput(
  flags: Map<string, string | boolean>,
  positionals: string[]
): Record<string, unknown> {
  const projectId = stringFlag(flags, 'id') ?? positionals[1]
  return {
    ...(projectId ? { projectId } : {}),
    ...(stringFlag(flags, 'name') || stringFlag(flags, 'title')
      ? { name: stringFlag(flags, 'name') ?? stringFlag(flags, 'title') }
      : {}),
    ...(stringFlag(flags, 'description') ? { description: stringFlag(flags, 'description') } : {}),
    ...(stringFlag(flags, 'start-date') ? { startDate: stringFlag(flags, 'start-date') } : {}),
    ...(stringFlag(flags, 'end-date') ? { endDate: stringFlag(flags, 'end-date') } : {}),
    ...(stringFlag(flags, 'tags') ? { tags: commaSeparatedFlag(flags, 'tags') } : {}),
    ...(stringFlag(flags, 'state') ? { state: stringFlag(flags, 'state') } : {}),
    ...(stringFlag(flags, 'linked-tasks')
      ? { linkedTasks: stringFlag(flags, 'linked-tasks') }
      : {}),
    ...(stringFlag(flags, 'time-budget-minutes')
      ? { timeBudgetMinutes: numericValue(flags, 'time-budget-minutes') }
      : {})
  }
}

function childInput(
  childType: string,
  action: string,
  flags: Map<string, string | boolean>,
  positionals: string[],
  projectId: string | undefined
): Record<string, unknown> {
  const input: Record<string, unknown> = { ...(projectId ? { projectId } : {}) }
  const id = stringFlag(flags, 'id') ?? positionals[2]
  if (id) {
    if (childType === 'task') input.taskId = id
    if (childType === 'milestone') input.milestoneId = id
    if (childType === 'update') input.updateId = id
    if (childType === 'meeting') input.meetingId = id
  }
  if (stringFlag(flags, 'title')) input.title = stringFlag(flags, 'title')
  if (stringFlag(flags, 'description')) input.description = stringFlag(flags, 'description')
  if (stringFlag(flags, 'markdown')) input.markdown = stringFlag(flags, 'markdown')
  if (stringFlag(flags, 'state')) input.state = stringFlag(flags, 'state')
  if (stringFlag(flags, 'status')) input.status = stringFlag(flags, 'status')
  if (stringFlag(flags, 'linked-tasks')) input.linkedTasks = stringFlag(flags, 'linked-tasks')
  if (stringFlag(flags, 'start-date')) input.startDate = stringFlag(flags, 'start-date')
  if (stringFlag(flags, 'end-date')) input.endDate = stringFlag(flags, 'end-date')
  if (stringFlag(flags, 'tags')) input.tags = commaSeparatedFlag(flags, 'tags')
  if (stringFlag(flags, 'date')) input.date = stringFlag(flags, 'date')
  if (stringFlag(flags, 'time')) input.time = stringFlag(flags, 'time')
  if (stringFlag(flags, 'end-time')) input.endTime = stringFlag(flags, 'end-time')
  if (stringFlag(flags, 'priority')) input.priority = stringFlag(flags, 'priority')
  if (stringFlag(flags, 'task-type')) input.taskType = stringFlag(flags, 'task-type')
  if (stringFlag(flags, 'estimate-minutes'))
    input.estimateMinutes = numericValue(flags, 'estimate-minutes')
  if (stringFlag(flags, 'dependency-ids'))
    input.dependencyIds = commaSeparatedFlag(flags, 'dependency-ids')
  if (stringFlag(flags, 'parent-task-id')) input.parentTaskId = stringFlag(flags, 'parent-task-id')
  if (stringFlag(flags, 'type')) input.type = stringFlag(flags, 'type')
  if (stringFlag(flags, 'outcome')) input.outcome = stringFlag(flags, 'outcome')
  if (childType === 'task' && action === 'create' && stringFlag(flags, 'title'))
    input.title = stringFlag(flags, 'title')
  return input
}

function resourceInput(
  action: string,
  flags: Map<string, string | boolean>,
  positionals: string[]
): Record<string, unknown> {
  const resourceId = stringFlag(flags, 'id') ?? positionals[1]
  if (action === 'link') {
    return { resourceId, projectIds: commaSeparatedFlag(flags, 'project') }
  }
  if (action === 'relate') {
    return {
      fromId: stringFlag(flags, 'from-id') ?? stringFlag(flags, 'id') ?? '',
      toId: stringFlag(flags, 'to-id') ?? positionals[1] ?? '',
      type: stringFlag(flags, 'type') ?? 'resource_related_to_resource',
      fromKind: stringFlag(flags, 'from-kind') ?? 'resource',
      toKind: stringFlag(flags, 'to-kind') ?? 'resource',
      ...(stringFlag(flags, 'confidence') ? { confidence: stringFlag(flags, 'confidence') } : {}),
      ...(stringFlag(flags, 'created-by') ? { createdBy: stringFlag(flags, 'created-by') } : {}),
      ...(stringFlag(flags, 'note') ? { note: stringFlag(flags, 'note') } : {})
    }
  }
  return {
    ...(resourceId && action !== 'create' ? { resourceId } : {}),
    ...(stringFlag(flags, 'title') ? { title: stringFlag(flags, 'title') } : {}),
    ...(stringFlag(flags, 'path') || stringFlag(flags, 'canonical-uri')
      ? { canonicalUri: stringFlag(flags, 'path') ?? stringFlag(flags, 'canonical-uri') }
      : {}),
    ...(stringFlag(flags, 'tags')
      ? { labels: commaSeparatedFlag(flags, 'tags').map((value) => ({ key: 'tag', value })) }
      : {}),
    ...(stringFlag(flags, 'project') ? { projectIds: commaSeparatedFlag(flags, 'project') } : {})
  }
}

function commaSeparatedFlag(flags: Map<string, string | boolean>, name: string): string[] {
  return (
    stringFlag(flags, name)
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean) ?? []
  )
}

function numericValue(flags: Map<string, string | boolean>, name: string): number {
  const value = stringFlag(flags, name)
  const number = Number(value)
  if (!Number.isFinite(number))
    throw new XWorkspaceError('invalid-input', `--${name} must be numeric`)
  return number
}

function toErrorResponse(command: string, error: unknown): XWorkspaceResponse {
  const normalized = isXWorkspaceError(error)
    ? error
    : new XWorkspaceError(
        'operational-error',
        error instanceof Error ? error.message : String(error)
      )
  const exitCode =
    normalized.code === 'conflict' || normalized.code === 'plan-stale'
      ? X_WORKSPACE_EXIT_CODES.conflict
      : [
            'vault-unbound',
            'vault-already-bound',
            'vault-binding-invalid',
            'vault-manifest-invalid',
            'vault-not-found',
            'vault-exists',
            'invalid-input',
            'not-found',
            'ambiguous',
            'plan-expired',
            'plan-invalid',
            'invalid-command'
          ].includes(normalized.code)
        ? normalized.code === 'invalid-command'
          ? X_WORKSPACE_EXIT_CODES.usage
          : X_WORKSPACE_EXIT_CODES.validation
        : normalized.code === 'vault-busy'
          ? X_WORKSPACE_EXIT_CODES.operational
          : X_WORKSPACE_EXIT_CODES.operational
  return {
    ok: false,
    command,
    exitCode,
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(normalized.details === undefined ? {} : { details: normalized.details })
    }
  }
}
