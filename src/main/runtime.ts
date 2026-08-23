import fs from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { app, BrowserWindow, dialog, shell } from 'electron'
import { Mistral } from '@mistralai/mistralai'
import type {
  Tool as MistralTool,
  ToolCall as MistralToolCall
} from '@mistralai/mistralai/models/components'
import type { Messages as MistralChatMessage } from '@mistralai/mistralai/models/components/chatcompletionrequest'
import { AgentChatStore } from './agentChatStore'
import { AgentHistoryStore } from './agentHistoryStore'
import { ExcalidrawSessionStore } from './excalidrawSessionStore'
import {
  FileService,
  findAvailableExcalidrawRelPath,
  sanitizeEntryPath,
  sanitizeNotePath
} from './fileService'
import { FleetingNoteService } from './fleetingNoteService'
import { SqliteIndexer } from './indexer/sqliteIndexer'
import {
  createEmptyExcalidrawFileDocument,
  isExcalidrawPath,
  withExcalidrawExtension
} from '../shared/excalidrawFile'
import { isNotePath, serializeStoredNoteDocument, stripNoteExtension } from '../shared/noteDocument'
import {
  assertPathInVault,
  chooseVaultFolder,
  initializeVault,
  toInfo,
  validateVault,
  VaultPaths
} from './vaultManager'
import { getVaultFleetingDir } from './vaultData'
import { buildVaultMigrationReport } from './vaultMigrationReport'
import { VaultWatcher, type VaultEvent } from './watcher'
import { SettingsStore, createDefaultAppSettings } from './settingsStore'
import { ReminderService } from './reminderService'
import { HistoryService } from './historyService'
import { TrashService, TrashedEntry } from './trashService'
import { NotebookMutationQueue } from './notebookMutationQueue'
import { CredentialStore } from './credentialStore'
import { ResourceService } from './resourceService'
import { ResourceWriteService } from './resourceWriteService'
import { GoogleDriveAdapter } from './googleDriveAdapter'
import {
  GOOGLE_DRIVE_CONTENT_MAX_CHARS,
  GoogleDriveResourceService
} from './googleDriveResourceService'
import type {
  ResourceWriteInput,
  ResourceWritePreview,
  ResourceWriteAuditRecord
} from '../shared/types'
import { createWarpNewTabUri } from './warp'
import { buildFolderMarkdown } from './noteMarkdownExport'
import { buildProjectMarkdown, type ProjectMarkdownExternalDocument } from './projectMarkdownExport'
import { buildFolderPdfHtml, buildNotePdfHtml } from './notePdfExport'
import { normalizeProjectIcon } from '../shared/projectIcons'
import { isVaultRelativePath } from '../shared/projectFolders'
import { getProjectNotebookPath } from '../shared/projectNotebook'
import { notebookPathFromResource, notebookResourceUri } from '../shared/resourceDomain'
import { applyProjectMilestoneOrder, validateTaskRelationships } from '../shared/projectPlanning'
import { normalizeTaskTags } from '../shared/taskTags'
import {
  AppSettings,
  AgentChatEvent,
  AgentChatContextSummary,
  AgentChatApprovedToolResult,
  AgentChatMentionRef,
  AgentChatMessageRecord,
  AgentChatSession,
  AgentChatMessageInput,
  AgentChatMessageResult,
  AgentChatToolStep,
  AgentRunRecord,
  AppSettingsUpdate,
  AppSettingsUpdateOptions,
  CalendarTask,
  ReminderClickTarget,
  CreateProjectInput,
  CreateProjectMilestoneInput,
  CreateProjectUpdateInput,
  CreateTaskInput,
  DeleteProjectMilestoneInput,
  DeleteProjectMilestoneResult,
  DeleteProjectInput,
  DeleteProjectResult,
  CompleteNoteWithAiInput,
  BlockNoteMigrationResult,
  NoteImagePathMigrationResult,
  NoteImportResult,
  Project,
  ProjectMilestone,
  ReorderProjectMilestonesInput,
  ProjectUpdate,
  ProjectState,
  SavedVaultState,
  SearchResult,
  StoredNoteDocument,
  UpdateProjectMilestoneInput,
  UpdateProjectInput,
  UpdateProjectUpdateInput,
  DeleteProjectUpdateInput,
  VaultRemoveResult,
  VaultOpenResult,
  HistoryOperationResult,
  HistoryStatus,
  LegacyExcalidrawImportResult,
  ExcalidrawSession,
  ExcalidrawFileReadResult,
  StoredExcalidrawFileDocument,
  NotePdfExportInput,
  NotePdfExportResult,
  FolderMarkdownExportInput,
  FolderMarkdownExportResult,
  ProjectContextMarkdownExportInput,
  ProjectContextMarkdownExportResult,
  FolderPdfExportInput,
  FolderPdfExportResult,
  FleetingConversionResult,
  FleetingConversionTarget,
  FleetingNote,
  MutationEnvelope,
  ResourceInput,
  ResourceRef,
  ResourceRelation,
  ResourcePreview,
  ResourceHealth,
  ResourceContextBundle
} from '../shared/types'

const AGENT_GOOGLE_DOC_EXCERPT_MAX_CHARS = 20_000
const AGENT_GOOGLE_DOC_TOTAL_MAX_CHARS = 100_000

export class VaultRuntime {
  private currentPaths: VaultPaths | null = null
  private fileService: FileService | null = null
  private fleetingNoteService: FleetingNoteService | null = null
  private watcher: VaultWatcher | null = null
  private indexer: SqliteIndexer | null = null
  private settings = new SettingsStore()
  private reminderService = new ReminderService()
  private credentialStore = new CredentialStore()
  private resourceService: ResourceService | null = null
  private resourceWriteService: ResourceWriteService | null = null
  private googleDriveService: GoogleDriveResourceService | null = null
  private resourceSearchCache: SearchResult[] = []
  private activationQueue: Promise<void> = Promise.resolve()
  private notebookMutationQueue = new NotebookMutationQueue()
  private settingsQueue: Promise<void> = Promise.resolve()
  private vaultListeners: Array<(paths: VaultPaths | null) => void> = []
  private treeChangeListeners: Array<() => void> = []
  private agentChatListeners: Array<(event: AgentChatEvent) => void> = []
  private agentToolInvoker: ((name: string, input: unknown) => Promise<unknown>) | null = null
  private readonly cancelledAgentRequests = new Set<string>()
  private readonly agentAbortControllers = new Map<string, AbortController>()
  private reminderClickListeners: Array<(target: ReminderClickTarget) => void> = []

  constructor(private readonly history = new HistoryService()) {
    this.reminderService.setReminderClickHandler((target) => this.notifyReminderClick(target))
  }

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

    const lastVaultPath = global.lastVaultPath

