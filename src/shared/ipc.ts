export const IPC_CHANNELS = {
  vaultOpen: 'vault:open',
  vaultCreate: 'vault:create',
  vaultRestoreLast: 'vault:restore-last',
  desktopChooseDirectory: 'desktop:choose-directory',
  desktopOpenPath: 'desktop:open-path',
  uiShowNativeMenu: 'ui:show-native-menu',
  listNotes: 'files:list-notes',
  listNoteTree: 'files:list-note-tree',
  readNote: 'files:read-note',
  readNoteDocument: 'files:read-note-document',
  writeNote: 'files:write-note',
  writeNoteDocument: 'files:write-note-document',
  createNote: 'files:create-note',
  createNoteAtPath: 'files:create-note-at-path',
  createNoteWithTags: 'files:create-note-with-tags',
  createFolder: 'files:create-folder',
  importNotes: 'files:import-notes',
  migrateBlockNoteNotes: 'files:migrate-blocknote-notes',
  migrateTaggedNoteBodyFrontmatter: 'files:migrate-tagged-note-body-frontmatter',
  renameNote: 'files:rename-note',
  renamePath: 'files:rename-path',
  deleteNote: 'files:delete-note',
  deletePath: 'files:delete-path',
  exportNote: 'files:export-note',
  exportProject: 'files:export-project',
  searchQuery: 'search:query',
  aiCompleteNote: 'ai:complete-note',
  agentChatSendMessage: 'agent-chat:send-message',
  agentChatListSessions: 'agent-chat:list-sessions',
  agentChatSaveSession: 'agent-chat:save-session',
  agentChatDeleteSession: 'agent-chat:delete-session',
  agentChatApproveTool: 'agent-chat:approve-tool',
  agentChatEvent: 'agent-chat:event',
  agentHistoryListRuns: 'agent-history:list-runs',
  appErrorEvent: 'app:error-event',
  importAttachment: 'attachments:import',
  importAttachmentFromBuffer: 'attachments:import-from-buffer',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update'
} as const

export const SCHEDULE_CHANNELS = {
  listJobs: 'schedule:list-jobs',
  saveJob: 'schedule:save-job',
  deleteJob: 'schedule:delete-job',
  runNow: 'schedule:run-now',
  listRuns: 'schedule:list-runs',
  applyActions: 'schedule:apply-actions',
  dismissRun: 'schedule:dismiss-run'
} as const

export const WEEKLY_PLAN_CHANNELS = {
  getState: 'weeklyPlan:get-state',
  createWeek: 'weeklyPlan:create-week',
  updateWeek: 'weeklyPlan:update-week',
  deleteWeek: 'weeklyPlan:delete-week',
  addPriority: 'weeklyPlan:add-priority',
  updatePriority: 'weeklyPlan:update-priority',
  deletePriority: 'weeklyPlan:delete-priority',
  reorderPriorities: 'weeklyPlan:reorder-priorities',
  upsertReview: 'weeklyPlan:upsert-review'
} as const

export const SUBSCRIPTION_CHANNELS = {
  list: 'subscriptions:list',
  get: 'subscriptions:get',
  create: 'subscriptions:create',
  update: 'subscriptions:update',
  delete: 'subscriptions:delete',
  archive: 'subscriptions:archive',
  getAnalytics: 'subscriptions:get-analytics'
} as const

export const AGENT_TOOL_CHANNELS = {
  invoke: 'agentTools:invoke'
} as const
