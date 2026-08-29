# Migration Roadmap

## Delivery principles

- Protect existing vaults before changing their layout.
- Make every migration previewable, backed up, logged, and reversible until verification passes.
- Use canonical files as the recovery source; rebuild indexes instead of migrating derived state.
- Keep compatibility readers during the transition, but remove compatibility mirrors as editable sources.
- Ship the smallest safety loop that prevents data loss before adding remote sync.

## Phase 0 — protect app saves on the current layout

Goal: eliminate silent overwrite risk without moving user files.

Deliverables:

- return content hash/revision with note reads;
- add `baseHash` compare-and-swap to note writes;
- block autosave/page-leave writes when disk changed;
- show local/disk conflict state and a reload/keep/merge decision;
- replace `VaultWatcher` path/time suppression with expected-content-hash suppression;
- make note writes atomic through one shared text writer;
- add focused tests for Finder/CLI edits while an editor is clean and dirty.

Exit criteria:

- a newer disk version can never be overwritten by a stale app session without an explicit user decision;
- a different external hash immediately after an app write is processed;
- the current layout continues to open and save unchanged notes.

Dependencies: none beyond the current note read/write and watcher paths.

## Phase 1 — live vault reconciliation

Goal: make supported external edits visible across the current canonical domains.

Deliverables:

- implement the declarative vault catalog;
- introduce `VaultChangeCoordinator` and connect the existing structured watcher behavior to production;
- watch canonical note, drawing, attachment, fleeting, project, task, calendar, planning, subscription, schedule, agent, and resource roots according to policy;
- add startup and manual full reconciliation;
- add typed main/preload change events with path, domain, kind, hash, source, and transaction sequence;
- add renderer sync/health state and domain-specific invalidation;
- persist quarantine/conflict metadata;
- update derived index/projections from canonical bytes.

Exit criteria:

- Finder/CLI changes to every declared canonical domain update the app without restarting;
- malformed structured content is retained and surfaced;
- a missed watcher event is repaired by rescan;
- derived files never trigger user-content sync behavior.

Dependencies: Phase 0 revision/write primitives.

## Phase 2 — normalize ownership and storage

Goal: remove ambiguity from the vault model.

Deliverables:

- create a stable manifest with vault ID and schema/protocol versions;
- publish the ownership matrix as runtime catalog metadata;
- split shared workspace settings from device-local UI settings;
- choose one canonical source for calendar and other mirrored domains;
- move operational state under `.xingularity/` where appropriate;
- make conflicts, quarantine, backups, and migrations durable and inspectable;
- migrate path-derived identities to stable record/content IDs;
- add preview, verified backup, migration report, and rollback marker.

Migration procedure for each domain:

1. Scan and report current sources, duplicates, malformed records, and unsupported files.
2. Create a verified portable backup of canonical user data plus an optional recovery bundle.
3. Write the new generation to staging and validate it.
4. Publish a migration marker and commit manifest.
5. Reconcile projections and compare counts/hashes.
6. Keep the old source read-only until the next successful activation and an explicit cleanup step.

Exit criteria: one documented source of truth per domain, no silent mirror precedence, and rollback instructions tested on a copy of a real vault.

Dependencies: Phase 1 catalog, validation, and durable recovery.

## Phase 3 — command and CLI surface

Goal: make filesystem-oriented workflows discoverable and safe.

Deliverables:

- command-palette actions for open Finder, open terminal, status, reconcile, validate, conflicts, backup, and diagnostics;
- a small `xingularity vault` CLI using the same core catalog and write protocol;
- `--preview` for every operation that can modify files;
- stable exit codes and machine-readable JSON output for automation;
- documented path safety, symlink handling, secret exclusion, and lock/concurrency behavior.

Exit criteria: a user can edit with Finder or a terminal and run `scan`/`validate` without app-only knowledge; automation cannot bypass the same safety checks.

Dependencies: Phase 1 event/reconcile core; Phase 2 manifest is strongly preferred.

## Phase 4 — portable and cross-device sync

Goal: add transport only after local write and conflict behavior are dependable.

