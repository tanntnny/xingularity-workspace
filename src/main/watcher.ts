import chokidar, { FSWatcher } from 'chokidar'
import path from 'node:path'
import { isNotePath } from '../shared/noteDocument'

type VaultEvent = 'add' | 'change' | 'unlink'

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
    if (!isNotePath(relPath)) {
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
      void this.onFileEvent(relPath, type)
    }, 180)

    this.pendingTimers.set(relPath, timer)
  }

  private shouldSkip(relPath: string): boolean {
    const ts = this.recentInternalWrites.get(relPath)
    if (!ts) {
      return false
    }

    if (Date.now() - ts <= 1200) {
      return true
    }

    this.recentInternalWrites.delete(relPath)
    return false
  }
}
