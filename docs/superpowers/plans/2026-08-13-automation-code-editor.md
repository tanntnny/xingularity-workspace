# Automation Code Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scheduling page’s plain code textarea with an editable, runtime-aware CodeMirror editor and place the only code-panel action, Save changes, in its toolbar.

**Architecture:** Add a focused `ScheduleCodeEditor` component that owns CodeMirror lifecycle, language selection, synchronization, and editor styling, plus a pure `schedulingCodeEditor` helper for runtime-to-language mapping. Keep scheduling persistence and trust handling in `SchedulingWorkspaceProvider`; pass the existing save callback into the editor and remove only the code-area template actions and workspace-header save action.

**Tech Stack:** React 19, TypeScript, CodeMirror 6 (`@codemirror/state`, `@codemirror/view`, `@codemirror/language`, `@codemirror/commands`, `@codemirror/lang-python`, `@codemirror/lang-javascript`), existing shadcn-style `Button`/`Field` primitives, Vitest.

## Global Constraints

- Preserve the existing `ScheduleJob`/`ScheduleJobInput` contracts, trust confirmation, validation, run, delete, permission, and persistence behavior.
- Keep Save changes visible in the code-panel header and disabled when the draft is clean or a save is in progress.
- Remove Add task and Add note controls from the code panel; keep Run now, Delete, and Add automation outside the code panel.
- Highlight Python for Python jobs and JavaScript for legacy JavaScript jobs without changing the stored source text.
- Use Inter for UI text and JetBrains Mono/monospace only inside the editor; use shared UI primitives for actions.
- Do not reformat or revert unrelated worktree changes.

---

### Task 1: Make the editor contract and scheduling UI expectations explicit

**Files:**

- Modify: `src/renderer/src/components/scheduling/types.ts`
- Modify: `tests/schedulingPage.test.ts`
- Create: `tests/schedulingCodeEditor.test.ts`

**Interfaces:**

- `ScheduleEditorProps` adds `isDirty: boolean` and `onSave: () => void`, and removes `onInsertTemplate`.
- `ScheduleCodeEditorProps` is defined by the component implementation in Task 2: `{ code: string; runtime: RuntimeType; isDirty: boolean; isSaving: boolean; onChange: (code: string) => void; onSave: () => void }`.
- `getScheduleCodeLanguage(runtime: RuntimeType): 'python' | 'javascript'` is exported from `src/renderer/src/lib/schedulingCodeEditor.ts` for deterministic unit coverage.

- [ ] **Step 1: Write the failing tests**

  Update the existing static scheduling editor test so it expects:

  ```ts
  expect(markup).toContain('data-testid="scheduling-code-editor"')
  expect(markup).toContain('data-testid="scheduling-save-changes"')
  expect(markup).not.toContain('data-testid="scheduling-add-task-template"')
  expect(markup).not.toContain('data-testid="scheduling-add-note-template"')
  ```

  Change its fixture props to pass `isDirty` and `onSave`, and remove `onInsertTemplate`. Change the header test to assert that `SchedulingHeaderActions` still renders Add automation but no longer renders `scheduling-save-changes`.

  Add `tests/schedulingCodeEditor.test.ts` with these behavior tests:

  ```ts
  it('maps Python and legacy JavaScript runtimes to their CodeMirror languages', () => {
    expect(getScheduleCodeLanguage('python')).toBe('python')
    expect(getScheduleCodeLanguage('javascript')).toBe('javascript')
  })
  ```

- [ ] **Step 2: Run the targeted tests and verify the expected RED state**

  Run:

  ```bash
  rtk npm run test:run -- tests/schedulingPage.test.ts tests/schedulingCodeEditor.test.ts
  ```

  Expected result: failure because the new editor component, props, and language helper do not exist yet, and the old buttons/header save are still present.

- [ ] **Step 3: Keep the test changes limited to the approved behavior**

  Do not remove tests for Add automation, trust guidance, view tabs, Run now, Delete, or the scheduling data flow; those actions remain outside the code panel.

### Task 2: Implement the focused runtime-aware CodeMirror editor

**Files:**

- Create: `src/renderer/src/components/scheduling/ScheduleCodeEditor.tsx`
- Create: `src/renderer/src/lib/schedulingCodeEditor.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/renderer/src/assets/main.css`
- Test: `tests/schedulingCodeEditor.test.ts`

**Interfaces:**

- Produces `ScheduleCodeEditor` with the exact props defined in Task 1.
- Produces `getScheduleCodeLanguage(runtime)` for unit tests and runtime selection.

- [ ] **Step 1: Add the language packages as direct runtime dependencies**

  Add `@codemirror/lang-python` at `^6.2.1` and `@codemirror/lang-javascript` at `^6.2.5` to `package.json` and synchronize the root dependency map in `package-lock.json` using the repository’s existing npm lockfile.

- [ ] **Step 2: Implement the minimal CodeMirror lifecycle**

  In `ScheduleCodeEditor.tsx`:
  - Render a semantic `<section>` with `data-testid="scheduling-code-editor"`, a `Field`-compatible label area reading `Python code` or `JavaScript code`, and a toolbar containing the existing `Button` primitive with `data-testid="scheduling-save-changes"`, `aria-label="Save changes"`, and `disabled={!isDirty || isSaving}`.
  - Mount `EditorView` into a ref-backed `div` inside the section using `useEffect`, with `EditorState` initialized from `code`.
  - Configure line numbers, active-line highlighting, selection drawing, history, bracket matching, indentation, tab indentation, line wrapping, default syntax highlighting, and a `data-testid="scheduling-code-editor-surface"` mount node.
  - Select `python()` when `runtime === 'python'` and `javascript()` when `runtime === 'javascript'`.
  - Use an update listener to call `onChange(nextDoc)` only for document changes; store the callback in a ref so ordinary React draft updates do not recreate the editor.
  - Synchronize external `code` changes (job selection, template-independent draft replacement, or save response) into the existing editor with a full-document replacement only when the editor’s current document differs.
  - Reconfigure the language extension when `runtime` changes without changing the source text.
  - Destroy the `EditorView` on unmount and preserve focus/selection during ordinary code edits.

