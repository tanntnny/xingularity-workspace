# CORE-003 — Unify undo, trash, archive, and history semantics

Status: experimental mutation envelope foundation.

## Before change

Example: history entries and trash records carried domain-specific data, so a settings mutation did not have one stable operation identity across archive and restore work.

## After change

`MutationEnvelope` gives mutations an operation ID, entity kind, operation type, actor, and timestamp. History and trash records retain the operation ID, and settings/file delete paths pass the same envelope into archive/history handling. Existing undo/redo behavior remains compatible.

## Verification

Trash/history tests pass, including archive metadata and restore paths. Cross-domain retention policy and UI presentation remain follow-up work.
