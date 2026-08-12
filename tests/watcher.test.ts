import { describe, expect, it } from 'vitest'
import { isWatchedVaultPath } from '../src/main/watcher'

describe('VaultWatcher path filtering', () => {
  it('watches notes, drawings, and directory changes', () => {
    expect(isWatchedVaultPath('today.md', 'add')).toBe(true)
    expect(isWatchedVaultPath('projects/diagram.excalidraw', 'change')).toBe(true)
    expect(isWatchedVaultPath('projects', 'addDir')).toBe(true)
    expect(isWatchedVaultPath('projects', 'unlinkDir')).toBe(true)
  })

  it('ignores unrelated files and the notebook root directory', () => {
    expect(isWatchedVaultPath('archive/readme.txt', 'add')).toBe(false)
    expect(isWatchedVaultPath('archive/data.json', 'unlink')).toBe(false)
    expect(isWatchedVaultPath('', 'addDir')).toBe(false)
  })
})
