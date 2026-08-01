import { ReactElement } from 'react'
import { ArrowUpRight, Check, Milestone } from './ui/icons'
import { ProjectIconStyle, ProjectMilestone } from '../../../shared/types'
import { NoteShapeIcon } from './NoteShapeIcon'
import { FloatingHoverCard } from './ui/floating-hover-card'
import {
  Dialog,
  DialogActionButton,
  DialogCloseAction,
  DialogContent,
  DialogBody,
  DialogDescription,
  DialogHeader,
  DialogShell,
  DialogShellFooter,
  DialogTitle
} from './ui/dialog'

export interface CalendarMilestoneDetails {
  title: string
  projectId: string
  projectName: string
  projectIcon?: ProjectIconStyle
  milestoneId: string
  milestoneDescription?: string
  milestoneDueDate?: string
  milestoneStatus?: ProjectMilestone['status']
  milestoneCompletedSubtaskCount?: number
  milestoneSubtaskCount?: number
  milestoneProgressPercent?: number
  completed?: boolean
}

interface CalendarMilestoneCardProps {
  milestone: CalendarMilestoneDetails
}

interface CalendarMilestoneDialogProps {
  milestone: CalendarMilestoneDetails
  onClose: () => void
  onOpenMilestone?: (projectId: string, milestoneId: string) => void
}

interface CalendarMilestoneHoverCardProps {
  milestone: CalendarMilestoneDetails
  x: number
  y: number
}

export function CalendarMilestoneCard({ milestone }: CalendarMilestoneCardProps): ReactElement {
  const progress = formatMilestoneProgressSummary(milestone)

  return (
    <div className="flex min-w-0 flex-col gap-1" data-testid="calendar-milestone-card">
      <div className="flex items-center gap-2" data-testid="calendar-milestone-progress">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${clampProgress(milestone.milestoneProgressPercent)}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-medium text-muted-foreground">{progress}</span>
      </div>
      <div className="truncate text-xs font-semibold leading-tight text-foreground">
        {milestone.title}
      </div>
      <div
        className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
        data-testid="calendar-milestone-project"
      >
        {milestone.projectIcon ? (
          <NoteShapeIcon icon={milestone.projectIcon} size={14} className="shrink-0" />
        ) : null}
        <span className="truncate">{milestone.projectName}</span>
      </div>
    </div>
  )
}

export function CalendarMilestoneHoverCard({
  milestone,
  x,
  y
}: CalendarMilestoneHoverCardProps): ReactElement {
  const statusLabel = formatMilestoneStatusLabel(milestone.milestoneStatus, milestone.completed)
  const progressSummary = formatMilestoneProgressSummary(milestone)
  const progressDetail = formatMilestoneProgressDetail(milestone)

  return (
    <FloatingHoverCard x={x} y={y} className="w-80">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 text-sm font-semibold text-foreground">{milestone.title}</div>
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            {milestone.projectIcon ? (
              <NoteShapeIcon icon={milestone.projectIcon} size={16} className="shrink-0" />
            ) : null}
            <span className="truncate">{milestone.projectName}</span>
          </div>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{statusLabel}</span>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{progressSummary}</span>
          <span>{progressDetail}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${clampProgress(milestone.milestoneProgressPercent)}%` }}
          />
        </div>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">
        Due: {milestone.milestoneDueDate?.trim() || 'No due date'}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {milestone.milestoneDescription?.trim() || 'No milestone description.'}
      </div>
    </FloatingHoverCard>
  )
}

export function CalendarMilestoneDialog({
  milestone,
  onClose,
  onOpenMilestone
}: CalendarMilestoneDialogProps): ReactElement {
  const statusLabel = formatMilestoneStatusLabel(milestone.milestoneStatus, milestone.completed)
  const statusClassName = getMilestoneStatusClassName(
    milestone.milestoneStatus,
    milestone.completed
  )
  const progressSummary = formatMilestoneProgressSummary(milestone)
  const progressDetail = formatMilestoneProgressDetail(milestone)

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent
        className="max-w-lg"
        data-testid="calendar-milestone-dialog"
        showCloseButton={false}
      >
        <DialogShell>
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1 rounded-md border border-ring bg-accent px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                <Milestone size={12} />
                Milestone
              </span>
              <span
                className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${statusClassName}`}
              >
                {statusLabel}
              </span>
            </div>
            <DialogTitle className="pt-2">{milestone.title}</DialogTitle>
            <DialogDescription>
              Review milestone details from the calendar without editing them here.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-4">
              <div className="bg-muted rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  {milestone.projectIcon ? (
                    <NoteShapeIcon icon={milestone.projectIcon} size={24} className="shrink-0" />
                  ) : null}
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Project
                    </div>
                    <div className="truncate text-sm font-medium text-foreground">
                      {milestone.projectName}
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Due date
                    </div>
                    <div className="mt-1 text-sm text-foreground">
                      {milestone.milestoneDueDate?.trim() || 'No due date'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Status
                    </div>
                    <div className="mt-1 text-sm text-foreground">{statusLabel}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{progressSummary}</span>
                    <span>{progressDetail}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${clampProgress(milestone.milestoneProgressPercent)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Description
                </div>
                <div className="bg-muted mt-1 rounded-lg border p-4 text-sm leading-6 text-foreground">
                  {milestone.milestoneDescription?.trim() || 'No milestone description.'}
                </div>
              </div>
            </div>
          </DialogBody>

          <DialogShellFooter closeAction={<DialogCloseAction label="Close milestone details" />}>
            <DialogActionButton
              onClick={() => {
                onOpenMilestone?.(milestone.projectId, milestone.milestoneId)
                onClose()
              }}
              title="Open in Projects"
              aria-label="Open in Projects"
              icon={<ArrowUpRight />}
            />
            <DialogActionButton
              onClick={onClose}
              title="Done"
              aria-label="Done"
              icon={<Check />}
              tone="primary"
            />
          </DialogShellFooter>
        </DialogShell>
      </DialogContent>
    </Dialog>
  )
}

function formatMilestoneProgressSummary(milestone: CalendarMilestoneDetails): string {
  return `${clampProgress(milestone.milestoneProgressPercent)}% complete`
}

function formatMilestoneProgressDetail(milestone: CalendarMilestoneDetails): string {
  const completedCount = milestone.milestoneCompletedSubtaskCount ?? 0
  const totalCount = milestone.milestoneSubtaskCount ?? 0

  if (totalCount > 0) {
    return `${completedCount}/${totalCount} subtasks`
  }

  return milestone.completed ? 'Complete' : 'No subtasks'
}

function clampProgress(progress?: number): number {
  return Math.max(0, Math.min(100, progress ?? 0))
}

function formatMilestoneStatusLabel(
  status?: ProjectMilestone['status'],
  completed?: boolean
): string {
  if (completed || status === 'completed') {
    return 'Completed'
  }
  if (status === 'in-progress') {
    return 'In progress'
  }
  if (status === 'blocked') {
    return 'Blocked'
  }
  return 'Pending'
}

function getMilestoneStatusClassName(
  status?: ProjectMilestone['status'],
  completed?: boolean
): string {
  if (completed || status === 'completed') {
    return 'border border-ring bg-accent text-primary'
  }
  if (status === 'blocked') {
    return 'border border-destructive/40 bg-destructive/10 text-destructive'
  }
  if (status === 'in-progress') {
    return 'border border-border bg-accent text-muted-foreground'
  }
  return 'border border-border bg-card text-foreground'
}
