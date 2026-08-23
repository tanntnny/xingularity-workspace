import type { ReactElement } from 'react'

import type { Project, ProjectUpdate } from '../../../shared/types'
import { CollapsibleWorkspacePanelSection } from './ui/workspace-panel-section'
import { EmptyState } from './ui/empty-state'
import { TableRowList, type TableRowListColumn } from './ui/table-row-list'
import { StatusChip } from './ui/status-chip'
import { ChartDots3 } from './ui/icons'
import { PROJECT_UPDATE_CHIP_ITEMS } from '../lib/statusChipMeta'

function formatActivityDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'

  const dateLabel = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'
  })
  const timeLabel = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  })

  return `${dateLabel} · ${timeLabel}`
}

function sortUpdates(updates: readonly ProjectUpdate[]): ProjectUpdate[] {
  return updates.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export function ProjectActivityPanel({ project }: { project: Project }): ReactElement {
  const updates = sortUpdates(project.updates ?? [])
  const columns: readonly TableRowListColumn<ProjectUpdate>[] = [
    {
      id: 'activity',
      header: 'Activity',
      headerClassName: 'sr-only',
      cellClassName: 'min-w-0 p-0',
      renderCell: (update) => {
        return (
          <div className="flex min-w-0 items-center gap-2 p-3">
            <StatusChip
              item={PROJECT_UPDATE_CHIP_ITEMS[update.status]}
              surface="pill"
              className="shrink-0 text-xs"
              data-testid={`project-activity-status:${update.id}`}
            />
            <time
              dateTime={update.createdAt}
              className="shrink-0 text-[11px] text-muted-foreground"
              data-testid={`project-activity-time:${update.id}`}
            >
              {formatActivityDate(update.createdAt)}
            </time>
            <span
              className="ml-auto shrink-0 text-[11px] text-muted-foreground"
              data-testid={`project-activity-author:${update.id}`}
            >
              By You
            </span>
          </div>
        )
      }
    }
  ]

  return (
    <CollapsibleWorkspacePanelSection heading="Activity" data-testid="project-activity-panel">
      {updates.length > 0 ? (
        <div className="p-3">
          <TableRowList
            aria-label="Project update history"
            data-testid="project-activity-table"
            className="text-xs"
            columns={columns}
            items={updates}
            getRowKey={(update) => update.id}
            getRowProps={(update) => ({
              'data-testid': `project-activity-row:${update.id}`
            })}
          />
        </div>
      ) : (
        <EmptyState
          icon={ChartDots3}
          title="No updates yet"
          description="Posted project updates will appear here."
          className="min-h-24 px-3 py-5 [&_h2]:text-sm [&_p]:text-xs"
          data-testid="project-activity-empty"
        />
      )}
    </CollapsibleWorkspacePanelSection>
  )
}
