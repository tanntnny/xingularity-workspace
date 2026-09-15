# Markdown editor interaction behavior

Status: P0 foundation implemented; P0 completion and P1/P2 remain

Research snapshot: 2026-09-13

Scope: editor movement, Markdown structure, fenced code blocks, and Vim behavior.

## Executive finding

The editor currently has three different editing surfaces with different behavior contracts:

1. Preview mode is a Milkdown/ProseMirror structural editor. Its list behavior is mostly supplied by Milkdown and ProseMirror keymaps.
2. Raw mode is a native `textarea` with a hand-rolled Vim layer. Its insert-mode Enter path now has a Markdown-aware source command for list continuation, empty-list exit, task/ordered markers, fenced-code protection, and Shift-Enter literal breaks.
3. Preview fenced code blocks use a custom ProseMirror `NodeView` with a `contentDOM`. The application now restores horizontal/vertical boundary navigation and Mod/Ctrl-Enter exit, while still not providing the complete CodeMirror line-editor contract.

The result is that the simplest preview list flow can feel natural while raw mode, code blocks, and Vim mode still have different ownership boundaries. The primary problem is not one missing key binding. It is the absence of one interaction contract shared by the structural editor, source editor, code editor, and Vim state machine.

The desired behavior should be made explicit, tested as a matrix, and implemented through shared commands with surface-specific adapters. Adding isolated `keydown` cases will continue to create ordering and parity regressions.

## Scope and worktree caveat

The working tree already contains staged, unstaged, and untracked editor-related changes, including a raw editor, raw Vim helpers, a code-block navigation plugin, and new tests. Those changes were preserved and reviewed in place; they should still be committed separately from unrelated work.

This document began as an investigation and implementation-ready design. The current pass implements the first P0 slice in the editor surfaces and records the remaining gaps below. “Current” describes the post-fix behavior; “target” describes the full contract for later P1/P2 work.

## Implemented P0 slice

The first fix targets the interactions that make repeated Enter, movement, and code-block editing feel unpredictable:

- Raw insert-mode Enter now continues unordered, ordered, and task-list markers on non-empty items; removes an empty marker to exit one list level; treats fenced-code lines as literal text; and keeps Shift-Enter as a plain newline.
- Raw normal/visual mode now consumes only commands it owns. Unsupported printable keys remain Vim-safe, while unsupported special keys can fall through to the textarea/browser behavior. First-line `k` and last-line `j` stay at the current boundary.
- Preview Vim movement and linewise commands now resolve physical logical lines inside multiline code blocks. `j`/`k`, `0`, `$`, `A`, `o`, `O`, delete/change, and visual-line selection no longer treat the entire code block as one line.
- Preview Vim normal/visual handlers now explicitly consume normal-mode Enter without mutating the document and avoid broad default prevention for unknown special keys.
- Code-block navigation now owns ArrowUp/Down/Left/Right only at the corresponding outer boundary and supports Mod/Ctrl-Enter exit.
- Pure tests cover raw list Enter decisions, raw movement boundaries, code-block boundary commands, and preview Vim logical-line movement. The targeted e2e scenarios are present but require an Electron runtime that launches successfully.

The remaining P0 work is raw Tab/Shift-Tab and boundary Backspace/Delete, stronger preview list-item ownership tests, and a shared command adapter across preview and raw surfaces. This pass does not claim full Vim compatibility or a CodeMirror-backed nested editor.

## Current system map

