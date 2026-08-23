# SEARCH-001 — Build unified workspace search

Status: experimental typed search contract with compatibility results.

## Before change

Example: the SQLite search result represented notes only (`relPath`, title, tags, snippet), so tasks, projects, captures, events, and agent runs could not share one target/filter model.

## After change

`searchDomain.ts` and `UnifiedSearchIndex` normalize typed entities, redact sensitive text/metadata, rank title/body/tags/status matches, apply status/project/date/type filters, track recent searches, and convert results to the legacy renderer shape. Existing note SQLite results now include an explicit `entityType` and target, preserving compatibility while typed consumers are added.

## Verification

`tests/unifiedSearch.test.ts` covers ranking, filters, recent searches, target normalization, and redaction; indexer and workspace-tab fixtures use the expanded result contract.
