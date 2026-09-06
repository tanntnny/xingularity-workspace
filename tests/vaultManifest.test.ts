import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  checksumVaultManifest,
  createVaultManifest,
  generateVaultId,
  normalizeVaultManifest,
  parseVaultManifest,
  serializeVaultManifest,
  validateVaultManifest
} from '../src/main/vaultManifest'

describe('vault manifest identity and serialization', () => {
  it('generates an opaque identity without incorporating a filesystem path', () => {
    const firstId = generateVaultId()
    const secondId = generateVaultId()
    const manifest = createVaultManifest({
      vaultId: firstId,
      createdAt: '2026-08-28T00:00:00.000Z'
    })
    const relocatedManifest = createVaultManifest({
      vaultId: manifest.vaultId,
      createdAt: manifest.createdAt,
      capabilities: manifest.capabilities,
      migration: manifest.migration
    })

    expect(firstId).toMatch(/^[0-9a-f-]{36}$/)
    expect(secondId).not.toBe(firstId)
    expect(relocatedManifest.vaultId).toBe(manifest.vaultId)
    expect(relocatedManifest).toEqual(manifest)
    expect(JSON.stringify(manifest)).not.toContain('/Users/')
  })

  it('creates versioned metadata with a conservative migration marker', () => {
    const manifest = createVaultManifest({ createdAt: new Date('2026-08-28T00:00:00+07:00') })

    expect(manifest).toMatchObject({
      format: 'xingularity-vault',
      manifestVersion: 1,
      schemaVersion: 1,
      protocolVersion: 1,
      createdAt: '2026-08-27T17:00:00.000Z',
      migration: {
        legacyLayoutActive: true,
        rollbackAvailable: false
      }
    })
    expect(manifest.capabilities).toEqual(['attachments', 'markdown', 'structured-records'])
  })

  it('normalizes equivalent manifests into one deterministic serialization and checksum', () => {
    const first = {
      migration: { rollbackAvailable: true, legacyLayoutActive: false },
      capabilities: [' Structured-Records ', 'markdown', 'attachments'],
      createdAt: '2026-08-28T07:00:00+07:00',
      protocolVersion: 1,
      vaultId: 'VAULT-EXAMPLE',
      schemaVersion: 3,
      manifestVersion: 1,
      format: 'xingularity-vault'
    }
    const second = {
      format: 'xingularity-vault',
      manifestVersion: 1,
      vaultId: 'vault-example',
      schemaVersion: 3,
      protocolVersion: 1,
      createdAt: '2026-08-28T00:00:00.000Z',
      capabilities: ['attachments', 'markdown', 'structured-records'],
      migration: { legacyLayoutActive: false, rollbackAvailable: true }
    }

    const firstSerialized = serializeVaultManifest(first)
    const secondSerialized = serializeVaultManifest(second)

    expect(firstSerialized).toBe(secondSerialized)
    expect(checksumVaultManifest(first)).toBe(checksumVaultManifest(second))
    expect(checksumVaultManifest(first)).toBe(
      createHash('sha256').update(firstSerialized, 'utf8').digest('hex')
    )
    expect(JSON.parse(firstSerialized)).toEqual(normalizeVaultManifest(second))
  })

  it('accepts the documented metadata shape while adding a safe default marker', () => {
    const parsed = parseVaultManifest({
      format: 'xingularity-vault',
      manifestVersion: 1,
      vaultId: 'stable-random-id',
      schemaVersion: 3,
      protocolVersion: 1,
      createdAt: '2026-08-28T00:00:00.000Z',
      capabilities: ['markdown', 'structured-records', 'attachments']
    })

    expect(parsed.migration).toEqual({
      legacyLayoutActive: true,
      rollbackAvailable: false
    })
  })

  it('rejects unsafe fields, secrets, derived indexes, and malformed values', () => {
    const unsafeInputs: unknown[] = [
      {
        format: 'xingularity-vault',
        manifestVersion: 1,
        vaultId: 'vault-1',
        schemaVersion: 1,
        protocolVersion: 1,
        createdAt: '2026-08-28T00:00:00.000Z',
        capabilities: ['markdown'],
        rootPath: '/Users/tanny/private-vault'
      },
      {
        format: 'xingularity-vault',
        manifestVersion: 1,
        vaultId: 'vault-1',
        schemaVersion: 1,
        protocolVersion: 1,
        createdAt: '2026-08-28T00:00:00.000Z',
        capabilities: ['markdown', 'index-sqlite']
      },
      {
        format: 'xingularity-vault',
        manifestVersion: 1,
        vaultId: '../outside',
        schemaVersion: 1,
        protocolVersion: 1,
        createdAt: '2026-08-28T00:00:00.000Z',
        capabilities: ['markdown']
      },
      {
        format: 'xingularity-vault',
        manifestVersion: 1,
        vaultId: 'vault-1',
        schemaVersion: 0,
        protocolVersion: 1,
        createdAt: 'not-a-date',
        capabilities: ['markdown']
      }
    ]

    for (const input of unsafeInputs) {
      const result = validateVaultManifest(input)
      expect(result.valid).toBe(false)
      expect(result.manifest).toBeUndefined()
      expect(result.errors).toHaveLength(1)
    }
  })

  it('rejects duplicate capabilities and incomplete migration markers', () => {
    const base = createVaultManifest({ vaultId: 'vault-1', createdAt: '2026-08-28T00:00:00.000Z' })

    expect(() =>
      normalizeVaultManifest({
        ...base,
        capabilities: ['markdown', ' MARKDOWN ']
      })
    ).toThrow('must not contain duplicates')

    expect(() =>
      normalizeVaultManifest({
        ...base,
        migration: { legacyLayoutActive: true }
      })
    ).toThrow('layout and rollback booleans')
  })
})