| Surface           | Current owner                                                                                                                                                    | What it actually does                                                                                           | Main gap                                                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Preview Markdown  | [`Editor.tsx`](../../src/renderer/src/components/Editor.tsx), Milkdown, ProseMirror                                                                              | Edits a structural document. Insert-mode Enter is allowed to reach Milkdown’s list and base keymaps.            | List semantics are implicit in dependency keymaps, not owned and tested by the application.                                                 |
| Raw Markdown      | [`NoteRawEditor.tsx`](../../src/renderer/src/components/NoteRawEditor.tsx), [`noteRawVim.ts`](../../src/renderer/src/lib/noteRawVim.ts)                          | Uses a `textarea`, custom raw Vim handling, and a source-level Markdown Enter command.                          | Tab/Shift-Tab, boundary Backspace/Delete, and full source/editor history are not yet governed by a shared structural command layer.         |
| Preview Vim       | [`noteVimMode.ts`](../../src/renderer/src/lib/noteVimMode.ts)                                                                                                    | Adds insert, normal, visual, and visual-line modes with logical-line handling for multiline code blocks.        | List-item structural operators, counts, registers, text objects, and the rest of Vim’s command language remain limited.                     |
| Fenced code block | [`noteCodeBlockView.ts`](../../src/renderer/src/lib/noteCodeBlockView.ts), [`noteCodeBlockNavigation.ts`](../../src/renderer/src/lib/noteCodeBlockNavigation.ts) | Renders a ProseMirror `code_block` with native `contentDOM`, copy UI, boundary arrows, and Mod/Ctrl-Enter exit. | It does not have the full CodeMirror line/selection/history contract or a nested CodeMirror surface.                                        |
| Code highlighting | [`codeSyntaxHighlighting.ts`](../../src/renderer/src/lib/codeSyntaxHighlighting.ts)                                                                              | Parses and decorates a small set of JavaScript/TypeScript/JSX and Python language IDs.                          | Highlighting coverage and editing behavior are separate concerns; unsupported languages need a plain-text fallback without changing source. |
| Editor settings   | [`SettingsPage.tsx`](../../src/renderer/src/pages/SettingsPage.tsx), [`types.ts`](../../src/shared/types.ts)                                                     | Stores a small set of printable key-to-action mappings.                                                         | Mappings cannot express motions, operators, counts, registers, text objects, or context-aware structural commands.                          |

The important ownership boundary is that `Editor.tsx` currently appends the application Vim and code-block plugins before Milkdown’s generated keymap. ProseMirror invokes `handleKeyDown` handlers in plugin order and stops when a handler returns `true`. A plugin can therefore either deliberately own a command or accidentally prevent a later structural keymap from behaving normally.

## Confirmed current behavior

### Preview list Enter behavior

In preview mode, the requested “sometimes create another bullet, sometimes exit the bullet” behavior already exists through the default keymap chain:

```markdown
- first item⏎
- | ← Enter on non-empty item creates a sibling item
  ⏎ ← Enter again while the item is empty
  | ← the empty item is lifted out of the list
```

The relevant dependency behavior is:

- Milkdown’s CommonMark list-item keymap uses ProseMirror’s `splitListItem` for Enter.
- A non-empty list item is split into another item at the same list depth.
- An empty list item falls through to ProseMirror’s `liftEmptyBlock`, which lifts the item out of the current list. At the top level this becomes a regular paragraph.
- Tab and Shift-Tab are handled as list sink/lift commands.
- Backspace/Delete at list boundaries are handled by list-item commands for joining or lifting.

This behavior is correct as a baseline, but it is not an application-owned contract. The current tests do not prove the exact non-empty, empty, nested, ordered, task-list, or blockquote cases. A future Vim or code-block plugin can also change the result by preventing the event or claiming Enter before the default keymap.

### Raw mode

Raw mode still uses a `textarea`, but insert-mode Enter now goes through `applyNoteRawEnter` before native textarea behavior. Therefore:

- pressing Enter after `- first item` inserts a newline followed by `- ` at the same indentation;
- pressing Enter after `1. first item` continues with `2. ` (or the next number in the current ordered style);
- pressing Enter after a task item continues with an unchecked `[ ]` marker;
- pressing Enter on an empty `- ` or task marker removes that marker and leaves the cursor at the same indentation, exiting one list level;
- pressing Enter inside a fenced code region inserts only a literal newline;
- Shift-Enter inserts a literal newline without list continuation or exit.

This fixes the highest-value raw-mode mismatch with preview mode. Tab/Shift-Tab, boundary Backspace/Delete, and complete history/register parity remain separate work. The raw Vim implementation now also keeps first-line `k` and last-line `j` at their boundaries and does not broadly swallow unsupported special keys.

### Fenced code blocks

The application disables Crepe’s CodeMirror feature and registers [`NoteCodeBlockView`](../../src/renderer/src/lib/noteCodeBlockView.ts) instead. The custom view gives ProseMirror a `contentDOM`, so a fenced code block is edited as one ProseMirror `code_block` textblock even when its text contains multiple newline characters.

The default ProseMirror command behavior is still useful:

- Enter inserts a literal newline inside a code block.
- Mod-Enter/Ctrl-Enter exits the code block into a paragraph.
- Markdown input rules do not interpret list markers or arrow sequences inside code text.

The current application-specific navigation plugin handles ArrowUp/ArrowDown and ArrowLeft/ArrowRight only when the selection is at the corresponding code-block boundary. It also handles Mod-Enter/Ctrl-Enter through the ProseMirror `exitCode` command. It still does not provide a complete nested line editor. Milkdown’s own CodeMirror NodeView remains a useful reference because it additionally handles CodeMirror-owned selection/history and empty-code-block backspace behavior.

