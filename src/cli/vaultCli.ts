import fs from 'node:fs/promises'
import path from 'node:path'
import {
  checksumManifestFiles,
  collectVaultDiagnostics,
  scanVaultFiles
} from '../main/vaultDiagnostics'
import {
  buildVaultContext,
  readVaultManifestReport,
  readVaultNote,
  searchVaultContext,
  type VaultManifestReport
} from '../main/vaultContext'
import {
  buildPortableManifest,
  checksumPortableManifest,
  createVaultBackup
} from '../main/vaultTransferService'
import { VAULT_MANIFEST_RELATIVE_PATH } from '../main/vaultManifest'
import { getVaultDomainDefinitions } from '../main/vaultDomainCatalog'
import { VaultChangeCoordinator } from '../main/vaultChangeCoordinator'
import { VaultRecoveryStore } from '../main/vaultRecoveryStore'
import { isPortableScopePath } from '../main/vaultPortablePolicy'
import type { VaultDiagnosticsReport } from '../shared/types'

export const VAULT_CLI_COMMAND = 'vault' as const

export const VAULT_CLI_EXIT_CODES = Object.freeze({
  success: 0,
  usage: 2,
  validation: 3,
  operational: 4
} as const)

export type VaultCliExitCode = (typeof VAULT_CLI_EXIT_CODES)[keyof typeof VAULT_CLI_EXIT_CODES]
export type VaultCliSubcommand =
  | 'status'
  | 'validate'
  | 'manifest'
  | 'scan'
  | 'backup'
  | 'context'
  | 'search'
  | 'read'
  | 'conflicts'

export interface ParsedVaultCliArgs {
  command: VaultCliSubcommand | 'help'
  rootPath: string
  json: true
  pretty: boolean
  portable: boolean
  preview: boolean
  destinationPath?: string
  query?: string
  project?: string
  notePath?: string
  filePath?: string
  limit?: number
  maxChars?: number
  includeDiagnostics?: boolean
}

export interface VaultCliResponse {
  ok: boolean
  command: string
  exitCode: VaultCliExitCode
  rootPath?: string
  data?: unknown
  error?: {
    code: string
    message: string
  }
}

export interface VaultCliRunOptions {
  cwd?: string
}

interface VaultCliCommandResult {
  exitCode: VaultCliExitCode
  data: unknown
  error?: {
    code: string
    message: string
  }
}

type StableManifestReport = VaultManifestReport

class VaultCliError extends Error {
  readonly exitCode: VaultCliExitCode
  readonly code: string

  constructor(code: string, message: string, exitCode: VaultCliExitCode) {
    super(message)
    this.name = 'VaultCliError'
    this.code = code
    this.exitCode = exitCode
  }
}

