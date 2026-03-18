# Xingularity Pages And Data Model

This reference maps the current pages to the main data they read and mutate.

## App Map

The sidebar page ids are defined in [`src/renderer/src/components/AppSidebar.tsx`](/Users/tanny/Documents/Projects/Beacon/Xingularity/src/renderer/src/components/AppSidebar.tsx):

- `notes`
- `projects`
- `calendar`
- `weeklyPlan`
- `schedules`
- `agentHistory`
- `settings`

Most pages use the shared document workspace layout:

- sidebar for app navigation
- main workspace for page content
- right panel for related lists and actions

## Shared State

The renderer centers most persistent UI state around `AppSettings` in [`src/shared/types.ts`](/Users/tanny/Documents/Projects/Beacon/Xingularity/src/shared/types.ts).

### `AppSettings`

- `isSidebarCollapsed`: sidebar collapse state
- `lastVaultPath`: last opened vault root
- `lastOpenedNotePath`: last active note
- `lastOpenedProjectId`: last active project
- `favoriteNotePaths`: pinned notes
- `favoriteProjectIds`: pinned projects
- `profile.name`: display name used across the app
- `ai.mistralApiKey`: provider key for assistant workflows
- `fontFamily`: active app font stack
- `calendarTasks`: task and reminder data
- `projectIcons`: icon overrides by project id
- `projects`: stored project collection

Related shared entities include:

- `VaultInfo`
- `NoteListItem`
- `NoteRecord`
- `SearchResult`
- `Project`
- `CalendarTask`
- `WeeklyPlanState`

## Notes Page

Primary responsibilities:

- browse notes
- search notes
- edit and preview the active note
- favorite, export, and delete notes

Main data types:

- `NoteListItem`: list/sidebar item metadata
- `NoteMetadata`: title, tags, and optional timestamps
- `NoteRecord`: full note payload
- `SearchResult`: full-text search result rows

Key behaviors:

- notes persist as Markdown files under `notes/`
- tags come from frontmatter and inline `#tags`
- note mentions use normalized `[[note]]` linking

## Projects Page

Primary responsibilities:

- browse and search projects
- edit project details
- manage milestones and subtasks
- favorite or delete the active project

Main data types:

- `Project`
- `ProjectMilestone`
- `ProjectSubtask`
- `ProjectIconStyle`

Key behaviors:

- projects are stored in app settings, not as vault files
- related notes are inferred using generated project tags
- milestones and subtasks feed the calendar and weekly plan linking flows

## Calendar Page

Primary responsibilities:

- browse month view
- add and edit tasks
- manage unscheduled tasks
- review work coming from projects and milestones

Main data types:

- `CalendarTask`
- `TaskReminder`
- `CalendarItem`

Key behaviors:

- tasks support optional date, end date, time, type, and reminders
- unified calendar items combine tasks, milestones, and subtasks for rendering
- tasks are persisted through app settings

## Weekly Plan Page

Primary responsibilities:

- create and select week plans
- define weekly focus
- manage ordered priorities
- link priorities to existing projects, milestones, subtasks, or tasks
- capture review notes

Main data types:

- `WeeklyPlanWeek`
- `WeeklyPlanPriority`
- `WeeklyPlanReview`
- `WeeklyPlanState`

Key behaviors:

- week records are managed through dedicated weekly-plan IPC handlers
- priorities can point at one linked entity at a time
- review content is stored separately from the week header metadata

## Schedules Page

Primary responsibilities:

- create and edit automation jobs
- configure runtime, trigger, permissions, and output mode
- run jobs and inspect results
- apply or dismiss reviewed actions

Main data types from [`src/shared/scheduleTypes.ts`](/Users/tanny/Documents/Projects/Beacon/Xingularity/src/shared/scheduleTypes.ts):

- `ScheduleJob`
- `ScheduleJobInput`
- `ScheduleRunRecord`
- `TriggerConfig`
- `ScriptAction`

Key behaviors:

- job triggers support manual, daily, interval, cron, and app-start execution
- runtimes support JavaScript and Python
- permission scopes gate access to network, notes, tasks, calendar items, projects, and secrets
- run records store stdout, stderr, errors, proposed actions, and applied actions

## Agent Chat Page

Primary responsibilities:

- manage chat sessions
- send messages with workspace mentions
- render live tool activity
- inspect recent agent runs

Main data types:

- `AgentChatSession`
- `AgentChatMessageRecord`
- `AgentChatMentionRef`
- `AgentRunRecord`

Key behaviors:

- mentions are resolved from notes and projects
- chat sessions persist separately from run telemetry
- live responses may include structured tool-step output

## Settings Page

Primary responsibilities:

- edit profile name
- select app font
- review and change vault location
- save the Mistral API key

Main data sources:

- `AppSettings.profile`
- `AppSettings.fontFamily`
- `AppSettings.ai.mistralApiKey`
- `VaultInfo`

## IPC Surface

Primary renderer entry points are defined in [`src/shared/ipc.ts`](/Users/tanny/Documents/Projects/Beacon/Xingularity/src/shared/ipc.ts):

- vault lifecycle
- note CRUD and export
- search
- attachments
- settings
- schedules
- weekly plan
- agent tools and agent chat flows
