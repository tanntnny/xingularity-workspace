# More-feature backlog implementation records

This directory records the implementation state of every item in [`../more-feature-backlog.md`](../more-feature-backlog.md). Each record answers the same question: what a representative interaction looked like before the change, what it does now, and how the change was checked.

The records intentionally distinguish shipped behavior from experimental or contract-only foundations. “After” describes the behavior present in this working tree; it does not imply that external provider credentials or production sync infrastructure are configured.

## Canonical vault data model and path notes

The paths below are relative to the selected vault root and follow the current storage helpers in [`src/main/vaultData.ts`](../../src/main/vaultData.ts). A path listed as canonical is the location new writes should use; compatibility paths may still be read during migration or calendar projection.

### Canonical paths

- `notebooks/` — notebook and note files.
- `fleeting/` — quick-capture records.
- `attachments/` — user attachments.
- `projects/<encoded-project-id>.json` — one canonical project record per file.
- `tasks/<encoded-task-id>.json` — one canonical task record per file. The settings API may continue to expose task fields for compatibility, but task persistence is per-record here.
- `calendar/state.json` — the atomically committed provider-neutral calendar aggregate read by `CalendarStore`.
- `calendar/events.json`, `calendar/links.json`, `calendar/connections.json`, and `calendar/calendars.json` — compatibility collection mirrors; old vaults without `state.json` fall back to these files.
- `weekly-plan/state.json` — weekly planning state.
- `subscriptions/data.json` — subscription records.
- `schedules/jobs.json` and `schedules/runs.json` — automation definitions and run history.
- `agent/chats.json` and `agent/runs.json` — agent sessions and run history.
- `excalidraw/sessions.json` — saved drawing sessions.
- `settings.json` — vault UI and core settings; provider secrets are not canonical vault content.
- `vault.json`, `filemap.json`, `index.sqlite`, and `migrations.json` — root-level vault metadata, indexing, and migration state.

### Compatibility and experimental boundaries

Legacy inputs such as `notes/`, `.appmeta/`, hidden `.xingularity/` metadata, root `tasks.json`, `calendar/tasks.json`, root-level aggregate project/weekly-plan/subscription files, and older schedule, agent, and Excalidraw files are compatibility paths. They may be detected, migrated, or projected, but they are not the canonical destinations for new domain writes. In particular, `calendar/tasks.json` is not the canonical task store.

The status source for each capability is the [feature registry](../../src/shared/featureRegistry.ts). Read-only Google Calendar import, structured search, the reusable file watcher, vault diagnostics/backup/restore helpers, sync comparison, and plugin validation are currently experimental or foundation-only. They do not imply production credentials, remote transport, complete renderer wiring, or external write support. The weekly-plan and agent pages are now visible on desktop, while provider-backed agent workflows remain experimental.

## Record contract

Every feature record linked below must retain all three sections: **Before change**, including a concrete example; **After change**, describing the resulting behavior; and **Verification**, identifying the evidence used to check it. Status updates must preserve that before/after/verification history rather than replacing the baseline example.

## Records

- [SEC-001](SEC-001.md) — vault-file protocol boundary
- [DATA-001](DATA-001.md) — persistence and migration agreement
- [CAL-001](CAL-001.md) — reminder lifecycle reconciliation
- [PROD-001](PROD-001.md) — feature registry and product surface
- [CAL-002](CAL-002.md) — provider-neutral calendar domain
- [CAL-003](CAL-003.md) — Google Calendar read-only adapter
- [CAL-004](CAL-004.md) — time and recurrence semantics
- [SEC-002](SEC-002.md) — credential storage and secret scope
- [SEARCH-001](SEARCH-001.md) — unified search contract
- [CORE-001](CORE-001.md) — structured-file watcher and conflicts
- [AUTO-001](AUTO-001.md) — durable, cancellable, capability-safe schedules
- [CORE-002](CORE-002.md) — domain/UI coupling reduction
- [VAULT-001](VAULT-001.md) — diagnostics, backup, transfer, and recovery
- [CORE-003](CORE-003.md) — mutation, trash, and history semantics
- [CAL-005](CAL-005.md) — calendar workspace hierarchy
- [PLAN-001](PLAN-001.md) — visible weekly planning
- [PROJ-001](PROJ-001.md) — project planning depth
- [CAP-001](CAP-001.md) — actionable capture inbox
- [FIN-001](FIN-001.md) — subscription renewal and payment context
- [KNOW-001](KNOW-001.md) — typed knowledge graph relations
- [MEDIA-001](MEDIA-001.md) — recoverable Excalidraw metadata
- [AGENT-001](AGENT-001.md) — visible agent workspace boundary
- [SYNC-001](SYNC-001.md) — safe multi-device conflict comparison
- [AI-001](AI-001.md) — reviewable assistive suggestions
- [EXT-001](EXT-001.md) — versioned provider/plugin manifests
- [TEST-001](TEST-001.md) — verification matrix foundations
- [DOC-001](DOC-001.md) — decision-linked documentation
