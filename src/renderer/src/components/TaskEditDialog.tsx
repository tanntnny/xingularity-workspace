import { ReactElement, useRef, useState } from 'react'
import {
  CALENDAR_TASK_TYPE_OPTIONS,
  CalendarTask,
  CalendarTaskType,
  Project,
  TaskPriority,
  TaskStatus,
  TASK_STATUS_OPTIONS
} from '../../../shared/types'
import { NoteShapeIcon } from './NoteShapeIcon'
import { Check, Trash2 } from './ui/icons'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { CalendarTaskTypeBadge } from './ui/calendar-task-type-badge'
import { TaskPriorityBadge } from './ui/task-priority-badge'
import { TaskStatusIcon } from './TaskStatusIcon'
import { TagEditor } from './TagEditor'
import { TASK_STATUS_META, getTaskStatus } from '../lib/taskStatus'
import { normalizeCalendarEndDate } from '../../../shared/calendarTaskDates'
import {
  Dialog,
  DialogActionButton,
  DialogBody,
  DialogCloseAction,
  DialogContent,
  DialogHeader,
  DialogShell,
  DialogShellFooter,
  DialogTitle
} from './ui/dialog'

export interface TaskEditDialogProps {
  task: CalendarTask
  projects?: Project[]
  onClose: () => void
  onSave: (taskId: string, patch: Partial<CalendarTask>) => void | Promise<void>
  onDelete: (taskId: string) => void
  onOpenFullPage: () => void | Promise<void>
}

