import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const stylesheet = readFileSync(
  new URL('../src/renderer/src/assets/main.css', import.meta.url),
  'utf8'
)

describe('note editor selection styling', () => {
  it('uses the shared blue selection colors for Milkdown text selection', () => {
    expect(stylesheet).toContain(
      '--selection-background: color-mix(in srgb, var(--accent) 58%, transparent);'
    )
    expect(stylesheet).toContain('--selection-foreground: var(--accent-foreground);')
    expect(stylesheet).toContain('--note-editor-selection: var(--selection-background);')
    expect(stylesheet).toContain('--note-editor-selection-foreground: var(--selection-foreground);')
    expect(stylesheet).toContain(
      '.note-editor-surface .milkdown .ProseMirror {\n    caret-color: var(--foreground);'
    )
    expect(stylesheet).toContain(
      '.note-editor-surface .milkdown *::selection {\n    background: var(--note-editor-selection) !important;\n    color: var(--note-editor-selection-foreground) !important;\n  }'
    )
    expect(stylesheet).toContain('--note-editor-cursor: var(--note-editor-selection);')
    expect(stylesheet).toContain(
      '--note-editor-cursor-foreground: var(--note-editor-selection-foreground);'
    )
    expect(stylesheet).toContain('--crepe-color-selected: var(--note-editor-ui-selection);')
    expect(stylesheet).toContain('background: var(--popover) !important;')
    expect(stylesheet).toContain('color: var(--popover-foreground) !important;')
    expect(stylesheet).toContain(".note-editor-popover [cmdk-item][data-selected='true']")
  })
})
