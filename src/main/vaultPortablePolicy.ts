import path from 'node:path'
import { assertSafeRelativePath } from '../shared/pathSafety'
import {
  isPortableVaultPath,
  isSensitiveVaultPath,
  isTransientVaultPath as isExistingTransientVaultPath,
  isVaultIndexPath
} from './vaultDiagnostics'
import {
  getVaultDomainForPath,
  getVaultDomainDefinitions,
  isDerivedVaultPath as isCatalogDerivedVaultPath
} from './vaultDomainCatalog'

export const VAULT_PATH_CLASSIFICATION = Object.freeze({
  CANONICAL_PORTABLE: 'canonical-portable',
  DERIVED: 'derived',
  DEVICE_LOCAL: 'device-local',
  SECRET: 'secret',
  RECOVERY: 'recovery',
  TRANSIENT: 'transient',
  INVALID: 'invalid'
} as const)

export type VaultPathClassification =
  (typeof VAULT_PATH_CLASSIFICATION)[keyof typeof VAULT_PATH_CLASSIFICATION]

/** Classes excluded from the default portable/sync scope. */
export const DEFAULT_PORTABLE_SCOPE_EXCLUDED_CLASSES = Object.freeze([
  VAULT_PATH_CLASSIFICATION.DERIVED,
  VAULT_PATH_CLASSIFICATION.DEVICE_LOCAL,
  VAULT_PATH_CLASSIFICATION.SECRET,
  VAULT_PATH_CLASSIFICATION.RECOVERY,
  VAULT_PATH_CLASSIFICATION.TRANSIENT
] as const)

const RECOVERY_SEGMENTS = new Set([
  '.backup',
  '.backups',
  '.conflicts',
  '.quarantine',
  '.recovery',
  '.trash',
  'backup',
  'backups',
  'conflicts',
  'quarantine',
  'recovery',
  'trash'
])

const DEVICE_LOCAL_SEGMENTS = new Set(['.cache', 'cache', 'caches'])

const DEVICE_LOCAL_FILE_NAMES = new Set([
  'device.json',
  'locators.json',
  'manifest.json',
  'preferences.json',
  'settings.json'
])

const DERIVED_FILE_NAMES = new Set([
  'file-map.json',
  'file_map.json',
  'index.json',
  'search-index.json'
])

function getSafeRelativePath(input: unknown): string | null {
  if (
    typeof input !== 'string' ||
    input.includes('\\') ||
    input.includes('\0') ||
    input.startsWith('/') ||
    /^[a-zA-Z]:[\\/]/.test(input)
  ) {
    return null
  }

  try {
    const normalized = assertSafeRelativePath(input)
    return normalized === input ? normalized : null
  } catch {
    return null
  }
}

function pathParts(relPath: string): { basename: string; segments: string[] } {
  const normalized = relPath.toLowerCase()
  return {
    basename: path.posix.basename(normalized),
    segments: normalized.split('/')
  }
}

function hasReservedSegment(relPath: string, names: ReadonlySet<string>): boolean {
  return pathParts(relPath).segments.some((segment) => names.has(segment))
}

function isDeviceLocalMetadataPath(relPath: string): boolean {
  const { basename, segments } = pathParts(relPath)
  return (
    DEVICE_LOCAL_FILE_NAMES.has(basename) &&
    !segments.includes('credentials') &&
    !segments.includes('secrets')
  )
}

function isDeviceLocalCandidate(relPath: string): boolean {
  return isDeviceLocalMetadataPath(relPath) || hasReservedSegment(relPath, DEVICE_LOCAL_SEGMENTS)
}

function isRecoveryCandidate(relPath: string): boolean {
  const { basename } = pathParts(relPath)
  return (
    hasReservedSegment(relPath, RECOVERY_SEGMENTS) ||
    basename === 'write-audit.json' ||
    basename.endsWith('.bak')
  )
}

function isDerivedCandidate(relPath: string): boolean {
  const { basename } = pathParts(relPath)
  return (
    isVaultIndexPath(relPath) || DERIVED_FILE_NAMES.has(basename) || basename.endsWith('.cache')
  )
}

function isTransientCandidate(relPath: string): boolean {
  const { basename, segments } = pathParts(relPath)
  return (
    isExistingTransientVaultPath(relPath) ||
    segments.some(
      (segment) =>
        segment === '.sync' ||
        segment === '.vault-transfer' ||
        segment === '.tmp' ||
        segment.startsWith('.tmp-')
    ) ||
    basename.endsWith('.tmp') ||
    basename.endsWith('.temp') ||
    basename.startsWith('.tmp-') ||
    basename.startsWith('.temp-') ||
    basename.includes('.tmp-')
  )
}

/** Classify a safe vault-relative path without consulting a vault catalog or filesystem. */
export function classifyVaultPath(input: unknown): VaultPathClassification {
  const relPath = getSafeRelativePath(input)
  if (!relPath) {
    return VAULT_PATH_CLASSIFICATION.INVALID
  }

  if (isSensitiveVaultPath(relPath) && !isDeviceLocalMetadataPath(relPath)) {
    return VAULT_PATH_CLASSIFICATION.SECRET
  }
  if (isDeviceLocalCandidate(relPath)) {
    return VAULT_PATH_CLASSIFICATION.DEVICE_LOCAL
  }
  if (isRecoveryCandidate(relPath)) {
    return VAULT_PATH_CLASSIFICATION.RECOVERY
  }
  if (isCatalogDerivedVaultPath(relPath) || isDerivedCandidate(relPath)) {
    return VAULT_PATH_CLASSIFICATION.DERIVED
  }
  if (isTransientCandidate(relPath)) {
    return VAULT_PATH_CLASSIFICATION.TRANSIENT
  }

  return isPortableVaultPath(relPath)
    ? VAULT_PATH_CLASSIFICATION.CANONICAL_PORTABLE
    : VAULT_PATH_CLASSIFICATION.INVALID
}

export function isCanonicalPortableVaultPath(input: unknown): boolean {
  return classifyVaultPath(input) === VAULT_PATH_CLASSIFICATION.CANONICAL_PORTABLE
}

export function isDerivedVaultPath(input: unknown): boolean {
  return classifyVaultPath(input) === VAULT_PATH_CLASSIFICATION.DERIVED
}

export function isDeviceLocalVaultPath(input: unknown): boolean {
  return classifyVaultPath(input) === VAULT_PATH_CLASSIFICATION.DEVICE_LOCAL
}

export function isSecretVaultPath(input: unknown): boolean {
  return classifyVaultPath(input) === VAULT_PATH_CLASSIFICATION.SECRET
}

export function isRecoveryVaultPath(input: unknown): boolean {
  return classifyVaultPath(input) === VAULT_PATH_CLASSIFICATION.RECOVERY
}

export function isTransientVaultPath(input: unknown): boolean {
  return classifyVaultPath(input) === VAULT_PATH_CLASSIFICATION.TRANSIENT
}

/** Return true only for canonical files allowed in the default portable scope. */
export function isPortableScopePath(input: unknown): boolean {
  if (!isCanonicalPortableVaultPath(input)) {
    return false
  }

  const relPath = getSafeRelativePath(input)
  if (!relPath) {
    return false
  }
  const domain = getVaultDomainForPath(relPath)
  return Boolean(
    domain &&
    getVaultDomainDefinitions().some(
      (definition) => definition.id === domain && definition.portable
    )
  )
}
