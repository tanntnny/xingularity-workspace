# Xingularity Pages And Data Models

This document describes the main product domains, page responsibilities, and shared data structures used by the app.

## Architecture Summary

Xingularity is organized into three layers:

- `src/main/`: Electron main-process services, vault access, indexing, schedules, reminders, persistence, and IPC handlers
- `src/preload/`: secure renderer bridge that exposes the allowed API surface to the UI
- `src/renderer/src/`: React application pages, components, local UI state, and page workflows

Cross-process contracts live in `src/shared/`, especially:

- `src/shared/types.ts`
- `src/shared/scheduleTypes.ts`
- `src/shared/ipc.ts`
- `src/shared/subscriptions.ts`

## Storage Boundaries

The app uses two persistence models.

### Vault-backed content

User workspace content lives in a selected local vault:

- `notebooks/**/*.md`
- `attachments/**`
- `settings.json`
- `projects/<project-id>.json`
- `calendar/tasks.json`
- `weekly-plan/state.json`
- `subscriptions/data.json`
- `schedules/jobs.json`
- `schedules/runs.json`
- `agent/chats.json`
- `agent/runs.json`
- `excalidraw/sessions.json`
- `vault.json`
- `migrations.json`
- `filemap.json`
- `index.sqlite`

This layer is responsible for:

- notebook files
- folder structure
- attachments
- standalone workspace records
- note indexing and search metadata

### App-managed structured state

Application state is persisted outside the note bodies and exposed through settings, weekly plan, schedules, and agent APIs.

Main app-managed domains:

- app settings
- projects
- calendar tasks
- grid board state
- weekly plans
- subscriptions
- schedule jobs and run records
- agent chat sessions
- agent run history

All app-managed vault data uses standalone root-level files, except notebook content which stays under `notebooks/`.

Legacy vault behavior:

- older `notes/` roots are copied into `notebooks/`
- older `.appmeta/` and `.xingularity/` metadata is promoted into root-level canonical files
- older page-folder JSON stores are read once and persisted into the canonical page folders
- if both `notes/` and `notebooks/` already exist before migration, vault open fails with a conflict instead of merging automatically

## Top-Level App Settings

The renderer anchors most persistent state on `AppSettings`.

### `AppSettings`

Defined in `src/shared/types.ts`.

Key fields:

- `isSidebarCollapsed`: sidebar collapse state
- `lastVaultPath`: last opened vault root
- `lastOpenedNotePath`: last selected note path
- `lastOpenedProjectId`: last selected project
- `favoriteNotePaths`: pinned notes
- `favoriteProjectIds`: pinned projects
- `profile.name`: display name shown in the app shell
- `ai.mistralApiKey`: model provider key
- `fontFamily`: active UI font family
- `calendarTasks`: persisted task collection
- `projectIcons`: icon overrides keyed by project id
- `projects`: persisted project collection
- `gridBoard`: saved spatial board state

### `AppSettingsUpdate`

Partial update payload used by the renderer to patch settings without resending the full object.

## Vault Domain Models

### `VaultInfo`

Paths that define the active vault:

- `rootPath`
- `notebooksPath`
- `notesPath` (compatibility alias to `notebooksPath`)
- `attachmentsPath`

### `VaultOpenResult`

Returned when opening or creating a vault:

- `info: VaultInfo`
- `notes: NoteListItem[]`

### `NoteMetadata`

Per-note metadata:

- `title`
- `tags`
- `created`
- `updated`

### `StoredNoteDocument`

Markdown note payload read from and written back to the vault:

- `version`
- `tags`
- `markdown`

### `NoteRecord`

Full note payload:

- `id`
- `relPath`
- `metadata`
- `body`

### `NoteListItem`

Primary note list/tree/search source item:

- `relPath`
- `name`
- `dir`
- `createdAt`
- `updatedAt`
- `tags`
- `bodyPreview`
- `mentionTargets`

### `NoteTreeNode`

Recursive folder and note tree model used by the notes tree view.

Shared base fields:

- `id`
- `relPath`
- `name`
- `isProtected`
- `protectionKind`
- `projectId`

Variants:

- `NoteTreeFolder`
- `NoteTreeFile`

Notebook tree folders are user-managed; compatibility fields for older protected-tree
metadata are ignored by the current runtime.

## Project Domain Models

Projects are stored as independent records in `projects/<project-id>.json`. They do not
create, own, or infer membership in notebook folders.

### `Project`

Main project record stored in `projects/<project-id>.json`:

