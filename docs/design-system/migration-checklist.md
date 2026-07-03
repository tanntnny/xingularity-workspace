# Migration Checklist

Use this checklist when moving an existing page onto the shared workspace system.

## Shell

- Does the page fit `WorkspacePage`, or does it need the full `WorkspaceShell` split-pane layout?
- Are page headers using shared workspace header structure instead of bespoke wrappers?
- Are right-panel sections using shared panel cards and headers?

## Controls

- Replace native `select`, `textarea`, and bespoke toggles with shared primitives.
- Replace direct vendor UI imports with `components/ui` wrappers.
- Replace ad hoc action buttons with shared button variants or `WorkspaceActionButton` / `WorkspaceIconButton`.

## Surfaces

- Replace repeated `workspace-subtle-surface` wrappers with `WorkspaceSectionCard` where possible.
- Keep border radius aligned with the UI spec, especially settings, dashboard, agent chat, and finance pages.
- Avoid page-local hover rules that fight the shared accent/border behavior.

## Behavior

- Reuse shell keyboard shortcuts rather than redefining them locally.
- Keep palette behavior, focus mode, and right-panel collapse rules centralized.
- Check portal-rendered UI still inherits accent tokens.

## Verification

- Run page-level lint and typecheck after migration.
- Validate keyboard shortcuts on the affected page.
- Verify empty states, forms, and panel actions still match the global sidebar/workspace tone.
