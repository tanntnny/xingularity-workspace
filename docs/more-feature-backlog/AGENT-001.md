# AGENT-001 — Decide and surface the agent product boundary

Status: experimental visible workspace.

## Before change

Example: agent chat, tools, approvals, and run history existed behind IPC but there was no normal page showing provider state, conversation, cancellation, or prior runs.

## After change

Agent workspace exposes sessions, streamed conversation state, run history, explicit cancel action, and the existing tool-approval boundary. Credentials resolve in main process, and cancellation checks stop active model/tool loops.

## Verification

Typecheck and agent-related main/preload contracts pass. Provider selection, cost accounting, and full renderer streaming e2e remain to be exercised with a configured credential.