- `id`
- `name`
- `description`
- `updatedAt`
- `icon`

### `ProjectIconStyle`

- `shape`
- `variant`
- `color`

Supported icon fields are defined by:

- `ProjectIconShape`
- `ProjectIconVariant`

### Notebook relationship

Notebook files are created and organized independently by the user. Project pages expose
project metadata and linked tasks; they do not contain a managed project-note list or
rewrite notebook tags when projects change.

## Calendar Domain Models

### `Task`

Unified task record used by Projects, Calendar, automation, and weekly planning. Each task
is stored in `tasks/<task-id>.json`:

- `id`
- `title`
- `description`
- `projectId`
- `date`
- `endDate`
- `completed`
- `status`
- `createdAt`
- `priority`
- `taskType`
- `reminders`
- `time`
- `automationSource`
- `automationSourceKey`

### `TaskReminder`

- `id`
- `type`
- `value`
- `enabled`

Reminder types:

- `minutes`
- `hours`
- `days`

## Weekly Plan Domain Models

### `WeeklyPlanState`

Root weekly-plan store:

- `weeks`
- `priorities`
- `reviews`

### `WeeklyPlanWeek`

- `id`
- `startDate`
- `endDate`
- `focus`
- `createdAt`
- `updatedAt`

### `WeeklyPlanPriority`

- `id`
- `weekId`
- `title`
- `status`
- `order`
- `linkedProjectId`
- `linkedTaskId`
- `createdAt`
- `updatedAt`

Priority status values:

- `planned`
- `in_progress`
- `done`

### `WeeklyPlanReview`

- `id`
- `weekId`
- `wins`
- `misses`
- `blockers`
- `nextWeek`
- `createdAt`
- `updatedAt`

## Subscription Domain Models

Subscription records are stored per vault and exposed through the subscriptions preload API. Shared helpers in `src/shared/subscriptions.ts` normalize billing intervals, derive monthly spend, filter records, bucket renewals, and compute analytics.

### `SubscriptionRecord`

- `id`
- `name`
- `provider`
- `category`
- `amount`
- `currency`
- `billingCycle`
- `billingIntervalMonths`
- `normalizedMonthlyAmount`
- `nextRenewalAt`
- `status`
- `reviewFlag`
- `lastUsedAt`
- `tags`
- `notes`
- `createdAt`
- `updatedAt`

Subscription status values:

- `active`
- `paused`
- `cancelled`
- `archived`

Billing cycle values:

- `monthly`
- `quarterly`
- `yearly`
- `custom`

Review flag values:

- `none`
- `review`
- `unused`
- `duplicate`
- `expensive`

### `CreateSubscriptionInput`

- `name`
- `provider`
- `category`
- `amount`
- `currency`
- `billingCycle`
- `billingIntervalMonths`
- `nextRenewalAt`
- `status`
- `reviewFlag`
- `lastUsedAt`
- `tags`
- `notes`

### `UpdateSubscriptionInput`

Patch payload for subscription updates. It includes `id` plus optional versions of the mutable record fields. Nullable fields such as `provider`, `nextRenewalAt`, `lastUsedAt`, and `notes` clear the stored value.

### `SubscriptionAnalyticsFilters`

- `search`
- `categories`
- `statuses`
- `includeArchived`

### `SubscriptionAnalytics`

- `totalMonthlyRecurring`
- `totalYearlyRecurring`
- `renewingSoonCount`
- `renewingSoonAmount`
- `reviewCount`
- `potentialSavingsMonthly`
- `treemapNodes`

### `SubscriptionTreemapNode`

- `id`
- `name`
- `value`
- `category`
- `status`
- `reviewFlag`
- `renewalBucket`

Renewal buckets:

- `soon`
- `later`

### `RendererSubscriptionsApi`

- `list()`
- `get(id)`
- `create(input)`
- `update(input)`
- `delete(id)`
- `archive(id)`
- `getAnalytics(filters)`

## Grid Domain Models

### `GridBoardState`

- `viewport`
- `items`

### `GridBoardViewport`

- `x`
- `y`
- `zoom`

### `GridBoardItem`

- `id`
- `kind`
- `noteRelPath`
- `projectId`
- `textContent`
- `textStyle`
- `position`
- `size`
- `zIndex`

Board item kinds:

- `note`
- `project`
- `text`

### `GridTextStyle`

- `fontSize`
- `isBold`
- `isItalic`
- `isUnderline`
- `textAlign`
- `color`

