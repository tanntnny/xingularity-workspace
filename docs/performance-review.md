# Xingularity Performance Review

## Scope and current status

This document combines the historical renderer review with the repeatable,
test-only Electron audit harness implemented in
[`scripts/performance-audit.ts`](../scripts/performance-audit.ts). The harness is
macOS-first and supports a generated synthetic vault or an explicitly supplied
sanitized vault. It does not add diagnostics to the product UI or collect user
content in committed files.

Run a short validation with:

```bash
npm run perf:audit:smoke
```

Run the representative baseline with the default 60-second idle windows:

```bash
npm run perf:audit -- --trace
```

Use `--gpu=disabled` for a diagnostic comparison, or
`XINGULARITY_PERF_VAULT_ROOT=/path/to/sanitized-vault` for a provided fixture.
Raw JSON and Chromium traces stay in the system temporary directory. Each run
appends measured results to [`performance-audit-log.md`](performance-audit-log.md).

## Measurement contract

The audit reports separate signals so a high number cannot be mistaken for a
different resource:

| Signal                | What it measures                                       | Limitation                                                      |
| --------------------- | ------------------------------------------------------ | --------------------------------------------------------------- |
| Total CPU             | Sum of Electron process CPU samples                    | A short action is averaged over the sample interval.            |
| Renderer CPU          | CPU from the renderer process PID(s)                   | It does not identify the exact component by itself.             |
| GPU process CPU       | CPU consumed by Chromium's GPU process                 | This is not GPU engine utilization or VRAM pressure.            |
| Hardware acceleration | Electron's reported acceleration state                 | Enabled does not prove that a specific surface is GPU-bound.    |
| GPU feature status    | Chromium feature fallbacks and disabled paths          | It is capability/status evidence, not a utilization percentage. |
| Frame gap             | Longest requestAnimationFrame gap                      | Affected by OS scheduling, tracing, and background load.        |
| Long tasks            | Main-thread tasks over 50 ms                           | Browser-side renderer work only.                                |
| Chromium trace        | GPU/raster/compositor/frame event counts and durations | Tracing adds overhead and should be compared separately.        |
| Working-set memory    | Electron process resident working sets                 | It is not a complete leak or heap-retention proof.              |

The harness intentionally avoids claiming a universal “GPU %”. Chromium and
Electron expose GPU-process CPU and trace evidence, but a reliable engine or
VRAM utilization percentage is hardware/driver-specific. A macOS-specific
native sampler can be added later if that level of fidelity becomes necessary.

## Scenario matrix

The baseline profile measures cold startup and vault activation, 60-second idle
windows on Notes, Projects, Calendar, Schedules, and the editor, navigation,
calendar period changes, command-palette search, long-note input, Knowledge
graph, Sticky Notes, Excalidraw, and an external file-change storm. The smoke
profile uses the same paths with a small fixture and one-second idle windows.

The generated baseline fixture contains 1,000 notes, 100 projects, 2,000
tasks, 100 Sticky Notes, 20 schedules, and one Excalidraw drawing. These values
are intentionally explicit so runs can be compared. The audit log records the
profile and fixture source for every run.

### Observed scale ceiling

On 2026-09-16, the generated baseline fixture did not reach an enabled Notes
sidebar within the 180-second startup bound, even with 500 ms scenario idle
windows used to isolate startup. The failed run is recorded as
`RUN-20260916-171619` in the audit log; it produced no valid interaction or
GPU-utilization measurements. Treat this as a startup/indexing scalability
finding, not as evidence that any individual renderer surface consumes a
specific CPU percentage. Profile vault activation and indexing first, then
repeat the interaction matrix at this scale.

## Historical development-mode baseline

The following measurements were captured before the repeatable harness existed,
against the renderer dev server with Chrome DevTools. They are retained as a
directional historical comparison, not as a production acceptance baseline.

- Renderer URL: `http://localhost:5174/`
- Raw trace: `/tmp/xingularity-trace.json`
- Observed `INP`: `723 ms`
- Observed `LCP`: `480 ms`
- Forced reflow total: `395 ms`
- DOM size during traced interaction: `567` elements
- Large style recalculations: `198 ms` and `176 ms`, affecting about `596` elements

Measured interactions:

- `Notes -> Projects`: `236.2 ms`, `21` DOM mutations, one `211 ms` long task
- `Dashboard -> Calendar`: `110.3 ms`, `44` DOM mutations, one `102 ms` long task
- `Dashboard -> Notes`: `107.6 ms`, `9` DOM mutations, one `90 ms` long task
- `Projects -> Dashboard`: `115.9 ms`, `16` DOM mutations, one `89 ms` long task
- `Projects: Due Date sort`: `53.9 ms`, `8` DOM mutations, no long task observed
- `Projects: open project details`: `50.0 ms`, `6` DOM mutations, no long task observed
- `Calendar: Next month`: `97.0 ms`, `46` DOM mutations, one `84 ms` long task
- `Calendar: Previous month`: `83.1 ms`, `42` DOM mutations, one `56 ms` long task

## Current static findings and confidence

The harness must be used to re-rank these findings before changing behavior.

### PERF-001 — Projects entry/render path

Historical evidence put `Notes -> Projects` above the other focused page
switches, while small interactions inside Projects were cheaper after mount.
Inspect [`ProjectsWorkspacePage.tsx`](../src/renderer/src/pages/ProjectsWorkspacePage.tsx)
and compare `navigation.projects` against the baseline fixture before fixing.

Confidence: medium until reproduced by the production build and representative
fixture.

### PERF-002 — Renderer root rerender breadth

