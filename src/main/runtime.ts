import fs from 'node:fs/promises'
import path from 'node:path'
import { dialog } from 'electron'
import { FileService, sanitizeNotePath } from './fileService'
import { SqliteIndexer } from './indexer/sqliteIndexer'
import {
  assertPathInVault,
  chooseVaultFolder,
  initializeVault,
  toInfo,
  validateVault,
  VaultPaths
} from './vaultManager'
import { VaultWatcher } from './watcher'
import { SettingsStore, createDefaultAppSettings } from './settingsStore'
import { ReminderService } from './reminderService'
import { AppSettings, AppSettingsUpdate, SearchResult, VaultOpenResult } from '../shared/types'

export class VaultRuntime {
  private currentPaths: VaultPaths | null = null
  private fileService: FileService | null = null
  private watcher: VaultWatcher | null = null
  private indexer: SqliteIndexer | null = null
  private settings = new SettingsStore()
  private reminderService = new ReminderService()
  private activationQueue: Promise<void> = Promise.resolve()
  private settingsQueue: Promise<void> = Promise.resolve()
  private vaultListeners: Array<(paths: VaultPaths | null) => void> = []

  async openWithDialog(): Promise<VaultOpenResult | null> {
    const chosen = await chooseVaultFolder('Open vault folder')
    if (!chosen) {
      return null
    }
    return this.enqueueActivation(() => this.activateVault(chosen, false))
  }

  async createWithDialog(): Promise<VaultOpenResult | null> {
    const chosen = await chooseVaultFolder('Create vault folder')
    if (!chosen) {
      return null
    }
    return this.enqueueActivation(() => this.activateVault(chosen, true))
  }

  async restoreLast(): Promise<VaultOpenResult | null> {
    const global = await this.settings.readGlobal()
    if (!global.lastVaultPath) {
      return null
    }

    try {
      return await this.enqueueActivation(() => this.activateVault(global.lastVaultPath!, false))
    } catch (error) {
      console.error('Failed to restore last vault:', {
        lastVaultPath: global.lastVaultPath,
        error
      })
      throw new Error(`Could not restore previous vault at ${global.lastVaultPath}`)
    }
  }

  assertReady(): void {
    if (!this.currentPaths || !this.fileService || !this.indexer) {
      throw new Error('No vault is open')
    }
  }

  getCurrentVaultRoot(): string {
    this.assertReady()
    return this.currentPaths!.rootPath
  }

  onVaultChange(listener: (paths: VaultPaths | null) => void): void {
    this.vaultListeners.push(listener)
  }

  async listNotes() {
    this.assertReady()
    return this.fileService!.listNotes()
  }

  async readNote(relPath: string): Promise<string> {
    this.assertReady()
    return this.fileService!.readNote(relPath)
  }

  async writeNote(relPath: string, content: string): Promise<void> {
    this.assertReady()
    await this.fileService!.writeNote(relPath, content)
    const fresh = await this.fileService!.readNote(relPath)
    await this.indexer!.upsertFromRaw({
      id: createStableId(relPath),
      relPath: sanitizeNotePath(relPath),
      content: fresh,
      updatedAt: new Date().toISOString()
    })
  }

  async createNote(name: string): Promise<string> {
    this.assertReady()
    const relPath = await this.fileService!.createNote(name)
    const content = await this.fileService!.readNote(relPath)
    await this.indexer!.upsertFromRaw({
      id: createStableId(relPath),
      relPath,
      content,
      updatedAt: new Date().toISOString()
    })
    return relPath
  }

  async createNoteWithTags(name: string, tags: string[]): Promise<string> {
    this.assertReady()
    const relPath = await this.fileService!.createNoteWithTags(name, tags)
    const content = await this.fileService!.readNote(relPath)
    await this.indexer!.upsertFromRaw({
      id: createStableId(relPath),
      relPath,
      content,
      updatedAt: new Date().toISOString()
    })
    return relPath
  }

  async renameNote(oldPath: string, newPath: string): Promise<void> {
    this.assertReady()
    await this.fileService!.rename(oldPath, newPath)
    await this.indexer!.deleteByRelPath(sanitizeNotePath(oldPath))
    const content = await this.fileService!.readNote(newPath)
    await this.indexer!.upsertFromRaw({
      id: createStableId(newPath),
      relPath: sanitizeNotePath(newPath),
      content,
      updatedAt: new Date().toISOString()
    })
  }

  async deleteNote(relPath: string): Promise<void> {
    this.assertReady()
    await this.fileService!.delete(relPath)
    await this.indexer!.deleteByRelPath(sanitizeNotePath(relPath))
  }

