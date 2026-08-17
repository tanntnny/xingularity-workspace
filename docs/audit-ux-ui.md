# UX/UI Audit and Consistency Roadmap

> Living audit for making Xingularity easier to use, easier to extend, and harder to make inconsistent.

## Audit status

* **Status:** audit baseline and implementation backlog

* **Baseline:** current working tree inspected on 2026-08-17; the repository contains unrelated uncommitted changes, so findings describe the current tree rather than `HEAD`.

* **Scope:** Electron renderer UX/UI, interaction behavior, accessibility, responsive behavior, motion, feedback, and the design-system workflow that supports them.

* **Primary user model:** power-user speed with stronger discoverability and recovery for newer users.

* **Responsive target:** desktop-first, with deliberate behavior for narrow resizable windows. Mobile parity is not a requirement for this audit.

* **Motion direction:** expressive when it communicates state, continuity, hierarchy, or product personality; never at the cost of accessibility, input latency, or task clarity.

* **Document owner:** renderer/design-system maintainers.

This document is intentionally broader than a visual polish list. A UI change is successful only when it improves the user’s ability to understand what is happening, complete the task, recover from failure, and predict how the same interaction behaves elsewhere in the app.

## Executive summary

### What is already working

* The renderer has an app-owned primitive layer in [`src/renderer/src/components/ui`](../src/renderer/src/components/ui) and workspace composition helpers in [`src/renderer/src/components/workspace`](../src/renderer/src/components/workspace).

* The shell already centralizes important behaviors: sidebar navigation, workspace tabs, command palette access, right-panel resizing, focus mode, and keyboard shortcuts.

* Semantic theme tokens, Inter, control dimensions, surface radii, and motion durations are defined centrally in [`main.css`](../src/renderer/src/assets/main.css).

* The app has reusable dialog, drawer, menu, field, empty-state, table, tooltip, drag/drop, and workspace primitives instead of relying exclusively on page-local markup.

* Existing tests cover meaningful workflows including notes, projects, calendar drag/drop, right-panel resizing, sidebar resizing, settings, subscriptions, scheduling, Excalidraw, and vault gating.

* The design-audit page provides a useful foundation for turning design-system contracts into visible specimens and test fixtures.

### Systemic risks

1. **The source-of-truth story is contradictory.** The design-system overview calls the workspace package the reusable source while also calling the renderer files the live reference. The synchronization script compares renderer files against the package, and the agent guide tells consumers to copy renderer files. This is maintainable only while every contributor already knows the unwritten direction of change.
2. **Shared primitives exist, but page-local interaction styling still varies.** Controls use a mixture of shared variants, raw native elements, custom rounded classes, hardcoded heights, and one-off state treatments. This makes consistency regressions likely even when the right primitive already exists.
3. **The shell is optimized for desktop density but has several fixed or minimum widths.** Tabs, panels, capture columns, property rows, tables, and action groups can compete for space at the compact-layout breakpoint around 1024px and below.
4. **Feedback is available but not yet a complete product contract.** `pushToast(kind, message)` is widely used, while loading, pending, error recovery, inline validation, live announcements, undo, and mutation ownership vary by workflow.
5. **Motion foundations are ahead of motion governance.** The app has duration/easing tokens, multiple CSS motion classes, staggered reveals, panel transitions, and reduced-motion rules, but it still needs a clear motion taxonomy and a way to prevent page-local transitions from bypassing it.
6. **The audit and test surfaces are stronger for behavior than for visual regression.** Existing e2e tests verify many interactions and computed styles, but there is no shared visual-state matrix covering narrow windows, dark mode, reduced motion, long content, loading, error, and empty states across routes.

No P0 blocker is assigned from static inspection alone. P0 status must be confirmed through a reproducible runtime failure, accessibility failure, data-loss risk, or an interaction that prevents recovery. The P1 items below are the highest-leverage work visible from the codebase.

## How to use this document

### Finding schema

Every backlog item uses a stable `UXUI-###` identifier and should remain traceable when implementation moves across files.

* **Type:** `defect`, `consistency`, `opportunity`, or `dependency`.

* **Scope:** `foundation`, `shell`, `component`, `route`, or `workflow`.

* **Owner:** `tokens`, `primitive`, `workspace-shell`, `domain-component`, `page`, `test`, or `docs/governance`.

* **Evidence:** source path plus component/symbol, existing test, or reproducible runtime scenario.

* **User impact:** what becomes faster, clearer, safer, more accessible, or more recoverable.

* **Priority:** P0 blocker, P1 foundational, P2 important, or P3 enhancement.

* **Recommendation:** the intended behavior or architecture.

* **Dependencies:** work that must land first.

* **Acceptance:** observable result, not an implementation detail.

* **Verification:** static check, unit test, targeted e2e, manual keyboard check, visual check, or performance check.

* **Status:** `open`, `planned`, `in progress`, `verified`, or `deferred`.

All findings in this document start with status `open` unless a later implementation note changes that status.

### Priority model

* **P0 — blocker:** broken, unsafe, inaccessible, data-loss-prone, or recovery-hostile behavior.

* **P1 — foundational:** a shared-layer problem that affects multiple pages, a common accessibility failure, a responsive shell failure, or a missing state contract.

* **P2 — important:** page-level usability, hierarchy, consistency, and discoverability improvements.

* **P3 — enhancement:** expressive motion, richer polish, or higher-effort opportunities that have a clear user benefit after foundations are stable.

Priority is not effort. A high-effort source-of-truth or responsive-shell fix can be P1 when it removes repeated future work.

### Audit method

For each affected surface, review:

1. Primary task and information hierarchy.
2. Shared primitive and shell ownership.
3. Initial loading, refresh, pending, empty, no-results, validation, error, success, destructive, unavailable, and overflow states.
4. Pointer, keyboard, focus, semantic HTML, labels, descriptions, live announcements, and color independence.
5. Desktop, compact, long-content, zoom/text-scaling, light, dark, and reduced-motion behavior.
6. Motion purpose, continuity, interruptibility, timing, and performance.
7. Existing tests and the smallest durable test that would prevent regression.

Static findings are explicitly marked as such. A runtime check must be added before closing any finding that depends on measured contrast, layout, animation smoothness, focus order, or screen-reader output.

## Design-system foundation audit

### Source of truth and ownership

**UXUI-001 — P1 · dependency · docs/governance**

* **Finding:** The reusable package, renderer copy, and documentation do not describe one unambiguous direction of change.

* **Evidence:** [`docs/design-system/overview.md`](design-system/overview.md) describes [`packages/workspace-template`](../packages/workspace-template) as the reusable source while calling renderer files the live reference. [`docs/design-system/agent-workspace-template.md`](design-system/agent-workspace-template.md) tells agents to copy renderer CSS and primitives. [`scripts/verify-workspace-template-sync.cjs`](../scripts/verify-workspace-template-sync.cjs) compares renderer files against the package.

* **Recommendation:** Declare `packages/workspace-template` the canonical reusable source for shared tokens and primitives, declare renderer files the application copy, and require the existing sync check after shared changes. Keep app-only composition and behavior in the renderer.

