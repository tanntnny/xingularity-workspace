# CORE-002 — Reduce renderer and domain coupling before adding more surfaces

Status: partial experimental extraction.

## Before change

Example: project dependency health, calendar day presentation, and graph entity construction were page-local concerns, making new views require more edits in the root renderer.

## After change

Project dependency validation/health lives in `shared/projectPlanning.ts`; calendar day rendering is isolated in `CalendarDayView`; graph entity construction and search/time/calendar contracts are shared modules. Weekly Plan and Agent are separate page components. The large `App.tsx` controller still owns legacy orchestration, so this item is not marked fully complete.

## Verification

`tests/projectPlanning.test.ts`, graph tests, typecheck, and targeted renderer tests pass. Performance decomposition of the remaining root component is still outstanding.
