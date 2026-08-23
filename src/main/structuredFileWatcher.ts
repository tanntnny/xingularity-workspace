import chokidar, { type FSWatcher } from 'chokidar'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { sha256 } from '../shared/hash'

export type StructuredFileEventType = 'add' | 'change' | 'unlink'
export type StructuredConflictResolution = 'keep-local' | 'keep-disk' | 'merge'

export interface StructuredFileVersion {
  contentHash: string
  updatedAt?: string
  version?: number | string
}

export interface StructuredFileSnapshot {
  content?: string
  value?: unknown
  contentHash?: string
  updatedAt?: string
  version?: number | string
  base?: StructuredFileVersion
}

export type StructuredSnapshotInput = StructuredFileSnapshot | string | unknown

export interface StructuredWatchRoot {
  name: string
  path: string
  extensions?: readonly string[]
  parse?: (raw: string, context: StructuredParseContext) => unknown | Promise<unknown>
  validate?:
    | ((
        value: unknown,
        context: StructuredParseContext
      ) => boolean | string | void | Promise<boolean | string | void>)
    | undefined
}

export type StructuredWatchRootInput = StructuredWatchRoot | string

export interface StructuredParseContext {
  root: StructuredWatchRoot
  absolutePath: string
  relativePath: string
  event: StructuredFileEventType
}

export interface StructuredFileChange {
  type: 'external-change' | 'reconciled-change'
  event: StructuredFileEventType
  root: string
  rootPath: string
  absolutePath: string
  relativePath: string
  value?: unknown
  content?: string
  version: StructuredFileVersion | null
}

export interface StructuredConflict {
  id: string
  root: string
  rootPath: string
  absolutePath: string
  relativePath: string
  detectedAt: string
  base?: StructuredFileVersion
  local: StructuredFileVersion
  disk: StructuredFileVersion | null
}

export interface StructuredConflictEvent {
  conflict: StructuredConflict
  change: StructuredFileChange
}

export interface StructuredQuarantineRecord {
  root: string
  rootPath: string
  absolutePath: string
  relativePath: string
  quarantinePath: string
  quarantinedAt: string
  reason: string
}

export interface StructuredWatcherError {
  absolutePath?: string
  relativePath?: string
  error: unknown
}

export interface StructuredFileWatcherOptions {
  roots: readonly StructuredWatchRootInput[]
  debounceMs?: number
  quarantineRoot?: string
  extensions?: readonly string[]
  usePolling?: boolean
  pollingIntervalMs?: number
  now?: () => Date
  watchFactory?: (paths: string[], options: Record<string, unknown>) => FSWatcher
  onChange?: (change: StructuredFileChange) => unknown | Promise<unknown>
  onExternalChange?: (change: StructuredFileChange) => unknown | Promise<unknown>
  onConflict?: (event: StructuredConflictEvent) => unknown | Promise<unknown>
  onQuarantine?: (record: StructuredQuarantineRecord) => unknown | Promise<unknown>
  onMalformed?: (record: StructuredQuarantineRecord) => unknown | Promise<unknown>
  onError?: (error: StructuredWatcherError) => unknown | Promise<unknown>
}

interface LocalState {
  version: StructuredFileVersion
  base?: StructuredFileVersion
  content?: string
  value?: unknown
}

interface PendingEvent {
  absolutePath: string
  event: StructuredFileEventType
}

const DEFAULT_DEBOUNCE_MS = 180
const DEFAULT_EXTENSIONS = ['.json']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMissingPathError(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}

function normalizeExtensions(extensions: readonly string[]): string[] {
  return Array.from(
    new Set(
      extensions
        .map((extension) => extension.trim().toLocaleLowerCase())
        .filter((extension) => extension.startsWith('.') && extension.length > 1)
    )
  )
}

function isPathInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate)
  return (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  )
}

function stableSerialize(value: unknown): string {
  if (value === null) {
    return 'null'
  }
  if (typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value)
  }
  if (typeof value === 'undefined') {
    return 'undefined'
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(String(value))
}

function parseContent(content: string): unknown {
  return JSON.parse(content) as unknown
}