* **Acceptance:** The overview, agent guide, package README, and contributor checklist all state the same direction; a contributor can identify where to edit and which command verifies parity without inference.

* **Verification:** Documentation review plus `npm --workspace @xingularity/workspace-template run verify:renderer-sync` after the ownership wording is updated.

**UXUI-002 — P1 · dependency · docs/governance**

* **Finding:** Shared UI changes can be made without a documented decision record for whether a new token, primitive variant, domain component, or page-local composition is appropriate.

* **Evidence:** The repository has migration guidance, but no single contribution template links a finding to an owner, acceptance criteria, and parity verification.

* **Recommendation:** Add the contribution checklist in this document to the design-system docs and pull-request template when implementation begins.

* **Acceptance:** Every UI change records the chosen ownership layer, affected states, responsive behavior, motion behavior, and verification command.

* **Verification:** Review one subsequent UI change against the checklist.

### Tokens, typography, surfaces, and density

**UXUI-003 — P1 · consistency · tokens**

* **Finding:** The token layer defines control height, font size, icon size, control padding, button radius, and pill radius, but page code frequently overrides height, padding, radius, and text size locally.

* **Evidence:** [`main.css`](../src/renderer/src/assets/main.css) defines `--control-height`, `--control-font-size`, `--control-icon-size`, `--control-padding-x`, `--radius-button`, and `--radius-control`. Page/component code uses recurring combinations such as `h-7`, `h-8`, `rounded-md`, `rounded-lg`, `rounded-[var(--radius-button-pill)]`, and bespoke `px` values.

* **Recommendation:** Define explicit density tiers and semantic variants for compact controls, standard controls, icon controls, tags, and display-only badges. Replace repeated page-local combinations with variants or composed primitives.

* **Acceptance:** A reviewer can identify the intended density and radius from a shared variant; new pages do not need to reconstruct control geometry from utility strings.

* **Verification:** Static search for repeated one-off control combinations plus design-audit specimens at each density.

**UXUI-004 — P1 · consistency · tokens**

* **Finding:** Surface hierarchy is expressed through several overlapping concepts: app background, workspace background, card, popover, panel border, border, muted, and page-local background variables.

* **Evidence:** [`main.css`](../src/renderer/src/assets/main.css) defines multiple surface and border tokens, while capture groups, calendar task types, tags, and scheduling surfaces add domain-specific color variables.

* **Recommendation:** Document the surface ladder and when to use each token: application chrome, workspace canvas, raised card, floating content, selected state, disabled state, and status state. Keep domain colors semantic and ensure they have foreground/border variants.

* **Acceptance:** A page author can choose a surface by semantic role rather than palette intuition; dark-mode equivalents exist for every reusable status token.

* **Verification:** Light/dark specimen review and contrast checks for foreground, border, selected, hover, and disabled states.

**UXUI-005 — P1 · consistency · tokens**

* **Finding:** The app-wide Inter rule is present, but typography hierarchy is still frequently assembled with page-local combinations instead of a named type scale.

* **Evidence:** [`main.css`](../src/renderer/src/assets/main.css) defines the app font; pages use combinations ranging from `text-xs` through `text-4xl` with local weight, line-height, and tracking choices.

* **Recommendation:** Define semantic styles for page title, section title, body, metadata, label, helper/error text, code, and compact navigation. Keep monospace confined to code/terminal content.

* **Acceptance:** Heading and metadata hierarchy remains consistent across settings, projects, notes, calendar, scheduling, and subscription surfaces, including long labels.

* **Verification:** Design-audit typography specimens plus route review at 100% and enlarged text/zoom.

**UXUI-006 — P1 · accessibility/consistency · tokens**

* **Finding:** Status, task type, tag, calendar, and chart colors carry meaning that can be lost when color contrast, dark-mode values, or non-color indicators drift.

* **Evidence:** [`main.css`](../src/renderer/src/assets/main.css) contains separate light/dark status, tag, calendar-task, and chart tokens; many domain components display compact colored badges.

* **Recommendation:** Pair every meaningful color with text, icon, pattern, label, or state attribute. Add a token contract for minimum contrast and a visible selected/disabled/error treatment independent of hue.

* **Acceptance:** A user can distinguish status, priority, task type, and selection without relying on color alone.

* **Verification:** Contrast audit, grayscale/manual color-independence review, and accessibility assertions for representative badges.

### Primitive architecture and reusable controls

**UXUI-007 — P1 · consistency · primitive**

* **Finding:** Raw native controls and custom buttons remain inside feature components even where app-owned primitives exist.

* **Evidence:** [`TaskContextMenu.tsx`](../src/renderer/src/components/TaskContextMenu.tsx) contains raw inputs; [`ProjectIconPicker.tsx`](../src/renderer/src/components/ProjectIconPicker.tsx), [`TaskPropertiesPanel.tsx`](../src/renderer/src/components/TaskPropertiesPanel.tsx), and other domain components contain page-local buttons and control classes; [`components/ui`](../src/renderer/src/components/ui) already exports `Input`, `Button`, `Field`, `Select`, `ToggleGroup`, `Dialog`, `Drawer`, and `ButtonGroup`.

* **Recommendation:** Audit each raw control. Replace it with a shared primitive when the interaction is common; retain native semantics only when the primitive would obscure the document or platform behavior. Add missing low-level variants instead of repeating CSS.

* **Acceptance:** Shared controls have consistent height, radius, focus, disabled, error, and pending behavior; remaining native controls are documented as intentional.

* **Verification:** Static inventory of native controls and targeted component tests for the converted interactions.

**UXUI-008 — P1 · consistency · primitive**

* **Finding:** Icon-only actions are generally routed through `WorkspaceIconButton`, but icon actions in feature components still need a systematic audit for target size, tooltip behavior, title quality, and placement.

* **Evidence:** [`document-workspace.tsx`](../src/renderer/src/components/ui/document-workspace.tsx) exports `WorkspaceIconButton`; the app shell uses it extensively, while feature components also define raw icon buttons with local classes.

* **Recommendation:** Make `WorkspaceIconButton` the shared contract for top-bar and workspace chrome actions. Define when a tooltip is required, how `aria-label` and `title` are authored, and the minimum pointer/keyboard target.

* **Acceptance:** Every icon-only action has a meaningful accessible name, visible focus, consistent target geometry, and discoverable hover/focus help where the icon is not self-evident.

* **Verification:** Static search plus keyboard/tooltip checks for every shell action group.

**UXUI-009 — P1 · consistency · primitive**

* **Finding:** Dialog, drawer, popover, menu, and context-menu compositions are available, but widths, footer actions, close affordances, and mobile behavior vary by feature.

* **Evidence:** [`dialog.tsx`](../src/renderer/src/components/ui/dialog.tsx), [`drawer.tsx`](../src/renderer/src/components/ui/drawer.tsx), and [`alert-dialog.tsx`](../src/renderer/src/components/ui/alert-dialog.tsx) provide shared shells; task editing, subscriptions, exports, reminders, and scheduling compose them with different local widths and footers.

