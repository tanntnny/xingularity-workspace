import { describe, expect, it } from 'vitest'
import {
  getVaultDomainForPath,
  getVaultDomainDefinitions,
  isDerivedVaultPath
} from '../src/main/vaultDomainCatalog'

describe('vault domain catalog', () => {
  it('maps canonical roots to stable domain ids', () => {
    expect(getVaultDomainForPath('notebooks/readme.md')).toBe('notes')
    expect(getVaultDomainForPath('notebooks/diagram.excalidraw')).toBe('drawings')
    expect(getVaultDomainForPath('tasks/task-1.json')).toBe('tasks')
    expect(getVaultDomainForPath('resources/resources.json')).toBe('resources')
    expect(getVaultDomainForPath('calendar/state.json')).toBe('calendar')
    expect(getVaultDomainForPath('calendar/tasks.json')).toBeNull()
    expect(getVaultDomainForPath('settings.json')).toBe('settings')
    expect(getVaultDomainForPath('vault.json')).toBe('vault')
  })

  it('rejects unsafe paths and recognizes derived paths', () => {
    expect(getVaultDomainForPath('../outside.json')).toBeNull()
    expect(getVaultDomainForPath('folder\\file.json')).toBeNull()
    expect(isDerivedVaultPath('index.sqlite')).toBe(true)
    expect(isDerivedVaultPath('resources/locators.json')).toBe(true)
    expect(isDerivedVaultPath('calendar/tasks.json')).toBe(true)
    expect(isDerivedVaultPath('notebooks/readme.md')).toBe(false)
  })

  it('returns defensive catalog copies', () => {
    const first = getVaultDomainDefinitions()
    first[0]!.canonicalRoots.push('mutated')
    expect(getVaultDomainDefinitions()[0]!.canonicalRoots).not.toContain('mutated')
  })
})
