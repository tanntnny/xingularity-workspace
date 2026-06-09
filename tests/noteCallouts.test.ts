import { describe, expect, it } from 'vitest'
import {
  getNoteCalloutTitleRange,
  hasNoteCalloutBodyText,
  joinNoteCalloutTextblocks,
  parseNoteCallout,
  resolveNoteCallout
} from '../src/renderer/src/lib/noteCallouts'

describe('parseNoteCallout', () => {
  it('matches supported callout markers on their own first line', () => {
    expect(parseNoteCallout('[!INFO]\nBody')).toEqual({
      marker: '[!INFO]\n',
      rawType: 'INFO',
      variant: 'info'
    })
  })

  it('matches escaped markdown callout markers from stored note content', () => {
    expect(parseNoteCallout('\\[!info]\n\nTest callout')).toEqual({
      marker: '\\[!info]\n',
      rawType: 'info',
      variant: 'info'
    })
  })

  it('accepts escaped marker lines with markdown hard-break backslashes', () => {
    expect(parseNoteCallout('\\[!DANGER]\\\nTanny')).toEqual({
      marker: '\\[!DANGER]\\\n',
      rawType: 'DANGER',
      variant: 'danger'
    })
  })

  it('maps the common succes misspelling to success', () => {
    expect(parseNoteCallout('\\[!succes]\n\nTanny')).toEqual({
      marker: '\\[!succes]\n',
      rawType: 'succes',
      variant: 'success'
    })
  })

  it('maps error callouts to the danger variant', () => {
    expect(parseNoteCallout('[!ERROR]\nBody')).toEqual({
      marker: '[!ERROR]\n',
      rawType: 'ERROR',
      variant: 'danger'
    })
  })

  it('accepts marker-only callouts without body text', () => {
    expect(parseNoteCallout('[!SUCCESS]')).toEqual({
      marker: '[!SUCCESS]',
      rawType: 'SUCCESS',
      variant: 'success'
    })
  })

  it('falls back to a neutral variant for unknown callout types', () => {
    expect(parseNoteCallout('[!CUSTOM]\nBody')).toEqual({
      marker: '[!CUSTOM]\n',
      rawType: 'CUSTOM',
      variant: 'neutral'
    })
  })

  it('supports note callouts and only uses the first marker line as the trigger', () => {
    expect(parseNoteCallout('[!NOTE]\nThis is the note callout\n[!WARNING] stays in body')).toEqual(
      {
        marker: '[!NOTE]\n',
        rawType: 'NOTE',
        variant: 'neutral'
      }
    )
  })

  it('accepts body text after the marker on the same line', () => {
    expect(parseNoteCallout('[!INFO] Body')).toEqual({
      marker: '[!INFO] ',
      rawType: 'INFO',
      variant: 'info'
    })
  })

  it('keeps parsing the callout marker when later paragraphs are joined into the body', () => {
    expect(
      parseNoteCallout(joinNoteCalloutTextblocks(['[!WARNING] Warning test', 'Body text']))
    ).toEqual({
      marker: '[!WARNING] ',
      rawType: 'WARNING',
      variant: 'warning'
    })
  })

  it('does not convert marker-like text without a separator into a callout', () => {
    expect(parseNoteCallout('[!INFO]Body')).toBeNull()
  })

  it('does not convert normal blockquote text into a callout', () => {
    expect(parseNoteCallout('Just quoted text')).toBeNull()
  })
})

describe('resolveNoteCallout', () => {
  it('maps plain blockquote text to a neutral note callout', () => {
    expect(resolveNoteCallout('Just quoted text')).toEqual({
      marker: '',
      rawType: 'NOTE',
      variant: 'neutral'
    })
  })
})

describe('hasNoteCalloutBodyText', () => {
  it('keeps marker-only callouts editable by treating them as empty', () => {
    expect(hasNoteCalloutBodyText('[!warning]', '[!warning]')).toBe(false)
  })

  it('detects body text after marker-only callout syntax', () => {
    expect(hasNoteCalloutBodyText('[!warning]\nTanny', '[!warning]')).toBe(true)
  })

  it('detects body text in later quoted paragraphs after a blank line', () => {
    const text = joinNoteCalloutTextblocks(['[!warning] Warning test', 'Body text'])
    expect(hasNoteCalloutBodyText(text, '[!warning] ')).toBe(true)
  })
})

describe('getNoteCalloutTitleRange', () => {
  it('returns the same-line title range after the marker', () => {
    expect(getNoteCalloutTitleRange('[!INFO] Quick note', '[!INFO] ')).toEqual({
      start: 8,
      end: 18
    })
  })

  it('stops the title range before the first hard break in the textblock', () => {
    expect(getNoteCalloutTitleRange('[!INFO] Quick note\nBody', '[!INFO] ')).toEqual({
      start: 8,
      end: 18
    })
  })

  it('does not create a title range when the marker is on its own line', () => {
    expect(getNoteCalloutTitleRange('[!INFO]\nBody', '[!INFO]\n')).toBeNull()
  })
})

describe('joinNoteCalloutTextblocks', () => {
  it('preserves paragraph breaks between quoted textblocks', () => {
    expect(joinNoteCalloutTextblocks(['[!WARNING] Warning test', 'Body text'])).toBe(
      '[!WARNING] Warning test\n\nBody text'
    )
  })

  it('keeps later marker-like text inside the same body text', () => {
    expect(
      joinNoteCalloutTextblocks(['[!NOTE] Title', 'First paragraph', '[!WARNING] stays in body'])
    ).toBe('[!NOTE] Title\n\nFirst paragraph\n\n[!WARNING] stays in body')
  })

  it('supports escaped markers with multiline body content', () => {
    expect(joinNoteCalloutTextblocks(['\\[!warning] Warning test', 'Body text'])).toBe(
      '\\[!warning] Warning test\n\nBody text'
    )
  })
})