The current custom view also owns copy UI and language metadata, so replacing it must preserve those responsibilities and keep document transactions synchronized with the outer editor.

### Vim mode

The preview Vim plugin currently supports these modes:

- insert;
- normal;
- visual;
- visual line.

It supports a useful initial subset: `i`, `a`, `A`, `o`, `O`, `v`, `V`, `h`, `l`, `j`, `k`, `w`, `b`, `e`, `0`, `^`, `$`, `G`, `gg`, `d`, `c`, `x`, `D`, `C`, `p`, `P`, and `u`, plus a small set of pending operator sequences. Raw mode has a separate implementation with a similar but not identical subset.

The key limitations are structural:

- Preview `j`/`k` now move through physical source lines inside a multiline code block while preserving a preferred column. At the first/last code line they stay in the code block instead of jumping to an unrelated document position.
- `0`, `$`, `A`, `o`, `O`, visual-line selection, and linewise delete/change now use a logical code line inside a code block. List-item structure is still represented by ProseMirror nodes and is not yet a shared source/preview command.
- Normal and visual mode now prevent only recognized commands, pending sequences, and unknown printable keys. Unsupported special keys such as arrows, Backspace, and Tab can fall through; their final behavior is still dependent on the surrounding editor keymap.
- Enter in insert mode is intentionally allowed to reach Milkdown’s structural keymaps, while Enter in normal mode is explicitly consumed as a no-op. `o`/`O` remain the explicit normal-mode line-opening commands.
- `dd`/`cc` operate on the current textblock range. Inside a list, that can delete or change the paragraph content without expressing a whole list-item operation.
- Pending commands have limited coverage and do not yet include counts, operator-plus-motion composition, text objects, registers, marks, macros, search, repeat, or redo.
- Visual and visual-line mode share the same visible badge label in the page UI, even though the plugin tracks separate modes.

Raw mode has additional known limitations:

- native textarea movement is used for insert mode, while normal mode applies custom selection changes;
- raw `j`/`k` now have no-op boundary semantics at the first/last source line;
- word motion uses a narrow ASCII word definition;
- there is no complete redo, named-register model, or command timeout for pending sequences;
- `yy` is not implemented even though `dd` is;
- Markdown-aware Tab/Shift-Tab and boundary Backspace/Delete are not implemented yet.

## Root causes

### 1. There are multiple editing models with no shared command contract

Preview operates on a ProseMirror document, raw mode operates on source text, and code blocks operate inside a nested text surface. Each surface currently owns part of Enter, movement, selection, and undo behavior. A user experiences one editor, but the code exposes three separate editors.

### 2. “Line” is not represented consistently

The preview Vim plugin treats a ProseMirror textblock as a line. That works for a paragraph but fails for:

- multiple physical lines in a fenced code block;
- soft-wrapped visual rows;
- list items whose structural unit is the list item rather than only its paragraph;
- blockquotes and nested lists where depth matters.

Raw mode has physical source lines, while preview mode has document nodes. Movement and visual selection need an adapter that defines the correct unit for each context.

### 3. Key interception must be narrower than command ownership

The earlier preview and raw Vim paths called `preventDefault()` too broadly, making unsupported keys feel dead and making plugin ordering part of the user-visible behavior. The P0 pass applies the opposite rule to the Vim handlers: a handler prevents and reports handled only for a recognized command, a pending sequence, or an unknown printable key that Vim intentionally consumes. Structural ownership is still split across preview, raw, and code contexts.

### 4. The CodeMirror implementation was replaced without restoring its behavior contract

CodeMirror packages remain installed, and Milkdown’s default NodeView demonstrates the intended code-block boundary behavior. The application’s custom NodeView currently preserves copy UI and syntax decoration but only a small part of the editor interaction contract.

### 5. Raw Markdown input rules were missing

Native textarea input has no structural knowledge. The P0 pass adds an explicit source-edit command for Enter: list continuation, empty-list exit, task-marker preservation, ordered-list numbering, and fence protection. Tab/Shift-Tab, boundary Backspace/Delete, blockquote-specific policy, and fence indentation still need the same treatment if raw mode is expected to fully match preview mode.

### 6. Tests cover pieces, not the full interaction matrix

