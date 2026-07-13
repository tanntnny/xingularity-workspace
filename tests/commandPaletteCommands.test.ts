import { describe, expect, it } from 'vitest'
import { filterCommandPaletteCommands } from '../src/renderer/src/lib/commandPaletteCommands'

const COMMANDS = [
  {
    value: '>new note',
    label: 'New Note',
    keywords: ['create', 'note']
  },
  {
    value: '>go knowledge',
    label: 'Go to Knowledge',
    keywords: ['graph', 'knowledge']
  },
  {
    value: '>go projects',
    label: 'Go to Projects',
    keywords: ['project', 'workspace']
  },
  {
    value: '>go settings',
    label: 'Go to Settings',
    keywords: ['preferences', 'config']
  },
  {
    value: '>warp open current note folder',
    label: 'Warp: Open Current Note Folder',
    keywords: ['warp', 'terminal', 'shell', 'cwd', 'folder', 'current note']
  }
] as const

describe('filterCommandPaletteCommands', () => {
  it('returns all commands for an empty query', () => {
    expect(filterCommandPaletteCommands([...COMMANDS], '')).toEqual(COMMANDS)
  })

  it('matches commands by label words and value text', () => {
    expect(
      filterCommandPaletteCommands([...COMMANDS], 'settings').map((command) => command.value)
    ).toEqual(['>go settings'])
    expect(
      filterCommandPaletteCommands([...COMMANDS], 'new').map((command) => command.value)
    ).toEqual(['>new note', '>warp open current note folder'])
  })

  it('supports fuzzy subsequence matches for abbreviated command queries', () => {
    expect(
      filterCommandPaletteCommands([...COMMANDS], 'gpr').map((command) => command.value)
    ).toEqual(['>go projects'])
  })

  it('matches command keywords', () => {
    expect(
      filterCommandPaletteCommands([...COMMANDS], 'prefs').map((command) => command.value)
    ).toEqual(['>go settings'])
    expect(
      filterCommandPaletteCommands([...COMMANDS], 'terminal').map((command) => command.value)
    ).toEqual(['>warp open current note folder'])
  })

  it('returns no commands when nothing matches', () => {
    expect(filterCommandPaletteCommands([...COMMANDS], 'missing')).toEqual([])
  })
})
