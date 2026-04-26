export type NoteCalloutVariant = 'info' | 'success' | 'warning' | 'danger' | 'neutral'

export interface NoteCalloutMatch {
  marker: string
  rawType: string
  variant: NoteCalloutVariant
}

const CALLOUT_MARKER_PATTERN = /^\\?\[!([A-Z0-9_-]+)\](?:[ \t\\]*(?:\n|$)|[ \t]+)/i

const CALLOUT_VARIANT_BY_TYPE: Record<string, Exclude<NoteCalloutVariant, 'neutral'>> = {
  info: 'info',
  succes: 'success',
  success: 'success',
  warning: 'warning',
  danger: 'danger'
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

export function hasNoteCalloutBodyText(text: string, marker: string): boolean {
  if (!marker) {
    return text.trim().length > 0
  }

  return text.slice(marker.length).trim().length > 0
}
