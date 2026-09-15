import {
  createCommandPaletteCommandSearchIndex,
  searchCommandPaletteCommands,
  type CommandPaletteCommandSearchItem
} from './commandPaletteSearch'

export type { CommandPaletteCommandSearchItem } from './commandPaletteSearch'

export function filterCommandPaletteCommands<T extends CommandPaletteCommandSearchItem>(
  commands: readonly T[],
  query: string
): T[] {
  return searchCommandPaletteCommands(createCommandPaletteCommandSearchIndex(commands), query).map(
    (result) => result.command
  )
}
