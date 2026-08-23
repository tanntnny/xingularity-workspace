import type { ReactElement } from 'react'
import { Plus } from '../ui/icons'
import { APP_PAGE_ICONS } from '../../lib/pageIcons'
import { Button, EmptyState, TableRowList, type TableRowListColumn } from '../ui'
import type { RunStatus, ScheduleJob, TriggerConfig } from '../../../../shared/scheduleTypes'
import { cn } from '../../lib/utils'
import {
  SCHEDULE_JOB_STATUS_CHIP_ITEMS,
  type ScheduleJobChipStatus
} from '../../lib/statusChipMeta'
import { StatusChip } from '../ui/status-chip'
import type { ScheduleJobListProps } from './types'

function formatLastRunDate(value: string | undefined): string {
  if (!value) {
    return 'Never run'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString()
}

function getStatus(status: RunStatus | undefined, enabled: boolean): ScheduleJobChipStatus {
  if (!enabled) {
    return 'disabled'
  }

  if (status === 'error') {
    return 'error'
  }

  if (status === 'review') {
    return 'review'
  }

  if (status === 'success') {
    return 'success'
  }

  return 'ready'
}

function formatTrigger(trigger: TriggerConfig): string {
  if (trigger.type === 'daily') {
    return `Daily at ${trigger.time ?? '09:00'}`
  }

  if (trigger.type === 'every') {
    const interval = trigger.intervalMinutes ?? 60
    return interval === 1 ? 'Every minute' : `Every ${interval} minutes`
  }

  if (trigger.type === 'cron') {
    return trigger.expression ? `Cron: ${trigger.expression}` : 'Cron'
  }

  if (trigger.type === 'on_app_start') {
    return 'When app starts'
  }

  return 'Manually'
}

export function ScheduleJobList({
  jobs,
  selectedJobId,
  loading,
  className,
  onSelect,
  onCreate
}: ScheduleJobListProps): ReactElement {
  const columns: readonly TableRowListColumn<ScheduleJob>[] = [
    {
      id: 'name',
      header: 'Automation',
      cellClassName: 'min-w-56',
      renderCell: (job) => (
        <Button
          type="button"
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation()
            onSelect(job.id)
          }}
          className="h-auto max-w-full justify-start truncate rounded-none px-0 text-left font-medium text-foreground hover:bg-transparent hover:text-foreground"
          aria-label={`Open automation ${job.name}`}
        >
          {job.name}
        </Button>
      )
    },
    {
      id: 'status',
      header: 'Status',
      renderCell: (job) => (
        <StatusChip item={SCHEDULE_JOB_STATUS_CHIP_ITEMS[getStatus(job.lastStatus, job.enabled)]} />
      )
    },
    {
      id: 'schedule',
      header: 'Schedule',
      cellClassName: 'whitespace-nowrap text-muted-foreground',
      renderCell: (job) => formatTrigger(job.trigger)
    },
    {
      id: 'runtime',
      header: 'Runtime',
      cellClassName: 'whitespace-nowrap text-muted-foreground',
      renderCell: (job) => (job.runtime === 'javascript' ? 'JavaScript' : 'Python')
    },
    {
      id: 'last-run',
      header: 'Last run',
      cellClassName: 'whitespace-nowrap text-muted-foreground',
      renderCell: (job) => formatLastRunDate(job.lastRunAt)
    }
  ]

  return (
    <section
      className={cn('flex min-h-full min-w-0 flex-col gap-6', className)}
      data-testid="scheduling-job-list"
      aria-labelledby="scheduling-job-list-heading"
    >
      {loading ? (
        <div
          className="flex min-h-32 items-center justify-center text-sm text-muted-foreground"
          aria-live="polite"
        >
          Loading automations…
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={APP_PAGE_ICONS.schedules}
          title="No automations yet"
          description="Create a Python automation to add tasks or notes on a schedule."
          action={
            <Button type="button" variant="outline" size="sm" onClick={onCreate}>
              <Plus aria-hidden="true" />
              Create your first automation
            </Button>
          }
        />
      ) : (
        <TableRowList
          aria-label="Automations"
          data-testid="scheduling-job-list-items"
          columns={columns}
          items={jobs}
          getRowKey={(job) => job.id}
          getRowProps={(job) => ({
            'data-testid': `scheduling-job:${job.id}`,
            'data-state': selectedJobId === job.id ? 'selected' : undefined,
            onClick: () => onSelect(job.id)
          })}
        />
      )}
    </section>
  )
}
