# Current-State Audit

Audit date: 2026-08-28
Scope: current working tree, including existing uncommitted changes. The findings below are observations of the implementation, not claims that this document changed it.

## Verdict

The application is file-backed, but it is not yet file-synchronized.

Markdown changes made outside the app are partially supported when the affected file is not the currently open editor: the watcher can notice the event, the runtime can update the note index, and the renderer can refresh its tree. The same guarantee does not exist for structured vault data, attachments, most root-level state, or an open note with a local draft.

The highest-risk behavior is an open-note overwrite. An external editor can save a newer version, while the renderer continues using its cached session. Autosave or leaving the page can then send the stale renderer draft through the normal app write path. There is no disk revision check to stop that write.

## Existing change flow

The current paths form two very different pipelines:

```text
Finder / CLI edit
        |
        v
chokidar on notebooks/ only
        |
        v
VaultWatcher path filter + 1.2 s internal-write suppression
        |
        v
runtime.handleExternalEvent()
        |
        +--> Markdown: update SQLite index + notifyTreeChange()
        +--> Excalidraw: notifyTreeChange() only
        +--> other vault domains: not observed
        |
        v
void filesTreeChanged IPC event
        |
        v
renderer refreshes notes and tree
```

```text
Renderer edit
        |
        v
noteSaveCoordinator queue
        |
        v
IPC files.writeNoteDocument
        |
        v
FileService write + indexer upsert + notifyTreeChange()
```

The app's own structured stores use their individual read/write implementations. They do not flow through the same watcher, revision check, or event stream.

## What is already solid groundwork

- `vaultManager.ts` has an explicit canonical `notebooks/` layout and legacy migration logic.
- `vaultDiagnostics.ts` can scan, hash, identify sensitive/index/transient files, detect malformed JSON, and report legacy or duplicate sources.
- `vaultTransferService.ts` creates verified portable manifests, checks checksums, supports preview/restore, and has conservative exclusions.
- `vaultSyncService.ts` has deterministic three-way checksum comparison and distinguishes concurrent edits, add/add, and delete/update cases.
- `FileService` and several stores already use temporary-file-plus-rename patterns for some writes.
- The main/preload separation is appropriate for adding a safe vault command surface.
- `StructuredFileWatcher` is a promising generic watcher with validation, local-write tracking, conflict detection, and quarantine behavior; it is currently not connected to production runtime.
- Existing tests cover watcher path filtering, structured watcher behavior in isolation, portable transfer exclusions, and some external Excalidraw tree changes.

These pieces should be composed into a single protocol rather than replaced independently.

## Storage and observation map

| Area | Current location | Current source/read-write behavior | Current observation | Audit result |
| --- | --- | --- | --- | --- |
| Notes | `notebooks/**/*.md` | `FileService`, `runtime`, SQLite index | `VaultWatcher` observes the `notebooks/` tree; Markdown events update the index | Partially synchronized; open-editor safety is missing |
| Drawings | `notebooks/**/*.excalidraw` | `FileService` with a stronger atomic write path | Tree event only; content is not reloaded or indexed by the external-event path | Presence sync exists; content reconciliation is incomplete |
| Attachments | `attachments/**` | File/folder APIs and import flows | Not watched by `VaultWatcher` | External additions/removals can leave UI state stale |
| Fleeting notes | `fleeting/*.md` | `fleetingNoteService.ts` | No production watcher integration | External edits are not a supported live path |
| Projects | `projects/**` | `settingsStore.ts` / `ProjectStore` | No structured-file event subscription | Finder/CLI changes do not reliably update in-memory settings |
| Tasks | `tasks/**` | `settingsStore.ts` / `TaskStore` | No structured-file event subscription | Same stale-state risk; multi-file writes are not one visible transaction |
| Calendar | `calendar/state.json` plus collection files | Aggregate state is the commit point; other files are compatibility mirrors | No general watcher | Direct edits to mirrors are not a supported source of truth |
| Weekly plan and subscriptions | `weekly-plan/**`, `subscriptions/**` | Dedicated stores | No general watcher | App and disk can diverge until a reload or vault reactivation |
| Schedules and agent state | `schedules/**`, `agent/**` | Dedicated JSON stores; schedule secrets are outside the vault | No general watcher; some UI polling is domain-specific | Polling is not vault reconciliation |
| Resources | `resources/resources.json`, `relations.json`, `locators.json` | `resourceStore.ts` and `resourceWriteService.ts` | No general watcher; locators are device-specific | User resource edits and device metadata need separate policies |
| Root metadata | `vault.json`, `migrations.json`, `settings.json` | `vaultManager.ts`, `settingsStore.ts` | No general watcher | Portable and device-local concerns are mixed |
| Derived index | `index.sqlite`, `filemap.json` | `sqliteIndexer.ts` | Rebuilt from notes; excluded from portable transfer | Correctly treated as derived, but stale-event recovery is weak |
| Recovery/transient | `.trash/`, `.quarantine/`, `*.bak`, `.tmp-*` | Trash, watcher quarantine, store backups, temp writes | Mostly outside live event policy | Sync/backup scope needs explicit classification |