export function parseVaultCliArgs(
  argv: readonly string[],
  options: { cwd?: string } = {}
): ParsedVaultCliArgs {
  const tokens = [...argv]
  const cwd = options.cwd ?? process.cwd()

  if (tokens.length === 0 || tokens[0] === '--help' || tokens[0] === '-h') {
    return {
      command: 'help',
      rootPath: path.resolve(cwd),
      json: true,
      pretty: false,
      portable: false,
      preview: false
    }
  }

  if (tokens.shift() !== VAULT_CLI_COMMAND) {
    throw new VaultCliError(
      'invalid-command',
      'Expected the command prefix: xingularity vault <status|validate|manifest|scan|backup|context|search|read|conflicts>',
      VAULT_CLI_EXIT_CODES.usage
    )
  }

  let command: VaultCliSubcommand | undefined
  let rootInput: string | undefined
  let pretty = false
  let portable = false
  let preview = false
  let destinationInput: string | undefined
  let queryInput: string | undefined
  let projectInput: string | undefined
  let noteInput: string | undefined
  let fileInput: string | undefined
  let limitInput: number | undefined
  let maxCharsInput: number | undefined
  let includeDiagnostics = true
  let help = false

  while (tokens.length > 0) {
    const token = tokens.shift() as string
    if (token === '--help' || token === '-h') {
      help = true
      continue
    }
    if (token === '--json') {
      continue
    }
    if (token === '--pretty') {
      pretty = true
      continue
    }
    if (token === '--portable') {
      portable = true
      continue
    }
    if (token === '--preview') {
      preview = true
      continue
    }
    if (token === '--destination') {
      const value = takeOptionValue(tokens, '--destination')
      if (destinationInput !== undefined) {
        throw new VaultCliError(
          'duplicate-destination',
          'The --destination option may only be provided once',
          VAULT_CLI_EXIT_CODES.usage
        )
      }
      destinationInput = value
      continue
    }
    if (token === '--output') {
      const value = takeOptionValue(tokens, '--output')
      if (destinationInput !== undefined) {
        throw new VaultCliError(
          'duplicate-destination',
          'The --destination/--output option may only be provided once',
          VAULT_CLI_EXIT_CODES.usage
        )
      }
      destinationInput = value
      continue
    }
    if (token.startsWith('--destination=')) {
      const value = token.slice('--destination='.length)
      if (!value) {
        throw new VaultCliError(
          'missing-destination',
          'The --destination option requires a path value',
          VAULT_CLI_EXIT_CODES.usage
        )
      }
      if (destinationInput !== undefined) {
        throw new VaultCliError(
          'duplicate-destination',
          'The --destination option may only be provided once',
          VAULT_CLI_EXIT_CODES.usage
        )
      }
      destinationInput = value
      continue
    }
    if (token.startsWith('--output=')) {
      const value = token.slice('--output='.length)
      if (!value) {
        throw new VaultCliError(
          'missing-destination',
          'The --destination/--output option requires a path value',
          VAULT_CLI_EXIT_CODES.usage
        )
      }
      if (destinationInput !== undefined) {
        throw new VaultCliError(
          'duplicate-destination',
          'The --destination/--output option may only be provided once',
          VAULT_CLI_EXIT_CODES.usage
        )
      }
      destinationInput = value
      continue
    }
    if (token === '--root') {
      const value = takeOptionValue(tokens, '--root')
      if (rootInput !== undefined) {
        throw new VaultCliError(
          'duplicate-root',
          'The --root option may only be provided once',
          VAULT_CLI_EXIT_CODES.usage
        )
      }
      rootInput = value
      continue
    }
    if (token.startsWith('--root=')) {
      const value = token.slice('--root='.length)
      if (!value) {
        throw new VaultCliError(
          'missing-root',
          'The --root option requires a path value',
          VAULT_CLI_EXIT_CODES.usage
        )
      }
      if (rootInput !== undefined) {
        throw new VaultCliError(
          'duplicate-root',
          'The --root option may only be provided once',
          VAULT_CLI_EXIT_CODES.usage
        )
      }
      rootInput = value
      continue
    }
    if (token === '--query') {
      const value = takeOptionValue(tokens, '--query')
      if (queryInput !== undefined) {
        throw new VaultCliError(
          'duplicate-query',
          'The --query option may only be provided once',
          VAULT_CLI_EXIT_CODES.usage
        )
      }
      queryInput = value
      continue
    }
    if (token.startsWith('--query=')) {
      const value = token.slice('--query='.length)
      if (!value) {
        throw new VaultCliError(
          'missing-query',
          'The --query option requires a value',
          VAULT_CLI_EXIT_CODES.usage
        )
      }
      if (queryInput !== undefined) {
        throw new VaultCliError(
          'duplicate-query',
          'The --query option may only be provided once',
          VAULT_CLI_EXIT_CODES.usage
        )
      }
      queryInput = value
      continue
    }
    if (token === '--project') {
      const value = takeOptionValue(tokens, '--project')
      if (projectInput !== undefined) {
        throw new VaultCliError(
          'duplicate-project',
          'The --project option may only be provided once',
          VAULT_CLI_EXIT_CODES.usage
        )
      }
      projectInput = value
      continue
    }
    if (token.startsWith('--project=')) {
      const value = token.slice('--project='.length)
      if (!value) {
        throw new VaultCliError(
          'missing-project',
          'The --project option requires a value',
          VAULT_CLI_EXIT_CODES.usage
        )
      }
      if (projectInput !== undefined) {
        throw new VaultCliError(
          'duplicate-project',
          'The --project option may only be provided once',
          VAULT_CLI_EXIT_CODES.usage
        )
      }
      projectInput = value
      continue
    }
    if (token === '--note') {
      const value = takeOptionValue(tokens, '--note')
      if (noteInput !== undefined) {
        throw new VaultCliError(
          'duplicate-note',
          'The --note option may only be provided once',
          VAULT_CLI_EXIT_CODES.usage
        )
      }
      noteInput = value
      continue
    }
    if (token.startsWith('--note=')) {
      const value = token.slice('--note='.length)
      if (!value) {
        throw new VaultCliError(
          'missing-note',
          'The --note option requires a path value',
          VAULT_CLI_EXIT_CODES.usage
        )
      }
      if (noteInput !== undefined) {
        throw new VaultCliError(
          'duplicate-note',
          'The --note option may only be provided once',
          VAULT_CLI_EXIT_CODES.usage
        )
      }
      noteInput = value
      continue
    }
    if (token === '--path') {
      const value = takeOptionValue(tokens, '--path')
      if (fileInput !== undefined) {
        throw new VaultCliError(
          'duplicate-path',
          'The --path option may only be provided once',
          VAULT_CLI_EXIT_CODES.usage
        )
      }
      fileInput = value
      continue
    }
    if (token.startsWith('--path=')) {
      const value = token.slice('--path='.length)
      if (!value) {
        throw new VaultCliError(
          'missing-path',
          'The --path option requires a path value',
          VAULT_CLI_EXIT_CODES.usage
        )
      }
      if (fileInput !== undefined) {
        throw new VaultCliError(
          'duplicate-path',
          'The --path option may only be provided once',
          VAULT_CLI_EXIT_CODES.usage
        )
      }
      fileInput = value
      continue
    }
    if (token === '--limit') {
      const value = takeOptionValue(tokens, '--limit')
      limitInput = parseIntegerOption(value, '--limit', 1, 100)
      continue
    }
    if (token.startsWith('--limit=')) {
      limitInput = parseIntegerOption(token.slice('--limit='.length), '--limit', 1, 100)
      continue
    }
    if (token === '--max-chars') {
      const value = takeOptionValue(tokens, '--max-chars')
      maxCharsInput = parseIntegerOption(value, '--max-chars', 1_000, 200_000)
      continue
    }
    if (token.startsWith('--max-chars=')) {
      maxCharsInput = parseIntegerOption(
        token.slice('--max-chars='.length),
        '--max-chars',
        1_000,
        200_000
      )
      continue
    }
    if (token === '--no-diagnostics') {
      includeDiagnostics = false
      continue
    }
    if (token.startsWith('-')) {
      throw new VaultCliError(
        'unknown-option',
        `Unknown vault CLI option: ${token}`,
        VAULT_CLI_EXIT_CODES.usage
      )
    }
    if (command !== undefined) {
      if (command === 'search' || command === 'context') {
        if (queryInput !== undefined) {
          throw new VaultCliError(
            'duplicate-query',
            `Unexpected vault CLI argument: ${token}`,
            VAULT_CLI_EXIT_CODES.usage
          )
        }
        queryInput = token
        continue
      }
      if (command === 'read') {
        if (fileInput !== undefined) {
          throw new VaultCliError(
            'duplicate-path',
            `Unexpected vault CLI argument: ${token}`,
            VAULT_CLI_EXIT_CODES.usage
          )
        }
        fileInput = token
        continue
      }
      if (rootInput === undefined && isVaultRootPositionalCommand(command)) {
        rootInput = token
        continue
      }
      throw new VaultCliError(
        'unexpected-argument',
        `Unexpected vault CLI argument: ${token}`,
        VAULT_CLI_EXIT_CODES.usage
      )
    }
    command = token as VaultCliSubcommand
  }

  if (help) {
    return {
      command: 'help',
      rootPath: path.resolve(cwd, rootInput ?? '.'),
      json: true,
      pretty,
      portable: false,
      preview: false
    }
  }

  if (!command || !isVaultCliSubcommand(command)) {
    throw new VaultCliError(
      'missing-command',
      'Expected one vault subcommand: status, validate, manifest, scan, backup, context, search, read, or conflicts',
      VAULT_CLI_EXIT_CODES.usage
    )
  }
  if (portable && command !== 'manifest') {
    throw new VaultCliError(
      'invalid-option',
      'The --portable option is only supported by the manifest command',
      VAULT_CLI_EXIT_CODES.usage
    )
  }
  if (preview && command !== 'backup') {
    throw new VaultCliError(
      'invalid-option',
      'The --preview option is only supported by the backup command',
      VAULT_CLI_EXIT_CODES.usage
    )
  }
  if (destinationInput !== undefined && command !== 'backup') {
    throw new VaultCliError(
      'invalid-option',
      'The --destination option is only supported by the backup command',
      VAULT_CLI_EXIT_CODES.usage
    )
  }
  if (queryInput !== undefined && command !== 'context' && command !== 'search') {
    throw new VaultCliError(
      'invalid-option',
      'The --query option is only supported by the context and search commands',
      VAULT_CLI_EXIT_CODES.usage
    )
  }
  if (projectInput !== undefined && command !== 'context') {
    throw new VaultCliError(
      'invalid-option',
      'The --project option is only supported by the context command',
      VAULT_CLI_EXIT_CODES.usage
    )
  }
  if (noteInput !== undefined && command !== 'context') {
    throw new VaultCliError(
      'invalid-option',
      'The --note option is only supported by the context command',
      VAULT_CLI_EXIT_CODES.usage
    )
  }
  if (fileInput !== undefined && command !== 'read') {
    throw new VaultCliError(
      'invalid-option',
      'The --path option is only supported by the read command',
      VAULT_CLI_EXIT_CODES.usage
    )
  }
  if (limitInput !== undefined && command !== 'context' && command !== 'search') {
    throw new VaultCliError(
      'invalid-option',
      'The --limit option is only supported by the context and search commands',
      VAULT_CLI_EXIT_CODES.usage
    )
  }
  if (
    maxCharsInput !== undefined &&
    command !== 'context' &&
    command !== 'search' &&
    command !== 'read'
  ) {
    throw new VaultCliError(
      'invalid-option',
      'The --max-chars option is only supported by the context, search, and read commands',
      VAULT_CLI_EXIT_CODES.usage
    )
  }
  if (!includeDiagnostics && command !== 'context') {
    throw new VaultCliError(
      'invalid-option',
      'The --no-diagnostics option is only supported by the context command',
      VAULT_CLI_EXIT_CODES.usage
    )
  }
  if (command === 'search' && !queryInput) {
    throw new VaultCliError(
      'missing-query',
      'The search command requires a query argument or --query value',
      VAULT_CLI_EXIT_CODES.usage
    )
  }
  if (command === 'read' && !fileInput) {
    throw new VaultCliError(
      'missing-path',
      'The read command requires a note path argument or --path value',
      VAULT_CLI_EXIT_CODES.usage
    )
  }

  return {
    command,
    rootPath: path.resolve(cwd, rootInput ?? '.'),
    json: true,
    pretty,
    portable,
    preview,
    ...(destinationInput ? { destinationPath: path.resolve(cwd, destinationInput) } : {}),
    ...(queryInput ? { query: queryInput } : {}),
    ...(projectInput ? { project: projectInput } : {}),
    ...(noteInput ? { notePath: noteInput } : {}),
    ...(fileInput ? { filePath: fileInput } : {}),
    ...(limitInput !== undefined ? { limit: limitInput } : {}),
    ...(maxCharsInput !== undefined ? { maxChars: maxCharsInput } : {}),
    ...(!includeDiagnostics ? { includeDiagnostics: false } : {})
  }
}

