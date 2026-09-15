import type { ReactElement } from 'react'

import type { TaskPageRow, TaskGroupBy } from '../lib/taskRows'
import { getTaskGroup } from '../lib/taskRows'
import { formatCalendarDateValue } from '../lib/calendarDateTimeInput'
import { formatCalendarTaskType } from '../../../shared/types'
import { isTaskDone } from '../../../shared/taskStatus'
import {
  getCalendarTaskTypeChipItem,
  getTagChipItem,
  getTaskPriorityChipItem,
  getTaskStatusChipItem
} from '../lib/statusChipMeta'
import { TASK_STATUS_META } from '../lib/taskStatus'
import { NoteShapeIcon } from './NoteShapeIcon'
import { Copy } from './ui/icons'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { WorkspaceIconButton } from './ui/document-workspace'
import { StatusChip } from './ui/status-chip'
import { TableRowList, type TableRowListColumn } from './ui/table-row-list'
import { WorkspaceTextFade } from './ui/workspace-text-fade'
import type { TableSortState } from '../lib/tableSort'
import type { TaskOpenOptions } from '../lib/taskOpenOptions'
import { getWorkspaceOpenOptions } from '../lib/workspaceOpen'

export const TASK_TABLE_SORTABLE_COLUMNS = [
  'name',
  'status',
  'type',
  'priority',
  'project',
  'milestone',
  'start-date',
  'end-date',
  'tags'
] as const

export interface TaskTableProps {
  rows: readonly TaskPageRow[]
  groupBy: TaskGroupBy
  sortState: TableSortState | null
  onSortChange: (sortState: TableSortState) => void
  onOpenTask: (taskId: string, options?: TaskOpenOptions) => void
  onDuplicateTask?: (taskId: string) => void | Promise<void>
}

