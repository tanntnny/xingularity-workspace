import { describe, expect, it } from 'vitest'
import type { FleetingNote } from '../src/shared/types'
import {
  FLEETING_NOTE_GROUPS,
  getFleetingNoteGroupColorStyles,
  groupFleetingNotes
} from '../src/renderer/src/lib/fleetingNoteGroups'

function createNote(id: string, createdAt: Date | string): FleetingNote {
  const timestamp = typeof createdAt === 'string' ? createdAt : createdAt.toISOString()

  return {
    type: 'fleeting',
    id,
    relPath: `${id}.md`,
    content: id,
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

describe('groupFleetingNotes', () => {
  it('assigns each review period its own friendly capture color', () => {
    expect(
      FLEETING_NOTE_GROUPS.map((group) => getFleetingNoteGroupColorStyles(group).backgroundColor)
    ).toEqual([
      'var(--capture-group-today-bg)',
      'var(--capture-group-this-week-bg)',
      'var(--capture-group-this-month-bg)',
      'var(--capture-group-before-this-month-bg)'
    ])

    expect(
      FLEETING_NOTE_GROUPS.map((group) => getFleetingNoteGroupColorStyles(group).borderColor)
    ).toEqual([
      'var(--capture-group-today-border)',
      'var(--capture-group-this-week-border)',
      'var(--capture-group-this-month-border)',
      'var(--capture-group-before-this-month-border)'
    ])
  })

  it('groups notes by local creation period and sorts each group newest first', () => {
    const now = new Date(2026, 7, 11, 12, 0, 0)
    const notes = [
      createNote('before-month', new Date(2026, 6, 31, 23, 59, 0)),
      createNote('this-month', new Date(2026, 7, 1, 9, 0, 0)),
      createNote('this-week', new Date(2026, 7, 10, 9, 0, 0)),
      createNote('today-old', new Date(2026, 7, 11, 9, 0, 0)),
      createNote('today-new', new Date(2026, 7, 11, 11, 0, 0))
    ]

    expect(
      groupFleetingNotes(notes, now).map((group) => [group.id, group.notes.map((note) => note.id)])
    ).toEqual([
      ['today', ['today-new', 'today-old']],
      ['this-week', ['this-week']],
      ['this-month', ['this-month']],
      ['before-this-month', ['before-month']]
    ])
  })

  it('keeps all four columns and assigns boundary dates to their current period', () => {
    const now = new Date(2026, 7, 11, 12, 0, 0)
    const groups = groupFleetingNotes(
      [
        createNote('start-of-today', new Date(2026, 7, 11, 0, 0, 0)),
        createNote('start-of-week', new Date(2026, 7, 9, 0, 0, 0)),
        createNote('start-of-month', new Date(2026, 7, 1, 0, 0, 0)),
        createNote('invalid', 'not-a-timestamp')
      ],
      now
    )

    expect(groups).toHaveLength(4)
    expect(groups.map((group) => group.notes.map((note) => note.id))).toEqual([
      ['start-of-today'],
      ['start-of-week'],
      ['start-of-month'],
      ['invalid']
    ])
  })
})
