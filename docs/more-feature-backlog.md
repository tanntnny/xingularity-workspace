# More Feature Backlog

> Product, architecture, safety, and workflow backlog derived from the pre-implementation working tree on 2026-08-17. This is an application audit and planning document; current implementation status is tracked separately in the implementation records and feature registry linked below.

## Purpose

This backlog answers a different question from a visual polish list: what should Xingularity become next, what foundations are missing, and which existing behaviors need to be made safe before new capability is added.

The audit covered:

- renderer routes, navigation, calendar workflows, task editing, reminders, and filters

- preload and IPC contracts

- vault persistence, migration paths, watchers, indexing, history, and trash

- schedules, secrets, script execution, and agent capabilities

- notes, projects, weekly planning, subscriptions, capture, knowledge, Excalidraw, and settings

- existing unit/e2e coverage and the repository’s current product documentation

This document intentionally does not duplicate the detailed interaction and visual findings in [UX/UI Audit and Consistency Roadmap](audit-ux-ui.md) or the measured rendering findings in [Xingularity Performance Review](performance-review.md). Those documents remain the source for their respective workstreams. This backlog links to them where a feature depends on the shared shell or interaction contract.

## Implementation follow-through and current truth

The audit statements in this document preserve the pre-implementation baseline captured on 2026-08-17. They are historical evidence for why each item was prioritized. In particular, statements such as “no normal renderer page,” “CalendarDayView is not mounted,” or “no Google adapter” describe that baseline and should not be read as a claim that the current worktree is unchanged.

For the implementation state in the current worktree, use the [implementation record index](more-feature-backlog/README.md) and the [feature registry](../src/shared/featureRegistry.ts). The index contains one record for every backlog ID; each record retains a concrete **Before change** example, the **After change** behavior, and **Verification** evidence. The registry is the current status source for shipped, backend-only, hidden, experimental, and planned work.

Several items now have working foundations but remain explicitly experimental rather than complete end-user workflows. This includes the read-only Google Calendar adapter, unified structured-search helpers, the reusable structured-file watcher, vault backup/restore services, sync comparison, and provider/plugin validation. The per-feature records describe those boundaries and any remaining wiring or production-configuration work.

## Audit baseline and priority model

The repository contains unrelated uncommitted changes. Findings describe the current working tree, not a clean commit or a released build. Evidence is based on static inspection unless an existing performance review or test is named explicitly.

- P0 — immediate safety, security, data-integrity, or recovery risk. Validate before expanding the affected surface.

- P1 — foundational capability or contract that unlocks several features, prevents repeated migrations, or affects most users.

- P2 — important product capability that becomes valuable after the relevant foundation is stable.

- P3 — differentiated or higher-effort enhancement with a clear but non-blocking user benefit.

Priority is not implementation effort. A high-effort item can still be P0 or P1 when it removes a release-blocking risk or prevents the next layer of work from being built on the wrong model.

Every item should eventually have a product owner, an implementation issue, a migration decision if data is affected, and an acceptance test. Until then, all items are open.

## Current product truth

The first backlog item is not a new feature. It is to make the product’s public contract agree with the code.

### Renderer surface currently exposed

The current desktop page contract in [navigation.ts](../src/renderer/src/navigation.ts), [pageAvailability.ts](../src/renderer/src/platform/pageAvailability.ts), [AppSidebar.tsx](../src/renderer/src/components/AppSidebar.tsx), and [App.tsx](../src/renderer/src/App.tsx) exposes:

- Capture

- Notes

- Projects

- Knowledge

- Calendar

- Weekly plan

- Schedules

- Agent

- Scheduling Guide

- Subscriptions

- Design Audit

- Settings

Mobile availability intentionally narrows this surface to the platform-supported core pages. Legacy product documents still mention Dashboard and Grid surfaces that are not routes in the current navigation contract; those claims are documentation history, not shipped page promises. For all other status distinctions, including backend-only and experimental foundations, consult the registry rather than inferring status from an individual document.

### Current calendar truth

The calendar remains local-first and task-aware, while now also having a provider-neutral domain and an experimental read-only external-provider foundation:

- [src/shared/types.ts](../src/shared/types.ts) models task status, task type, date range, optional local time, priority, project/milestone links, and reminders

- the renderer persists local task records through task APIs and renders month, week, and day views

- canonical local tasks are stored as tasks/<task-id>.json; calendar/tasks.json is a compatibility task projection/input used during migration

- the provider-neutral calendar domain stores events, links, connections, and calendars under calendar/

- CalendarDayView is mounted by the current App route

- local task filters cover project/non-project and tags; provider/account/calendar metadata, attendee/location filters, and recurrence or sync controls are not exposed in that task UI

- date-only and timed values remain distinct: all-day items use date ranges, while timed entries retain local time and timezone semantics

