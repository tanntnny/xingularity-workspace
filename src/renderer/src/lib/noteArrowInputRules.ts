export const NOTE_ARROW_REPLACEMENTS = [
  { sequence: '⇐=>', replacement: '⟺' },
  { sequence: '⟸>', replacement: '⟺' },
  { sequence: '←->', replacement: '⟷' },
  { sequence: '⟵>', replacement: '⟷' },
  { sequence: '<==>', replacement: '⟺' },
  { sequence: '<-->', replacement: '⟷' },
  { sequence: '!==', replacement: '≢' },
  { sequence: '≠=', replacement: '≢' },
  { sequence: '<=>', replacement: '⇔' },
  { sequence: '⇐>', replacement: '⇔' },
  { sequence: '<->', replacement: '↔' },
  { sequence: '←>', replacement: '↔' },
  { sequence: '<==', replacement: '⟸' },
  { sequence: '⇐=', replacement: '⟸' },
  { sequence: '==>', replacement: '⟹' },
  { sequence: '<--', replacement: '⟵' },
  { sequence: '←-', replacement: '⟵' },
  { sequence: '-->', replacement: '⟶' },
  { sequence: '===', replacement: '≡' },
  { sequence: '=>', replacement: '⇒' },
  { sequence: '<=', replacement: '⇐' },
  { sequence: '->', replacement: '→' },
  { sequence: '<-', replacement: '←' },
  { sequence: '!=', replacement: '≠' },
  { sequence: '>=', replacement: '≥' }
] as const

export interface NoteArrowReplacementMatch {
  sequence: (typeof NOTE_ARROW_REPLACEMENTS)[number]['sequence']
  replacement: (typeof NOTE_ARROW_REPLACEMENTS)[number]['replacement']
}

export function findTrailingArrowReplacement(text: string): NoteArrowReplacementMatch | null {
  for (const { sequence, replacement } of NOTE_ARROW_REPLACEMENTS) {
    if (text.endsWith(sequence)) {
      return { sequence, replacement }
    }
  }

  return null
}

export function replaceTrailingArrowSequence(text: string): string {
  const match = findTrailingArrowReplacement(text)
  if (!match) {
    return text
  }

  return `${text.slice(0, -match.sequence.length)}${match.replacement}`
}

export function resolveArrowReplacementForTextInput(input: {
  textBeforeCursor: string
  insertedText: string
  isCodeText?: boolean
}): { deletePreviousTextLength: number; replacement: string } | null {
  const { insertedText, isCodeText = false, textBeforeCursor } = input
  if (isCodeText || insertedText.length === 0) {
    return null
  }

  const match = findTrailingArrowReplacement(`${textBeforeCursor}${insertedText}`)
  if (!match) {
    return null
  }

  return {
    deletePreviousTextLength: Math.max(0, match.sequence.length - insertedText.length),
    replacement: match.replacement
  }
}