function getRecordVersion(value: unknown): Pick<StructuredFileVersion, 'updatedAt' | 'version'> {
  if (!isRecord(value)) {
    return {}
  }

  const updatedAt =
    typeof value.updatedAt === 'string'
      ? value.updatedAt
      : typeof value.modifiedAt === 'string'
        ? value.modifiedAt
        : undefined
  const version =
    typeof value.version === 'number' || typeof value.version === 'string'
      ? value.version
      : undefined

  return {
    ...(updatedAt ? { updatedAt } : {}),
    ...(version !== undefined ? { version } : {})
  }
}

export function hashStructuredContent(contentOrValue: string | unknown): string {
  if (typeof contentOrValue === 'string') {
    try {
      return sha256(stableSerialize(parseContent(contentOrValue)))
    } catch {
      return sha256(contentOrValue)
    }
  }
  return sha256(stableSerialize(contentOrValue))
}

export function createStructuredFileVersion(
  contentOrValue: string | unknown,
  metadata: Partial<Omit<StructuredFileVersion, 'contentHash'>> = {}
): StructuredFileVersion {
  const value =
    typeof contentOrValue === 'string'
      ? (() => {
          try {
            return parseContent(contentOrValue)
          } catch {
            return undefined
          }
        })()
      : contentOrValue
  const recordVersion = getRecordVersion(value)
  return {
    contentHash: hashStructuredContent(contentOrValue),
    ...((metadata.updatedAt ?? recordVersion.updatedAt)
      ? { updatedAt: metadata.updatedAt ?? recordVersion.updatedAt }
      : {}),
    ...(metadata.version !== undefined
      ? { version: metadata.version }
      : recordVersion.version !== undefined
        ? { version: recordVersion.version }
        : {})
  }
}

function snapshotFromInput(input: StructuredSnapshotInput): {
  version: StructuredFileVersion
  base?: StructuredFileVersion
  content?: string
  value?: unknown
} {
  let content: string | undefined
  let value: unknown = input
  let metadata: Partial<StructuredFileVersion> = {}
  let base: StructuredFileVersion | undefined

  if (typeof input === 'string') {
    content = input
    value = (() => {
      try {
        return parseContent(input)
      } catch {
        return undefined
      }
    })()
  } else if (
    isRecord(input) &&
    ('content' in input || 'value' in input || 'base' in input || 'contentHash' in input)
  ) {
    if (typeof input.content === 'string') {
      content = input.content
      value = (() => {
        try {
          return parseContent(input.content as string)
        } catch {
          return undefined
        }
      })()
    } else if ('value' in input) {
      value = input.value
    }
    if (typeof input.updatedAt === 'string') {
      metadata.updatedAt = input.updatedAt
    }
    if (typeof input.version === 'number' || typeof input.version === 'string') {
      metadata.version = input.version
    }
    if (isRecord(input.base) && typeof input.base.contentHash === 'string') {
      base = input.base as unknown as StructuredFileVersion
    }
    if (typeof input.contentHash === 'string' && input.contentHash.trim()) {
      metadata = { ...metadata, contentHash: input.contentHash }
    }
  }

  if (content === undefined) {
    content = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  }

  const version = createStructuredFileVersion(content, metadata)
  if (typeof (metadata as { contentHash?: unknown }).contentHash === 'string') {
    version.contentHash = (metadata as { contentHash: string }).contentHash
  }

  return {
    version,
    ...(base ? { base } : {}),
    ...(content !== undefined ? { content } : {}),
    ...(value !== undefined ? { value } : {})
  }
}

function rootFromInput(
  input: StructuredWatchRootInput,
  extensions: readonly string[]
): StructuredWatchRoot {
  if (typeof input === 'string') {
    const rootPath = path.resolve(input)
    return {
      name: path.basename(rootPath) || 'structured',
      path: rootPath,
      extensions
    }
  }

  const rootPath = path.resolve(input.path)
  return {
    ...input,
    name: input.name.trim() || path.basename(rootPath) || 'structured',
    path: rootPath,
    extensions: normalizeExtensions(input.extensions ?? extensions)
  }
}

function safeErrorMessage(error: unknown): string {
  return String(error instanceof Error ? error.message : error).slice(0, 500)
}

function safeQuarantineName(root: string, relativePath: string): string {
  const rootPart = root.replace(/[^a-z0-9._-]+/gi, '_') || 'structured'
  const pathPart =
    relativePath.replace(/[\\/]+/g, '__').replace(/[^a-z0-9._-]+/gi, '_') || 'record.json'
  return `${rootPart}__${pathPart}`
}