## Findings

### REV-AUDIT-001 — P0: an external edit can be silently overwritten

Evidence:

- `src/renderer/src/App.tsx:3377-3454` reuses the cached note session when the same path is selected and does not force a disk read.
- `src/renderer/src/App.tsx:5341-5414` refreshes the note list and tree after `filesTreeChanged`, but does not reload the currently open document or compare its disk version.
- `src/main/runtime.ts:2563-2620` updates the index for an external Markdown event, but has no open-editor conflict channel.
- `src/renderer/src/lib/noteSaveCoordinator.ts` serializes app writes but carries no on-disk base revision.

Failure sequence:

1. The app opens `notebooks/a.md` and caches its content.
2. Finder or a CLI writes a newer version.
3. The watcher updates metadata, but the editor continues showing the old session.
4. Autosave, page leave, or an explicit save writes the old draft.
5. The newer external edit is lost without a conflict prompt.

Required fix: every editor session needs a disk fingerprint and every write needs compare-and-swap semantics. A mismatched `baseHash` must return a conflict and must not write.

### REV-AUDIT-002 — P0: internal-write suppression can hide a real external edit

`src/main/watcher.ts:16-88` suppresses events by relative path for roughly 1.2 seconds after `markInternalWrite`. A real Finder/CLI write to that path during the window can be discarded even if its bytes differ from the app write.

Required fix: record the expected post-write content hash and suppress only an event whose observed hash matches that expectation. If it differs, process it as a real change regardless of timing.

### REV-AUDIT-003 — P1: the production watcher covers only one content tree

The runtime activates `VaultWatcher` with `notebooksPath`. It observes Markdown and Excalidraw paths under that tree, but not attachments, `fleeting/`, structured domain files, root metadata, resources, trash, or recovery records.

`src/main/structuredFileWatcher.ts` already contains a more general watcher, but repository references show it is exercised by tests and is not wired into `runtime.ts`.

Required fix: add a single `VaultChangeCoordinator` with a declarative catalog of canonical roots and domain adapters. Do not add another one-off watcher per page.

### REV-AUDIT-004 — P1: the IPC event has no change identity or domain

`runtime.ts` exposes a tree-change callback that becomes `filesTreeChanged` in `src/main/index.ts`. The preload listener and renderer listener receive no path, kind, domain, hash, transaction, or source. The renderer therefore refreshes a broad note/tree projection and cannot safely decide whether to reload an open note, invalidate settings, show a conflict, or ignore a derived-file event.

Required fix: publish typed `VaultChangeEvent` records and separate health/conflict state from ordinary tree refreshes.

### REV-AUDIT-005 — P1: there is no durable revision or compare-and-swap contract

Stored note documents contain content and metadata, but the renderer's `persistedNoteFingerprintsRef` is an in-memory serialized-document fingerprint, not a disk revision. `vaultSyncService.ts` compares supplied snapshots but does not persist a common base, apply changes, or maintain a journal.

Required fix: return `{ contentHash, size, mtime, revision }` when reading a canonical file and require `baseHash` or `baseRevision` on writes. Persist enough journal/snapshot metadata to recover after restart.

### REV-AUDIT-006 — P1: source-of-truth rules are fragmented and some domains have mirrors

`settingsStore.ts` reads and normalizes several legacy/current files and can migrate while reading. `calendarStore.ts` explicitly treats `calendar/state.json` as the aggregate commit point while also maintaining collection files as compatibility mirrors. This is workable for app-controlled writes, but a user editing a mirror in Finder cannot know which file is authoritative.

Required fix: document one canonical source per domain, make mirrors derived and non-editable, and expose a migration/repair command instead of silently deciding during ordinary reads.

