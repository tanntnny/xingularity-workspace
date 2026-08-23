# CORE-001 — Detect structured-file changes and resolve conflicts

Status: experimental reusable watcher.

## Before change

Example: the active watcher primarily handled notebook files; structured JSON edits from another process had no shared debounce, version/hash, malformed-file quarantine, or local-vs-disk conflict contract.

## After change

`StructuredFileWatcher` watches configured JSON roots, hashes normalized content, extracts record versions, debounces changes, quarantines malformed files, records conflicts with base/local/disk versions, and supports keep-local, keep-disk, or merged resolution. It is independently testable and ready for structured-store adoption.

## Verification

`tests/structuredFileWatcher.test.ts` covers add/change/delete, concurrent edits, conflict recovery, quarantine, and callback behavior. Existing notebook watching remains unchanged while stores migrate deliberately.