- the Google adapter now provides read-only normalization and cursor/ETag-aware import foundations; provider credentials, complete UI flow, and external writes remain experimental and are not implied by the local calendar surface

The implication remains that external calendars belong on the calendar-domain contract, not as provider fields added directly to local task objects.

## Product principles to preserve

1. **Local-first remains a valid mode.** The app must remain useful with no account, no network, and no external provider connected.
2. **Tasks and events are related but not identical.** A task has completion and project semantics. An external event has attendees, organizer, location, recurrence, provider ownership, and a different conflict model.
3. **Date-only and time-based values must stay distinct.** An all-day event is not midnight in the user’s current timezone.
4. **External writes are explicit.** Importing a calendar should not silently mutate local tasks or publish private tasks to a provider.
5. **Secrets never belong in portable vault content.** Vault export, sync, and sharing must not copy OAuth refresh tokens or model-provider credentials.
6. **Every destructive operation needs recovery semantics.** Archive, trash, undo, version history, export, and migration rollback should be deliberate and consistent.
7. **Shared UI behavior belongs in primitives and the shell.** New feature work should follow the ownership and verification rules in [audit-ux-ui.md](audit-ux-ui.md), including the repository requirement to use WorkspaceIconButton for top-bar actions, p-2 only for the main content container, and Inter for app UI.

## P0/P1 — safety and integrity before expansion

### SEC-001 — Enforce the vault-file protocol boundary

- **Priority:** P0 candidate; block release until verified.

- **Evidence:** The custom vault-file protocol in [src/main/index.ts](../src/main/index.ts) decodes and normalizes a requested path before reading it, while the shared [pathSafety.ts](../src/shared/pathSafety.ts) and [vaultManager.ts](../src/main/vaultManager.ts) already provide boundary helpers. Attachment URLs are constructed in App.tsx and FileService.ts.

- **User outcome:** A renderer or malformed URL cannot read an arbitrary file outside the active vault, including through traversal, symlinks, or a stale vault path.

- **Recommendation:** Restrict the protocol to the active vault’s approved attachment roots, resolve real paths before access, reject traversal and symlink escapes, validate MIME/size, and return a controlled error page. Prefer a capability-scoped file API over arbitrary absolute URLs where practical.

- **Acceptance:** Requests for a sibling file, parent path, encoded traversal, symlink target, missing file, and inactive-vault path are denied; valid attachment reads still work; error details do not disclose host paths.

- **Verification:** Add main-process regression tests around the protocol handler and path-safety helpers, then run the attachment and Excalidraw flows.

- **Dependencies:** None. This is the first audit item because it is independent of the feature roadmap.

### DATA-001 — Make persistence, migration, and documentation agree

- **Priority:** P1 foundational; treat as P0 for any migration or export release.

- **Evidence:** [TaskStore](../src/main/taskStore.ts) writes canonical per-task files under tasks. [settingsStore.ts](../src/main/settingsStore.ts) reads legacy calendar collections and migrates them. [vaultData.ts](../src/main/vaultData.ts) retains several legacy calendar paths. Existing docs still describe calendar/tasks.json in places.

- **User outcome:** A vault opened by a new version has one predictable source of truth, and users can understand what migration did.

- **Recommendation:** Define a versioned storage schema for tasks, projects, subscriptions, schedules, weekly plans, agent history, and integrations. Generate or update the data-model docs from the canonical paths. Add a migration report with counts, conflicts, backup location, and rollback guidance before deleting legacy data.

- **Acceptance:** A test matrix covers fresh vaults, each legacy layout, duplicate canonical/legacy files, malformed records, interrupted writes, and re-opening after migration. Documentation names only canonical paths and marks compatibility paths as legacy.

- **Verification:** Migration fixtures, atomic-write failure tests, and a manual open/export/reopen check on a copy of a representative vault.

- **Dependencies:** SEC-001 for safe file handling and VAULT-001 for durable backup/restore behavior.

### CAL-001 — Reconcile reminder lifecycles and make notifications actionable

- **Priority:** P1 correctness; raise to P0 if stale reminders can trigger destructive automation or material user harm.

- **Evidence:** [reminderService.ts](../src/main/reminderService.ts) schedules timeout handles by task/reminder key and updates the current task list, but it does not reconcile and clear handles for removed, disabled, or completed reminders. It only looks ahead 24 hours, defaults all-day reminders to 9:00 local time, and focuses the first window rather than opening the task.

- **User outcome:** Disabling, deleting, completing, or changing a reminder has immediate effect; a notification opens the relevant task and date; reminders survive normal app restarts without duplicate or missed alerts.