## Search And Knowledge Models

### `SearchResult`

Returned by local search:

- `id`
- `relPath`
- `title`
- `tags`
- `updated`
- `snippet`

### Note mention graph inputs

The knowledge page uses `NoteListItem[]`, especially:

- `relPath`
- `name`
- `mentionTargets`

Those mention relationships are transformed into graph nodes and links in renderer code.

## Schedule Domain Models

Schedules are defined in `src/shared/scheduleTypes.ts`.

### `ScheduleJob`

- `id`
- `name`
- `enabled`
- `trigger`
- `runtime`
- `code`
- `permissions`
- `outputMode`
- `createdAt`
- `updatedAt`
- `lastRunAt`
- `nextRunAt`
- `lastStatus`

### `TriggerConfig`

Shared trigger shape with fields based on trigger type:

- `type`
- `time`
- `timezone`
- `intervalMinutes`
- `expression`

Trigger types:

- `manual`
- `daily`
- `every`
- `cron`
- `on_app_start`

### `ScheduleRunRecord`

- `id`
- `jobId`
- `startedAt`
- `endedAt`
- `status`
- `stdout`
- `stderr`
- `errorMessage`
- `proposedActions`
- `appliedActions`

Run status values:

- `idle`
- `running`
- `success`
- `error`
- `review`
- `cancelled`

### `ScriptAction`

Supported automation outputs:

- `task.create`
- `task.update`
- `note.create`
- `note.append`
- `calendar.event.create`

### `SchedulePermission`

Permission scopes available to jobs:

- `network`
- `readNotes`
- `createNotes`
- `updateNotes`
- `createTasks`
- `updateTasks`
- `createCalendarItems`
- `updateProjects`
- `useSecrets`

## Agent Domain Models

### `AgentChatSession`

- `id`
- `title`
- `titleMode`
- `createdAt`
- `updatedAt`
- `messages`

### `AgentChatMessageRecord`

- `id`
- `role`
- `content`
- `createdAt`
- `mentions`
- `contexts`
- `toolSteps`
- `model`

### `AgentChatMentionRef`

- `id`
- `kind`
- `label`
- `notePath`
- `projectId`

Mention kinds:

- `note`
- `project`

### `AgentChatContextSummary`

Resolved context attached to prompts:

- `id`
- `kind`
- `label`
- `detail`

### `AgentChatToolStep`

- `id`
- `toolName`
- `status`
- `inputSummary`
- `outputSummary`
- `approvalRequest`

Tool step status values:

- `completed`
- `error`
- `approval-required`
- `rejected`

### `AgentRunRecord`

- `id`
- `agentName`
- `source`
- `startedAt`
- `endedAt`
- `status`
- `input`
- `output`
- `errorMessage`
- `model`
- `context`

## Import And Export Models

### `ImportedNoteResult`

- `sourceName`
- `relPath`
- `renamed`

### `FailedNoteImportResult`

- `sourceName`
- `error`

### `NoteImportResult`

- `imported`
- `failed`

## Page Responsibilities

### Dashboard

Reads primarily:

- `Project[]`
- current `WeeklyPlanWeek`
- current `WeeklyPlanPriority[]`
- `CalendarTask[]`

### Knowledge

Reads:

- `NoteListItem[]`

Outputs:

- graph visualization over note mention relationships

### Notes

Reads and mutates:

- note list and tree
- note documents
- search results
- favorites
- attachments

### Projects

Reads and mutates:

- `Project[]`
- `Task[]` filtered by `projectId`
- projects do not infer or manage notebook membership

### Grid

Reads and mutates:

- `GridBoardState`
- note and project references used by board items

### Calendar

Reads and mutates:

- `Task[]` with optional project assignment

### Weekly Plan

Reads and mutates:

- `WeeklyPlanState`
- links to projects and tasks

### Schedules

Reads and mutates:

- `ScheduleJob[]`
- `ScheduleRunRecord[]`

### Agent Chat

Reads and mutates:

- `AgentChatSession[]`
- `AgentRunRecord[]`

### Settings

Reads and mutates:

- `AppSettings`
- `VaultInfo`

## IPC Surface

IPC constants are defined in `src/shared/ipc.ts`.

Main groups:

- vault lifecycle
- desktop helpers
- debug helpers
- file CRUD and export
- search
- attachments
- AI note completion
- agent chat
- agent history
- settings
- schedules
- weekly plan
- agent tools

The preload layer exposes these capabilities to the renderer through `RendererVaultApi`.
