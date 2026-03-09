# Design Notes

## Why SQLite + FTS5

SQLite was chosen over a pure JS index because this app is local-first and must stay fast as note volume grows.

- FTS5 gives efficient full-text search on disk without loading the full corpus in memory.
- Querying title/body/tags is straightforward and fast.
- Index durability and crash safety are better than ad-hoc JSON index files.
- The data remains local and portable inside `.appmeta/index.sqlite`.

## Markdown rendering choice

`react-markdown` + `remark-gfm` was selected for renderer preview.

- It reuses the unified/remark ecosystem used by parsing flows.
- It has a predictable React component model.
- It supports GFM features (tables, task lists) via plugin.

## Watcher and debounce strategy

- `chokidar` watches `notes/` for `add`, `change`, `unlink`.
- Events are debounced per path (`~180ms`) to absorb write bursts.
- Internal writes are marked in-memory with timestamps.
- Watch events matching recent internal writes (window ~1200ms) are ignored to reduce write-loop double indexing.

## IPC hardening

- Renderer only gets a narrow API from preload (`vault`, `files`, `search`, `attachments`).
- All handler inputs are validated (`zod`).
- Path traversal is blocked by:
  - relative path normalization
  - disallowing absolute/parent escapes
  - final resolved-path boundary checks against vault roots
- Raw filesystem APIs are never exposed to renderer.

## Extending toward plugins

Future plugin support should be capability-scoped and isolated:

- Add a plugin host in main process only.
- Give plugins explicit capability manifests (`readNote`, `search`, etc.).
- Deny direct process/fs access by default.
- Expose plugin calls through mediated IPC-like capability checks.
- Keep vault boundary checks centralized in one policy layer.
