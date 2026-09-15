import { ReactElement, useRef, useState } from 'react'
import {
  CalendarTask,
  CalendarTaskType,
  NoteVimKeyMapping,
  Project,
  TaskPriority,
  TaskRecurrenceDraft,
  TaskStatus
} from '../../../shared/types'
import { Editor, type NoteEditorHandle } from './Editor'
import { TagEditor } from './TagEditor'
import { getTaskStatus } from '../lib/taskStatus'
import type { NoteEditorSnapshot } from '../lib/noteEditorSession'
import {
  CALENDAR_TASK_TYPE_CHIP_OPTIONS,
  getMilestoneChipOptions,
  NO_MILESTONE_VALUE,
  NO_PROJECT_VALUE,
  TASK_PRIORITY_CHIP_ITEMS,
  TASK_STATUS_CHIP_OPTIONS,
  getProjectChipOptions
} from '../lib/statusChipMeta'
import { normalizeCalendarEndDate } from '../../../shared/calendarTaskDates'
import { isTaskStatusDone } from '../../../shared/taskStatus'
import { ChipGroup } from './ui/chip-group'
import { CalendarDateEditPopover } from './ui/calendar-date-edit-popover'
import { CalendarTimeEditPopover } from './ui/calendar-time-edit-popover'
import { StatusChipSelect } from './ui/status-chip-select'
import { WorkspaceCenterEditDialog } from './WorkspaceCenterEditDialog'
import { Copy } from './ui/icons'
import { WorkspaceIconButton } from './ui/document-workspace'
import { TaskRecurrenceEditor } from './TaskRecurrenceEditor'

const TASK_DIALOG_STATUS_CHIP_CLASS_NAME =
  'max-w-full justify-start rounded-[var(--radius-button-pill)]'
const TASK_DIALOG_GROUPED_STATUS_CHIP_CLASS_NAME =
  'min-w-0 max-w-full justify-start rounded-none border-0 bg-transparent hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0'

export interface TaskEditDialogProps {
  task: CalendarTask
  isNewTask?: boolean
  projects?: Project[]
  tasks: CalendarTask[]
  availableTags?: readonly string[]
  onClose: () => void
  onSave: (taskId: string, patch: Partial<CalendarTask>) => void | Promise<void>
  onDelete: (taskId: string) => void
  onDuplicate?: (taskId: string) => void | Promise<void>
  onConfigureRecurrence?: (
    taskId: string,
    recurrence: TaskRecurrenceDraft | null
  ) => void | Promise<void>
  onOpenFullPage: () => void | Promise<void>
  vimModeEnabled: boolean
  vimKeyMappings: NoteVimKeyMapping[]
}