* **Recommendation:** Define overlay intent contracts: `Dialog` for focused tasks, `AlertDialog` for destructive confirmation, `Drawer/Sheet` for secondary edge-attached work, and `Popover` for lightweight anchored controls. Add shared footer/action recipes and compact-width rules.

* **Acceptance:** Overlays have consistent title/description, close behavior, focus return, action ordering, scroll handling, and narrow-window sizing.

* **Verification:** Targeted keyboard and focus tests for each overlay family.

**UXUI-010 — P1 · accessibility · primitive**

* **Finding:** Field, label, and error primitives exist, but form semantics are not yet a guaranteed contract for page-local forms and compact property editors.

* **Evidence:** [`field.tsx`](../src/renderer/src/components/ui/field.tsx) exists; settings, subscriptions, task properties, reminders, scheduling, and export flows mix shared fields with local labels, raw inputs, and inline errors.

* **Recommendation:** Standardize label, description, validation error, required, disabled, read-only, and `aria-describedby` composition. Prefer a single `Field` recipe for all application forms.

* **Acceptance:** Every form control has an associated label; validation errors are attached to the control and announced without replacing useful helper text.

* **Verification:** Keyboard and accessibility-tree review of settings, subscription drawer, task editor, scheduling editor, and export dialog.

**UXUI-011 — P1 · consistency · primitive**

* **Finding:** Empty-state support exists, but loading, no-results, unavailable, and recoverable-error states do not have an equally strong shared composition contract.

* **Evidence:** [`empty-state.tsx`](../src/renderer/src/components/ui/empty-state.tsx) exports `EmptyState`; [`SidebarMenuSkeleton`](../src/renderer/src/components/ui/sidebar.tsx) exists, while pages use a mixture of text, ad hoc spinners/labels, `isLoading` branches, and toasts.

* **Recommendation:** Add a shared state composition policy, with reusable loading skeleton, inline alert, retry action, no-results, and permission/unavailable variants where repeated patterns justify primitives.

* **Acceptance:** Every async surface can express initial loading, background refresh, empty, no-results, error with recovery, and success without layout jumps or ambiguous blank space.

* **Verification:** State matrix across routes; targeted component tests for shared state variants.

**UXUI-012 — P1 · safety · primitive**

* **Finding:** Destructive confirmation is split between shared `AlertDialog` and native `window.confirm`.

* **Evidence:** [`ProjectsWorkspacePage.tsx`](../src/renderer/src/pages/ProjectsWorkspacePage.tsx) and [`App.tsx`](../src/renderer/src/App.tsx) call `window.confirm`; shared alert-dialog primitives already exist.

* **Recommendation:** Move user-facing destructive confirmations to the app-owned `AlertDialog` contract, with explicit consequence text, cancel-first keyboard behavior, focus return, and pending state.

* **Acceptance:** Destructive actions have consistent copy, focus behavior, Escape handling, and cannot be double-submitted while pending.

* **Verification:** Targeted e2e for project, note, task, drawing, vault, and migration destructive flows.

**UXUI-013 — P2 · consistency · primitive**

* **Finding:** Buttons, toggles, selection chips, tabs, badges, and action groups can visually resemble one another while carrying different semantics.

* **Evidence:** [`button.tsx`](../src/renderer/src/components/ui/button.tsx), [`toggle-group.tsx`](../src/renderer/src/components/ui/toggle-group.tsx), [`selective-chip.tsx`](../src/renderer/src/components/ui/selective-chip.tsx), [`button-group.tsx`](../src/renderer/src/components/ui/button-group.tsx), and scheduling tabs each define overlapping compact interaction language.

* **Recommendation:** Document semantic selection rules: `Button` for actions, `ToggleGroup` for mutually exclusive view state, `Checkbox/Switch` for independent boolean state, `Tabs` for page/subview navigation, and chips for filters or removable values.

* **Acceptance:** A user can predict whether clicking a control performs an action, changes persistent state, filters content, or navigates.

* **Verification:** Interaction review and ARIA-state assertions for projects, calendar filters, scheduling tabs, settings, and tags.

**UXUI-014 — P2 · maintainability · component**

* **Finding:** Large shared files can make unrelated changes difficult to reason about and increase the cost of preserving consistency.

* **Evidence:** [`document-workspace.tsx`](../src/renderer/src/components/ui/document-workspace.tsx) contains shell context, tabs, panel composition, headers, actions, and exports; [`App.tsx`](../src/renderer/src/App.tsx) contains global state orchestration and many workflow handlers.

* **Recommendation:** Do not split by file size alone. Extract only stable contracts with one responsibility: shell context, header action groups, overlay policy, feedback orchestration, and page routing/state adapters.

* **Acceptance:** Shared primitives remain composable and feature-independent; domain mutations do not leak into generic UI components.

* **Verification:** Typecheck and targeted tests after each extraction; no behavior change in existing shell e2e tests.

## Shell and navigation audit

**UXUI-015 — P1 · responsive · workspace-shell**

* **Finding:** The shell has several fixed or minimum-width regions that need an explicit compact-window strategy.

* **Evidence:** [`main.css`](../src/renderer/src/assets/main.css) defines `--workspace-pane-width: 300px`, `--drawer-width: 640px`, and workspace chrome dimensions. [`document-workspace.tsx`](../src/renderer/src/components/ui/document-workspace.tsx) uses fixed tab widths and panel basis values. [`platform/index.ts`](../src/renderer/src/platform/index.ts) detects a compact layout at roughly 1024px.

* **Recommendation:** Define shell breakpoints by available content width, not only viewport width. Collapse secondary panels into a drawer/sheet when necessary, preserve the active task context, and keep primary actions reachable without horizontal scrolling.

* **Acceptance:** At 1440px, 1024px, and an 800px stress viewport, the active page retains a readable main region, no unintended page-level horizontal overflow appears, and every hidden panel has an obvious open path.

* **Verification:** Targeted Playwright viewport matrix plus keyboard-only panel open/close checks.

**UXUI-016 — P1 · responsive · workspace-shell**

* **Finding:** Top-bar breadcrumb, secondary actions, tabs, filters, and icon actions can compete for a single horizontal row.

* **Evidence:** [`document-workspace.tsx`](../src/renderer/src/components/ui/document-workspace.tsx) uses `min-w-max` action groups and horizontal overflow; [`App.tsx`](../src/renderer/src/App.tsx) composes page-specific secondary action groups in the shell header.

* **Recommendation:** Establish an action priority order: navigation/context, primary task action, secondary filters, and overflow. Allow secondary actions to wrap or move into an overflow menu at compact widths while preserving keyboard access.

* **Acceptance:** Long page names and multiple filters do not push the primary action off-screen or create ambiguous clipped controls.

* **Verification:** Long-label fixtures for notes, projects, scheduling, and calendar at compact widths.

**UXUI-017 — P1 · interaction · workspace-shell**

* **Finding:** Workspace tab behavior is feature-rich but needs a durable contract for close, restore, add, selection, keyboard shortcuts, overflow, and unsaved content.

* **Evidence:** [`document-workspace.tsx`](../src/renderer/src/components/ui/document-workspace.tsx) implements tab manager behavior; [`App.tsx`](../src/renderer/src/App.tsx) wires tab lifecycle and note/task state; e2e note tests cover tab visibility and note save behavior.

