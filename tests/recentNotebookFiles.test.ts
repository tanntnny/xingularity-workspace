import { describe, expect, it } from 'vitest'
import {
  normalizeRecentNotebookPaths,
  rememberRecentNotebookPath,
  remapRecentNotebookPaths,
  removeRecentNotebookPaths
} from '../src/shared/recentNotebookFiles'

describe('recent notebook files', () => {
  it('normalizes invalid, duplicate, and overlong history', () => {
    expect(
      normalizeRecentNotebookPaths([
        ' alpha.md ',
        '',
        'alpha.md',
        null,
        'beta.md',
        'gamma.md',
        'delta.md',
        'epsilon.md',
        'zeta.md'
      ])
    ).toEqual(['alpha.md', 'beta.md', 'gamma.md', 'delta.md', 'epsilon.md'])
  })

  it('promotes a file to the front without duplicates', () => {
    expect(rememberRecentNotebookPath(['alpha.md', 'beta.md'], 'beta.md')).toEqual([
      'beta.md',
      'alpha.md'
    ])
  })

  it('remaps nested history when a folder moves', () => {
    expect(
      remapRecentNotebookPaths(
        ['archive/alpha.md', 'beta.md', 'archive/diagram.excalidraw'],
        'archive',
        'work'
      )
    ).toEqual(['work/alpha.md', 'beta.md', 'work/diagram.excalidraw'])
  })

  it('removes files and nested files from deleted folders', () => {
    expect(
      removeRecentNotebookPaths(
        ['archive/alpha.md', 'beta.md', 'diagram.excalidraw'],
        ['archive', 'diagram.excalidraw']
      )
    ).toEqual(['beta.md'])
  })
})
