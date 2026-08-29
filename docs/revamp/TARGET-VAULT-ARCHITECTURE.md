# Target Vault Architecture

## Design goal

Make the vault a dependable local-first database whose canonical records remain ordinary files. Any supported actor—Xingularity, Finder, a terminal command, an editor, a backup tool, or a future sync provider—must use the same ownership, revision, validation, and conflict rules.

The aggressive revamp is therefore a protocol revamp first and a folder-layout revamp second.

## Target shape

The following is a proposed end state, not an immediate migration instruction:

```text
<vault>/
  notebooks/                         # canonical Markdown and drawing documents
  attachments/                       # canonical binary assets
  inbox/                              # optional successor to fleeting/
  data/                               # canonical structured user records
    workspace.json
    projects/<stable-id>.json
    tasks/<stable-id>.json
    calendar.json
    plans/weekly.json
    subscriptions.json
    schedules/jobs.json
    resources/resources.json
    resources/relations.json
    agent/chats.json
    agent/runs.json
  .xingularity/                      # operational metadata, not routine user content
    manifest.json                     # vault identity and schema/protocol version
    journal/                          # durable change records or compacted revisions
    snapshots/                        # common bases for backup/sync
    conflicts/                        # unresolved conflict payloads and metadata
    quarantine/                       # malformed/unaccepted external files
    backups/                          # local recovery snapshots
    index.sqlite                      # derived search/index projection
    filemap.json                      # derived index map
    device.json                       # device-local state
```

Compatibility with the current `notebooks/`, `fleeting/`, domain directories, root metadata, and resource files should be maintained during migration. The important change is that the app has one explicit catalog and one source-of-truth policy even before all paths move.

## Layered architecture

```text
Finder / CLI / editor / sync provider
                  |
                  v
        filesystem observer + startup scanner
                  |
                  v
       VaultChangeCoordinator / Reconciler
          |             |              |
          v             v              v
   domain adapters   revision log   recovery manager
          |             |              |
          +-------------+--------------+
                        v
              canonical file state
                        |
          +-------------+--------------+
          v                            v
   derived index/projections       typed IPC events
                                       |
                                       v
                             renderer sync/conflict store
```

App-originated writes enter through the same coordinator:

```text
renderer command
      -> main-process command service
      -> validate + compare base revision
      -> atomic file transaction
      -> journal/expected hash
      -> domain projection and index update
      -> typed event to renderer
```

No renderer component or domain store should write directly to a vault path after this migration.

## Vault manifest

Create one stable manifest for identity and compatibility, for example `.xingularity/manifest.json`:

```json
{
  "format": "xingularity-vault",
  "manifestVersion": 1,
  "vaultId": "stable-random-id",
  "schemaVersion": 3,
  "protocolVersion": 1,
  "createdAt": "2026-08-28T00:00:00.000Z",
  "capabilities": ["markdown", "structured-records", "attachments"]
}
```

The example is illustrative. The manifest must not contain secrets, device-specific locators, or a mutable cache. A migration marker should identify whether the old layout is still active and whether rollback is possible.

## Declarative vault catalog

Introduce a shared main-process catalog rather than spreading path knowledge across services:

```ts
type VaultDomainDefinition = {
  id: string
  canonicalRoots: string[]
  derivedPaths: string[]
  parser: string
  schemaVersion: number
  identity: 'path' | 'record-id' | 'content-id'
  editPolicy: 'markdown-merge' | 'structured-validate' | 'binary-copy' | 'app-only'
  transactionUnit: 'file' | 'record' | 'domain' | 'vault'
  portable: boolean
  onMalformed: 'quarantine' | 'reject' | 'ignore'
}
```

The catalog becomes the source for watcher roots, portable manifests, diagnostics, CLI validation, sync scope, and renderer invalidation. It should be exposed as a read-only capability summary, not as arbitrary renderer-controlled paths.

## Change event contract

Replace the void tree callback with a typed event stream:

```ts
type VaultChangeEvent = {
  vaultId: string
  sequence: number
  transactionId: string
  domain: string
  kind: 'add' | 'change' | 'delete' | 'rename' | 'repair'
  path: string
  previousPath?: string
  source: 'app' | 'external' | 'sync' | 'reconcile'
  contentHash?: string
  baseHash?: string
  revision?: string
  observedAt: string
}
```

The event is a notification, not the file contents. Consumers read through the safe main/preload API when they need the current document. This avoids sending large attachments over every event and keeps the main process authoritative for filesystem access.

Required properties:

* events are normalized to safe vault-relative paths;

* one committed multi-file mutation emits one transaction identity;

* events are ordered per vault by a monotonic sequence;

* the sequence can be invalidated by a full rescan after restart or missed events;

* derived-file changes do not look like canonical user edits;

* conflicts and quarantine records are separate typed health events.

## Revision and save contract

When a note or structured record is read, return its current disk snapshot:

```ts
type VaultFileRevision = {
  contentHash: string
  size: number
  mtimeMs: number
  sequence?: number
}
```

When the renderer saves, it sends the revision it displayed:

```ts
type WriteNoteRequest = {
  path: string
  document: StoredNoteDocument
  baseHash: string
  clientMutationId: string
}
```

The main process re-reads and hashes the current canonical file immediately before committing. If the hash differs from `baseHash`, it returns a conflict and does not write. The same rule applies to structured records, with schema validation before commit.

The renderer should retain:

* `diskRevision`: the last accepted on-disk version;

* `draftHash`: the local unsaved draft;

* `externalRevision`: a newer version observed while editing;

* `conflictState`: clean, external-change, or unresolved-conflict.

This is more reliable than treating a serialized editor document as proof of what is currently on disk.

## Internal versus external changes

Every app write should register an expected result containing path, transaction ID, and content hash. The observer may report the resulting filesystem event later. The coordinator suppresses or coalesces only an event whose bytes match the expected result. A different hash is an external change, even if it arrives milliseconds after the app write.

This removes the current race created by a path-only 1.2-second suppression window.

## Atomic write protocol

All canonical writes should follow one implementation:

1. Normalize and validate the request in the main process.
2. Resolve the path relative to the active vault and reject traversal or symlink escapes.
3. Read the current revision and compare the caller's base revision when required.
4. Write to a uniquely named temporary file in the same directory.
5. Flush/close the file; use directory-safe atomic rename semantics available on the platform.
6. Record the expected hash and transaction in the journal.
7. Commit any multi-file manifest only after all staged files are ready.
8. Update derived indexes/projections from the committed canonical bytes.
9. Emit one typed transaction event.

The code should retain a recoverable previous version for destructive or conflict-prone operations. Backups and temp files must never be treated as canonical input by the reconciler.

## Multi-file transactions

For a domain mutation that changes more than one file, use one of these explicit designs:

* **Staging plus commit manifest:** write all new files under a transaction staging directory, fsync/validate them, then atomically publish a small commit record that readers use to choose one generation.

* **Append-only operation journal:** append a validated operation, then materialize records and mark the operation applied. Startup replays unapplied operations.

The first design is easier to introduce into the current file layout. The second is stronger for remote sync and audit history. The implementation may start with staging/commit and later compact into snapshots plus journal entries.

## Domain behavior

### Markdown

Markdown notes are human-editable and should support three-way text merge when a common base exists. A conflict should preserve local and disk versions and never choose last-write-wins silently.

### Structured records

Structured records must validate against versioned schemas. Safe semantic merges can be added for disjoint scalar fields or records with stable IDs, but the default for uncertain concurrent edits is a conflict record—not an overwrite and not silent quarantine.

### Attachments and drawings

The app can reconcile presence, metadata, and references. It should not attempt byte-level merges. On a concurrent binary update, preserve both versions with deterministic conflict naming and surface the choice.

### Derived data

SQLite, file maps, caches, and locator projections are rebuilt or refreshed from canonical data. External edits to them are ignored or reported as repairable health issues; they do not win over source files.

## Renderer and IPC surface

Add a small explicit surface rather than making every page infer sync from tree changes:

* `files.onVaultChanged(listener)` for typed canonical events;

* `vault.getStatus()` for watcher/reconcile/index/conflict health;

* `vault.reconcile({ scope? })` for a startup or manual scan;

* `vault.listConflicts()` and `vault.resolveConflict(...)`;

* `vault.listQuarantine()` and restore/repair actions;

* `vault.openInFinder()` and `vault.openTerminal()` with paths resolved in the main process;

* note/record reads and writes carrying revisions.

The renderer should maintain a compact vault-sync store with states such as `watching`, `reconciling`, `external-change`, `conflict`, `needs-repair`, and `offline`. Pages subscribe to domain-specific invalidation rather than refreshing all notes for every filesystem event.

## Security and trust boundary

* Keep filesystem, hashing, rename, process launch, and sync credentials in main/preload code.

* Validate every vault-relative path after normalization; do not follow symlinks outside the vault.

* Do not expose a generic shell command API to the renderer. “Open terminal here” is a narrowly scoped main-process action.

* Treat externally changed structured files as untrusted input: parse limits, schema validation, size limits, and quarantine.

* Never include secrets, schedule credentials, locator data, or private keys in portable manifests.

* Show exactly what a backup/export/sync operation includes before applying it.

## Architectural decisions

1. Files remain the canonical user-visible source of truth.
2. The index is a rebuildable projection, never a merge authority.
3. Compare-and-swap is required for app writes that originate from a displayed disk version.
4. Conflict resolution is explicit; silent last-write-wins is not acceptable for notes or structured records.
5. One coordinator owns observation, revision, transaction identity, and event publication.
6. Layout migration is staged after safety behavior works on the current layout.