export async function runVaultCli(
  argv: readonly string[],
  options: VaultCliRunOptions = {}
): Promise<VaultCliResponse> {
  let parsed: ParsedVaultCliArgs | undefined
  try {
    parsed = parseVaultCliArgs(argv, options)
  } catch (error) {
    return createErrorResponse('vault', error)
  }

  if (parsed.command === 'help') {
    return {
      ok: true,
      command: 'vault',
      exitCode: VAULT_CLI_EXIT_CODES.success,
      data: createHelpData()
    }
  }

  try {
    await assertVaultRoot(parsed.rootPath)
    const result = await executeVaultCommand(parsed)
    return {
      ok: result.exitCode === VAULT_CLI_EXIT_CODES.success,
      command: `vault ${parsed.command}`,
      exitCode: result.exitCode,
      rootPath: parsed.rootPath,
      data: result.data,
      ...(result.error ? { error: result.error } : {})
    }
  } catch (error) {
    return createErrorResponse(`vault ${parsed.command}`, error, parsed.rootPath)
  }
}

export function serializeVaultCliResponse(
  response: VaultCliResponse,
  options: { pretty?: boolean } = {}
): string {
  return JSON.stringify(response, null, options.pretty ? 2 : undefined)
}

export async function readStableVaultManifest(rootPath: string): Promise<StableManifestReport> {
  return readVaultManifestReport(rootPath)
}