export function TaskTable({
  rows,
  groupBy,
  sortState,
  onSortChange,
  onOpenTask,
  onDuplicateTask
}: TaskTableProps): ReactElement {
  const columns: readonly TableRowListColumn<TaskPageRow>[] = [
    {
      id: 'name',
      header: 'Name',
      cellClassName: 'min-w-64 max-w-[28rem]',
      sortValue: (row) => row.task.title,
      renderCell: (row) => (
        <Button
          type="button"
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation()
            onOpenTask(row.task.id, getWorkspaceOpenOptions(event))
          }}
          onAuxClick={(event) => {
            if (event.button !== 1) {
              return
            }
            event.preventDefault()
            event.stopPropagation()
            onOpenTask(row.task.id, { openInNewTab: true })
          }}
          className="h-auto max-w-full justify-start rounded-none px-0 text-left font-semibold text-foreground hover:bg-transparent hover:text-foreground"
          aria-label={`Open task: ${row.task.title}`}
          title={row.task.title}
        >
          <WorkspaceTextFade
            className={isTaskDone(row.task) ? 'min-w-0 flex-1 line-through' : 'min-w-0 flex-1'}
          >
            {row.task.title}
          </WorkspaceTextFade>
        </Button>
      )
    },
    {
      id: 'status',
      header: 'Status',
      cellClassName: 'whitespace-nowrap',
      sortValue: (row) => TASK_STATUS_META[row.status].label,
      renderCell: (row) => {
        const item = getTaskStatusChipItem(row.status)
        return (
          <StatusChip
            item={item}
            surface="hover-pill"
            mutedLabel
            className="text-xs"
            aria-label={`Status: ${item.label}`}
            title={`Status: ${item.label}`}
          />
        )
      }
    },
    {
      id: 'type',
      header: 'Type',
      cellClassName: 'whitespace-nowrap',
      sortValue: (row) => formatCalendarTaskType(row.taskType),
      renderCell: (row) => {
        const item = getCalendarTaskTypeChipItem(row.taskType)
        return (
          <StatusChip
            item={item}
            surface="hover-pill"
            mutedLabel
            className="text-xs"
            aria-label={`Type: ${item.label}`}
            title={`Type: ${item.label}`}
          />
        )
      }
    },
    {
      id: 'priority',
      header: 'Priority',
      cellClassName: 'whitespace-nowrap',
      sortValue: (row) => String(getTaskPriorityChipItem(row.priority).label),
      renderCell: (row) => {
        const item = getTaskPriorityChipItem(row.priority)
        return (
          <StatusChip
            item={item}
            surface="hover-pill"
            mutedLabel
            className="text-xs"
            aria-label={`Priority: ${item.label}`}
            title={`Priority: ${item.label}`}
          />
        )
      }
    },
    {
      id: 'project',
      header: 'Project',
      cellClassName: 'min-w-40 max-w-[20rem]',
      sortValue: (row) => row.projectLabel,
      renderCell: (row) => (
        <span
          className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"
          title={row.projectLabel}
        >
          {row.project ? <NoteShapeIcon icon={row.project.icon} size={18} /> : null}
          <WorkspaceTextFade className="min-w-0 flex-1">{row.projectLabel}</WorkspaceTextFade>
        </span>
      )
    },
    {
      id: 'milestone',
      header: 'Milestone',
      cellClassName: 'min-w-40 max-w-[20rem]',
      sortValue: (row) => row.milestoneLabel,
      renderCell: (row) => (
        <WorkspaceTextFade
          className="min-w-0 text-sm text-muted-foreground"
          title={row.milestoneLabel}
        >
          {row.milestoneLabel}
        </WorkspaceTextFade>
      )
    },
    {
      id: 'start-date',
      header: 'Start date',
      cellClassName: 'whitespace-nowrap text-muted-foreground',
      sortValue: (row) => row.task.date,
      sortDefaultDirection: 'asc',
      renderCell: (row) => <TaskDateCell value={row.task.date} />
    },
    {
      id: 'end-date',
      header: 'End date',
      cellClassName: 'whitespace-nowrap text-muted-foreground',
      sortValue: (row) => row.task.endDate,
      sortDefaultDirection: 'asc',
      renderCell: (row) => (
        <TaskDateCell
          value={row.task.endDate}
          deadlineOnly={!row.task.date && Boolean(row.task.endDate)}
        />
      )
    },
    {
      id: 'tags',
      header: 'Tags',
      cellClassName: 'min-w-48 max-w-[28rem]',
      sortValue: (row) => (row.tags.length > 0 ? row.tags.join(' · ') : null),
      renderCell: (row) => <TaskTagsCell row={row} />
    },
    {
      id: 'actions',
      header: 'Actions',
      headerClassName: 'w-12',
      cellClassName: 'w-12 text-right',
      renderCell: (row) =>
        onDuplicateTask ? (
          <WorkspaceIconButton
            icon={<Copy size={14} aria-hidden="true" />}
            aria-label={`Duplicate task: ${row.task.title}`}
            title="Duplicate task"
            borderless
            data-testid={`duplicate-task-button:${row.task.id}`}
            onClick={(event) => {
              event.stopPropagation()
              void onDuplicateTask(row.task.id)
            }}
          />
        ) : null
    }
  ]

  const activeGroupBy = groupBy === 'none' ? null : groupBy

  return (
    <TableRowList
      aria-label="Tasks"
      data-testid="tasks-table"
      columns={columns}
      items={rows}
      sortState={sortState}
      onSortChange={onSortChange}
      getGroup={
        activeGroupBy
          ? (row) => {
              const group = getTaskGroup(row, activeGroupBy)
              return group
            }
          : undefined
      }
      getRowKey={(row) => row.task.id}
      getRowProps={(row) => ({
        'data-testid': `task-row:${row.task.id}`,
        className: 'group',
        onClick: (event) => onOpenTask(row.task.id, getWorkspaceOpenOptions(event)),
        onAuxClick: (event) => {
          if (event.button !== 1) {
            return
          }
          event.preventDefault()
          event.stopPropagation()
          onOpenTask(row.task.id, { openInNewTab: true })
        }
      })}
    />
  )
}

function TaskDateCell({
  value,
  deadlineOnly = false
}: {
  value?: string
  deadlineOnly?: boolean
}): ReactElement {
  if (!value) {
    return (
      <span className="text-muted-foreground" aria-label="No date">
        —
      </span>
    )
  }

  const label = formatCalendarDateValue(value)
  return (
    <time dateTime={value} title={deadlineOnly ? `Due ${label}` : label}>
      {deadlineOnly ? `Due ${label}` : label}
    </time>
  )
}

function TaskTagsCell({ row }: { row: TaskPageRow }): ReactElement {
  if (row.tags.length === 0) {
    return (
      <span className="text-sm text-muted-foreground" aria-label="No tags">
        —
      </span>
    )
  }

  const visibleTags = row.tags.slice(0, 3)
  const remainingCount = row.tags.length - visibleTags.length

  return (
    <div className="flex min-w-0 items-center gap-1 overflow-hidden" title={row.tags.join(' · ')}>
      {visibleTags.map((tag) => (
        <StatusChip
          key={tag}
          item={getTagChipItem(tag)}
          surface="hover-pill"
          mutedLabel
          className="max-w-32 text-xs"
          aria-label={`Tag: ${tag}`}
        />
      ))}
      {remainingCount > 0 ? (
        <Badge variant="neutral" className="h-6 shrink-0 px-1.5 text-[11px]">
          +{remainingCount}
        </Badge>
      ) : null}
    </div>
  )
}
