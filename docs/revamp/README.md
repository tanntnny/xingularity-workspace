# Vault Revamp

Status: proposal and code-grounded audit
Audit date: 2026-08-28
Scope: the current working tree of Xingularity; this document set does not change application code.

## Executive recommendation

Yes: Xingularity can become a strong sync notebook application, but the first product to build is **live vault reconciliation**, not a remote sync service.

The vault already has the right broad direction—user content is stored as files, the app has a filesystem watcher, an index, portable manifests, diagnostics, and a three-way comparison helper. The missing layer is an authoritative change protocol that makes an app write, a Finder edit, and a command-line edit converge on the same state.

The recommended north-star invariant is:

> Every accepted change has one canonical on-disk result, every projection catches up to it, and the app never overwrites a newer disk version without an explicit conflict decision.

That requires four foundational changes:

1. Treat canonical vault files as the source of truth. SQLite, file maps, locators, caches, and UI state are projections or device state.
2. Replace path/time-based watcher suppression with content-aware change transactions and persisted revisions.
3. Add compare-and-swap saves for open editors so Finder and CLI edits cannot be silently overwritten by autosave.
4. Introduce a single vault change coordinator that watches every supported canonical domain and publishes typed events through the main/preload boundary.

Remote or cross-device sync should follow these protections. It can use a folder provider, Git, or a future service, but it should consume the same revision, conflict, and transaction protocol rather than create a second write path.

## What “sync” means here

The word currently covers three different products:

* **Live reconciliation:** the running app notices edits made by Finder, a terminal command, another editor, or an automation on the same vault and refreshes safely.

* **Portable synchronization:** a vault can be copied, backed up, versioned, or synchronized by a folder provider without copying derived indexes or secrets.

* **Two-way remote sync:** two app instances or devices exchange changes, retain a common base, and resolve conflicts.

The first is immediately valuable and currently incomplete. The second is partially present through `vaultTransferService.ts`. The third is only a comparison foundation today: `vaultSyncService.ts` has deterministic checksum comparison but no transport, apply phase, durable base, or conflict UI.

## Documents

* [Current-state audit](./CURRENT-STATE-AUDIT.md) — observed flows, storage boundaries, risks, and evidence in the codebase.

* [Data ownership matrix](./DATA-OWNERSHIP-MATRIX.md) — what is canonical, derived, device-local, secret, recovery-only, or legacy, and whether external edits are supported.

* [Target vault architecture](./TARGET-VAULT-ARCHITECTURE.md) — the aggressive end state, contracts, event model, write protocol, and renderer behavior.

* [Sync and external-edit protocol](./SYNC-AND-EXTERNAL-EDIT-PROTOCOL.md) — Finder/CLI/app scenarios, conflict behavior, sync scope, and proposed command surface.

* [Migration roadmap](./MIGRATION-ROADMAP.md) — staged delivery order, safeguards, rollback, and acceptance tests.

## Product boundary

The revamp should make ordinary file workflows first-class:

* open the vault in Finder;

* open a terminal at the vault root;

* edit Markdown directly;

* add or remove attachments directly;

* use a documented command to validate, reconcile, back up, or inspect conflicts;

* let the app safely consume those changes while it is running;

* let the app write back to the same files with atomic, revision-checked mutations.

It should not imply that arbitrary JSON edits are safe merely because a file is visible. Structured files need schemas, validation, a recovery path, and an explicit policy for semantic merging.

## Non-negotiable safety rules

* No last-write-wins save for an open note when the disk base changed.

* No silent deletion or replacement of malformed structured files.

* No syncing of secrets, device locators, SQLite indexes, or temporary artifacts by default.

* No renderer access to arbitrary filesystem or shell APIs.

* No domain service that writes directly to the vault outside the central write protocol.

* No migration that deletes legacy data before a verified backup and a user-visible report.

## Recommended first implementation slice

Implement the P0 safety path before changing the directory layout:

1. Return a disk fingerprint when opening a note and send it back as `baseHash` on save.
2. Reject a save when the current disk hash differs; show the local draft and disk version as a conflict.
3. Replace the 1.2-second internal-write suppression window with an expected-content-hash registry.
4. Add a startup/manual full vault rescan and a typed change event for notes.

This slice directly answers the Finder/command-line editing request and prevents the most damaging failure mode while preserving compatibility with the current vault.
