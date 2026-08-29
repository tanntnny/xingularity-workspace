# Data Ownership Matrix

This matrix is the policy that a live reconciler, backup/export flow, CLI, and future remote provider should share. “Current” describes the existing implementation; “target” is the recommended policy.

## Ownership classes

* **Canonical portable:** user-authored content or records. It is the source of truth and is eligible for backup and synchronization.

* **Derived:** safely rebuildable projections such as search indexes. It is not a sync input.

* **Device-local:** preferences, locators, caches, or runtime state that should not travel automatically between devices.

* **Secret:** credentials, tokens, private keys, or secret material. It is excluded from vault transport.

* **Recovery:** trash, backups, conflicts, and quarantine. It is retained for safety but is not routine sync content.

* **Legacy/compatibility:** old paths or mirrors used during migration. They must not remain a second editable source of truth.

## Path policy

| Current path or area                          | Current role                    | Target class                            | External edit policy                                             | Portable/sync policy                            | Required change                                                      |
| --------------------------------------------- | ------------------------------- | --------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| `notebooks/**/*.md`                           | Canonical note bodies           | Canonical portable                      | First-class; hash, validate, index, merge Markdown               | Include                                         | Add CAS saves, typed events, stable IDs, and open-editor conflicts   |
| `notebooks/**/*.excalidraw`                   | Drawing documents               | Canonical portable                      | First-class content change; no blind merge                       | Include                                         | Reload content and define binary/JSON conflict behavior              |
| `attachments/**`                              | User binary assets              | Canonical portable                      | Add/delete/rename first-class; content merge is not attempted    | Include                                         | Watch and index metadata; use explicit binary conflict copies        |
| `fleeting/**`                                 | Capture notes                   | Canonical portable or inbox subtype     | First-class after schema is documented                           | Include                                         | Give it a catalog entry and safe parser/writer                       |
| `projects/**`                                 | Per-project records             | Canonical portable                      | Validate schema; semantic merge only for known fields            | Include                                         | Route through a central structured adapter                           |
| `tasks/**`                                    | Per-task records                | Canonical portable                      | Validate schema; conflict on unsafe concurrent edits             | Include                                         | Add records/IDs and transactional writes                             |
| `calendar/state.json`                         | Aggregate calendar commit point | Canonical portable                      | First-class aggregate edit                                       | Include                                         | Make collection files derived, not user-editable                     |
| Calendar collection files                     | Compatibility mirrors           | Derived/legacy                          | Ignore direct edits or offer an explicit import/repair action    | Exclude                                         | Stop treating mirrors as equal sources                               |
| `weekly-plan/**`                              | Planning records                | Canonical portable                      | Validate and reconcile                                           | Include                                         | Add catalog entry and change adapter                                 |
| `subscriptions/**`                            | Subscription records            | Canonical portable                      | Validate and reconcile; secrets referenced by ID only            | Include non-secret records                      | Separate user records from credentials                               |
| `schedules/jobs.json`, runs                   | App schedule state/history      | Canonical portable or policy-controlled | Jobs can be edited with validation; runs are append/history data | Include jobs; decide runs                       | Define whether run history is portable and add transaction scope     |
| `agent/chats.json`, `agent/runs.json`         | Agent history                   | Canonical portable or policy-controlled | Validate; avoid partial multi-file edits                         | Include only if user opts in                    | Add size/privacy policy and durable writes                           |
| `resources/resources.json`                    | Resource records                | Canonical portable                      | First-class validated records                                    | Include                                         | Centralize writes and emit domain events                             |
| `resources/relations.json`                    | Resource graph                  | Canonical portable                      | First-class validated records                                    | Include                                         | Treat relation updates as a transaction with resources when required |
| `resources/write-audit.json`                  | App write audit trail           | Recovery/policy-controlled              | App-managed; external edits are not authoritative                | Exclude routine sync; export on demand          | Define retention, redaction, and diagnostic export behavior          |
| `resources/locators.json`                     | Device/application locators     | Device-local                            | Never accept as a portable source of truth                       | Exclude                                         | Keep local and rebuild/refresh per device                            |
| Root `settings.json`                          | Mixed workspace and UI settings | Split canonical/device-local            | Only canonical subset is user-editable                           | Split                                           | Move shared workspace settings into a documented portable record     |
| Root `vault.json`                             | Vault metadata                  | Manifest/identity                       | App-managed; validate on external change                         | Include identity/schema only                    | Consolidate into a manifest with stable vault ID                     |
| Root `migrations.json`                        | Migration bookkeeping           | App-managed metadata                    | App-managed; reject arbitrary edits                              | Include only if needed for migration            | Move under `.xingularity/` or make schema explicit                   |
| `index.sqlite`, `filemap.json`                | Search/index projection         | Derived                                 | Ignore external edits; rebuild                                   | Exclude                                         | Keep out of event/conflict protocol except health diagnostics        |
| `.trash/**`                                   | Recoverable deletes             | Recovery                                | App-managed; restore through API                                 | Exclude by default; export on demand            | Do not sync deleted content accidentally                             |
| `.quarantine/**`                              | Invalid external files          | Recovery                                | App-managed; restore/repair through API                          | Exclude routine sync; include diagnostic bundle | Persist metadata and show in health UI                               |
| `*.bak`, `.tmp-*`                             | Write/recovery artifacts        | Recovery/transient                      | Never user-editable                                              | Exclude                                         | Clean up safely and report abandoned artifacts                       |
| `credentials.json`, tokens, env, key material | Secrets                         | Secret                                  | Never watch as user data; reject from transport                  | Exclude                                         | Keep outside portable vault or enforce hard exclusion                |
| Global user-data settings                     | Device/application settings     | Device-local                            | App-only                                                         | Exclude                                         | Do not confuse app preferences with vault content                    |

## Recommended target layout

The target layout in [TARGET-VAULT-ARCHITECTURE.md](./TARGET-VAULT-ARCHITECTURE.md) separates canonical content from `.xingularity/` operational state. Migration should preserve the current paths initially, then move domains only with a preview, verified backup, and reversible marker.

## Rules for catalog entries

Every canonical domain must declare:

* its canonical root or exact files;

* parser and schema version;

* whether records are human-editable;

* whether edits are line-mergeable, semantically mergeable, or conflict-only;

* its transaction unit;

* its derived projections;

* its portable/sync policy;

* its recovery behavior when malformed;

* its stable identity strategy independent of path.

Without those fields, “watch every JSON file” would create false confidence: an event can be observed while the app still has no safe way to interpret or merge it.