### REV-AUDIT-007 — P1: write durability and transaction boundaries differ by service

`FileService.writeNoteDocument` uses a direct file write, while Excalidraw and several JSON stores use temp-file-plus-rename. Multi-file updates such as settings/project/task writes and resource records can be issued in parallel. An observer or sync tool can see an intermediate state, and a crash can leave domain files at different generations.

Required fix: centralize text/JSON writes and add a transaction boundary for multi-file mutations. A transaction can be represented by a staging directory and a commit manifest, or by an append-only operation journal followed by materialization.

### REV-AUDIT-008 — P1: malformed external state has no durable, user-facing recovery loop

The standalone `StructuredFileWatcher` can move malformed JSON to quarantine and emit callbacks, but its conflict/quarantine records are in memory. There is no production runtime integration, persisted recovery record, or general renderer surface for “this file needs repair.”

Required fix: quarantine into a durable `.xingularity/quarantine/` area with original path, hash, timestamp, parser error, and restore instructions; surface it in a vault health/conflicts view.

### REV-AUDIT-009 — P1: Finder rename/delete has different semantics from in-app rename/delete

In-app `FileService.renamePath` can rewrite note mentions across the notebook tree. A Finder rename produces a remove/add pair and bypasses that rewrite, while path-derived IDs and cached renderer paths make remapping uncertain. External deletion also has no app-level trash or link-repair policy.

Required fix: represent stable content identity separately from path, detect probable renames where safe, and treat uncertain rename/delete as a visible repair task. Never rewrite links speculatively without a user-visible diff.

### REV-AUDIT-010 — P1: “sync” stops at comparison

`vaultSyncService.ts` creates portable snapshots and compares base/local/remote checksums. It has no remote adapter, pull/push protocol, apply phase, persisted base, merge engine, or renderer conflict workflow.

Required fix: reuse the comparator as one policy layer after live reconciliation is safe. Build transport and apply only after canonical scope and revisions are stable.

### REV-AUDIT-011 — P2: portable scope is conservative but not yet a complete user-facing policy

`vaultDiagnostics.ts` and `vaultTransferService.ts` exclude indexes, file maps, settings, credentials, environment files, and device locators. That protects portability, but `settings.json` contains user-visible workspace preferences, while recovery artifacts such as `.trash/` need an explicit backup/sync decision. The current rules are implementation exclusions rather than a visible ownership model.

Required fix: classify every path as canonical portable data, derived data, device-local state, secret, recovery, or legacy and expose the effective scope in backup/sync previews.

### REV-AUDIT-012 — P2: there is no first-class command surface for vault operations

The command palette has note/resource/workspace actions, and the main process can open paths, but there is no general “open vault,” “open terminal here,” “reconcile,” “validate,” “show conflicts,” or “show last change” workflow. A documented CLI is also absent.

Required fix: add safe app commands first, then a small `xingularity vault` CLI that uses the same main/core library and never bypasses validation or path safety.

## Current behavior by user scenario

| Scenario | Current result | Data-loss risk | Desired result |
| --- | --- | --- | --- |
| Finder edits a closed Markdown note | Usually indexed and tree-refreshed | Low | Refresh list/index and show the new content on open |
| Finder edits the currently open clean note | Tree may refresh; editor can retain cached content | Medium | Reload safely or offer reload when the base is unchanged locally |
| Finder edits the currently open dirty note | No conflict handshake | High | Block autosave, retain both versions, offer reload/keep/merge |
| CLI creates or deletes a note | Some tree events work under `notebooks/` | Low/medium | Typed add/delete event and deterministic UI reconciliation |
| CLI edits a project/task/resource JSON file | No general live subscription | Medium | Validate, update the domain store, or quarantine visibly |
| Finder adds an attachment | Not part of the watcher scope | Low/medium | Update attachment projection and links |
| App writes while another process writes | Timing suppression and direct writes can race | High | CAS or transaction conflict; never silently win |
| App restarts after missed watcher events | No universal startup reconciliation | Medium | Full rescan and repair from canonical files |
| Two devices sync a changed note | No transport/apply layer | High | Three-way merge from a persisted common base |

## Audit conclusion

The application does not need to abandon the file-backed vault. It needs to make the file-backed design explicit and transactional. The safest aggressive revamp is a protocol and ownership refactor first, followed by a layout migration once live reconciliation and recovery are proven.

The target architecture and migration order are in the companion documents.
