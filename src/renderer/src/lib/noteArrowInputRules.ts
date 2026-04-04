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

export function replaceTrailingArrowSequence(text: string): string {
  for (const { sequence, replacement } of NOTE_ARROW_REPLACEMENTS) {
    if (text.endsWith(sequence)) {
      return `${text.slice(0, -sequence.length)}${replacement}`
    }
  }

  return text
}
