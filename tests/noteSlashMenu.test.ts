import { describe, expect, it } from 'vitest'
import {
  findNoteSlashTrigger,
  getNoteSlashCommands,
  NOTE_SLASH_COMMANDS
} from '../src/renderer/src/lib/noteSlashMenu'

describe('findNoteSlashTrigger', () => {
  it('matches a slash trigger at the start of a line', () => {
    expect(findNoteSlashTrigger('/h2')).toEqual({
      query: 'h2',
      triggerStartOffset: 0
    })
  })

  it('matches a slash trigger after leading spaces only', () => {
    expect(findNoteSlashTrigger('  /bullet')).toEqual({
      query: 'bullet',
      triggerStartOffset: 2
    })
  })

  it('does not match when slash is in the middle of text', () => {
    expect(findNoteSlashTrigger('alpha /h2')).toBeNull()
  })

  it('does not match when the query contains spaces', () => {
    expect(findNoteSlashTrigger('/heading 2')).toBeNull()
  })
})

describe('getNoteSlashCommands', () => {
  it('returns the full ordered command set for an empty query', () => {
    expect(getNoteSlashCommands('')).toEqual(NOTE_SLASH_COMMANDS)
  })

  it('filters commands by label and keyword aliases', () => {
    expect(getNoteSlashCommands('h2').map((command) => command.id)).toEqual(['heading2'])
    expect(getNoteSlashCommands('bullet').map((command) => command.id)).toEqual(['bulletList'])
    expect(getNoteSlashCommands('todo').map((command) => command.id)).toEqual(['taskList'])
  })

  it('returns no commands for unknown queries', () => {
    expect(getNoteSlashCommands('definitely-missing')).toEqual([])
  })
})
