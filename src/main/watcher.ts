import chokidar, { FSWatcher } from 'chokidar'
import path from 'node:path'
import { isExcalidrawPath } from '../shared/excalidrawFile'
import { isNotePath } from '../shared/noteDocument'
import { ExpectedWriteRegistry, readVaultFileRevision } from './vaultRevision'

export type VaultEvent = 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'

export interface VaultWatcherOptions {
  pathFilter?: (relPath: string, type: VaultEvent) => boolean
}

export function isWatchedVaultPath(relPath: string, type: VaultEvent): boolean {
  if (type === 'addDir' || type === 'unlinkDir') {
    return relPath.length > 0
  }

  return isNotePath(relPath) || isExcalidrawPath(relPath)
}

export class VaultWatcher {
  private watcher: FSWatcher | null = null
  private readonly expectedWrites = new ExpectedWriteRegistry()
  private readonly pendingTimers = new Map<string, NodeJS.Timeout>()

  constructor(
    private readonly notesRoot: string,
    private readonly onFileEvent: (relPath: string, type: VaultEvent) => Promise<void>,
    options: VaultWatcherOptions = {}
  ) {
    this.pathFilter = options.pathFilter ?? isWatchedVaultPath
  }

  private readonly pathFilter: (relPath: string, type: VaultEvent) => boolean

  start(): void {
    this.watcher = chokidar.watch(this.notesRoot, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 220,
        pollInterval: 80
      }
    })

    this.watcher.on('add', (targetPath) => this.enqueue(targetPath, 'add'))
    this.watcher.on('change', (targetPath) => this.enqueue(targetPath, 'change'))
    this.watcher.on('unlink', (targetPath) => this.enqueue(targetPath, 'unlink'))
    this.watcher.on('addDir', (targetPath) => this.enqueue(targetPath, 'addDir'))
    this.watcher.on('unlinkDir', (targetPath) => this.enqueue(targetPath, 'unlinkDir'))
  }

  async stop(): Promise<void> {
    for (const timer of this.pendingTimers.values()) {
      clearTimeout(timer)
    }
    this.pendingTimers.clear()
    await this.watcher?.close()
    this.watcher = null
  }

  markInternalWrite(relPath: string, contentHash?: string, transactionId?: string): void {
    this.expectedWrites.register(
      path.resolve(this.notesRoot, relPath),
      contentHash ?? null,
      transactionId
    )
  }

  markInternalDelete(relPath: string, transactionId?: string): void {
    this.expectedWrites.register(path.resolve(this.notesRoot, relPath), null, transactionId)
  }

  private enqueue(absPath: string, type: VaultEvent): void {
    const relPath = path.relative(this.notesRoot, absPath).replace(/\\/g, '/')
    if (!this.pathFilter(relPath, type)) {
      return
    }

    const prevTimer = this.pendingTimers.get(relPath)
    if (prevTimer) {
      clearTimeout(prevTimer)
    }

    const timer = setTimeout(() => {
      this.pendingTimers.delete(relPath)
      void this.shouldSkip(path.resolve(this.notesRoot, relPath), type).then((skip) => {
        if (skip) {
          return
        }

        return this.onFileEvent(relPath, type).catch((error) => {
          console.error('[VaultWatcher] failed to process event', { relPath, type, error })
        })
      })
    }, 180)

    this.pendingTimers.set(relPath, timer)
  }

  private async shouldSkip(absPath: string, type: VaultEvent): Promise<boolean> {
    if (type === 'unlink' || type === 'unlinkDir' || type === 'addDir') {
      return this.expectedWrites.acknowledge(absPath, null) !== null
    }

    return this.observeExpectedWrite(absPath)
  }

  private async observeExpectedWrite(absPath: string): Promise<boolean> {
    try {
      const revision = await readVaultFileRevision(absPath)
      return this.expectedWrites.acknowledge(absPath, revision.contentHash) !== null
    } catch (error) {
      if (isMissingPathError(error)) {
        return false
      }
      console.warn('[VaultWatcher] failed to inspect expected write', { absPath, error })
      return false
    }
  }
}

function isMissingPathError(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}