export function TaskEditDialog({
  task,
  projects = [],
  onClose,
  onSave,
  onDelete,
  onOpenFullPage
}: TaskEditDialogProps): ReactElement {
  const [title, setTitle] = useState(task.title)
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
  const closeHandledRef = useRef(false)
  const selectedProject = projects.find((project) => project.id === projectId)
  const selectedMilestone = selectedProject?.milestones?.find(
    (milestone) => milestone.id === milestoneId
  )

  const buildPatch = (): Partial<CalendarTask> => {
    const patch: Partial<CalendarTask> = {}
    const trimmedTitle = title.trim()
    if (trimmedTitle && trimmedTitle !== task.title) {
      patch.title = trimmedTitle
    }
    if ((task.priority ?? 'low') !== priority) {
      patch.priority = priority
    }
    if ((task.taskType ?? 'assignment') !== taskType) {
      patch.taskType = taskType
    }
    if (getTaskStatus(task.status, task.completed) !== status) {
      patch.status = status
      patch.completed = status === 'completed'
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

  const handleClose = (): void => {
    if (closeHandledRef.current) return
    closeHandledRef.current = true

    const patch = buildPatch()
    if (Object.keys(patch).length > 0) {
      void onSave(task.id, patch)
    }
    onClose()
  }

  const handleOpenFullPage = async (): Promise<void> => {
    if (closeHandledRef.current) return
    closeHandledRef.current = true

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

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) handleClose()
      }}
    >
      <DialogContent
        className="max-h-[min(760px,calc(100vh-2rem))] max-w-lg overflow-hidden"
        data-testid="task-center-dialog"
        showCloseButton={false}
      >
        <DialogShell>
          <DialogHeader className="flex-row items-start justify-between gap-4 space-y-0 text-left">
            <DialogTitle>Edit task</DialogTitle>
            <DialogActionButton
              onClick={() => {
                void handleOpenFullPage()
              }}
              label="Open full page"
              data-testid="task-open-full-page"
            />
          </DialogHeader>
          <DialogBody className="overflow-y-auto pr-1">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor={`task-title-${task.id}`}
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Title
                </label>
                <Input
                  id={`task-title-${task.id}`}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="mt-1"
                  placeholder="Task title"
                  autoFocus
                />
              </div>
              <div>
                <TagEditor
                  value={tags}
                  onChange={setTags}
                  label="Task tags"
                  testId="task-tags-editor"
                />
              </div>
              <div>
                <label
                  htmlFor={`task-project-${task.id}`}
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Project
                </label>
                <Select
                  value={projectId || '__none__'}
                  onValueChange={(value) => {
                    const nextProjectId = value === '__none__' ? '' : value
                    setProjectId(nextProjectId)
                    if (
                      !projects
                        .find((project) => project.id === nextProjectId)
                        ?.milestones?.some((milestone) => milestone.id === milestoneId)
                    ) {
                      setMilestoneId('')
                    }
                  }}
                >
                  <SelectTrigger id={`task-project-${task.id}`} className="mt-1 w-full">
                    <SelectValue placeholder="No project">
                      {selectedProject ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <NoteShapeIcon icon={selectedProject.icon} size="1.25em" />
                          <span className="truncate">{selectedProject.name}</span>
                        </span>
                      ) : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No project</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <span className="flex items-center gap-2">
                          <NoteShapeIcon icon={project.icon} size="1.25em" />
                          <span className="truncate">{project.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label
                  htmlFor={`task-milestone-${task.id}`}
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Milestone
                </label>
                <Select
                  value={milestoneId || '__none__'}
                  onValueChange={(value) => setMilestoneId(value === '__none__' ? '' : value)}
                  disabled={!selectedProject}
                >
                  <SelectTrigger id={`task-milestone-${task.id}`} className="mt-1 w-full">
                    <SelectValue placeholder="No milestone">
                      {selectedMilestone ? (
                        <span className="truncate">{selectedMilestone.title}</span>
                      ) : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No milestone</SelectItem>
                    {selectedProject?.milestones?.map((milestone) => (
                      <SelectItem key={milestone.id} value={milestone.id}>
                        <span className="truncate">{milestone.title}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label
                  htmlFor={`task-status-${task.id}`}
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Status
                </label>
                <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)}>
                  <SelectTrigger id={`task-status-${task.id}`} className="mt-1 w-full">
                    <SelectValue asChild>
                      <span className="inline-flex min-w-0 items-center gap-2 whitespace-nowrap">
                        <TaskStatusIcon status={status} size={18} className="shrink-0" />
                        <span className="truncate">{TASK_STATUS_META[status].label}</span>
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="inline-flex items-center gap-2 whitespace-nowrap">
                          <TaskStatusIcon status={option.value} size={18} className="shrink-0" />
                          <span>{option.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor={`task-type-${task.id}`}
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Type
                  </label>
                  <Select
                    value={taskType}
                    onValueChange={(value) => setTaskType(value as CalendarTaskType)}
                  >
                    <SelectTrigger id={`task-type-${task.id}`} className="mt-1 w-full">
                      <SelectValue asChild>
                        <CalendarTaskTypeBadge taskType={taskType} />
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {CALENDAR_TASK_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <CalendarTaskTypeBadge taskType={option.value} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label
                    htmlFor={`task-priority-${task.id}`}
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Priority
                  </label>
                  <Select
                    value={priority}
                    onValueChange={(value) => setPriority(value as TaskPriority)}
                  >
                    <SelectTrigger id={`task-priority-${task.id}`} className="mt-1 w-full">
                      <SelectValue asChild>
                        <TaskPriorityBadge priority={priority} />
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(['low', 'medium', 'high'] as TaskPriority[]).map((option) => (
                        <SelectItem key={option} value={option}>
                          <TaskPriorityBadge priority={option} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor={`task-start-date-${task.id}`}
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Start date
                  </label>
                  <Input
                    id={`task-start-date-${task.id}`}
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`task-start-time-${task.id}`}
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Start time
                  </label>
                  <Input
                    id={`task-start-time-${task.id}`}
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor={`task-end-date-${task.id}`}
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {date ? 'End date' : 'Due date'}
                  </label>
                  <Input
                    id={`task-end-date-${task.id}`}
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`task-end-time-${task.id}`}
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {date ? 'End time' : 'Due time'}
                  </label>
                  <Input
                    id={`task-end-time-${task.id}`}
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </DialogBody>
          <DialogShellFooter
            className="border-t border-border pt-3"
            closeAction={<DialogCloseAction label="Close task editor" />}
          >
            <DialogActionButton
              onClick={handleDelete}
              title="Delete task"
              aria-label="Delete task"
              icon={<Trash2 />}
            />
            <DialogActionButton
              onClick={handleClose}
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
