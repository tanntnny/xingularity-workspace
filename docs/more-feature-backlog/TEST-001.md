# TEST-001 — Establish a durable product verification matrix

Status: experimental verification expansion.

## Before change

Example: core unit suites covered existing notes/calendar/schedules, but new backlog risks such as protocol traversal, structured conflicts, portable exports, provider normalization, typed search, and planning dependencies had no owning tests.

## After change

Targeted suites now cover vault protocol/diagnostics/transfer, reminders, calendar domain/provider adapter, structured watcher, unified search, plugin manifests, assistive suggestions, project planning, and the changed schedule review contract. Typecheck is run across node, web, and workspace-template projects.

## Verification

The targeted suites pass. Full lint remains noisy because the repository already contains unrelated external and legacy lint errors; this is recorded rather than hidden.
