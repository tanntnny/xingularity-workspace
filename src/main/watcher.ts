import chokidar, { FSWatcher } from 'chokidar'
import path from 'node:path'
import { isExcalidrawPath } from '../shared/excalidrawFile'
import { isNotePath } from '../shared/noteDocument'

export type VaultEvent = 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'

export function isWatchedVaultPath(relPath: string, type: VaultEvent): boolean {
  if (type === 'addDir' || type === 'unlinkDir') {
    return relPath.length > 0
  }

  return isNotePath(relPath) || isExcalidrawPath(relPath)
}

export class VaultWatcher {
  private watcher: FSWatcher | null = null
  private readonly recentInternalWrites = new Map<string, number>()
  private readonly pendingTimers = new Map<string, NodeJS.Timeout>()

  constructor(
    private readonly notesRoot: string,
    private readonly onFileEvent: (relPath: string, type: VaultEvent) => Promise<void>
  ) {}

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

  markInternalWrite(relPath: string): void {
    this.recentInternalWrites.set(relPath, Date.now())
  }

  private enqueue(absPath: string, type: VaultEvent): void {
    const relPath = path.relative(this.notesRoot, absPath).replace(/\\/g, '/')
    if (!isWatchedVaultPath(relPath, type)) {
      return
    }

    const prevTimer = this.pendingTimers.get(relPath)
    if (prevTimer) {
      clearTimeout(prevTimer)
    }

    const timer = setTimeout(() => {
      this.pendingTimers.delete(relPath)
      if (this.shouldSkip(relPath)) {
        return
      }
      void this.onFileEvent(relPath, type).catch((error) => {
        console.error('[VaultWatcher] failed to process event', { relPath, type, error })
      })
    }, 180)

    this.pendingTimers.set(relPath, timer)
  }

  private shouldSkip(relPath: string): boolean {
    const ts = this.recentInternalWrites.get(relPath)
    if (!ts) {
      return false
    }

    if (Date.now() - ts <= 1200) {
      this.recentInternalWrites.delete(relPath)
      return true
    }

    this.recentInternalWrites.delete(relPath)
    return false
  }
}
