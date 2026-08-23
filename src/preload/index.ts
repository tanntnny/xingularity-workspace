import { contextBridge, ipcRenderer } from 'electron'
import {
  AGENT_TOOL_CHANNELS,
  CALENDAR_CHANNELS,
  IPC_CHANNELS,
  SCHEDULE_CHANNELS,
  SUBSCRIPTION_CHANNELS,
  WEEKLY_PLAN_CHANNELS
} from '../shared/ipc'
import {
  AgentChatEvent,
  AppErrorEvent,
  ReminderClickTarget,
  RendererVaultApi
} from '../shared/types'

const api: RendererVaultApi = {
  ui: {
    platform: process.platform,
    showNativeMenu: (items, position) =>
      ipcRenderer.invoke(IPC_CHANNELS.uiShowNativeMenu, { items, position }),
    reloadApp: () => ipcRenderer.invoke(IPC_CHANNELS.uiReloadApp)
  },
  app: {
    onError: (listener): (() => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, payload: AppErrorEvent): void => {
        listener(payload)
      }
      ipcRenderer.on(IPC_CHANNELS.appErrorEvent, wrapped)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.appErrorEvent, wrapped)
    }
  },
  vault: {
    open: () => ipcRenderer.invoke(IPC_CHANNELS.vaultOpen),
    create: () => ipcRenderer.invoke(IPC_CHANNELS.vaultCreate),
    restoreLast: () => ipcRenderer.invoke(IPC_CHANNELS.vaultRestoreLast),
    runMigration: () => ipcRenderer.invoke(IPC_CHANNELS.vaultRunMigration),
    getMigrationReport: () => ipcRenderer.invoke(IPC_CHANNELS.vaultMigrationReport),
    listSaved: () => ipcRenderer.invoke(IPC_CHANNELS.vaultListSaved),
    switchSaved: (rootPath) => ipcRenderer.invoke(IPC_CHANNELS.vaultSwitchSaved, rootPath),
    toggleFavoriteSaved: (rootPath) =>
      ipcRenderer.invoke(IPC_CHANNELS.vaultToggleFavoriteSaved, rootPath),
    removeSaved: (rootPath) => ipcRenderer.invoke(IPC_CHANNELS.vaultRemoveSaved, rootPath)
  },
  desktop: {
    chooseDirectory: (title) => ipcRenderer.invoke(IPC_CHANNELS.desktopChooseDirectory, title),
    choosePath: (title) => ipcRenderer.invoke(IPC_CHANNELS.desktopChoosePath, title),
    openExternal: (url) => ipcRenderer.invoke(IPC_CHANNELS.desktopOpenExternal, url),
    openPath: (targetPath) => ipcRenderer.invoke(IPC_CHANNELS.desktopOpenPath, targetPath),
    openWarpAtNotePath: (relPath) =>
      ipcRenderer.invoke(IPC_CHANNELS.desktopOpenWarpAtNotePath, relPath)
  },
  files: {
    listNotes: () => ipcRenderer.invoke(IPC_CHANNELS.listNotes),
    listTree: () => ipcRenderer.invoke(IPC_CHANNELS.listNoteTree),
    onTreeChanged: (listener): (() => void) => {
      const wrapped = (): void => listener()
      ipcRenderer.on(IPC_CHANNELS.filesTreeChanged, wrapped)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.filesTreeChanged, wrapped)
    },
    readNote: (relPath) => ipcRenderer.invoke(IPC_CHANNELS.readNote, relPath),
    readNoteDocument: (relPath) => ipcRenderer.invoke(IPC_CHANNELS.readNoteDocument, relPath),
    readExcalidrawFileDocument: (relPath) =>
      ipcRenderer.invoke(IPC_CHANNELS.readExcalidrawFileDocument, relPath),
    writeNote: (relPath, content) => ipcRenderer.invoke(IPC_CHANNELS.writeNote, relPath, content),
    writeNoteDocument: (relPath, document): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.writeNoteDocument, relPath, document),
    writeExcalidrawFileDocument: (relPath, document): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.writeExcalidrawFileDocument, relPath, document),
    createNote: (name) => ipcRenderer.invoke(IPC_CHANNELS.createNote, name),
    createNoteAtPath: (relPath) => ipcRenderer.invoke(IPC_CHANNELS.createNoteAtPath, relPath),
    createExcalidrawFileAtPath: (relPath) =>
      ipcRenderer.invoke(IPC_CHANNELS.createExcalidrawFileAtPath, relPath),
    createNoteWithTags: (name, tags) =>
      ipcRenderer.invoke(IPC_CHANNELS.createNoteWithTags, name, tags),
    createFolder: (relPath) => ipcRenderer.invoke(IPC_CHANNELS.createFolder, relPath),
    importNotes: () => ipcRenderer.invoke(IPC_CHANNELS.importNotes),
    migrateBlockNoteNotes: () => ipcRenderer.invoke(IPC_CHANNELS.migrateBlockNoteNotes),
    migrateTaggedNoteBodyFrontmatter: () =>
      ipcRenderer.invoke(IPC_CHANNELS.migrateTaggedNoteBodyFrontmatter),
    migrateNoteImagePaths: () => ipcRenderer.invoke(IPC_CHANNELS.migrateNoteImagePaths),
    rename: (fromRelPath, toRelPath) =>
      ipcRenderer.invoke(IPC_CHANNELS.renameNote, fromRelPath, toRelPath),
    renamePath: (fromRelPath, toRelPath) =>
      ipcRenderer.invoke(IPC_CHANNELS.renamePath, fromRelPath, toRelPath),
    delete: (relPath) => ipcRenderer.invoke(IPC_CHANNELS.deleteNote, relPath),
    deletePath: (relPath) => ipcRenderer.invoke(IPC_CHANNELS.deletePath, relPath),
    deletePaths: (relPaths) => ipcRenderer.invoke(IPC_CHANNELS.deletePaths, relPaths),
    exportNote: (relPath, content) => ipcRenderer.invoke(IPC_CHANNELS.exportNote, relPath, content),
    exportNotePdf: (input) => ipcRenderer.invoke(IPC_CHANNELS.exportNotePdf, input),
    exportFolderPdf: (input) => ipcRenderer.invoke(IPC_CHANNELS.exportFolderPdf, input),
    exportFolderMarkdown: (input) => ipcRenderer.invoke(IPC_CHANNELS.exportFolderMarkdown, input),
    exportProjectContext: (input) => ipcRenderer.invoke(IPC_CHANNELS.exportProjectContext, input)
  },
  reminders: {
    onClick: (listener): (() => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, target: ReminderClickTarget): void => {
        listener(target)
      }
      ipcRenderer.on(IPC_CHANNELS.reminderClicked, wrapped)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.reminderClicked, wrapped)
    }
  },
  fleeting: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.listFleetingNotes),
    create: (content) => ipcRenderer.invoke(IPC_CHANNELS.createFleetingNote, content),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.updateFleetingNote, input),
    remove: (relPath) => ipcRenderer.invoke(IPC_CHANNELS.removeFleetingNote, relPath),
    convert: (input) => ipcRenderer.invoke(IPC_CHANNELS.convertFleetingNote, input)
  },
  search: {
    query: (query) => ipcRenderer.invoke(IPC_CHANNELS.searchQuery, query)
  },
  resources: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.resourcesList),
    add: (input) => ipcRenderer.invoke(IPC_CHANNELS.resourcesAdd, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.resourcesUpdate, input),
    setProjectNotebook: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.resourcesSetProjectNotebook, input),
    detachFromProject: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.resourcesDetachFromProject, input),
    refresh: (resourceId) => ipcRenderer.invoke(IPC_CHANNELS.resourcesRefresh, resourceId),
    locate: (resourceId, nextPath) =>
      ipcRenderer.invoke(IPC_CHANNELS.resourcesLocate, resourceId, nextPath),
    preview: (resourceId, allowContent) =>
      ipcRenderer.invoke(IPC_CHANNELS.resourcesPreview, resourceId, allowContent),
    relate: (input) => ipcRenderer.invoke(IPC_CHANNELS.resourcesRelate, input),
    projectContext: (projectId) =>
      ipcRenderer.invoke(IPC_CHANNELS.resourcesProjectContext, projectId),
    open: (resourceId) => ipcRenderer.invoke(IPC_CHANNELS.resourcesOpen, resourceId),
    reveal: (resourceId) => ipcRenderer.invoke(IPC_CHANNELS.resourcesReveal, resourceId),
    previewWrite: (input) => ipcRenderer.invoke(IPC_CHANNELS.resourcesPreviewWrite, input),
    applyWrite: (input, confirmation) =>
      ipcRenderer.invoke(IPC_CHANNELS.resourcesApplyWrite, input, confirmation),
    writeAudit: () => ipcRenderer.invoke(IPC_CHANNELS.resourcesWriteAudit),
    drive: {
      startAuthorization: () => ipcRenderer.invoke(IPC_CHANNELS.resourcesDriveStartAuthorization),
      completeAuthorization: (input) =>
        ipcRenderer.invoke(IPC_CHANNELS.resourcesDriveCompleteAuthorization, input),
      listFiles: () => ipcRenderer.invoke(IPC_CHANNELS.resourcesDriveListFiles),
      attach: (input) => ipcRenderer.invoke(IPC_CHANNELS.resourcesDriveAttach, input),
      refresh: (pageToken) => ipcRenderer.invoke(IPC_CHANNELS.resourcesDriveRefresh, pageToken),
      disconnect: () => ipcRenderer.invoke(IPC_CHANNELS.resourcesDriveDisconnect)
    }
  },
  attachments: {
    import: (sourcePath) => ipcRenderer.invoke(IPC_CHANNELS.importAttachment, sourcePath),
    importFromBuffer: (buffer: Uint8Array, fileExtension: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.importAttachmentFromBuffer, buffer, fileExtension)
  },
  ai: {
    completeNote: (input) => ipcRenderer.invoke(IPC_CHANNELS.aiCompleteNote, input)
  },
  agentChat: {
    sendMessage: (input) => ipcRenderer.invoke(IPC_CHANNELS.agentChatSendMessage, input),
    cancel: (requestId) => ipcRenderer.invoke(IPC_CHANNELS.agentChatCancel, requestId),
    listSessions: () => ipcRenderer.invoke(IPC_CHANNELS.agentChatListSessions),
    saveSession: (session) => ipcRenderer.invoke(IPC_CHANNELS.agentChatSaveSession, session),
    deleteSession: (sessionId) =>
      ipcRenderer.invoke(IPC_CHANNELS.agentChatDeleteSession, sessionId),
    approveTool: (input) => ipcRenderer.invoke(IPC_CHANNELS.agentChatApproveTool, input),
    onEvent: (listener): (() => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, payload: AgentChatEvent): void => {
        listener(payload)
      }
      ipcRenderer.on(IPC_CHANNELS.agentChatEvent, wrapped)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.agentChatEvent, wrapped)
    }
  },
  agentHistory: {
    listRuns: () => ipcRenderer.invoke(IPC_CHANNELS.agentHistoryListRuns)
  },
  excalidraw: {
    listSessions: () => ipcRenderer.invoke(IPC_CHANNELS.excalidrawListSessions),
    saveSession: (session) => ipcRenderer.invoke(IPC_CHANNELS.excalidrawSaveSession, session),
    deleteSession: (sessionId) =>
      ipcRenderer.invoke(IPC_CHANNELS.excalidrawDeleteSession, sessionId),
    importLegacySessions: () => ipcRenderer.invoke(IPC_CHANNELS.excalidrawImportLegacySessions)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
    update: (next, options) => ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, next, options)
  },
  credentials: {
    status: (provider) => ipcRenderer.invoke(IPC_CHANNELS.credentialStatus, provider),
    set: (provider, value) => ipcRenderer.invoke(IPC_CHANNELS.credentialSet, provider, value),
    delete: (provider) => ipcRenderer.invoke(IPC_CHANNELS.credentialDelete, provider)
  },
  calendar: {
    getState: () => ipcRenderer.invoke(CALENDAR_CHANNELS.getState),
    startGoogleAuthorization: (accountLabel) =>
      ipcRenderer.invoke(CALENDAR_CHANNELS.startGoogleAuthorization, accountLabel),
    completeGoogleAuthorization: (input) =>
      ipcRenderer.invoke(CALENDAR_CHANNELS.completeGoogleAuthorization, input),
    cancelGoogleAuthorization: (connectionId) =>
      ipcRenderer.invoke(CALENDAR_CHANNELS.cancelGoogleAuthorization, connectionId),
    selectGoogleCalendars: (input) =>
      ipcRenderer.invoke(CALENDAR_CHANNELS.selectGoogleCalendars, input),
    syncGoogleConnection: (connectionId) =>
      ipcRenderer.invoke(CALENDAR_CHANNELS.syncGoogleConnection, connectionId),
    createLocalEvent: (input) => ipcRenderer.invoke(CALENDAR_CHANNELS.createLocalEvent, input),
    updateLocalEvent: (input) => ipcRenderer.invoke(CALENDAR_CHANNELS.updateLocalEvent, input),
    linkTaskToEvent: (input) => ipcRenderer.invoke(CALENDAR_CHANNELS.linkTaskToEvent, input),
    unlinkTaskFromEvent: (linkId) =>
      ipcRenderer.invoke(CALENDAR_CHANNELS.unlinkTaskFromEvent, linkId),
    deleteLocalCache: (connectionId) =>
      ipcRenderer.invoke(CALENDAR_CHANNELS.deleteLocalCache, connectionId),
    disconnectGoogleConnection: (input) =>
      ipcRenderer.invoke(CALENDAR_CHANNELS.disconnectGoogleConnection, input),
    revokeGoogleConnection: (input) =>
      ipcRenderer.invoke(CALENDAR_CHANNELS.revokeGoogleConnection, input)
  },
  python: {
    listCondaEnvironments: () => ipcRenderer.invoke(IPC_CHANNELS.pythonListCondaEnvironments),
    chooseCondaExecutable: () => ipcRenderer.invoke(IPC_CHANNELS.pythonChooseCondaExecutable)
  },
  projects: {
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.createProject, input),
    select: (input) => ipcRenderer.invoke(IPC_CHANNELS.selectProject, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.updateProject, input),
    setState: (input) => ipcRenderer.invoke(IPC_CHANNELS.setProjectState, input),
    setFavorite: (input) => ipcRenderer.invoke(IPC_CHANNELS.setProjectFavorite, input),
    delete: (input) => ipcRenderer.invoke(IPC_CHANNELS.deleteProject, input),
    createMilestone: (input) => ipcRenderer.invoke(IPC_CHANNELS.createProjectMilestone, input),
    updateMilestone: (input) => ipcRenderer.invoke(IPC_CHANNELS.updateProjectMilestone, input),
    reorderMilestones: (input) => ipcRenderer.invoke(IPC_CHANNELS.reorderProjectMilestones, input),
    deleteMilestone: (input) => ipcRenderer.invoke(IPC_CHANNELS.deleteProjectMilestone, input),
    createUpdate: (input) => ipcRenderer.invoke(IPC_CHANNELS.createProjectUpdate, input),
    updateUpdate: (input) => ipcRenderer.invoke(IPC_CHANNELS.updateProjectUpdate, input),
    deleteUpdate: (input) => ipcRenderer.invoke(IPC_CHANNELS.deleteProjectUpdate, input)
  },
  tasks: {
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.createTask, input)
  },
  history: {
    undo: () => ipcRenderer.invoke(IPC_CHANNELS.historyUndo),
    redo: () => ipcRenderer.invoke(IPC_CHANNELS.historyRedo),
    status: () => ipcRenderer.invoke(IPC_CHANNELS.historyStatus)
  },
  schedules: {
    listJobs: () => ipcRenderer.invoke(SCHEDULE_CHANNELS.listJobs),
    saveJob: (input) => ipcRenderer.invoke(SCHEDULE_CHANNELS.saveJob, input),
    deleteJob: (id) => ipcRenderer.invoke(SCHEDULE_CHANNELS.deleteJob, id),
    runNow: (id) => ipcRenderer.invoke(SCHEDULE_CHANNELS.runNow, id),
    cancelRun: (id) => ipcRenderer.invoke(SCHEDULE_CHANNELS.cancelRun, id),
    listRuns: (jobId) => ipcRenderer.invoke(SCHEDULE_CHANNELS.listRuns, jobId),
    applyActions: (runId) => ipcRenderer.invoke(SCHEDULE_CHANNELS.applyActions, runId),
    dismissRun: (runId) => ipcRenderer.invoke(SCHEDULE_CHANNELS.dismissRun, runId),
    listSecrets: () => ipcRenderer.invoke(SCHEDULE_CHANNELS.listSecrets),
    saveSecret: (input) => ipcRenderer.invoke(SCHEDULE_CHANNELS.saveSecret, input),
    deleteSecret: (name) => ipcRenderer.invoke(SCHEDULE_CHANNELS.deleteSecret, name)
  },
  weeklyPlan: {
    getState: () => ipcRenderer.invoke(WEEKLY_PLAN_CHANNELS.getState),
    createWeek: (input) => ipcRenderer.invoke(WEEKLY_PLAN_CHANNELS.createWeek, input),
    updateWeek: (input) => ipcRenderer.invoke(WEEKLY_PLAN_CHANNELS.updateWeek, input),
    deleteWeek: (input) => ipcRenderer.invoke(WEEKLY_PLAN_CHANNELS.deleteWeek, input),
    addPriority: (input) => ipcRenderer.invoke(WEEKLY_PLAN_CHANNELS.addPriority, input),
    updatePriority: (input) => ipcRenderer.invoke(WEEKLY_PLAN_CHANNELS.updatePriority, input),
    deletePriority: (priorityId) =>
      ipcRenderer.invoke(WEEKLY_PLAN_CHANNELS.deletePriority, priorityId),
    reorderPriorities: (input) => ipcRenderer.invoke(WEEKLY_PLAN_CHANNELS.reorderPriorities, input),
    upsertReview: (input) => ipcRenderer.invoke(WEEKLY_PLAN_CHANNELS.upsertReview, input)
  },
  subscriptions: {
    list: () => ipcRenderer.invoke(SUBSCRIPTION_CHANNELS.list),
    get: (id) => ipcRenderer.invoke(SUBSCRIPTION_CHANNELS.get, id),
    create: (input) => ipcRenderer.invoke(SUBSCRIPTION_CHANNELS.create, input),
    update: (input) => ipcRenderer.invoke(SUBSCRIPTION_CHANNELS.update, input),
    delete: (id) => ipcRenderer.invoke(SUBSCRIPTION_CHANNELS.delete, id),
    archive: (id) => ipcRenderer.invoke(SUBSCRIPTION_CHANNELS.archive, id),
    addPayment: (input) => ipcRenderer.invoke(SUBSCRIPTION_CHANNELS.addPayment, input),
    getAnalytics: (filters) => ipcRenderer.invoke(SUBSCRIPTION_CHANNELS.getAnalytics, filters)
  },
  agentTools: {
    note: {
      search: (input) => ipcRenderer.invoke(AGENT_TOOL_CHANNELS.invoke, 'note.search', input),
      read: (input) => ipcRenderer.invoke(AGENT_TOOL_CHANNELS.invoke, 'note.read', input),
      create: (input) => ipcRenderer.invoke(AGENT_TOOL_CHANNELS.invoke, 'note.create', input),
      update: (input) => ipcRenderer.invoke(AGENT_TOOL_CHANNELS.invoke, 'note.update', input),
      append: (input) => ipcRenderer.invoke(AGENT_TOOL_CHANNELS.invoke, 'note.append', input)
    },
    project: {
      create: (input) => ipcRenderer.invoke(AGENT_TOOL_CHANNELS.invoke, 'project.create', input),
      update: (input) => ipcRenderer.invoke(AGENT_TOOL_CHANNELS.invoke, 'project.update', input)
    },
    calendarTask: {
      create: (input) =>
        ipcRenderer.invoke(AGENT_TOOL_CHANNELS.invoke, 'calendarTask.create', input),
      update: (input) =>
        ipcRenderer.invoke(AGENT_TOOL_CHANNELS.invoke, 'calendarTask.update', input)
    },
    task: {
      create: (input) => ipcRenderer.invoke(AGENT_TOOL_CHANNELS.invoke, 'task.create', input),
      update: (input) => ipcRenderer.invoke(AGENT_TOOL_CHANNELS.invoke, 'task.update', input)
    },
    weeklyPlan: {
      createWeek: (input) =>
        ipcRenderer.invoke(AGENT_TOOL_CHANNELS.invoke, 'weeklyPlan.createWeek', input),
      createPriority: (input) =>
        ipcRenderer.invoke(AGENT_TOOL_CHANNELS.invoke, 'weeklyPlan.createPriority', input),
      upsertReview: (input) =>
        ipcRenderer.invoke(AGENT_TOOL_CHANNELS.invoke, 'weeklyPlan.upsertReview', input)
    }
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('vaultApi', api)
} else {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  window.vaultApi = api
}
