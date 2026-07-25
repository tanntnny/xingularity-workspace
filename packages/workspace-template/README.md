# `@xingularity/workspace-template`

Reusable workspace UI package for the Xingularity shell style. It is the source for the
shared light/dark tokens, global navigation, command palette, controls, and document shell.

## What It Includes

- shared renderer primitives in `src/ui`
- configurable global sidebar and command palette in `src/workspace`
- multi-document tab strip and main/right-panel document layout
- shell keyboard behavior in `src/hooks`
- shared stylesheet entrypoint in `styles/workspace.css`
- a runnable Electron starter app in `starter/`

## Consumption

Import the stylesheet once at the app entry point. It carries the shared light/dark token set
and shell styling:

```ts
import '@xingularity/workspace-template/styles/workspace.css'
```

Then compose your application from the package root:

```ts
import {
  WorkspaceAppShell,
  WorkspaceSidebar,
  WorkspaceCommandPalette,
  WorkspaceTabManager,
  WorkspaceShell,
  WorkspaceMain,
  WorkspaceSidePanel
} from '@xingularity/workspace-template'
```

## Starter App

The `starter/` directory is a full Electron sample app shell. It demonstrates:

- global sidebar structure
- command palette shell
- right-panel layout
- focus mode and panel shortcuts
- settings-style controls and workspace cards

## Reuse Boundary

Keep app data and platform behavior outside this package. Configure `WorkspaceSidebar` with
your pages and `WorkspaceCommandPalette` with your actions; compose the center and right
document areas with `WorkspaceShell`, `WorkspaceMain`, and `WorkspaceSidePanel`. This keeps
the visual language identical while each app retains its own routes, storage, and IPC.

Build before publishing or linking outside this workspace:

```bash
npm --workspace @xingularity/workspace-template run build
```

While developing this repository, keep the package visually identical to Xingularity with:

```bash
npm --workspace @xingularity/workspace-template run verify:renderer-sync
```

The Codex scaffold plugin copies this starter plus the package source into a new project.
