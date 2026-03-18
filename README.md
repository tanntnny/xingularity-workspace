# Xingularity

Xingularity is a local-first Electron desktop workspace for notes, projects, calendar planning, weekly reviews, automation schedules, and agent-assisted workflows.

The app keeps note content and attachments inside a user-selected vault on disk while app-level state such as projects, tasks, weekly plans, schedules, and chat history is managed through the desktop runtime.

## Current Product Scope

- Markdown notes stored in a local vault with attachments, tags, mentions, export, and full-text search
- Project tracking with milestones, subtasks, progress, favorites, and custom project icons
- Calendar planning with scheduled and unscheduled tasks, task types, reminders, and completion state
- Weekly plan workspace for week creation, priorities, linked work items, and end-of-week review notes
- Schedules page for script-based automations with permissions, triggers, run history, and review-before-apply flows
- Agent Chat page for chat sessions, workspace mentions, run history, and tool activity rendering
- Settings for profile name, vault location, font family, and Mistral API key configuration

## Navigation

The sidebar currently exposes these pages:

- Notes
- Projects
- Calendar
- Weekly Plan
- Schedules
- Agent Chat
- Settings

Most pages use a shared three-column shell:

- left sidebar for global navigation
- center workspace for the active page
- right panel for contextual lists, creation actions, and supporting detail

## Data Model

### Vault-backed content

When a vault is created or opened, Xingularity ensures this structure exists:

```text
<vault-root>/
  notes/
  attachments/
  .appmeta/
    vault.json
    filemap.json
    index.sqlite
```

- `notes/`: Markdown note files
- `attachments/`: imported files and pasted images
- `.appmeta/vault.json`: vault metadata
- `.appmeta/filemap.json`: note identity and indexing metadata
- `.appmeta/index.sqlite`: local SQLite FTS search index

### App-managed state

App settings and higher-level workspace state include:

- profile name
- last opened vault, note, and project
- favorite notes and projects
- font family
- project collection and icon styles
- calendar tasks
- weekly plan data
- schedules and run history
- agent chat sessions and agent run history

## Notes

- Markdown notes with frontmatter-backed title and tags
- Auto-save editing
- Preview mode
- Full-text search over title, body, and tags
- Tag extraction from frontmatter and inline `#tags`
- `[[note]]` mention linking
- Attachment import and image paste support
- Export note action

## Projects

- Project list with search and favorites
- Project detail view with summary, health status, and progress
- Milestones with due dates and status
- Subtasks with completion tracking
- Related-note workflows based on generated project tags
- Per-project icon customization

## Calendar And Weekly Planning

- Month-based calendar view
- Unscheduled task queue
- Tasks with priority, type, date, optional end date, optional time, and reminders
- Unified calendar rendering for tasks, project milestones, and subtasks
- Weekly plan weeks with focus text, ordered priorities, linked items, and review fields

## Automation And Agent Features

### Schedules

- Manual, daily, interval, cron, and app-start triggers
- JavaScript and Python runtimes
- Capability-scoped permissions such as network, note access, task updates, and project updates
- Review-before-apply or auto-apply execution modes
- Run history with stdout, stderr, proposed actions, and applied actions

### Agent Chat

- Persistent chat sessions
- `@` mentions for notes and projects
- Agent tool activity rendered in the conversation
- Separate run history view for agent execution records
- Mistral-backed assistant flow configured from Settings

## Security Model

- `contextIsolation: true`
- `nodeIntegration: false`
- narrow preload bridge exposed through IPC
- input validation and vault path safety checks in the main process
- renderer has no direct filesystem or shell access

## Project Structure

- `src/main/`: Electron main process, IPC handlers, vault services, schedules, weekly plan, and agent services
- `src/preload/`: safe renderer bridge
- `src/renderer/`: React application shell, pages, and UI components
- `src/shared/`: shared types, IPC channel names, and helper utilities
- `docs/`: product and implementation notes
- `tests/`: unit tests for note parsing, path safety, indexing, and project icon behavior

## Development

### Install

```bash
npm install
```

### Run In Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Test

```bash
npm run test:run
```

### Packaging

- `npm run build:mac`
- `npm run build:win`
- `npm run build:linux`

The macOS build uses [`scripts/after-sign.cjs`](/Users/tanny/Documents/Projects/Beacon/Xingularity/scripts/after-sign.cjs) and [`build/entitlements.mac.plist`](/Users/tanny/Documents/Projects/Beacon/Xingularity/build/entitlements.mac.plist) for bundle signing behavior.

## Additional Docs

- [`docs/app-features.md`](/Users/tanny/Documents/Projects/Beacon/Xingularity/docs/app-features.md): user-facing feature summary
- [`docs/app-pages-and-data.md`](/Users/tanny/Documents/Projects/Beacon/Xingularity/docs/app-pages-and-data.md): page and data model reference
- [`docs/xingularity-user-guidance.md`](/Users/tanny/Documents/Projects/Beacon/Xingularity/docs/xingularity-user-guidance.md): workflow-oriented usage guide
- [`docs/design-notes.md`](/Users/tanny/Documents/Projects/Beacon/Xingularity/docs/design-notes.md): implementation rationale, mainly for the vault and indexing layer
