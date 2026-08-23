# KNOW-001 — Expand the knowledge graph beyond note mentions

Status: experimental typed graph relations.

## Before change

Example: the graph contained note nodes and note-mention links only, so a project or task could not be navigated as a first-class graph entity.

## After change

Knowledge graph construction accepts project/task entities, adds project-task and dependency relations, labels node kinds/IDs, and lets graph clicks open the corresponding task or project. Note-only graph output remains compatible.

## Verification

Knowledge graph tests pass for legacy note-only graphs and typed entity relations. Large-graph rendering and a complete subscription/event relation matrix remain follow-up work.
