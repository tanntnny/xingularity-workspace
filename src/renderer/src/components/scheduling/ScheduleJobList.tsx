import type { ReactElement } from 'react'
import { FolderOpen, MoreHorizontal, Play, Plus, Trash2 } from '../ui/icons'
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
import { ActionMenuItems, type ActionMenuGroup } from '../ui/action-menu'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '../ui/context-menu'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { WorkspaceIconButton } from '../ui/document-workspace'
import { usePersistentTableSort } from '../../hooks/usePersistentTableSort'

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

function getScheduleJobMenuGroups(
  job: ScheduleJob,
  onSelect: (jobId: string) => void,
  onRunJob?: (jobId: string) => void,
  onRequestDeleteJob?: (jobId: string) => void,
  isRunning = false
): ActionMenuGroup[] {
  return [
    {
      id: 'primary',
      items: [
        {
          id: 'open',
          label: 'Open automation',
          icon: <FolderOpen aria-hidden="true" />,
          onSelect: () => onSelect(job.id)
        }
      ]
    },
    {
      id: 'execution',
      items: onRunJob
        ? [
            {
              id: 'run',
              label: isRunning ? 'Running…' : 'Run now',
              icon: <Play aria-hidden="true" />,
              disabled: isRunning,
              onSelect: () => onRunJob(job.id)
            }
          ]
        : []
    },
    {
      id: 'destructive',
      items: onRequestDeleteJob
        ? [
            {
              id: 'delete',
              label: 'Delete automation',
              icon: <Trash2 aria-hidden="true" />,
              destructive: true,
              onSelect: () => onRequestDeleteJob(job.id)
            }
          ]
        : []
    }
  ]
}

export function ScheduleJobList({
  jobs,
  selectedJobId,
  loading,
  className,
  onSelect,
  onCreate,
  onRunJob,
  onRequestDeleteJob,
  isRunning = false
}: ScheduleJobListProps): ReactElement {
  const [sortState, setSortState] = usePersistentTableSort(
    'xingularity:table-sort:schedules',
    null,
    ['name', 'status', 'schedule', 'runtime', 'last-run'] as const
  )

  const columns: readonly TableRowListColumn<ScheduleJob>[] = [
    {
      id: 'name',
      header: 'Automation',
      cellClassName: 'min-w-56',
      sortValue: (job) => job.name,
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
      sortValue: (job) => getStatus(job.lastStatus, job.enabled),
      renderCell: (job) => (
        <StatusChip item={SCHEDULE_JOB_STATUS_CHIP_ITEMS[getStatus(job.lastStatus, job.enabled)]} />
      )
    },
    {
      id: 'schedule',
      header: 'Schedule',
      cellClassName: 'whitespace-nowrap text-muted-foreground',
      sortValue: (job) => formatTrigger(job.trigger),
      renderCell: (job) => formatTrigger(job.trigger)
    },
    {
      id: 'runtime',
      header: 'Runtime',
      cellClassName: 'whitespace-nowrap text-muted-foreground',
      sortValue: (job) => (job.runtime === 'javascript' ? 'JavaScript' : 'Python'),
      renderCell: (job) => (job.runtime === 'javascript' ? 'JavaScript' : 'Python')
    },
    {
      id: 'last-run',
      header: 'Last run',
      cellClassName: 'whitespace-nowrap text-muted-foreground',
      sortValue: (job) => job.lastRunAt,
      sortDefaultDirection: 'desc',
      renderCell: (job) => formatLastRunDate(job.lastRunAt)
    },
    {
      id: 'actions',
      header: '',
      cellClassName: 'w-12 text-right',
      renderCell: (job) => {
        const groups = getScheduleJobMenuGroups(
          job,
          onSelect,
          onRunJob,
          onRequestDeleteJob,
          isRunning
        )

        return (
          <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <WorkspaceIconButton
                  variant="rowAction"
                  borderless
                  data-testid={`scheduling-job-menu:${job.id}`}
                  aria-label={`Open automation menu for ${job.name}`}
                  title={`Open automation menu for ${job.name}`}
                  icon={<MoreHorizontal size={15} aria-hidden="true" />}
                  className="h-7 w-7 bg-transparent hover:bg-card-hover focus-visible:bg-card-hover"
                  onClick={(event) => event.stopPropagation()}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <ActionMenuItems variant="dropdown" groups={groups} />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      }
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
          sortState={sortState}
          onSortChange={setSortState}
          getRowKey={(job) => job.id}
          getRowProps={(job) => ({
            'data-testid': `scheduling-job:${job.id}`,
            'data-state': selectedJobId === job.id ? 'selected' : undefined,
            onClick: () => onSelect(job.id)
          })}
          rowWrapper={(job, tableRow) => {
            const groups = getScheduleJobMenuGroups(
              job,
              onSelect,
              onRunJob,
              onRequestDeleteJob,
              isRunning
            )

            return (
              <ContextMenu key={job.id}>
                <ContextMenuTrigger asChild>{tableRow}</ContextMenuTrigger>
                <ContextMenuContent data-testid={`scheduling-job-context-menu:${job.id}`}>
                  <ActionMenuItems variant="context" groups={groups} />
                </ContextMenuContent>
              </ContextMenu>
            )
          }}
        />
      )}
    </section>
  )
}
