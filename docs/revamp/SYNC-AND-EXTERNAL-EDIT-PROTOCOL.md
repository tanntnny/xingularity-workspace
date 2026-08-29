# Sync and External-Edit Protocol

## Three meanings of sync

The product should name these separately in UI, docs, and code:

1. **Live vault reconciliation** — the running app consumes changes made to the same vault by Finder, a CLI, an editor, or another process.
2. **Portable vault transfer** — backup, export, folder synchronization, or Git moves canonical files while excluding derived/device/secret state.
3. **Two-way remote sync** — two replicas exchange revisions and resolve changes against a common base.

Live reconciliation is the prerequisite for the other two. A remote transport cannot make an unsafe local save safe.

## External edit lifecycle

For every filesystem event:

1. Normalize the absolute path to a vault-relative path.
2. Reject paths outside the active vault, symlink escapes, transient files, derived files, and secrets.
3. Map the path through the vault catalog to a domain and edit policy.
4. Debounce only duplicate notifications for the same observed hash; do not debounce away different content.
5. Read, hash, and validate the canonical bytes.
6. If malformed, preserve the original in durable quarantine metadata and emit `needs-repair`.
7. Classify the event as add/change/delete/rename and assign a sequence.
8. Update the domain store and derived projections from the new canonical state.
9. Compare the event with expected app-write hashes to distinguish an acknowledged app result from an external mutation.
10. Emit a typed transaction event to the renderer and any sync adapter.

On app startup, perform a full reconciliation against the last known catalog/revision state. A watcher is an optimization, not the only source of correctness.

## Required scenarios

### Finder edits a closed note

The coordinator observes the Markdown change, hashes and parses it, updates the note index, and emits an external change event. The renderer refreshes the list/tree. The next open reads the changed document and stores its new revision.

### Finder edits an open, clean note

The renderer has no local draft beyond the accepted disk revision. When the event arrives, it may reload the editor automatically while preserving selection and focus, or show a lightweight “Reload from disk” prompt if cursor preservation is not reliable. The new revision becomes the editor base.

### Finder edits an open, dirty note

The renderer must stop autosave for that session. It retains:

* the local draft;

* the last accepted base;

* the current disk version;

* the external revision and event metadata.

The user can:

* reload disk and discard the local draft;

* keep the local draft and write it only after an explicit replacement decision;

* merge the two versions against the base;

* save both as separate notes for a manual comparison.

Until the user chooses, `page leave`, autosave, and background save must all return the same conflict state without writing.

### The app writes while Finder writes

The app sends `baseHash`. The main process compares the current disk hash immediately before commit. If Finder won the race, the app write returns a conflict. The expected-hash registry must not classify Finder’s different bytes as an internal event merely because the path was recently written by the app.

### CLI creates, edits, or deletes a note

The same watcher/reconciler path handles the change. A created note is parsed and indexed. A deleted note removes its derived entry and invalidates open state if applicable. A CLI edit to an open clean note can reload; a CLI edit to an open dirty note follows the same conflict path as Finder.

### CLI edits a structured record

The catalog selects the domain parser and schema version. Valid data updates the domain projection. Invalid data remains recoverable and is surfaced as a repair item. The app must not silently normalize and overwrite a file just because it was read.

### Finder adds or removes an attachment

The attachment index and references are invalidated, and the renderer receives a domain event. The file itself is not parsed as a mergeable document. A concurrent binary replacement produces a conflict copy or a user decision.

### Finder renames a note

The watcher may initially observe delete plus add. If stable identity metadata or a high-confidence content match proves a rename, emit a rename event. Otherwise keep the operation as delete/add and show unresolved links as a repair task. The app must not rewrite every link based only on filename similarity.

### The process misses events or is offline

On activation and on explicit “Reconcile vault,” compare the canonical tree to the last known state. Rebuild derived projections where needed. A status page should show the last successful scan, current event sequence, and any stale/repairable domains.

## Conflict model

Use a common base whenever possible:

```text
base       = last revision both sides knew
local      = app draft or local replica
external   = Finder/CLI/remote revision
```

Decision policy:

* unchanged vs changed: accept the changed side;

* changed on one side only: accept it and advance the base;

* changed on both sides: use domain-specific merge;

