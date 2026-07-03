# `@xingularity/workspace-template`

Internal workspace package for the Xingularity shell style.

## What It Includes

- shared renderer primitives in `src/ui`
- workspace shell/layout components in `src/workspace`
- shell keyboard behavior in `src/hooks`
- shared stylesheet entrypoint in `styles/workspace.css`
- a runnable Electron starter app in `starter/`

## Consumption

Import the stylesheet first:

```ts
import '@xingularity/workspace-template/styles/workspace.css'
```

Then import primitives and workspace helpers from the package root:

```ts
import { SidebarProvider, SidebarInset, WorkspacePage, WorkspaceSectionCard } from '@xingularity/workspace-template'
```

## Starter App

The `starter/` directory is a full Electron sample app shell. It demonstrates:

- global sidebar structure
- command palette shell
- right-panel layout
- focus mode and panel shortcuts
- settings-style controls and workspace cards

The Codex scaffold plugin copies this starter plus the package source into a new project.
