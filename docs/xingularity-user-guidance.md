# Xingularity User Guide

Xingularity is a desktop workspace for notes, projects, planning, automations, and agent-assisted work. The current build is local-first: your vault stays on disk on your machine, and the rest of the workspace runs inside the desktop app.

## Getting Started

### Open Or Create A Vault

Your vault stores notebook content, standalone structured data files, and attachments. When you pick a vault location, Xingularity creates this structure if it does not already exist:

```text
<your-vault>/
  notebooks/
  attachments/
  settings.json
  projects.json
  project-icons.json
  tasks.json
  weekly-plan.json
  subscriptions.json
  schedule-jobs.json
  schedule-runs.json
  agent-chats.json
  agent-runs.json
  generative-ui-artifacts.json
  excalidraw-sessions.json
  vault.json
  migrations.json
  filemap.json
  index.sqlite
```

To change the vault location:

1. Open `Settings`.
2. Open the `Workspace` tab.
3. Use `Change Vault Location`.

On startup, the app attempts to restore the last opened vault automatically.

If you open an older vault, Xingularity migrates it forward in place:

- `notes/` is copied into `notebooks/`
- legacy `.appmeta/` and `.xingularity/` metadata files are promoted to root-level canonical files
- older page-folder JSON stores are rewritten into standalone root-level files

If both `notes/` and `notebooks/` already exist before migration, the app stops and reports a conflict instead of guessing which copy is canonical.

## Main Navigation

The sidebar currently includes:

- `Notes`
- `Projects`
- `Subscriptions`
- `Calendar`
- `Weekly Plan`
- `Schedules`
- `Agent Chat`
- `Settings`

The sidebar also provides:

- a search palette entry point
- keyboard shortcut hints
- badges for note, project, and incomplete task counts

## Notebooks Workflow

Use the Notebooks page when you want to write, search, or organize Markdown content.

Available actions:

- create a note
- rename a note
- delete a note
- edit and preview Markdown
- add and remove tags
- favorite a note
- export a note

Notes support:

- frontmatter-backed title and tags
- inline `#tags`
- `[[note]]` mentions
- drag-and-drop file import into `attachments/`
- pasted image import into the vault

Search is local and indexes note title, body, and tags.

## Projects Workflow

Use the Projects page to manage active work streams.

Available actions:

- create a project
- edit project name and summary
- favorite or delete a project
- customize the project icon
- add and manage milestones
- add and manage subtasks

Project status values are:

- `on-track`
- `at-risk`
- `blocked`
- `completed`

Projects can connect back to notes through generated project tags, and their milestones and subtasks also appear in planning surfaces.

## Subscriptions Workflow

Use Subscriptions to track recurring spend across tools, vendors, and services.

Available actions:

- add a subscription
- edit subscription details
- archive a subscription
- delete a subscription
- filter by status or category
- sort the list by subscription, category, monthly amount, next renewal, or status
- inspect recurring spend by category in the treemap

Each subscription can store:

- name and provider
- category
- amount and billing cycle
- next renewal date
- status
- review flag
- last-used date
- tags
- notes

Billing cycles can be monthly, quarterly, yearly, or custom. Xingularity normalizes each record into monthly recurring spend so totals, renewal summaries, and the spend treemap are comparable.

Subscription status values are:

- `active`
- `paused`
- `cancelled`
- `archived`

Review flags are:

- `none`
- `review`
- `unused`
- `duplicate`
- `expensive`

## Calendar Workflow

Use the Calendar page to plan dated work.

Available actions:

- create tasks on specific dates
- keep tasks unscheduled until ready
- edit task title
- set priority and task type
- assign reminders
- mark tasks complete
- delete tasks

Calendar views may also include milestone and subtask items from projects.

## Weekly Plan Workflow

Use Weekly Plan to organize a single week around priorities instead of just dates.

Available actions:

- create a new week plan
- edit the focus statement
- adjust start and end dates
- add ordered priorities
- move priorities up or down
- link priorities to a project, milestone, subtask, or task
- record wins, misses, blockers, and next-week notes

## Schedules Workflow

Use Schedules to create automations that generate or update workspace data.

Each schedule can define:

- a trigger:
  - manual
  - daily
  - every N minutes
  - cron
  - on app start
- a runtime:
  - JavaScript
  - Python
- a permission set
- an output mode:
  - auto-apply
  - review before apply

Current automation actions include:

- create task
- update task
- create note
- append to note
- create calendar event

Each run stores logs and result details so you can inspect or review what happened.

## Agent Chat Workflow

Use Agent Chat for assistant-style workflows inside the workspace.

Current behavior includes:

- persistent chat sessions
- `@` mentions for notes and projects
- attached workspace context passed into prompts
- recent run history beside the conversation
- inline tool-step rendering while a response is being produced

The current settings page stores a Mistral API key used for these agent-related flows.

## Settings

Settings is split into four tabs:

- `Profile`: profile name
- `Workspace`: vault location
- `Appearance`: font family
- `Agent`: Mistral API key

## Keyboard Shortcuts

- `Cmd/Ctrl + P`: open the search or command palette
- `Cmd + 1`: Notes
- `Cmd + 2`: Projects
- `Cmd + 3`: Calendar
- `Cmd + 4`: Weekly Plan
- `Cmd + 5`: Schedules
- `Cmd + D`: Dashboard
- `Cmd + K`: Knowledge
- `Cmd + G`: Grid, when enabled
- `Cmd + I`: Agent Chat
- `Cmd + ,`: Settings

## Where Data Lives

Vault-backed files:

- notebooks: `notebooks/**/*.md`
- attachments: `attachments/**`
- vault-scoped settings: `settings.json`
- projects: `projects.json`
- project icons: `project-icons.json`
- calendar tasks: `tasks.json`
- weekly plans: `weekly-plan.json`
- subscriptions: `subscriptions.json`
- schedules: `schedule-jobs.json`, `schedule-runs.json`
- agent data: `agent-chats.json`, `agent-runs.json`
- generative UI artifacts: `generative-ui-artifacts.json`
- Excalidraw sessions: `excalidraw-sessions.json`
- local index and vault metadata: `vault.json`, `migrations.json`, `filemap.json`, `index.sqlite`

## Current Caveats

- The app is local-first and does not provide cloud sync in this build.
- Notes are Markdown files; projects, schedules, and planning data are app-managed.
- Agent and schedule capabilities depend on local configuration and granted permissions.