- **Recommendation:** Maintain a desired-vs-active schedule map and cancel stale handles. Persist notification identity/fired state where needed. Store explicit date-only, local-time, timezone, and reminder semantics. Add a notification click target that opens the task, calendar view, and selected date. Define behavior for missed reminders while the app was closed.

- **Acceptance:** Tests prove stale timeout cancellation, edit/delete/complete races, duplicate suppression, DST transitions, invalid dates, app restart, clock changes, snooze, and click-through. Notification behavior is documented for all-day and timed tasks.

- **Verification:** New ReminderService unit tests plus targeted Electron notification/manual checks on macOS.

- **Dependencies:** CAL-004 for time semantics; DATA-001 for durable reminder state.

## P1 — foundations that unlock the product

### PROD-001 — Reconcile shipped, hidden, and documented features

- **Priority:** P1.

- **Evidence:** The AppPage union and sidebar expose fewer pages than [app-features.md](app-features.md) and [README.md](../README.md) advertise. Weekly-plan and agent capabilities exist in main/preload contracts but are not normal renderer routes. Existing sidebar tests intentionally assert some pages are absent.

- **User outcome:** Users, support, and contributors can tell what is available today, what is experimental, and what is planned.

- **Recommendation:** Create a single feature registry with status values such as shipped, backend-only, hidden, experimental, and planned. Either expose weekly planning and agent chat, remove stale claims, or label them clearly. Decide whether Dashboard and Grid are product surfaces or archived directions. Link the registry from the README and product docs.

- **Acceptance:** Navigation, page-availability logic, help text, onboarding, tests, and docs derive from the same status decision. No user-facing document claims a route that cannot be opened.

- **Verification:** Route registry test, sidebar/page availability test, and documentation review after each status change.

- **Dependencies:** None, but it should precede roadmap commitments that depend on hidden pages.

### CAL-002 — Introduce a provider-neutral calendar domain

- **Priority:** P1.

- **Evidence:** CalendarTask currently combines task completion, project links, date ranges, local time, automation metadata, and reminders. Schedule actions call a calendar event an event but write the same task-shaped collection. No external identity or sync metadata exists.

- **User outcome:** Local tasks remain simple while meetings and imported events gain correct provider, recurrence, attendee, and conflict behavior.

- **Recommendation:** Define separate but linkable records:
  - Task: work to complete, with completion/status/project semantics.

  - CalendarEvent: a time/date commitment, with title, description, all-day flag, start/end, timezone, recurrence, location, attendees, organizer, source, and read-only state.

  - CalendarLink: optional relation between a task and an event, with field ownership and sync state.

  - CalendarConnection and ExternalCalendar: provider/account/calendar metadata, sync cursor, last error, and capability flags.
    Keep a compatibility reader for existing CalendarTask records and migrate incrementally.

- **Acceptance:** A local task, a local event, an imported event, and a linked task/event can be created and edited without ambiguous field ownership. Existing tasks retain IDs, dates, status, reminders, and project links.

- **Verification:** Shared schema tests, migration fixtures, fake-provider contract tests, and calendar UI tests for local-only mode.

- **Dependencies:** DATA-001, SEC-002, and CAL-004.

### CAL-003 — Integrate Google Calendar in safe phases

- **Priority:** P1 product capability after CAL-002; first release should be read-only.

- **Evidence:** The current calendar has no account/provider model, OAuth flow, external IDs, sync token, or event conflict handling. The dependency manifest also contains no Google Calendar client or OAuth integration.

- **User outcome:** A user can see relevant Google events beside local tasks without losing local-first behavior or accidentally publishing private work.

- **Recommendation:** Deliver in phases:
  1. **Read-only import:** connect a Google account using OAuth Authorization Code + PKCE with a loopback/deep-link callback appropriate to Electron; choose calendars; cache events locally; use incremental sync tokens/ETags; display provider and calendar identity; make imported events read-only.
  2. **Explicit local linking:** let a user link a local task to an external event without changing either side until they choose a sync direction.
  3. **Explicit export/publish:** create or update a provider event only from a clearly labeled action. Show fields that will be sent and the target calendar before confirmation.
  4. **Two-way sync:** add only after field ownership, recurrence, deletion, conflict, rate-limit, offline, and duplicate rules are tested.

  Store refresh tokens through the OS keychain/safeStorage, never in the vault. Represent account disconnect, expired authorization, revoked access, selected calendars, sync errors, rate limits, and last successful sync. Do not request write scopes for read-only import.

- **Acceptance:** Connect, choose calendars, refresh, go offline, reconnect, revoke access, disconnect, and delete local cache all have defined outcomes. Imported all-day, recurring, canceled, time-zone-crossing, and multi-attendee events render correctly. No provider token appears in vault exports, logs, crash reports, or renderer state.

