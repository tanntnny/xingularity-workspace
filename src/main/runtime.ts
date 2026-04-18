import fs from 'node:fs/promises'
import path from 'node:path'
import { app, dialog, shell } from 'electron'
import { Mistral } from '@mistralai/mistralai'
import type {
  Tool as MistralTool,
  ToolCall as MistralToolCall
} from '@mistralai/mistralai/models/components'
import type { Messages as MistralChatMessage } from '@mistralai/mistralai/models/components/chatcompletionrequest'
import { AgentChatStore } from './agentChatStore'
import { AgentHistoryStore } from './agentHistoryStore'
import { FileService, sanitizeNotePath } from './fileService'
import { SqliteIndexer } from './indexer/sqliteIndexer'
import { serializeStoredNoteDocument, stripNoteExtension } from '../shared/noteDocument'
import { getProjectProtectionKind } from '../shared/projectFolders'
import { generateProjectTag } from '../shared/noteTags'
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
  CompleteNoteWithAiInput,
  BlockNoteMigrationResult,
  NoteImportResult,
  Project,
  ProjectMilestone,
  SearchResult,
  StoredNoteDocument,
  VaultOpenResult
} from '../shared/types'

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
  private agentChatListeners: Array<(event: AgentChatEvent) => void> = []
  private agentToolInvoker: ((name: string, input: unknown) => Promise<unknown>) | null = null

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

  async listNoteTree(): ReturnType<FileService['listTree']> {
    this.assertReady()
    const [tree, settings] = await Promise.all([this.fileService!.listTree(), this.getSettings()])
    return this.decorateProjectTree(tree, settings.projects)
  }

  async readNote(relPath: string): Promise<string> {
    this.assertReady()
    return this.fileService!.readNote(relPath)
  }

  async readNoteDocument(relPath: string): Promise<StoredNoteDocument> {
    this.assertReady()
    return this.fileService!.readNoteDocument(relPath)
  }

  async writeNote(relPath: string, content: string): Promise<void> {
    this.assertReady()
    await this.fileService!.writeNote(relPath, content)
    const fresh = await this.fileService!.readNoteDocument(relPath)
    await this.indexer!.upsertFromRaw({
      id: createStableId(relPath),
      relPath: sanitizeNotePath(relPath),
      content: serializeStoredNoteDocument(fresh),
      updatedAt: new Date().toISOString()
    })
  }

  async writeNoteDocument(relPath: string, document: StoredNoteDocument): Promise<void> {
    this.assertReady()
    await this.fileService!.writeNoteDocument(relPath, document)
    await this.indexer!.upsertFromRaw({
      id: createStableId(relPath),
      relPath: sanitizeNotePath(relPath),
      content: serializeStoredNoteDocument(document),
      updatedAt: new Date().toISOString()
    })
  }

  async createNote(name: string): Promise<string> {
    this.assertReady()
    const relPath = await this.fileService!.createNote(name)
    const content = serializeStoredNoteDocument(await this.fileService!.readNoteDocument(relPath))
    await this.indexer!.upsertFromRaw({
      id: createStableId(relPath),
      relPath,
      content,
      updatedAt: new Date().toISOString()
    })
    return relPath
  }

  async createNoteAtPath(relPath: string): Promise<string> {
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
    return nextRelPath
  }

  async createNoteWithTags(name: string, tags: string[]): Promise<string> {
    this.assertReady()
    const relPath = await this.fileService!.createNoteWithTags(name, tags)
    const content = serializeStoredNoteDocument(await this.fileService!.readNoteDocument(relPath))
    await this.indexer!.upsertFromRaw({
      id: createStableId(relPath),
      relPath,
      content,
      updatedAt: new Date().toISOString()
    })
    return relPath
  }

  async createFolder(relPath: string): Promise<string> {
    this.assertReady()
    await this.assertFolderCreationAllowed(relPath)
    const nextRelPath = await this.fileService!.createFolder(relPath)
    await this.indexer!.rebuild(this.currentPaths!.notesPath)
    return nextRelPath
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

    return { imported, failed }
  }

  async migrateBlockNoteNotes(): Promise<BlockNoteMigrationResult> {
    this.assertReady()
    const result = await this.fileService!.migrateBlockNoteMarkdownNotes()
    if (result.converted > 0) {
      await this.indexer!.rebuild(this.currentPaths!.notesPath)
    }
    return result
  }

  async migrateTaggedNoteBodyFrontmatter(): Promise<{
    converted: number
    skipped: number
    failed: Array<{
      relPath: string
      error: string
    }>
  }> {
    this.assertReady()
    const result = await this.fileService!.migrateTaggedNoteBodyFrontmatter()
    if (result.converted > 0) {
      await this.indexer!.rebuild(this.currentPaths!.notesPath)
    }
    return result
  }

  async renameNote(oldPath: string, newPath: string): Promise<void> {
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
  }

  async renamePath(oldPath: string, newPath: string): Promise<void> {
    this.assertReady()
    await this.assertPathMutationAllowed(oldPath, newPath)
    await this.fileService!.renamePath(oldPath, newPath)
    await this.indexer!.rebuild(this.currentPaths!.notesPath)
  }

  async deleteNote(relPath: string): Promise<void> {
    this.assertReady()
    await this.fileService!.delete(relPath)
    await this.indexer!.deleteByRelPath(sanitizeNotePath(relPath))
  }

  async deletePath(relPath: string): Promise<void> {
    this.assertReady()
    await this.assertPathDeletionAllowed(relPath)
    await this.fileService!.deletePath(relPath)
    await this.indexer!.rebuild(this.currentPaths!.notesPath)
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

  async exportProject(projectName: string, content: string): Promise<string | null> {
    this.assertReady()
    const downloadsPath = app.getPath('downloads')
    const suggestedName = `${this.sanitizeExportFileName(projectName)}.md`
    const result = await this.showMarkdownExportDialog(
      'Export project',
      downloadsPath,
      suggestedName
    )

    if (result.canceled || !result.filePath) {
      return null
    }

    await fs.writeFile(result.filePath, content, 'utf-8')
    return result.filePath
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

  async openPath(targetPath: string): Promise<void> {
    const openError = await shell.openPath(targetPath)
    if (openError) {
      throw new Error(openError)
    }
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

    const settings = await this.getSettings()
    const apiKey = settings.ai.mistralApiKey.trim()
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

    const settings = await this.getSettings()
    const apiKey = settings.ai.mistralApiKey.trim()
    try {
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
        requestId
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
      await this.recordAgentRun({
        ...baseRun,
        endedAt: new Date().toISOString(),
        status: 'error',
        errorMessage: error instanceof Error ? error.message : String(error)
      })
      throw error
    } finally {
      this.emitAgentChatEvent({ requestId, type: 'status', status: 'finished' })
    }
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

      const settings = await this.getSettings()
      const apiKey = settings.ai.mistralApiKey.trim()
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
      const current = await this.settings.readVault(this.getCurrentVaultRoot())
      const merged = await this.settings.updateVault(this.getCurrentVaultRoot(), next)

      if (next.projects) {
        await this.reconcileProjectTags(current.projects, merged.projects)
      }

      if (next.calendarTasks) {
        this.reminderService.updateTasks(merged.calendarTasks)
      }

      return merged
    })
  }

  async mutateSettings<T>(
    updater: (
      settings: AppSettings
    ) => Promise<{ next: AppSettingsUpdate; result: T }> | { next: AppSettingsUpdate; result: T }
  ): Promise<T> {
    return this.enqueueSettingsUpdate(async () => {
      const current = await this.settings.readVault(this.getCurrentVaultRoot())
      const { next, result } = await updater(current)
      const merged = await this.settings.updateVault(this.getCurrentVaultRoot(), next)

      if (next.projects) {
        await this.reconcileProjectTags(current.projects, merged.projects)
      }

      if (next.calendarTasks) {
        this.reminderService.updateTasks(merged.calendarTasks)
      }

      return result
    })
  }

  setAgentToolInvoker(invoker: (name: string, input: unknown) => Promise<unknown>): void {
    this.agentToolInvoker = invoker
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

    const migratedLegacyPaths = await this.fileService.migrateLegacyMarkdownNotes()
    if (Object.keys(migratedLegacyPaths).length > 0) {
      await this.remapSettingsForMigratedNotes(migratedLegacyPaths)
    }

    const settings = await this.settings.readVault(this.currentPaths.rootPath)
    await this.reconcileProjectTags(settings.projects, settings.projects)

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

  private decorateProjectTree(
    nodes: Awaited<ReturnType<FileService['listTree']>>,
    projects: Project[]
  ): Awaited<ReturnType<FileService['listTree']>> {
    return nodes.map((node) => {
      const protectionKind = getProjectProtectionKind(node.relPath, projects)
      if (node.kind === 'folder') {
        return {
          ...node,
          isProtected: Boolean(protectionKind),
          protectionKind,
          projectId: undefined,
          children: this.decorateProjectTree(node.children, projects)
        }
      }

      return {
        ...node,
        isProtected: false,
        protectionKind: null,
        projectId: undefined
      }
    })
  }

  private async reconcileProjectTags(
    previousProjects: Project[],
    nextProjects: Project[]
  ): Promise<void> {
    if (!this.currentPaths || !this.fileService) {
      return
    }

    const nextProjectTags = new Set(nextProjects.map((project) => generateProjectTag(project.id)))
    const removedProjectTags = previousProjects
      .map((project) => generateProjectTag(project.id))
      .filter((tag) => !nextProjectTags.has(tag))

    if (removedProjectTags.length === 0) {
      return
    }

    const removedTagSet = new Set(removedProjectTags)
    const notes = await this.fileService.listNotes()
    let changed = false

    for (const note of notes) {
      if (!note.tags.some((tag) => removedTagSet.has(tag))) {
        continue
      }

      const document = await this.fileService.readNoteDocument(note.relPath)
      const nextTags = document.tags.filter((tag) => !removedTagSet.has(tag))
      if (sameStringArray(document.tags, nextTags)) {
        continue
      }

      await this.fileService.writeNoteDocument(note.relPath, {
        ...document,
        tags: nextTags
      })
      changed = true
    }

    if (changed) {
      await this.indexer?.rebuild(this.currentPaths.notesPath)
    }
  }

  private async assertFolderCreationAllowed(relPath: string): Promise<void> {
    void relPath
  }

  private assertNoteCreationAllowed(relPath: string): void {
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
        contexts.push({
          summary: {
            id: mention.id,
            kind: 'project',
            label: mention.label,
            detail: project.summary || project.status
          },
          promptBlock: formatProjectContext(project)
        })
      }
    }

    return contexts
  }

  private async runAgentChatLoopFromMessages(
    mistral: Mistral,
    model: string,
    messages: MistralChatMessage[],
    requestId: string
  ): Promise<{ content: string; toolSteps: AgentChatToolStep[] }> {
    const toolSteps: AgentChatToolStep[] = []

    let finalContent = ''

    for (let iteration = 0; iteration < 6; iteration += 1) {
      this.emitAgentChatEvent({ requestId, type: 'status', status: 'thinking' })
      const stream = await mistral.chat.stream({
        model,
        temperature: 0.25,
        messages,
        tools: AGENT_CHAT_TOOLS,
        toolChoice: 'auto',
        parallelToolCalls: false
      })

      let assistantContent = ''
      let toolCalls: MistralToolCall[] = []

      for await (const event of stream) {
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

function sameStringArray(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
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
    `Status: ${project.status}`,
    `Progress: ${project.progress}%`,
    `Summary: ${project.summary || 'None'}`,
    'Milestones:',
    project.milestones.length > 0
      ? project.milestones
          .map((milestone, index) => formatMilestoneContext(milestone, index + 1))
          .join('\n')
      : '- None'
  ].join('\n')
}

function formatMilestoneContext(milestone: ProjectMilestone, index: number): string {
  return [
    `- ${index}. ${milestone.title} | due ${milestone.dueDate ?? 'unscheduled'} | status ${milestone.status}`,
    milestone.description ? `  Description: ${milestone.description}` : '',
    milestone.subtasks.length > 0
      ? `  Subtasks: ${milestone.subtasks
          .map((subtask) => `${subtask.completed ? '[x]' : '[ ]'} ${subtask.title}`)
          .join('; ')}`
      : '  Subtasks: none'
  ]
    .filter(Boolean)
    .join('\n')
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
  'milestone.create',
  'milestone.update',
  'subtask.create',
  'subtask.update',
  'calendarTask.create',
  'calendarTask.update',
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
    'milestone.create',
    'milestone.update',
    'subtask.create',
    'subtask.update',
    'calendarTask.create',
    'calendarTask.update',
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
