# Workspace Design System

The reusable package is split into two UI layers:

- `src/ui`
  App-owned primitives only. Feature code should import controls from here instead of vendor UI packages.
- `src/workspace`
  Xingularity-style workspace shell and page composition helpers built from the primitive layer.

## Source Of Truth

- Visual tokens and shell utilities live in [styles/workspace.css](../styles/workspace.css).
- The runnable reference implementation lives in `starter/`.
- In this repo, the broader shell design contract also lives in `docs/ai/ui.yaml`.
- Feature pages should prefer shared components over raw utility-class composition when a matching primitive exists.

## Import Rules

- Use `src/ui` for controls such as `Button`, `Input`, `Select`, `Switch`, `Textarea`, `Field`, `TabMenu`, and sidebar primitives.
- Use `src/workspace` for workspace shell, page sections, empty states, and shared shell composition.
- Do not import `@mui/*` or `@radix-ui/*` directly from feature pages/components.

## Current Canonical Patterns

- Global shell: `SidebarProvider` + `AppSidebar` + `SidebarInset`
- Workspace shell: `DocumentWorkspace*` or the new `Workspace*` aliases from `src/workspace`
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
