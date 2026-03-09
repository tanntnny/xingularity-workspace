import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc'
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
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('vaultApi', api)
} else {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  window.vaultApi = api
}
