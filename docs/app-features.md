# Xingularity App Features

This document summarizes the current user-facing behavior in the desktop app.

## Product Overview

Xingularity is a local-first desktop workspace that combines note-taking, lightweight project management, task planning, scripted automations, and agent-assisted workflows.

- Notes and attachments live in a local vault folder.
- Search runs locally against a SQLite full-text index.
- Projects, tasks, weekly plans, schedules, and agent state are managed by the desktop app.
- The UI is organized around a persistent sidebar, a central workspace, and a contextual right panel.

## Navigation

The current sidebar exposes these pages:

- Notes
- Projects
- Calendar
- Weekly Plan
- Schedules
- Agent Chat
- Settings

The sidebar also includes:

- profile greeting
- search palette entry point
- keyboard shortcut hints
- count badges for notes, projects, and incomplete calendar items

## Notes

- Create, open, rename, and delete Markdown notes
- Auto-save note edits
- Edit and preview modes
- Add and remove tags
- Full-text search over title, body, and tags
- `[[note]]` mention linking and mention navigation
- Export note action
- Favorites support
- Attachment import and image paste support into the vault

## Projects

- Project list with search and favorites
- Create and delete projects
- Editable project name and summary
- Health status tracking: `on-track`, `at-risk`, `blocked`, `completed`
- Progress display
- Milestone creation, editing, reordering state, and deletion
- Subtask creation, completion, editing, and deletion
- Project icon customization using shape, variant, and color
- Related-note workflows through generated project tags

## Calendar

- Month view calendar workspace
- Scheduled and unscheduled task management
- Task completion, rename, delete, and reschedule flows
- Priority and task-type metadata
- Optional multi-day ranges and time values
- Reminder support on tasks
- Unified rendering for tasks, milestones, and subtasks

## Weekly Plan

- Create week plans from the sidebar
- Select and browse prior weeks
- Edit week focus and date range
- Add ordered weekly priorities
- Link priorities to projects, milestones, subtasks, or tasks
- Track priority state: `planned`, `in_progress`, `done`
- Capture end-of-week review notes for wins, misses, blockers, and next week

## Schedules

- Create automation jobs from the Schedules page
- Supported triggers:
  - manual
  - daily
  - every N minutes
  - cron
  - on app start
- Supported runtimes:
  - JavaScript
  - Python
- Review and assign explicit permissions per job
- Run jobs immediately
- Inspect run history, status, logs, and proposed actions
- Apply or dismiss review-mode outputs

Supported automation action types currently include:

- create task
- update task
- create note
- append to note
- create calendar event

## Agent Chat

- Persistent chat sessions
- `@` mention suggestions for notes and projects
- Workspace context attached to prompts
- Inline rendering for tool steps during a run
- Session list and recent run history
- Copy and refresh affordances in the chat UI

## Settings

- Update profile name
- Review and change vault location
- Choose app font family
- Save Mistral API key for assistant workflows

## Search And Command Access

- Global search palette entry point in the sidebar
- Command palette shortcut: `Cmd/Ctrl + P`
- Note and project discovery from the contextual side panels

## Storage Summary

- Vault-backed content:
  - `notes/**/*.md`
  - `attachments/**`
  - `.appmeta/vault.json`
  - `.appmeta/filemap.json`
  - `.appmeta/index.sqlite`
- App-managed state:
  - settings
  - projects
  - calendar tasks
  - weekly plans
  - schedules
  - agent sessions and history
