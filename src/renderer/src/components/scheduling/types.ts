import type {
  ScheduleJob,
  ScheduleJobInput,
  SchedulePermission,
  ScheduleRunRecord,
  TriggerConfig
} from '../../../../shared/scheduleTypes'

export type SchedulingView = 'automation' | 'history'

export type ScheduleDraft = ScheduleJobInput

export interface ScheduleJobListProps {
  jobs: readonly ScheduleJob[]
  selectedJobId: string | null
  loading: boolean
  className?: string
  onSelect: (jobId: string) => void
  onCreate: () => void
}

export interface ScheduleEditorProps {
  draft: ScheduleDraft
  isNew: boolean
  isDirty: boolean
  isSaving: boolean
  isRunning: boolean
  onChange: (patch: Partial<ScheduleDraft>) => void
  onEnabledChange: (enabled: boolean) => void
  onTriggerChange: (trigger: TriggerConfig) => void
  onTogglePermission: (permission: SchedulePermission, enabled: boolean) => void
  onInsertTemplate: (kind: 'task' | 'note') => void
  onSave: () => void
  onRun: () => void
  onDelete: () => void
}

export interface ScheduleRunHistoryProps {
  runs: readonly ScheduleRunRecord[]
  selectedRunId: string | null
  actionBusyRunId: string | null
  onSelect: (runId: string) => void
  onApply: (runId: string) => void
  onDismiss: (runId: string) => void
}