- [ ] **Step 3: Add semantic, theme-aware editor styling**

  Add a scoped `.scheduling-code-editor` style block in `main.css` for the CodeMirror surface, using existing `background`, `card`, `foreground`, `muted-foreground`, `border`, and `ring` tokens. Keep the editor’s code font monospace, use the app’s control radius/border language, provide a visible focus treatment, allow horizontal scrolling for long lines, and avoid page-level horizontal overflow. Use the default CodeMirror highlight classes/colors with light/dark-compatible surface and text tokens rather than hardcoded page-specific backgrounds.

- [ ] **Step 4: Run the new component test and verify GREEN**

  Run:

  ```bash
  rtk npm run test:run -- tests/schedulingCodeEditor.test.ts
  ```

  Expected result: PASS, including the language mapping test and static editor shell assertions.

### Task 3: Integrate the editor and relocate Save changes

**Files:**

- Modify: `src/renderer/src/components/scheduling/ScheduleEditor.tsx`
- Modify: `src/renderer/src/pages/SchedulingPage.tsx`
- Modify: `src/renderer/src/components/scheduling/types.ts`
- Modify: `tests/schedulingPage.test.ts`

**Interfaces:**

- `ScheduleEditor` receives `isDirty` and `onSave` and no longer receives `onInsertTemplate`.
- `SchedulingHeaderActions` continues to render `SchedulingAddAutomationButton`, but no longer renders a Save changes `WorkspaceIconButton`.

- [ ] **Step 1: Remove the obsolete template action path from the editor UI**

  Remove the Add task/Add note buttons and the `onInsertTemplate` prop from `ScheduleEditor`. Remove the now-unused `Terminal` icon in that component. Keep the Python/stdout protocol description as non-interactive helper text if it remains useful, but do not leave any other button in the code panel.

- [ ] **Step 2: Replace the plain textarea with `ScheduleCodeEditor`**

  Pass `draft.code`, `draft.runtime`, `isDirty`, `isSaving`, `updateDraft({ code })`, and `handleSave` into the new editor. Keep the trigger fields, permissions, output handling, Run now, Delete, and new-draft safety text in their existing non-code-panel regions.

- [ ] **Step 3: Move the save callback out of the workspace header**

  In `SchedulingPage.tsx`, include `isDirty` and `handleSave` in the `SchedulingPage` context destructure and pass them to `ScheduleEditor`. Remove the Save changes `WorkspaceIconButton`, `Save` icon import, and `WorkspaceHeaderActions` usage from `SchedulingHeaderActions`; retain the Add automation action and its existing `WorkspaceIconButton` composition. The History view must not render a code-panel save action because it has no editor.

- [ ] **Step 4: Remove unreachable provider plumbing only after the UI is green**

  Once TypeScript identifies all consumers, remove `insertTemplate` from `SchedulingWorkspaceValue`, delete its callback and template-specific imports from `SchedulingPage.tsx`, and leave `schedulingTemplates.ts` plus its unit tests intact unless no production consumer or test requires them. Do not change schedule persistence or action protocol behavior.

- [ ] **Step 5: Run the scheduling tests and verify GREEN**

  Run:

  ```bash
  rtk npm run test:run -- tests/schedulingPage.test.ts tests/schedulingCodeEditor.test.ts tests/schedulingTemplates.test.ts
  ```

  Expected result: PASS; static markup confirms Save changes is in the editor, absent from the header, Add task/Add note are absent, and Add automation remains.

### Task 4: Verify the integrated renderer and preserve unrelated work

**Files:**

- Inspect only: all changed files from Tasks 1–3 plus the pre-existing worktree diff.

- [ ] **Step 1: Run the focused checks**

  Run:

  ```bash
  rtk npm run lint
  rtk npm run typecheck:web
  rtk npm run test:run -- tests/schedulingPage.test.ts tests/schedulingCodeEditor.test.ts tests/schedulingTemplates.test.ts
  ```

- [ ] **Step 2: Run the production build**

  Run:

  ```bash
  rtk npm run build
  ```

  Confirm the new CodeMirror imports bundle successfully for Electron’s renderer and no existing main/preload type checks regress.

- [ ] **Step 3: Perform a manual UI smoke check if the dev app is available**

  Confirm all of the following in the Automation view:
  - Python source shows syntax colors, line numbers, editing, scrolling, and a toolbar Save changes control.
  - JavaScript legacy source switches to JavaScript syntax highlighting.
  - Save changes is disabled when clean, enabled after a code edit, shows Saving… during persistence, and still opens the existing Python trust dialog when required.
  - Add task/Add note are absent from the code panel; Run now/Delete and Add automation remain available in their existing regions.
  - History view has no editor save action and no console errors.

- [ ] **Step 4: Review the diff**

  Run `rtk git diff --check` and `rtk git status --short`. Ensure only the planned scheduling/editor/dependency/test/plan files are newly changed by this task; do not stage, reset, or overwrite the user’s unrelated work.
