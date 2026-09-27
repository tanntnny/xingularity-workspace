# Note editor interaction behavior

## Status

The note editor is source-owned. One CodeMirror 6 `EditorState` holds the exact Markdown text for both Live Preview and Source modes. Changing modes reconfigures decorations on the same document; it does not parse and serialize Markdown or copy content between editors.

This replaces the former Milkdown/ProseMirror preview, raw `textarea`, custom Vim interpreter, and special code-block navigation layers.

## Ownership map

| Concern                                 | Owner                                                                                            | Contract                                                                                                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document text, selection, history, undo | `components/Editor.tsx`, CodeMirror 6                                                            | One exact source string and one editor history across Live Preview and Source modes.                                                                                                                          |
| Live Preview rendering                  | `lib/noteLivePreview.ts`                                                                         | Inactive Markdown syntax is decorated or replaced; the line containing the cursor and every physical line covered by the active selection show their source.                                                  |
| Vim                                     | `@replit/codemirror-vim` configured by `Editor.tsx`                                              | Motions, operators, counts, registers, visual modes, and undo use the established CodeMirror Vim implementation; a narrow editor bridge only lets simple boundary motions enter rendered fenced blocks. |
| Markdown tables                         | `components/MarkdownTableView.tsx`, `lib/noteMarkdownTable.ts`, `lib/noteLivePreview.ts`         | Inactive tables render as a React-backed cell-selection grid; every edit is a CodeMirror source transaction.                                                                                                  |
| Markdown code blocks                    | `components/MarkdownCodeBlockView.tsx`, `lib/noteMarkdownCodeBlock.ts`, `lib/noteLivePreview.ts` | Inactive fenced blocks render as full-width React-backed widgets; when the cursor or selection touches a block, its source lines remain editable in CodeMirror inside the same bordered, rounded, padded shell and the fence lines are revealed. |
| Persistence                             | `NoteEditorSnapshot` and the existing note save coordinator                                      | Snapshots are `state.doc.toString()` without Markdown normalization.                                                                                                                                          |
| PDF export                              | `main/notePdfExport.ts`                                                                          | The main process rereads canonical Markdown, renders deterministic print HTML, waits for fonts, and prints that document.                                                                                     |

## Source fidelity and line breaks

Physical newlines are never expanded with `join('\n\n')` and Live Preview no longer reserializes a structural document. Therefore switching modes, moving the cursor, or saving an untouched note cannot turn one source newline into two.

Enter delegates to CodeMirror's Markdown commands, including normal list continuation. Shift-Enter inserts a Markdown hard break (`two spaces + newline`); inside a recognized unordered, ordered, task, or nested list item, it also inserts calculated continuation indentation aligned to the item's text column. Outside list items, it keeps the plain hard-break behavior. Blank lines remain exactly as authored. Visual spacing comes from CSS rather than hidden source mutations.

All CodeMirror editors use a shared literal-tab indentation unit displayed at four columns. Tab adds one literal tab to each selected line, Shift-Tab removes one unit, and smart Backspace removes one unit at the start of an indented line. This applies to Markdown lists, task lists, blockquotes, fenced code, automatic Enter indentation, and schedule code editors. Vim indentation commands use the same unit. Existing source text is not normalized automatically; the command palette provides an explicit current-note conversion from eligible legacy two-space indentation to tabs. Fenced and indented code blocks, ambiguous mixed whitespace, and unrelated paragraph indentation remain unchanged by that conversion.

Rendered Markdown uses the Xingularity dialect: Setext headings are disabled, so a dash-only line under text is not an underline; explicit `#` headings remain headings, and `---` remains a horizontal rule. Single underscore pairs underline text (`_text_`), asterisk pairs remain italic (`*text*`), and double underscores remain bold (`__text__`). Raw Markdown persistence and export preserve the original source syntax without migration.

## Live Preview contract

