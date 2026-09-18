# Note Draft Durability Audit

Audit date: 2026-09-16  
Scope: the current working tree and the existing note, vault, tab, watcher, and lifecycle tests.  
Implementation status: the P0 transition barrier and main-process close handshake are implemented. Crash recovery and the remaining P1 discard paths are still follow-up work.

## Conclusion

An open note has two materially different copies:

1. the live editor/session copy in the renderer; and
2. the canonical Markdown file in the vault.

The current app has a useful save path once a write begins: the editor is checkpointed, the note save coordinator serializes writes, and `writeNoteDocumentWithRevision` uses the disk revision as a compare-and-swap base. That protects against silently overwriting a newer Finder or CLI edit.

It did not protect a draft that had not reached the canonical writer yet. Several operations could clear or invalidate the renderer copy while a debounced, background, or lifecycle save was still only a fire-and-forget promise. The P0 fix now puts normal app/window close and vault transitions behind an awaited renderer-owned save barrier. Destructive, path-changing, background-tab, and crash paths retain the same ownership problem with narrower scope.

The safest durable end state is a coordinated, awaited transition barrier backed by a main-process recovery journal. The implemented P0 slice is the barrier; the journal remains deferred:

```text
editor change
    |
    +--> existing debounced CAS save (canonical file)

any state-discarding operation
    |
    +--> capture live editor snapshot
    +--> await the note save barrier
    +--> only then switch vault or close the app/window
```

The existing CAS/conflict behavior should remain the canonical-file policy. The barrier, followed by the future journal, should close the earlier durability gap without turning every keystroke into a last-write-wins canonical file write.

## Current save model

### Editor capture and autosave

`Editor` keeps the current content in a renderer ref and publishes scheduled snapshots with a 250 ms debounce and 1,000 ms maximum wait (`src/renderer/src/components/Editor.tsx:93-94,1178-1192`). `App` marks a note dirty and starts a separate 1,200 ms autosave timer (`src/renderer/src/App.tsx:2701-2733`). Until a canonical write succeeds, the latest content is therefore renderer-owned.

When a flush runs, `checkpointCurrentNote` asks the live editor to serialize its current document before updating the workspace session (`src/renderer/src/App.tsx:1740-1786`). The note coordinator then sends the document and the cached disk revision to `writeNoteDocumentWithRevision` (`src/renderer/src/App.tsx:2346-2384,2396-2473`). The main process compares that revision immediately before writing (`src/main/runtime.ts:573-598`, `src/main/fileService.ts:210-247`).

### Existing safe transitions

These paths already await a current-note save and should be preserved:

| Transition                                   | Current protection                                                          | Evidence                             |
| -------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------ |
| Normal page navigation                       | Page-leave persistence completes before the page changes                    | `src/renderer/src/App.tsx:2845-2883` |
| Search that unmounts the editor              | Current note is force-flushed before the search view is shown               | `src/renderer/src/App.tsx:5415-5428` |
| Breadcrumb folder navigation                 | Current note is force-flushed before current-note state is cleared          | `src/renderer/src/App.tsx:2646-2685` |
| Opening a drawing from a note                | Current note is force-flushed before note state is replaced                 | `src/renderer/src/App.tsx:4656-4685` |
| Same-note activation                         | It focuses the existing editor instead of reloading cached content          | `src/renderer/src/App.tsx:4537-4560` |
| Ordinary external edit to an open dirty note | The event path queues a conflict instead of immediately replacing the draft | `src/renderer/src/App.tsx:6828-6903` |
| Vault switch/open/create or active-vault removal | The renderer barrier completes before the main-process vault mutation       | `src/renderer/src/App.tsx:2845-2849`, `src/renderer/src/components/VaultSwapperDialog.tsx:113-171` |
| BrowserWindow/app close                     | Main asks the renderer to save and closes only after an acknowledgement      | `src/main/window.ts:29-153`, `src/renderer/src/App.tsx:3598-3620` |

These protections are valuable but do not cover every path that can discard renderer state.

## Loss paths

Severity describes the user impact if the operation occurs before a canonical save succeeds. Confidence describes how directly the current code demonstrates the gap; it is not a claim that every path loses data on every machine.