* **Recommendation:** Document tab state transitions and make dirty/save status, close confirmation, active-tab restoration, and overflow discoverable.

* **Acceptance:** Closing, switching, reopening, and adding tabs never loses pending note/task work and remains operable without a pointer.

* **Verification:** Targeted e2e for clean, dirty, loading, failed-save, and long-label tabs.

**UXUI-018 — P1 · accessibility · workspace-shell**

* **Finding:** Global shortcut handling is centralized, but the interaction contract for editing contexts, dialogs, menus, and native controls needs explicit guardrails.

* **Evidence:** [`useWorkspaceShellShortcuts.ts`](../src/renderer/src/hooks/useWorkspaceShellShortcuts.ts) and multiple App-level keydown listeners capture keyboard events; the app contains editors, forms, command palette, menus, and dialogs.

* **Recommendation:** Define which shortcuts are global, which are suppressed while typing, how conflicts are surfaced, and how every shortcut has a discoverable command-palette entry or help surface.

* **Acceptance:** Shortcuts never hijack text editing, Vim mode, code editing, menu navigation, or form submission; Escape and focus return behave consistently.

* **Verification:** Keyboard matrix across shell, note editor, scheduling code editor, dialogs, and command palette.

**UXUI-019 — P2 · discoverability · workspace-shell**

* **Finding:** Important shell actions can be icon-only or hidden behind hover/menus, which favors existing power users over discoverability.

* **Evidence:** [`AppSidebar.tsx`](../src/renderer/src/components/AppSidebar.tsx), [`TopBar.tsx`](../src/renderer/src/components/TopBar.tsx), and [`App.tsx`](../src/renderer/src/App.tsx) expose vault, palette, note, backlink, export, favorite, panel, and page actions through compact icon controls.

* **Recommendation:** Pair repeated icon actions with consistent tooltips, command labels, and visible overflow affordances. Keep density for experts but expose intent on hover, focus, and command search.

* **Acceptance:** A first-time user can discover the purpose of each visible icon without guessing, while keyboard users can reach the same action.

* **Verification:** Tooltip/command-palette review and accessible-name assertions.

**UXUI-020 — P2 · navigation · workspace-shell**

* **Finding:** Breadcrumbs and page headers are composed in the app root, while some pages also create their own navigation patterns.

* **Evidence:** [`App.tsx`](../src/renderer/src/App.tsx) owns route-level breadcrumbs and page actions; scheduling has [`SchedulingBreadcrumb.tsx`](../src/renderer/src/components/scheduling/SchedulingBreadcrumb.tsx); notes, tasks, projects, and scheduling have different context depth.

* **Recommendation:** Define a breadcrumb policy for page, collection, object, and current location. Use links/buttons for navigable ancestors and plain text for the current location.

* **Acceptance:** Context is understandable at every depth and long names truncate without removing the back path.

* **Verification:** Route-by-route heading and breadcrumb review with long project/note/task names.

## Feedback, state, and recovery audit

**UXUI-021 — P1 · feedback · test**

* **Finding:** Toast feedback is centralized through a string-based store, but its semantics, duration, deduplication, persistence, and action affordances are not standardized.

* **Evidence:** [`state/store.ts`](../src/renderer/src/state/store.ts) defines `Toast` and `pushToast`; [`SonnerBridge.tsx`](../src/renderer/src/components/SonnerBridge.tsx) renders feedback; [`App.tsx`](../src/renderer/src/App.tsx) and pages call `pushToast` for many unrelated operations.

* **Recommendation:** Define feedback intents: success, progress, warning, recoverable error, blocking error, and informational result. Add structured metadata for action, deduplication key, duration, and related entity where needed.

* **Acceptance:** Repeated operations do not flood the user, success messages identify what changed, errors explain recovery, and important background failures remain visible until addressed.

* **Verification:** Unit tests for toast intent/replacement and targeted e2e for save, import, export, capture, scheduling, and migration flows.

**UXUI-022 — P1 · error recovery · domain-component**

* **Finding:** Many failure paths surface `String(error)` directly, producing inconsistent technical messages and rarely offering retry or next action.

* **Evidence:** Repeated `pushToast('error', String(error))` calls appear in [`App.tsx`](../src/renderer/src/App.tsx), [`SchedulingPage.tsx`](../src/renderer/src/pages/SchedulingPage.tsx), [`ExcalidrawPage.tsx`](../src/renderer/src/pages/ExcalidrawPage.tsx), and related components.

* **Recommendation:** Introduce a small renderer-side error presentation policy that maps known failures to human messages, preserves diagnostic context for logs, and supplies retry/open-settings/undo actions where possible.

* **Acceptance:** User-facing errors are understandable without stack traces and identify the next safe action.

* **Verification:** Failure fixtures for vault, filesystem, schedule, export, AI, and drawing operations.

**UXUI-023 — P1 · pending state · domain-component**

* **Finding:** Pending state is implemented per workflow (`isSaving`, `isRunning`, load flags) with inconsistent disabled controls, labels, and progress visibility.

* **Evidence:** [`SchedulingPage.tsx`](../src/renderer/src/pages/SchedulingPage.tsx), [`SubscriptionsPage.tsx`](../src/renderer/src/pages/SubscriptionsPage.tsx), task dialogs, settings, and note save flows each own pending behavior.

* **Recommendation:** Define a pending contract: disable only conflicting actions, keep navigation safe, change the action label or indicator, announce meaningful progress, and restore focus/state on completion or failure.

* **Acceptance:** Users always know whether an action is queued, running, saved, failed, or still editable; duplicate submissions are prevented.

* **Verification:** Targeted tests with delayed IPC/API responses and retry after failure.

**UXUI-024 — P1 · loading · primitive**

* **Finding:** Loading states can replace content with a label or blank region rather than preserving the final layout.

* **Evidence:** Capture, scheduling, notebook, search, knowledge, and subscription surfaces use page-specific loading branches; shared empty state exists but no shared layout-preserving loading recipe is established.

* **Recommendation:** Add skeleton recipes for lists, panels, forms, tables, editors, and graph canvases. Use a spinner only for short local transitions where a skeleton would add noise.

* **Acceptance:** Loading does not cause avoidable layout shift, and the user can distinguish initial load from background refresh.

* **Verification:** Delayed-load fixtures with layout bounding-box assertions for key surfaces.

**UXUI-025 — P1 · recovery · workflow**

* **Finding:** Destructive and high-cost operations do not consistently offer undo, restore, or a path back to the affected object.

* **Evidence:** App-level note/project/task/drawing operations frequently report success through toast; trash and history services exist in main/shared code, but the renderer feedback contract is not uniform.

* **Recommendation:** Use undo where the underlying service supports it, provide “open/review” actions for created objects, and make destructive result messages name the affected entity.

* **Acceptance:** A user can recover from accidental deletion or quickly verify the result of create/import/export/migration actions.

* **Verification:** Targeted e2e for delete, restore/history, import, export, and conversion flows.

**UXUI-026 — P2 · empty states · primitive**