- **Verification:** Fake Google adapter contract tests, OAuth callback tests, sync cursor/ETag tests, recurrence/time-zone fixtures, conflict tests, rate-limit/backoff tests, and an Electron manual security review. Use a provider sandbox/test account before production credentials.

- **Dependencies:** CAL-002, CAL-004, SEC-002, VAULT-001, and CAL-001.

### CAL-004 — Make time, timezone, recurrence, and all-day semantics explicit

- **Priority:** P1.

- **Evidence:** CalendarTask and TaskReminder use local date/time strings without a timezone or recurrence contract. ReminderService and scheduleService use JavaScript local Date methods. Month and week views intentionally interpret the same task differently.

- **User outcome:** A task or event stays at the intended local time across travel, DST, sync, export, and restart.

- **Recommendation:** Use date-only values for all-day items, ISO instants plus IANA timezone for timed events, and an explicit recurrence representation compatible with provider imports. Define end semantics, inclusive/exclusive ranges, missing time defaults, locale display, and the user’s default timezone. Do not represent all-day events as midnight UTC.

- **Acceptance:** The same fixtures pass in at least two timezones across spring-forward/fall-back boundaries. Provider and local views agree on date, duration, and recurrence instances. Invalid or ambiguous input is rejected with actionable validation.

- **Verification:** Unit tests for parsing/formatting, DST and travel fixtures, schedule/reminder tests, and provider contract tests.

- **Dependencies:** DATA-001 before migration; CAL-002 before external identity is stored.

### SEC-002 — Move credentials out of vault settings and define secret scope

- **Priority:** P1 security/privacy.

- **Evidence:** AppSettings currently includes ai.mistralApiKey and the renderer saves it through settings. Schedule secrets use safeStorage, but ScheduleSecretsStore is app-user-data scoped while references live in a vault.

- **User outcome:** Sharing, backing up, exporting, or syncing a vault cannot silently share provider credentials.

- **Recommendation:** Store model and provider credentials in a scoped OS credential store. Use opaque secret references in vault data. Decide whether references are scoped by vault, account, or device; make rotation, disconnect, import, and missing-secret states visible. Redact secrets from logs, history, agent context, schedule output, diagnostics, and crash reports.

- **Acceptance:** Exported vaults contain no credential material. A copied vault clearly reports missing credentials instead of silently using another vault’s secret. Token refresh and revocation are testable.

- **Verification:** Storage inspection tests, export/redaction tests, secret-store tests, and a manual vault-copy review.

- **Dependencies:** VAULT-001 and CAL-003.

### SEARCH-001 — Build unified workspace search

- **Priority:** P1.

- **Evidence:** [sqliteIndexer.ts](../src/main/indexer/sqliteIndexer.ts) indexes note title/body/tags through FTS5. [SearchPage.tsx](../src/renderer/src/pages/SearchPage.tsx) and SearchResults open notes only. Tasks, projects, subscriptions, schedules, and agent records are not first-class search results.

- **User outcome:** One search can find a note, task, project, meeting, subscription, schedule, or agent run and take the user directly to it.

- **Recommendation:** Add a normalized search document layer with entity type, title, body/summary, tags, dates, status, project, and safe display metadata. Keep notes in FTS5 and either index structured records or query them through a shared result adapter. Add source/status/date filters, ranking, keyboard navigation, recent searches, and a command-palette entry. Never index credential values or raw secrets.

- **Acceptance:** Results can be filtered by entity type and opened at the correct detail/context location. Index updates after create/update/delete, vault switch, migration, and external file change. Empty, loading, unavailable-index, and malformed-record states are explicit.

- **Verification:** Indexer and ranking unit tests, cross-domain fixture tests, keyboard e2e coverage, and large-vault performance measurement.

- **Dependencies:** DATA-001 and CORE-001.

### CORE-001 — Detect structured-file changes and resolve conflicts

- **Priority:** P1 reliability.

- **Evidence:** The watcher primarily tracks notebook roots, while task/project/subscription/schedule stores are persisted as structured files and refreshed through runtime mutations. External edits to those records do not have the same visible index/conflict path as notes.

- **User outcome:** Editing a vault with another tool, sync service, or recovery process does not cause silent overwrites or stale screens.

- **Recommendation:** Add version/updatedAt or content-hash metadata to structured records, watch canonical structured roots, debounce reloads, and surface conflicts instead of overwriting newer content. Provide rescan/reload and “keep local / keep disk / merge” where safe.

- **Acceptance:** External create/update/delete is reflected without restarting. Concurrent local and disk edits produce a recoverable conflict record. A malformed external file is quarantined and reported, not silently discarded.

- **Verification:** Watcher tests for each store, concurrent mutation fixtures, reload/rescan e2e flow, and recovery documentation.

- **Dependencies:** DATA-001 and VAULT-001.