Recommended order:

1. Export/import revisioned snapshots using the existing portable manifest foundation.
2. Add a folder or Git adapter so users can use familiar storage and history.
3. Add a remote provider adapter only if product requirements justify operating a service.
4. Persist common bases and use the domain conflict policies from the sync protocol.
5. Add a remote section to the sync page for pull/push state and unresolved conflicts.

Exit criteria:

- two replicas can exchange a snapshot and identify exact additions, updates, deletions, and conflicts;
- Markdown has tested three-way merge behavior;
- structured and binary conflicts preserve both sides;
- derived, secret, device-local, and transient data never enters the default transport.

Dependencies: Phases 0–3. Do not start with a remote backend while local CAS and reconciliation are unresolved.

## Implementation backlog

| ID | Work item | Phase | Verification |
| --- | --- | --- | --- |
| VAULT-REVAMP-001 | Add disk revision to note read and CAS note write | 0 | Stale editor save returns conflict and writes nothing |
| VAULT-REVAMP-002 | Replace time suppression with expected-hash registry | 0 | Different same-path external write is delivered |
| VAULT-REVAMP-003 | Centralize atomic text/JSON writes | 0/1 | Crash/temporary-file tests and no partial canonical file |
| VAULT-REVAMP-004 | Define `VaultDomainDefinition` catalog | 1 | Watch, diagnostic, export, and CLI scope agree |
| VAULT-REVAMP-005 | Build `VaultChangeCoordinator` | 1 | Canonical roots reconcile after external changes and restart |
| VAULT-REVAMP-006 | Add typed IPC events and renderer sync store | 1 | Pages invalidate only affected projections |
| VAULT-REVAMP-007 | Persist conflict/quarantine records | 1 | Restart preserves unresolved recovery work |
| VAULT-REVAMP-008 | Establish manifest and stable vault ID | 2 | Copy/restore identifies the vault and schema safely |
| VAULT-REVAMP-009 | Eliminate editable compatibility mirrors | 2 | Direct mirror edits are rejected or explicitly imported |
| VAULT-REVAMP-010 | Split portable and device-local settings | 2 | Export contains intended workspace settings only |
| VAULT-REVAMP-011 | Add command palette vault actions | 3 | All read/preview operations work from the active vault |
| VAULT-REVAMP-012 | Add `xingularity vault` CLI | 3 | CLI and app produce equivalent validation/status results |
| VAULT-REVAMP-013 | Add snapshot/folder or Git transport | 4 | Two replicas compare and apply with a persisted base |
| VAULT-REVAMP-014 | Add Markdown/structured/binary conflict UI | 4 | Conflict resolution preserves unchosen content |

## Rollback and failure handling

- Keep the current layout readable until a migration is verified.
- Never delete a legacy source in the same operation that creates its replacement; archive it under a recoverable migration record first.
- If a migration fails validation, leave the original canonical files untouched and report the staging path.
- If the index fails, rebuild it from canonical files; do not restore an index from another device.
- If a structured file is malformed, quarantine a copy and retain the original bytes until the user repairs or restores it.
- If a remote sync apply fails, leave the local canonical generation unchanged and retain the remote snapshot/conflict payload.

## Test plan

The implementation should add focused tests before broad e2e coverage:

- current open note, clean external edit;
- current open note, dirty external edit;
- stale app save after an external write;
- app write followed by a different external write within the suppression window;
- external add/change/delete/rename for notes and attachments;
- valid and malformed structured record changes;
- calendar aggregate versus compatibility mirror behavior;
- startup rescan after a missed event;
- crash/partial-write recovery and abandoned temp files;
- portable manifest scope and secret/index exclusion;
- symlink and path traversal rejection;
- two-way base/local/remote conflict classification and preservation.

## Recommended go/no-go gates

Do not ship a “sync” label for a domain until:

1. its canonical source is named;
2. its external edit parser/validator is tested;
3. its app writes have revision/transaction semantics;
4. its derived projections can be rebuilt;
5. its conflict and recovery behavior is visible;
6. its portable inclusion/exclusion policy is documented.
