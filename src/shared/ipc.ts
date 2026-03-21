export const IPC_CHANNELS = {
  vaultOpen: 'vault:open',
  vaultCreate: 'vault:create',
  vaultRestoreLast: 'vault:restore-last',
  uiShowNativeMenu: 'ui:show-native-menu',
  listNotes: 'files:list-notes',
  readNote: 'files:read-note',
  writeNote: 'files:write-note',
  createNote: 'files:create-note',
  createNoteWithTags: 'files:create-note-with-tags',
  renameNote: 'files:rename-note',
  deleteNote: 'files:delete-note',
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

export const AGENT_TOOL_CHANNELS = {
  invoke: 'agentTools:invoke'
} as const
