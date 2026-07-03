# Agent Workspace Template Guide

Use this guide when another project wants the Xingularity shell style.

## What To Preserve

- The global sidebar look and hierarchy
- The translucent workspace/right-panel shell
- The shared accent-token model
- The command palette behavior and shortcuts
- The restrained rounded-lg-heavy surface language

## What To Reuse First

1. Copy the token and shell CSS from `src/renderer/src/assets/main.css`.
2. Copy or port the primitive layer from `src/renderer/src/components/ui`.
3. Copy or port the workspace composition layer from `src/renderer/src/components/workspace`.
4. Reuse the shortcut logic from `src/renderer/src/hooks/useWorkspaceShellShortcuts.ts`.
5. Read `docs/ai/ui.yaml` before making visual changes.

## What Agents Should Avoid

- Direct vendor UI imports in feature code
- New page-local control styling when an app-owned primitive already exists
- Oversized radii or opaque panels that break the sidebar/workspace relationship
- Reimplementing command palette or sidebar behavior differently without explicit product intent

## Implementation Defaults

- Prefer app-owned wrappers around vendor controls
- Use `WorkspaceSectionCard` and `WorkspaceEmptyState` before inventing page-local card shells
- Keep shell logic at the app root, not inside individual pages
- Treat `docs/ai/ui.yaml` as the behavioral design contract