async function executeVaultCommand(parsed: ParsedVaultCliArgs): Promise<VaultCliCommandResult> {
  switch (parsed.command) {
    case 'status':
      return executeStatus(parsed.rootPath)
    case 'validate':
      return executeValidate(parsed.rootPath)
    case 'manifest':
      return parsed.portable
        ? executePortableManifest(parsed.rootPath)
        : executeStableManifest(parsed.rootPath)
    case 'scan':
      return executeScan(parsed.rootPath)
    case 'backup':
      return executeBackup(parsed.rootPath, parsed)
    case 'context':
      return executeContext(parsed.rootPath, parsed)
    case 'search':
      return executeSearch(parsed.rootPath, parsed)
    case 'read':
      return executeRead(parsed.rootPath, parsed)
    case 'conflicts':
      return executeConflicts(parsed.rootPath)
    case 'help':
      return {
        exitCode: VAULT_CLI_EXIT_CODES.success,
        data: createHelpData()
      }
  }
}

async function executeContext(
  rootPath: string,
  parsed: ParsedVaultCliArgs
): Promise<VaultCliCommandResult> {
  const context = await buildVaultContext(rootPath, {
    query: parsed.query,
    project: parsed.project,
    note: parsed.notePath,
    limit: parsed.limit,
    maxChars: parsed.maxChars,
    includeDiagnostics: parsed.includeDiagnostics
  })
  const hasValidationIssues =
    (context.vault.manifest.present && !context.vault.manifest.valid) ||
    context.vault.manifest.errors.length > 0 ||
    context.health.issueCounts.errors > 0 ||
    context.recovery.conflicts.length > 0 ||
    context.recovery.quarantine.length > 0
  return {
    exitCode: hasValidationIssues ? VAULT_CLI_EXIT_CODES.validation : VAULT_CLI_EXIT_CODES.success,
    data: context,
    ...(hasValidationIssues
      ? {
          error: {
            code: 'context-health-check-failed',
            message:
              'Vault context includes validation or recovery issues; inspect health and recovery'
          }
        }
      : {})
  }
}