The P0 pass adds pure coverage for repeated raw list Enter decisions, raw movement boundaries, code-block boundary commands, and preview Vim logical-line movement. The suite still does not form a complete cross-surface matrix for nested-list exit, preview/raw parity, persistence, or all unsupported-key paths.

## Target interaction contract

The following is the recommended contract for the remaining implementation. It is the acceptance target beyond the P0 foundation described above.

### Command ownership by mode

| Mode/context            | Enter                                                                          | Arrow keys                                             | Markdown structural keys                                       | Vim commands                                                                          |
| ----------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Insert, normal Markdown | Explicit structural split/continuation command                                 | Native/editor movement                                 | Owned by Markdown command adapter                              | Only mode transitions and configured insert mappings                                  |
| Insert, list item       | Continue marker when non-empty; lift one level when the current item is empty  | Native/editor movement                                 | Tab/Shift-Tab sink/lift; boundary Backspace/Delete             | No accidental normal-mode interception                                                |
| Insert, fenced code     | Insert literal newline                                                         | Code editor movement; leave only at defined boundaries | No Markdown input rules inside code                            | Escape changes Vim mode without losing the code selection                             |
| Normal, Markdown        | No structural mutation by default; `o`/`O` are the explicit open-line commands | Vim movement with natural fallback where unsupported   | Structural commands are explicit and context-aware             | Motions, operators, counts, registers, and text objects own only recognized sequences |
| Visual/visual line      | Apply selection-aware command or exit selection                                | Extend or move selection according to Vim semantics    | List item/code-line selection uses the correct structural unit | Delete/change/yank/paste use a shared register model                                  |

The key principle is that “unhandled” is not the same as “prevented.” A key handler must leave the event available to the next owner unless it has completed a command.

### List Enter semantics

These cases should be tested in both preview and raw mode:

| Situation                              | Expected result                                                                                                            |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Non-empty unordered item               | Split at the cursor and create a sibling item with the same list depth and marker style.                                   |
| Non-empty ordered item                 | Split and continue numbering without changing the ordered-list style.                                                      |
| Non-empty task item                    | Continue the task marker in the new item with the new item unchecked unless the product explicitly chooses another policy. |
| Empty item at a nested list level      | Remove the empty child marker and lift the cursor to the parent list level.                                                |
| Empty top-level item                   | Remove the marker and leave the list in a regular paragraph.                                                               |
| Empty item with a nested list below it | Preserve the nested content while exiting only the empty item’s current level.                                             |
| Item inside a blockquote               | Preserve the blockquote and list depth while applying the same split/lift rule.                                            |
| Selection spanning list content        | Replace the selection first, then apply the same structural continuation rule at the resulting cursor.                     |
| Shift-Enter                            | Insert a hard break without invoking list split/lift behavior.                                                             |

Raw mode should use the same default semantics at the source level. For example:

```text
- first item⏎
- |              ← copied marker and indentation

- |⏎             ← empty marker is removed; cursor leaves this list level
|               ← regular source line
```

The source adapter must preserve marker type, indentation, ordered-list numbering policy, task-list syntax, and blockquote prefixes. It must not insert a bullet inside a fenced code region.

### Movement semantics

Movement needs an explicit logical-line abstraction:

- `h`/`l` move by character within the current logical line.
- `0`, `^`, and `$` resolve against the current logical line, not the containing ProseMirror node.
- `j`/`k` move to the adjacent logical line while preserving a sticky preferred column; at the first/last line they remain at the boundary instead of jumping to an unrelated position.
- `w`/`b`/`e` use a documented word classification and are Unicode-safe enough for normal note text.
- `gg` and `G` move to the first/last logical line of the current document or code surface.
- In a fenced code block, movement stays inside the code surface until a defined boundary escape is invoked.
- In preview structural text, visual-line selection should select a list item, paragraph, heading, or code line according to context rather than blindly selecting an entire ProseMirror textblock.
- Tab and Shift-Tab remain structural indentation commands in insert mode. In normal/visual mode they should have explicit Vim mappings or deliberate editor behavior, not accidental dead keys.

Soft wrapping should not make `j`/`k` ambiguous. If the product wants screen-row movement, expose it as a separate command such as `gj`/`gk`; otherwise keep `j`/`k` on logical source lines.

### Fenced code-block semantics

The recommended implementation is a CodeMirror 6-backed code-block NodeView, composed with the existing copy button and language metadata. CodeMirror is already a dependency and Milkdown’s reference NodeView provides a known boundary behavior to preserve.

Required behavior:

