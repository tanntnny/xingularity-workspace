import type {
  ScheduleJob,
  ScheduleJobInput,
  SchedulePermission,
  ScheduleRunRecord,
  TriggerConfig
} from '../../../../shared/scheduleTypes'

export type SchedulingView = 'list' | 'automation' | 'history'

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
  onChange: (patch: Partial<ScheduleDraft>) => void
  onTriggerChange: (trigger: TriggerConfig) => void
}

export interface SchedulePropertiesPanelProps {
  draft: ScheduleDraft
  onChange: (patch: Partial<ScheduleDraft>) => void
  onEnabledChange: (enabled: boolean) => void
  onTriggerChange: (trigger: TriggerConfig) => void
  onTogglePermission: (permission: SchedulePermission, enabled: boolean) => void
}

export interface ScheduleRunHistoryProps {
  runs: readonly ScheduleRunRecord[]
  selectedRunId: string | null
  actionBusyRunId: string | null
  onApply: (runId: string) => void
  onDismiss: (runId: string) => void
}

export interface ScheduleRunHistoryListProps {
  runs: readonly ScheduleRunRecord[]
  selectedRunId: string | null
  onSelect: (runId: string) => void
}
