import { describe, expect, it } from 'vitest'
import { migrateMarkdownIndentationToTabs } from '../src/renderer/src/lib/noteIndentationMigration'

describe('migrateMarkdownIndentationToTabs', () => {
  it('converts structural list and quote indentation while preserving residual alignment spaces', () => {
    const source = [
      '- Parent',
      '  continuation',
      '    - Child',
      '> Quote',
      '  > Nested quote',
      '   - Odd residual'
    ].join('\n')

    const result = migrateMarkdownIndentationToTabs(source)

    expect(result.content).toBe(
      [
        '- Parent',
        '\tcontinuation',
        '\t\t- Child',
        '> Quote',
        '\t> Nested quote',
        '\t - Odd residual'
      ].join('\n')
    )
    expect(result.changedLineCount).toBe(4)
    expect(result.convertedUnitCount).toBe(5)
    expect(result.skippedCodeBlockLineCount).toBe(0)
    expect(result.skippedAmbiguousLineCount).toBe(0)
  })

  it('leaves fenced and indented code blocks unchanged', () => {
    const source = [
      '  - Before',
      '```ts',
      '    - inside fence',
      '```',
      '    - inside indented code',
      '    inside indented code',
      '  - After'
    ].join('\n')

    const result = migrateMarkdownIndentationToTabs(source)

    expect(result.content).toBe(
      [
        '\t- Before',
        '```ts',
        '    - inside fence',
        '```',
        '    - inside indented code',
        '    inside indented code',
        '\t- After'
      ].join('\n')
    )
    expect(result.skippedCodeBlockLineCount).toBe(5)
  })

  it('skips ambiguous mixed leading whitespace and preserves existing tabs', () => {
    const source = ['- Parent', ' \t- Mixed', '\t\t- Existing tabs', '  - Converted'].join('\n')

    const result = migrateMarkdownIndentationToTabs(source)

    expect(result.content).toBe(
      ['- Parent', ' \t- Mixed', '\t\t- Existing tabs', '\t- Converted'].join('\n')
    )
    expect(result.skippedAmbiguousLineCount).toBe(1)
    expect(result.convertedUnitCount).toBe(1)
  })

  it('preserves newline style and is idempotent', () => {
    const source = '  - First\r\n    - Second\r\n'
    const first = migrateMarkdownIndentationToTabs(source)
    const second = migrateMarkdownIndentationToTabs(first.content)

    expect(first.content).toBe('\t- First\r\n\t\t- Second\r\n')
    expect(second.content).toBe(first.content)
    expect(second.changedLineCount).toBe(0)
    expect(second.convertedUnitCount).toBe(0)
  })

  it('does not rewrite unrelated paragraph indentation', () => {
    const source = '  paragraph\n\n- item'
    const result = migrateMarkdownIndentationToTabs(source)

    expect(result.content).toBe(source)
    expect(result.changedLineCount).toBe(0)
  })
})
