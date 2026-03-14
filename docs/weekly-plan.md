# Weekly Plan developer notes

## Architecture
- Renderer talks to `weeklyPlan` methods on the preload API which proxy to validated IPC handlers under `WEEKLY_PLAN_CHANNELS`.
- Main process routes the events through `WeeklyPlanService` which persists JSON per vault via `WeeklyPlanStore` at `.xingularity/weekly-plan.json`.
- State shape mirrors `WeeklyPlanState` in `src/shared/types.ts` (weeks, priorities, reviews) to keep IPC payloads and persistence aligned.

## Renderer
- `useWeeklyPlan` wraps the preload API and centralizes optimistic error handling while keeping a single source of truth for the page.
- `WeeklyPlanWorkspace` renders the main content (week header, focus, priorities, review) while `WeeklyPlanSidebar` handles the selector, summary, and quick actions in the right pane.
- Helper utilities live in `src/renderer/src/lib/weeklyPlan.ts` for formatting and pulling week-specific slices.

## Main process
- `WeeklyPlanService` owns all mutations (week create/update/delete, priority CRUD + ordering, review upserts). It serializes mutations to prevent concurrent writes and enforces constraints such as the seven-priority limit.
- `WeeklyPlanStore` does the actual JSON read/write with temp-file swaps for durability.

## Data model
- Weeks have `startDate`, `endDate`, optional `focus`, and timestamps.
- Priorities stay scoped to a week, carry a sortable `order`, a status (`planned | in_progress | done`), and optional links into projects/milestones/subtasks/tasks.
- Reviews capture the lightweight weekly reflection (wins, misses, blockers, next week).