### AUTO-001 — Make schedules durable, cancellable, and capability-safe

- **Priority:** P1 security/reliability.

- **Evidence:** [ScheduleService](../src/main/scheduleService.ts) checks jobs on a 60-second interval and starts on-app-start jobs. It has no durable missed-run policy, visible cancellation flow, or robust retry/backoff contract. [scheduleRunner.ts](../src/main/scheduleRunner.ts) gives Python a normal child process with host environment access; the UI warns about this trust boundary.

- **User outcome:** Automations run predictably, stop when requested, explain failures, and cannot exceed their declared permissions without an explicit trust decision.

- **Recommendation:** Persist execution leases and a catch-up policy for app downtime. Add cancellation that kills the complete child-process tree, retry/backoff with idempotency keys, timeout reason codes, and notifications for repeated failures. Separate JavaScript and Python capability profiles. Treat Python execution as a high-trust feature with an explicit per-vault approval, environment summary, and audit trail. Add provider/calendar actions only through validated adapters.

- **Acceptance:** Restart, sleep/wake, clock change, overlapping run, hung script, child process, cancellation, retry, permission denial, and partial-action cases have deterministic results. An automation cannot write to an undeclared domain.

- **Verification:** Schedule service tests, runner process tests, permission/action-validation tests, fault-injection fixtures, and a manual trust review.

- **Dependencies:** SEC-002, DATA-001, CAL-002, and CORE-002.

### CORE-002 — Reduce renderer and domain coupling before adding more surfaces

- **Priority:** P1 maintainability/performance.

- **Evidence:** [App.tsx](../src/renderer/src/App.tsx) is a large root owning routes, global state, derived task/project/calendar data, dialogs, and many mutation callbacks. The existing [performance review](performance-review.md) measured 723 ms INP, 236 ms Notes-to-Projects, 97 ms Calendar month navigation, broad Zustand subscriptions, repeated array derivations, and full FullCalendar event rebuilds.

- **User outcome:** New providers and pages do not make every interaction slower or require editing one giant component.

- **Recommendation:** Narrow store selectors, extract domain controllers/hooks for notes/tasks/calendar/projects, separate IPC mutation adapters from page rendering, pre-index repeated lookups, and make calendar updates incremental. Define shared loading/error/pending mutation contracts.

- **Acceptance:** Page-local changes do not rerender unrelated shell surfaces. Calendar task edits update only affected events. New page routes can be added without growing App.tsx’s domain logic.

- **Verification:** Repeat the measurements in performance-review\.md, add render-count/performance smoke tests, and run typecheck/lint.

- **Dependencies:** DATA-001 and PROD-001; coordinate with the existing UX/UI ownership rules.

### VAULT-001 — Add backup, diagnostics, export/import, and migration recovery

- **Priority:** P1 trust foundation.

- **Evidence:** VaultManager has migration and path validation logic, TaskStore and other stores use atomic writes in several places, and TrashService/HistoryService provide partial recovery. Recovery semantics are not uniform across every structured domain, and users do not have a first-class diagnostic or backup workflow.

- **User outcome:** Users can inspect, copy, restore, and repair a vault without guessing which hidden files matter.

- **Recommendation:** Add a vault diagnostics report, “backup before migration,” portable export/import, schema version display, integrity checks, orphan detection, index rebuild, and restore preview. Define retention for trash/history and include structured data plus attachments. Keep secrets out of exports.

- **Acceptance:** A user can create a verified backup, restore it to a new vault, compare record counts/checksums, rebuild the index, and recover from a failed migration. Reports identify malformed, stale, duplicate, and legacy files.

- **Verification:** End-to-end copy/restore fixtures, interrupted-write tests, malformed-file fixtures, and a manual recovery drill.

- **Dependencies:** SEC-001, DATA-001, SEC-002, and CORE-001.

### CORE-003 — Unify undo, trash, archive, and history semantics

- **Priority:** P1/P2.

- **Evidence:** Notes use TrashService and HistoryService; weekly plans also archive deleted records; projects and subscriptions primarily expose archive/delete; schedule run history has its own retention. The recovery model varies by domain.

- **User outcome:** A user can predict whether delete is reversible, where the item went, and how long recovery remains possible.

- **Recommendation:** Define a domain-neutral mutation envelope with operation, entity, previous/current payload or file reference, timestamp, actor, and restore action. Use it consistently for tasks, projects, subscriptions, plans, schedules, agent records, and notebook files. Distinguish archive from delete and show retention.

- **Acceptance:** Every destructive action confirms its recovery path. Undo/redo, trash restore, archive/unarchive, and permanent delete do not resurrect stale references or orphan linked tasks.

- **Verification:** Cross-domain mutation matrix, restore tests, and targeted e2e checks for delete/undo/reopen.