* deleted vs updated: preserve the updated content and record a deletion conflict;

* added with the same logical identity: record an add/add conflict;

* malformed or unsupported: quarantine/reject with recovery metadata.

### Markdown merge

Use a three-way text merge when a base is present. If hunks overlap, write a conflict record and keep both versions; do not inject conflict markers into the canonical note unless the user explicitly requests that output.

### Structured merge

Start with conflict-only behavior. Add semantic merging only for schemas with stable IDs, field ownership, and deterministic list rules. Any merge result must validate before commit.

### Binary merge

Never overwrite one concurrent binary with the other. Preserve both bytes under conflict-safe names and link them from the conflict record.

## Portable scope

The default transport set should be generated from the catalog, not a hand-maintained exclusion list. It should include canonical notes, attachments, and opted-in structured records. It should exclude:

* `index.sqlite` and `filemap.json`;

* device-local `locators.json` and device state;

* global app settings and schedule secrets;

* credentials, tokens, environment files, and key material;

* temporary files and abandoned write staging;

* quarantine, conflicts, and trash during routine sync.

Recovery data may be included in an explicit diagnostic/export bundle, with a clear warning that it can contain deleted or malformed content.

## Proposed app commands

These commands should be available in the command palette and, where practical, through a CLI. They are proposed; they do not exist as a complete surface today.

| Command                  | Purpose                                           | Safety rule                                                              |
| ------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------ |
| Open vault in Finder     | Reveal the active vault root                      | Main process resolves the path; renderer cannot supply an arbitrary path |
| Open terminal here       | Start a terminal at the active vault root         | Narrow, explicit process launch; no arbitrary shell API                  |
| Reconcile vault          | Scan canonical paths and repair projections       | Read/validate first; show changes and errors                             |
| Validate vault           | Run schema, path, and integrity checks            | No writes unless a separate repair command is confirmed                  |
| Show conflicts           | Review unresolved local/external/remote changes   | Resolution must name the chosen result                                   |
| Show vault status        | Show watcher, last scan, index, and repair health | Read-only                                                                |
| Create portable backup   | Generate and verify a manifest/backup             | Preview scope and exclude secrets/derived state                          |
| Export diagnostic bundle | Package health, logs, and selected recovery data  | Explicitly warn about sensitive/deleted content                          |

Suggested CLI shape:

```text
xingularity vault status <path>
xingularity vault scan <path>
xingularity vault validate <path>
xingularity vault backup <path> --output <destination>
xingularity vault conflicts <path>
xingularity vault repair <path> --preview
```

The CLI should call the same catalog, parser, revision, and transaction libraries as the app. It must not directly edit files with a separate set of rules.

## Sync page proposal

A dedicated notebook/vault sync page should answer “what is happening to my files?” rather than duplicate the note browser. It should show:

* current vault path and vault ID;

* watching/reconciling/offline state;

* last scan and last committed sequence;

* external changes since the user last looked;

* unresolved conflicts and repair/quarantine items;

* portable scope and excluded categories;

* buttons for reconcile, validate, open Finder, open terminal, backup, and conflict resolution.

The page should remain useful without a remote provider. A future remote section can add provider status, last pull/push, common base, and remote conflicts without changing local event semantics.

## Acceptance matrix

| Test                                                       | Must prove                                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| External edit to closed note                               | Index, list, and next open reflect disk                                                |
| External edit to open clean note                           | Editor refreshes or prompts without losing selection                                   |
| External edit to open dirty note                           | Autosave and page leave cannot overwrite; conflict is visible                          |
| App save after external edit                               | Compare-and-swap rejects stale base                                                    |
| External structured JSON change                            | Valid data updates; invalid data is recoverable and visible                            |
| External attachment add/delete                             | Attachment projection changes without a full app restart                               |
| App write followed immediately by different external write | Different hash is not swallowed by suppression                                         |
| Restart after missed event                                 | Startup reconciliation repairs projections                                             |
| Multi-file app mutation                                    | Renderer observes one committed transaction, not intermediate states                   |
| Portable backup                                            | Canonical data is included; index, secrets, locators, and transient files are excluded |
| Symlink/outside-vault event                                | It is rejected and cannot escape the root                                              |

