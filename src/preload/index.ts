import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, SCHEDULE_CHANNELS, WEEKLY_PLAN_CHANNELS } from '../shared/ipc'
import { RendererVaultApi } from '../shared/types'

const api: RendererVaultApi = {
  vault: {
    open: () => ipcRenderer.invoke(IPC_CHANNELS.vaultOpen),
    create: () => ipcRenderer.invoke(IPC_CHANNELS.vaultCreate),
    restoreLast: () => ipcRenderer.invoke(IPC_CHANNELS.vaultRestoreLast)
  },
  files: {
    listNotes: () => ipcRenderer.invoke(IPC_CHANNELS.listNotes),
    readNote: (relPath) => ipcRenderer.invoke(IPC_CHANNELS.readNote, relPath),
    writeNote: (relPath, content) => ipcRenderer.invoke(IPC_CHANNELS.writeNote, relPath, content),
    createNote: (name) => ipcRenderer.invoke(IPC_CHANNELS.createNote, name),
    createNoteWithTags: (name, tags) =>
      ipcRenderer.invoke(IPC_CHANNELS.createNoteWithTags, name, tags),
    rename: (fromRelPath, toRelPath) =>
      ipcRenderer.invoke(IPC_CHANNELS.renameNote, fromRelPath, toRelPath),
    delete: (relPath) => ipcRenderer.invoke(IPC_CHANNELS.deleteNote, relPath),
    exportNote: (relPath, content) => ipcRenderer.invoke(IPC_CHANNELS.exportNote, relPath, content)
  },
  search: {
    query: (query) => ipcRenderer.invoke(IPC_CHANNELS.searchQuery, query)
  },
  attachments: {
    import: (sourcePath) => ipcRenderer.invoke(IPC_CHANNELS.importAttachment, sourcePath),
    importFromBuffer: (buffer: Uint8Array, fileExtension: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.importAttachmentFromBuffer, buffer, fileExtension)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
    update: (next) => ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, next)
  },
  schedules: {
    listJobs: () => ipcRenderer.invoke(SCHEDULE_CHANNELS.listJobs),
    saveJob: (input) => ipcRenderer.invoke(SCHEDULE_CHANNELS.saveJob, input),
    deleteJob: (id) => ipcRenderer.invoke(SCHEDULE_CHANNELS.deleteJob, id),
    runNow: (id) => ipcRenderer.invoke(SCHEDULE_CHANNELS.runNow, id),
    listRuns: (jobId) => ipcRenderer.invoke(SCHEDULE_CHANNELS.listRuns, jobId),
    applyActions: (runId) => ipcRenderer.invoke(SCHEDULE_CHANNELS.applyActions, runId),
    dismissRun: (runId) => ipcRenderer.invoke(SCHEDULE_CHANNELS.dismissRun, runId)
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
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('vaultApi', api)
} else {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  window.vaultApi = api
}
