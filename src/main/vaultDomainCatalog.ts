import path from 'node:path'
import { isExcalidrawPath } from '../shared/excalidrawFile'
import type { VaultDomain, VaultDomainDefinition } from '../shared/vaultProtocol'

const DOMAIN_DEFINITIONS: readonly VaultDomainDefinition[] = [
  {
    id: 'notes',
    canonicalRoots: ['notebooks'],
    derivedPaths: ['index.sqlite', 'filemap.json'],
    parser: 'stored-note-markdown',
    schemaVersion: 1,
    identity: 'content-id',
    editPolicy: 'markdown-merge',
    transactionUnit: 'file',
    portable: true,
    onMalformed: 'quarantine'
  },
  {
    id: 'drawings',
    canonicalRoots: ['excalidraw'],
    derivedPaths: ['excalidraw/sessions.json'],
    parser: 'excalidraw-json',
    schemaVersion: 1,
    identity: 'path',
    editPolicy: 'binary-copy',
    transactionUnit: 'file',
    portable: true,
    onMalformed: 'reject'
  },
  {
    id: 'attachments',
    canonicalRoots: ['attachments'],
    derivedPaths: [],
    parser: 'opaque-file',
    schemaVersion: 1,
    identity: 'path',
    editPolicy: 'binary-copy',
    transactionUnit: 'file',
    portable: true,
    onMalformed: 'ignore'
  },
  {
    id: 'fleeting',
    canonicalRoots: ['fleeting'],
    derivedPaths: [],
    parser: 'fleeting-note',
    schemaVersion: 1,
    identity: 'path',
    editPolicy: 'structured-validate',
    transactionUnit: 'file',
    portable: true,
    onMalformed: 'quarantine'
  },
  {
    id: 'projects',
    canonicalRoots: ['projects'],
    derivedPaths: [],
    parser: 'project-json',
    schemaVersion: 1,
    identity: 'record-id',
    editPolicy: 'structured-validate',
    transactionUnit: 'record',
    portable: true,
    onMalformed: 'quarantine'
  },
  {
    id: 'tasks',
    canonicalRoots: ['tasks'],
    derivedPaths: [],
    parser: 'task-json',
    schemaVersion: 1,
    identity: 'record-id',
    editPolicy: 'structured-validate',
    transactionUnit: 'record',
    portable: true,
    onMalformed: 'quarantine'
  },
  {
    id: 'calendar',
    canonicalRoots: ['calendar/state.json'],
    derivedPaths: [
      'calendar/events.json',
      'calendar/links.json',
      'calendar/connections.json',
      'calendar/calendars.json',
      'calendar/tasks.json'
    ],
    parser: 'calendar-json',
    schemaVersion: 1,
    identity: 'record-id',
    editPolicy: 'structured-validate',
    transactionUnit: 'record',
    portable: true,
    onMalformed: 'quarantine'
  },
  {
    id: 'planning',
    canonicalRoots: ['weekly-plan'],
    derivedPaths: [],
    parser: 'weekly-plan-json',
    schemaVersion: 1,
    identity: 'record-id',
    editPolicy: 'structured-validate',
    transactionUnit: 'domain',
    portable: true,
    onMalformed: 'quarantine'
  },
  {
    id: 'subscriptions',
    canonicalRoots: ['subscriptions'],
    derivedPaths: [],
    parser: 'subscription-json',
    schemaVersion: 1,
    identity: 'record-id',
    editPolicy: 'structured-validate',
    transactionUnit: 'record',
    portable: true,
    onMalformed: 'quarantine'
  },
  {
    id: 'schedules',
    canonicalRoots: ['schedules'],
    derivedPaths: [],
    parser: 'schedule-json',
    schemaVersion: 1,
    identity: 'record-id',
    editPolicy: 'structured-validate',
    transactionUnit: 'domain',
    portable: true,
    onMalformed: 'quarantine'
  },
  {
    id: 'agent',
    canonicalRoots: ['agent'],
    derivedPaths: [],
    parser: 'agent-json',
    schemaVersion: 1,
    identity: 'record-id',
    editPolicy: 'structured-validate',
    transactionUnit: 'domain',
    portable: true,
    onMalformed: 'quarantine'
  },
  {
    id: 'resources',
    canonicalRoots: ['resources'],
    derivedPaths: ['resources/locators.json'],
    parser: 'resource-json',
    schemaVersion: 1,
    identity: 'record-id',
    editPolicy: 'structured-validate',
    transactionUnit: 'domain',
    portable: true,
    onMalformed: 'quarantine'
  },
  {
    id: 'settings',
    canonicalRoots: ['settings.json'],
    derivedPaths: [],
    parser: 'app-settings-json',
    schemaVersion: 1,
    identity: 'path',
    editPolicy: 'app-only',
    transactionUnit: 'domain',
    portable: true,
    onMalformed: 'reject'
  },
  {
    id: 'vault',
    canonicalRoots: ['vault.json'],
    derivedPaths: ['migrations.json', 'index.sqlite', 'filemap.json'],
    parser: 'vault-config-json',
    schemaVersion: 1,
    identity: 'path',
    editPolicy: 'app-only',
    transactionUnit: 'vault',
    portable: true,
    onMalformed: 'reject'
  }
]

export function getVaultDomainDefinitions(): VaultDomainDefinition[] {
  return DOMAIN_DEFINITIONS.map((definition) => ({
    ...definition,
    canonicalRoots: [...definition.canonicalRoots],
    derivedPaths: [...definition.derivedPaths]
  }))
}

export function getVaultDomainForPath(input: string): VaultDomain | null {
  const relPath = normalizeVaultRelativePath(input)
  if (!relPath) {
    return null
  }

  if (relPath.startsWith('notebooks/') && isExcalidrawPath(relPath)) {
    return 'drawings'
  }

  const match = DOMAIN_DEFINITIONS.flatMap((definition) =>
    definition.canonicalRoots.map((root) => ({ definition, root: normalizeRoot(root) }))
  )
    .filter(({ root }) => relPath === root || relPath.startsWith(`${root}/`))
    .sort((left, right) => right.root.length - left.root.length)[0]

  return match?.definition.id ?? null
}

export function isDerivedVaultPath(input: string): boolean {
  const relPath = normalizeVaultRelativePath(input)
  if (!relPath) {
    return false
  }

  return DOMAIN_DEFINITIONS.some((definition) =>
    definition.derivedPaths.some((derivedPath) => {
      const normalized = normalizeRoot(derivedPath)
      return relPath === normalized || relPath.startsWith(`${normalized}/`)
    })
  )
}

function normalizeVaultRelativePath(input: string): string | null {
  if (!input || input.includes('\\') || input.includes('\0') || path.posix.isAbsolute(input)) {
    return null
  }

  const normalized = path.posix.normalize(input).replace(/^\.\//, '')
  if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    return null
  }
  return normalized
}

function normalizeRoot(input: string): string {
  return input.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/u, '').toLowerCase()
}
