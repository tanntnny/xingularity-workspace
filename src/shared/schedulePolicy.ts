import type { ScheduleJobInput, SchedulePermission, ScheduleJob, OutputMode } from './scheduleTypes'
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
  requiresReview: boolean
}

/**
 * Keep the scheduler's capability boundary explicit and auditable. A job may
 * request capabilities, but a job that can publish workspace mutations or
 * access secrets should be reviewable by default.
 */
export function evaluateScheduleCapabilities(
  input: Pick<ScheduleJobInput, 'permissions' | 'secretRefs' | 'outputMode'> | ScheduleJob
): ScheduleCapabilityDecision {
  const permissions = normalizeSchedulePermissions(input.permissions)
  const errors: string[] = []
  const usesSecrets = permissions.includes('useSecrets')
  const mutatesWorkspace = permissions.some((permission) =>
    [
      'createNotes',
      'updateNotes',
      'createTasks',
      'updateTasks',
      'createCalendarItems',
      'updateProjects'
    ].includes(permission)
  )

  if (usesSecrets && (input.secretRefs ?? []).length === 0) {
    errors.push('The useSecrets capability requires at least one configured secret reference')
  }

  if (input.outputMode === 'auto_apply' && (usesSecrets || mutatesWorkspace)) {
    return {
      allowed: errors.length === 0,
      errors,
      requiresReview: true
    }
  }

  return {
    allowed: errors.length === 0,
    errors,
    requiresReview: false
  }
}

export function normalizeScheduleOutputMode(
  outputMode: OutputMode,
  decision: ScheduleCapabilityDecision
): OutputMode {
  return decision.requiresReview ? 'review_before_apply' : outputMode
}