async function executeSearch(
  rootPath: string,
  parsed: ParsedVaultCliArgs
): Promise<VaultCliCommandResult> {
  const results = await searchVaultContext(rootPath, parsed.query ?? '', {
    limit: parsed.limit,
    maxChars: parsed.maxChars
  })
  return {
    exitCode: VAULT_CLI_EXIT_CODES.success,
    data: {
      rootPath,
      query: parsed.query,
      resultCount: results.length,
      results
    }
  }
}

async function executeRead(
  rootPath: string,
  parsed: ParsedVaultCliArgs
): Promise<VaultCliCommandResult> {
  try {
    const note = await readVaultNote(rootPath, parsed.filePath ?? '', {
      maxChars: parsed.maxChars
    })
    return {
      exitCode: VAULT_CLI_EXIT_CODES.success,
      data: note
    }
  } catch (error) {
    throw new VaultCliError('read-failed', describeError(error), VAULT_CLI_EXIT_CODES.validation)
  }
}

async function executeConflicts(rootPath: string): Promise<VaultCliCommandResult> {
  const store = new VaultRecoveryStore(path.join(rootPath, '.xingularity'))
  const [conflicts, quarantine] = await Promise.all([store.listConflicts(), store.listQuarantine()])
  const hasRecoveryWork = conflicts.length > 0 || quarantine.length > 0
  return {
    exitCode: hasRecoveryWork ? VAULT_CLI_EXIT_CODES.validation : VAULT_CLI_EXIT_CODES.success,
    data: {
      rootPath,
      conflictCount: conflicts.length,
      quarantineCount: quarantine.length,
      conflicts: conflicts.map((record) => ({
        id: record.id,
        path: record.path,
        detectedAt: record.detectedAt,
        ...(record.reason ? { reason: record.reason } : {}),
        payloadRoles: Object.entries(record.payloads)
          .filter(([, value]) => value !== null && value !== undefined)
          .map(([role]) => role)
      })),
      quarantine: quarantine.map((record) => ({
        id: record.id,
        path: record.path,
        quarantinedAt: record.quarantinedAt,
        reason: record.reason,
        payloadPath: typeof record.payload === 'string' ? record.payload : record.payload.path
      }))
    },
    ...(hasRecoveryWork
      ? {
          error: {
            code: 'unresolved-recovery-work',
            message: 'Vault has unresolved conflicts or quarantined files'
          }
        }
      : {})
  }
}