- **Dependencies:** DATA-001 and VAULT-001.

## P2 — product capabilities after the foundations

### CAL-005 — Finish the calendar workspace hierarchy and interaction contract

- **Priority:** P2, with UX/UI work tracked separately.

- **Evidence:** Current navigation mounts month and week views; CalendarDayView is unused. Month is all-day and week is timed. Existing calendar tests cover month rendering and weekly drag/resize, while the UX audit identifies keyboard parity, compact layout, filters, feedback, and interaction consistency gaps.

- **Recommendation:** Ship a deliberate day/week/month hierarchy, a clear unscheduled queue, saved views, provider/source filters, project/tag filters, keyboard move/resize parity, accessible event summaries, and a compact fallback for narrow windows. Adopt the shared primitive contract rather than adding page-local controls.

- **Acceptance:** A user can create, edit, move, resize, complete, unschedule, filter, and recover a task with pointer and keyboard in every relevant view. The same item has predictable date/time semantics and focus behavior.

- **Verification:** Extend calendar unit tests and targeted e2e coverage; use UXUI-049 and related calendar findings in audit-ux-ui.md as the visual/accessibility acceptance source.

- **Dependencies:** CAL-002, CAL-004, CORE-002.

### PLAN-001 — Bring weekly planning into the visible product

- **Priority:** P2.

- **Evidence:** WeeklyPlanService, types, IPC, storage, history, and trash integration exist, but the current navigation does not expose a weekly plan route. Product docs describe it as user-facing.

- **Recommendation:** Add a visible weekly-plan workspace only after PROD-001 resolves its status. Connect it to calendar tasks, projects, and reviews without duplicating task records. Support focus, ordered priorities, carry-forward, review, and a “plan from unscheduled tasks” flow.

- **Acceptance:** A user can open a week, assign or link tasks, carry unfinished work forward intentionally, complete a review, and navigate from a priority to its task/project. No hidden backend state becomes orphaned.

- **Verification:** Service/history tests already present should be complemented by route, persistence, migration, and e2e workflows.

- **Dependencies:** PROD-001, CAL-002, CORE-002, and CORE-003’s undo/recovery semantics.

### PROJ-001 — Evolve projects from task lists into planning spaces

- **Priority:** P2.

- **Evidence:** Projects have metadata, milestones, linked tasks, archive state, icons, and exports. Current task fields do not model dependencies, subtasks, estimates, assignees, or saved project views.

- **Recommendation:** Add task relationships and subtasks, dependency blockers, estimates/time budgets, saved filters/views, project timeline, milestone health, and a project-level calendar view. Preserve the current explicit behavior for deleting a project or milestone: delete tasks only with confirmation, otherwise unassign or move them.

- **Acceptance:** Dependencies are visible in project and calendar contexts; blocked work explains why; deleting or archiving a project never silently deletes linked work; saved views are portable and searchable.

- **Verification:** Domain model/migration tests, dependency-cycle validation, performance checks on large projects, and project e2e coverage.

- **Dependencies:** CAL-002, DATA-001, CORE-001, and CORE-003.

### CAP-001 — Turn Quick Capture into an actionable inbox

- **Priority:** P2.

- **Evidence:** CapturePage and FleetingNoteService support quick text capture, grouped review, convert-to-note, convert-to-task, and remove. Captured items have minimal metadata and are not a first-class searchable/triage queue.

- **Recommendation:** Add capture timestamps, source, priority, tags, due date, project, and triage state. Allow conversion to a task with project/date/type/reminder fields, conversion to a note with destination folder/tags, batch triage, duplicate detection, and safe archive. Add global shortcut/clipboard capture where platform permissions permit.

- **Acceptance:** A capture can be processed without retyping, remains recoverable until explicitly removed, appears in search, and reports conversion failures without losing the original.

- **Verification:** Conversion/service tests, search-index fixtures, keyboard e2e, and interrupted-conversion recovery.

- **Dependencies:** SEARCH-001, CORE-003, and CORE-003’s recovery contract.

### FIN-001 — Connect subscriptions to real financial and calendar decisions

- **Priority:** P2.

- **Evidence:** Subscription records support provider, category, amount, currency, billing cycle, normalized monthly amount, renewal date, status, review flags, last used date, tags, notes, analytics, and treemap. They do not model invoices, payment history, attachments, currency-rate provenance, or renewal actions.

- **Recommendation:** Add renewal reminders and calendar links, receipt/invoice attachments, payment history, budget/category rollups, currency conversion with source/date, cancellation URL/contact, usage review workflow, and safe archive/delete semantics. Keep manual-first data entry; provider/bank integrations require a separate privacy decision.

- **Acceptance:** Renewal views agree with calendar timezone semantics; monthly totals explain currency conversions and intervals; a subscription can be archived without losing history or attachments.

