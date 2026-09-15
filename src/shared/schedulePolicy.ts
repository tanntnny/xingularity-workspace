import type { ScheduleJobInput, SchedulePermission } from './scheduleTypes'
import { ALL_PERMISSIONS } from './scheduleTypes'

const PERMISSION_SET = new Set<SchedulePermission>(ALL_PERMISSIONS)

export function normalizeSchedulePermissions(
  permissions: readonly SchedulePermission[] | undefined
): SchedulePermission[] {
  return Array.from(
    new Set((permissions ?? []).filter((permission) => PERMISSION_SET.has(permission)))
  )
}

export interface ScheduleCapabilityDecision {
  allowed: boolean
  errors: string[]
}

/**
 * Keep the scheduler's capability boundary explicit and auditable. A job may
 * request capabilities, but secret access still requires explicitly declared
 * secret references. Output handling remains the user's explicit choice.
 */
export function evaluateScheduleCapabilities(
  input: Pick<ScheduleJobInput, 'permissions' | 'secretRefs'>
): ScheduleCapabilityDecision {
  const permissions = normalizeSchedulePermissions(input.permissions)
  const errors: string[] = []
  const usesSecrets = permissions.includes('useSecrets')
  if (usesSecrets && (input.secretRefs ?? []).length === 0) {
    errors.push('The useSecrets capability requires at least one configured secret reference')
  }

  return {
    allowed: errors.length === 0,
    errors
  }
}
