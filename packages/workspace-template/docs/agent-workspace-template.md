# Agent Workspace Template Guide

Use this guide when another project wants the Xingularity shell style.

## What To Preserve

- The global sidebar look and hierarchy
- The translucent workspace/right-panel shell
- The shared accent-token model
- The command palette behavior and shortcuts
- The restrained rounded-lg-heavy surface language

## What To Reuse First

1. Reuse the package stylesheet from `styles/workspace.css`.
2. Reuse the primitive layer from `src/ui`.
3. Reuse the workspace composition layer from `src/workspace`.
4. Reuse the shortcut logic from `src/hooks/useWorkspaceShellShortcuts.ts`.
5. Use `starter/` as the runnable reference shell.

## What Agents Should Avoid

- Direct vendor UI imports in feature code
- New page-local control styling when an app-owned primitive already exists
- Oversized radii or opaque panels that break the sidebar/workspace relationship
- Reimplementing command palette or sidebar behavior differently without explicit product intent

## Implementation Defaults

- Prefer app-owned wrappers around vendor controls
- Use `WorkspaceSectionCard` and `WorkspaceEmptyState` before inventing page-local card shells
- Keep shell logic at the app root, not inside individual pages
- Treat `styles/workspace.css` and `starter/` as the package-level design contract