- The cursor line generally exposes its raw Markdown markers. List prefixes are an exception:
  `-`, `*`, and `+` render as `•`, ordered prefixes render as visual numbers, and task prefixes
  render as interactive checkboxes. Each occupies one measured editor-tab-width marker slot, so
  list text aligns with a continuation line beginning with a literal tab. When the cursor or
  selection touches a bullet or ordered marker token, that raw token is revealed and centered in
  the same slot; separator whitespace remains hidden so the list text does not shift. Task
  checkboxes remain centered in the slot and continue to update the underlying `[ ]` source.
- Revealing source keeps the line's semantic typography and measured height stable, so mouse hit-testing and the visible caret stay aligned.
- Inactive lines render headings, emphasis, strong text, strike-through, inline code, links, note mentions, lists, task checkboxes, blockquotes, horizontal rules, images, LaTeX, and GFM tables. Fenced code always keeps a full-width bordered and rounded shell with code padding and a copy control. Inactive blocks hide their fence markers and show a horizontally scrolling read-only preview; active blocks keep the same shell, reveal the opening and closing fence lines, and leave the complete source editable in the outer CodeMirror editor. Copying excludes the fence markers, switches to a check icon for two seconds, and then returns to the copy icon. Trailing empty body lines remain visible as code rows.
- Typing exactly three backticks on an otherwise empty fence line immediately inserts an empty body line and the matching closing fence, then places the caret in the body. Existing language-suffixed fences can still be completed with Enter, while tildes and typed closing fences are not auto-completed.
- Backspace or Delete in an empty fenced body removes the whole block. A selection that crosses any part of one or more fenced blocks expands to remove those complete blocks, including their fence markers.
- Moving the cursor into a rendered table reveals its raw source. Moving outside the table renders the grid.
- Clicking a rendered task checkbox dispatches a source change; it does not maintain separate widget state.
- Source mode disables Live Preview decorations without replacing the document or resetting history.

## Vim contract

When Vim is enabled, the editor begins in normal mode and uses `@replit/codemirror-vim`. Application settings may add mappings to the adapter. The editor only bridges simple `j`/`k`/arrow/`h`/`l` motions at the edge of an inactive rendered code block; once the block is revealed, CodeMirror Vim owns the complete fenced source normally while its visual shell remains in place.

Rendered table cells provide a small spreadsheet navigation surface because focus is inside a widget rather than the CodeMirror text cursor. Arrow keys and `h`/`j`/`k`/`l` move between cells, Tab and Shift-Tab move through the grid, and Shift extends a rectangular selection. Enter, `i`, or double-click enters native text editing in one cell; Escape commits the draft and returns to cell selection.

All other Markdown stays in CodeMirror and inherits normal Vim semantics. A rendered fenced block is a read-only preview surface; clicking it or entering it with a simple boundary motion reveals the raw fenced source in the outer editor without removing the code-block shell, so Vim insert/normal/visual behavior applies to the complete block, including its opening and closing fence lines.

## Table contract

The rendered table uses a single rectangular cell selection. A click selects one cell, pointer dragging or Shift-click/Shift-arrow extends the rectangle, and double-click enters text selection in one cell without painting the whole cell. Copy and cut use TSV; Delete/Backspace clears contents while preserving table shape; paste expands rows and columns as needed. The context menu supports copy, cut, clear, row/column insertion and deletion, and table removal. Header rows cannot be deleted, and at least one column is always retained. Every operation serializes back through the CodeMirror source transaction, preserving a valid GFM delimiter row and escaping cell pipes. Table recognition skips fenced code blocks.

## PDF contract

Single-note PDF export accepts only a vault-relative note path. The main process reads the note immediately before export and renders Markdown with the same GFM pipeline used by folder PDF export. Images under the vault are embedded as data URLs. Print CSS owns page width, typography, table wrapping, code wrapping, and page-break behavior, avoiding renderer DOM measurements and font-dependent element collisions.

## Verification targets

- Live Preview → Source → Live Preview preserves the exact source string and undo history.
- One Enter produces one physical newline unless Markdown list continuation or Shift-Enter semantics explicitly add syntax; Shift-Enter list continuation preserves the calculated list text column.
- Standard Vim word/line motions behave identically in paragraphs and fenced code.
- Rendered table edits and structural actions produce valid, immediately saved Markdown.
- PDF export uses a fresh disk read and does not accept renderer-supplied HTML.
