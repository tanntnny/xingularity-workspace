# AUTO-001 — Make schedules durable, cancellable, and capability-safe

Status: experimental safety and cancellation behavior.

## Before change

Example: a schedule declaring `auto_apply` with mutating permissions could run and write workspace data immediately, and long-running JavaScript/Python jobs had no cancellation path.

## After change

Schedule permissions are normalized and validated; secret access requires declared secret references; mutating or secret-enabled auto-apply jobs are downgraded to `review_before_apply`. A run can be cancelled through IPC, aborts JavaScript/Python execution, and persists `cancelled` status. Review runs apply actions only through the explicit approval path.

## Verification

Schedule runner/service tests pass, including updated review-before-apply action tests and cancellation-aware runner coverage.
