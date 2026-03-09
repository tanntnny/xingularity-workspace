# Beacon Vault

Local-first vault app (Electron + React + TypeScript) that stores notes and attachments directly in a user-selected folder.

## Features (MVP)

- Local vault with file-based model:
  - `notes/**/*.md`
  - `attachments/**`
  - `.appmeta/vault.json`, `.appmeta/filemap.json`, `.appmeta/index.sqlite`
- Split editor + preview for Markdown (GFM enabled)
- Sidebar file tree with create/rename/delete
- Global search over title, body, tags using SQLite FTS5
- Command palette (`Cmd/Ctrl+P`) for quick actions
- Attachment import via drag/drop into editor
- Chokidar-based watcher for external edits and incremental index updates

## Security model

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- Narrow preload API via `contextBridge`
- Strict IPC input validation in main process (`zod` + safe path checks)
- Renderer has no direct filesystem or shell access

## Project setup

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Tests

```bash
npm run test:run
```

## Vault format

When a vault is created/opened, the app ensures this structure exists:

```text
<vault-root>/
  notes/
  attachments/
  .appmeta/
    vault.json
    filemap.json
    index.sqlite
```

- `vault.json`: vault metadata and schema version
- `filemap.json`: maps note paths to stable IDs, content hash, last indexed timestamp
- `index.sqlite`: local full-text index

## Notes format

Notes are Markdown files with optional YAML frontmatter:

```md
---
title: Example
tags: [project, todo]
created: 2026-02-26T10:00:00.000Z
updated: 2026-02-26T10:05:00.000Z
---

# Example

Body text with inline #tags.
```

Tags are extracted from both frontmatter and inline `#tag` usage.

## Indexing

- Storage: SQLite + FTS5 (`.appmeta/index.sqlite`)
- Indexed fields: title, body text, tags
- Incremental behavior:
  - hash content on write/watch event
  - skip unchanged files
  - upsert changed files
  - delete on note removal
- Rebuild support: full scan of `notes/**/*.md` and reset index/filemap

## Architecture

- `src/main/`: vault lifecycle, file service, watcher, indexer, IPC registration
- `src/preload/`: safe bridge API surface
- `src/renderer/`: React app shell and components
- `src/shared/`: shared IPC/types and path/hash utilities
- `tests/`: unit tests for path validation and incremental indexing

See `docs/design-notes.md` for rationale and extension guidance.