    try {
      return await this.enqueueActivation(() => this.activateVault(lastVaultPath, false))
    } catch (error) {
      console.error('Failed to restore last vault:', {
        lastVaultPath,
        error
      })
      await this.settings.clearRememberedVault(lastVaultPath)
      return null
    }
  }

  async listSavedVaults(): Promise<SavedVaultState> {
    return this.buildSavedVaultState()
  }

  async switchSavedVault(rootPath: string): Promise<VaultOpenResult> {
    return this.enqueueActivation(
      (): Promise<VaultOpenResult> => this.activateVault(rootPath, false)
    )
  }

  async runVaultMigration(): Promise<VaultOpenResult> {
    const rootPath = this.getCurrentVaultRoot()
    return this.enqueueActivation(
      (): Promise<VaultOpenResult> => this.activateVault(rootPath, false)
    )
  }

  async getVaultMigrationReport(): Promise<import('../shared/types').VaultMigrationReport> {
    return buildVaultMigrationReport(this.getCurrentVaultRoot())
  }

  async toggleFavoriteSavedVault(rootPath: string): Promise<SavedVaultState> {
    const global = await this.settings.toggleFavoriteVault(path.resolve(rootPath))
    return this.buildSavedVaultState(global)
  }

  async removeSavedVault(rootPath: string): Promise<VaultRemoveResult> {
    const resolvedRootPath = path.resolve(rootPath)
    const removedCurrentVault = this.currentPaths?.rootPath === resolvedRootPath
    const global = await this.settings.forgetVault(resolvedRootPath)

    if (!removedCurrentVault) {
      return {
        removedPath: resolvedRootPath,
        state: await this.buildSavedVaultState(global),
        activation: null
      }
    }

    const nextVault = await this.findMostRecentAvailableVault(global.savedVaults)
    if (nextVault) {
      const activation = await this.enqueueActivation(
        (): Promise<VaultOpenResult> => this.activateVault(nextVault.rootPath, false)
      )
      return {
        removedPath: resolvedRootPath,
        state: await this.buildSavedVaultState(),
        activation
      }
    }

    await this.enqueueActivation(async (): Promise<void> => {
      await this.closeCurrentVault()
    })

    return {
      removedPath: resolvedRootPath,
      state: await this.buildSavedVaultState(global),
      activation: null
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

  getVaultFileProtocolScope(): {
    vaultRoot: string
    attachmentRoots: readonly string[]
  } | null {
    if (!this.currentPaths) {
      return null
    }

    return {
      vaultRoot: this.currentPaths.rootPath,
      attachmentRoots: [this.currentPaths.attachmentsPath]
    }
  }

  onVaultChange(listener: (paths: VaultPaths | null) => void): void {
    this.vaultListeners.push(listener)
  }

  onTreeChange(listener: () => void): () => void {
    this.treeChangeListeners.push(listener)
    return () => {
      this.treeChangeListeners = this.treeChangeListeners.filter((item) => item !== listener)
    }
  }

  onReminderClick(listener: (target: ReminderClickTarget) => void): () => void {
    this.reminderClickListeners.push(listener)
    return () => {
      this.reminderClickListeners = this.reminderClickListeners.filter((item) => item !== listener)
    }
  }

  onAgentChatEvent(listener: (event: AgentChatEvent) => void): () => void {
    this.agentChatListeners.push(listener)
    return () => {
      this.agentChatListeners = this.agentChatListeners.filter((item) => item !== listener)
    }
  }

  async listNotes(): ReturnType<FileService['listNotes']> {
    this.assertReady()
    return this.fileService!.listNotes()
  }

  async listFleetingNotes(): Promise<FleetingNote[]> {
    this.assertReady()
    return this.fleetingNoteService!.list()
  }

  async createFleetingNote(content: string): Promise<FleetingNote> {
    this.assertReady()
    return this.fleetingNoteService!.create(content)
  }

  async removeFleetingNote(relPath: string): Promise<void> {
    this.assertReady()
    await this.fleetingNoteService!.delete(relPath)
  }

  async updateFleetingNote(
    relPath: string,
    patch: Partial<
      Pick<FleetingNote, 'content' | 'priority' | 'tags' | 'dueDate' | 'projectId' | 'triageState'>
    >
  ): Promise<FleetingNote> {
    this.assertReady()
    return this.fleetingNoteService!.update(relPath, patch)
  }

  async convertFleetingNote(
    relPath: string,
    target: FleetingConversionTarget
  ): Promise<FleetingConversionResult> {
    return this.enqueueNotebookMutation(async () => {
      this.assertReady()
      const fleetingNote = await this.fleetingNoteService!.read(relPath)

      if (target === 'note') {
        const notePath = await this.fileService!.createNoteWithMarkdown(
          getFleetingTitle(fleetingNote.content),
          fleetingNote.content
        )
        const document = serializeStoredNoteDocument(
          await this.fileService!.readNoteDocument(notePath)
        )
        await this.indexer!.upsertFromRaw({
          id: createStableId(notePath),
          relPath: notePath,
          content: document,
          updatedAt: new Date().toISOString()
        })
        await this.fleetingNoteService!.delete(fleetingNote.relPath)
        this.notifyTreeChange()
        return {
          sourceRelPath: fleetingNote.relPath,
          target,
          noteRelPath: notePath
        }
      }

      const task = createTaskFromFleetingNote(fleetingNote.content)
      await this.mutateSettings((settings) => {
        const nextTasks = [...settings.calendarTasks, task]
        return {
          next: {
            calendarTasks: nextTasks,
            tasks: nextTasks
          },
          result: task
        }
      })
      await this.fleetingNoteService!.delete(fleetingNote.relPath)
      return {
        sourceRelPath: fleetingNote.relPath,
        target,
        task
      }
    })
  }

  async listNoteTree(): ReturnType<FileService['listTree']> {
    this.assertReady()
    return this.fileService!.listTree()
  }

  async readNote(relPath: string): Promise<string> {
    this.assertReady()
    return this.fileService!.readNote(relPath)
  }

  async readNoteDocument(relPath: string): Promise<StoredNoteDocument> {
    this.assertReady()
    return this.fileService!.readNoteDocument(relPath)
  }

  async readExcalidrawFileDocument(relPath: string): Promise<ExcalidrawFileReadResult> {
    return this.enqueueNotebookMutation(async () => {
      this.assertReady()
      return this.fileService!.readExcalidrawFileDocument(relPath)
    })
  }

  async writeNote(relPath: string, content: string): Promise<void> {
    return this.enqueueNotebookMutation(async () => {
      this.assertReady()
      await this.fileService!.writeNote(relPath, content)
      const fresh = await this.fileService!.readNoteDocument(relPath)
      await this.indexer!.upsertFromRaw({
        id: createStableId(relPath),
        relPath: sanitizeNotePath(relPath),
        content: serializeStoredNoteDocument(fresh),
        updatedAt: new Date().toISOString()
      })
      this.notifyTreeChange()
    })
  }

  async writeNoteDocument(relPath: string, document: StoredNoteDocument): Promise<void> {
    return this.enqueueNotebookMutation(async () => {
      this.assertReady()
      await this.fileService!.writeNoteDocument(relPath, document)
      await this.indexer!.upsertFromRaw({
        id: createStableId(relPath),
        relPath: sanitizeNotePath(relPath),
        content: serializeStoredNoteDocument(document),
        updatedAt: new Date().toISOString()
      })
      this.notifyTreeChange()
    })
  }

  async writeExcalidrawFileDocument(
    relPath: string,
    document: StoredExcalidrawFileDocument
  ): Promise<void> {
    return this.enqueueNotebookMutation(async () => {
      this.assertReady()
      await this.fileService!.writeExcalidrawFileDocument(relPath, document)
    })
  }

  async createNote(name: string): Promise<string> {
    return this.enqueueNotebookMutation(async () => {
      this.assertReady()
      const relPath = await this.fileService!.createNote(name)
      const content = serializeStoredNoteDocument(await this.fileService!.readNoteDocument(relPath))
      await this.indexer!.upsertFromRaw({
        id: createStableId(relPath),
        relPath,
        content,
        updatedAt: new Date().toISOString()
      })
      this.notifyTreeChange()
      return relPath
    })
  }

  async createNoteAtPath(relPath: string): Promise<string> {
    return this.enqueueNotebookMutation(async () => {
      this.assertReady()
      this.assertNoteCreationAllowed(relPath)
      const nextRelPath = await this.fileService!.createNoteAtPath(relPath)
      const content = serializeStoredNoteDocument(
        await this.fileService!.readNoteDocument(nextRelPath)
      )
      await this.indexer!.upsertFromRaw({
        id: createStableId(nextRelPath),
        relPath: nextRelPath,
        content,
        updatedAt: new Date().toISOString()
      })
      this.notifyTreeChange()
      return nextRelPath
    })
  }

  async createExcalidrawFileAtPath(relPath: string): Promise<string> {
    return this.enqueueNotebookMutation(async () => {
      this.assertReady()
      const normalizedPath = withExcalidrawExtension(relPath)
      await this.assertFileCreationAllowed(normalizedPath)

      for (let attempt = 0; attempt < 1000; attempt += 1) {
        const nextRelPath = await findAvailableExcalidrawRelPath(
          this.currentPaths!.notebooksPath,
          normalizedPath
        )

        try {
          const createdPath = await this.fileService!.createExcalidrawFileAtPath(nextRelPath)
          this.notifyTreeChange()
          return createdPath
        } catch (error) {
          if (!isFileExistsError(error)) {
            throw error
          }
        }
      }

      throw new Error('Could not create a unique drawing name')
    })
  }

  async createNoteWithTags(name: string, tags: string[]): Promise<string> {
    return this.enqueueNotebookMutation(async () => {
      this.assertReady()
      const relPath = await this.fileService!.createNoteWithTags(name, tags)
      const content = serializeStoredNoteDocument(await this.fileService!.readNoteDocument(relPath))
      await this.indexer!.upsertFromRaw({
        id: createStableId(relPath),
        relPath,
        content,
        updatedAt: new Date().toISOString()
      })
      this.notifyTreeChange()
      return relPath
    })
  }

  async createFolder(relPath: string): Promise<string> {
    return this.enqueueNotebookMutation(async () => {
      this.assertReady()
      await this.assertFolderCreationAllowed(relPath)
      const nextRelPath = await this.fileService!.createFolder(relPath)
      await this.indexer!.rebuild(this.currentPaths!.notebooksPath)
      this.notifyTreeChange()
      return nextRelPath
    })
  }

  async importNotes(): Promise<NoteImportResult> {
    this.assertReady()
    const result = await dialog.showOpenDialog({
      title: 'Import markdown notes',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { imported: [], failed: [] }
    }

    return this.enqueueNotebookMutation(async () => {
      this.assertReady()
      const imported: NoteImportResult['imported'] = []
      const failed: NoteImportResult['failed'] = []

      for (const sourcePath of result.filePaths) {
        try {
          const [nextImported] = await this.fileService!.importNotes([sourcePath])
          const content = serializeStoredNoteDocument(
            await this.fileService!.readNoteDocument(nextImported.relPath)
          )
          await this.indexer!.upsertFromRaw({
            id: createStableId(nextImported.relPath),
            relPath: nextImported.relPath,
            content,
            updatedAt: new Date().toISOString()
          })
          imported.push(nextImported)
        } catch (error) {
          failed.push({
            sourceName: path.basename(sourcePath),
            error: String(error)
          })
        }
      }

      if (imported.length > 0) {
        this.notifyTreeChange()
      }
      return { imported, failed }
    })
  }

  async migrateBlockNoteNotes(): Promise<BlockNoteMigrationResult> {
    return this.enqueueNotebookMutation(async () => {
      this.assertReady()
      const result = await this.fileService!.migrateBlockNoteMarkdownNotes()
      if (result.converted > 0) {
        await this.indexer!.rebuild(this.currentPaths!.notebooksPath)
        this.notifyTreeChange()
      }
      return result
    })
  }

  async migrateTaggedNoteBodyFrontmatter(): Promise<{
    converted: number
    skipped: number
    failed: Array<{
      relPath: string
      error: string
    }>
  }> {
    return this.enqueueNotebookMutation(async () => {
      this.assertReady()
      const result = await this.fileService!.migrateTaggedNoteBodyFrontmatter()
      if (result.converted > 0) {
        await this.indexer!.rebuild(this.currentPaths!.notebooksPath)
        this.notifyTreeChange()
      }
      return result
    })
  }

  async migrateNoteImagePaths(): Promise<NoteImagePathMigrationResult> {
    return this.enqueueNotebookMutation(async () => {
      this.assertReady()
      const result = await this.fileService!.migrateNoteImagePaths()
      if (result.converted > 0) {
        await this.indexer!.rebuild(this.currentPaths!.notebooksPath)
        this.notifyTreeChange()
      }
      return result
    })
  }

  async renameNote(oldPath: string, newPath: string): Promise<void> {
    return this.enqueueNotebookMutation(async () => {
      this.assertReady()
      await this.fileService!.rename(oldPath, newPath)
      await this.indexer!.deleteByRelPath(sanitizeNotePath(oldPath))
      const content = serializeStoredNoteDocument(await this.fileService!.readNoteDocument(newPath))
      await this.indexer!.upsertFromRaw({
        id: createStableId(newPath),
        relPath: sanitizeNotePath(newPath),
        content,
        updatedAt: new Date().toISOString()
      })
      this.notifyTreeChange()
    })
  }

  async renamePath(oldPath: string, newPath: string): Promise<void> {
    return this.enqueueNotebookMutation(async () => {
      this.assertReady()
      await this.assertPathMutationAllowed(oldPath, newPath)
      await this.fileService!.renamePath(oldPath, newPath)
      await this.indexer!.rebuild(this.currentPaths!.notebooksPath)
      this.notifyTreeChange()
    })
  }

  async deleteNote(relPath: string): Promise<void> {
    return this.enqueueNotebookMutation(async () => {
      this.assertReady()
      const safeRelPath = sanitizeNotePath(relPath)
      const trashed = await this.createTrashService().moveEntryToTrash(safeRelPath)
      await this.indexer!.deleteByRelPath(safeRelPath)
      this.pushFileDeleteHistory('Delete note', [trashed])
      this.notifyTreeChange()
    })
  }

  async deletePath(relPath: string): Promise<void> {
    return this.enqueueNotebookMutation(async () => {
      this.assertReady()
      await this.assertPathDeletionAllowed(relPath)
      const trashed = await this.createTrashService().moveEntryToTrash(relPath)
      await this.indexer!.rebuild(this.currentPaths!.notebooksPath)
      this.pushFileDeleteHistory(trashed.kind === 'folder' ? 'Delete folder' : 'Delete note', [
        trashed
      ])
      this.notifyTreeChange()
    })
  }

  async deletePaths(relPaths: string[]): Promise<void> {
    return this.enqueueNotebookMutation(async () => {
      this.assertReady()
      const uniqueRelPaths = Array.from(new Set(relPaths))
      if (uniqueRelPaths.length === 0) {
        return
      }

      for (const relPath of uniqueRelPaths) {
        await this.assertPathDeletionAllowed(relPath)
      }

      const trash = this.createTrashService()
      const trashedEntries: TrashedEntry[] = []
      for (const relPath of uniqueRelPaths) {
        trashedEntries.push(await trash.moveEntryToTrash(relPath))
      }
      await this.indexer!.rebuild(this.currentPaths!.notebooksPath)
      this.pushFileDeleteHistory(
        uniqueRelPaths.length === 1 ? 'Delete item' : 'Delete items',
        trashedEntries
      )
      this.notifyTreeChange()
    })
  }

  async exportNote(relPath: string, content: string): Promise<string | null> {
    this.assertReady()
    const safeRelPath = sanitizeNotePath(relPath)
    const suggestedName = `${path.basename(stripNoteExtension(safeRelPath))}.md`

    const result = await this.showMarkdownExportDialog(
      'Export note',
      this.currentPaths!.rootPath,
      suggestedName
    )

    if (result.canceled || !result.filePath) {
      return null
    }

    await fs.writeFile(result.filePath, content, 'utf-8')
    return result.filePath
  }

  async exportNotePdf(input: NotePdfExportInput): Promise<NotePdfExportResult> {
    this.assertReady()
    const safeRelPath = sanitizeNotePath(input.relPath)
    const suggestedName = `${path.basename(stripNoteExtension(safeRelPath))}.pdf`
    const result = await this.showPdfExportDialog(
      'Export note as PDF',
      this.currentPaths!.rootPath,
      suggestedName
    )

    if (result.canceled || !result.filePath) {
      return { path: null, warnings: [] }
    }

    const printable = await buildNotePdfHtml(
      input.title,
      input.html,
      input.images,
      this.currentPaths!.rootPath
    )
    const imageWarnings = await this.writePdfExport(result.filePath, printable.html)

    return {
      path: result.filePath,
      warnings: [...printable.warnings, ...imageWarnings]
    }
  }

  async exportFolderPdf(input: FolderPdfExportInput): Promise<FolderPdfExportResult> {
    this.assertReady()
    const safeFolderPath = sanitizeEntryPath(input.folderPath)
    const folderDocuments = await this.fileService!.listNoteDocumentsInFolder(safeFolderPath)
    const { notes, warnings: documentWarnings } = folderDocuments

    if (notes.length === 0) {
      return { path: null, noteCount: 0, warnings: documentWarnings }
    }

    const folderName = path.basename(safeFolderPath)
    const suggestedName = `${this.sanitizeExportFileName(folderName)}.pdf`
    const result = await this.showPdfExportDialog(
      'Export nested notes as PDF',
      this.currentPaths!.rootPath,
      suggestedName
    )

    if (result.canceled || !result.filePath) {
      return { path: null, noteCount: notes.length, warnings: [] }
    }

    const printable = await buildFolderPdfHtml(
      folderName,
      notes.map(({ relPath, document }) => ({ relPath, markdown: document.markdown })),
      this.currentPaths!.rootPath
    )
    const imageWarnings = await this.writePdfExport(result.filePath, printable.html)

    return {
      path: result.filePath,
      noteCount: notes.length,
      warnings: [...documentWarnings, ...printable.warnings, ...imageWarnings]
    }
  }

  async exportFolderMarkdown(
    input: FolderMarkdownExportInput
  ): Promise<FolderMarkdownExportResult> {
    this.assertReady()
    const safeFolderPath = sanitizeEntryPath(input.folderPath)
    const folderDocuments = await this.fileService!.listNoteDocumentsInFolder(safeFolderPath)
    const { notes, warnings: documentWarnings } = folderDocuments

    if (notes.length === 0) {
      return { path: null, noteCount: 0, warnings: documentWarnings }
    }

    const folderName = path.basename(safeFolderPath)
    const suggestedName = `${this.sanitizeExportFileName(folderName)}.md`
    const result = await this.showMarkdownExportDialog(
      'Export nested notes as Markdown',
      this.currentPaths!.rootPath,
      suggestedName
    )

    if (result.canceled || !result.filePath) {
      return { path: null, noteCount: notes.length, warnings: [] }
    }

    const content = buildFolderMarkdown(
      folderName,
      notes.map(({ relPath, document }) => ({ relPath, markdown: document.markdown }))
    )
    await fs.writeFile(result.filePath, content, 'utf-8')

    return {
      path: result.filePath,
      noteCount: notes.length,
      warnings: documentWarnings
    }
  }

  private async writePdfExport(filePath: string, html: string): Promise<string[]> {
    const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-note-pdf-'))
    const documentPath = path.join(temporaryDirectory, 'note.html')
    let printWindow: BrowserWindow | null = null

    try {
      await fs.writeFile(documentPath, html, 'utf-8')
      printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true
        }
      })
      await printWindow.loadFile(documentPath)
      const imageWarnings = await waitForPdfImages(printWindow)
      const pdf = await printWindow.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true
      })
      await fs.writeFile(filePath, pdf)

      return imageWarnings
    } finally {
      if (printWindow && !printWindow.isDestroyed()) {
        printWindow.destroy()
      }
      await fs.rm(temporaryDirectory, { recursive: true, force: true })
    }
  }

  async exportProjectContext(
    input: ProjectContextMarkdownExportInput
  ): Promise<ProjectContextMarkdownExportResult> {
    this.assertReady()

    const projectId = input.projectId.trim()
    if (!projectId) {
      throw new Error('Project ID is required')
    }

    const settings = await this.getSettings()
    const project = resolveProjectById(settings.projects, projectId)
    const tasks = settings.calendarTasks.filter((task) => task.projectId === project.id)
    const updates = (project.updates ?? []).filter((update) => update.projectId === project.id)
    const notebookPath = getProjectNotebookPath(project)
    let notes: Array<{ relPath: string; markdown: string }> = []
    const warnings: string[] = []

    try {
      const folderDocuments = await this.fileService!.listNoteDocumentsInFolder(notebookPath)
      notes = folderDocuments.notes.map(({ relPath, document }) => ({
        relPath,
        markdown: document.markdown
      }))
      warnings.push(...folderDocuments.warnings)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      warnings.push(`Unable to read linked notebook folder "${notebookPath}": ${message}`)
    }

    const resourceContext = await this.resourceService!.contextForProject(project.id)
    const externalDocuments = await this.loadProjectGoogleDocSources(
      resourceContext.resources,
      GOOGLE_DRIVE_CONTENT_MAX_CHARS
    )
    warnings.push(...externalDocuments.warnings)

    const content = buildProjectMarkdown({
      project,
      notebookPath,
      tasks,
      updates,
      notes,
      externalDocuments: externalDocuments.documents,
      exportedAt: new Date().toISOString()
    })
    const downloadsPath = app.getPath('downloads')
    const suggestedName = `${this.sanitizeExportFileName(project.name)} - Project Context.md`
    const result = await this.showMarkdownExportDialog(
      'Export project context',
      downloadsPath,
      suggestedName
    )

    if (result.canceled || !result.filePath) {
      return {
        path: null,
        noteCount: notes.length,
        taskCount: tasks.length,
        updateCount: updates.length,
        externalDocumentCount: externalDocuments.documents.length,
        warnings
      }
    }

    await fs.writeFile(result.filePath, content, 'utf-8')
    return {
      path: result.filePath,
      noteCount: notes.length,
      taskCount: tasks.length,
      updateCount: updates.length,
      externalDocumentCount: externalDocuments.documents.length,
      warnings
    }
  }

  async chooseDirectory(title: string): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title,
      properties: ['openDirectory']
    })

    if (result.canceled) {
      return null
    }

    return result.filePaths[0] ?? null
  }

  async choosePath(title: string): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title,
      properties: ['openFile', 'openDirectory']
    })

    if (result.canceled) {
      return null
    }

    return result.filePaths[0] ?? null
  }

  async openPath(targetPath: string): Promise<void> {
    const openError = await shell.openPath(targetPath)
    if (openError) {
      throw new Error(openError)
    }
  }

  async openExternal(url: string): Promise<void> {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Only HTTP and HTTPS URLs can be opened externally')
    }
    await shell.openExternal(parsed.toString())
  }

  async listResources(): Promise<import('./resourceStore').ResourceStoreSnapshot> {
    this.assertReady()
    return this.resourceService!.list()
  }

  async addResource(input: ResourceInput): Promise<ResourceRef> {
    this.assertReady()
    const settings = await this.getSettings()
    const featureFlags = {
      ...createDefaultAppSettings().featureFlags,
      ...(settings.featureFlags ?? {})
    }
    if (!featureFlags.resources) {
      throw new Error('Resource links are disabled for this vault')
    }
    if (input.provider === 'filesystem' && !featureFlags.filesystemResources) {
      throw new Error('Filesystem resources are disabled for this vault')
    }
    if (input.type === 'external' && input.canonicalUri) {
      assertExternalResourceUri(input.canonicalUri)
    }
    const resource = await this.resourceService!.add(input)
    await this.refreshResourceSearchCache()
    if (input.projectId) {
      await this.resourceService!.relate({
        type: 'project_contains_resource',
        fromId: input.projectId,
        fromKind: 'project',
        toId: resource.id,
        toKind: 'resource'
      })
      await this.mutateSettings(
        (current) => {
          const projects = current.projects.map((project) =>
            project.id === input.projectId
              ? {
                  ...project,
                  resourceRefs: Array.from(
                    new Map(
                      [...(project.resourceRefs ?? []), resource].map((item) => [item.id, item])
                    ).values()
                  )
                }
              : project
          )
          return { next: { projects }, result: resource }
        },
        { label: 'Attach resource to project' }
      )
    }
    return resource
  }

  async updateResource(input: {
    resourceId: string
    canonicalUri?: string
    title?: string
  }): Promise<ResourceRef> {
    this.assertReady()
    const snapshot = await this.resourceService!.list()
    const existing = snapshot.resources.find((resource) => resource.id === input.resourceId)
    if (!existing) throw new Error(`Resource not found: ${input.resourceId}`)
    if (existing.type === 'external' && input.canonicalUri) {
      assertExternalResourceUri(input.canonicalUri)
    }
    const resource = await this.resourceService!.update(input.resourceId, input)
    await this.mutateSettings(
      (current) => ({
        next: {
          projects: current.projects.map((project) => ({
            ...project,
            resourceRefs: project.resourceRefs?.map((ref) =>
              ref.id === resource.id ? resource : ref
            )
          }))
        },
        result: resource
      }),
      { label: 'Update resource' }
    )
    await this.refreshResourceSearchCache()
    return resource
  }

  async setProjectNotebook(input: {
    projectId: string
    notebookPath: string
  }): Promise<ResourceRef> {
    this.assertReady()
    const notebookPath = input.notebookPath.trim()
    if (!isVaultRelativePath(notebookPath)) {
      throw new Error('Notebook path must be vault-relative')
    }

    const settings = await this.getSettings()
    const project = resolveProjectById(settings.projects, input.projectId)
    const existingNotebook = project.resourceRefs?.find((resource) => resource.type === 'notebook')
    const canonicalUri = notebookResourceUri(notebookPath)
    if (existingNotebook?.canonicalUri === canonicalUri) return existingNotebook

    return this.addResource({
      type: 'notebook',
      canonicalUri,
      title: notebookPath.split('/').pop() ?? project.name,
      projectId: project.id
    })
  }

  async detachResource(input: { projectId: string; resourceId: string }): Promise<void> {
    this.assertReady()
    await this.resourceService!.detachFromProject(input.projectId, input.resourceId)
    await this.mutateSettings(
      (current) => ({
        next: {
          projects: current.projects.map((project) =>
            project.id === input.projectId
              ? {
                  ...project,
                  resourceRefs: project.resourceRefs?.filter(
                    (resource) => resource.id !== input.resourceId
                  )
                }
              : project
          )
        },
        result: undefined
      }),
      { label: 'Detach resource from project' }
    )
    await this.refreshResourceSearchCache()
  }

  async refreshResource(resourceId: string): Promise<ResourceHealth> {
    this.assertReady()
    const health = await this.resourceService!.refresh(resourceId)
    await this.refreshResourceSearchCache()
    return health
  }

  async locateResource(resourceId: string, nextPath: string): Promise<ResourceRef> {
    this.assertReady()
    const resource = await this.resourceService!.locate(resourceId, nextPath)
    await this.refreshResourceSearchCache()
    return resource
  }

  async previewResource(resourceId: string, allowContent = false): Promise<ResourcePreview> {
    this.assertReady()
    const settings = await this.getSettings()
    const featureFlags = {
      ...createDefaultAppSettings().featureFlags,
      ...(settings.featureFlags ?? {})
    }
    const resource = (await this.resourceService!.list()).resources.find(
      (candidate) => candidate.id === resourceId
    )
    if (
      resource?.provider === 'google-drive' &&
      allowContent &&
      featureFlags.googleDriveContentIndexing &&
      this.googleDriveService
    ) {
      return this.googleDriveService.preview(resourceId, true)
    }
    return this.resourceService!.preview(
      resourceId,
      allowContent && featureFlags.filesystemContentIndexing
    )
  }

  async relateResource(input: {
    type: ResourceRelation['type']
    fromId: string
    fromKind: string
    toId: string
    toKind: string
    confidence?: ResourceRelation['confidence']
  }): Promise<ResourceRelation> {
    this.assertReady()
    return this.resourceService!.relate(input)
  }

  async getProjectResourceContext(projectId: string): Promise<ResourceContextBundle> {
    this.assertReady()
    const bundle = await this.resourceService!.contextForProject(projectId)
    const externalDocuments = await this.loadProjectGoogleDocSources(
      bundle.resources,
      AGENT_GOOGLE_DOC_EXCERPT_MAX_CHARS,
      AGENT_GOOGLE_DOC_TOTAL_MAX_CHARS
    )
    const excerpts = new Map(
      externalDocuments.documents
        .filter((document) => Boolean(document.markdown?.trim()))
        .map((document) => [document.canonicalUri, document.markdown as string])
    )
    return {
      ...bundle,
      citations: bundle.citations.map((citation) => {
        const excerpt = excerpts.get(citation.uri)
        return excerpt ? { ...citation, excerpt } : citation
      })
    }
  }

  async openResource(resourceId: string): Promise<void> {
    this.assertReady()
    const snapshot = await this.resourceService!.list()
    const resource = snapshot.resources.find((candidate) => candidate.id === resourceId)
    if (!resource) throw new Error(`Resource not found: ${resourceId}`)
    if (resource.type === 'notebook') {
      const notebookPath = notebookPathFromResource(resource)
      if (!notebookPath) throw new Error('Invalid notebook resource')
      await this.openPath(assertPathInVault(this.currentPaths!, notebookPath, 'notes'))
      return
    }
    if (resource.provider === 'filesystem') {
      await this.openPath(decodeFileUri(resource.canonicalUri))
      return
    }
    await shell.openExternal(assertExternalResourceUri(resource.canonicalUri))
  }

  async revealResource(resourceId: string): Promise<void> {
    this.assertReady()
    const snapshot = await this.resourceService!.list()
    const resource = snapshot.resources.find((candidate) => candidate.id === resourceId)
    if (!resource) throw new Error(`Resource not found: ${resourceId}`)
    if (resource.type === 'notebook') {
      const notebookPath = notebookPathFromResource(resource)
      if (!notebookPath) throw new Error('Invalid notebook resource')
      shell.showItemInFolder(assertPathInVault(this.currentPaths!, notebookPath, 'notes'))
      return
    }
    if (resource.provider !== 'filesystem') {
      await shell.openExternal(assertExternalResourceUri(resource.canonicalUri))
      return
    }
    shell.showItemInFolder(decodeFileUri(resource.canonicalUri))
  }

  async previewResourceWrite(input: ResourceWriteInput): Promise<ResourceWritePreview> {
    this.assertReady()
    const settings = await this.getSettings()
    if (!settings.featureFlags?.externalWrites) {
      throw new Error('External writes are disabled for this vault')
    }
    return this.resourceWriteService!.preview(input)
  }

  async applyResourceWrite(
    input: ResourceWriteInput,
    confirmation: boolean
  ): Promise<ResourceWritePreview> {
    this.assertReady()
    const settings = await this.getSettings()
    if (!settings.featureFlags?.externalWrites) {
      throw new Error('External writes are disabled for this vault')
    }
    return this.resourceWriteService!.apply(input, confirmation)
  }

  async listResourceWriteAudit(): Promise<ResourceWriteAuditRecord[]> {
    this.assertReady()
    return this.resourceWriteService!.audit()
  }

  async startGoogleDriveAuthorization(): Promise<
    import('./googleDriveResourceService').StartedDriveAuthorization
  > {
    this.assertReady()
    const settings = await this.getSettings()
    if (!settings.featureFlags?.googleDriveResources) {
      throw new Error('Google Drive resources are disabled for this vault')
    }
    if (!this.googleDriveService) {
      throw new Error(
        'Google Drive is not configured. Set XINGULARITY_GOOGLE_CLIENT_ID and XINGULARITY_GOOGLE_REDIRECT_URI.'
      )
    }
    return this.googleDriveService.startAuthorization()
  }

  async completeGoogleDriveAuthorization(input: {
    connectionId: string
    code: string
    state: string
  }): Promise<void> {
    this.assertReady()
    if (!this.googleDriveService) throw new Error('Google Drive is not configured')
    await this.googleDriveService.completeAuthorization(input.connectionId, input.code, input.state)
  }

  async listGoogleDriveFiles(): Promise<import('../shared/types').GoogleDriveFileCandidate[]> {
    this.assertReady()
    const settings = await this.getSettings()
    if (!settings.featureFlags?.googleDriveResources) {
      throw new Error('Google Drive resources are disabled for this vault')
    }
    if (!this.googleDriveService) throw new Error('Google Drive is not configured')
    return this.googleDriveService.listFiles()
  }

  async attachGoogleDriveResources(input: {
    fileIds: string[]
    projectId?: string
  }): Promise<ResourceRef[]> {
    this.assertReady()
    const settings = await this.getSettings()
    if (!settings.featureFlags?.googleDriveResources) {
      throw new Error('Google Drive resources are disabled for this vault')
    }
    if (!this.googleDriveService) throw new Error('Google Drive is not configured')
    const resources = await this.googleDriveService.listAndAttach(input.fileIds, input.projectId)
    if (input.projectId && resources.length > 0) {
      await this.mutateSettings(
        (current) => {
          const projects = current.projects.map((project) =>
            project.id === input.projectId
              ? {
                  ...project,
                  resourceRefs: Array.from(
                    new Map(
                      [...(project.resourceRefs ?? []), ...resources].map((item) => [item.id, item])
                    ).values()
                  )
                }
              : project
          )
          return { next: { projects }, result: undefined }
        },
        { label: 'Attach Google Drive resources to project' }
      )
    }
    await this.refreshResourceSearchCache()
    return resources
  }

  private async loadProjectGoogleDocSources(
    resources: readonly ResourceRef[],
    maxCharsPerDocument: number,
    maxTotalChars = Number.POSITIVE_INFINITY
  ): Promise<{ documents: ProjectMarkdownExternalDocument[]; warnings: string[] }> {
    const googleDocs = resources.filter(
      (resource) =>
        resource.provider === 'google-drive' &&
        resource.kind === 'google-doc' &&
        Boolean(resource.externalId)
    )
    const documents: ProjectMarkdownExternalDocument[] = googleDocs.map((resource) => ({
      title: resource.title,
      canonicalUri: resource.canonicalUri,
      ...(typeof resource.metadata?.modifiedTime === 'string'
        ? { modifiedAt: resource.metadata.modifiedTime }
        : {})
    }))
    const warnings: string[] = []

    if (googleDocs.length === 0) {
      return { documents, warnings }
    }

    const settings = await this.getSettings()
    const featureFlags = {
      ...createDefaultAppSettings().featureFlags,
      ...(settings.featureFlags ?? {})
    }
    if (!featureFlags.googleDriveContentIndexing) {
      warnings.push(
        'Google Drive content indexing is disabled; linked Docs were exported as sources only'
      )
      return { documents, warnings }
    }
    if (!this.googleDriveService) {
      warnings.push('Google Drive is not configured; linked Docs were exported as sources only')
      return { documents, warnings }
    }

    let remainingChars = Math.max(0, maxTotalChars)
    const boundedPerDocument = Math.min(
      Math.max(0, maxCharsPerDocument),
      GOOGLE_DRIVE_CONTENT_MAX_CHARS
    )

    for (const [index, resource] of googleDocs.entries()) {
      if (remainingChars === 0) {
        warnings.push('Google Drive project context content budget was exhausted')
        break
      }

      try {
        const preview = await this.googleDriveService.preview(resource.id, true)
        if (preview.error) {
          throw new Error(preview.error)
        }
        const text = preview.text ?? ''
        const maxChars = Math.min(boundedPerDocument, remainingChars)
        documents[index] = {
          ...documents[index],
          ...(text ? { markdown: text.slice(0, maxChars) } : {}),
          truncated: preview.truncated || text.length > maxChars
        }
        remainingChars -= Math.min(text.length, maxChars)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        warnings.push(`Unable to read linked Google Doc "${resource.title}": ${message}`)
      }
    }

    return { documents, warnings }
  }

  async refreshGoogleDriveChanges(pageToken: string): Promise<{
    resources: ResourceRef[]
    nextPageToken?: string
    newStartPageToken?: string
  }> {
    this.assertReady()
    if (!this.googleDriveService) throw new Error('Google Drive is not configured')
    const result = await this.googleDriveService.refreshChanges(pageToken)
    await this.refreshResourceSearchCache()
    return result
  }

  async disconnectGoogleDrive(): Promise<void> {
    this.assertReady()
    if (!this.googleDriveService) return
    await this.googleDriveService.disconnect()
    await this.refreshResourceSearchCache()
  }

  async openWarpAtNotePath(relPath: string): Promise<void> {
    this.assertReady()
    const safeRelPath = sanitizeNotePath(relPath)
    const notePath = assertPathInVault(this.currentPaths!, safeRelPath, 'notes')
    await shell.openExternal(createWarpNewTabUri(path.dirname(notePath)))
  }

  private async showMarkdownExportDialog(
    title: string,
    basePath: string,
    suggestedName: string
  ): Promise<Electron.SaveDialogReturnValue> {
    return dialog.showSaveDialog({
      title,
      defaultPath: path.join(basePath, suggestedName),
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
  }

  private async showPdfExportDialog(
    title: string,
    basePath: string,
    suggestedName: string
  ): Promise<Electron.SaveDialogReturnValue> {
    return dialog.showSaveDialog({
      title,
      defaultPath: path.join(basePath, suggestedName),
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
  }

  private sanitizeExportFileName(input: string): string {
    const invalidFileNameCharacters = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*'])
    const sanitized = Array.from(input.trim())
      .map((character) =>
        character.charCodeAt(0) <= 31 || invalidFileNameCharacters.has(character) ? '-' : character
      )
      .join('')

    return (
      sanitized
        .replace(/\s+/g, ' ')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120) || 'untitled-project'
    )
  }

  search(query: string): SearchResult[] {
    this.assertReady()
    const localResults = this.indexer!.query(query)
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return localResults
    const resourceResults = this.resourceSearchCache.filter((result) =>
      `${result.title} ${result.snippet} ${result.provider ?? ''} ${result.state ?? ''}`
        .toLocaleLowerCase()
        .includes(normalized)
    )
    return [...localResults, ...resourceResults].slice(0, 100)
  }

  private async refreshResourceSearchCache(): Promise<void> {
    if (!this.resourceService) {
      this.resourceSearchCache = []
      return
    }
    const settings = await this.getSettings()
    const featureFlags = {
      ...createDefaultAppSettings().featureFlags,
      ...(settings.featureFlags ?? {})
    }
    const snapshot = await this.resourceService.list()
    this.resourceSearchCache = await Promise.all(
      snapshot.resources.map(async (resource) => {
        let contentSnippet = ''
        if (featureFlags.filesystemContentIndexing && resource.provider === 'filesystem') {
          const preview = await this.resourceService!.preview(resource.id, true)
          contentSnippet = preview.text?.slice(0, 1_000) ?? ''
        }
        return {
          id: resource.id,
          relPath: resource.canonicalUri,
          title: resource.title,
          tags: [],
          updated: resource.updatedAt,
          snippet: `${resource.provider} · ${resourceStateForSearch(resource.state)}${resource.lastSeenAt ? ` · observed ${resource.lastSeenAt}` : ''}${contentSnippet ? ` · ${contentSnippet}` : ''}`,
          entityType: 'resource' as const,
          target: {
            kind: 'resource' as const,
            id: resource.id,
            relPath: resource.canonicalUri
          },
          resourceId: resource.id,
          provider: resource.provider,
          freshness: resource.freshness,
          access: resource.access,
          state: resource.state,
          projectId: resource.projectIds?.[0]
        }
      })
    )
  }

  async importAttachment(sourcePath: string): Promise<string> {
    this.assertReady()
    return this.fileService!.importAttachment(sourcePath)
  }

  async importAttachmentFromBuffer(buffer: Uint8Array, fileExtension: string): Promise<string> {
    this.assertReady()
    return this.fileService!.importAttachmentFromBuffer(buffer, fileExtension)
  }

  async completeNoteWithAi(input: CompleteNoteWithAiInput): Promise<string> {
    this.assertReady()

    const startedAt = new Date().toISOString()
    const model = 'mistral-small-latest'
    const baseRun: AgentRunRecord = {
      id: `agent-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      agentName: 'Mistral Note Completion',
      source: 'note_completion',
      startedAt,
      status: 'running',
      input: input.prompt,
      output: '',
      model,
      context: {
        notePath: input.notePath,
        trigger: 'command_palette'
      }
    }

    const apiKey = (await this.credentialStore.get('mistral', this.getCurrentVaultRoot())) ?? ''
    try {
      if (!apiKey) {
        throw new Error('Add your Mistral API key in Settings before using AI note completion')
      }

      const mistral = new Mistral({ apiKey })
      const response = await mistral.chat.complete({
        model,
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content:
              'You are an AI writing assistant for rich text notes. Continue or improve the user note based on their instruction. Return only the plain text to add next, with no labels or explanation.'
          },
          {
            role: 'user',
            content: [
              `Note path: ${input.notePath}`,
              `Instruction: ${input.prompt}`,
              'Current note content:',
              input.noteContent
            ].join('\n\n')
          }
        ]
      })

      const completion = extractMistralText(response).trim()
      if (!completion) {
        throw new Error('Mistral did not return any completion text')
      }

      await this.recordAgentRun({
        ...baseRun,
        endedAt: new Date().toISOString(),
        status: 'success',
        output: completion
      })

      return completion
    } catch (error) {
      await this.recordAgentRun({
        ...baseRun,
        endedAt: new Date().toISOString(),
        status: 'error',
        errorMessage: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  async chatWithAgent(input: AgentChatMessageInput): Promise<AgentChatMessageResult> {
    this.assertReady()

    const requestId =
      input.requestId ?? `request-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const startedAt = new Date().toISOString()
    const model = 'mistral-small-latest'
    const baseRun: AgentRunRecord = {
      id: `agent-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      agentName: 'Workspace Agent Chat',
      source: 'agent_chat',
      startedAt,
      status: 'running',
      input: input.message,
      output: '',
      model,
      context: {
        trigger: 'agent_chat'
      }
    }

    this.cancelledAgentRequests.delete(requestId)
    const abortController = new AbortController()
    this.agentAbortControllers.set(requestId, abortController)

    try {
      const settings = await this.getSettings()
      const apiKey = (await this.credentialStore.get('mistral', this.getCurrentVaultRoot())) ?? ''
      this.emitAgentChatEvent({ requestId, type: 'status', status: 'started' })
      if (!apiKey) {
        throw new Error('Add your Mistral API key in Settings before using Agent Chat')
      }

      const contexts = await this.resolveAgentChatContexts(input.mentions, settings)
      const mistral = new Mistral({ apiKey })
      const { content, toolSteps } = await this.runAgentChatLoopFromMessages(
        mistral,
        model,
        buildInitialAgentChatMessages(input.message, contexts),
        requestId,
        abortController.signal
      )
      if (!content) {
        throw new Error('Mistral did not return any agent response text')
      }

      await this.recordAgentRun({
        ...baseRun,
        endedAt: new Date().toISOString(),
        status: 'success',
        output: content
      })

      return {
        id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'assistant',
        content,
        createdAt: new Date().toISOString(),
        model,
        contexts: contexts.map(({ summary }) => summary),
        toolSteps
      }
    } catch (error) {
      const cancelled = abortController.signal.aborted || this.cancelledAgentRequests.has(requestId)
      await this.recordAgentRun({
        ...baseRun,
        endedAt: new Date().toISOString(),
        status: cancelled ? 'cancelled' : 'error',
        errorMessage: cancelled
          ? 'Agent request cancelled'
          : error instanceof Error
            ? error.message
            : String(error)
      })
      if (cancelled) {
        throw new Error('Agent request cancelled')
      }
      throw error
    } finally {
      this.agentAbortControllers.delete(requestId)
      this.cancelledAgentRequests.delete(requestId)
      this.emitAgentChatEvent({ requestId, type: 'status', status: 'finished' })
    }
  }

  cancelAgentChat(requestId: string): boolean {
    if (!requestId.trim()) return false
    const abortController = this.agentAbortControllers.get(requestId)
    if (!abortController) return false
    this.cancelledAgentRequests.add(requestId)
    abortController.abort()
    this.emitAgentChatEvent({
      requestId,
      type: 'status',
      status: 'thinking',
      message: 'cancelling'
    })
    return true
  }

  async listAgentRuns(): Promise<AgentRunRecord[]> {
    this.assertReady()
    return this.getAgentHistoryStore().readRuns()
  }

  async listAgentChatSessions(): Promise<AgentChatSession[]> {
    this.assertReady()
    return this.getAgentChatStore().listSessions()
  }

  async saveAgentChatSession(session: AgentChatSession): Promise<AgentChatSession> {
    this.assertReady()
    const titleMode = session.titleMode ?? 'auto'
    return this.getAgentChatStore().saveSession({
      ...session,
      title:
        titleMode === 'manual'
          ? truncateText(session.title.trim() || 'New chat', 60)
          : deriveAgentChatTitle(session.messages, session.title),
      titleMode,
      updatedAt: new Date().toISOString(),
      messages: session.messages.map((message) => sanitizeAgentChatMessage(message))
    })
  }

  async deleteAgentChatSession(sessionId: string): Promise<void> {
    this.assertReady()
    await this.getAgentChatStore().deleteSession(sessionId)
  }

  async listExcalidrawSessions(): Promise<ExcalidrawSession[]> {
    this.assertReady()
    return this.getExcalidrawSessionStore().listSessions()
  }

  async saveExcalidrawSession(session: ExcalidrawSession): Promise<ExcalidrawSession> {
    this.assertReady()
    return this.getExcalidrawSessionStore().saveSession(session)
  }

  async deleteExcalidrawSession(sessionId: string): Promise<void> {
    this.assertReady()
    await this.getExcalidrawSessionStore().deleteSession(sessionId)
  }

  async importLegacyExcalidrawSessions(): Promise<LegacyExcalidrawImportResult> {
    return this.enqueueNotebookMutation(async () => {
      this.assertReady()
      const sessions = await this.getExcalidrawSessionStore().listSessions()
      const result: LegacyExcalidrawImportResult = {
        imported: [],
        skipped: [],
        failed: []
      }

      for (const session of sessions) {
        try {
          const preferredRelPath = withExcalidrawExtension(`Imported Drawings/${session.title}`)
          const relPath = await findAvailableExcalidrawRelPath(
            this.currentPaths!.notebooksPath,
            preferredRelPath
          )

          await this.fileService!.createExcalidrawFileAtPath(relPath)
          await this.fileService!.writeExcalidrawFileDocument(relPath, {
            version: 1,
            scene: session.scene ?? createEmptyExcalidrawFileDocument().scene
          })
          result.imported.push({
            sourceId: session.id,
            relPath
          })
        } catch (error) {
          result.failed.push({
            sourceId: session.id,
            error: String(error)
          })
        }
      }

      if (result.imported.length > 0) {
        this.notifyTreeChange()
      }
      return result
    })
  }

  async approveAgentChatTool(input: {
    requestId?: string
    stepId: string
    toolName: string
    input: unknown
    sessionMessages?: AgentChatMessageRecord[]
  }): Promise<AgentChatApprovedToolResult> {
    this.assertReady()

    const requestId =
      input.requestId ?? `request-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const startedAt = new Date().toISOString()
    const model = 'mistral-small-latest'
    const baseRun: AgentRunRecord = {
      id: `agent-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      agentName: 'Approved Agent Tool Execution',
      source: 'agent_chat_approval',
      startedAt,
      status: 'running',
      input: `${input.toolName} ${summarizeData(input.input)}`,
      output: '',
      model,
      context: {
        trigger: 'agent_chat_approval'
      }
    }

    try {
      this.emitAgentChatEvent({ requestId, type: 'status', status: 'started' })
      const output = await this.executeAgentToolWithApproval(input.toolName, input.input)
      const toolStep = {
        id: input.stepId,
        toolName: input.toolName,
        status: 'completed' as const,
        inputSummary: summarizeData(input.input),
        outputSummary: summarizeData(output)
      }
      this.emitAgentChatEvent({ requestId, type: 'tool-step', toolStep })
      const assistantMessage: AgentChatApprovedToolResult['assistantMessage'] = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'assistant' as const,
        content: '',
        createdAt: new Date().toISOString(),
        toolSteps: [toolStep],
        model
      }

      const apiKey = (await this.credentialStore.get('mistral', this.getCurrentVaultRoot())) ?? ''
      if (apiKey && input.sessionMessages?.length) {
        const mistral = new Mistral({ apiKey })
        const continuation = await this.runAgentChatLoopFromMessages(
          mistral,
          model,
          buildApprovalContinuationMessages(
            input.sessionMessages,
            input.toolName,
            input.input,
            output
          ),
          requestId
        )
        assistantMessage.content =
          continuation.content || buildApprovedToolSuccessMessage(input.toolName, output)
        assistantMessage.toolSteps = [toolStep, ...continuation.toolSteps]
      } else {
        assistantMessage.content = buildApprovedToolSuccessMessage(input.toolName, output)
        await emitChunkedAgentText((delta) => {
          this.emitAgentChatEvent({ requestId, type: 'text-delta', delta })
        }, assistantMessage.content)
      }

      await this.recordAgentRun({
        ...baseRun,
        endedAt: new Date().toISOString(),
        status: 'success',
        output: assistantMessage.content
      })

      return { toolStep, assistantMessage }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const toolStep = {
        id: input.stepId,
        toolName: input.toolName,
        status: 'error' as const,
        inputSummary: summarizeData(input.input),
        outputSummary: errorMessage
      }
      this.emitAgentChatEvent({ requestId, type: 'tool-step', toolStep })
      const assistantMessage = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'assistant' as const,
        content: buildApprovedToolErrorMessage(input.toolName, errorMessage),
        createdAt: new Date().toISOString(),
        toolSteps: [toolStep],
        model
      }

      await this.recordAgentRun({
        ...baseRun,
        endedAt: new Date().toISOString(),
        status: 'error',
        errorMessage
      })
      await emitChunkedAgentText((delta) => {
        this.emitAgentChatEvent({ requestId, type: 'text-delta', delta })
      }, assistantMessage.content)
      return { toolStep, assistantMessage }
    } finally {
      this.emitAgentChatEvent({ requestId, type: 'status', status: 'finished' })
    }
  }

  async getSettings(): Promise<AppSettings> {
    if (!this.currentPaths) {
      console.log('[VaultRuntime] getSettings requested before vault open')
      return this.getDefaultSettings()
    }

    return this.enqueueSettingsUpdate(async () => {
      const activeRootPath = this.currentPaths?.rootPath
      if (!activeRootPath) {
        console.log('[VaultRuntime] getSettings requested before vault open')
        return this.getDefaultSettings()
      }

      console.log('[VaultRuntime] getSettings for vault', activeRootPath)
      const settings = await this.settings.readVault(activeRootPath)
      // Initialize reminder service with current tasks
      this.reminderService.updateTasks(settings.calendarTasks)
      return settings
    })
  }

  private async getDefaultSettings(): Promise<AppSettings> {
    const defaults = createDefaultAppSettings()
    const global = await this.settings.readGlobal()
    return {
      ...defaults,
      lastVaultPath: global.lastVaultPath
    }
  }

  async getCredentialStatus(provider: string): Promise<import('../shared/types').CredentialStatus> {
    this.assertReady()
    return this.credentialStore.status(provider, this.getCurrentVaultRoot())
  }

  async setCredential(
    provider: string,
    value: string
  ): Promise<import('../shared/types').CredentialStatus> {
    this.assertReady()
    return this.credentialStore.set(provider, this.getCurrentVaultRoot(), value)
  }

  async deleteCredential(provider: string): Promise<void> {
    this.assertReady()
    await this.credentialStore.delete(provider, this.getCurrentVaultRoot())
  }

  async updateSettings(
    next: AppSettingsUpdate,
    options?: AppSettingsUpdateOptions
  ): Promise<AppSettings> {
    return this.updateSettingsInternal(next, {
      recordHistory: options?.history !== false,
      label: 'Update workspace'
    })
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    return this.mutateSettings(
      (settings) => {
        const name = buildProjectName(settings.projects, input.name)
        const description = input.description?.trim() ?? ''
        const now = new Date()
        const startDate = input.startDate ?? toLocalIsoDate(now)
        assertProjectDateRange(startDate, input.endDate)
        const project: Project = {
          id: `project-${randomUUID()}`,
          name,
          summary: description,
          description,
          state: 'active',
          startDate,
          endDate: input.endDate,
          tags: normalizeProjectValues(input.tags),
          resourceRefs: input.resourceRefs,
          timeBudgetMinutes:
            input.timeBudgetMinutes === undefined
              ? undefined
              : Math.max(0, Math.round(input.timeBudgetMinutes)),
          icon: normalizeProjectIcon(input.icon, name),
          updatedAt: now.toISOString()
        }

        return {
          next: {
            projects: [project, ...settings.projects],
            lastOpenedProjectId: project.id
          },
          result: project
        }
      },
      { label: 'Create project' }
    )
  }

  async selectProject(projectId: string | null): Promise<{ projectId: string | null }> {
    return this.mutateSettings(
      (settings) => {
        if (projectId && !settings.projects.some((project) => project.id === projectId)) {
          throw new Error(`Project not found: ${projectId}`)
        }
        return {
          next: { lastOpenedProjectId: projectId },
          result: { projectId }
        }
      },
      { recordHistory: false }
    )
  }

  async updateProject(input: UpdateProjectInput): Promise<Project> {
    return this.mutateSettings(
      (settings) => {
        const existing = resolveProjectById(settings.projects, input.projectId)
        const name = input.name === undefined ? existing.name : input.name.trim()
        if (!name) {
          throw new Error('Project name is required')
        }
        const description =
          input.description === undefined ? existing.description : input.description.trim()
        const startDate =
          input.startDate === null
            ? undefined
            : input.startDate === undefined
              ? existing.startDate
              : input.startDate
        const endDate =
          input.endDate === null
            ? undefined
            : input.endDate === undefined
              ? existing.endDate
              : input.endDate
        assertProjectDateRange(startDate, endDate)
        const updated: Project = {
          ...existing,
          name,
          summary: description ?? existing.summary,
          description,
          icon: input.icon ? normalizeProjectIcon(input.icon, existing.id) : existing.icon,
          startDate,
          endDate,
          tags: input.tags === undefined ? existing.tags : normalizeProjectValues(input.tags),
          resourceRefs:
            input.resourceRefs === undefined ? existing.resourceRefs : input.resourceRefs,
          timeBudgetMinutes:
            input.timeBudgetMinutes === null
              ? undefined
              : input.timeBudgetMinutes === undefined
                ? existing.timeBudgetMinutes
                : Math.max(0, Math.round(input.timeBudgetMinutes)),
          updatedAt: new Date().toISOString()
        }
        return {
          next: {
            projects: settings.projects.map((project) =>
              project.id === updated.id ? updated : project
            )
          },
          result: updated
        }
      },
      { label: 'Update project' }
    )
  }

  async setProjectState(projectId: string, state: ProjectState): Promise<Project> {
    return this.mutateSettings(
      (settings) => {
        const existing = resolveProjectById(settings.projects, projectId)
        const updated: Project = {
          ...existing,
          state,
          updatedAt: new Date().toISOString()
        }
        return {
          next: {
            projects: settings.projects.map((project) =>
              project.id === updated.id ? updated : project
            )
          },
          result: updated
        }
      },
      { label: state === 'archived' ? 'Archive project' : 'Unarchive project' }
    )
  }

  async setProjectFavorite(
    projectId: string,
    favorite: boolean
  ): Promise<{ projectId: string; favorite: boolean }> {
    return this.mutateSettings(
      (settings) => {
        resolveProjectById(settings.projects, projectId)
        const favoriteProjectIds = favorite
          ? [projectId, ...settings.favoriteProjectIds.filter((id) => id !== projectId)]
          : settings.favoriteProjectIds.filter((id) => id !== projectId)
        return {
          next: { favoriteProjectIds },
          result: { projectId, favorite }
        }
      },
      { recordHistory: false }
    )
  }

  async deleteProject(input: DeleteProjectInput): Promise<DeleteProjectResult> {
    return this.mutateSettings(
      (settings) => {
        resolveProjectById(settings.projects, input.projectId)
        const nextProjects = settings.projects.filter((project) => project.id !== input.projectId)
        const linkedTasks = settings.calendarTasks.filter(
          (task) => task.projectId === input.projectId
        )
        const removedTaskIds =
          input.linkedTasks === 'delete' ? linkedTasks.map((task) => task.id) : []
        const unassignedTaskIds =
          input.linkedTasks === 'unassign' ? linkedTasks.map((task) => task.id) : []
        const nextTasks =
          input.linkedTasks === 'delete'
            ? settings.calendarTasks.filter((task) => task.projectId !== input.projectId)
            : settings.calendarTasks.map((task) =>
                task.projectId === input.projectId
                  ? { ...task, projectId: undefined, milestoneId: undefined }
                  : task
              )
        const nextSelectedProjectId =
          settings.lastOpenedProjectId === input.projectId
            ? (nextProjects[0]?.id ?? null)
            : settings.lastOpenedProjectId
        const nextProjectIcons = { ...settings.projectIcons }
        delete nextProjectIcons[input.projectId]

        return {
          next: {
            projects: nextProjects,
            projectIcons: nextProjectIcons,
            tasks: nextTasks,
            calendarTasks: nextTasks,
            favoriteProjectIds: settings.favoriteProjectIds.filter(
              (projectId) => projectId !== input.projectId
            ),
            lastOpenedProjectId: nextSelectedProjectId
          },
          result: {
            deletedProjectId: input.projectId,
            nextSelectedProjectId,
            removedTaskIds,
            unassignedTaskIds
          }
        }
      },
      { label: 'Delete project' }
    )
  }

  async createProjectMilestone(input: CreateProjectMilestoneInput): Promise<ProjectMilestone> {
    return this.mutateSettings(
      (settings) => {
        const project = resolveProjectById(settings.projects, input.projectId)
        const now = new Date().toISOString()
        const milestone: ProjectMilestone = {
          id: `milestone-${randomUUID()}`,
          title: input.title.trim(),
          createdAt: now,
          updatedAt: now
        }
        const updatedProject: Project = {
          ...project,
          milestones: [...(project.milestones ?? []), milestone],
          updatedAt: now
        }

        return {
          next: {
            projects: settings.projects.map((item) =>
              item.id === updatedProject.id ? updatedProject : item
            )
          },
          result: milestone
        }
      },
      { label: 'Create project milestone' }
    )
  }

  async updateProjectMilestone(input: UpdateProjectMilestoneInput): Promise<ProjectMilestone> {
    return this.mutateSettings(
      (settings) => {
        const project = resolveProjectById(settings.projects, input.projectId)
        const existing = resolveProjectMilestone(project, input.milestoneId)
        const updated: ProjectMilestone = {
          ...existing,
          title: input.title.trim(),
          updatedAt: new Date().toISOString()
        }
        const updatedProject: Project = {
          ...project,
          milestones: (project.milestones ?? []).map((milestone) =>
            milestone.id === updated.id ? updated : milestone
          ),
          updatedAt: updated.updatedAt
        }

        return {
          next: {
            projects: settings.projects.map((item) =>
              item.id === updatedProject.id ? updatedProject : item
            )
          },
          result: updated
        }
      },
      { label: 'Update project milestone' }
    )
  }

  async reorderProjectMilestones(input: ReorderProjectMilestonesInput): Promise<Project> {
    return this.mutateSettings(
      (settings) => {
        const project = resolveProjectById(settings.projects, input.projectId)
        const reordered = applyProjectMilestoneOrder(project, input.milestoneIds)
        const updatedProject: Project = {
          ...reordered,
          updatedAt: new Date().toISOString()
        }

        return {
          next: {
            projects: settings.projects.map((item) =>
              item.id === updatedProject.id ? updatedProject : item
            )
          },
          result: updatedProject
        }
      },
      { label: 'Reorder project milestones' }
    )
  }

  async deleteProjectMilestone(
    input: DeleteProjectMilestoneInput
  ): Promise<DeleteProjectMilestoneResult> {
    return this.mutateSettings(
      (settings) => {
        const project = resolveProjectById(settings.projects, input.projectId)
        resolveProjectMilestone(project, input.milestoneId)
        const movedTaskIds = settings.calendarTasks
          .filter(
            (task) => task.projectId === input.projectId && task.milestoneId === input.milestoneId
          )
          .map((task) => task.id)
        const updatedProject: Project = {
          ...project,
          milestones: (project.milestones ?? []).filter(
            (milestone) => milestone.id !== input.milestoneId
          ),
          updatedAt: new Date().toISOString()
        }
        const nextTasks = settings.calendarTasks.map((task) =>
          task.projectId === input.projectId && task.milestoneId === input.milestoneId
            ? { ...task, milestoneId: undefined }
            : task
        )

        return {
          next: {
            projects: settings.projects.map((item) =>
              item.id === updatedProject.id ? updatedProject : item
            ),
            tasks: nextTasks,
            calendarTasks: nextTasks
          },
          result: {
            deletedMilestoneId: input.milestoneId,
            movedTaskIds
          }
        }
      },
      { label: 'Delete project milestone' }
    )
  }

  async createProjectUpdate(input: CreateProjectUpdateInput): Promise<Project> {
    return this.mutateSettings(
      (settings) => {
        const project = resolveProjectById(settings.projects, input.projectId)
        if (!input.markdown.trim()) {
          throw new Error('Project update content is required before posting')
        }
        const now = new Date()
        const update: ProjectUpdate = {
          id: `update-${randomUUID()}`,
          projectId: project.id,
          markdown: input.markdown,
          status: input.status,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        }
        const updatedProject: Project = {
          ...project,
          updates: [...(project.updates ?? []), update],
          updatedAt: now.toISOString()
        }

        return {
          next: {
            projects: settings.projects.map((item) =>
              item.id === updatedProject.id ? updatedProject : item
            )
          },
          result: updatedProject
        }
      },
      { label: 'Create project update' }
    )
  }

  async updateProjectUpdate(input: UpdateProjectUpdateInput): Promise<Project> {
    return this.mutateSettings(
      (settings) => {
        const project = resolveProjectById(settings.projects, input.projectId)
        const existing = resolveProjectUpdate(project, input.updateId)
        if (!input.markdown.trim()) {
          throw new Error('Project update content is required before saving')
        }
        const updatedAt = new Date().toISOString()
        const updatedUpdate: ProjectUpdate = {
          ...existing,
          markdown: input.markdown,
          status: input.status,
          updatedAt
        }
        const updatedProject: Project = {
          ...project,
          updates: (project.updates ?? []).map((update) =>
            update.id === updatedUpdate.id ? updatedUpdate : update
          ),
          updatedAt
        }

        return {
          next: {
            projects: settings.projects.map((item) =>
              item.id === updatedProject.id ? updatedProject : item
            )
          },
          result: updatedProject
        }
      },
      { label: 'Update project update' }
    )
  }

  async deleteProjectUpdate(input: DeleteProjectUpdateInput): Promise<Project> {
    return this.mutateSettings(
      (settings) => {
        const project = resolveProjectById(settings.projects, input.projectId)
        resolveProjectUpdate(project, input.updateId)
        const updatedAt = new Date().toISOString()
        const updatedProject: Project = {
          ...project,
          updates: (project.updates ?? []).filter((update) => update.id !== input.updateId),
          updatedAt
        }

        return {
          next: {
            projects: settings.projects.map((item) =>
              item.id === updatedProject.id ? updatedProject : item
            )
          },
          result: updatedProject
        }
      },
      { label: 'Delete project update' }
    )
  }

  async createTask(input: CreateTaskInput): Promise<CalendarTask> {
    return this.mutateSettings((settings) => {
      const project = input.projectId
        ? resolveProjectById(settings.projects, input.projectId)
        : undefined
      if (input.milestoneId && !project) {
        throw new Error('A milestone requires a project')
      }
      if (input.milestoneId && project) {
        resolveProjectMilestone(project, input.milestoneId)
      }

      const task: CalendarTask = {
        id: `task-${randomUUID()}`,
        title: input.title.trim(),
        description: input.description?.trim() || undefined,
        projectId: input.projectId,
        milestoneId: input.milestoneId,
        tags: normalizeTaskTags(input.tags),
        date: input.date,
        endDate: input.endDate,
        time: input.time,
        endTime: input.endTime,
        completed: false,
        status: 'pending',
        createdAt: new Date().toISOString(),
        priority: input.priority ?? 'low',
        taskType: input.taskType ?? 'assignment',
        reminders: input.reminders ?? [],
        dependencyIds: Array.from(new Set(input.dependencyIds ?? [])),
        parentTaskId: input.parentTaskId,
        estimateMinutes:
          input.estimateMinutes === undefined
            ? undefined
            : Math.max(0, Math.round(input.estimateMinutes)),
        updatedAt: new Date().toISOString()
      }

      assertValidTaskRelationships([...settings.calendarTasks, task])

      return {
        next: {
          calendarTasks: [...settings.calendarTasks, task],
          tasks: [...settings.calendarTasks, task]
        },
        result: task
      }
    })
  }

  private async updateSettingsInternal(
    next: AppSettingsUpdate,
    options: {
      recordHistory: boolean
      label: string
    }
  ): Promise<AppSettings> {
    return this.enqueueSettingsUpdate(async () => {
      const current = await this.settings.readVault(this.getCurrentVaultRoot())
      const nextTasks = next.tasks ?? next.calendarTasks
      if (nextTasks) {
        assertValidTaskRelationships(nextTasks)
      }
      const merged = await this.settings.updateVault(this.getCurrentVaultRoot(), next)

      if (next.calendarTasks || next.tasks) {
        this.reminderService.updateTasks(merged.calendarTasks)
      }

      if (options.recordHistory && !sameJson(current, merged)) {
        const operation = createMutationEnvelope(options.label, 'settings', 'update')
        await this.createTrashService().archiveSettingsDeletes(current, merged, operation)
        this.pushSettingsHistory(
          deriveSettingsHistoryLabel(current, merged, options.label),
          current,
          merged,
          operation
        )
      }

      return merged
    })
  }

  async mutateSettings<T>(
    updater: (
      settings: AppSettings
    ) => Promise<{ next: AppSettingsUpdate; result: T }> | { next: AppSettingsUpdate; result: T },
    options?: { recordHistory?: boolean; label?: string }
  ): Promise<T> {
    return this.enqueueSettingsUpdate(async () => {
      const current = await this.settings.readVault(this.getCurrentVaultRoot())
      const { next, result } = await updater(current)
      const nextTasks = next.tasks ?? next.calendarTasks
      if (nextTasks) {
        assertValidTaskRelationships(nextTasks)
      }
      const merged = await this.settings.updateVault(this.getCurrentVaultRoot(), next)

      if (next.calendarTasks || next.tasks) {
        this.reminderService.updateTasks(merged.calendarTasks)
      }

      if (options?.recordHistory !== false && !sameJson(current, merged)) {
        const operation = createMutationEnvelope(
          options?.label ?? 'Update workspace',
          'settings',
          'update'
        )
        await this.createTrashService().archiveSettingsDeletes(current, merged, operation)
        this.pushSettingsHistory(
          deriveSettingsHistoryLabel(current, merged, options?.label ?? 'Update workspace'),
          current,
          merged,
          operation
        )
      }

      return resolveProjectMutationResult(result, merged)
    })
  }

  async undoHistory(): Promise<HistoryOperationResult> {
    this.assertReady()
    return this.history.undo()
  }

  async redoHistory(): Promise<HistoryOperationResult> {
    this.assertReady()
    return this.history.redo()
  }

  historyStatus(): HistoryStatus {
    this.assertReady()
    return this.history.status()
  }

  setAgentToolInvoker(invoker: (name: string, input: unknown) => Promise<unknown>): void {
    this.agentToolInvoker = invoker
  }

  async handleExternalEvent(relPath: string, eventType: VaultEvent): Promise<void> {
    if (!this.fileService || !this.indexer || !this.currentPaths) {
      return
    }

    const safeRelPath = sanitizeEntryPath(relPath)
    if (eventType === 'addDir' || eventType === 'unlinkDir') {
      this.notifyTreeChange()
      return
    }

    if (!isNotePath(safeRelPath) && !isExcalidrawPath(safeRelPath)) {
      return
    }

    if (eventType === 'unlink') {
      if (isNotePath(safeRelPath)) {
        const absPath = assertPathInVault(this.currentPaths, safeRelPath, 'notes')
        if (!(await pathExists(absPath))) {
          await this.indexer.deleteByRelPath(safeRelPath)
        } else {
          await this.indexExternalNote(safeRelPath, absPath)
        }
      }
      this.notifyTreeChange()
      return
    }

    if (isNotePath(safeRelPath)) {
      const absPath = assertPathInVault(this.currentPaths, safeRelPath, 'notes')
      await this.indexExternalNote(safeRelPath, absPath)
    }

    this.notifyTreeChange()
  }

  private async indexExternalNote(relPath: string, absPath: string): Promise<void> {
    if (!this.indexer) {
      return
    }

    let content: string
    try {
      content = await fs.readFile(absPath, 'utf-8')
    } catch (error) {
      if (isMissingPathError(error)) {
        return
      }
      throw error
    }

    await this.indexer.upsertFromRaw({
      id: createStableId(relPath),
      relPath,
      content,
      updatedAt: new Date().toISOString()
    })
  }

  private async activateVault(folderPath: string, createMode: boolean): Promise<VaultOpenResult> {
    console.log('[VaultRuntime] activateVault', { folderPath, createMode })
    await this.closeCurrentVault()
    this.history.clear()
    this.currentPaths = createMode
      ? await initializeVault(folderPath)
      : await validateVault(folderPath)

    this.watcher = new VaultWatcher(this.currentPaths.notebooksPath, async (relPath, eventType) => {
      await this.enqueueNotebookMutation(() => this.handleExternalEvent(relPath, eventType))
    })

    this.fileService = new FileService(
      this.currentPaths.notebooksPath,
      this.currentPaths.attachmentsPath,
      (relPath) => this.watcher?.markInternalWrite(relPath)
    )
    this.fleetingNoteService = new FleetingNoteService(
      getVaultFleetingDir(this.currentPaths.rootPath)
    )

    const activeVaultRoot = this.currentPaths.rootPath
    let vaultSettings: AppSettings
    try {
      const legacyMistralApiKey = await this.settings.readLegacyMistralApiKey(activeVaultRoot)
      if (legacyMistralApiKey) {
        // Store the secret before readVault() is allowed to remove legacy settings.
        // If OS-backed encryption is unavailable, activation fails closed and the
        // legacy value remains recoverable for a later migration attempt.
        await this.credentialStore.set('mistral', activeVaultRoot, legacyMistralApiKey)
      }

      const migratedLegacyPaths = await this.fileService.migrateLegacyMarkdownNotes()
      if (Object.keys(migratedLegacyPaths).length > 0) {
        await this.remapSettingsForMigratedNotes(migratedLegacyPaths)
      }
      vaultSettings = await this.settings.readVault(activeVaultRoot)
      this.resourceService = new ResourceService(activeVaultRoot)
      this.resourceWriteService = new ResourceWriteService(activeVaultRoot)
      const googleDriveClientId = process.env.XINGULARITY_GOOGLE_CLIENT_ID?.trim()
      const googleDriveRedirectUri = process.env.XINGULARITY_GOOGLE_REDIRECT_URI?.trim()
      this.googleDriveService =
        googleDriveClientId && googleDriveRedirectUri
          ? new GoogleDriveResourceService(
              activeVaultRoot,
              new GoogleDriveAdapter({
                clientId: googleDriveClientId,
                redirectUri: googleDriveRedirectUri
              }),
              this.credentialStore
            )
          : null
      const resourceMigration = await this.resourceService.migrateProjects(vaultSettings.projects)
      if (
        resourceMigration.migrated > 0 ||
        resourceMigration.projects.some(
          (project, index) =>
            JSON.stringify(project.resourceRefs ?? []) !==
            JSON.stringify(vaultSettings.projects[index]?.resourceRefs ?? [])
        )
      ) {
        vaultSettings = await this.settings.updateVault(activeVaultRoot, {
          projects: resourceMigration.projects
        })
      }
      await this.refreshResourceSearchCache()
    } catch (error) {
      await this.watcher?.stop()
      this.watcher = null
      this.currentPaths = null
      this.fileService = null
      this.fleetingNoteService = null
      this.resourceService = null
      this.resourceWriteService = null
      this.googleDriveService = null
      throw error
    }
    this.reminderService.setScope(activeVaultRoot)
    this.reminderService.updateTasks(vaultSettings.calendarTasks)
    this.reminderService.start()

    this.indexer = await initializeIndexerWithRetry(
      this.currentPaths.indexPath,
      this.currentPaths.fileMapPath,
      this.currentPaths.notebooksPath
    )
    this.watcher.start()

    console.log('[VaultRuntime] persist global last vault', this.currentPaths.rootPath)
    await this.settings.rememberVault(this.currentPaths.rootPath)
    this.notifyVaultChange(this.currentPaths)
    const notes = await this.fileService.listNotes()
    const tree = await this.fileService.listTree()
    return {
      info: toInfo(this.currentPaths),
      notes,
      tree
    }
  }

  private async closeCurrentVault(): Promise<void> {
    this.reminderService.stop()
    this.reminderService.setScope(null)
    await this.notebookMutationQueue.drain()
    this.notebookMutationQueue = new NotebookMutationQueue()
    if (this.currentPaths) {
      this.notifyVaultChange(null)
    }
    this.history.clear()
    await this.watcher?.stop()
    this.watcher = null
    this.fileService = null
    this.fleetingNoteService = null
    this.resourceService = null
    this.resourceWriteService = null
    this.googleDriveService = null
    this.resourceSearchCache = []
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

  private enqueueNotebookMutation<T>(action: () => Promise<T>): Promise<T> {
    return this.notebookMutationQueue.enqueue(action)
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

  private notifyTreeChange(): void {
    for (const listener of this.treeChangeListeners) {
      try {
        listener()
      } catch (error) {
        console.error('[VaultRuntime] tree change listener failed', error)
      }
    }
  }

  private notifyReminderClick(target: ReminderClickTarget): void {
    for (const listener of this.reminderClickListeners) {
      try {
        listener({ ...target })
      } catch (error) {
        console.error('[VaultRuntime] reminder click listener failed', error)
      }
    }
  }

  private async buildSavedVaultState(global?: {
    lastVaultPath: string | null
    savedVaults: Array<{
      rootPath: string
      addedAt: string
      lastOpenedAt: string | null
      isFavorite: boolean
    }>
  }): Promise<SavedVaultState> {
    const nextGlobal = global ?? (await this.settings.readGlobal())
    const currentVaultPath = this.currentPaths?.rootPath ?? null
    const vaults = await Promise.all(
      nextGlobal.savedVaults.map(async (savedVault) => ({
        rootPath: savedVault.rootPath,
        name: path.basename(savedVault.rootPath) || savedVault.rootPath,
        addedAt: savedVault.addedAt,
        lastOpenedAt: savedVault.lastOpenedAt,
        isFavorite: savedVault.isFavorite === true,
        isAvailable: await this.isSavedVaultAvailable(savedVault.rootPath)
      }))
    )

    vaults.sort((left, right) => {
      const leftIsCurrent = left.rootPath === currentVaultPath
      const rightIsCurrent = right.rootPath === currentVaultPath
      if (leftIsCurrent !== rightIsCurrent) {
        return leftIsCurrent ? -1 : 1
      }

      if (left.isFavorite !== right.isFavorite) {
        return left.isFavorite ? -1 : 1
      }

      const leftLastOpened = left.lastOpenedAt ?? ''
      const rightLastOpened = right.lastOpenedAt ?? ''
      if (leftLastOpened !== rightLastOpened) {
        return rightLastOpened.localeCompare(leftLastOpened)
      }

      if (left.addedAt !== right.addedAt) {
        return right.addedAt.localeCompare(left.addedAt)
      }

      return left.name.localeCompare(right.name)
    })

    return {
      currentVaultPath,
      vaults
    }
  }

  private async findMostRecentAvailableVault(
    savedVaults: Array<{
      rootPath: string
      addedAt: string
      lastOpenedAt: string | null
      isFavorite: boolean
    }>
  ): Promise<{
    rootPath: string
    addedAt: string
    lastOpenedAt: string | null
    isFavorite: boolean
  } | null> {
    const orderedVaults = [...savedVaults].sort((left, right) => {
      if (left.isFavorite !== right.isFavorite) {
        return left.isFavorite ? -1 : 1
      }

      const leftLastOpened = left.lastOpenedAt ?? ''
      const rightLastOpened = right.lastOpenedAt ?? ''
      if (leftLastOpened !== rightLastOpened) {
        return rightLastOpened.localeCompare(leftLastOpened)
      }

      return right.addedAt.localeCompare(left.addedAt)
    })

    for (const savedVault of orderedVaults) {
      if (await this.isSavedVaultAvailable(savedVault.rootPath)) {
        return savedVault
      }
    }

    return null
  }

  private async isSavedVaultAvailable(rootPath: string): Promise<boolean> {
    try {
      await fs.access(rootPath)
      return true
    } catch {
      return false
    }
  }

  private async remapSettingsForMigratedNotes(pathMap: Record<string, string>): Promise<void> {
    if (!this.currentPaths) {
      return
    }

    const current = await this.settings.readVault(this.currentPaths.rootPath)
    const remap = (relPath: string | null): string | null =>
      relPath ? (pathMap[relPath] ?? relPath) : null

    await this.settings.updateVault(this.currentPaths.rootPath, {
      lastOpenedNotePath: remap(current.lastOpenedNotePath),
      favoriteNotePaths: current.favoriteNotePaths.map((relPath) => pathMap[relPath] ?? relPath),
      gridBoard: {
        ...current.gridBoard,
        items: current.gridBoard.items.map((item) =>
          item.kind === 'note' && item.noteRelPath
            ? {
                ...item,
                noteRelPath: remap(item.noteRelPath) ?? item.noteRelPath
              }
            : item
        )
      }
    })
  }

  private createTrashService(): TrashService {
    this.assertReady()
    return new TrashService(this.currentPaths!.rootPath, this.currentPaths!.notebooksPath)
  }

  private pushFileDeleteHistory(label: string, initialEntries: TrashedEntry[]): void {
    const operation = createMutationEnvelope(label, 'notes', 'delete')
    const entries = initialEntries.map((entry) => ({
      activeRelPath: entry.originalRelPath,
      trashedEntry: entry as TrashedEntry | null
    }))

    this.history.push({
      operation,
      label,
      affected: { notes: true },
      undo: async () => {
        this.assertReady()
        for (const entry of entries) {
          if (!entry.trashedEntry) {
            continue
          }
          entry.activeRelPath = await this.createTrashService().restoreEntry(entry.trashedEntry)
          entry.trashedEntry = null
        }
        await this.indexer!.rebuild(this.currentPaths!.notebooksPath)
        return { notes: true }
      },
      redo: async () => {
        this.assertReady()
        const trash = this.createTrashService()
        for (const entry of entries) {
          if (entry.trashedEntry) {
            continue
          }
          entry.trashedEntry = await trash.moveEntryToTrash(entry.activeRelPath)
          entry.activeRelPath = entry.trashedEntry.originalRelPath
        }
        await this.indexer!.rebuild(this.currentPaths!.notebooksPath)
        return { notes: true }
      }
    })
  }

  private pushSettingsHistory(
    label: string,
    before: AppSettings,
    after: AppSettings,
    operation = createMutationEnvelope(label, 'settings', 'update')
  ): void {
    const beforeSnapshot = cloneSettings(before)
    const afterSnapshot = cloneSettings(after)

    this.history.push({
      operation,
      label,
      affected: { settings: true },
      undo: async () => {
        await this.applySettingsSnapshot(beforeSnapshot)
        return { settings: true }
      },
      redo: async () => {
        await this.applySettingsSnapshot(afterSnapshot)
        return { settings: true }
      }
    })
  }

  private async applySettingsSnapshot(snapshot: AppSettings): Promise<void> {
    await this.updateSettingsInternal(settingsSnapshotToUpdate(snapshot), {
      recordHistory: false,
      label: 'Restore workspace state'
    })
  }

  private async assertFolderCreationAllowed(relPath: string): Promise<void> {
    void relPath
  }

  private assertNoteCreationAllowed(relPath: string): void {
    void relPath
  }

  private async assertFileCreationAllowed(relPath: string): Promise<void> {
    void relPath
  }

  private async assertPathMutationAllowed(oldPath: string, newPath: string): Promise<void> {
    void oldPath
    this.assertNoteCreationAllowed(newPath)
  }

  private async assertPathDeletionAllowed(relPath: string): Promise<void> {
    void relPath
  }

  private getAgentHistoryStore(): AgentHistoryStore {
    return new AgentHistoryStore(this.getCurrentVaultRoot())
  }

  private getAgentChatStore(): AgentChatStore {
    return new AgentChatStore(this.getCurrentVaultRoot())
  }

  private getExcalidrawSessionStore(): ExcalidrawSessionStore {
    return new ExcalidrawSessionStore(this.getCurrentVaultRoot())
  }

  private async recordAgentRun(run: AgentRunRecord): Promise<void> {
    try {
      await this.getAgentHistoryStore().appendRun(run)
    } catch (error) {
      console.error('[VaultRuntime] failed to record agent run', error)
    }
  }

  private async resolveAgentChatContexts(
    mentions: AgentChatMentionRef[],
    settings: AppSettings
  ): Promise<Array<{ summary: AgentChatContextSummary; promptBlock: string }>> {
    const contexts: Array<{ summary: AgentChatContextSummary; promptBlock: string }> = []

    for (const mention of mentions) {
      if (mention.kind === 'note' && mention.notePath) {
        const content = await this.readNote(mention.notePath)
        const excerpt = truncateText(content, 4_000)
        contexts.push({
          summary: {
            id: mention.id,
            kind: 'note',
            label: mention.label,
            detail: mention.notePath
          },
          promptBlock: [
            `Context kind: note`,
            `Label: ${mention.label}`,
            `Path: ${mention.notePath}`,
            'Content:',
            excerpt
          ].join('\n')
        })
        continue
      }

      if (mention.kind === 'project' && mention.projectId) {
        const project = settings.projects.find((item) => item.id === mention.projectId)
        if (!project) {
          continue
        }
        let promptBlock = formatProjectContext(project)
        const featureFlags = {
          ...createDefaultAppSettings().featureFlags,
          ...(settings.featureFlags ?? {})
        }
        if (featureFlags.agentContextBundles && this.resourceService) {
          const bundle = await this.getProjectResourceContext(project.id)
          promptBlock = `${promptBlock}\n\n${formatResourceContextBundle(bundle)}`
        }
        contexts.push({
          summary: {
            id: mention.id,
            kind: 'project',
            label: mention.label,
            detail: project.summary
          },
          promptBlock
        })
      }
    }

    return contexts
  }

  private async runAgentChatLoopFromMessages(
    mistral: Mistral,
    model: string,
    messages: MistralChatMessage[],
    requestId: string,
    signal?: AbortSignal
  ): Promise<{ content: string; toolSteps: AgentChatToolStep[] }> {
    const toolSteps: AgentChatToolStep[] = []

    let finalContent = ''

    for (let iteration = 0; iteration < 6; iteration += 1) {
      this.assertAgentRequestActive(requestId)
      this.emitAgentChatEvent({ requestId, type: 'status', status: 'thinking' })
      const stream = await mistral.chat.stream(
        {
          model,
          temperature: 0.25,
          messages,
          tools: AGENT_CHAT_TOOLS,
          toolChoice: 'auto',
          parallelToolCalls: false
        },
        signal ? { fetchOptions: { signal } } : undefined
      )

      let assistantContent = ''
      let toolCalls: MistralToolCall[] = []

      for await (const event of stream) {
        this.assertAgentRequestActive(requestId)
        const choice = event.data?.choices?.[0]
        if (!choice) {
          continue
        }

        const deltaText = extractDeltaContent(choice.delta.content)
        if (deltaText) {
          assistantContent += deltaText
          this.emitAgentChatEvent({ requestId, type: 'text-delta', delta: deltaText })
        }

        if (choice.delta.toolCalls?.length) {
          toolCalls = choice.delta.toolCalls
        }
      }

      finalContent = assistantContent || finalContent

      if (!toolCalls.length) {
        break
      }

      messages.push({
        role: 'assistant',
        content: assistantContent || null,
        toolCalls
      })

      for (const toolCall of toolCalls) {
        this.assertAgentRequestActive(requestId)
        const toolName = toolCall.function.name
        const toolId = toolCall.id ?? `${toolName}-${Date.now()}`
        const parsedArgs = parseToolArguments(toolCall.function.arguments)

        try {
          const output = await this.executeAgentTool(toolName, parsedArgs)
          const toolStep = {
            id: toolId,
            toolName,
            status: 'completed',
            inputSummary: summarizeData(parsedArgs),
            outputSummary: summarizeData(output)
          } satisfies AgentChatToolStep
          toolSteps.push(toolStep)
          this.emitAgentChatEvent({ requestId, type: 'tool-step', toolStep })
          messages.push({
            role: 'tool',
            toolCallId: toolCall.id ?? null,
            name: toolName,
            content: serializeToolResult(output)
          })
        } catch (error) {
          if (error instanceof AgentToolApprovalRequiredError) {
            const toolStep = {
              id: toolId,
              toolName,
              status: 'approval-required',
              inputSummary: summarizeData(parsedArgs),
              outputSummary: error.message,
              approvalRequest: {
                toolName,
                input: parsedArgs
              }
            } satisfies AgentChatToolStep
            toolSteps.push(toolStep)
            this.emitAgentChatEvent({ requestId, type: 'tool-step', toolStep })
            messages.push({
              role: 'tool',
              toolCallId: toolCall.id ?? null,
              name: toolName,
              content: JSON.stringify({
                approvalRequired: true,
                toolName,
                message: error.message,
                requestedInput: parsedArgs
              })
            })
            continue
          }

          const errorMessage = error instanceof Error ? error.message : String(error)
          const toolStep = {
            id: toolId,
            toolName,
            status: 'error',
            inputSummary: summarizeData(parsedArgs),
            outputSummary: errorMessage
          } satisfies AgentChatToolStep
          toolSteps.push(toolStep)
          this.emitAgentChatEvent({ requestId, type: 'tool-step', toolStep })
          messages.push({
            role: 'tool',
            toolCallId: toolCall.id ?? null,
            name: toolName,
            content: JSON.stringify({ error: errorMessage })
          })
        }
      }
    }

    return {
      content: finalContent || 'Done.',
      toolSteps
    }
  }

  private assertAgentRequestActive(requestId: string): void {
    if (this.cancelledAgentRequests.has(requestId)) {
      throw new Error('Agent request cancelled')
    }
  }

  private async executeAgentTool(name: string, input: unknown): Promise<unknown> {
    if (!this.agentToolInvoker) {
      throw new Error('Agent tool invoker is not registered')
    }

    if (WRITE_AGENT_TOOLS.has(name)) {
      throw new AgentToolApprovalRequiredError(
        `Approval required before executing ${name}. Ask the user to confirm this change.`
      )
    }

    return this.agentToolInvoker(name, input)
  }

  private async executeAgentToolWithApproval(name: string, input: unknown): Promise<unknown> {
    if (!this.agentToolInvoker) {
      throw new Error('Agent tool invoker is not registered')
    }
    return this.agentToolInvoker(name, input)
  }

  private emitAgentChatEvent(event: AgentChatEvent): void {
    for (const listener of this.agentChatListeners) {
      try {
        listener(event)
      } catch (error) {
        console.error('[VaultRuntime] agent chat listener failed', error)
      }
    }
  }
}

function buildProjectName(projects: Project[], proposedName?: string): string {
  const normalized = proposedName?.trim()
  if (normalized) {
    const existingNames = new Set(projects.map((project) => project.name.toLowerCase()))
    let nextName = normalized
    let suffix = 2
    while (existingNames.has(nextName.toLowerCase())) {
      nextName = `${normalized} ${suffix}`
      suffix += 1
    }
    return nextName
  }

  const baseName = 'Untitled Project'
  const existingNames = new Set(projects.map((project) => project.name.toLowerCase()))
  let nextName = baseName
  let suffix = 2
  while (existingNames.has(nextName.toLowerCase())) {
    nextName = `${baseName} ${suffix}`
    suffix += 1
  }
  return nextName
}

function resolveProjectById(projects: Project[], projectId: string): Project {
  const project = projects.find((item) => item.id === projectId)
  if (!project) {
    throw new Error(`Project not found: ${projectId}`)
  }
  return project
}

function resolveProjectMilestone(project: Project, milestoneId: string): ProjectMilestone {
  const milestone = project.milestones?.find((item) => item.id === milestoneId)
  if (!milestone) {
    throw new Error(`Milestone not found: ${milestoneId}`)
  }
  return milestone
}

function resolveProjectUpdate(project: Project, updateId: string): ProjectUpdate {
  const update = project.updates?.find((item) => item.id === updateId)
  if (!update) {
    throw new Error(`Project update not found: ${updateId}`)
  }
  return update
}

function assertValidTaskRelationships(tasks: CalendarTask[]): void {
  const errors = validateTaskRelationships(tasks)
  if (errors.length > 0) {
    throw new Error(`Invalid task relationships: ${errors.join('; ')}`)
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
  notebooksPath: string
): Promise<SqliteIndexer> {
  await resetIndexArtifacts(indexPath, fileMapPath)

  try {
    const indexer = new SqliteIndexer(indexPath, fileMapPath)
    await indexer.init()
    await indexer.rebuild(notebooksPath)
    return indexer
  } catch (error) {
    if (!isSqliteCorruptionError(error)) {
      throw error
    }

    await resetIndexArtifacts(indexPath, fileMapPath)
    const indexer = new SqliteIndexer(indexPath, fileMapPath)
    await indexer.init()
    await indexer.rebuild(notebooksPath)
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

function isFileExistsError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'EEXIST'
  )
}

function isMissingPathError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  )
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch (error) {
    if (isMissingPathError(error)) {
      return false
    }
    throw error
  }
}

function getFleetingTitle(content: string): string {
  return (
    content
      .split(/\r?\n/)
      .find((line) => line.trim())
      ?.trim() || 'Captured thought'
  )
}

function createTaskFromFleetingNote(content: string): CalendarTask {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const titleIndex = lines.findIndex((line) => line.trim())
  const title = titleIndex >= 0 ? lines[titleIndex].trim() : 'Captured thought'
  const description = lines
    .slice(titleIndex + 1)
    .join('\n')
    .trim()

  return {
    id: `task-${Date.now()}-${randomUUID().slice(0, 8)}`,
    title: title.slice(0, 200),
    ...(description ? { description: description.slice(0, 2000) } : {}),
    tags: [],
    completed: false,
    status: 'pending',
    createdAt: new Date().toISOString(),
    priority: 'low',
    taskType: 'assignment',
    reminders: []
  }
}

function buildInitialAgentChatMessages(
  message: string,
  contexts: Array<{ summary: AgentChatContextSummary; promptBlock: string }>
): MistralChatMessage[] {
  return [
    {
      role: 'system',
      content: buildAgentSystemPrompt()
    },
    {
      role: 'user',
      content: buildAgentChatPrompt(message, contexts)
    }
  ]
}

function buildApprovalContinuationMessages(
  sessionMessages: AgentChatMessageRecord[],
  toolName: string,
  input: unknown,
  output: unknown
): MistralChatMessage[] {
  const recentTranscript = sessionMessages
    .slice(-8)
    .map((message, index) => {
      const parts = [`${index + 1}. ${message.role.toUpperCase()}: ${message.content}`]
      if (message.contexts?.length) {
        parts.push(`   Contexts: ${message.contexts.map((item) => item.label).join(', ')}`)
      }
      return parts.join('\n')
    })
    .join('\n\n')

  return [
    {
      role: 'system',
      content: buildAgentSystemPrompt()
    },
    {
      role: 'user',
      content: [
        'Continue the conversation after an approved workspace action.',
        'Recent conversation:',
        recentTranscript || 'No prior messages.',
        '',
        `Approved tool: ${toolName}`,
        `Tool input: ${serializeToolResult(input)}`,
        `Tool output: ${serializeToolResult(output)}`,
        '',
        'Acknowledge the applied change, explain the result, and continue helping the user. Use more tools if needed.'
      ].join('\n')
    }
  ]
}

function buildAgentSystemPrompt(): string {
  return [
    'You are Xingularity Agent, a workspace assistant for notes, projects, planning, and task management.',
    'Use provided workspace context when it is sufficient.',
    'Use tools when you need to inspect, create, or update workspace data.',
    'Write tools require approval before execution. If a tool result reports approvalRequired, do not pretend the change happened.',
    'Instead, explain the intended change and ask the user to confirm before proceeding.',
    'Before making changes, think through the exact record to target and avoid guessing ambiguous matches.',
    'Be concise, action-oriented, and specific.',
    'Do not mention internal prompt structure or hidden metadata.'
  ].join(' ')
}

function buildAgentChatPrompt(
  message: string,
  contexts: Array<{ summary: AgentChatContextSummary; promptBlock: string }>
): string {
  return [
    'User request:',
    message,
    contexts.length > 0 ? '\nAttached workspace context:' : '\nNo attached workspace context.',
    ...(contexts.length > 0
      ? contexts.map((context, index) => `\n[Context ${index + 1}]\n${context.promptBlock}`)
      : []),
    '\nRespond with practical guidance, proposed next actions, or a direct answer.'
  ].join('\n')
}

function formatProjectContext(project: Project): string {
  return [
    'Context kind: project',
    `Name: ${project.name}`,
    `Description: ${project.description ?? project.summary ?? 'None'}`,
    'Tasks:',
    project.tasks && project.tasks.length > 0
      ? project.tasks
          .map(
            (task) =>
              `- ${task.title} | due ${task.date ?? task.endDate ?? 'unscheduled'} | status ${task.status ?? (task.completed ? 'completed' : 'pending')}`
          )
          .join('\n')
      : '- None'
  ].join('\n')
}

function formatResourceContextBundle(bundle: ResourceContextBundle): string {
  return [
    'Context kind: selected external resources',
    bundle.resources.length > 0
      ? bundle.resources
          .map(
            (resource) =>
              `- ${resource.title} | ${resource.provider} | ${resource.state} | ${resource.canonicalUri}`
          )
          .join('\n')
      : '- None selected',
    'Citations:',
    bundle.citations.length > 0
      ? bundle.citations
          .map((citation) => {
            const citationLine = `- ${citation.title}: ${citation.uri}${citation.observedAt ? ` (observed ${citation.observedAt})` : ''}`
            return citation.excerpt
              ? `${citationLine}\n  Content:\n${citation.excerpt}`
              : citationLine
          })
          .join('\n')
      : '- None'
  ].join('\n')
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength - 3)}...`
}

function extractDeltaContent(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }

  if (!Array.isArray(content)) {
    return ''
  }

  return content
    .map((part) => {
      if (typeof part === 'string') {
        return part
      }
      if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
        return part.text
      }
      return ''
    })
    .join('')
}

function parseToolArguments(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return { raw: value }
    }
  }
  return value
}

function serializeToolResult(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function summarizeData(value: unknown): string {
  const text = typeof value === 'string' ? value : serializeToolResult(value)
  return truncateText(text.replace(/\s+/g, ' ').trim(), 240)
}

function deriveAgentChatTitle(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  fallbackTitle: string
): string {
  const firstUserMessage = messages.find((message) => message.role === 'user')
  const base = firstUserMessage?.content.trim() || fallbackTitle.trim() || 'New chat'
  return truncateText(base.replace(/\s+/g, ' '), 60)
}

function sanitizeAgentChatMessage<T extends { content: string }>(message: T): T {
  return {
    ...message,
    content: message.content
  }
}

function buildApprovedToolSuccessMessage(toolName: string, output: unknown): string {
  const summary = summarizeData(output)
  return `Approved and applied \`${toolName}\` successfully.\n\nResult: ${summary}`
}

function buildApprovedToolErrorMessage(toolName: string, errorMessage: string): string {
  return `I tried to apply \`${toolName}\`, but it failed.\n\nError: ${errorMessage}`
}

async function emitChunkedAgentText(
  emit: (delta: string) => void,
  text: string,
  chunkSize = 24
): Promise<void> {
  for (let index = 0; index < text.length; index += chunkSize) {
    emit(text.slice(index, index + chunkSize))
    if (index + chunkSize < text.length) {
      await delay(12)
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

class AgentToolApprovalRequiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentToolApprovalRequiredError'
  }
}

const WRITE_AGENT_TOOLS = new Set([
  'note.create',
  'note.update',
  'note.append',
  'project.create',
  'project.update',
  'calendarTask.create',
  'calendarTask.update',
  'task.create',
  'task.update',
  'weeklyPlan.createWeek',
  'weeklyPlan.createPriority',
  'weeklyPlan.upsertReview'
])

const AGENT_CHAT_TOOLS: MistralTool[] = [
  {
    type: 'function',
    function: {
      name: 'note.search',
      description:
        'Search notes by keyword to find relevant notes before reading or updating them.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query for notes.' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'note.read',
      description: 'Read the content of a note by its path.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative note path, usually ending in .md.' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'note.create',
      description: 'Create a new note, optionally with tags and initial content.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          content: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'note.update',
      description: 'Replace a note with new content.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'note.append',
      description: 'Append content to an existing note.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
          separator: { type: 'string' }
        },
        required: ['path', 'content']
      }
    }
  },
  ...[
    'project.create',
    'project.update',
    'calendarTask.create',
    'calendarTask.update',
    'task.create',
    'task.update',
    'weeklyPlan.createWeek',
    'weeklyPlan.createPriority',
    'weeklyPlan.upsertReview'
  ].map((name) => ({
    type: 'function' as const,
    function: {
      name,
      description: `Execute the workspace tool ${name}. Use exact field names and provide only the fields needed for the task.`,
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: true
      }
    }
  }))
]

function extractMistralText(response: unknown): string {
  if (!response || typeof response !== 'object') {
    return ''
  }

  const choices = (response as { choices?: Array<{ message?: { content?: unknown } }> }).choices
  const content = choices?.[0]?.message?.content
  if (typeof content === 'string') {
    return content
  }

  if (!Array.isArray(content)) {
    return ''
  }

  return content
    .map((part) => {
      if (typeof part === 'string') {
        return part
      }

      if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
        return part.text
      }

      return ''
    })
    .join('')
}

