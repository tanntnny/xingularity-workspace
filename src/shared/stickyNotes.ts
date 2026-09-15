import type { StickyNoteBoardState, StickyNoteColor, StickyNoteItem } from './types'

export const STICKY_NOTE_COLORS = [
  'yellow',
  'pink',
  'blue',
  'green',
  'orange',
  'purple'
] as const satisfies readonly StickyNoteColor[]

export const STICKY_NOTE_MIN_WIDTH = 180
export const STICKY_NOTE_MIN_HEIGHT = 160
export const STICKY_NOTE_MAX_SIZE = 10_000
export const STICKY_NOTE_MAX_TEXT_LENGTH = 20_000
export const STICKY_NOTE_MAX_COUNT = 500
export const STICKY_NOTE_FONT_SIZE = 24
export const STICKY_NOTE_FONT_WEIGHT = 500

export const DEFAULT_STICKY_NOTE_BOARD: StickyNoteBoardState = {
  viewport: {
    x: 0,
    y: 0,
    zoom: 1
  },
  notes: []
}

export function createDefaultStickyNoteBoard(): StickyNoteBoardState {
  return {
    viewport: { ...DEFAULT_STICKY_NOTE_BOARD.viewport },
    notes: []
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function isStickyNoteColor(value: unknown): value is StickyNoteColor {
  return typeof value === 'string' && STICKY_NOTE_COLORS.includes(value as StickyNoteColor)
}

function normalizeStickyNote(value: unknown): StickyNoteItem | null {
  if (!isRecord(value)) {
    return null
  }

  const position = value.position
  const size = value.size
  if (
    typeof value.id !== 'string' ||
    !value.id.trim() ||
    typeof value.text !== 'string' ||
    !isStickyNoteColor(value.color) ||
    !isRecord(position) ||
    !isRecord(size) ||
    typeof position.x !== 'number' ||
    !Number.isFinite(position.x) ||
    typeof position.y !== 'number' ||
    !Number.isFinite(position.y) ||
    typeof size.width !== 'number' ||
    !Number.isFinite(size.width) ||
    typeof size.height !== 'number' ||
    !Number.isFinite(size.height) ||
    typeof value.zIndex !== 'number' ||
    !Number.isFinite(value.zIndex)
  ) {
    return null
  }

  return {
    id: value.id.trim(),
    text: value.text.slice(0, STICKY_NOTE_MAX_TEXT_LENGTH),
    color: value.color,
    position: {
      x: position.x,
      y: position.y
    },
    size: {
      width: clamp(size.width, STICKY_NOTE_MIN_WIDTH, STICKY_NOTE_MAX_SIZE),
      height: clamp(size.height, STICKY_NOTE_MIN_HEIGHT, STICKY_NOTE_MAX_SIZE)
    },
    zIndex: clamp(Math.round(value.zIndex), 0, 10_000)
  }
}

export function normalizeStickyNoteBoard(input: unknown): StickyNoteBoardState {
  if (!isRecord(input) || !Array.isArray(input.notes)) {
    return createDefaultStickyNoteBoard()
  }

  const viewport = isRecord(input.viewport) ? input.viewport : {}
  return {
    viewport: {
      x: finiteOr(viewport.x, DEFAULT_STICKY_NOTE_BOARD.viewport.x),
      y: finiteOr(viewport.y, DEFAULT_STICKY_NOTE_BOARD.viewport.y),
      zoom: clamp(finiteOr(viewport.zoom, DEFAULT_STICKY_NOTE_BOARD.viewport.zoom), 0.2, 4)
    },
    notes: input.notes.slice(0, STICKY_NOTE_MAX_COUNT).flatMap((note) => {
      const normalized = normalizeStickyNote(note)
      return normalized ? [normalized] : []
    })
  }
}
