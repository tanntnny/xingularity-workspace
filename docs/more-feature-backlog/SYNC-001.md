# SYNC-001 — Optional multi-device vault synchronization

Status: experimental conflict-detection foundation.

## Before change

Example: comparing two copied vault folders required ad-hoc file diffing and could treat credentials, indexes, or transient artifacts as syncable content.

## After change

Sync snapshots reuse the portable manifest boundary, exclude sensitive/index/transient paths, normalize paths, and compare base/local/remote checksums. The comparison distinguishes unchanged, one-sided changes, additions, deletions, concurrent edits, add-add, and delete-update conflicts without deleting a local copy.

## Verification

`tests/vaultTransferService.test.ts` and the sync comparison module cover portable boundaries and deterministic conflict output. No remote transport is enabled by default.
