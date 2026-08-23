# PROJ-001 — Evolve projects from task lists into planning spaces

Status: experimental planning depth.

## Before change

Example: projects had milestones and linked tasks but no dependency IDs, subtask parent, estimate, time budget, saved view, or dependency-health summary.

## After change

Tasks accept dependencies, parent task, descriptions, estimates, and updated timestamps. Projects accept time budgets and the properties panel shows completion, blocked, overdue, and dependency-cycle health. Cycles and missing dependencies are rejected before calendar persistence.

## Verification

`tests/projectPlanning.test.ts` covers cycle/missing dependency validation, blockers, overdue work, and health ratios. Saved views and timeline presentation remain future depth.
