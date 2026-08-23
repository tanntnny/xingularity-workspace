# PLAN-001 — Bring weekly planning into the visible product

Status: shipped visible desktop workspace.

## Before change

Example: weekly-plan storage, service, IPC, and history existed, but users could not reach a weekly plan from the normal route/sidebar.

## After change

Weekly Plan is a desktop page showing the current week, task priorities, completion state, review fields, and links back to task/project context. It uses the existing weekly-plan service and does not duplicate task records.

## Verification

Weekly-plan history tests and TypeScript verification pass; route/icon/sidebar tests cover reachability.