| ID     | Severity | Trigger                                                                                                                  | Failure mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Confidence and evidence                                                                                                                                                                                    |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ND-001 | P0       | App close, renderer reload, window teardown, or abrupt process termination                                               | Normal BrowserWindow/app close now uses a main-owned handshake: the renderer captures and awaits the current note save, and failure leaves the window open. Renderer reload, hard kill, crash, or power loss can still bypass the handshake because no durable draft journal exists.                                                                                                                                              | Close path fixed; crash/reload coverage remains open. `src/main/window.ts:29-153`; `src/renderer/src/App.tsx:3598-3620`; regression: `e2e/note-draft-durability.spec.ts`. |
| ND-002 | P0       | Switch vault, remove the active vault, or close the active vault                                                         | The renderer barrier now runs before `switchSaved`, `open`, `create`, or active-vault removal. A failed or conflicted save is propagated to the dialog, so activation is not attempted and the live draft remains available.                                                                                                                                                                  | Fixed for the scoped vault transitions. `src/renderer/src/components/VaultSwapperDialog.tsx:113-171`; regression: `e2e/note-draft-durability.spec.ts`. |
| ND-003 | P1       | Delete the current note, or delete a folder containing it                                                                | Deletion moves the canonical file to Trash but does not first flush the live editor. The subsequent session cleanup removes the only renderer copy of edits newer than the file in Trash. The user intentionally confirmed deletion, but the unsaved portion is not part of the recoverable deleted file.                                                                                                                                                                                                                   | Direct code path. `src/renderer/src/App.tsx:5791-5835,7443-7551`.                                                                                                                                          |
| ND-004 | P1       | Rename or move the current note, or rename/move a containing folder                                                      | The tree rename/move paths do not checkpoint or await the current note. They remap cached session and baseline paths around the filesystem rename. A pending save can still refer to the old path, can race the rename, or can fail after the session path has changed. The dedicated current-note rename path is safer, but the tree action has different semantics.                                                                                                                                                       | Direct code gap; race outcome depends on timing. `src/renderer/src/App.tsx:7320-7441,7590-7724`.                                                                                                           |
| ND-005 | P1       | Close an inactive workspace tab or switch away from a dirty tab                                                          | Tab activation captures the session and calls `stageCurrentNoteForBackgroundSave`, but that helper launches `persistNoteSession` with `void` and returns before the canonical write completes. Closing an inactive tab immediately deletes its session. A failed, interrupted, or teardown-raced background write then has no remaining renderer copy.                                                                                                                                                                      | Direct non-awaited boundary. `src/renderer/src/App.tsx:2504-2531,3021-3100,3408-3419`.                                                                                                                     |
| ND-006 | P1       | History undo/redo, external deletion, or a tree refresh that observes a note as missing                                  | The broad refresh coordinator removes missing note sessions and clears the current editor without checking whether the session is dirty. The explicit external-delete event path does queue a conflict for a dirty current note, but a tree refresh and the typed vault event are separate asynchronous channels, so the refresh can invalidate the session before conflict handling wins. History refresh has the same clear-on-missing behavior and does not establish a note-save barrier before applying the operation. | Conditional race with a direct invalidation path. `src/renderer/src/App.tsx:3453-3537,6716-6783,6828-6946`.                                                                                                |
| ND-007 | P1       | Open another note through a path that uses background staging, or invoke asynchronous command-palette navigation rapidly | `openNote` stages a different current note through the non-awaited background helper. Some callers also start navigation and note opening independently. Request IDs prevent several stale reads from applying, but they do not make the old note's save durable before its session is replaced or the vault changes.                                                                                                                                                                                                       | Latent sequencing risk. `src/renderer/src/App.tsx:4537-4654,9507-9513,10608-10617`. The normal awaited page and mention flows are safer.                                                                   |
| ND-008 | P1       | App crash, OS kill, power loss, or renderer crash during ordinary editing                                                | The canonical autosave is intentionally delayed by 1,200 ms and the latest editor snapshot is only in memory until a write succeeds. No durable draft journal exists, so any failure inside that window loses the draft even if no explicit navigation occurred.                                                                                                                                                                                                                                                            | Confirmed by the current persistence model. `src/renderer/src/App.tsx:2701-2727`; `src/renderer/src/components/Editor.tsx:93-94,1178-1192`.                                                                |

### Important non-loss behavior

The current external-edit conflict path is not the root cause of ND-001 or ND-002. It already uses a disk revision and can retain a dirty draft when the typed event reaches the renderer. The fix must keep that behavior: a newer external file must never be overwritten merely because a lifecycle flush is occurring. A transition barrier must return a conflict/error and preserve recovery data instead of forcing the save.

## Root cause

The ownership boundary was inverted for the dangerous moments:

- The renderer owns the only live draft.
- The main process owns vault activation, filesystem mutation, and process/window lifecycle.
- The bridge exposes asynchronous write calls, but it has no acknowledgement protocol for “the renderer is safe to discard now.”
- The code has one global in-flight note promise and several per-tab sessions, so background work is not modeled as a durable per-session transaction.
- State invalidation is spread across navigation, vault activation, tree refresh, deletion, rename/move, tab close, and history refresh rather than passing through one transition guard.

