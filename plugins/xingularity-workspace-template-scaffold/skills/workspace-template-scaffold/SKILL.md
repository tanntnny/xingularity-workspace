---
name: workspace-template-scaffold
description: Scaffold a new Electron workspace app using the in-repo Xingularity workspace template package and starter shell.
---

# Workspace Template Scaffold

Use this plugin when a user wants a new Electron project bootstrapped from the Xingularity workspace shell.

## Source Of Truth

- Package source: `packages/workspace-template`
- Starter app source: `packages/workspace-template/starter`

Do not rebuild the starter from scratch. Use the scaffold script so the package and starter stay aligned.

## Scaffold Command

Run:

```bash
python3 plugins/xingularity-workspace-template-scaffold/scripts/scaffold_workspace_template.py <target-dir>
```

### Optional overwrite

```bash
python3 plugins/xingularity-workspace-template-scaffold/scripts/scaffold_workspace_template.py <target-dir> --force
```

## What It Creates

The scaffold script writes a self-contained starter repo layout:

- root starter app files from `packages/workspace-template/starter`
- local package source at `packages/workspace-template`
- starter dependency rewritten to `file:./packages/workspace-template`

## After Scaffold

Tell the user to run:

```bash
npm install
npm run dev
```

from the scaffold target directory.

## Guardrails

- Do not scaffold into a non-empty directory unless `--force` is intentional.
- Do not edit the generated marketplace file by hand during plugin iteration.
- If the package source changes, update the plugin via the normal cachebuster/reinstall flow instead of creating a second plugin.
