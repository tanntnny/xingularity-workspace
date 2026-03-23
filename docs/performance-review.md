# Xingularity Performance Review

## Summary

This review combines static inspection with live browser profiling of the renderer running in development mode.

The main conclusion is that the most expensive interaction path is entering the Projects workspace, not the smaller controls inside it. The app also has a broad rerender surface in the renderer root, which likely amplifies the cost of every meaningful state change.

## Profiling Results

### Full trace

Captured against the renderer dev server with Chrome DevTools.

- Renderer URL: `http://localhost:5174/` during the initial trace
- Raw trace: `/tmp/xingularity-trace.json`
- Observed `INP`: `723 ms`
- Observed `LCP`: `480 ms`
- Forced reflow total: `395 ms`
- DOM size during traced interaction: `567` elements
- Large style recalculations: `198 ms` and `176 ms`, affecting about `596` elements

### Measured interaction timings

Measured in-browser with long-task observation and DOM mutation counting.

- `Notes -> Projects`: `236.2 ms`, `21` DOM mutations, `1` long task of `211 ms`
- `Dashboard -> Calendar`: `110.3 ms`, `44` DOM mutations, `1` long task of `102 ms`
- `Dashboard -> Notes`: `107.6 ms`, `9` DOM mutations, `1` long task of `90 ms`
- `Projects -> Dashboard`: `115.9 ms`, `16` DOM mutations, `1` long task of `89 ms`
- `Projects: Due Date sort`: `53.9 ms`, `8` DOM mutations, no long task observed
- `Projects: switch to Project Notes`: `50.0 ms`, `6` DOM mutations, no long task observed
- `Calendar: Next month`: `97.0 ms`, `46` DOM mutations, `1` long task of `84 ms`
- `Calendar: Previous month`: `83.1 ms`, `42` DOM mutations, `1` long task of `56 ms`

## Highest-Confidence Bottlenecks

### 1. Projects page entry/render path

This is the slowest focused interaction that was measured.

- Evidence:
  - `Notes -> Projects` is materially slower than the other page switches.
  - Small interactions inside Projects are much cheaper once the page is mounted.
- Likely causes:
  - Milestone tree sorting, filtering, and remapping in [`src/renderer/src/pages/ProjectDetailsPage.tsx`](../src/renderer/src/pages/ProjectDetailsPage.tsx)
  - Additional sort/filter/split work in [`src/renderer/src/components/ProjectPreviewList.tsx`](../src/renderer/src/components/ProjectPreviewList.tsx)
  - Layout/measurement cost in vendor table/grid code during initial view construction

### 2. Renderer root rerender breadth

The renderer root subscribes to the full Zustand store, so unrelated state updates can fan out through the whole app shell.

- Evidence:
  - [`src/renderer/src/App.tsx`](../src/renderer/src/App.tsx) subscribes with `useVaultStore()` and destructures the entire store payload.
  - `App.tsx` is very large and owns page selection, derived data, and many callbacks.
- Impact:
  - State changes in search, toasts, note content, settings, and calendar tasks can all trigger rerenders of a large root and its descendants.

### 3. FullCalendar event rebuild strategy

The calendar month view rebuilds every event whenever the derived event list changes.

- Evidence:
  - [`src/renderer/src/components/CalendarMonthView.tsx`](../src/renderer/src/components/CalendarMonthView.tsx) calls `removeAllEvents()` and then `addEvent(...)` for the full set.
- Impact:
  - Small task updates cause full event teardown/rebuild instead of targeted updates.

### 4. Repeated full-array derivations in renderer components

Several components do multiple filter/sort/map passes over the same arrays in a single render.

- Main examples:
  - [`src/renderer/src/pages/ProjectDetailsPage.tsx`](../src/renderer/src/pages/ProjectDetailsPage.tsx)
  - [`src/renderer/src/components/CalendarTaskList.tsx`](../src/renderer/src/components/CalendarTaskList.tsx)
  - [`src/renderer/src/components/ProjectPreviewList.tsx`](../src/renderer/src/components/ProjectPreviewList.tsx)
  - [`src/renderer/src/components/CommandPalette.tsx`](../src/renderer/src/components/CommandPalette.tsx)
  - [`src/renderer/src/components/Editor.tsx`](../src/renderer/src/components/Editor.tsx)

## Ranked Remediation Plan

### Priority 1: Narrow store subscriptions in the renderer root

- Replace broad `useVaultStore()` subscription in `App.tsx` with selectors.
- Split state reads by concern so page-local updates do not rerender the whole app shell.
- Expected impact:
  - High
  - Lowers rerender fanout across all pages, not just Projects

### Priority 2: Reduce initial Projects page derivation work

- Collapse repeated milestone transforms into one memoized pipeline.
- Avoid cloning/sorting/filtering the same milestone and subtask trees in separate passes.
- Precompute sidebar project buckets once per project list change instead of re-filtering derived arrays.
- Expected impact:
  - High on Projects page entry
  - Medium on general project interactions

### Priority 3: Replace full calendar event rebuilds with incremental updates

- Stop calling `removeAllEvents()` on every task change.
- Either pass stable event props directly through FullCalendar or diff task changes before applying updates.
- Expected impact:
  - Medium
  - More noticeable as calendar task counts grow

### Priority 4: Pre-index note lookup paths

- Build note maps and normalized-name indexes once per note list change.
- Use those indexes for command palette and editor mention suggestions instead of repeated scans.
- Expected impact:
  - Medium for large vaults
  - Especially useful while typing

### Priority 5: Reduce layout-sensitive UI work in Projects

- Audit table and milestone layout wrappers for width-measurement churn.
- Prefer simpler stable layouts where possible in the Projects detail table.
- Expected impact:
  - Medium
  - This is the most likely app-level lever on the forced reflow seen in the trace

## Suggested Verification After Fixes

- Re-run the same focused interactions:
  - `Notes -> Projects`
  - `Projects -> Dashboard`
  - `Calendar next/previous month`
  - `Projects due-date sort`
- Re-capture a Chrome DevTools trace and compare:
  - `INP`
  - Longest long task
  - Forced reflow time
  - Style recalculation duration
- Success criteria:
  - `Notes -> Projects` comfortably below `150 ms`
  - No single long task above roughly `80-100 ms` in normal page transitions
  - Lower total forced reflow and style recalculation time than the initial trace

## Notes

- This review was done in development mode, so absolute timings are not production timings.
- The rankings should still be directionally correct because the relative costs were consistent across both static inspection and runtime profiling.
