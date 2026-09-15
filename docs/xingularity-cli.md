# Xingularity Vault CLI

The repository includes a JSON-only CLI for safe vault inspection and portable recovery workflows. Run it from the repository with `npm run xingularity -- ...`, or use the repository executable `./bin/xingularity ...`.

Every command accepts `--root <vault-path>`. If omitted, the current working directory is used. Vault roots and traversed files must be regular, non-symbolic-link paths.

## Agent context

Read a bounded context bundle before answering workspace questions:

```bash
npm run xingularity -- vault context --root "/path/to/vault" --pretty --max-chars 24000
npm run xingularity -- vault context --root "/path/to/vault" --project "Atlas" --max-chars 16000
npm run xingularity -- vault search --root "/path/to/vault" --query "launch review" --limit 20
npm run xingularity -- vault read --root "/path/to/vault" --path "notebooks/Atlas/brief.md" --max-chars 12000
```

The context reader uses the canonical catalog and returns bounded notes, project records, tasks, calendar event metadata, weekly planning, safe resource references, subscription summaries, schedule metadata, agent-run metadata, recovery summaries, and health counts. It does not return settings, credentials, account emails, calendar attendees, sync cursors, filesystem locators, indexes, schedule scripts, or agent chat message bodies. Web resource URLs have query strings and fragments removed.

Desktop Agent Chat exposes the same reader as the read-only `workspace.context` tool. It uses the active vault selected in the app, accepts the same project, note, query, limit, and character-budget scopes, redacts the local root path from the model response, and never requires write approval.

`context` may return a validation exit code while still including useful `data`; inspect `data.health`, `data.recovery`, and `data.warnings` before relying on affected records.

## Vault operations

```bash
npm run xingularity -- vault status --root "/path/to/vault"
npm run xingularity -- vault validate --root "/path/to/vault"
npm run xingularity -- vault manifest --root "/path/to/vault"
npm run xingularity -- vault scan --root "/path/to/vault"
npm run xingularity -- vault conflicts --root "/path/to/vault"
npm run xingularity -- vault backup --root "/path/to/vault" --preview --output "/path/to/backup"
npm run xingularity -- vault backup --root "/path/to/vault" --output "/path/to/backup"
```

The backup preview is read-only. A real backup creates a new destination, copies only the portable scope, writes a manifest, and verifies checksums before publishing it. Existing destinations are not overwritten.

## Machine-readable contract

Stdout always contains one JSON envelope:

```json
{
  "ok": true,
  "command": "vault context",
  "exitCode": 0,
  "rootPath": "/path/to/vault",
  "data": {}
}
```

Exit codes are stable: `0` success, `2` usage error, `3` validation or recovery issue, and `4` operational failure. Errors are returned in the same envelope instead of being printed as a second, non-JSON stream.

The shared `$x-workspace` agent skill at `~/.xcodex/shared/skills/x-workspace` documents the trust and privacy rules for consuming this contract across repositories.

## Standalone `x-workspace` CLI

The standalone `x-workspace` executable is the agent-facing interface for one
explicitly bound vault. It works while the desktop app is closed and shares the
same canonical notes, projects, tasks, updates, meetings, resources, context,
validation, and recovery boundaries. It does not replace the compatibility CLI
above and it never accepts a vault root override.

Install the repository executable after building it:

```bash
npm run build:cli
npm install -g .
```

Bind exactly one vault:

```bash
x-workspace vault init "/path/to/new-vault" --confirm
x-workspace vault set "/path/to/existing-vault" --confirm
x-workspace vault current
x-workspace vault status
x-workspace vault reset --confirm
```

The binding is stored in the per-user OS configuration directory, not in the
vault. A second vault is rejected until the current binding is explicitly
reset.

Mutating commands are preview-first. The preview returns a short-lived token;
only the matching apply command commits it:

```bash
x-workspace project create --input '{"name":"Launch"}' --pretty
x-workspace apply <approval-token>
x-workspace project task create --input '{"projectId":"project-id","title":"Draft brief"}'
x-workspace note search "launch review" --limit 20
x-workspace context --project "project-id" --max-chars 16000
```

See [`docs/x-workspace-cli.md`](x-workspace-cli.md) for the complete command
surface, result envelope, exit codes, concurrency behavior, and agent workflow.