* **Finding:** Empty states are present but their action hierarchy and copy vary across notes, capture, projects, calendar, scheduling, search, knowledge, subscriptions, and vault gating.

* **Evidence:** [`empty-state.tsx`](../src/renderer/src/components/ui/empty-state.tsx), [`NotebookEmptyState.tsx`](../src/renderer/src/components/NotebookEmptyState.tsx), [`SearchResults.tsx`](../src/renderer/src/components/SearchResults.tsx), and page-specific empty branches.

* **Recommendation:** Define empty-state types: first-use, filtered/no-results, unavailable, completed, and error. Each should state what is empty, why it matters, and the single best next action.

* **Acceptance:** Empty states do not look like broken loading states and offer a relevant next action when one exists.

* **Verification:** Route matrix review with seeded-empty and filtered-empty fixtures.

**UXUI-027 — P2 · autosave · workflow**

* **Finding:** Notes, drawings, projects, tasks, and settings may save at different times and expose different save visibility.

* **Evidence:** Note save coordination, Excalidraw delayed save, inline edits, settings mutations, and project/task persistence are implemented in different components and App handlers.

* **Recommendation:** Define a shared save-status vocabulary and placement: unsaved, saving, saved, failed, and offline/local-only. Keep it subtle for autosave but actionable on failure.

* **Acceptance:** Users do not need to infer persistence from timing or toast history, especially before closing a tab or app.

* **Verification:** Delayed-save, failed-save, tab-close, and relaunch scenarios.

## Motion and feedback choreography audit

**UXUI-028 — P1 · motion · tokens**

* **Finding:** Motion tokens exist, but the codebase also uses local `transition-*`, `duration-*`, `animate-*`, and transform classes that can bypass the shared taxonomy.

* **Evidence:** [`main.css`](../src/renderer/src/assets/main.css) defines motion durations/easing and classes for overlays, drawers, reveals, panels, editors, and calendar events; page/component code adds local transitions such as inline editing and task title changes.

* **Recommendation:** Document motion categories: instant feedback, control state, disclosure, overlay, panel, content entry, drag continuity, and celebration. Require semantic tokens or a named primitive for each.

* **Acceptance:** Every nontrivial animation has a stated purpose and uses a recognized duration/easing category.

* **Verification:** Static motion inventory and design-audit motion specimens.

**UXUI-029 — P1 · accessibility · motion**

* **Finding:** Reduced-motion handling exists in global CSS, but page-local transitions and JavaScript reveal/animation work need a complete audit.

* **Evidence:** [`main.css`](../src/renderer/src/assets/main.css) has `prefers-reduced-motion` rules; [`useStaggeredScrollReveal.ts`](../src/renderer/src/hooks/useStaggeredScrollReveal.ts), calendar animation hooks, inline editing, and local utility transitions can still schedule or render motion independently.

* **Recommendation:** Provide a shared reduced-motion preference hook or CSS contract for JS-driven motion. Skip nonessential reveal work, keep state changes immediate, and preserve focus/visibility cues.

* **Acceptance:** Reduced motion removes nonessential movement across shell, overlays, lists, editor, calendar, and page entry while preserving all information and state feedback.

* **Verification:** Playwright emulation or browser media-query fixture plus computed-style and state assertions.

**UXUI-030 — P2 · motion · workspace-shell**

* **Finding:** Panel and content transitions can animate width, flex-basis, top, left, height, opacity, and transform simultaneously, which risks layout work and visual competition during resize or drag.

* **Evidence:** [`main.css`](../src/renderer/src/assets/main.css) and [`document-workspace.tsx`](../src/renderer/src/components/ui/document-workspace.tsx) define panel transitions; calendar event motion includes geometry transitions and an interaction escape hatch.

* **Recommendation:** Prefer transform/opacity for entrance/exit, reserve layout-property transitions for deliberate spatial continuity, and disable nonessential transitions while resizing or dragging. Define a motion budget for large lists and calendars.

* **Acceptance:** Resize and drag interactions remain immediate; motion never delays direct manipulation or causes visible jank.

* **Verification:** Performance trace and targeted resize/drag e2e with reduced-motion comparison.

**UXUI-031 — P2 · motion · domain-component**

* **Finding:** The app has opportunities for richer expressive feedback around capture, conversion, task completion, saves, tab changes, panel changes, and graph updates, but no shared choreography rules.

* **Evidence:** Existing motion classes include staggered reveals, workspace content entry, editor readiness, calendar events, and overlay transitions; many mutation handlers only emit a toast.

* **Recommendation:** Add motion only where it explains continuity or completion: captured item enters its group, converted item transitions to its destination, completed task resolves visually, saved content settles, and panel context remains anchored during transitions.

* **Acceptance:** Each expressive animation has a nonanimated equivalent, does not compete with reading/editing, and is interruptible by the next user action.

* **Verification:** Manual motion review plus reduced-motion and rapid-repeat interaction tests.

**UXUI-032 — P3 · motion · design-system**

* **Finding:** The sidebar brand shimmer is a personality detail but is continuously animated in the shell.

* **Evidence:** [`main.css`](../src/renderer/src/assets/main.css) defines `.sidebar-brand-shimmer` with a 4.5-second infinite animation and a reduced-motion fallback.

* **Recommendation:** Keep only if user testing supports the personality benefit; otherwise make it opt-in, less frequent, or static after initial entry. Avoid adding ambient motion elsewhere until this baseline is intentional.

* **Acceptance:** Ambient motion is scarce, non-distracting, disabled by reduced-motion, and does not increase perceived load.

* **Verification:** Manual focus/reading test and reduced-motion check.

## Responsive and layout audit

### Shared responsive contract

**UXUI-033 — P1 · responsive · workspace-shell**

* **Finding:** The app detects compact layout near 1024px, but responsive behavior is not expressed as one documented hierarchy of collapse, wrap, scroll, or alternate composition.

* **Evidence:** [`platform/index.ts`](../src/renderer/src/platform/index.ts) exposes compact-layout detection; feature code independently uses `sm:`, `md:`, `lg:`, `min-w-max`, `overflow-x-auto`, fixed widths, and page-specific stacking.

* **Recommendation:** Define a responsive decision table: what stays visible, what wraps, what scrolls, what collapses, and what becomes a drawer at each available-width tier. Prefer container capability over route-specific viewport guesses.

* **Acceptance:** New pages can select a documented layout recipe without inventing breakpoint behavior.

* **Verification:** Route matrix at 1440x960, 1024x768, and 800x600 stress size.

**UXUI-034 — P1 · responsive · component**

* **Finding:** Fixed and minimum-width content can create intentional local scrolling but also accidental page-level overflow.

* **Evidence:** Capture uses a four-column `min-w-[64rem]` board; project/task property rows use `w-max min-w-full`; shell actions and tabs use `min-w-max`; scheduling, code, tables, and calendar surfaces have independent overflow rules.

* **Recommendation:** Classify every overflow as `content-scroll`, `control-scroll`, `table-scroll`, or a bug. Add a visible affordance for intentional horizontal scrolling and prevent nested scroll traps.