- **Verification:** Analytics edge-case tests, currency/renewal fixtures, attachment/recovery tests, and subscription e2e flows.

- **Dependencies:** CAL-002, CAL-004, SEC-002, VAULT-001.

### KNOW-001 — Expand the knowledge graph beyond note mentions

- **Priority:** P2.

- **Evidence:** KnowledgePage builds a graph from notes and note mentions. The shared relation model does not make tasks, projects, milestones, subscriptions, calendar events, or agent runs first-class graph entities.

- **Recommendation:** Add typed relations and backlinks across workspace domains, with privacy-safe indexing, filters, graph/list dual presentation, neighborhood focus, orphan detection, and a bounded rendering strategy for large vaults. Preserve a keyboard-accessible list alternative.

- **Acceptance:** A user can navigate from a note to its project/task/event/subscription relations and back. Large or malformed graphs remain usable, and graph-only information is not required to understand a relationship.

- **Verification:** Relation-builder tests, large-graph performance tests, keyboard/a11y checks, and graph e2e coverage.

- **Dependencies:** SEARCH-001, CORE-001, and domain contracts from CAL-002/PROJ-001.

### MEDIA-001 — Make Excalidraw a first-class, recoverable workspace object

- **Priority:** P2.

- **Evidence:** Excalidraw pages, session stores, serialized file documents, backups, and trash handling exist. The current capability is centered on drawing/session persistence rather than searchable relationships, asset management, and export workflows.

- **Recommendation:** Support stable drawing metadata, backlinks/tags/project links, embedded asset lifecycle, SVG/PNG/PDF export, duplicate/rename behavior, conflict/recovery state, and large-scene performance. Keep .bak recovery visible and compatible with vault backup/restore.

- **Acceptance:** A drawing can be found in search, linked from notes/projects, exported without losing assets, restored after a failed write, and safely moved or deleted.

- **Verification:** Existing Excalidraw e2e plus file/backup/asset/migration fixtures.

- **Dependencies:** SEARCH-001, CORE-001, VAULT-001, and SEC-001.

### AGENT-001 — Decide and surface the agent product boundary

- **Priority:** P2.

- **Evidence:** Agent tools, chats, runs, approvals, and history are implemented across main, preload, shared types, and stores, but there is no current normal renderer route. The product docs describe Agent Chat as shipped.

- **Recommendation:** Resolve PROD-001, then expose a focused agent workspace if it remains in scope. Make provider/model selection, cost/privacy boundaries, tool permissions, approval state, cancellation, context provenance, and run recovery visible. Link agent outputs to notes/tasks/events only through explicit validated actions.

- **Acceptance:** Users can start, cancel, resume, inspect, and delete a run; every tool action shows scope and approval state; failed or interrupted streams are recoverable; secrets and private context are not silently persisted into unrelated records.

- **Verification:** Stream/cancellation tests, approval/replay tests, context-redaction tests, and route e2e coverage.

- **Dependencies:** PROD-001, SEC-002, CORE-003, AUTO-001.

## P3 — differentiated or higher-effort directions

### SYNC-001 — Optional multi-device vault synchronization

- **Priority:** P3 until local backup and schema contracts are stable.

- **Recommendation:** Evaluate encrypted sync or a user-owned storage adapter only after DATA-001, CORE-001, SEC-002, and VAULT-001. Define conflict handling separately for Markdown, structured records, attachments, indexes, and secrets. Never assume file synchronization alone can merge task/event edits safely.

- **Acceptance:** A user understands what is encrypted, what is synced, what is local-only, how conflicts are resolved, and how a device is revoked. Sync failure never deletes the only local copy.

- **Verification:** Threat model, protocol review, conflict fixtures, network interruption tests, restore drills, and independent security review.

- **Dependencies:** All P1 data/security foundations.

### AI-001 — Add assistive intelligence only around explicit workspace actions

- **Priority:** P3.

- **Recommendation:** Once the agent boundary is decided, add explainable features such as capture classification, task extraction, weekly-plan suggestions, duplicate subscription detection, note summaries, and calendar conflict suggestions. Keep suggestions reviewable and never auto-apply cross-domain changes without the existing approval/action model.

- **Acceptance:** Every suggestion cites source records, exposes uncertainty, supports accept/edit/reject, and is safe when the model or network is unavailable.

- **Verification:** Golden fixtures, prompt/model regression tests, privacy/redaction tests, and human review of false-positive behavior.

- **Dependencies:** AGENT-001, SEARCH-001, SEC-002, CAL-002.

### EXT-001 — Provider and plugin ecosystem

- **Priority:** P3.

