import { useEffect, useRef, useState, type ReactElement } from 'react'
import type {
  CalendarTask,
  Project,
  ProjectMilestone,
  UpdateProjectMilestoneInput
} from '../../../shared/types'
import { CalendarDateEditPopover } from '../components/ui/calendar-date-edit-popover'
import { ChipGroup } from '../components/ui/chip-group'
import { WorkspaceIconButton } from '../components/ui/document-workspace'
import { EmptyState } from '../components/ui/empty-state'
import { Milestone, Plus, X } from '../components/ui/icons'
import { ProgressRing } from '../components/ui/progress-ring'
import { Button } from '../components/ui/button'
import { MilestoneCompletenessIcon } from '../components/MilestoneCompletenessIcon'
import { WorkspaceCenterEditDialog } from '../components/WorkspaceCenterEditDialog'
import { TaskDetailRow } from './ProjectsWorkspacePage'
import {
  getProjectMilestoneProgress,
  getProjectMilestoneStatus,
  getProjectMilestoneTasks
} from '../lib/projectMilestones'
import type { TaskOpenOptions } from '../lib/taskOpenOptions'

type MilestonePatch = Pick<UpdateProjectMilestoneInput, 'title' | 'endDate'>

interface MilestonePageContentProps {
  project: Project
  milestone: ProjectMilestone
  tasks: CalendarTask[]
  endDate: string
  dialogTitle: string
  onEndDateChange: (value: string | undefined) => void
  onCreateTask: () => void
  isCreatingTask: boolean
  onOpenTask: (taskId: string, options?: TaskOpenOptions) => void
  onUpdateTask: (taskId: string, patch: Partial<CalendarTask>) => void
  onDeleteTask: (taskId: string) => void
}