- Enter inserts a newline in the code surface.
- Tab applies the code indentation policy rather than triggering Markdown list indentation.
- Mod-Enter/Ctrl-Enter exits the code block into a paragraph.
- ArrowUp/ArrowDown at the first/last code line can leave the code surface when the adjacent document position exists.
- ArrowLeft/ArrowRight at the first/last code position can leave only when the cursor is at the corresponding edge.
- Escape changes Vim mode without discarding the code selection or moving focus unexpectedly.
- `j`/`k`, `0`, `^`, `$`, `o`, `O`, `dd`, and visual-line mode operate on code lines, not the outer `code_block` node.
- Markdown input rules remain disabled inside code.
- Unsupported language IDs remain editable as plain text and preserve the original fence metadata.
- Copying code does not steal focus or create an unrelated editor selection.

If the team decides to keep native ProseMirror `contentDOM` instead, it must implement an equivalent line adapter, boundary navigation, exit command, selection bridge, and undo behavior. The choice should be made once; the two paths should not continue to diverge.

### Vim behavior tiers

“Vim integrated” should be treated as a staged compatibility target rather than a claim based on a few normal-mode keys.

P0, required for natural editing:

- insert/normal/visual/visual-line mode transitions;
- correct Escape behavior without losing selection or text;
- line-aware `h`, `j`, `k`, `l`, `w`, `b`, `e`, `0`, `^`, `$`, `gg`, and `G`;
- `i`, `a`, `A`, `o`, and `O` with list and code context;
- `x`, `D`, `C`, `dd`, `dw`, `cw`, `d$`, `c$`, visual delete/change/yank;
- paste after/before with a shared unnamed register;
- undo and redo with one undo step per user intent;
- unsupported-key fallback and no broad default prevention;
- code-block line movement and exit;
- preview/raw list behavior parity.

P1, expected for a credible Vim workflow:

- counts such as `3j` and `2dw`;
- operator-plus-motion composition including `d0`, `d^`, `dj`, `dk`, and `dG`;
- text objects such as `iw`, `aw`, and delimiters;
- `f`, `F`, `t`, `T`, `r`, `~`, and `J`;
- search, repeat-last-change, and redo;
- complete visual-line structural behavior for lists and code lines;
- command timeout/cancellation for pending `g`, `d`, and `c` sequences.

P2, full Vim compatibility scope:

- named registers, numbered delete registers, and black-hole register;
- marks and jump history;
- macros;
- ex-style command line and commands such as `:s`;
- configurable leader/keymap layers.

The current Settings model should eventually map keys to command IDs with context and arguments, rather than directly to a short fixed list of mode transitions. That allows user mappings to compose with the same command engine used by built-ins.

## Recommended implementation architecture

### 1. Define pure editor primitives first

Add a renderer-independent model for:

- logical lines and line boundaries;
- structural context: paragraph, list item, blockquote, code line, heading;
- cursor/selection positions;
- motion results;
- edit commands and register operations;
- list continuation and list exit decisions.

These functions should accept text or a small structural adapter and return deterministic results. They should not know about DOM events, React state, or Electron IPC.

### 2. Use surface adapters

Keep one command and Vim state engine, then provide adapters for:

- ProseMirror preview documents;
- raw Markdown source text;
- nested CodeMirror code-block documents.

The adapter translates a logical motion or structural command into transactions for its surface. This is the only durable way to keep preview and raw mode behavior aligned while preserving their different representations.

### 3. Make event ownership explicit

Use a command dispatch sequence like:

```text
DOM keydown
  → composition/modifier guard
  → active surface adapter
  → Vim state machine, if Vim owns the mode
  → structural Markdown command, if the key is structural
  → surface/editor default keymap
  → unhandled event remains available to the browser/editor
```

Every command should report one of `handled`, `notHandled`, or `pending`. Only `handled` should call `preventDefault()` and stop later handlers. A pending Vim sequence should consume the keys needed to resolve it and cancel cleanly on timeout, Escape, or an invalid continuation.

### 4. Restore code-block editor ownership

Prefer the existing CodeMirror 6 integration point over extending the custom `contentDOM` path. Reuse the existing syntax-language mapping and copy UI, but bridge:

- CodeMirror document changes to ProseMirror transactions;
- CodeMirror selections to the outer editor selection;
- outer document updates back into CodeMirror;
- code-block exit and boundary navigation;
- undo/redo ownership.

There must be one authoritative history owner for each user action. Nested editors should not both record the same keystroke.

### 5. Give raw mode a Markdown-aware source adapter

