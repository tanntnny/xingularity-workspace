# Workspace Design System

This repo now has two renderer UI layers inside the app, plus one reusable package:

- `src/renderer/src/components/ui`
  App-owned primitives only. Feature code should import controls from here instead of vendor UI packages.
- `src/renderer/src/components/workspace`
  Xingularity-style workspace shell and page composition helpers built from the primitive layer.
- `packages/workspace-template`
  The standalone internal package containing the shared primitives, workspace layer, styles, and runnable starter app.

## Source Of Truth

- Visual tokens and shell utilities live in [main.css](../../src/renderer/src/assets/main.css).
- Behavioral shell and style rules live in [docs/ai/ui.yaml](../ai/ui.yaml).
- Feature pages should prefer shared components over raw utility-class composition when a matching primitive exists.
- Cross-project reuse should start from `packages/workspace-template`, not `templates/workspace-app`.

## Import Rules

- Use `components/ui` for controls such as `Button`, `Input`, `Select`, `Switch`, `Textarea`, `Field`, `TabMenu`, and sidebar primitives.
- Use `components/workspace` for workspace shell, page sections, empty states, and shared shell composition.
- Do not import `@mui/*` or `@radix-ui/*` directly from feature pages/components.

## Current Canonical Patterns

- Global shell: `SidebarProvider` + `AppSidebar` + `SidebarInset`
- Workspace shell: `DocumentWorkspace*` or the new `Workspace*` aliases from `components/workspace`
- Page cards: `WorkspaceSectionCard`
- Empty states: `WorkspaceEmptyState`
- Settings/forms: `Field` + `Input`/`Select`/`Switch`/`Textarea`
- Shell shortcuts: `useWorkspaceShellShortcuts`

## Migration Goal

The target state is consistent design through composition, not more one-off classes:

- shared shell structure
- shared control wrappers
- shared spacing and card language
- shared keyboard behaviors
- shared docs for human and agent reuse