The old review described a broad `useVaultStore()` subscription in
[`App.tsx`](../src/renderer/src/App.tsx). The current source already uses many
selectors, so that statement is stale as written. The remaining risk is the
size of the root and the amount of derived data owned there; verify with the
renderer CPU, frame-gap, and scenario measurements before splitting it.

Confidence: historical finding, requires revalidation.

### PERF-003 — Calendar event update cost

The historical review described a full event rebuild in
[`CalendarMonthView.tsx`](../src/renderer/src/components/CalendarMonthView.tsx).
The current implementation contains incremental add/remove/update logic, so a
blanket replacement is no longer justified. Measure calendar period changes and
task updates first.

Confidence: historical finding, likely superseded by current code.

### PERF-004 — Repeated renderer collection derivations

Projects, calendar task lists, command-palette search, and editor suggestions
still deserve profiling at baseline scale. Optimize only the derivations that
correlate with a measured wall-time, CPU, or long-task regression.

Confidence: medium static signal; impact depends on fixture scale and route.

### PERF-005 — Vault watcher/index reconciliation under external edits

Activation starts notebook, structured-file, and canonical watchers, then
rescans/reconciles and may rebuild the SQLite index. The external file-change
storm is designed to measure CPU, renderer side effects, and settle behavior
before recommending batching or debounce changes.

Confidence: high architectural risk; runtime impact pending baseline data.

## Fix recommendations with tradeoffs

Recommendations are intentionally staged behind measurements. “Feature
behavior” describes what must remain true unless a product decision explicitly
accepts a change.

| ID      | Candidate fix                                                                                                               | Expected benefit                                                                | Pros                                                                  | Cons / feature risk                                                                                            | Behavior policy                                                                                         |
| ------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| FIX-001 | Split page-specific derived data and callbacks out of the renderer root; keep narrow selectors at the boundary.             | Lower rerender fan-out across navigation, search, tasks, and note editing.      | Broad benefit; preserves all surfaces and data.                       | More component boundaries and dependency wiring; incorrect memoization can create stale views.                 | No feature removal. Validate selected note, task, project, and vault transitions.                       |
| FIX-002 | Build memoized/indexed project-task and note lookup projections once per source-list change.                                | Lower Projects entry and command-palette/editor scan cost at large-vault scale. | Keeps current search and linking behavior; predictable CPU reduction. | Extra memory and invalidation rules; indexes must reflect external edits.                                      | No feature removal. Preserve fuzzy search, body search, backlinks, and external refresh.                |
| FIX-003 | Keep FullCalendar updates incremental and profile the remaining conversion/layout work before changing it.                  | Lower calendar update cost without reintroducing full event teardown.           | Current behavior already avoids the historical blanket rebuild.       | More diff complexity if expanded; stale event IDs could lose visible tasks.                                    | Preserve drag, resize, recurrence, filters, and month/week views. Roll back on event parity failures.   |
| FIX-004 | Batch or debounce external watcher reconciliation and coalesce index rebuild requests.                                      | Lower CPU and disk churn during edit storms and large vault activation.         | Targets background work directly; can improve battery life.           | Delayed freshness, more complex conflict timing, and possible transient stale search results.                  | No data loss or conflict suppression. Define a maximum freshness window and keep recovery records.      |
| FIX-005 | Pause or reduce simulation/render work when Knowledge, Sticky Notes, or Excalidraw is hidden; cap work for offscreen items. | Lower idle CPU and frame pressure from graphics-heavy surfaces.                 | Improves background battery usage while preserving visible behavior.  | Re-entry may need a short warm-up; viewport/selection continuity must be preserved.                            | Preserve graph layout, note positions, drawing state, and interaction fidelity.                         |
| FIX-006 | Replace fixed five-second polling with event-driven refresh or adaptive backoff where the API contract allows.              | Lower idle CPU and wakeups on Schedules and review counts.                      | Directly improves long idle windows; fewer unnecessary IPC calls.     | Slower detection if events are missed; requires a reliable invalidation signal.                                | Preserve freshness guarantees; do not remove automatic updates without an explicit product decision.    |
| FIX-007 | Use `--disable-gpu` only as a diagnostic or compatibility fallback, never as the default optimization.                      | Can isolate driver/renderer issues on problematic hardware.                     | Simple rollback and useful A/B diagnosis.                             | Moves compositing/raster work to CPU; may degrade Excalidraw, React Flow, canvas, scrolling, and battery life. | No default feature change. Keep normal acceleration as the primary path and document fallback symptoms. |

## Acceptance and rollback policy

Before implementing a fix, record a baseline run with the same build, profile,
GPU mode, and idle duration. After the change, compare the same scenario IDs and
also run feature parity checks for the affected surface. A fix is not accepted
because one wall-time number improves if CPU, frame gaps, memory, search
freshness, or data integrity regresses materially.

Rollback the change when it removes a user-visible feature, delays external
edits beyond the declared freshness window, drops calendar/task/note events,
breaks graph or canvas interaction, or shifts work from GPU to CPU without a
measured user benefit. Keep raw traces outside Git and append the measured
decision to [`performance-audit-log.md`](performance-audit-log.md).

## Related technical references

- [Electron `app.getAppMetrics()`](https://www.electronjs.org/docs/latest/api/app)
- [Electron process metrics](https://www.electronjs.org/docs/latest/api/structures/process-metric)
- [Electron content tracing](https://www.electronjs.org/docs/latest/api/content-tracing)
- [Chrome DevTools Performance panel](https://developer.chrome.com/docs/devtools/performance/reference)