async function executeStatus(rootPath: string): Promise<VaultCliCommandResult> {
  const [diagnostics, manifest] = await Promise.all([
    collectVaultDiagnostics(rootPath),
    readStableVaultManifest(rootPath)
  ])
  const coordinator = new VaultChangeCoordinator({
    rootPath,
    ...(manifest.manifest ? { vaultId: manifest.manifest.vaultId } : {})
  })
  const reconciliation = await coordinator.reconcile()
  const issueCounts = summarizeIssueCounts(diagnostics)
  const catalog = getVaultDomainDefinitions()

  const validationError =
    issueCounts.errors > 0 ||
    (manifest.present && !manifest.valid) ||
    reconciliation.errors.length > 0

  return {
    exitCode: validationError ? VAULT_CLI_EXIT_CODES.validation : VAULT_CLI_EXIT_CODES.success,
    data: {
      rootPath,
      manifest,
      catalog: {
        domainCount: catalog.length,
        watchedRootCount: catalog.reduce(
          (count, definition) => count + definition.canonicalRoots.length,
          0
        ),
        domains: catalog.map((definition) => ({
          id: definition.id,
          canonicalRoots: definition.canonicalRoots,
          derivedPaths: definition.derivedPaths,
          portable: definition.portable
        }))
      },
      diagnostics: summarizeDiagnostics(diagnostics),
      reconciliation: {
        status: reconciliation.status,
        scannedFiles: reconciliation.scannedFiles,
        changeCount: reconciliation.changes.length,
        changes: reconciliation.changes,
        errors: reconciliation.errors
      }
    },
    ...(validationError
      ? {
          error: {
            code: 'validation-failed',
            message: 'Vault status found one or more validation issues'
          }
        }
      : {})
  }
}

async function executeValidate(rootPath: string): Promise<VaultCliCommandResult> {
  const [diagnostics, manifest] = await Promise.all([
    collectVaultDiagnostics(rootPath),
    readStableVaultManifest(rootPath)
  ])
  const manifestIssue = !manifest.present
    ? {
        severity: 'warning' as const,
        code: 'manifest-missing',
        path: VAULT_MANIFEST_RELATIVE_PATH,
        message: 'Stable vault identity is not initialized',
        recoverable: true
      }
    : manifest.valid
      ? null
      : {
          severity: 'error' as const,
          code: 'manifest-invalid',
          path: VAULT_MANIFEST_RELATIVE_PATH,
          message: manifest.errors.join('; '),
          recoverable: true
        }
  const issues = manifestIssue ? [...diagnostics.issues, manifestIssue] : diagnostics.issues
  const valid =
    issues.every((issue) => issue.severity !== 'error') && manifest.present && manifest.valid

  return {
    exitCode: valid ? VAULT_CLI_EXIT_CODES.success : VAULT_CLI_EXIT_CODES.validation,
    data: {
      rootPath,
      valid,
      manifest,
      diagnostics: {
        ...diagnostics,
        issues
      }
    },
    ...(!valid
      ? {
          error: {
            code: 'validation-failed',
            message: 'Vault validation failed; inspect diagnostics.issues for details'
          }
        }
      : {})
  }
}

