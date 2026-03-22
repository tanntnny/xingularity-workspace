import { contextBridge, ipcRenderer } from 'electron'
import {
  AGENT_TOOL_CHANNELS,
  IPC_CHANNELS,
  SCHEDULE_CHANNELS,
  WEEKLY_PLAN_CHANNELS
} from '../shared/ipc'
import { AgentChatEvent, RendererVaultApi } from '../shared/types'

const api: RendererVaultApi = {
  ui: {
    platform: process.platform,
    showNativeMenu: (items, position) =>
      ipcRenderer.invoke(IPC_CHANNELS.uiShowNativeMenu, { items, position })
  },
  vault: {
    open: () => ipcRenderer.invoke(IPC_CHANNELS.vaultOpen),
    create: () => ipcRenderer.invoke(IPC_CHANNELS.vaultCreate),
    restoreLast: () => ipcRenderer.invoke(IPC_CHANNELS.vaultRestoreLast)
  },
  desktop: {
    chooseDirectory: (title) => ipcRenderer.invoke(IPC_CHANNELS.desktopChooseDirectory, title),
    openPath: (targetPath) => ipcRenderer.invoke(IPC_CHANNELS.desktopOpenPath, targetPath)
  },
  files: {
    listNotes: () => ipcRenderer.invoke(IPC_CHANNELS.listNotes),
    readNote: (relPath) => ipcRenderer.invoke(IPC_CHANNELS.readNote, relPath),
    writeNote: (relPath, content) => ipcRenderer.invoke(IPC_CHANNELS.writeNote, relPath, content),
    createNote: (name) => ipcRenderer.invoke(IPC_CHANNELS.createNote, name),
    createNoteWithTags: (name, tags) =>
      ipcRenderer.invoke(IPC_CHANNELS.createNoteWithTags, name, tags),
    importNotes: () => ipcRenderer.invoke(IPC_CHANNELS.importNotes),
    rename: (fromRelPath, toRelPath) =>
      ipcRenderer.invoke(IPC_CHANNELS.renameNote, fromRelPath, toRelPath),
    delete: (relPath) => ipcRenderer.invoke(IPC_CHANNELS.deleteNote, relPath),
    exportNote: (relPath, content) => ipcRenderer.invoke(IPC_CHANNELS.exportNote, relPath, content),
    exportProject: (projectName, content) =>
      ipcRenderer.invoke(IPC_CHANNELS.exportProject, projectName, content)
  },
  search: {
    query: (query) => ipcRenderer.invoke(IPC_CHANNELS.searchQuery, query)
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
    listSessions: () => ipcRenderer.invoke(IPC_CHANNELS.agentChatListSessions),
    saveSession: (session) => ipcRenderer.invoke(IPC_CHANNELS.agentChatSaveSession, session),
    deleteSession: (sessionId) =>
      ipcRenderer.invoke(IPC_CHANNELS.agentChatDeleteSession, sessionId),
    approveTool: (input) => ipcRenderer.invoke(IPC_CHANNELS.agentChatApproveTool, input),
    onEvent: (listener) => {
      const wrapped = (_event: Electron.IpcRendererEvent, payload: AgentChatEvent) =>
        listener(payload)
      ipcRenderer.on(IPC_CHANNELS.agentChatEvent, wrapped)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.agentChatEvent, wrapped)
    }
  },
  agentHistory: {
    listRuns: () => ipcRenderer.invoke(IPC_CHANNELS.agentHistoryListRuns)
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
    milestone: {
      create: (input) => ipcRenderer.invoke(AGENT_TOOL_CHANNELS.invoke, 'milestone.create', input),
      update: (input) => ipcRenderer.invoke(AGENT_TOOL_CHANNELS.invoke, 'milestone.update', input)
    },
    subtask: {
      create: (input) => ipcRenderer.invoke(AGENT_TOOL_CHANNELS.invoke, 'subtask.create', input),
      update: (input) => ipcRenderer.invoke(AGENT_TOOL_CHANNELS.invoke, 'subtask.update', input)
    },
    calendarTask: {
      create: (input) =>
        ipcRenderer.invoke(AGENT_TOOL_CHANNELS.invoke, 'calendarTask.create', input),
      update: (input) =>
        ipcRenderer.invoke(AGENT_TOOL_CHANNELS.invoke, 'calendarTask.update', input)
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