- **Recommendation:** Only after provider-neutral domain contracts stabilize, define an adapter boundary for Google Calendar, iCal/CalDAV, other calendars, task imports, note exporters, and automation templates. Prefer signed/versioned manifests and declared capabilities over arbitrary renderer extensions.

- **Acceptance:** A provider can be added without changing core task/calendar semantics, and uninstalling it removes credentials and provider data without deleting local records.

- **Verification:** Fake-provider contract suite, capability-manifest validation, migration/uninstall tests, and security review.

- **Dependencies:** CAL-002, CAL-003, SEC-002, AUTO-001.

## Cross-cutting quality backlog

### TEST-001 — Establish a durable product verification matrix

- **Priority:** P1.

- **Evidence:** The repository has meaningful unit and e2e coverage for calendar, notes, projects, subscriptions, scheduling, Excalidraw, capture, and vault gating. The current gaps are concentrated in reminder reconciliation, vault-file boundary enforcement, migration matrices, structured-store conflicts, provider sync, recurrence/timezone behavior, and cross-domain search.

- **Recommendation:** For every roadmap item, require the smallest durable test in the owning layer:
  - security: traversal, symlink, inactive-vault, redaction, and capability tests

  - storage: fresh/legacy/malformed/interrupted-write/duplicate-source fixtures

  - calendar: all-day/timed, DST, recurrence, provider identity, conflict, offline, and notification tests

  - automation: restart, catch-up, cancellation, child process, retry, permissions, and idempotency tests

  - renderer: loading, empty, error, pending, destructive, narrow-window, keyboard, dark-mode, and reduced-motion states

  - performance: repeat the baseline interactions from performance-review\.md after structural changes

- **Acceptance:** A feature cannot be marked verified from a happy-path e2e alone; its data, security, error, recovery, and accessibility states are represented.

- **Verification:** Keep npm run lint, npm run test:run, npm run build, and targeted e2e commands as the normal gates. Run heavy Playwright coverage only for workflows that changed or require it, consistent with AGENTS.md.

- **Dependencies:** None; begin with SEC-001, CAL-001, and DATA-001.

### DOC-001 — Keep product, data, and feature documentation generated from decisions

- **Priority:** P1.

- **Evidence:** Current docs disagree about navigation, product scope, and canonical task paths. [app-pages-and-data.md](app-pages-and-data.md) is closer to the current task store than app-features.md and README.md, but it also contains legacy path descriptions.

- **Recommendation:** Maintain one feature registry, one canonical data-model reference, and companion UX/performance audits. Add a lightweight documentation check for route names, storage paths, and status labels. When a capability is backend-only, say so.

- **Acceptance:** A new contributor can answer what ships, where data lives, how to migrate it, and which test verifies it without reading App.tsx line by line.

- **Verification:** Documentation review in the same change as route/schema changes; add a CI check for stale canonical paths where practical.

- **Dependencies:** PROD-001 and DATA-001.

## Recommended execution sequence

### Wave 0 — release safety

1. SEC-001: close or explicitly accept the vault-file boundary risk.
2. CAL-001: stop stale reminder notifications and add lifecycle tests.
3. DATA-001: freeze canonical storage and migration behavior.
4. TEST-001: add regression fixtures for the first three items.

### Wave 1 — shared contracts

1. PROD-001: reconcile the product surface.
2. CAL-002 and CAL-004: separate task/event semantics and make time explicit.
3. SEC-002 and VAULT-001: move credentials out of vault data and make backup/restore trustworthy.
4. SEARCH-001 and CORE-001: make structured records discoverable and externally safe.
5. CORE-002 and CORE-003: reduce root coupling and unify recovery semantics.

### Wave 2 — calendar and automation

1. CAL-003: ship Google Calendar read-only import.
2. CAL-005: finish calendar view and interaction hierarchy.
3. AUTO-001: make schedules durable and capability-safe.
4. TEST-001: add provider, recurrence, offline, restart, and performance gates.

### Wave 3 — visible planning and domain depth

1. PLAN-001: expose weekly planning if the product decision keeps it in scope.
2. PROJ-001: add dependencies and project planning views.
3. CAP-001: make capture a real inbox.
4. FIN-001, KNOW-001, MEDIA-001, and AGENT-001: deepen the domains users already touch.

### Wave 4 — optional expansion

Evaluate SYNC-001, AI-001, and EXT-001 only after the local data, security, provider, and recovery contracts are proven.

## Definition of done for this backlog

An item is ready to move from open to verified only when:

- its product decision and ownership are recorded

- its data/schema and migration impact are known

- success, failure, offline, empty, destructive, and recovery behavior are specified

- secrets and permission boundaries are reviewed where relevant

- the smallest unit/integration/e2e/manual checks have passed

- the relevant companion audit has no unowned interaction or accessibility regression

- documentation and feature status agree with the shipped route/API