async function executeStableManifest(rootPath: string): Promise<VaultCliCommandResult> {
  const manifest = await readStableVaultManifest(rootPath)
  const valid = manifest.present && manifest.valid
  return {
    exitCode: valid ? VAULT_CLI_EXIT_CODES.success : VAULT_CLI_EXIT_CODES.validation,
    data: {
      rootPath,
      kind: 'stable-vault',
      manifest
    },
    ...(!valid
      ? {
          error: {
            code: manifest.present ? 'manifest-invalid' : 'manifest-missing',
            message: manifest.present
              ? 'The stable vault manifest is invalid'
              : `The stable vault manifest is missing at ${VAULT_MANIFEST_RELATIVE_PATH}`
          }
        }
      : {})
  }
}

async function executePortableManifest(rootPath: string): Promise<VaultCliCommandResult> {
  const manifest = await buildPortableManifest(rootPath)
  return {
    exitCode: VAULT_CLI_EXIT_CODES.success,
    data: {
      rootPath,
      kind: 'portable-transfer',
      path: 'manifest.json',
      checksum: checksumPortableManifest(manifest),
      manifest
    }
  }
}

async function executeScan(rootPath: string): Promise<VaultCliCommandResult> {
  let scannedFiles
  try {
    scannedFiles = await scanVaultFiles(rootPath, { rejectSymlinks: true })
  } catch (error) {
    throw new VaultCliError('unsafe-scan', describeError(error), VAULT_CLI_EXIT_CODES.validation)
  }
  const files = scannedFiles
    .filter((file) => isPortableScopePath(file.path))
    .map(({ path: relPath, size, checksum }) => ({ path: relPath, size, checksum }))
  return {
    exitCode: VAULT_CLI_EXIT_CODES.success,
    data: {
      rootPath,
      portable: true,
      fileCount: files.length,
      checksum: checksumManifestFiles(files),
      files
    }
  }
}

async function executeBackup(
  rootPath: string,
  parsed: ParsedVaultCliArgs
): Promise<VaultCliCommandResult> {
  if (parsed.preview) {
    const manifest = await buildPortableManifest(rootPath)
    return {
      exitCode: VAULT_CLI_EXIT_CODES.success,
      data: {
        rootPath,
        kind: 'portable-backup',
        preview: true,
        destinationPath: parsed.destinationPath ?? null,
        fileCount: manifest.files.length,
        checksum: checksumPortableManifest(manifest),
        manifest
      }
    }
  }

  const backup = await createVaultBackup(rootPath, parsed.destinationPath)
  return {
    exitCode: VAULT_CLI_EXIT_CODES.success,
    data: {
      rootPath,
      kind: 'portable-backup',
      preview: false,
      backup,
      checksum: backup.checksum
    }
  }
}

function createHelpData(): Record<string, unknown> {
  return {
    usage: 'xingularity vault <command> [--root <path>] [options] [--pretty]',
    output: 'JSON on stdout for both successful and failed commands',
    commands: {
      status:
        'Read diagnostics, catalog coverage, stable identity, and an in-memory reconcile preview',
      validate: 'Read diagnostics and validate the stable vault manifest',
      manifest: 'Read .xingularity/manifest.json without creating or changing it',
      'manifest --portable': 'Preview a verified portable transfer manifest without writing it',
      scan: 'List safe portable files with sizes and SHA-256 checksums',
      backup: 'Create a verified portable backup; use --preview to avoid writing it',
      context: 'Read a bounded, safe workspace context bundle for an agent or automation',
      search:
        'Search notes, projects, tasks, calendar events, resources, and subscriptions without returning secrets',
      read: 'Read a bounded Markdown note from notebooks/',
      conflicts: 'List unresolved conflicts and quarantined files without changing them'
    },
    options: {
      '--root <path>': 'Vault root; defaults to the current working directory',
      '--json': 'Explicitly select the JSON output format (the default)',
      '--pretty': 'Indent JSON for humans while preserving the same schema',
      '--portable': 'Use the portable transfer boundary with the manifest command',
      '--preview': 'Preview a backup without creating files',
      '--destination/--output <path>':
        'Backup destination; defaults to a generated folder inside the vault',
      '--query <text>': 'Filter context or search across safe workspace content',
      '--project <id-or-name>': 'Limit a context bundle to one project',
      '--note <path>': 'Limit a context bundle to one Markdown note',
      '--path <path>': 'Markdown note path for the read command',
      '--limit <number>': 'Maximum records per context collection or search result set',
      '--max-chars <number>': 'Maximum user-authored context/read characters',
      '--no-diagnostics': 'Skip the read-only vault diagnostics pass for context',
      '--help': 'Show this JSON help document'
    },
    exitCodes: VAULT_CLI_EXIT_CODES
  }
}

