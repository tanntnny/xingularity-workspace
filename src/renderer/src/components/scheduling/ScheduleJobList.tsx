import type { ReactElement } from 'react'
import { Clock3, Plus } from '../ui/icons'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState } from '../ui'
import type { RunStatus, ScheduleJob, TriggerConfig } from '../../../../shared/scheduleTypes'
import { cn } from '../../lib/utils'
import type { ScheduleJobListProps } from './types'

function formatTrigger(trigger: TriggerConfig): string {
  if (trigger.type === 'daily') {
    return `Daily at ${trigger.time ?? '09:00'}`
  }

  if (trigger.type === 'every') {
    const interval = trigger.intervalMinutes ?? 60
    return `Every ${interval} minute${interval === 1 ? '' : 's'}`
  }

  if (trigger.type === 'on_app_start') {
    return 'When app starts'
  }

  if (trigger.type === 'cron') {
    return 'Cron schedule'
  }

  return 'Manual'
}

function formatDateTime(value: string | undefined): string {
  if (!value) {
    return 'Never run'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString()
}

function getStatus(
  status: RunStatus | undefined,
  enabled: boolean
): {
  label: string
  tone: 'neutral' | 'success' | 'warning' | 'danger'
} {
  if (!enabled) {
    return { label: 'Disabled', tone: 'neutral' }
  }

  if (status === 'error') {
    return { label: 'Error', tone: 'danger' }
  }

  if (status === 'review') {
    return { label: 'Needs review', tone: 'warning' }
  }

  if (status === 'success') {
    return { label: 'Healthy', tone: 'success' }
  }

  return { label: 'Ready', tone: 'neutral' }
}

function JobListItem({
  job,
  selected,
  onSelect
}: {
  job: ScheduleJob
  selected: boolean
  onSelect: () => void
}): ReactElement {
  const status = getStatus(job.lastStatus, job.enabled)

  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`scheduling-job:${job.id}`}
      aria-pressed={selected}
      className={`w-full rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        selected ? 'border-primary bg-accent' : 'border-border bg-card hover:bg-accent/60'
      }`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-semibold text-foreground">{job.name}</span>
        <Badge tone={status.tone}>{status.label}</Badge>
      </span>
      <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{formatTrigger(job.trigger)}</span>
        <span aria-hidden="true">·</span>
        <span>{job.runtime === 'python' ? 'Python' : 'JavaScript'}</span>
      </span>
      <span className="mt-2 block truncate text-xs text-muted-foreground">
        Last run: {formatDateTime(job.lastRunAt)}
      </span>
    </button>
  )
}

export function ScheduleJobList({
  jobs,
  selectedJobId,
  loading,
  className,
  onSelect,
  onCreate
}: ScheduleJobListProps): ReactElement {
  return (
    <Card
      className={cn('flex min-h-0 flex-col lg:max-h-full', className)}
      data-testid="scheduling-job-list"
    >
      <CardHeader className="gap-3 pb-3">
        <div>
          <CardTitle>Automations</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Small scripts that keep your workspace moving.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="self-start"
          onClick={onCreate}
          data-testid="scheduling-add-automation"
        >
          <Plus aria-hidden="true" />
          Add automation
        </Button>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto pt-0">
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading automations…</p>
        ) : jobs.length > 0 ? (
          <div className="space-y-2">
            {jobs.map((job) => (
              <JobListItem
                key={job.id}
                job={job}
                selected={selectedJobId === job.id}
                onSelect={() => onSelect(job.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Clock3}
            title="No automations yet"
            description="Create a Python automation to add tasks or notes on a schedule."
            action={
              <Button type="button" variant="outline" size="sm" onClick={onCreate}>
                <Plus aria-hidden="true" />
                Create your first automation
              </Button>
            }
          />
        )}
      </CardContent>
    </Card>
  )
}