A textarea can remain a temporary fallback, but it is a poor long-term foundation for Vim and structured input. A CodeMirror 6 Markdown source editor would provide line boundaries, selections, history, keymaps, and extension points already needed for this work. If the textarea remains, the pure source adapter still needs to own Enter, Tab, Backspace, selection edits, history, and line movement rather than mixing native and custom behavior unpredictably.

### 6. Promote mappings to commands

Keep compatibility with existing stored mappings, but normalize them into command IDs. A mapping should be able to declare:

- mode;
- key sequence;
- command;
- count/register/text-object arguments when applicable;
- allowed surface/context.

Unknown or conflicting mappings should be surfaced in settings instead of silently shadowing built-ins. Mapping validation should permit the sequences required by the chosen Vim tier while protecting reserved browser/system shortcuts.

## Verification matrix

| Scenario                                | Target result                                     | Current evidence/coverage                                                                 |
| --------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Preview: Enter in non-empty bullet      | New sibling bullet at same depth                  | Dependency source confirms the behavior; no focused application test.                     |
| Preview: Enter in empty bullet          | Lift out of current list level                    | Dependency source confirms the behavior; no focused application test.                     |
| Preview: repeated Enter                 | No phantom empty bullets or lost content          | Not covered by a dedicated test.                                                          |
| Preview: nested list exit               | Exit one level while preserving parent list       | Not covered by a dedicated test.                                                          |
| Preview: ordered/task/blockquote list   | Preserve syntax and structural depth              | Not covered by a dedicated test.                                                          |
| Raw: Enter after list item              | Continue marker and indentation                   | Pure `applyNoteRawEnter` tests cover unordered, ordered, and task markers.                |
| Raw: Enter on empty list item           | Remove marker and leave list level                | Pure source-command test covers empty marker exit.                                        |
| Raw: Enter in fenced code               | Insert literal newline only                       | Pure source-command test covers fenced-code protection.                                   |
| Preview code: Enter                     | Insert code newline                               | Existing code-block flow covers basic creation/editing.                                   |
| Preview code: Ctrl/Cmd-Enter            | Exit code block                                   | Focused code-navigation unit test covers the command.                                     |
| Preview code: boundary arrows           | Move between code and document at edges           | Focused unit tests cover horizontal boundaries; e2e scenarios are present.                |
| Vim preview: `j`/`k` in multi-line code | Move by code line                                 | Focused fake ProseMirror view test covers movement to the next physical line.             |
| Vim raw: first-line `k` / last-line `j` | Stay at boundary                                  | Focused raw helper test covers both no-op boundaries.                                     |
| Vim normal: unsupported arrow/key       | Natural fallback or deliberate documented command | Focused lint/test coverage protects narrow event ownership; full editor fallback remains. |
| Vim visual line in list/code            | Select the correct structural line                | Code-line selection is covered; list-item structural selection remains.                   |
| Preview/raw persistence                 | One edit produces one stable saved document       | Snapshot scheduling tests exist; cross-surface behavior matrix is incomplete.             |

The minimum implementation test suite should contain pure command tests for every list row and movement boundary, renderer integration tests for ProseMirror transactions, raw-editor integration tests for source edits, and a small Playwright Electron matrix for the user-visible sequences. The current pure/unit slice is in place; the e2e suite should focus on cross-surface behavior rather than duplicating every pure motion test once the local Electron runtime can launch.

## Acceptance criteria for implementation

The feature should not be considered complete until:

- all P0 scenarios in the matrix pass in preview, raw, and code contexts where applicable;
- non-empty list Enter creates a sibling and empty-list Enter exits exactly one list level;
- normal-mode Enter does not mutate the document unless explicitly assigned a command;
- code-block Enter, boundary arrows, and Mod/Ctrl-Enter work without triggering Markdown input rules;
- `j`/`k` and linewise selection use the correct logical line in paragraphs, lists, raw source, and code blocks;
- unsupported keys are not broadly swallowed;
- Escape, IME/composition, selection, undo, redo, and focus transitions preserve user content;
- preview and raw mode serialize to equivalent Markdown for the same user intent;
- custom mappings invoke command IDs and do not bypass structural safeguards;
- the behavior matrix is covered by targeted tests, not only manual inspection.

## Non-goals for the first implementation

The first implementation should not promise complete Vim emulation, macros, ex commands, or every third-party Markdown editor behavior. It should first establish reliable P0 structural editing and a coherent command boundary. P1/P2 features can then extend the same engine without replacing the movement and event model again.
