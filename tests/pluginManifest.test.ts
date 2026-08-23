import { describe, expect, it } from 'vitest'
import {
  normalizePluginManifest,
  parsePluginManifest,
  validatePluginManifest
} from '../src/shared/pluginManifest'
import {
  assertCompleteFeatureRegistry,
  BACKLOG_FEATURE_IDS,
  FEATURE_REGISTRY,
  validateFeatureRegistry
} from '../src/shared/featureRegistry'

describe('plugin capability manifests', () => {
  it('accepts a versioned least-privilege calendar manifest', () => {
    const manifest = parsePluginManifest({
      id: 'com.example.calendar',
      version: '1.2.3',
      name: 'Example Calendar',
      provider: 'calendar',
      capabilities: ['read-events'],
      permissions: ['network'],
      entrypoint: 'dist/index.js'
    })

    expect(manifest.id).toBe('com.example.calendar')
    expect(manifest.capabilities).toEqual(['read-events'])
  })

  it('rejects unknown fields and provider capabilities', () => {
    const result = validatePluginManifest({
      id: 'com.example.notes',
      version: '1.0.0',
      name: 'Example Notes',
      provider: 'note-export',
      capabilities: ['read-events'],
      permissions: ['read-vault'],
      unexpected: true
    })
    const unsupportedCapability = validatePluginManifest({
      id: 'com.example.notes',
      version: '1.0.0',
      name: 'Example Notes',
      provider: 'note-export',
      capabilities: ['read-events'],
      permissions: ['read-vault']
    })

    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toContain('unexpected')
    expect(unsupportedCapability.valid).toBe(false)
    expect(unsupportedCapability.errors.join(' ')).toContain('not allowed')
  })

  it('rejects privilege escalation and normalizes deterministic ordering', () => {
    const result = validatePluginManifest({
      id: 'com.example.importer',
      version: '1.0.0',
      name: 'Example Importer',
      provider: 'task-import',
      capabilities: ['import-tasks'],
      permissions: ['network']
    })
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toContain('write-vault')

    const normalized = normalizePluginManifest(
      parsePluginManifest({
        id: 'com.example.automation',
        version: '1.0.0',
        name: 'Example Automation',
        provider: 'automation',
        capabilities: ['templates', 'run'],
        permissions: []
      })
    )
    expect(normalized.capabilities).toEqual(['run', 'templates'])
  })

  it('keeps a status entry for every backlog identifier', () => {
    assertCompleteFeatureRegistry()
    const validation = validateFeatureRegistry(FEATURE_REGISTRY)

    expect(validation.valid).toBe(true)
    expect(FEATURE_REGISTRY).toHaveLength(BACKLOG_FEATURE_IDS.length)
    expect(new Set(FEATURE_REGISTRY.map((entry) => entry.status)).size).toBeGreaterThan(1)
  })
})
