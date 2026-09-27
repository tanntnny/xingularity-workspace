import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const stylesheet = readFileSync(
  new URL('../src/renderer/src/assets/main.css', import.meta.url),
  'utf8'
)
const editorSource = readFileSync(
  new URL('../src/renderer/src/components/Editor.tsx', import.meta.url),
  'utf8'
)

describe('note editor selection styling', () => {
  it('uses the shared blue selection colors for CodeMirror text selection', () => {
    expect(stylesheet).toContain(
      '--selection-background: color-mix(in srgb, var(--accent) 58%, transparent);'
    )
    expect(stylesheet).toContain('--selection-foreground: var(--accent-foreground);')
    expect(stylesheet).toContain('--note-editor-selection: var(--selection-background);')
    expect(stylesheet).toContain('--note-editor-selection-foreground: var(--selection-foreground);')
    expect(stylesheet).toContain(
      '--note-editor-blinking-cursor: color-mix(in srgb, var(--accent) 45%, white);'
    )
    expect(editorSource).toContain("'.cm-cursor'")
    expect(editorSource).toContain(
      "borderLeftColor: 'var(--note-editor-blinking-cursor) !important'"
    )
    expect(editorSource).toContain("'.cm-dropCursor'")
    expect(editorSource).toContain("borderLeftColor: 'var(--note-editor-cursor) !important'")
    expect(editorSource).toContain("'.cm-fat-cursor'")
    expect(editorSource).toContain("backgroundColor: 'var(--note-editor-cursor) !important'")
    expect(editorSource).toContain("color: 'var(--note-editor-cursor-foreground) !important'")
    expect(editorSource).toContain("caretColor: 'var(--note-editor-blinking-cursor)'")
    expect(editorSource).toContain("'&.cm-focused .cm-selectionBackground, ::selection'")
    expect(stylesheet).toContain(".note-codemirror-editor [data-mode='source'] .cm-editor")
    expect(stylesheet).toContain('--note-editor-cursor: var(--note-editor-selection);')
    expect(stylesheet).toContain(
      '--note-editor-cursor-foreground: var(--note-editor-selection-foreground);'
    )
    expect(stylesheet).toContain('.note-codemirror-editor .cm-placeholder')
  })
})
