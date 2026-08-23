# VAULT-001 — Add backup, diagnostics, export/import, and migration recovery

Status: experimental service layer.

## Before change

Example: users could copy a vault folder, but there was no verified portable manifest, checksum comparison, restore preview, symlink policy, diagnostic report, or explicit exclusion of device-only files.

## After change

`vaultDiagnostics.ts` scans integrity, legacy paths, malformed JSON, orphaned backups, symlinks, checksums, and record counts. `vaultTransferService.ts` creates verified backups, portable manifests, restore previews, and atomic checksum-verified restores while excluding credentials, indexes, and transient files. Migration reporting adds schema/conflict/rollback information.

## Verification

`tests/vaultDiagnostics.test.ts` and `tests/vaultTransferService.test.ts` cover privacy exclusions, checksum verification, restore conflicts, and unsafe paths.
