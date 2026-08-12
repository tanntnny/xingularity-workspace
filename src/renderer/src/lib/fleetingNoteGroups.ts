import type { FleetingNote } from '../../../shared/types'

export const FLEETING_NOTE_GROUPS = [
  { id: 'today', label: 'Today' },
  { id: 'this-week', label: 'This Week' },
  { id: 'this-month', label: 'This Month' },
  { id: 'before-this-month', label: 'Before This Month' }
] as const

export type FleetingNoteGroupId = (typeof FLEETING_NOTE_GROUPS)[number]['id']

export interface FleetingNoteGroup {
  id: FleetingNoteGroupId
  label: string
  notes: FleetingNote[]
}

const FLEETING_NOTE_GROUP_COLOR_STYLES: Record<
  FleetingNoteGroupId,
  { backgroundColor: string; borderColor: string }
> = {
  today: {
    backgroundColor: 'var(--capture-group-today-bg)',
    borderColor: 'var(--capture-group-today-border)'
  },
  'this-week': {
    backgroundColor: 'var(--capture-group-this-week-bg)',
    borderColor: 'var(--capture-group-this-week-border)'
  },
  'this-month': {
    backgroundColor: 'var(--capture-group-this-month-bg)',
    borderColor: 'var(--capture-group-this-month-border)'
  },
  'before-this-month': {
    backgroundColor: 'var(--capture-group-before-this-month-bg)',
    borderColor: 'var(--capture-group-before-this-month-border)'
  }
}

export function getFleetingNoteGroupColorStyles(group: Pick<FleetingNoteGroup, 'id'>): {
  backgroundColor: string
  borderColor: string
} {
  return FLEETING_NOTE_GROUP_COLOR_STYLES[group.id]
}

export function groupFleetingNotes(notes: FleetingNote[], now = new Date()): FleetingNoteGroup[] {
  const today = startOfLocalDay(now)
  const weekStart = startOfLocalWeek(today)
  const weekEnd = addDays(weekStart, 7)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  const grouped = new Map<FleetingNoteGroupId, FleetingNote[]>()

  for (const group of FLEETING_NOTE_GROUPS) {
    grouped.set(group.id, [])
  }

  for (const note of notes) {
    const createdAt = new Date(note.createdAt)
    const createdDay = Number.isNaN(createdAt.getTime()) ? null : startOfLocalDay(createdAt)
    const groupId = getGroupId(createdDay, today, weekStart, weekEnd, monthStart, monthEnd)
    grouped.get(groupId)?.push(note)
  }

  return FLEETING_NOTE_GROUPS.map((group) => ({
    ...group,
    notes: [...(grouped.get(group.id) ?? [])].sort(
      (left, right) => getTimestamp(right.createdAt) - getTimestamp(left.createdAt)
    )
  }))
}

function getGroupId(
  createdDay: Date | null,
  today: Date,
  weekStart: Date,
  weekEnd: Date,
  monthStart: Date,
  monthEnd: Date
): FleetingNoteGroupId {
  if (!createdDay) {
    return 'before-this-month'
  }

  if (createdDay.getTime() === today.getTime()) {
    return 'today'
  }

  if (createdDay >= weekStart && createdDay < weekEnd) {
    return 'this-week'
  }

  if (createdDay >= monthStart && createdDay < monthEnd) {
    return 'this-month'
  }

  return 'before-this-month'
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function startOfLocalWeek(value: Date): Date {
  return addDays(value, -value.getDay())
}

function addDays(value: Date, amount: number): Date {
  const result = new Date(value)
  result.setDate(result.getDate() + amount)
  return result
}

function getTimestamp(value: string): number {
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp
}