* **Acceptance:** Horizontal scrolling occurs only within the surface that owns it; the page itself remains navigable and primary actions remain reachable.

* **Verification:** Bounding-box/scroll-width assertions at compact widths and long-label fixtures.

**UXUI-035 — P1 · responsive · primitive**

* **Finding:** Secondary desktop panels need a consistent narrow-window conversion pattern.

* **Evidence:** The shell has right-panel collapse and drawer primitives; projects, notes, calendar, knowledge, scheduling, and subscriptions use different combinations of persistent panels and drawers.

* **Recommendation:** Define a `WorkspaceSidePanel` responsive recipe with a desktop persistent state, compact overlay/drawer state, focus return, preserved scroll/selection, and an explicit open control.

* **Acceptance:** A compact user can access list, properties, outline, filters, and history panels without losing the current object or scroll position.

* **Verification:** Targeted e2e for projects, notes, calendar, knowledge, scheduling, and subscriptions.

**UXUI-036 — P2 · responsive · component**

* **Finding:** Tables and dense property grids need deliberate prioritization at narrow widths.

* **Evidence:** [`SubscriptionsPage.tsx`](../src/renderer/src/pages/SubscriptionsPage.tsx) renders a data table and a drawer form; project/task properties use multiple fixed-width selects and compact rows; settings uses multi-column mapping rows.

* **Recommendation:** Keep semantic tables, define the minimum readable column set, permit contained horizontal scroll when needed, and move secondary metadata/actions into row details or an overflow menu.

* **Acceptance:** No critical identity, status, amount, or action is silently clipped at compact widths.

* **Verification:** Narrow-width table tests with long names, large amounts, empty values, and error states.

**UXUI-037 — P2 · responsive · page**

* **Finding:** Long labels, paths, note titles, project names, tags, error messages, and code lines are handled inconsistently through truncation, wrapping, or scrolling.

* **Evidence:** Many components use `truncate`, `max-w-*`, `break-words`, `whitespace-nowrap`, and local overflow rules; note, task, schedule, and subscription surfaces contain user-controlled long text.

* **Recommendation:** Define per-content rules: identity text may truncate with a full-name affordance, descriptions wrap, code scrolls within its surface, and errors wrap with recovery actions.

* **Acceptance:** Long content never hides the primary action or causes a layout collapse; truncated content remains recoverable.

* **Verification:** Synthetic long-content fixtures and text-scaling/zoom review.

**UXUI-038 — P2 · responsive · page**

* **Finding:** Capture’s four-column review board is optimized for a wide desktop and needs a compact review strategy.

* **Evidence:** [`CapturePage.tsx`](../src/renderer/src/pages/CapturePage.tsx) renders a `min-w-[64rem]` four-column board with independent column scroll areas.

* **Recommendation:** Preserve the board for wide windows, then use a horizontal board with clear scroll affordance or a single-column grouped review mode below the compact threshold. Keep conversion and removal actions reachable.

* **Acceptance:** Capture review remains understandable and actionable without requiring the user to discover an invisible wide canvas.

* **Verification:** Capture e2e at all responsive anchors with seeded notes and long content.

**UXUI-039 — P2 · responsive · page**

* **Finding:** Calendar views combine fixed time grids, drag handles, filters, and task cards, making narrow-window behavior a high-risk area.

* **Evidence:** [`CalendarDayView.tsx`](../src/renderer/src/components/CalendarDayView.tsx), [`CalendarWeekView.tsx`](../src/renderer/src/components/CalendarWeekView.tsx), [`CalendarMonthView.tsx`](../src/renderer/src/components/CalendarMonthView.tsx), and calendar drag tests.

* **Recommendation:** Define narrow behavior per view: preserve time-axis readability, keep the current-day/navigation controls visible, provide a list/agenda fallback where a grid becomes unusable, and retain keyboard alternatives for drag operations.

* **Acceptance:** A narrow user can inspect, create, reschedule, resize, and complete a task without precision-pointer-only requirements.

* **Verification:** Existing calendar e2e plus compact viewport and keyboard scenarios.

## Accessibility and input audit

**UXUI-040 — P1 · accessibility · primitive**

* **Finding:** The codebase has many good accessible names and test IDs, but there is no route-wide assertion for landmarks, heading hierarchy, visible focus, or dialog focus return.

* **Evidence:** Existing e2e tests assert headings, roles, `aria-expanded`, `aria-checked`, and labels in selected flows; the app contains many nested page compositions and overlays.

* **Recommendation:** Add a reusable accessibility smoke checklist and targeted assertions for one representative route in each page family. Do not rely on automated scans alone.

* **Acceptance:** Each route has one meaningful main landmark, a logical heading order, visible keyboard focus, labeled controls, and predictable overlay focus entry/return.

* **Verification:** Keyboard-only manual pass plus automated accessibility checks if the test stack supports them.

**UXUI-041 — P1 · accessibility · workflow**

* **Finding:** Drag/drop interactions are visually rich but need an equivalent keyboard and non-drag path everywhere they change order, date, tree location, or size.

* **Evidence:** [`drag-source.tsx`](../src/renderer/src/components/ui/drag-source.tsx), note-tree drag tests, calendar drag tests, and calendar resize handles.

* **Recommendation:** Every drag action must have a command/menu or keyboard operation with the same result and an announced destination/validation outcome. Resize handles need keyboard increments and visible value feedback.

* **Acceptance:** A keyboard user can move notes/tasks and adjust calendar durations without pointer dragging.

* **Verification:** Keyboard e2e for note tree, calendar move/resize, and project/task ordering.

**UXUI-042 — P1 · accessibility · feedback**

* **Finding:** Important status changes may be visible only through color, visual movement, or transient toast.

* **Evidence:** Task status/type badges, calendar task cards, tag chips, scheduling run status, and editor/Vim indicators use compact visual state; only selected components explicitly use `aria-live` or `role="alert"`.

* **Recommendation:** Define which state changes require live announcement, inline text, focus movement, or toast. Avoid announcing every visual update, but announce completion/failure and destination changes that affect task context.

* **Acceptance:** Screen-reader and keyboard users can understand save, run, conversion, drag destination, validation, and error outcomes.

* **Verification:** Accessibility-tree/manual screen-reader pass for representative flows.

**UXUI-043 — P2 · accessibility · component**

* **Finding:** Tooltips and `title` attributes are used as discoverability aids, but they are not equivalent for touch, keyboard, or assistive technology.

* **Evidence:** Many icon buttons specify `title` and `aria-label`; shared `Tooltip` exists, but usage is not uniform.

* **Recommendation:** Use `aria-label` for naming, `Tooltip` for visible supplemental help, and inline labels where the action is high-consequence or frequently used. Do not put essential instructions only in a tooltip.

* **Acceptance:** Every critical action remains understandable without hover, and tooltip content is available on keyboard focus.

* **Verification:** Keyboard focus and non-hover manual review.

**UXUI-044 — P2 · accessibility · editor**

* **Finding:** Notes, Vim mode, code blocks, LaTeX errors, image attachments, slash menus, and Excalidraw each have specialized input behavior that can conflict with global shortcuts and generic focus assumptions.

