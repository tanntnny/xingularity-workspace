# Layout Recipes

## App Shell

Use this pattern for desktop-style workspace apps:

1. Wrap the app body in `SidebarProvider`.
2. Render `AppSidebar` on the left.
3. Render `SidebarInset` for the main shell.
4. Keep command palette and shell shortcuts mounted at the app root.

## Document Workspace

Use `components/workspace` for split-pane pages:

- `WorkspaceShell`
- `WorkspaceMain`
- `WorkspaceMainHeader`
- `WorkspaceMainContent`
- `WorkspaceSidePanel`
- `WorkspaceSidePanelHeader`
- `WorkspaceSidePanelContent`

Use this for pages like schedules, agent chat, and any page with a persistent right rail.

## Standalone Page Content

Use these when a page is content-first instead of split-pane:

- `WorkspacePage` for padded scrolling layout
- `WorkspaceSectionCard` for subtle glass cards
- `WorkspaceEmptyState` for reusable empty/loading fallback composition

This is the right default for settings, dashboard, finance-style overview pages, and simple tool pages.

## Forms

Use:

- `Field` for label/help grouping
- `Input`, `Select`, `Textarea`, `Switch` for controls

Avoid custom labels and native controls unless the primitive layer is missing the capability.

## Keyboard Behaviors

Preserve these shell shortcuts in future projects:

- `Cmd/Ctrl + P`: open search palette
- `Cmd/Ctrl + Shift + P`: open command mode
- `Alt + B`: toggle right panel
- `Cmd/Ctrl + F`: toggle focus mode

Keep this logic in a shell hook/provider rather than duplicating it per page.
