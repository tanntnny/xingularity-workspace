# Xingularity Repository Context

This document is the fast orientation map for repository work. Read it at the
start of every task, then inspect the targeted source files, tests, and deeper
documentation needed for the change. It is intentionally compact and is not a
replacement for verifying behavior against code.

## Product and runtime

Xingularity is a local-first Electron desktop workspace for notebooks,
projects, calendar planning, weekly reviews, schedules, and agent-assisted
workflows. User-facing workspace content lives in a user-selected local vault.
The application uses Electron process isolation and exposes renderer
capabilities through a narrow preload bridge.

The main product areas are Notes, Projects, Calendar, Weekly Plan, Sticky Note,
Schedules, Agent Chat, and Settings. The current route and feature inventory can change;
use the source route definitions and the README for the exact active surface.

## Ownership boundaries

- src/main/ owns filesystem and OS access, vault services, persistence,
  indexing, schedules, reminders, agent services, and IPC handlers.
- src/preload/ exposes the approved main-process capabilities to the renderer.
- src/renderer/src/ contains the React shell, pages, components, hooks, and
  renderer-only utilities.
- src/shared/ contains cross-process types, IPC channel names, and pure
  helpers.
- tests/ contains Vitest unit and integration coverage.
- e2e/ contains Playwright Electron workflows.

Keep filesystem, shell, and OS access in main or preload. Renderer code must
respect context isolation and must not call Node APIs directly.

## Persistence and data boundaries

The selected vault is the canonical home for user workspace data, including
notebooks, attachments, projects, calendar tasks, weekly plans, subscriptions,
schedules, agent records, Excalidraw sessions, and Sticky Note board state.
Internal metadata, migration
markers, file maps, and the local search index are maintained separately from
the user-facing content boundary.

Before changing storage or migration behavior, read:

- [README.md](../README.md) for the current vault layout and migration summary
- [app-pages-and-data.md](app-pages-and-data.md) for page responsibilities and
  data models
- [revamp/DATA-OWNERSHIP-MATRIX.md](revamp/DATA-OWNERSHIP-MATRIX.md) for
  canonical, derived, device-local, secret, and recovery-only ownership
- [revamp/SYNC-AND-EXTERNAL-EDIT-PROTOCOL.md](revamp/SYNC-AND-EXTERNAL-EDIT-PROTOCOL.md)
  for external-edit and reconciliation rules

Do not assume that a visible file is safe to edit, portable, or canonical
without checking the relevant service and ownership documentation.

## Agent and CLI context

The JSON-only `xingularity vault ...` CLI remains the compatibility interface
for explicit-root inspection and portable vault operations. The standalone
`x-workspace` CLI is the agent-facing interface for one per-user bound vault;
it supports bounded context plus notes, projects, tasks, milestones, updates,
meetings, and resource metadata operations while the app is open or closed.
The primary context commands are:

    npm run xingularity -- vault context --root /path/to/vault --pretty
    npm run x-workspace -- context --pretty

Read [xingularity-cli.md](xingularity-cli.md) and
[x-workspace-cli.md](x-workspace-cli.md) before changing CLI output, context
redaction, validation, exit codes, vault binding, or the shared x-workspace
guidance. The new CLI uses the shared headless workspace service and preview /
apply mutation contract; it must not import Electron or create a second vault
write path.
Agent Chat uses the same read-only workspace.context boundary through the
main/preload contract.

## Renderer and design-system map

App-owned renderer primitives live in src/renderer/src/components/ui.
Workspace shell and page composition helpers live in
src/renderer/src/components/workspace. The reusable package is
packages/workspace-template.

Before changing shared UI, read [design-system/overview.md](design-system/overview.md)
and [ai/ui.yaml](ai/ui.yaml). Use existing primitives and workspace compositions
before adding page-local controls. When shared shell, tokens, or primitives
change, verify the renderer/package parity with:

    npm --workspace @xingularity/workspace-template run verify:renderer-sync

## Common commands

- npm install installs dependencies and native bindings.
- npm run dev starts the Electron and Vite development environment.
- npm run build runs type checks and creates a production build.
- npm run lint runs ESLint.
- npm run test:run runs the Vitest suite once.
- npm run test:e2e builds the app and runs Playwright; use it only for changed
  workflows or when explicitly requested.
- npm run perf:audit builds the app and runs the macOS-first Electron performance
  audit against a generated representative vault. Use `npm run perf:audit:smoke`
  for a short validation run; raw traces and JSON reports stay in the system
  temporary directory.

Follow AGENTS.md and the shared command-wrapper instructions when running
commands. Prefer targeted inspection and verification over reading the whole
repository.

## Documentation map

- [README.md](../README.md): product scope, vault layout, runtime security, and
  main commands
- [app-features.md](app-features.md): user-facing feature summary
- [app-pages-and-data.md](app-pages-and-data.md): page responsibilities and data
  models
- [design-notes.md](design-notes.md): vault and indexing rationale
- [xingularity-cli.md](xingularity-cli.md): CLI contracts and context boundaries
- [design-system/overview.md](design-system/overview.md): renderer primitives
  and reusable workspace layer
- [features/editor-interaction-behavior.md](features/editor-interaction-behavior.md):
  editor movement, Markdown list Enter, fenced code-block, and Vim behavior
  investigation and contract
- [features/centralize-workspace.md](features/centralize-workspace.md):
  context-layer product and architecture proposal
- [revamp/README.md](revamp/README.md): vault reconciliation and sync
  architecture set
- [revamp/NOTE-DRAFT-DURABILITY-AUDIT.md](revamp/NOTE-DRAFT-DURABILITY-AUDIT.md):
  note draft loss audit, lifecycle barriers, recovery, and regression coverage
- [performance-review.md](performance-review.md): performance findings,
  historical renderer measurements, and the current remediation policy
- [performance-audit-log.md](performance-audit-log.md): append-only measured
  runs from the Electron performance audit harness
- [more-feature-backlog/README.md](more-feature-backlog/README.md): tracked
  gaps, risks, and follow-up work

When documentation conflicts with implementation, treat the relevant source,
tests, and runtime contracts as authoritative and update the affected
documentation as part of the change when appropriate.

## Maintenance rule

Update this document when any of the following changes:

- top-level process ownership or security boundaries
- canonical vault layout or persistence ownership
- primary product surfaces or route structure
- required development, test, or verification commands
- renderer design-system source-of-truth or reuse rules
- the authoritative documentation map

Keep transient branch status, work-in-progress findings, and exhaustive file
inventories out of this document.
