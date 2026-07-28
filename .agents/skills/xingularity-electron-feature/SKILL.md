---
name: xingularity-electron-feature
description: Implement or repair Xingularity features that cross Electron boundaries, including vault-backed data, IPC, preload APIs, shared contracts, migrations, schedules, and renderer integration. Use when a change touches src/main, src/preload, src/shared, window.vaultApi, persistence, or a full renderer-to-main workflow.
---

# Xingularity Electron Feature

Build each capability at its ownership boundary. Keep Node, filesystem, SQLite, shell, and Electron APIs in `src/main/`; expose only the narrowly typed operation a renderer needs through `src/preload/`.

## Workflow

1. Map the current path before editing: shared types and channel constants, preload bridge, main IPC registration/service, renderer call site, and the nearest focused test.
2. Put cross-process input/output types in `src/shared/types.ts`; keep IPC channel names in `src/shared/ipc.ts`.
3. Implement domain behavior in a focused `src/main/` service or store. Validate inputs and enforce vault-relative path safety at this layer; do not rely on renderer validation.
4. Register a minimal handler in `src/main/ipc.ts` (or the domain-specific IPC module), then expose its typed method from `src/preload/index.ts` and `src/preload/index.d.ts`.
5. Call the preload bridge from the renderer. Never import Node/Electron filesystem or shell APIs into `src/renderer/`.
6. Preserve vault compatibility. When a persisted shape changes, make loading tolerant of existing data and add a migration only when the project’s migration flow requires it.
7. Add or update the closest unit test in `tests/`. Run its file first, then run lint and the relevant broader test command when practical.

## Boundary Checks

- Maintain `contextIsolation: true` and `nodeIntegration: false`.
- Prefer allowlisted, intention-revealing bridge methods over generic command or file APIs.
- Treat all renderer-provided values as untrusted; validate IDs, paths, and payloads in main-process code.
- Keep vault content and app metadata in their established paths. Do not introduce a competing persistence location without an explicit migration decision.
- For regressions, fix the responsible service, contract, or state boundary rather than masking the symptom in a component.

## Completion Standard

Verify that types align through shared, preload, and main layers; the renderer has no direct privileged access; persisted data remains readable; and focused tests cover the changed behavior.