function cloneSettings(settings: AppSettings): AppSettings {
  return JSON.parse(JSON.stringify(settings)) as AppSettings
}

function resolveProjectMutationResult<T>(result: T, merged: AppSettings): T {
  if (!result || typeof result !== 'object') {
    return result
  }

  const candidate = result as { id?: unknown; name?: unknown; icon?: unknown }
  if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string' || !candidate.icon) {
    return result
  }

  return (merged.projects.find((project) => project.id === candidate.id) as T | undefined) ?? result
}

function normalizeProjectValues(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)))
}

function assertProjectDateRange(startDate: string | undefined, endDate: string | undefined): void {
  if (startDate && endDate && endDate < startDate) {
    throw new Error('Project end date cannot be earlier than the start date')
  }
}

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function decodeFileUri(value: string): string {
  try {
    return decodeURIComponent(new URL(value).pathname)
  } catch {
    return value.replace(/^file:\/\//, '')
  }
}

function assertExternalResourceUri(value: string): string {
  const parsed = new URL(value)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS resource links can be opened externally')
  }
  return parsed.toString()
}

function resourceStateForSearch(value: string): string {
  return value.replaceAll('-', ' ')
}

function settingsSnapshotToUpdate(settings: AppSettings): AppSettingsUpdate {
  return {
    isSidebarCollapsed: settings.isSidebarCollapsed,
    profile: settings.profile,
    ai: settings.ai,
    fontFamily: settings.fontFamily,
    pythonCondaEnvironmentPath: settings.pythonCondaEnvironmentPath,
    pythonCondaExecutablePath: settings.pythonCondaExecutablePath,
    calendarTasks: settings.calendarTasks,
    tasks: settings.tasks ?? settings.calendarTasks,
    projectIcons: settings.projectIcons,
    projects: settings.projects,
    gridBoard: settings.gridBoard,
    lastOpenedNotePath: settings.lastOpenedNotePath,
    lastOpenedProjectId: settings.lastOpenedProjectId,
    favoriteNotePaths: settings.favoriteNotePaths,
    favoriteProjectIds: settings.favoriteProjectIds,
    featureFlags: settings.featureFlags
  }
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function createMutationEnvelope(
  label: string,
  domain: MutationEnvelope['domain'],
  kind: MutationEnvelope['kind']
): MutationEnvelope {
  return {
    id: randomUUID(),
    kind,
    domain,
    label,
    createdAt: new Date().toISOString(),
    reversible: true
  }
}

async function waitForPdfImages(window: BrowserWindow): Promise<string[]> {
  const failedImageIds = await window.webContents.executeJavaScript(`
    Promise.all(
      Array.from(document.images).map((image) => {
        if (image.complete) {
          return Promise.resolve(image.naturalWidth > 0 ? null : image.dataset.exportImageId || 'image')
        }

        return new Promise((resolve) => {
          const timeoutId = window.setTimeout(
            () => resolve(image.dataset.exportImageId || 'image'),
            10000
          )
          image.addEventListener('load', () => {
            window.clearTimeout(timeoutId)
            resolve(null)
          }, { once: true })
          image.addEventListener('error', () => {
            window.clearTimeout(timeoutId)
            resolve(image.dataset.exportImageId || 'image')
          }, { once: true })
        })
      })
    ).then((results) => results.filter((value) => typeof value === 'string'))
  `)

  if (!Array.isArray(failedImageIds)) {
    return []
  }

  return failedImageIds.map((imageId) => `Could not load image ${String(imageId)} for PDF export`)
}

function deriveSettingsHistoryLabel(
  previous: AppSettings,
  next: AppSettings,
  fallback: string
): string {
  if (previous.projects.length > next.projects.length) {
    const nextProjectIds = new Set(next.projects.map((project) => project.id))
    if (previous.projects.some((project) => !nextProjectIds.has(project.id))) {
      return 'Delete project'
    }
  }

  if (
    previous.calendarTasks.length > next.calendarTasks.length ||
    next.tasks?.length !== previous.tasks?.length
  ) {
    return 'Delete task'
  }

  if (previous.gridBoard.items.length > next.gridBoard.items.length) {
    return 'Remove grid item'
  }

  return fallback
}