  async exportNote(relPath: string, content: string): Promise<string | null> {
    this.assertReady()
    const safeRelPath = sanitizeNotePath(relPath)
    const suggestedName = path.basename(safeRelPath)
    const rootPath = this.currentPaths!.rootPath

    const result = await dialog.showSaveDialog({
      title: 'Export note',
      defaultPath: path.join(rootPath, suggestedName),
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    await fs.writeFile(result.filePath, content, 'utf-8')
    return result.filePath
  }

  search(query: string): SearchResult[] {
    this.assertReady()
    return this.indexer!.query(query)
  }

  async importAttachment(sourcePath: string): Promise<string> {
    this.assertReady()
    return this.fileService!.importAttachment(sourcePath)
  }

  async importAttachmentFromBuffer(buffer: Uint8Array, fileExtension: string): Promise<string> {
    this.assertReady()
    return this.fileService!.importAttachmentFromBuffer(buffer, fileExtension)
  }

  async getSettings(): Promise<AppSettings> {
    if (!this.currentPaths) {
      console.log('[VaultRuntime] getSettings requested before vault open')
      const defaults = createDefaultAppSettings()
      const global = await this.settings.readGlobal()
      return {
        ...defaults,
        lastVaultPath: global.lastVaultPath
      }
    }

    console.log('[VaultRuntime] getSettings for vault', this.currentPaths.rootPath)
    const settings = await this.settings.readVault(this.getCurrentVaultRoot())
    // Initialize reminder service with current tasks
    this.reminderService.updateTasks(settings.calendarTasks)
    return settings
  }

  async updateSettings(next: AppSettingsUpdate): Promise<AppSettings> {
    return this.enqueueSettingsUpdate(async () => {
      const merged = await this.settings.updateVault(this.getCurrentVaultRoot(), next)

      if (next.calendarTasks) {
        this.reminderService.updateTasks(merged.calendarTasks)
      }

      return merged
    })
  }

  async handleExternalEvent(
    relPath: string,
    eventType: 'add' | 'change' | 'unlink'
  ): Promise<void> {
    if (!this.fileService || !this.indexer || !this.currentPaths) {
      return
    }

    const safeRelPath = sanitizeNotePath(relPath)
    if (eventType === 'unlink') {
      await this.indexer.deleteByRelPath(safeRelPath)
      return
    }

    const absPath = assertPathInVault(this.currentPaths, safeRelPath, 'notes')
    const content = await fs.readFile(absPath, 'utf-8')
    await this.indexer.upsertFromRaw({
      id: createStableId(safeRelPath),
      relPath: safeRelPath,
      content,
      updatedAt: new Date().toISOString()
    })
  }

  private async activateVault(folderPath: string, createMode: boolean): Promise<VaultOpenResult> {
    console.log('[VaultRuntime] activateVault', { folderPath, createMode })
    await this.closeCurrentVault()
    this.currentPaths = createMode
      ? await initializeVault(folderPath)
      : await validateVault(folderPath)

    this.watcher = new VaultWatcher(this.currentPaths.notesPath, async (relPath, eventType) => {
      await this.handleExternalEvent(relPath, eventType)
    })

    this.fileService = new FileService(
      this.currentPaths.notesPath,
      this.currentPaths.attachmentsPath,
      (relPath) => this.watcher?.markInternalWrite(relPath)
    )

    this.indexer = await initializeIndexerWithRetry(
      this.currentPaths.indexPath,
      this.currentPaths.fileMapPath,
      this.currentPaths.notesPath
    )
    this.watcher.start()

    console.log('[VaultRuntime] persist global last vault', this.currentPaths.rootPath)
    await this.settings.writeGlobal({ lastVaultPath: this.currentPaths.rootPath })
    this.notifyVaultChange(this.currentPaths)
    return {
      info: toInfo(this.currentPaths),
      notes: await this.fileService.listNotes()
    }
  }

  private async closeCurrentVault(): Promise<void> {
    if (this.currentPaths) {
      this.notifyVaultChange(null)
    }
    await this.watcher?.stop()
    this.watcher = null
    this.fileService = null
    this.indexer?.close()
    this.indexer = null
    this.currentPaths = null
  }

  private enqueueActivation<T>(action: () => Promise<T>): Promise<T> {
    const run = this.activationQueue.then(action, action)
    this.activationQueue = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }

  private enqueueSettingsUpdate<T>(action: () => Promise<T>): Promise<T> {
    const run = this.settingsQueue.then(action, action)
    this.settingsQueue = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }

  private notifyVaultChange(paths: VaultPaths | null): void {
    for (const listener of this.vaultListeners) {
      try {
        listener(paths)
      } catch (error) {
        console.error('[VaultRuntime] vault listener failed', error)
      }
    }
  }
}

async function resetIndexArtifacts(indexPath: string, fileMapPath: string): Promise<void> {
  const artifacts = [
    indexPath,
    `${indexPath}-wal`,
    `${indexPath}-shm`,
    `${indexPath}-journal`,
    fileMapPath
  ]
  await Promise.all(artifacts.map((artifact) => fs.rm(artifact, { force: true })))
}

async function initializeIndexerWithRetry(
  indexPath: string,
  fileMapPath: string,
  notesPath: string
): Promise<SqliteIndexer> {
  await resetIndexArtifacts(indexPath, fileMapPath)

  try {
    const indexer = new SqliteIndexer(indexPath, fileMapPath)
    await indexer.init()
    await indexer.rebuild(notesPath)
    return indexer
  } catch (error) {
    if (!isSqliteCorruptionError(error)) {
      throw error
    }

    await resetIndexArtifacts(indexPath, fileMapPath)
    const indexer = new SqliteIndexer(indexPath, fileMapPath)
    await indexer.init()
    await indexer.rebuild(notesPath)
    return indexer
  }
}

function isSqliteCorruptionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const code = (error as Error & { code?: string }).code
  if (typeof code === 'string' && code.startsWith('SQLITE_CORRUPT')) {
    return true
  }

  return /database disk image is malformed/i.test(error.message)
}

function createStableId(relPath: string): string {
  return `note:${path.normalize(relPath).toLowerCase()}`
}
