import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const editorSource = readFileSync(
  new URL('../src/renderer/src/components/Editor.tsx', import.meta.url),
  'utf8'
)

describe('note editor link popover', () => {
  it('uses the shared selection popover for note mention completion', () => {
    expect(editorSource).toContain('options={mentionOptions}')
    expect(editorSource).toContain('onValueChange={handleMentionSelect}')
    expect(editorSource).toContain('onSearchValueChange={handleMentionSearchValueChange}')
    expect(editorSource).toContain('const href = noteMentionHref(targetRelPath)')
    expect(editorSource).not.toContain('const href = noteMentionHref(fallbackLabel)')
    expect(editorSource).toContain('testId="note-link-completion"')
    expect(editorSource).toContain('selectOnTab')
    expect(editorSource).toContain('hideTrigger')
    expect(editorSource).toContain('dismissedMentionTriggerRef')
    expect(editorSource).toContain('dismissedTrigger.from === triggerStart')
    expect(editorSource).toContain(
      'style={{ top: mentionPicker?.top ?? 0, left: mentionPicker?.left ?? 0 }}'
    )
    expect(editorSource).not.toContain('Link2')
  })
})
