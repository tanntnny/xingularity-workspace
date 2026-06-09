export type NoteCalloutVariant = 'info' | 'success' | 'warning' | 'danger' | 'neutral'

export interface NoteCalloutMatch {
  marker: string
  rawType: string
  variant: NoteCalloutVariant
}

export interface NoteCalloutTitleRange {
  start: number
  end: number
}

const CALLOUT_MARKER_PATTERN = /^\\?\[!([A-Z0-9_-]+)\](?:[ \t\\]*(?:\n|$)|[ \t]+)/i

const CALLOUT_VARIANT_BY_TYPE: Record<string, Exclude<NoteCalloutVariant, 'neutral'>> = {
  info: 'info',
  succes: 'success',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  error: 'danger'
}

export function parseNoteCallout(text: string): NoteCalloutMatch | null {
  const match = text.match(CALLOUT_MARKER_PATTERN)
  if (!match) {
    return null
  }

  const rawType = match[1] ?? ''
  const normalizedType = rawType.trim().toLowerCase()
  const variant = CALLOUT_VARIANT_BY_TYPE[normalizedType]

  return {
    marker: match[0],
    rawType,
    variant: variant ?? 'neutral'
  }
}

export function resolveNoteCallout(text: string): NoteCalloutMatch {
  return (
    parseNoteCallout(text) ?? {
      marker: '',
      rawType: 'NOTE',
      variant: 'neutral'
    }
  )
}

export function joinNoteCalloutTextblocks(textblocks: string[]): string {
  return textblocks.join('\n\n')
}

export function hasNoteCalloutBodyText(text: string, marker: string): boolean {
  if (!marker) {
    return text.trim().length > 0
  }

  return text.slice(marker.length).trim().length > 0
}

export function getNoteCalloutTitleRange(
  text: string,
  marker: string
): NoteCalloutTitleRange | null {
  if (!marker || marker.includes('\n')) {
    return null
  }

  const start = marker.length
  const lineBreakIndex = text.indexOf('\n', start)
  const end = lineBreakIndex === -1 ? text.length : lineBreakIndex

  if (text.slice(start, end).trim().length === 0) {
    return null
  }

  return { start, end }
}
