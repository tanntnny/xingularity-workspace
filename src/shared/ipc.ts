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
