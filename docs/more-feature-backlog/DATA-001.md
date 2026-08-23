# DATA-001 — Make persistence, migration, and documentation agree

Status: experimental migration reporting.

## Before change

Example: a vault could contain legacy `calendar/tasks.json`, root `tasks.json`, or `.appmeta` data while current stores wrote canonical per-record directories; users had no compact report showing counts, conflicts, or rollback guidance.

## After change

Canonical paths are enumerated by `buildVaultMigrationReport`. The report lists legacy and canonical paths, schema version, record counts, duplicate/conflict candidates, and backup-first rollback guidance. Legacy Mistral settings are read only for migration and moved to the credential store instead of being retained in vault settings.

## Verification

`tests/vaultDiagnostics.test.ts`, `tests/vaultTransferService.test.ts`, and `src/main/vaultMigrationReport.ts` provide the migration/recovery evidence. Legacy data is retained until verification.
