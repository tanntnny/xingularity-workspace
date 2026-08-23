# PROD-001 — Reconcile shipped, hidden, and documented features

Status: shipped registry and visible route decision.

## Before change

Example: weekly planning and agent history existed in main/preload contracts but were absent from the normal renderer route and sidebar, while product documents described them as user-facing.

## After change

`FEATURE_REGISTRY` gives every backlog ID a status, priority, and summary. Weekly Plan and Agent now have normal desktop routes, sidebar icons, availability entries, and renderer workspaces. The registry and this record distinguish visible behavior from experimental/backend foundations.

## Verification

Page availability, sidebar shortcut, and icon tests pass; `tests/pageAvailability.test.ts`, `tests/sidebarShortcuts.test.ts`, and `tests/pageIcons.test.ts` cover the route decision.