function summarizeDiagnostics(report: VaultDiagnosticsReport): Record<string, unknown> {
  return {
    generatedAt: report.generatedAt,
    schemaVersion: report.schemaVersion,
    recordCounts: report.recordCounts,
    legacyPaths: report.legacyPaths,
    orphanedPaths: report.orphanedPaths,
    issueCounts: summarizeIssueCounts(report),
    issues: report.issues
  }
}

function summarizeIssueCounts(report: VaultDiagnosticsReport): {
  total: number
  errors: number
  warnings: number
  info: number
} {
  return report.issues.reduce(
    (counts, issue) => {
      counts.total += 1
      counts[
        issue.severity === 'error' ? 'errors' : issue.severity === 'warning' ? 'warnings' : 'info'
      ] += 1
      return counts
    },
    { total: 0, errors: 0, warnings: 0, info: 0 }
  )
}

async function assertVaultRoot(rootPath: string): Promise<void> {
  const stats = await fs.lstat(rootPath).catch((error: unknown) => {
    if (isMissingPathError(error)) {
      throw new VaultCliError(
        'root-not-found',
        `Vault root does not exist: ${rootPath}`,
        VAULT_CLI_EXIT_CODES.validation
      )
    }
    throw error
  })
  if (stats.isSymbolicLink()) {
    throw new VaultCliError(
      'unsafe-root',
      'Vault root symbolic links are not accepted by the CLI',
      VAULT_CLI_EXIT_CODES.validation
    )
  }
  if (!stats.isDirectory()) {
    throw new VaultCliError(
      'invalid-root',
      `Vault root is not a directory: ${rootPath}`,
      VAULT_CLI_EXIT_CODES.validation
    )
  }
}

function createErrorResponse(command: string, error: unknown, rootPath?: string): VaultCliResponse {
  const cliError = error instanceof VaultCliError ? error : undefined
  const exitCode = cliError?.exitCode ?? VAULT_CLI_EXIT_CODES.operational
  return {
    ok: false,
    command,
    exitCode,
    ...(rootPath ? { rootPath } : {}),
    error: {
      code: cliError?.code ?? 'operational-error',
      message: cliError?.message ?? describeError(error)
    }
  }
}

function isVaultCliSubcommand(value: string): value is VaultCliSubcommand {
  return (
    value === 'status' ||
    value === 'validate' ||
    value === 'manifest' ||
    value === 'scan' ||
    value === 'backup' ||
    value === 'context' ||
    value === 'search' ||
    value === 'read' ||
    value === 'conflicts'
  )
}

function isVaultRootPositionalCommand(command: VaultCliSubcommand): boolean {
  return (
    command === 'status' ||
    command === 'validate' ||
    command === 'manifest' ||
    command === 'scan' ||
    command === 'backup' ||
    command === 'conflicts'
  )
}

function takeOptionValue(tokens: string[], option: string): string {
  const value = tokens.shift()
  if (!value || value.startsWith('-')) {
    throw new VaultCliError(
      `missing-${option.replace(/^--/, '').replace(/-([a-z])/g, (_match, letter: string) => letter)}`,
      `The ${option} option requires a value`,
      VAULT_CLI_EXIT_CODES.usage
    )
  }
  return value
}

function parseIntegerOption(value: string, option: string, min: number, max: number): number {
  if (!/^\d+$/.test(value)) {
    throw new VaultCliError(
      `invalid-${option.slice(2).replace(/-/g, '-')}`,
      `The ${option} option must be an integer between ${min} and ${max}`,
      VAULT_CLI_EXIT_CODES.usage
    )
  }
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new VaultCliError(
      `invalid-${option.slice(2).replace(/-/g, '-')}`,
      `The ${option} option must be an integer between ${min} and ${max}`,
      VAULT_CLI_EXIT_CODES.usage
    )
  }
  return parsed
}

function isMissingPathError(error: unknown): boolean {
  return isNodeError(error) && error.code === 'ENOENT'
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