The P0 implementation corrects that boundary for vault transitions and normal window close. The remaining paths still need to converge on the same guard, and crash recovery still needs durable storage.

`stageCurrentNoteForBackgroundSave` is the clearest naming mismatch: it captures the editor, then starts a save, but its resolved promise means only “the save was started,” not “the draft is durable.”

## Recommended fix

### 1. Implement one note transition barrier

The P0 implementation reuses the existing note save coordinator and adds `prepareToDiscardCurrentNote` plus the workspace-level `prepareToDiscardWorkspace` barrier. It:

1. cancels the debounce timer;
2. captures the live editor, not only React state;
3. awaits any in-flight note write;
4. enqueues and awaits the document write with its accepted `baseHash`/revision; and
5. propagates conflict or failure without clearing the current session.

Keep the current CAS writer and external conflict choices. The barrier is an ordering and durability layer, not a replacement for conflict detection.

### 2. Put the P0 state-discarding operations behind the barrier

Vault open/create, saved-vault switching, and active-vault removal now call the same guard before changing or discarding note state. BrowserWindow close is guarded by the main-process handshake, which invokes the renderer barrier. The following lower-priority operations still need the same treatment:

- current-note delete and folder delete;
- note/folder rename and move;
- workspace-tab activation and tab close;
- history undo/redo when notes are affected;
- external-delete/tree-refresh invalidation; and
- note-to-note opens that currently use background staging.

For deletion, flush first and then move the now-current canonical file to Trash, or persist the draft as a recovery payload attached to the Trash record. For rename/move, complete the note save before changing its path and remap the accepted revision only after the filesystem mutation commits. For a failed or conflicted transition, leave the editor visible and explain the required user decision.

### 3. Add a main-process close handshake — implemented

The main process now owns the window-close sequence:

1. intercept `BrowserWindow` close;
2. ask the renderer to prepare all dirty note sessions;
3. wait for the renderer acknowledgement and the main-process note queue;
4. close only after the renderer acknowledges a successful save; and
5. leave the window open when the renderer reports a conflict or write failure.

The remaining limitation is that a renderer crash or hard process termination cannot answer the handshake. The recovery journal below is the follow-up for that case. There is intentionally no close timeout in this P0 slice, so the app does not close while a save outcome is unknown.

### 4. Add a durable draft journal for crash recovery

Before the 1,200 ms canonical autosave debounce can expire, the renderer should send the latest editor snapshot to a main-process draft store. The store should atomically persist:

```text
vaultId, relativePath, workspaceTabId, baseRevision,
draftContent, tags, updatedAt, saveState
```

This is recovery state, not a second canonical source. On restart or vault activation:

- if the canonical file still matches `baseRevision`, offer to restore the draft;
- if the canonical file changed or disappeared, show a conflict/recovery choice and retain both payloads; and
- delete the journal record only after the canonical save or explicit discard is durable.

Use the existing `.xingularity` recovery boundary and atomic file helpers where appropriate. Do not silently write a journal draft over a newer canonical file.

### 5. Make save state per session, not one global promise

Track queued/in-flight outcomes by vault, tab, and path. A global promise can cause an unrelated tab's write to be awaited or cleared, while a tab-local save is still pending. Deleting a tab should first await that tab's barrier and then remove its session and recovery record.

## Regression coverage

`e2e/note-draft-durability.spec.ts` now contains three passing regression tests:

1. close the app immediately after editing while the revision write is delayed;
2. switch vaults immediately after editing while the revision write is delayed; and
3. change the canonical file externally, then verify a vault switch conflict leaves the draft visible and does not overwrite the external file.

The delayed bridge makes the pre-save gap deterministic. The first two assert the original vault's canonical Markdown contains the draft after the operation. The conflict case asserts the transition is blocked and the external canonical content remains intact.

Add focused cases for ND-003 through ND-006 before declaring the audit closed:

| Scenario                         | Required assertion                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Delete current note              | The confirmed deletion either includes the latest draft in Trash/recovery or refuses with a clear save/conflict state. |
| Rename/move current note         | The latest draft is present at the final path and no stale write recreates the old path.                               |
| Close dirty inactive tab         | Closing the tab does not remove its draft before its save outcome is durable.                                          |
| External delete while dirty      | The draft remains available in a conflict/recovery view and is never silently cleared.                                 |
| Undo/redo touching the open note | The operation cannot discard a dirty draft without an explicit recovery outcome.                                       |

## Decision

The P0 transition barrier and main-process close handshake are implemented first, without changing the current note format or CAS/conflict semantics. The recovery journal remains the next durability boundary for crash, power-loss, and renderer-reload coverage; ND-003 through ND-007 remain the next transition-guard expansion.
