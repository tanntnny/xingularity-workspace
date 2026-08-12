import { describe, expect, it } from 'vitest'
import { buildRenamedNotebookPath } from '../src/renderer/src/lib/notebookPathRename'

describe('buildRenamedNotebookPath', () => {
  it('normalizes a drawing base name and preserves its folder', () => {
    expect(
      buildRenamedNotebookPath(
        'projects/sketch.excalidraw',
        '  renamed-drawing.excalidraw.excalidraw  ',
        'excalidraw'
      )
    ).toBe('projects/renamed-drawing.excalidraw')
  })

  it('adds the note extension for note renames', () => {
    expect(buildRenamedNotebookPath('notes/today.md', 'tomorrow', 'note')).toBe('notes/tomorrow.md')
  })

  it('returns null for empty, unsafe, or unchanged names', () => {
    expect(buildRenamedNotebookPath('sketch.excalidraw', '   ', 'excalidraw')).toBeNull()
    expect(buildRenamedNotebookPath('sketch.excalidraw', '../other', 'excalidraw')).toBeNull()
    expect(buildRenamedNotebookPath('sketch.excalidraw', 'sketch', 'excalidraw')).toBeNull()
  })
})