export function TaskEditDialog({
  task,
  isNewTask = false,
  projects = [],
  tasks,
  availableTags = [],
  onClose,
  onSave,
  onDelete,
  onDuplicate,
  onConfigureRecurrence,
  onOpenFullPage,
  vimModeEnabled,
  vimKeyMappings
}: TaskEditDialogProps): ReactElement {
  const [titleDraft, setTitleDraft] = useState(() => (isNewTask ? '' : task.title))
  const [priority, setPriority] = useState<TaskPriority>(task.priority ?? 'low')
  const [taskType, setTaskType] = useState<CalendarTaskType>(task.taskType ?? 'assignment')
  const [status, setStatus] = useState<TaskStatus>(getTaskStatus(task.status, task.completed))
  const [projectId, setProjectId] = useState(task.projectId ?? '')
  const [milestoneId, setMilestoneId] = useState(task.milestoneId ?? '')
  const [tags, setTags] = useState(task.tags ?? [])
  const [date, setDate] = useState(task.date ?? '')
  const [endDate, setEndDate] = useState(task.endDate ?? '')
  const [time, setTime] = useState(task.time ?? '')
  const [endTime, setEndTime] = useState(task.endTime ?? '')
  const editorRef = useRef<NoteEditorHandle | null>(null)
  const titleInputRef = useRef<HTMLInputElement | null>(null)
  const descriptionRef = useRef(task.description ?? '')
  const closeHandledRef = useRef(false)
  const duplicateInFlightRef = useRef(false)
  const selectedProject = projects.find((project) => project.id === projectId)
  const dialogTitle = titleDraft.trim() || (isNewTask ? 'New task' : task.title)
  const milestoneOptions = getMilestoneChipOptions(selectedProject, tasks)

  const buildPatch = (): Partial<CalendarTask> => {
    const patch: Partial<CalendarTask> = {}
    const normalizedTitle = titleDraft.trim()
    if (normalizedTitle && (isNewTask || normalizedTitle !== task.title)) {
      patch.title = normalizedTitle
    }
    if (descriptionRef.current !== (task.description ?? '')) {
      patch.description = descriptionRef.current || undefined
    }
    if ((task.priority ?? 'low') !== priority) {
      patch.priority = priority
    }
    if ((task.taskType ?? 'assignment') !== taskType) {
      patch.taskType = taskType
    }
    if (getTaskStatus(task.status, task.completed) !== status) {
      patch.status = status
      patch.completed = isTaskStatusDone(status)
    }

    const normalizedProjectId = projectId.trim() || undefined
    if ((task.projectId ?? undefined) !== normalizedProjectId) {
      patch.projectId = normalizedProjectId
    }

    const normalizedMilestoneId = milestoneId.trim() || undefined
    if ((task.milestoneId ?? undefined) !== normalizedMilestoneId) {
      patch.milestoneId = normalizedMilestoneId
    }

    const initialTags = task.tags ?? []
    if (
      tags.length !== initialTags.length ||
      tags.some((tag, index) => tag !== initialTags[index])
    ) {
      patch.tags = tags
    }

    const normalizedDate = date.trim() || undefined
    const normalizedEndDate = endDate.trim() || undefined
    const normalizedEndDateValue = normalizeCalendarEndDate(normalizedDate, normalizedEndDate)
    const normalizedTime = time.trim() || undefined
    const normalizedEndTime = endTime.trim() || undefined

    if (
      normalizedDate !== (task.date ?? undefined) ||
      normalizedEndDateValue !== (task.endDate ?? undefined) ||
      normalizedTime !== (task.time ?? undefined) ||
      normalizedEndTime !== (task.endTime ?? undefined)
    ) {
      patch.date = normalizedDate
      patch.endDate = normalizedEndDateValue
      patch.time = normalizedTime
      patch.endTime = normalizedEndTime
    }

    return patch
  }

  const handleDescriptionSnapshot = (snapshot: NoteEditorSnapshot): void => {
    descriptionRef.current = snapshot.content
  }

  const flushDescription = async (): Promise<void> => {
    const snapshot = await editorRef.current?.flushPendingChanges()
    if (snapshot) {
      descriptionRef.current = snapshot.content
    }
  }

  const handleClose = async (): Promise<void> => {
    if (closeHandledRef.current) return
    closeHandledRef.current = true

    if (isNewTask && !titleDraft.trim()) {
      onDelete(task.id)
      onClose()
      return
    }

    await flushDescription()
    const patch = buildPatch()
    if (Object.keys(patch).length > 0) {
      await onSave(task.id, patch)
    }
    onClose()
  }

  const handleOpenFullPage = async (): Promise<void> => {
    if (closeHandledRef.current) return

    if (isNewTask && !titleDraft.trim()) {
      titleInputRef.current?.focus()
      return
    }

    closeHandledRef.current = true

    await flushDescription()
    const patch = buildPatch()
    if (Object.keys(patch).length > 0) {
      await onSave(task.id, patch)
    }
    onClose()
    await onOpenFullPage()
  }

  const handleDelete = (): void => {
    if (closeHandledRef.current) return
    closeHandledRef.current = true
    onDelete(task.id)
    onClose()
  }

  const handleDuplicate = async (): Promise<void> => {
    if (isNewTask || !onDuplicate || closeHandledRef.current || duplicateInFlightRef.current) {
      return
    }

    duplicateInFlightRef.current = true
    try {
      await flushDescription()
      const patch = buildPatch()
      if (Object.keys(patch).length > 0) {
        await onSave(task.id, patch)
      }
      await onDuplicate(task.id)
    } finally {
      duplicateInFlightRef.current = false
    }
  }

  return (
    <WorkspaceCenterEditDialog
      context="Edit Task"
      title={<span data-testid="task-dialog-title">{dialogTitle}</span>}
      titleValue={titleDraft}
      titleInputId={`task-title-${task.id}`}
      titleInputLabel="Task name"
      titleInputPlaceholder="Task name"
      titleInputTestId="task-dialog-title-input"
      titleInputRef={titleInputRef}
      isNew={isNewTask}
      dialogTestId="task-center-dialog"
      headerTestId="task-dialog-header"
      closeTestId="task-dialog-close"
      openFullPageTestId="task-open-full-page"
      onTitleChange={setTitleDraft}
      onClose={handleClose}
      onOpenFullPage={handleOpenFullPage}
      headerLeadingAction={
        onConfigureRecurrence ? (
          <TaskRecurrenceEditor
            task={task}
            iconOnly
            onChange={(recurrence) => onConfigureRecurrence(task.id, recurrence)}
          />
        ) : undefined
      }
      duplicateAction={
        !isNewTask && onDuplicate ? (
          <WorkspaceIconButton
            onClick={() => void handleDuplicate()}
            aria-label="Duplicate task"
            title="Duplicate task"
            icon={<Copy />}
            borderless
            data-testid="duplicate-task-dialog-button"
          />
        ) : undefined
      }
      onDelete={handleDelete}
      onSave={handleClose}
      closeLabel="Close task editor"
      deleteLabel="Delete task"
      saveLabel="Save changes"
    >
      <div className="space-y-5">
        <div data-testid="task-description-editor" className="note-editor-surface min-w-0">
          <Editor
            ref={editorRef}
            key={task.id}
            initialContent={task.description ?? ''}
            density="compact"
            onDirty={() => undefined}
            onSnapshotChange={handleDescriptionSnapshot}
            onDropFile={async () => null}
            onPasteImage={async () => null}
            notes={[]}
            vimModeEnabled={vimModeEnabled}
            vimKeyMappings={vimKeyMappings}
          />
        </div>
        <div
          data-testid="task-dialog-properties"
          className="flex min-w-0 flex-wrap items-center gap-2"
        >
          <StatusChipSelect
            className={TASK_DIALOG_STATUS_CHIP_CLASS_NAME}
            data-testid="task-dialog-status-chip"
            id={`task-status-${task.id}`}
            label={`Task status for ${dialogTitle}`}
            value={status}
            options={TASK_STATUS_CHIP_OPTIONS}
            surface="pill"
            wrapLabel
            onValueChange={(value) => setStatus(value as TaskStatus)}
          />
          <StatusChipSelect
            className={TASK_DIALOG_STATUS_CHIP_CLASS_NAME}
            data-testid="task-dialog-task-type-chip"
            id={`task-type-${task.id}`}
            label={`Task type for ${dialogTitle}`}
            value={taskType}
            options={CALENDAR_TASK_TYPE_CHIP_OPTIONS}
            surface="pill"
            wrapLabel
            onValueChange={(value) => setTaskType(value as CalendarTaskType)}
          />
          <StatusChipSelect
            className={TASK_DIALOG_STATUS_CHIP_CLASS_NAME}
            data-testid="task-dialog-priority-chip"
            id={`task-priority-${task.id}`}
            label={`Task priority for ${dialogTitle}`}
            value={priority}
            options={(['low', 'medium', 'high'] as TaskPriority[]).map((option) => ({
              value: option,
              ...TASK_PRIORITY_CHIP_ITEMS[option]
            }))}
            surface="pill"
            wrapLabel
            onValueChange={(value) => setPriority(value as TaskPriority)}
          />
          <ChipGroup
            aria-label={`Task start date and time for ${dialogTitle}`}
            data-testid="task-dialog-start-datetime-group"
          >
            <CalendarDateEditPopover
              id={`task-start-date-${task.id}`}
              label="Task start date"
              value={date || undefined}
              onValueChange={(value) => setDate(value ?? '')}
              placeholder="Start date"
              variant="ghost"
              aria-label="Task start date"
              className="h-7 w-fit rounded-none px-2"
            />
            <CalendarTimeEditPopover
              id={`task-start-time-${task.id}`}
              label="Task start time"
              value={time || undefined}
              onValueChange={(value) => setTime(value ?? '')}
              placeholder="Start time"
              variant="ghost"
              aria-label="Task start time"
              className="h-7 w-fit rounded-none px-2"
            />
          </ChipGroup>
          <span aria-hidden="true" className="shrink-0 text-muted-foreground">
            →
          </span>
          <ChipGroup
            aria-label={`Task end date and time for ${dialogTitle}`}
            data-testid="task-dialog-end-datetime-group"
          >
            <CalendarDateEditPopover
              id={`task-end-date-${task.id}`}
              label={date ? 'Task end date' : 'Task due date'}
              value={endDate || undefined}
              onValueChange={(value) => setEndDate(value ?? '')}
              placeholder="End date"
              variant="ghost"
              aria-label={date ? 'Task end date' : 'Task due date'}
              className="h-7 w-fit rounded-none px-2"
            />
            <CalendarTimeEditPopover
              id={`task-end-time-${task.id}`}
              label={date ? 'Task end time' : 'Task due time'}
              value={endTime || undefined}
              onValueChange={(value) => setEndTime(value ?? '')}
              placeholder="End time"
              variant="ghost"
              aria-label={date ? 'Task end time' : 'Task due time'}
              className="h-7 w-fit rounded-none px-2"
            />
          </ChipGroup>
          <ChipGroup
            aria-label={`Task project and milestone for ${dialogTitle}`}
            data-testid="task-dialog-project-milestone-group"
          >
            <StatusChipSelect
              className={TASK_DIALOG_GROUPED_STATUS_CHIP_CLASS_NAME}
              data-testid="task-dialog-project-chip"
              id={`task-project-${task.id}`}
              label={`Task project for ${dialogTitle}`}
              value={projectId || NO_PROJECT_VALUE}
              options={getProjectChipOptions(projects)}
              surface="none"
              wrapLabel
              onValueChange={(value) => {
                const nextProjectId = value === NO_PROJECT_VALUE ? '' : value
                setProjectId(nextProjectId)
                if (
                  !projects
                    .find((project) => project.id === nextProjectId)
                    ?.milestones?.some((milestone) => milestone.id === milestoneId)
                ) {
                  setMilestoneId('')
                }
              }}
            />
            <StatusChipSelect
              className={TASK_DIALOG_GROUPED_STATUS_CHIP_CLASS_NAME}
              data-testid="task-dialog-milestone-chip"
              id={`task-milestone-${task.id}`}
              label={`Task milestone for ${dialogTitle}`}
              value={milestoneId || NO_MILESTONE_VALUE}
              options={milestoneOptions}
              surface="none"
              wrapLabel
              onValueChange={(value) => setMilestoneId(value === NO_MILESTONE_VALUE ? '' : value)}
              disabled={!selectedProject}
            />
          </ChipGroup>
          <TagEditor
            value={tags}
            availableTags={availableTags}
            onChange={setTags}
            label="Task tags"
            testId="task-tags-editor"
            surface="pill"
            className="min-w-0 max-w-full"
          />
        </div>
      </div>
    </WorkspaceCenterEditDialog>
  )
}
