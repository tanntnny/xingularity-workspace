import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type {
  VaultChangeEvent,
  VaultChangeKind,
  VaultChangeSource,
  VaultConflict,
  VaultDomain,
  VaultFileRevision,
  VaultQuarantineRecord,
  VaultReconcileResult,
  VaultStatus
} from '../shared/vaultProtocol'
import {
  getVaultDomainForPath,
  getVaultDomainDefinitions,
  isDerivedVaultPath
} from './vaultDomainCatalog'
import { isDerivedVaultPath as isDerivedPortableVaultPath } from './vaultPortablePolicy'
import { readVaultFileRevision } from './vaultRevision'

export interface VaultChangeInput {
  domain?: VaultDomain | null
  kind: VaultChangeKind
  path: string
  previousPath?: string
  source: VaultChangeSource
  contentHash?: string
  baseHash?: string
  revision?: string
  transactionId?: string
  observedAt?: string
}

export interface VaultChangeCoordinatorOptions {
  rootPath: string
  vaultId?: string
  now?: () => Date
  onEvent?: (event: VaultChangeEvent) => void
  onStatus?: (status: VaultStatus) => void
}

interface KnownFile {
  revision: VaultFileRevision
  domain: VaultDomain
}

const MAX_EVENT_HISTORY = 250

export class VaultChangeCoordinator {
  private readonly rootPath: string
  private readonly vaultId: string
  private readonly now: () => Date
  private readonly onEvent?: (event: VaultChangeEvent) => void
  private readonly onStatus?: (status: VaultStatus) => void
  private sequence = 0
  private lastScanAt: string | null = null
  private state: VaultStatus['state'] = 'watching'
  private lastError: string | undefined
  private externalChangeCount = 0
  private readonly events: VaultChangeEvent[] = []
  private readonly knownFiles = new Map<string, KnownFile>()
  private readonly conflicts = new Map<string, VaultConflict>()
  private readonly quarantine = new Map<string, VaultQuarantineRecord>()

  constructor(options: VaultChangeCoordinatorOptions) {
    this.rootPath = path.resolve(options.rootPath)
    this.vaultId = options.vaultId ?? randomUUID()
    this.now = options.now ?? (() => new Date())
    this.onEvent = options.onEvent
    this.onStatus = options.onStatus
  }

  get id(): string {
    return this.vaultId
  }

  getStatus(): VaultStatus {
    return {
      vaultId: this.vaultId,
      vaultPath: this.rootPath,
      state: this.state,
      watchedRoots: getVaultDomainDefinitions().reduce(
        (count, definition) => count + definition.canonicalRoots.length,
        0
      ),
      lastScanAt: this.lastScanAt,
      lastCommittedSequence: this.sequence,
      externalChangeCount: this.externalChangeCount,
      conflictCount: this.conflicts.size,
      quarantineCount: this.quarantine.size,
      staleDomains: [],
      ...(this.lastError ? { lastError: this.lastError } : {})
    }
  }

  getEvents(limit = MAX_EVENT_HISTORY): VaultChangeEvent[] {
    return this.events.slice(Math.max(0, this.events.length - limit)).map((event) => ({ ...event }))
  }

  getConflicts(): VaultConflict[] {
    return Array.from(this.conflicts.values()).map((conflict) => ({ ...conflict }))
  }

  getQuarantine(): VaultQuarantineRecord[] {
    return Array.from(this.quarantine.values()).map((record) => ({ ...record }))
  }

  setState(state: VaultStatus['state'], error?: string): void {
    this.state = state
    this.lastError = error
    this.emitStatus()
  }

  recordChange(input: VaultChangeInput): VaultChangeEvent | null {
    const domain = input.domain ?? getVaultDomainForPath(input.path)
    if (!domain) {
      return null
    }

    const event: VaultChangeEvent = {
      vaultId: this.vaultId,
      sequence: ++this.sequence,
      transactionId: input.transactionId ?? randomUUID(),
      domain,
      kind: input.kind,
      path: normalizePath(input.path),
      source: input.source,
      ...(input.previousPath ? { previousPath: normalizePath(input.previousPath) } : {}),
      ...(input.contentHash ? { contentHash: input.contentHash } : {}),
      ...(input.baseHash ? { baseHash: input.baseHash } : {}),
      ...(input.revision ? { revision: input.revision } : {}),
      observedAt: input.observedAt ?? this.now().toISOString()
    }

    this.updateKnownFileState(event)

    this.events.push(event)
    if (this.events.length > MAX_EVENT_HISTORY) {
      this.events.splice(0, this.events.length - MAX_EVENT_HISTORY)
    }
    if (input.source === 'external') {
      this.externalChangeCount += 1
      this.state = 'external-change'
    }
    this.onEvent?.({ ...event })
    this.emitStatus()
    return event
  }

  recordConflict(conflict: VaultConflict): void {
    this.conflicts.set(conflict.id, { ...conflict })
    this.state = 'conflict'
    this.emitStatus()
  }

  resolveConflict(conflictId: string): boolean {
    const removed = this.conflicts.delete(conflictId)
    if (removed && this.conflicts.size === 0 && this.state === 'conflict') {
      this.state = 'watching'
    }
    this.emitStatus()
    return removed
  }

  recordQuarantine(record: VaultQuarantineRecord): void {
    this.quarantine.set(record.id, { ...record })
    this.state = 'needs-repair'
    this.emitStatus()
  }

