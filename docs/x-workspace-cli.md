# X Workspace CLI

`x-workspace` is a standalone, JSON-first command interface for the canonical
Xingularity vault. It is intended for agents and scripts, and works with the
Electron app open or closed.

## Installation

From the repository:

```bash
npm run build:cli
npm install -g .
```

For development, use `npm run x-workspace -- ...` or `npm link` after building.
Install the repository skill into an agent skill directory explicitly:

```bash
npm run install:x-workspace-skill -- --destination "$CODEX_HOME/skills"
```

The repository copy at `.agents/skills/x-workspace/SKILL.md` is the source of
truth for agent behavior.

## One-vault binding

The CLI owns one per-user binding. It stores the normalized path, vault ID,
manifest checksum, and binding time outside the vault.

```text
x-workspace vault init <path> --confirm
x-workspace vault set <path> --confirm
x-workspace vault current
x-workspace vault status
x-workspace vault reset --confirm
x-workspace vault repair-lock --confirm
```

`init` creates and binds a new vault. `set` accepts only an existing,
manifest-valid vault. If a binding exists, `set` fails; run `reset` first. All
other commands fail with `vault-unbound` until a binding exists. There is no
`--root` option for this CLI.

## Read commands

```text
x-workspace status
x-workspace context [--query <text>] [--project <id>] [--limit <n>] [--max-chars <n>]
x-workspace search <query> [--limit <n>]
x-workspace note list|read|search
x-workspace project list|get
x-workspace project task|milestone|update|meeting list|get
x-workspace task list|get [--project <id>]
x-workspace resource list|get|preview
```

Context and search reuse the bounded vault context boundary. They exclude
credentials, settings, device locators, indexes, scripts, and agent message
bodies. Resource previews are safe and bounded; the CLI does not perform OAuth
or write to external products.

## Mutation commands

```text
x-workspace note create|update|append|delete
x-workspace project create|edit|archive|delete
x-workspace project task create|update|delete
x-workspace project milestone create|update|delete
x-workspace project update create|update|delete
x-workspace project meeting create|update|delete
x-workspace task create|update|delete
x-workspace resource create|edit|delete|link|relate|refresh
```

Use `--input <json>` for the canonical machine interface. Use `--input -` to
read one JSON object from stdin. Human-facing flags such as `--path`, `--title`,
`--name`, `--markdown`, `--project-id`, and `--id` are supported for simple
operations.

Every mutation first returns a preview:

```json
{
  "ok": true,
  "command": "project create",
  "exitCode": 0,
  "data": {
    "kind": "preview",
    "operation": "project.create",
    "approvalToken": "short-lived-token",
    "expiresAt": "2026-09-15T00:00:00.000Z",
    "vaultId": "vault-id",
    "changes": []
  }
}
```

Apply it with:

```text
x-workspace apply <approval-token>
```

Apply rechecks the vault binding, manifest, canonical content fingerprint,
schema validation, and mutation lock. A stale or expired plan is rejected
without writing. Successful commits return `kind: "commit"` and a
`transactionId`.

Deletes require explicit IDs. Project deletion also requires
`linkedTasks: "delete"` or `linkedTasks: "unassign"`. Deleted records are
copied to recoverable `.xingularity/trash/<operation-id>/` storage before the
canonical change.

## JSON and exit codes

Stdout contains one JSON envelope:

```json
{
  "ok": false,
  "command": "status",
  "exitCode": 3,
  "error": {
    "code": "vault-unbound",
    "message": "No X Workspace vault is bound. Run vault set or vault init first."
  }
}
```

Exit codes are stable:

| Code | Meaning |
| ---: | --- |
| 0 | Success or preview generated |
| 2 | Usage or command error |
| 3 | Binding, validation, selection, or approval error |
| 4 | Operational, filesystem, or lock error |
| 5 | Unresolved data conflict or stale plan |

## Concurrency

The app and CLI share a vault-local mutation lock at
`.xingularity/locks/mutation.lock`. A writer waits briefly and then returns
`vault-busy`; it never forces a concurrent write. A stale lock must be repaired
explicitly with `vault repair-lock --confirm` after checking its owner metadata.

The Electron app’s existing watcher and reconciliation path consumes CLI file
changes as external changes, refreshes affected projections, and surfaces
conflicts for open dirty notes.
