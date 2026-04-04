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
- `src/shared/projectFolders.ts`

## Storage Boundaries

The app uses two persistence models.

### Vault-backed content

User workspace content lives in a selected local vault:

- `notes/**/*.md`
- `attachments/**`
- `.appmeta/vault.json`
- `.appmeta/filemap.json`
- `.appmeta/index.sqlite`

This layer is responsible for:

- note files
- folder structure
- attachments
- note indexing and search metadata

### App-managed structured state

Application state is persisted outside the note bodies and exposed through settings, weekly plan, schedules, and agent APIs.

Main app-managed domains:

- app settings
- projects
- calendar tasks
- grid board state
- weekly plans
- schedule jobs and run records
- agent chat sessions
- agent run history

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
- `notesPath`
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

Structured note body persisted through the editor:

- `version`
- `tags`
- `blocks`

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

Protected tree behavior is driven by `src/shared/projectFolders.ts`.

## Project Domain Models

Projects are stored in app settings and synchronized into the notes tree through the managed `Projects/` folder.

### `Project`

Main project record:

- `id`
- `name`
- `summary`
- `folderPath`
- `status`
- `updatedAt`
- `progress`
- `milestones`
- `icon`

Project status values:

- `on-track`
- `at-risk`
- `blocked`
- `completed`

### `ProjectMilestone`

- `id`
- `title`
- `description`
- `collapsed`
- `dueDate`
- `priority`
- `status`
- `subtasks`

Milestone status values:

- `pending`
- `in-progress`
- `completed`
- `blocked`

### `ProjectSubtask`

- `id`
- `title`
- `description`
- `completed`
- `priority`
- `createdAt`
- `dueDate`

### `ProjectIconStyle`

- `shape`
- `variant`
- `color`

Supported icon fields are defined by:

- `ProjectIconShape`
- `ProjectIconVariant`

### Project folder synchronization

Project note membership is currently folder-based, not tag-assignment-based in the project page.

Shared helpers in `src/shared/projectFolders.ts` define:

- `PROJECTS_ROOT_FOLDER_NAME`
- `getProjectsRootPath()`
- `getProjectFolderPath(project)`
- `isProtectedProjectTreePath(relPath, projects)`
- `resolveProjectByFolderPath(relPath, projects)`

Current rule:

- notes under `Projects/<project>/...` belong to that project in the UI

## Calendar Domain Models

### `CalendarTask`

Task record used by the calendar and unscheduled list:

- `id`
- `title`
- `date`
- `endDate`
- `completed`
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

### `CalendarItem`

Unified render model for calendar views:

- `id`
- `type`
- `title`
- `date`
- `completed`
- `priority`
- `projectId`
- `projectName`
- `milestoneId`
- `milestoneName`

Item types:

- `task`
- `milestone`
- `subtask`

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
- `linkedMilestoneId`
- `linkedSubtaskId`
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
- `ProjectMilestone[]`
- `ProjectSubtask[]`
- project notes inferred from `Projects/<project>/...`

### Grid

Reads and mutates:

- `GridBoardState`
- note and project references used by board items

### Calendar

Reads and mutates:

- `CalendarTask[]`
- milestone-derived and subtask-derived calendar items

### Weekly Plan

Reads and mutates:

- `WeeklyPlanState`
- links to projects, milestones, subtasks, and tasks

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
