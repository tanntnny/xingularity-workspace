import { describe, expect, it } from 'vitest'
import { splitNoteContent } from '../src/shared/noteContent'
import {
  createStoredNoteDocumentFromText,
  serializeStoredNoteDocument
} from '../src/shared/noteDocument'

describe('note content helpers', () => {
  it('keeps tag frontmatter out of the editable body', () => {
    const serialized = serializeStoredNoteDocument(
      createStoredNoteDocumentFromText('Body text', ['alpha', 'beta'])
    )

    expect(serialized).toContain('tags: [alpha, beta]')
    expect(splitNoteContent(serialized).body).toBe('Body text')
  })
})