* **Evidence:** [`Editor.tsx`](../src/renderer/src/components/Editor.tsx), note e2e coverage, [`ScheduleCodeEditor.tsx`](../src/renderer/src/components/scheduling/ScheduleCodeEditor.tsx), and [`ExcalidrawFileEditor.tsx`](../src/renderer/src/components/ExcalidrawFileEditor.tsx).

* **Recommendation:** Maintain an editor input contract covering focus ownership, command precedence, escape behavior, error announcement, non-Vim fallback, and focus restoration when menus/popovers close.

* **Acceptance:** Editing commands remain predictable and shell shortcuts do not steal keystrokes from the active editor.

* **Verification:** Existing note/code/Excalidraw e2e plus a shared keyboard matrix.

## Route and workflow audit matrix

The matrix is the minimum coverage contract. Each route should have findings linked to the foundation IDs above rather than repeating the same primitive defect.

| Surface          | Primary user task                                                        | Audit focus                                                                                                      | Existing evidence to extend                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Global shell     | Navigate, switch workspaces, open commands, manage vault/panels          | hierarchy, tabs, shortcuts, focus, overflow, panel collapse, toasts                                              | `App.tsx`, `AppSidebar.tsx`, `TopBar.tsx`, `right-panel-resize.spec.ts`, `sidebar-resize.spec.ts`                                                     |
| Capture          | Quickly record and process fleeting notes                                | input speed, keyboard save, four-column compact behavior, conversion/removal feedback, empty/loading states      | `CapturePage.tsx`, `capture-page.spec.ts`                                                                                                             |
| Knowledge        | Explore graph relationships and inspect orphan notes                     | graph loading/empty/error, zoom/pan discoverability, right-panel responsive behavior, color independence         | `KnowledgePage.tsx`, `e2e/knowledge-page.spec.ts`                                                                                                     |
| Notes/browser    | Find, create, rename, organize, export, and delete notes                 | tree/card parity, context menus, drag/drop alternatives, long paths, empty/recent states                         | `NotebookCardBrowser.tsx`, `NotesTreeView.tsx`, `note-tree.spec.ts`, `note-tree-export-submenu.spec.ts`                                               |
| Note editor      | Read and edit notes efficiently                                          | autosave status, editor startup, Vim/code/LaTeX/image states, outline/focus, global shortcut precedence          | `Editor.tsx`, `note-page.spec.ts`, `note-outline-rail.spec.ts`, `code-block-style.spec.ts`                                                            |
| Projects         | Plan work across projects, milestones, and tasks                         | list/detail panel collapse, inline editing, property density, task actions, archive/delete recovery, long labels | `ProjectsWorkspacePage.tsx`, `TaskPropertiesPanel.tsx`, `project-page.spec.ts`                                                                        |
| Task detail      | Inspect and update a task from projects or calendar                      | context breadcrumbs, save/pending feedback, property form semantics, delete/done actions, responsive layout      | `TaskPage.tsx`, `TaskEditDialog.tsx`, `tests/taskPage.test.ts`                                                                                        |
| Calendar         | Inspect schedule and move/resize tasks                                   | day/week/month hierarchy, grid readability, drag/keyboard parity, filters, hover card, compact fallback          | `CalendarDayView.tsx`, `CalendarWeekView.tsx`, `CalendarMonthView.tsx`, `e2e/calendar-month-view.spec.ts`, `e2e/calendar-weekly-drag-preview.spec.ts` |
| Scheduling       | Create, run, review, and secure automations                              | editor state, secrets/trust copy, run progress, action review, errors/retry, panel responsiveness                | `SchedulingPage.tsx`, `components/scheduling`, `e2e/scheduling-page.spec.ts`, `tests/schedulingPage.test.ts`                                          |
| Scheduling guide | Understand the automation API                                            | document hierarchy, copy actions, code readability, narrow layout, navigation back to scheduling                 | `SchedulingApiGuidePage.tsx`                                                                                                                          |
| Subscriptions    | Filter, inspect, create, edit, and delete recurring expenses             | table semantics, drawer form, validation, pending/save feedback, responsive columns                              | `SubscriptionsPage.tsx`, `subscriptions-page.spec.ts`                                                                                                 |
| Settings         | Configure workspace, editor, appearance, agent, and runtime integrations | section hierarchy, form semantics, migration risk, status/error recovery, compact multi-column rows              | `SettingsPage.tsx`, `settings-page.spec.ts`                                                                                                           |
| Search           | Find and open notes/results                                              | query loading, no results, keyboard selection, snippet hierarchy, long paths                                     | `SearchPage.tsx`, `SearchResults.tsx`                                                                                                                 |
| Excalidraw       | Create, edit, recover, rename, and delete drawings                       | save/recovery state, canvas focus, toolbar discoverability, dark mode, destructive confirmation                  | `ExcalidrawPage.tsx`, `ExcalidrawFileEditor.tsx`, `excalidraw-page.spec.ts`                                                                           |
| Design audit     | Inspect and validate design tokens/primitives                            | specimen completeness, token drift, light/dark, reduced motion, keyboard overlay checks                          | `DesignAuditPage.tsx`, `design-audit-page.spec.ts`                                                                                                    |
| Vault gate       | Open/create/manage a vault before working                                | first-run clarity, recovery, disabled/unavailable actions, dialog focus, error copy                              | `NoVaultPage.tsx`, `VaultSwapperDialog.tsx`, `vault-gate.spec.ts`                                                                                     |
| Runtime error    | Recover from renderer/window failure                                     | error hierarchy, diagnostics, copy/reload actions, focus, safe fallback styling                                  | `AppErrorPage.tsx`, `AppErrorBoundary.tsx`, `windowErrorPage.ts`                                                                                      |

### Route-specific backlog

These findings are deliberately page-level. If a shared foundation fix resolves several of them, close the route findings as consumers of that shared change rather than reimplementing them.

**UXUI-045 — P2 · workflow · capture**

* Make quick capture’s keyboard save, current group, validation, and conversion result visible without interrupting rapid entry.

* Add a compact review mode for the four-column board and keep action menus discoverable on touch-sized/narrow targets.

* Animate capture/conversion only when the destination is clear and the motion can be interrupted.

* Verify empty, loading, long-content, conversion failure, and duplicate-submit states.

**UXUI-046 — P2 · workflow · notes**

* Align tree and card-browser action language, selected state, rename behavior, folder navigation, and export menus.

* Make long paths and filenames recoverable through full-name affordances instead of relying only on truncation.

* Add explicit save/failed-save status near the editor or tab, not only through a transient toast.

* Verify note creation, rename, delete, export, import, drag/drop, recent files, no-results, editor-not-ready, and reload recovery.

**UXUI-047 — P2 · workflow · editor**

* Define startup/readiness behavior so the editor does not appear empty or unresponsive while initializing.

* Make Vim mode, code blocks, LaTeX errors, slash menus, image operations, and AI completion states consistent with the global feedback contract.

* Preserve focus and selection across outline jumps, popovers, tab changes, and save failures.

* Verify long documents, invalid content, slow writes, page leave, reduced motion, and keyboard-only editing.

