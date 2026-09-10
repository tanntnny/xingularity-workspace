import type { ReactElement } from 'react'
import type { CalendarTask, Project, ProjectMilestone } from '../../../shared/types'
import {
  getProjectMilestoneProgress,
  getProjectMilestoneStatus,
  getProjectMilestoneTasks
} from '../lib/projectMilestones'
import { formatProjectDate } from '../lib/projectDateLabels'
import { CollapsibleWorkspacePanelSection } from './ui/workspace-panel-section'
import { EmptyState } from './ui/empty-state'
import { TableRowList, type TableRowListColumn } from './ui/table-row-list'
import { StatusChip } from './ui/status-chip'
import { ProgressRing } from './ui/progress-ring'
import { WorkspaceIconButton } from './ui/document-workspace'
import { WorkspaceTextFade } from './ui/workspace-text-fade'
import { CalendarCheck, CalendarOff, Milestone, Plus } from './ui/icons'
import { MilestoneCompletenessIcon } from './MilestoneCompletenessIcon'

interface ProjectMilestonesPanelProps {
  project: Project
  tasks: CalendarTask[]
  isCreatingMilestone?: boolean
  onCreateMilestone: () => void | Promise<void>
  onOpenMilestone: (milestoneId: string) => void
}

function getMilestoneEndDateChip(milestone: ProjectMilestone): ReactElement {
  const hasEndDate = Boolean(milestone.endDate)
  return (
    <StatusChip
      item={{
        label: hasEndDate ? formatProjectDate(milestone.endDate ?? '') : 'No end date',
        icon: hasEndDate ? (
          <CalendarCheck aria-hidden="true" />
        ) : (
          <CalendarOff aria-hidden="true" />
        ),
        iconColorToken: 'var(--muted-foreground)'
      }}
      variant="bare"
      mutedLabel={!hasEndDate}
      className="max-w-[9rem] shrink-0 text-[11px]"
      data-testid={`project-milestone-end-date:${milestone.id}`}
    />
  )
}

function getMilestoneProgressPercent(
  milestone: ProjectMilestone,
  tasks: CalendarTask[],
  projectId: string
): number {
  const milestoneTasks = getProjectMilestoneTasks(tasks, projectId, milestone.id)
  const progress = getProjectMilestoneProgress(milestoneTasks)
  return progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0
}

export function ProjectMilestonesPanel({
  project,
  tasks,
  isCreatingMilestone = false,
  onCreateMilestone,
  onOpenMilestone
}: ProjectMilestonesPanelProps): ReactElement {
  const milestones = project.milestones ?? []
  const columns: readonly TableRowListColumn<ProjectMilestone>[] = [
    {
      id: 'milestone',
      header: 'Milestones',
      headerClassName: 'h-8 px-2 text-[10px] uppercase tracking-wide',
      cellClassName: 'min-w-0 p-0',
      renderCell: (milestone) => {
        const status = getProjectMilestoneStatus(milestone, milestones, tasks, project.id)

        return (
          <div className="flex min-w-0 items-center gap-2 p-2">
            <MilestoneCompletenessIcon
              status={status}
              size={17}
              dataTestId={`project-milestone-panel-icon:${milestone.id}`}
            />
            <WorkspaceTextFade
              className="min-w-0 flex-1 text-sm font-medium text-foreground"
              title={milestone.title}
            >
              {milestone.title}
            </WorkspaceTextFade>
          </div>
        )
      }
    },
    {
      id: 'end-date',
      header: 'End date',
      headerClassName: 'h-8 px-2 text-[10px] uppercase tracking-wide',
      cellClassName: 'w-[7.5rem] min-w-[7.5rem] p-0',
      renderCell: (milestone) => (
        <div className="flex min-w-0 p-2">{getMilestoneEndDateChip(milestone)}</div>
      )
    },
    {
      id: 'progress',
      header: 'Progress',
      headerClassName: 'h-8 px-2 text-[10px] uppercase tracking-wide',
      cellClassName: 'w-[4.75rem] min-w-[4.75rem] p-0',
      renderCell: (milestone) => {
        const completionPercent = getMilestoneProgressPercent(milestone, tasks, project.id)

        return (
          <span
            className="flex items-center gap-1 p-2 text-[11px] text-muted-foreground"
            aria-label={`Milestone progress: ${completionPercent}%`}
            data-testid={`project-milestone-panel-progress:${milestone.id}`}
          >
            <ProgressRing
              value={completionPercent}
              size={18}
              data-testid={`project-milestone-panel-progress-ring:${milestone.id}`}
            />
            <span aria-hidden="true">{completionPercent}%</span>
          </span>
        )
      }
    }
  ]

  return (
    <CollapsibleWorkspacePanelSection
      heading="Milestones"
      data-testid="project-milestones-panel"
      actions={
        <WorkspaceIconButton
          aria-label="Add milestone"
          title={isCreatingMilestone ? 'Adding milestone…' : 'Add milestone'}
          icon={<Plus />}
          borderless
          disabled={isCreatingMilestone}
          onClick={() => void onCreateMilestone()}
          data-testid="project-milestones-add"
        />
      }
    >
      {milestones.length > 0 ? (
        <div className="px-2 pb-1">
          <TableRowList
            aria-label={`${project.name} milestones`}
            data-testid="project-milestones-table"
            className="table-fixed text-xs"
            columns={columns}
            items={milestones}
            hideHeader
            getRowKey={(milestone) => milestone.id}
            getRowProps={(milestone) => ({
              tabIndex: 0,
              role: 'button',
              'aria-label': `Open milestone: ${milestone.title}`,
              'data-testid': `project-milestone-panel-row:${milestone.id}`,
              className: 'group',
              onClick: () => onOpenMilestone(milestone.id),
              onKeyDown: (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onOpenMilestone(milestone.id)
                }
              }
            })}
          />
        </div>
      ) : (
        <EmptyState
          icon={Milestone}
          title="No milestones yet"
          description="Add a milestone to track a project outcome and its end date."
          className="min-h-24 px-3 py-5 [&_h2]:text-sm [&_p]:text-xs"
          data-testid="project-milestones-panel-empty"
        />
      )}
    </CollapsibleWorkspacePanelSection>
  )
}
