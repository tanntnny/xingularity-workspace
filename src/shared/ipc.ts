export const IPC_CHANNELS = {
  vaultOpen: 'vault:open',
  vaultCreate: 'vault:create',
  vaultRestoreLast: 'vault:restore-last',
  listNotes: 'files:list-notes',
  readNote: 'files:read-note',
  writeNote: 'files:write-note',
  createNote: 'files:create-note',
  createNoteWithTags: 'files:create-note-with-tags',
  renameNote: 'files:rename-note',
  deleteNote: 'files:delete-note',
  exportNote: 'files:export-note',
  searchQuery: 'search:query',
  importAttachment: 'attachments:import',
  importAttachmentFromBuffer: 'attachments:import-from-buffer',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update'
} as const