async function listFiles(rootPath: string, extensions: readonly string[]): Promise<string[]> {
  const files: string[] = []
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(rootPath, { withFileTypes: true })
  } catch (error) {
    if (isMissingPathError(error)) {
      return []
    }
    throw error
  }

  for (const entry of entries) {
    const absolutePath = path.join(rootPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolutePath, extensions)))
      continue
    }
    if (entry.isFile() && extensions.includes(path.extname(entry.name).toLocaleLowerCase())) {
      files.push(absolutePath)
    }
  }

  return files
}

export class StructuredFileWatcher {
  private readonly roots: StructuredWatchRoot[]
  private readonly debounceMs: number
  private readonly quarantineRoot: string
  private readonly now: () => Date
  private readonly options: StructuredFileWatcherOptions
  private watcher: FSWatcher | null = null
  private readyPromise: Promise<void> | null = null
  private readonly pending = new Map<string, PendingEvent>()
  private readonly timers = new Map<string, NodeJS.Timeout>()
  private readonly processing = new Set<Promise<void>>()
  private readonly localStates = new Map<string, LocalState>()
  private readonly knownDiskVersions = new Map<string, StructuredFileVersion>()
  private readonly conflicts = new Map<
    string,
    { conflict: StructuredConflict; change: StructuredFileChange; local: LocalState }
  >()
  private readonly quarantined = new Map<string, StructuredQuarantineRecord>()
  private readonly quarantinedSourcePaths = new Set<string>()

  constructor(options: StructuredFileWatcherOptions) {
    if (options.roots.length === 0) {
      throw new Error('StructuredFileWatcher requires at least one structured root')
    }

    const extensions = normalizeExtensions(options.extensions ?? DEFAULT_EXTENSIONS)
    this.roots = options.roots.map((root) => rootFromInput(root, extensions))
    this.debounceMs = Math.max(
      0,
      Math.min(10_000, Math.floor(options.debounceMs ?? DEFAULT_DEBOUNCE_MS))
    )
    this.quarantineRoot = path.resolve(
      options.quarantineRoot ?? path.join(this.roots[0].path, '.quarantine')
    )
    this.now = options.now ?? (() => new Date())
    this.options = options
  }

  get watchedRoots(): readonly StructuredWatchRoot[] {
    return this.roots
  }

  start(): void {
    if (this.watcher) {
      return
    }

    const rootPaths = this.roots.map((root) => root.path)
    const watchOptions: Record<string, unknown> = {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: Math.max(20, this.debounceMs),
        pollInterval: Math.max(10, Math.min(100, Math.floor(this.debounceMs / 2) || 10))
      },
      ...(this.options.usePolling
        ? {
            usePolling: true,
            interval: Math.max(25, this.options.pollingIntervalMs ?? 100)
          }
        : {}),
      ignored: (candidate: string) => this.shouldIgnorePath(candidate)
    }

    this.watcher = this.options.watchFactory
      ? this.options.watchFactory(rootPaths, watchOptions)
      : chokidar.watch(rootPaths, watchOptions)

