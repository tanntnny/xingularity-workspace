import { z } from 'zod'
import type { PluginCapabilityManifest } from './types'

export type PluginManifest = PluginCapabilityManifest
export type PluginProvider = PluginManifest['provider']
export type PluginPermission = PluginManifest['permissions'][number]

export const PLUGIN_PROVIDERS = [
  'calendar',
  'task-import',
  'note-export',
  'automation'
] as const satisfies readonly PluginProvider[]

export const PLUGIN_PERMISSIONS = [
  'network',
  'read-vault',
  'write-vault',
  'secrets'
] as const satisfies readonly PluginPermission[]

const providerCapabilityValues = {
  calendar: [
    'read-calendars',
    'read-events',
    'write-calendars',
    'write-events',
    'sync',
    'import',
    'export',
    'calendar.read',
    'calendar.write',
    'calendar.sync',
    'calendar.import',
    'calendar.export'
  ],
  'task-import': ['read-tasks', 'import-tasks', 'preview-import', 'tasks.read', 'tasks.import'],
  'note-export': [
    'read-notes',
    'export-notes',
    'export-markdown',
    'export-pdf',
    'notes.read',
    'notes.export'
  ],
  automation: [
    'run',
    'execute',
    'templates',
    'automation.run',
    'automation.execute',
    'automation.templates'
  ]
} as const satisfies Record<PluginProvider, readonly string[]>

export const PLUGIN_CAPABILITIES = Object.freeze({
  calendar: Object.freeze([...providerCapabilityValues.calendar]),
  'task-import': Object.freeze([...providerCapabilityValues['task-import']]),
  'note-export': Object.freeze([...providerCapabilityValues['note-export']]),
  automation: Object.freeze([...providerCapabilityValues.automation])
})

const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

const pluginIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/, 'Plugin id must use lowercase portable identifiers')

const pluginManifestBaseSchema = z
  .object({
    id: pluginIdSchema,
    version: z.string().regex(semverPattern, 'Plugin version must be strict semantic versioning'),
    name: z.string().trim().min(1).max(120),
    provider: z.enum(PLUGIN_PROVIDERS),
    capabilities: z.array(z.string().trim().min(1).max(80)).min(1).max(32),
    permissions: z.array(z.enum(PLUGIN_PERMISSIONS)).max(PLUGIN_PERMISSIONS.length),
    entrypoint: z
      .string()
      .trim()
      .min(1)
      .max(240)
      .refine(isPortableEntrypoint, 'Plugin entrypoint must be a safe relative JavaScript path')
      .optional()
  })
  .strict()

export const pluginManifestSchema = pluginManifestBaseSchema.superRefine((manifest, context) => {
  const capabilities = new Set(manifest.capabilities)
  const permissions = new Set(manifest.permissions)
  const allowedCapabilities = new Set<string>(providerCapabilityValues[manifest.provider])

  if (capabilities.size !== manifest.capabilities.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['capabilities'],
      message: 'Plugin capabilities must not contain duplicates'
    })
  }
  if (permissions.size !== manifest.permissions.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['permissions'],
      message: 'Plugin permissions must not contain duplicates'
    })
  }

  for (const capability of capabilities) {
    if (!allowedCapabilities.has(capability)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['capabilities'],
        message: `Capability ${capability} is not allowed for provider ${manifest.provider}`
      })
    }
  }

  const networkCapabilities = new Set([
    'read-calendars',
    'read-events',
    'write-calendars',
    'write-events',
    'sync',
    'import',
    'export',
    'calendar.read',
    'calendar.write',
    'calendar.sync',
    'calendar.import',
    'calendar.export',
    'import-tasks',
    'tasks.import'
  ])
  if (
    [...capabilities].some((capability) => networkCapabilities.has(capability)) &&
    !permissions.has('network')
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['permissions'],
      message: 'Network-backed capabilities require the network permission'
    })
  }

  const vaultReadCapabilities = new Set([
    'read-tasks',
    'tasks.read',
    'read-notes',
    'export-notes',
    'export-markdown',
    'export-pdf',
    'notes.read',
    'notes.export'
  ])
  if (
    [...capabilities].some((capability) => vaultReadCapabilities.has(capability)) &&
    !permissions.has('read-vault')
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['permissions'],
      message: 'Vault-reading capabilities require the read-vault permission'
    })
  }

  const vaultWriteCapabilities = new Set([
    'write-calendars',
    'write-events',
    'calendar.write',
    'import-tasks',
    'tasks.import',
    'automation.execute'
  ])
  if (
    [...capabilities].some((capability) => vaultWriteCapabilities.has(capability)) &&
    !permissions.has('write-vault')
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['permissions'],
      message: 'Vault-mutating capabilities require the write-vault permission'
    })
  }
  if (
    permissions.has('write-vault') &&
    ![...capabilities].some((capability) => vaultWriteCapabilities.has(capability))
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['permissions'],
      message: 'write-vault is not allowed without a declared mutating capability'
    })
  }
  if (permissions.has('secrets') && manifest.provider === 'note-export') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['permissions'],
      message: 'note-export plugins cannot request secrets permission'
    })
  }
})

export interface PluginManifestValidation {
  valid: boolean
  errors: string[]
  manifest?: PluginManifest
}

export function validatePluginManifest(input: unknown): PluginManifestValidation {
  const result = pluginManifestSchema.safeParse(input)
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map(
        (issue) => `${issue.path.join('.') || 'manifest'}: ${issue.message}`
      )
    }
  }
  return {
    valid: true,
    errors: [],
    manifest: normalizePluginManifest(result.data)
  }
}

export function parsePluginManifest(input: unknown): PluginManifest {
  const result = validatePluginManifest(input)
  if (!result.valid || !result.manifest) {
    throw new Error(`Invalid plugin manifest: ${(result.errors ?? []).join('; ')}`)
  }
  return result.manifest
}

export const assertValidPluginManifest = parsePluginManifest
export const parsePluginCapabilityManifest = parsePluginManifest
export const validatePluginCapabilityManifest = validatePluginManifest

export function isValidPluginManifest(input: unknown): input is PluginManifest {
  return validatePluginManifest(input).valid
}

export function normalizePluginManifest(manifest: PluginManifest): PluginManifest {
  return {
    ...manifest,
    capabilities: [...manifest.capabilities].sort(),
    permissions: [...manifest.permissions].sort()
  }
}

function isPortableEntrypoint(entrypoint: string): boolean {
  if (entrypoint.includes('\\') || entrypoint.startsWith('/') || /^[a-zA-Z]:/.test(entrypoint)) {
    return false
  }
  const segments = entrypoint.split('/')
  return (
    segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..') &&
    /\.(?:c?m?js)$/i.test(entrypoint)
  )
}
