import type { RuntimeType } from '../../../shared/scheduleTypes'

export type ScheduleCodeLanguage = 'python' | 'javascript'

export function getScheduleCodeLanguage(runtime: RuntimeType): ScheduleCodeLanguage {
  return runtime === 'javascript' ? 'javascript' : 'python'
}