export function MilestonePageContent({
  project,
  milestone,
  tasks,
  endDate,
  dialogTitle,
  onEndDateChange,
  onCreateTask,
  isCreatingTask,
  onOpenTask,
  onUpdateTask,
  onDeleteTask
}: MilestonePageContentProps): ReactElement {
  const milestoneTasks = getProjectMilestoneTasks(tasks, project.id, milestone.id)
  const progress = getProjectMilestoneProgress(milestoneTasks)
  const completionPercent =
    progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0
  const status = getProjectMilestoneStatus(milestone, project.milestones ?? [], tasks, project.id)

  return (
    <div className="space-y-5" data-testid="milestone-page-content">
      <div
        data-testid="milestone-dialog-context"
        className="flex min-w-0 items-center gap-2 rounded-[var(--radius-button)] border border-border bg-surface-subtle px-3 py-2"
      >
        <MilestoneCompletenessIcon status={status} size={18} />
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {progress.completed}/{progress.total} tasks complete
        </span>
        <span
          className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
          aria-label={`Milestone progress: ${completionPercent}%`}
        >
          <ProgressRing
            value={completionPercent}
            size={18}
            data-testid="milestone-dialog-progress-ring"
          />
          <span aria-hidden="true">{completionPercent}%</span>
        </span>
      </div>

      <div
        data-testid="milestone-dialog-properties"
        className="flex min-w-0 flex-wrap items-center gap-2"
      >
        <ChipGroup
          aria-label={`Milestone end date for ${dialogTitle}`}
          data-testid="milestone-dialog-end-date-group"
        >
          <CalendarDateEditPopover
            id={`milestone-end-date-${milestone.id}`}
            label="Milestone end date"
            value={endDate || undefined}
            onValueChange={onEndDateChange}
            placeholder="End date"
            variant="ghost"
            aria-label="Milestone end date"
            className="h-7 w-fit rounded-none px-2"
            data-testid="milestone-dialog-end-date"
          />
          {endDate ? (
            <WorkspaceIconButton
              aria-label="Clear milestone end date"
              title="Clear milestone end date"
              icon={<X />}
              borderless
              className="size-7"
              onClick={() => onEndDateChange(undefined)}
              data-testid="milestone-dialog-end-date-clear"
            />
          ) : null}
        </ChipGroup>
        <span
          className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
          title={project.name}
        >
          {project.name} · Milestone
        </span>
      </div>

      <section aria-labelledby="milestone-page-tasks-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="milestone-page-tasks-heading" className="text-sm font-semibold">
              Tasks
            </h2>
            <p className="text-xs text-muted-foreground">Tasks assigned to this milestone.</p>
          </div>
          <Button
            type="button"
            variant="muted"
            size="sm"
            onClick={onCreateTask}
            disabled={isCreatingTask}
            data-testid="milestone-page-add-task"
          >
            <Plus aria-hidden="true" />
            {isCreatingTask ? 'Adding…' : 'Add task'}
          </Button>
        </div>
        {milestoneTasks.length > 0 ? (
          <ul className="list-none" data-testid="milestone-page-task-list">
            {milestoneTasks.map((task) => (
              <TaskDetailRow
                key={task.id}
                task={task}
                isParentDropActive={false}
                onUpdateTask={onUpdateTask}
                onDeleteTask={onDeleteTask}
                onOpenTask={onOpenTask}
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Milestone}
            title="No tasks in this milestone"
            description="Add a task to start making progress on this milestone."
            className="min-h-40 rounded-[var(--radius-button)] border border-dashed border-border px-4 py-8"
            data-testid="milestone-page-empty"
          />
        )}
      </section>
    </div>
  )
}

export interface MilestonePageProps {
  project: Project
  milestone: ProjectMilestone
  tasks: CalendarTask[]
  isNewMilestone?: boolean
  onClose: () => void
  onUpdateMilestone: (milestoneId: string, patch: MilestonePatch) => void | Promise<void>
  onCreateTask: (milestoneId: string) => Promise<CalendarTask>
  onOpenTask: (taskId: string, options?: TaskOpenOptions) => void
  onUpdateTask: (taskId: string, patch: Partial<CalendarTask>) => void
  onDeleteTask: (taskId: string) => void
  onDeleteMilestone: () => boolean | void
}

export function MilestonePage({
  project,
  milestone,
  tasks,
  isNewMilestone = false,
  onClose,
  onUpdateMilestone,
  onCreateTask,
  onOpenTask,
  onUpdateTask,
  onDeleteTask,
  onDeleteMilestone
}: MilestonePageProps): ReactElement {
  const [titleDraft, setTitleDraft] = useState(() => (isNewMilestone ? '' : milestone.title))
  const [endDate, setEndDate] = useState(milestone.endDate ?? '')
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const titleInputRef = useRef<HTMLInputElement | null>(null)
  const closeHandledRef = useRef(false)
  const dialogTitle = titleDraft.trim() || (isNewMilestone ? 'New milestone' : milestone.title)

  useEffect(() => {
    setTitleDraft(isNewMilestone ? '' : milestone.title)
    setEndDate(milestone.endDate ?? '')
    closeHandledRef.current = false
  }, [isNewMilestone, milestone.endDate, milestone.id, milestone.title])

  const buildPatch = (): MilestonePatch => {
    const normalizedTitle = titleDraft.trim() || milestone.title
    const patch: MilestonePatch = { title: normalizedTitle }
    const normalizedEndDate = endDate.trim() || undefined
    if (normalizedEndDate !== (milestone.endDate ?? undefined)) {
      patch.endDate = normalizedEndDate ?? null
    }
    return patch
  }

  const handleClose = async (): Promise<void> => {
    if (closeHandledRef.current) return
    closeHandledRef.current = true

    if (isNewMilestone && !titleDraft.trim()) {
      const deleted = onDeleteMilestone()
      if (deleted === false) {
        closeHandledRef.current = false
        return
      }
      onClose()
      return
    }

    try {
      await onUpdateMilestone(milestone.id, buildPatch())
    } catch {
      closeHandledRef.current = false
      return
    }
    onClose()
  }

  const handleDelete = (): void => {
    if (closeHandledRef.current) return
    const deleted = onDeleteMilestone()
    if (deleted === false) return
    closeHandledRef.current = true
    onClose()
  }

  const handleCreateTask = async (): Promise<void> => {
    if (isCreatingTask) return
    setIsCreatingTask(true)
    try {
      const task = await onCreateTask(milestone.id)
      onOpenTask(task.id, { isNewTask: true })
    } catch {
      // The parent reports persistence errors.
    } finally {
      setIsCreatingTask(false)
    }
  }

  return (
    <WorkspaceCenterEditDialog
      context="Edit Milestone"
      title={<span data-testid="milestone-dialog-title">{dialogTitle}</span>}
      titleValue={titleDraft}
      titleInputId={`milestone-title-${milestone.id}`}
      titleInputLabel="Milestone name"
      titleInputPlaceholder="Milestone name"
      titleInputTestId="milestone-dialog-title-input"
      titleInputRef={titleInputRef}
      isNew={isNewMilestone}
      dialogTestId="milestone-center-dialog"
      headerTestId="milestone-dialog-header"
      closeTestId="milestone-dialog-close"
      onTitleChange={setTitleDraft}
      onClose={handleClose}
      onDelete={handleDelete}
      onSave={handleClose}
      closeLabel="Close milestone editor"
      deleteLabel="Delete milestone"
      saveLabel="Save changes"
    >
      <MilestonePageContent
        project={project}
        milestone={milestone}
        tasks={tasks}
        endDate={endDate}
        dialogTitle={dialogTitle}
        onEndDateChange={(value) => setEndDate(value ?? '')}
        onCreateTask={() => void handleCreateTask()}
        isCreatingTask={isCreatingTask}
        onOpenTask={onOpenTask}
        onUpdateTask={onUpdateTask}
        onDeleteTask={onDeleteTask}
      />
    </WorkspaceCenterEditDialog>
  )
}
