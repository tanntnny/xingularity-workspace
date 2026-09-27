import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const editorSource = readFileSync(
  new URL('../src/renderer/src/components/Editor.tsx', import.meta.url),
  'utf8'
)

describe('note editor link completion', () => {
  it('uses source-owned CodeMirror completion for note mentions', () => {
    expect(editorSource).toContain('autocompletion({ override: [completionSource]')
    expect(editorSource).toContain('context.matchBefore(/\\[\\[[^\\]\\n]*/')
    expect(editorSource).toContain('const insert = `[[${note.relPath}]]`')
    expect(editorSource).toContain('noteMentionHref(targetRelPath)')
    expect(editorSource).toContain('noteResolverRef.current(explicitTarget)')
  })
})