    this.watcher.on('add', (absolutePath) => this.enqueue(String(absolutePath), 'add'))
    this.watcher.on('change', (absolutePath) => this.enqueue(String(absolutePath), 'change'))
    this.watcher.on('unlink', (absolutePath) => this.enqueue(String(absolutePath), 'unlink'))
    this.watcher.on('error', (error) => {
      void this.reportError({ error })
    })
    this.readyPromise = new Promise<void>((resolve) => {
      this.watcher?.once('ready', () => resolve())
    })
  }

  async waitForReady(): Promise<void> {
    await this.readyPromise
  }

  async stop(): Promise<void> {
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
    this.pending.clear()
    await Promise.all(Array.from(this.processing))
    await this.watcher?.close()
    this.watcher = null
    this.readyPromise = null
  }

  async rescan(rootName?: string): Promise<void> {
    const roots = rootName ? this.roots.filter((root) => root.name === rootName) : this.roots
    for (const root of roots) {
      const files = await listFiles(root.path, root.extensions ?? DEFAULT_EXTENSIONS)
      const currentPaths = new Set(files.map((filePath) => path.resolve(filePath)))
      for (const absolutePath of files) {
        this.enqueue(absolutePath, 'change')
      }
      for (const knownPath of this.knownDiskVersions.keys()) {
        if (
          isPathInside(root.path, knownPath) &&
          this.isSupportedFile(root, knownPath) &&
          !currentPaths.has(path.resolve(knownPath))
        ) {
          this.enqueue(knownPath, 'unlink')
        }
      }
    }
    await this.flushPending()
  }

  async flushPending(): Promise<void> {
    const pending = Array.from(this.pending.values())
    for (const item of pending) {
      const timer = this.timers.get(item.absolutePath)
      if (timer) {
        clearTimeout(timer)
      }
      this.timers.delete(item.absolutePath)
      this.pending.delete(item.absolutePath)
    }

    await Promise.all(pending.map((item) => this.processWithErrorHandling(item)))
    await Promise.all(Array.from(this.processing))
  }

  markLocalWrite(
    filePath: string,
    snapshot: StructuredSnapshotInput,
    base?: StructuredFileVersion | null
  ): StructuredFileVersion {
    const absolutePath = this.resolveTrackedPath(filePath)
    const normalized = snapshotFromInput(snapshot)
    const local: LocalState = {
      ...normalized,
      ...(base ? { base } : {})
    }
    this.localStates.set(absolutePath, local)
    return local.version
  }

  markLocalEdit(
    filePath: string,
    snapshot: StructuredSnapshotInput,
    base?: StructuredFileVersion | null
  ): StructuredFileVersion {
    return this.markLocalWrite(filePath, snapshot, base)
  }

  recordLocalWrite(
    filePath: string,
    snapshot: StructuredSnapshotInput,
    base?: StructuredFileVersion | null
  ): StructuredFileVersion {
    return this.markLocalWrite(filePath, snapshot, base)
  }

  clearLocalWrite(filePath: string): void {
    this.localStates.delete(this.resolveTrackedPath(filePath))
  }

  getConflicts(): StructuredConflict[] {
    return Array.from(this.conflicts.values()).map(({ conflict }) => ({ ...conflict }))
  }

  listConflicts(): StructuredConflict[] {
    return this.getConflicts()
  }

  getQuarantinedFiles(): StructuredQuarantineRecord[] {
    return Array.from(this.quarantined.values()).map((record) => ({ ...record }))
  }

  listQuarantinedFiles(): StructuredQuarantineRecord[] {
    return this.getQuarantinedFiles()
  }

  async resolveConflict(
    conflictIdOrPath: string,
    resolution: StructuredConflictResolution,
    merged?: StructuredSnapshotInput
  ): Promise<void> {
    const entry = this.findConflict(conflictIdOrPath)
    if (!entry) {
      throw new Error(`Unknown structured-file conflict: ${conflictIdOrPath}`)
    }

    if (resolution === 'keep-disk') {
      this.localStates.delete(entry.change.absolutePath)
      this.conflicts.delete(entry.conflict.id)
      this.knownDiskVersions.delete(entry.change.absolutePath)
      if (entry.change.version) {
        this.knownDiskVersions.set(entry.change.absolutePath, entry.change.version)
      }
      await this.emitChange({ ...entry.change, type: 'reconciled-change' })
      return
    }

    const snapshot = resolution === 'merge' ? snapshotFromInput(merged) : entry.local
    if (!snapshot || !snapshot.content) {
      throw new Error('A local or merged snapshot is required to resolve this conflict')
    }

    await this.writeResolved(entry.change.absolutePath, snapshot.content)
    this.localStates.delete(entry.change.absolutePath)
    this.conflicts.delete(entry.conflict.id)
    this.knownDiskVersions.set(entry.change.absolutePath, snapshot.version)
    await this.emitChange({
      ...entry.change,
      type: 'reconciled-change',
      event: 'change',
      value: snapshot.value,
      content: snapshot.content,
      version: snapshot.version
    })
  }

  private enqueue(absolutePathInput: string, event: StructuredFileEventType): void {
    const absolutePath = path.resolve(absolutePathInput)
    if (this.shouldIgnorePath(absolutePath)) {
      return
    }

    const root = this.findRoot(absolutePath)
    if (!root || !this.isSupportedFile(root, absolutePath)) {
      return
    }

    const previousTimer = this.timers.get(absolutePath)
    if (previousTimer) {
      clearTimeout(previousTimer)
    }

    this.pending.set(absolutePath, { absolutePath, event })
    const timer = setTimeout(() => {
      this.timers.delete(absolutePath)
      const pending = this.pending.get(absolutePath)
      if (!pending) {
        return
      }
      this.pending.delete(absolutePath)
      this.scheduleProcess(pending)
    }, this.debounceMs)
    this.timers.set(absolutePath, timer)
  }

  private scheduleProcess(item: PendingEvent): void {
    const task = this.processWithErrorHandling(item)
    this.processing.add(task)
    void task.finally(() => this.processing.delete(task))
  }

  private async processWithErrorHandling(item: PendingEvent): Promise<void> {
    try {
      await this.process(item)
    } catch (error) {
      await this.reportError({ absolutePath: item.absolutePath, error })
    }
  }

  private async process(item: PendingEvent): Promise<void> {
    const root = this.findRoot(item.absolutePath)
    if (!root) {
      return
    }
    const relativePath = path.relative(root.path, item.absolutePath).replace(/\\/g, '/')

    if (item.event === 'unlink') {
      if (this.quarantinedSourcePaths.delete(item.absolutePath)) {
        return
      }

      const local = this.localStates.get(item.absolutePath)
      const change: StructuredFileChange = {
        type: 'external-change',
        event: 'unlink',
        root: root.name,
        rootPath: root.path,
        absolutePath: item.absolutePath,
        relativePath,
        version: null
      }
      if (local) {
        await this.raiseConflict(root, change, local, null)
        return
      }
      this.knownDiskVersions.delete(item.absolutePath)
      await this.emitChange(change)
      return
    }

    let content: string
    try {
      content = await fs.readFile(item.absolutePath, 'utf-8')
    } catch (error) {
      if (isMissingPathError(error)) {
        await this.process({ ...item, event: 'unlink' })
        return
      }
      throw error
    }

    const context: StructuredParseContext = {
      root,
      absolutePath: item.absolutePath,
      relativePath,
      event: item.event
    }
    let value: unknown
    try {
      value = root.parse ? await root.parse(content, context) : parseContent(content)
      if (root.validate) {
        const validation = await root.validate(value, context)
        if (validation === false) {
          throw new Error('structured record validation failed')
        }
        if (typeof validation === 'string') {
          throw new Error(validation)
        }
      }
    } catch (error) {
      await this.quarantine(item.absolutePath, root, relativePath, error)
      return
    }

    const version = createStructuredFileVersion(value)
    const change: StructuredFileChange = {
      type: 'external-change',
      event: item.event,
      root: root.name,
      rootPath: root.path,
      absolutePath: item.absolutePath,
      relativePath,
      value,
      content,
      version
    }
    const local = this.localStates.get(item.absolutePath)
    if (local) {
      if (local.version.contentHash === version.contentHash) {
        this.localStates.delete(item.absolutePath)
        this.knownDiskVersions.set(item.absolutePath, version)
        return
      }
      if (local.base?.contentHash === version.contentHash) {
        return
      }
      await this.raiseConflict(root, change, local, version)
      return
    }

    const known = this.knownDiskVersions.get(item.absolutePath)
    if (known?.contentHash === version.contentHash) {
      return
    }

    this.knownDiskVersions.set(item.absolutePath, version)
    await this.emitChange(change)
  }

  private async raiseConflict(
    root: StructuredWatchRoot,
    change: StructuredFileChange,
    local: LocalState,
    disk: StructuredFileVersion | null
  ): Promise<void> {
    const conflictId = sha256(
      [
        change.absolutePath,
        local.base?.contentHash ?? '',
        local.version.contentHash,
        disk?.contentHash ?? ''
      ].join('|')
    )
    const conflict: StructuredConflict = {
      id: conflictId,
      root: root.name,
      rootPath: root.path,
      absolutePath: change.absolutePath,
      relativePath: change.relativePath,
      detectedAt: this.now().toISOString(),
      ...(local.base ? { base: local.base } : {}),
      local: local.version,
      disk
    }
    const existing = this.conflicts.get(conflict.id)
    this.conflicts.set(conflict.id, { conflict, change, local })
    if (!existing) {
      await this.invoke(this.options.onConflict, { conflict, change })
    }
  }

  private async quarantine(
    absolutePath: string,
    root: StructuredWatchRoot,
    relativePath: string,
    error: unknown
  ): Promise<void> {
    const quarantinedAt = this.now().toISOString()
    const targetDirectory = path.join(this.quarantineRoot, root.name)
    await fs.mkdir(targetDirectory, { recursive: true })
    const targetPath = path.join(
      targetDirectory,
      `${safeQuarantineName(root.name, relativePath)}.${Date.now()}-${randomUUID()}.invalid.json`
    )

    try {
      await fs.rename(absolutePath, targetPath)
    } catch (renameError) {
      if (isMissingPathError(renameError)) {
        return
      }
      await fs.copyFile(absolutePath, targetPath)
      await fs.unlink(absolutePath)
    }

    this.quarantinedSourcePaths.add(absolutePath)
    const record: StructuredQuarantineRecord = {
      root: root.name,
      rootPath: root.path,
      absolutePath,
      relativePath,
      quarantinePath: targetPath,
      quarantinedAt,
      reason: safeErrorMessage(error)
    }
    this.quarantined.set(absolutePath, record)
    await this.invoke(this.options.onQuarantine, record)
    if (this.options.onMalformed && this.options.onMalformed !== this.options.onQuarantine) {
      await this.invoke(this.options.onMalformed, record)
    }
  }

  private findRoot(absolutePath: string): StructuredWatchRoot | undefined {
    return this.roots
      .filter((root) => isPathInside(root.path, absolutePath))
      .sort((left, right) => right.path.length - left.path.length)[0]
  }

  private resolveTrackedPath(filePath: string): string {
    const candidate = path.resolve(filePath)
    if (this.findRoot(candidate)) {
      return candidate
    }
    if (path.isAbsolute(filePath)) {
      throw new Error(`Path is outside all structured roots: ${filePath}`)
    }
    const firstRoot = this.roots[0]
    const relativeCandidate = path.resolve(firstRoot.path, filePath)
    if (!this.findRoot(relativeCandidate)) {
      throw new Error(`Path is outside all structured roots: ${filePath}`)
    }
    return relativeCandidate
  }

  private isSupportedFile(root: StructuredWatchRoot, absolutePath: string): boolean {
    if (absolutePath === root.path || this.shouldIgnorePath(absolutePath)) {
      return false
    }
    const extensions = root.extensions ?? DEFAULT_EXTENSIONS
    return extensions.includes(path.extname(absolutePath).toLocaleLowerCase())
  }

  private shouldIgnorePath(absolutePathInput: string): boolean {
    const absolutePath = path.resolve(absolutePathInput)
    if (isPathInside(this.quarantineRoot, absolutePath)) {
      return true
    }
    return path.basename(absolutePath).includes('.tmp-')
  }

  private findConflict(
    conflictIdOrPath: string
  ): { conflict: StructuredConflict; change: StructuredFileChange; local: LocalState } | undefined {
    const absolutePath = path.isAbsolute(conflictIdOrPath)
      ? path.resolve(conflictIdOrPath)
      : undefined
    return (
      this.conflicts.get(conflictIdOrPath) ??
      (absolutePath
        ? Array.from(this.conflicts.values()).find(
            (item) => item.change.absolutePath === absolutePath
          )
        : undefined)
    )
  }

  private async writeResolved(absolutePath: string, content: string): Promise<void> {
    const tempPath = `${absolutePath}.tmp-${process.pid}-${randomUUID()}`
    await fs.writeFile(tempPath, content, 'utf-8')
    await fs.rename(tempPath, absolutePath)
  }

  private async emitChange(change: StructuredFileChange): Promise<void> {
    await this.invoke(this.options.onChange, change)
    if (this.options.onExternalChange && this.options.onExternalChange !== this.options.onChange) {
      await this.invoke(this.options.onExternalChange, change)
    }
  }

  private async reportError(error: StructuredWatcherError): Promise<void> {
    await this.invoke(this.options.onError, error)
  }

  private async invoke<T>(
    callback: ((value: T) => unknown | Promise<unknown>) | undefined,
    value: T
  ): Promise<void> {
    if (!callback) {
      return
    }
    await callback(value)
  }
}

export const StructuredRootWatcher = StructuredFileWatcher
