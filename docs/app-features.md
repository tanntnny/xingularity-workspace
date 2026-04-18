# Xingularity App Features

This document summarizes the current user-facing feature set of Xingularity based on the app code in `src/main/`, `src/shared/`, and `src/renderer/src/`.

## Product Summary

Xingularity is a local-first Electron workspace for:

- Markdown notes stored in a user-selected vault
- project planning with milestones and subtasks
- calendar task management
- weekly planning
- subscription spend tracking
- automation schedules
- agent chat and run history
- visual knowledge and board-style views over workspace content

The app is split between:

- vault-backed content such as notes and attachments
- app-managed structured state such as projects, tasks, weekly plans, schedules, and agent history

## Navigation Model

The sidebar currently exposes these pages:

- Dashboard
- Knowledge
- Notes
- Projects
- Subscriptions
- Grid
- Calendar
- Weekly Plan
- Schedules
- Agent Chat
- Settings

It also includes:

- profile greeting
- command palette entry point
- count badges for notes, projects, and incomplete calendar tasks
- keyboard shortcuts for page switching

## Vault And Notes

Core note features:

- create, open, rename, move, and delete notes
- create nested folders in the notes tree
- edit notes as structured documents backed by Markdown-compatible storage
- auto-save note edits
- import notes into the vault
- export individual notes
- favorite notes
- full-text search over indexed note content
- `[[note]]` mention linking between notes
- note preview and outline support
- attachment import from files or pasted buffers

Notes are shown in two ways:

- flat list and preview flows
- tree view with folders and protected system folders

## Project-Backed Notes Tree

The notes tree contains a managed `Projects/` root folder.

Current behavior:

- `Projects/` is system-managed and cannot be renamed or removed
- each first-level folder inside `Projects/` mirrors one app project
- direct project folders under `Projects/` cannot be renamed or removed from the tree
- notes created inside a project folder automatically belong to that project
- dragging a note into a project folder makes it part of that project
- dragging a note between project folders reassigns it to the destination project
- dragging a note out of a project folder removes the folder-based assignment
- the project page note table and the notes tree stay in sync through folder membership

## Projects

Project management features include:

- create, open, favorite, rename, and delete projects
- editable project summary
- project status tracking: `on-track`, `at-risk`, `blocked`, `completed`
- automatic progress calculation from milestone and subtask state
- milestone creation, editing, collapse state, and status tracking
- subtask creation, editing, due dates, completion, and deletion
- project icon customization using shape, variant, and color
- export project summaries
- project notes shown from the matching `Projects/<project>/...` folder subtree

## Dashboard

The dashboard acts as a workspace summary page.

It currently surfaces:

- active project health counts
- recent active projects
- current weekly-plan priorities
- today-focus style overview for the current week

## Knowledge View

The knowledge page provides a graph view of note relationships.

Features include:

- graph generated from notes and note mentions
- force-directed visual layout
- zoom and pan support
- click-through from graph nodes to notes

## Grid View

The grid page provides a spatial board for arranging workspace items.

Supported board content:

- notes
- projects
- freeform text cards

Board capabilities include:

- draggable positioned items
- viewport pan and zoom persistence
- per-item size, z-index, and text style state

## Calendar

Calendar and task features include:

- month-based calendar workspace
- scheduled and unscheduled task lists
- create, rename, delete, reschedule, and complete tasks
- optional task time and multi-day ranges
- task priority and task type metadata
- reminder support on tasks
- unified calendar rendering of tasks, project milestones, and subtasks

## Weekly Plan

Weekly planning features include:

- create and browse weekly plan records
- define week focus and date range
- add ordered weekly priorities
- mark priorities as `planned`, `in_progress`, or `done`
- link priorities to projects, milestones, subtasks, or calendar tasks
- capture week review fields for wins, misses, blockers, and next week

## Subscriptions

The subscriptions page tracks recurring spend for tools, vendors, and services.

Current capabilities:

- create, edit, archive, and delete subscriptions
- store provider, category, amount, billing cycle, renewal date, status, review flag, last-used date, tags, and notes
- support monthly, quarterly, yearly, and custom billing intervals
- normalize subscription amounts into monthly recurring spend
- show monthly and yearly recurring totals
- highlight subscriptions renewing within 30 days
- calculate potential monthly savings from subscriptions flagged for review, unused, duplicate, or expensive
- filter by category and status
- sort the subscriptions table by name, category, amount, next renewal, or status
- visualize active recurring spend in a category treemap
- persist subscription records per vault

## Schedules And Automations

The schedules page supports local automations.

Current capabilities:

- create and edit jobs
- enable or disable jobs
- run jobs manually
- inspect run history, logs, status, and proposed actions
- apply or dismiss review-mode actions
- use JavaScript or Python runtimes
- configure triggers: manual, daily, every N minutes, cron, on app start
- assign permissions for notes, tasks, projects, calendar actions, network, and secrets

Currently modeled script actions include:

- create task
- update task
- create note
- append to note
- create calendar event

## Agent Chat And History

Agent features are split across an interactive chat page and a run-history view.

Agent chat supports:

- persistent chat sessions
- note and project mentions in prompts
- resolved context summaries attached to prompts
- streamed assistant responses
- tool-step rendering, including approval-required steps
- explicit tool approval flows

Agent history supports:

- persisted run records
- run input, output, status, timing, model, and context inspection

## Settings And Workspace Setup

Settings currently support:

- profile name
- vault location management
- app font family selection
- Mistral API key storage
- persisted UI state such as favorites and last-opened entities

## Local-First Storage Model

Current storage split:

Vault-backed content:

- `notes/**/*.md`
- `attachments/**`
- `.appmeta/vault.json`
- `.appmeta/filemap.json`
- `.appmeta/index.sqlite`

App-managed state:

- app settings
- projects
- calendar tasks
- weekly plans
- subscriptions
- schedules and run records
- agent chat sessions and run history

Vault app data:

- `.xingularity/weekly-plan.json`
- `.xingularity/subscriptions.json`