**UXUI-048 — P2 · workflow · projects/tasks**

* Normalize list/detail/properties panel collapse and compact behavior.

* Replace native destructive confirms and page-local property controls with shared dialog/field/action contracts.

* Improve task/milestone completion continuity, tags, reminders, archive/delete recovery, and pending state.

* Verify empty projects, no milestone tasks, long titles, dense properties, keyboard selection, drag/drop, and task-origin breadcrumbs.

**UXUI-049 — P2 · workflow · calendar**

* Make view switching, date navigation, filters, current-day context, hover details, and task type/status legible without color-only cues.

* Add keyboard alternatives for drag/resizing and announce schedule changes.

* Preserve a usable agenda/list fallback or deliberate contained scroll behavior at compact widths.

* Verify day/week/month, all-day tasks, overlapping tasks, long titles, auto-scroll, resize, filter no-results, and reduced motion.

**UXUI-050 — P2 · workflow · scheduling**

* Make automation selection, code editing, save/run/delete, run history, review actions, trust guidance, and secrets state visually consistent.

* Replace technical error strings with recovery-oriented messages and distinguish queued, running, succeeded, failed, and action-review states.

* Keep code and history readable in narrow panels; move secondary history/properties into a deliberate compact layout.

* Verify no vault, empty list, first automation, slow run, failed run, failed secret operation, trust dismissal, and action review.

**UXUI-051 — P2 · workflow · subscriptions**

* Define table column priority, filter feedback, no-results state, row actions, and drawer form behavior.

* Make validation and save/delete feedback inline and recoverable, not only toast-based.

* Keep drawer focus, scroll, footer actions, and long values usable at compact widths.

* Verify empty table, filtered no-results, long merchant/category names, invalid values, save failure, and delete confirmation.

**UXUI-052 — P2 · workflow · settings**

* Group settings by user goal, keep section navigation visible, and normalize multi-column forms at compact widths.

* Mark migration and runtime integration actions with consequence, pending, success, warning, and retry states.

* Use shared fields and status surfaces for vault, font/theme, Vim, API key, Python/Conda, and migration controls.

* Verify keyboard navigation, validation, unavailable platform actions, long paths, refresh/reset, migration failure, and dark mode.

**UXUI-053 — P2 · workflow · knowledge/search/secondary surfaces**

* Give graph loading, empty, no-connections, orphan visibility, zoom/pan, and error states a common canvas contract.

* Make search results keyboard-selectable with clear title/path/snippet hierarchy and a useful no-results state.

* Audit Excalidraw recovery, canvas focus, rename/delete, design-audit specimens, vault gate, and runtime error pages for the same feedback and overlay rules.

## Cross-cutting implementation waves

### Wave 0 — Baseline and safety

* Record current working-tree baseline and distinguish existing user changes from audit recommendations.

* Confirm route inventory, primitive inventory, compact breakpoint, and existing e2e ownership.

* Establish a P0 confirmation rule and capture any runtime blockers before visual polish.

### Wave 1 — Source of truth and primitives

* Resolve package/renderer ownership wording and enforce synchronization.

* Normalize density, radius, typography, surface, status, icon-button, field, overlay, empty/loading/error, and action-group contracts.

* Convert repeated raw controls and native confirmations where the shared primitive is semantically correct.

### Wave 2 — Shell and navigation

* Define compact shell behavior, panel-to-drawer conversion, action priority, tab lifecycle, breadcrumb hierarchy, shortcut precedence, and focus restoration.

* Add narrow-window and keyboard coverage before page polish.

### Wave 3 — Feedback and recovery

* Standardize toast/inline/overlay feedback intents and structured error presentation.

* Add pending, loading, retry, undo, save-status, and live-announcement contracts.

### Wave 4 — Responsive route groups

* Apply shell and panel recipes to notes, projects/tasks, calendar, knowledge, scheduling, subscriptions, settings, and capture.

* Remove accidental page overflow and validate long-content behavior.

### Wave 5 — Motion and expressive polish

* Apply motion taxonomy and continuity patterns to capture/conversion, task completion, saves, panels, tabs, lists, and calendar changes.

* Complete reduced-motion and performance work before adding ambient or celebratory motion.

### Wave 6 — Governance and regression protection

* Expand the design-audit page into a component/state specimen surface.

* Add visual-state, reduced-motion, compact-layout, accessibility, and source-sync checks where they provide durable value.

* Re-run the route matrix and close or re-prioritize every finding.

## Verification contract

### Documentation completeness

* Every current renderer page appears in the route matrix.

* Every finding has an ID, type, scope, owner, evidence, priority, recommendation, acceptance criteria, and verification method.

* Shared findings are not duplicated as independent page fixes.

* Every relative path in the document exists in the current worktree or is explicitly marked as a planned target.

* Static evidence is not presented as a completed runtime check.

### Runtime verification for implementation

Use the smallest relevant check for each change:

* `npm run lint` for renderer and primitive composition changes.

* `npm run test:run` for state helpers, interaction contracts, and pure behavior.

* `npm run build` for cross-process/type/template integration.

* `npm --workspace @xingularity/workspace-template run verify:renderer-sync` for shared primitive/style parity.

* Targeted Playwright specs for affected flows; do not run the full suite for routine page changes.

At minimum, verify representative surfaces at:

* **Wide desktop:** 1440x960, matching existing note-outline coverage.

* **Compact desktop:** around 1024px, matching the platform compact-layout rule.

* **Stress width:** 800x600, used to expose shell, panel, table, and long-label failures even though mobile parity is out of scope.

For every affected surface, test keyboard-only operation, visible focus, light/dark theme, reduced motion, long labels/content, loading, empty, no-results, validation, failure/retry, success, and destructive confirmation as applicable.

## Contribution checklist for future UI work

Before merging a new or changed UI surface, answer:

* Does an existing primitive or workspace recipe already express this interaction?

* If not, is the missing behavior stable and reusable enough to add to the shared layer?

* Which semantic tokens, density tier, radius, and surface role does it use?

* What are its loading, pending, empty, no-results, error, success, disabled, read-only, and destructive states?

* How does it behave at wide, compact, and stress widths?

* What is the keyboard and focus model? Are icon-only controls named and discoverable?

* Does motion communicate state or continuity? What happens with reduced motion?

* What is the recovery path if persistence, IPC, parsing, or external execution fails?

* Which unit, component, e2e, visual, accessibility, or sync check protects the behavior?

* If a shared primitive or token changed, was the workspace template synchronization check run?

## Open decisions to resolve during implementation

These are intentionally recorded as implementation work rather than hidden assumptions:

1. Exact density tier names and whether they belong in CVA variants, CSS utility recipes, or composed components.
2. Whether structured toast metadata belongs in the existing Zustand store or a dedicated feedback adapter.
3. Whether compact side panels use the existing drawer primitive directly or a composed responsive workspace-panel component.
4. Which visual regression mechanism best fits the existing Playwright Electron setup.
5. Which runtime error categories can safely map to user-facing recovery messages without exposing sensitive filesystem or process details.

Each decision should be recorded against the relevant `UXUI-###` finding before implementation closes it.
