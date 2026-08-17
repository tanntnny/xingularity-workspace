import type { ReactElement } from 'react'
import { Plus } from '../ui/icons'
import { APP_PAGE_ICONS } from '../../lib/pageIcons'
import {
  Badge,
  Button,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../ui'
import type { RunStatus, ScheduleJob, TriggerConfig } from '../../../../shared/scheduleTypes'
import { cn } from '../../lib/utils'
import type { ScheduleJobListProps } from './types'

function formatLastRunDate(value: string | undefined): string {
  if (!value) {
    return 'Never run'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString()
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

function JobListRow({
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
    <TableRow
      data-testid={`scheduling-job:${job.id}`}
      data-state={selected ? 'selected' : undefined}
      onClick={onSelect}
      className="cursor-pointer rounded-xl border-0 bg-card hover:bg-accent data-[state=selected]:bg-accent"
    >
      <TableCell className="min-w-56 rounded-l-xl bg-inherit">
        <Button
          type="button"
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation()
            onSelect()
          }}
          className="h-auto max-w-full justify-start truncate rounded-none px-0 text-left font-medium text-foreground hover:bg-transparent hover:text-foreground"
          aria-label={`Open automation ${job.name}`}
        >
          {job.name}
        </Button>
      </TableCell>
      <TableCell className="bg-inherit">
        <Badge tone={status.tone}>{status.label}</Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap bg-inherit text-muted-foreground">
        {formatTrigger(job.trigger)}
      </TableCell>
      <TableCell className="whitespace-nowrap bg-inherit text-muted-foreground">
        {job.runtime === 'javascript' ? 'JavaScript' : 'Python'}
      </TableCell>
      <TableCell className="whitespace-nowrap rounded-r-xl bg-inherit text-muted-foreground">
        {formatLastRunDate(job.lastRunAt)}
      </TableCell>
    </TableRow>
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
    <section
      className={cn('flex min-h-full min-w-0 flex-col gap-6 p-2', className)}
      data-testid="scheduling-job-list"
      aria-labelledby="scheduling-job-list-heading"
    >
      <header className="flex shrink-0 items-end justify-between gap-4">
        <div className="min-w-0">
          <h1
            id="scheduling-job-list-heading"
            className="text-2xl font-semibold tracking-tight text-foreground"
          >
            Scheduling
          </h1>
        </div>
      </header>

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
        <Table
          aria-label="Automations"
          data-testid="scheduling-job-list-items"
          className="border-separate border-spacing-y-1"
        >
          <TableHeader className="[&_tr]:border-0">
            <TableRow>
              <TableHead>Automation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Runtime</TableHead>
              <TableHead>Last run</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr]:border-0">
            {jobs.map((job) => (
              <JobListRow
                key={job.id}
                job={job}
                selected={selectedJobId === job.id}
                onSelect={() => onSelect(job.id)}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
