import { describe, expect, it } from 'vitest'
import {
  classifyVaultPath,
  DEFAULT_PORTABLE_SCOPE_EXCLUDED_CLASSES,
  isCanonicalPortableVaultPath,
  isDerivedVaultPath,
  isDeviceLocalVaultPath,
  isPortableScopePath,
  isRecoveryVaultPath,
  isSecretVaultPath,
  isTransientVaultPath,
  VAULT_PATH_CLASSIFICATION
} from '../src/main/vaultPortablePolicy'

describe('vault portable path policy', () => {
  it('classifies canonical content and each excluded ownership class', () => {
    const cases = [
      ['notebooks/project-notes.md', VAULT_PATH_CLASSIFICATION.CANONICAL_PORTABLE],
      ['attachments/diagram.png', VAULT_PATH_CLASSIFICATION.CANONICAL_PORTABLE],
      ['.xingularity/index.sqlite', VAULT_PATH_CLASSIFICATION.DERIVED],
      ['projects/index.json', VAULT_PATH_CLASSIFICATION.DERIVED],
      ['.xingularity/cache/search.cache', VAULT_PATH_CLASSIFICATION.DEVICE_LOCAL],
      ['resources/locators.json', VAULT_PATH_CLASSIFICATION.DEVICE_LOCAL],
      ['settings.json', VAULT_PATH_CLASSIFICATION.DEVICE_LOCAL],
      ['credentials/oauth.json', VAULT_PATH_CLASSIFICATION.SECRET],
      ['.env.production', VAULT_PATH_CLASSIFICATION.SECRET],
      ['.xingularity/conflicts/note.local.md', VAULT_PATH_CLASSIFICATION.RECOVERY],
      ['.quarantine/malformed.json', VAULT_PATH_CLASSIFICATION.RECOVERY],
      ['.trash/files/deleted.md', VAULT_PATH_CLASSIFICATION.RECOVERY],
      ['notebooks/note.md.bak', VAULT_PATH_CLASSIFICATION.RECOVERY],
      ['.tmp-write-123/note.md', VAULT_PATH_CLASSIFICATION.TRANSIENT],
      ['notebooks/note.md.tmp', VAULT_PATH_CLASSIFICATION.TRANSIENT]
    ] as const

    for (const [relPath, classification] of cases) {
      expect(classifyVaultPath(relPath), relPath).toBe(classification)
    }
  })

  it('excludes indexes, file maps, credentials, locators, temp files, and recovery paths', () => {
    const excludedPaths = [
      'index.sqlite',
      'index.sqlite-wal',
      '.xingularity/filemap.json',
      'credentials.json',
      'secrets/provider.json',
      'resources/locators.json',
      '.sync/pending.json',
      '.vault-transfer/staged.json',
      '.quarantine/bad.json',
      '.xingularity/conflicts/conflict.json',
      '.trash/files/removed.md',
      'calendar/tasks.json'
    ]

    for (const relPath of excludedPaths) {
      expect(isPortableScopePath(relPath), relPath).toBe(false)
      expect(DEFAULT_PORTABLE_SCOPE_EXCLUDED_CLASSES).toContain(classifyVaultPath(relPath))
    }
    expect(isPortableScopePath('README.md')).toBe(false)
  })

  it('exposes mutually exclusive classification helpers', () => {
    const helpers = [
      isCanonicalPortableVaultPath,
      isDerivedVaultPath,
      isDeviceLocalVaultPath,
      isSecretVaultPath,
      isRecoveryVaultPath,
      isTransientVaultPath
    ]

    for (const relPath of [
      'notebooks/note.md',
      'index.sqlite',
      'settings.json',
      'credentials.json',
      '.trash/note.md',
      '.tmp-write/note.md'
    ]) {
      expect(helpers.filter((helper) => helper(relPath))).toHaveLength(1)
    }
  })

  it('rejects unsafe paths and remains pure and deterministic', () => {
    const unsafePaths: unknown[] = ['../outside.txt', '/absolute.txt', 'folder\\file.md', null]
    for (const input of unsafePaths) {
      expect(classifyVaultPath(input)).toBe(VAULT_PATH_CLASSIFICATION.INVALID)
      expect(isPortableScopePath(input)).toBe(false)
    }

    const inputs = [
      'notebooks/note.md',
      '.xingularity/index.sqlite',
      'resources/locators.json',
      '.quarantine/bad.json',
      '.tmp-write/note.md'
    ]
    const first = inputs.map((input) => classifyVaultPath(input))
    const second = inputs.map((input) => classifyVaultPath(input))

    expect(second).toEqual(first)
    expect(inputs).toEqual([
      'notebooks/note.md',
      '.xingularity/index.sqlite',
      'resources/locators.json',
      '.quarantine/bad.json',
      '.tmp-write/note.md'
    ])
  })
})