  resolveQuarantine(recordId: string): boolean {
    const removed = this.quarantine.delete(recordId)
    if (removed && this.quarantine.size === 0 && this.state === 'needs-repair') {
      this.state = 'watching'
    }
    this.emitStatus()
    return removed
  }

  async reconcile(): Promise<VaultReconcileResult> {
    const startedAt = this.now().toISOString()
    this.setState('reconciling')
    const changes: VaultChangeEvent[] = []
    const errors: VaultReconcileResult['errors'] = []
    const currentFiles = new Map<string, KnownFile>()

    try {
      const files = await this.listCanonicalFiles()
      for (const absolutePath of files) {
        const relativePath = normalizePath(path.relative(this.rootPath, absolutePath))
        const domain = getVaultDomainForPath(relativePath)
        if (!domain) {
          continue
        }

        try {
          const revision = await readVaultFileRevision(absolutePath)
          currentFiles.set(relativePath, { revision, domain })
        } catch (error) {
          errors.push({
            code: 'invalid-path',
            message: describeError(error),
            path: relativePath
          })
        }
      }

      for (const [relativePath, current] of currentFiles) {
        const previous = this.knownFiles.get(relativePath)
        if (!previous) {
          const event = this.recordChange({
            domain: current.domain,
            kind: 'add',
            path: relativePath,
            source: 'reconcile',
            contentHash: current.revision.contentHash,
            revision: current.revision.revision ?? current.revision.contentHash
          })
          if (event) changes.push(event)
          continue
        }

        if (previous.revision.contentHash !== current.revision.contentHash) {
          const event = this.recordChange({
            domain: current.domain,
            kind: 'change',
            path: relativePath,
            source: 'reconcile',
            contentHash: current.revision.contentHash,
            baseHash: previous.revision.contentHash,
            revision: current.revision.revision ?? current.revision.contentHash
          })
          if (event) changes.push(event)
        }
      }

      for (const [relativePath, previous] of this.knownFiles) {
        if (currentFiles.has(relativePath)) {
          continue
        }

        const event = this.recordChange({
          domain: previous.domain,
          kind: 'delete',
          path: relativePath,
          source: 'reconcile',
          baseHash: previous.revision.contentHash
        })
        if (event) changes.push(event)
      }

      this.knownFiles.clear()
      for (const [relativePath, current] of currentFiles) {
        this.knownFiles.set(relativePath, current)
      }
      this.lastScanAt = this.now().toISOString()
      this.lastError = errors.length > 0 ? errors[0]?.message : undefined
      this.state =
        this.conflicts.size > 0
          ? 'conflict'
          : this.quarantine.size > 0
            ? 'needs-repair'
            : 'watching'
    } catch (error) {
      this.lastError = describeError(error)
      this.state = 'needs-repair'
      errors.push({
        code: 'invalid-path',
        message: this.lastError,
        path: this.rootPath
      })
    }

    const completedAt = this.now().toISOString()
    this.emitStatus()
    return {
      vaultId: this.vaultId,
      startedAt,
      completedAt,
      sequence: this.sequence,
      status: this.getStatus(),
      scannedFiles: currentFiles.size,
      changes,
      conflicts: this.getConflicts(),
      quarantine: this.getQuarantine(),
      errors
    }
  }

  private async listCanonicalFiles(): Promise<string[]> {
    const files = new Set<string>()
    for (const definition of getVaultDomainDefinitions()) {
      for (const root of definition.canonicalRoots) {
        const absolutePath = path.join(this.rootPath, root)
        const stats = await statIfPresent(absolutePath)
        if (!stats) {
          continue
        }
        if (stats.isFile()) {
          if (!isDerivedVaultPath(root)) {
            files.add(absolutePath)
          }
          continue
        }
        if (stats.isDirectory()) {
          for (const file of await walkFiles(absolutePath)) {
            const relativePath = normalizePath(path.relative(this.rootPath, file))
            if (!isDerivedVaultPath(relativePath) && !isDerivedPortableVaultPath(relativePath)) {
              files.add(file)
            }
          }
        }
      }
    }
    return Array.from(files).sort()
  }

  private emitStatus(): void {
    this.onStatus?.(this.getStatus())
  }

  private updateKnownFileState(event: VaultChangeEvent): void {
    const normalizedPath = normalizePath(event.path)
    if (event.kind === 'delete') {
      this.knownFiles.delete(normalizedPath)
      return
    }

    if (!event.contentHash) {
      return
    }

    this.knownFiles.set(normalizedPath, {
      domain: event.domain,
      revision: {
        contentHash: event.contentHash,
        size: 0,
        mtimeMs: 0,
        revision: event.revision ?? event.contentHash
      }
    })

    if (event.previousPath) {
      this.knownFiles.delete(normalizePath(event.previousPath))
    }
  }
}

async function walkFiles(rootPath: string): Promise<string[]> {
  const entries = await fs.readdir(rootPath, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.join(rootPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(absolutePath)))
    } else if (entry.isFile()) {
      files.push(absolutePath)
    }
  }
  return files
}

async function statIfPresent(filePath: string): Promise<import('node:fs').Stats | null> {
  try {
    return await fs.stat(filePath)
  } catch (error) {
    if (isMissingPathError(error)) {
      return null
    }
    throw error
  }
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/').replace(/^\.\//, '')
}

function describeError(error: unknown): string {
  return String(error instanceof Error ? error.message : error).slice(0, 500)
}

function isMissingPathError(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}
