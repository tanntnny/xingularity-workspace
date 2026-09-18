import type { ReactNode } from 'react'

import { SearchMatchText } from './SearchMatchText'
import type { CommandPaletteMatchRange } from '../lib/commandPaletteSearch'

interface CommandPaletteMatchTextProps {
  text: string
  ranges?: readonly CommandPaletteMatchRange[]
}

export function CommandPaletteMatchText({ text, ranges }: CommandPaletteMatchTextProps): ReactNode {
  return <SearchMatchText text={text} ranges={ranges} testId="command-palette-match" />
}
