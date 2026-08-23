import { useMemo, useState, type ReactElement } from 'react'
import {
  CalendarTask,
  CalendarTaskType,
  Project,
  TaskPriority,
  TaskReminder,
  TaskStatus
} from '../../../shared/types'
import { normalizeCalendarEndDate } from '../../../shared/calendarTaskDates'
import { isTaskStatusDone } from '../../../shared/taskStatus'
import { TagEditor } from './TagEditor'
import { CalendarDateEditPopover } from './ui/calendar-date-edit-popover'
import { CalendarTimeEditPopover } from './ui/calendar-time-edit-popover'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { SelectionPopover } from './ui/selection-popover'
import { StatusChipSelect } from './ui/status-chip-select'
import {
  Dialog,
  DialogActionButton,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogShell,
  DialogShellFooter,
  DialogShellHeader
} from './ui/dialog'
import { CollapsibleWorkspacePanelSection } from './ui/workspace-panel-section'
import { WorkspacePanelStack, WorkspaceIconButton } from './ui/document-workspace'
import { WorkspacePropertyRow } from './ui/workspace-property-row'
import { Bell, BellRing, Check, X } from './ui/icons'
import { getTaskStatus } from '../lib/taskStatus'
import {
  CALENDAR_TASK_TYPE_CHIP_OPTIONS,
  NO_PROJECT_VALUE,
  TASK_PRIORITY_CHIP_ITEMS,
  TASK_STATUS_CHIP_OPTIONS,
  getProjectChipOptions
} from '../lib/statusChipMeta'

const NONE_VALUE = '__none__'

const TASK_PRIORITY_OPTIONS: readonly TaskPriority[] = ['low', 'medium', 'high']

export interface TaskPropertiesPanelProps {
  task: CalendarTask
  projects: Project[]
  availableTags?: readonly string[]
  onUpdateTask: (taskId: string, patch: Partial<CalendarTask>) => void | Promise<void>
}

export function TaskPropertiesPanel({
  task,
  projects,
  availableTags = [],
  onUpdateTask
}: TaskPropertiesPanelProps): ReactElement {
  const selectedProject = projects.find((project) => project.id === task.projectId)
  const selectedMilestone = selectedProject?.milestones?.find(
    (milestone) => milestone.id === task.milestoneId
  )
  const status = getTaskStatus(task.status, task.completed)
  const update = (patch: Partial<CalendarTask>): void => {
    void onUpdateTask(task.id, patch)
  }

  const handleProjectChange = (value: string): void => {
    const projectId = value === NO_PROJECT_VALUE ? undefined : value
    const nextProject = projects.find((project) => project.id === projectId)
    const milestoneId = nextProject?.milestones?.some(
      (milestone) => milestone.id === task.milestoneId
    )
      ? task.milestoneId
      : undefined
    update({ projectId, milestoneId })
  }

  const handleStartDateChange = (value: string | undefined): void => {
    const date = value
    update({ date, endDate: normalizeCalendarEndDate(date, task.endDate) })
  }

  const handleEndDateChange = (value: string | undefined): void => {
    const endDate = normalizeCalendarEndDate(task.date, value)
    update({ endDate })
  }

  return (
    <WorkspacePanelStack data-testid="task-properties-panel" className="h-full">
      <CollapsibleWorkspacePanelSection heading="Task properties" data-testid="task-properties">
        <div data-testid="task-property-rows">
          <WorkspacePropertyRow label="Status" testId="task-property-status">
            <StatusChipSelect
              label={`Status for ${task.title}`}
              value={status}
              options={TASK_STATUS_CHIP_OPTIONS}
              onValueChange={(value) => {
                const nextStatus = value as TaskStatus
                update({ status: nextStatus, completed: isTaskStatusDone(nextStatus) })
              }}
            />
          </WorkspacePropertyRow>
          <WorkspacePropertyRow label="Type" testId="task-property-type">
            <TaskTypeSelect
              taskId={task.id}
              value={task.taskType ?? 'assignment'}
              onChange={(value) => update({ taskType: value })}
            />
          </WorkspacePropertyRow>
          <WorkspacePropertyRow label="Priority" testId="task-property-priority">
            <TaskPrioritySelect
              taskId={task.id}
              value={task.priority ?? 'low'}
              onChange={(value) => update({ priority: value })}
            />
          </WorkspacePropertyRow>
          <WorkspacePropertyRow label="Project" testId="task-property-project">
            <StatusChipSelect
              className="w-48 justify-start"
              label={`Task project for ${task.title}`}
              value={task.projectId ?? NO_PROJECT_VALUE}
              options={getProjectChipOptions(projects)}
              onValueChange={handleProjectChange}
            />
          </WorkspacePropertyRow>
          <WorkspacePropertyRow label="Milestone" testId="task-property-milestone">
            <SelectionPopover
              selectionMode="single"
              value={task.milestoneId ?? NONE_VALUE}
              options={[
                { value: NONE_VALUE, label: 'No milestone' },
                ...(selectedProject?.milestones ?? []).map((milestone) => ({
                  value: milestone.id,
                  label: milestone.title,
                  searchText: milestone.title
                }))
              ]}
              onValueChange={(value) =>
                update({ milestoneId: value === NONE_VALUE ? undefined : value })
              }
              label="Task milestone"
              searchPlaceholder="Search milestones"
              placeholder={selectedMilestone?.title ?? 'No milestone'}
              triggerProps={{
                className: 'h-7 w-48 text-xs',
                'aria-label': 'Task milestone',
                disabled: !selectedProject
              }}
            />
          </WorkspacePropertyRow>
          <WorkspacePropertyRow label="Start date" testId="task-property-start-date">
            <TaskDateValue
              value={task.date}
              placeholder="Set start date"
              ariaLabel="Task start date"
              onChange={handleStartDateChange}
              onClear={() => handleStartDateChange(undefined)}
            />
          </WorkspacePropertyRow>
          <WorkspacePropertyRow
            label={task.date ? 'End date' : 'Due date'}
            testId="task-property-end-date"
          >
            <TaskDateValue
              value={task.endDate}
              placeholder={task.date ? 'Set end date' : 'Set due date'}
              ariaLabel={task.date ? 'Task end date' : 'Task due date'}
              onChange={handleEndDateChange}
              onClear={() => handleEndDateChange(undefined)}
            />
          </WorkspacePropertyRow>
          <WorkspacePropertyRow label="Start time" testId="task-property-start-time">
            <TaskTimeValue
              value={task.time}
              ariaLabel="Task start time"
              onChange={(value) => update({ time: value })}
            />
          </WorkspacePropertyRow>
          <WorkspacePropertyRow
            label={task.date ? 'End time' : 'Due time'}
            testId="task-property-end-time"
          >
            <TaskTimeValue
              value={task.endTime}
              ariaLabel={task.date ? 'Task end time' : 'Task due time'}
              onChange={(value) => update({ endTime: value })}
            />
          </WorkspacePropertyRow>
          <WorkspacePropertyRow label="Tags" testId="task-property-tags">
            <TagEditor
              value={task.tags ?? []}
              availableTags={availableTags}
              onChange={(tags) => update({ tags })}
              label="Task tags"
              testId="task-tags-editor"
              className="min-w-0 flex-wrap"
            />
          </WorkspacePropertyRow>
          <WorkspacePropertyRow label="Reminders" testId="task-property-reminders">
            <TaskReminderEditor task={task} onChange={(reminders) => update({ reminders })} />
          </WorkspacePropertyRow>
        </div>
      </CollapsibleWorkspacePanelSection>
    </WorkspacePanelStack>
  )
}

function TaskTypeSelect({
  taskId,
  value,
  onChange
}: {
  taskId: string
  value: CalendarTaskType
  onChange: (value: CalendarTaskType) => void
}): ReactElement {
  return (
    <StatusChipSelect
      label={`Task type for ${taskId}`}
      value={value}
      options={CALENDAR_TASK_TYPE_CHIP_OPTIONS}
      onValueChange={(nextValue) => onChange(nextValue as CalendarTaskType)}
    />
  )
}

function TaskPrioritySelect({
  taskId,
  value,
  onChange
}: {
  taskId: string
  value: TaskPriority
  onChange: (value: TaskPriority) => void
}): ReactElement {
  return (
    <StatusChipSelect
      label={`Task priority for ${taskId}`}
      value={value}
      options={TASK_PRIORITY_OPTIONS.map((option) => ({
        value: option,
        ...TASK_PRIORITY_CHIP_ITEMS[option]
      }))}
      onValueChange={(nextValue) => onChange(nextValue as TaskPriority)}
    />
  )
}

function TaskDateValue({
  value,
  placeholder,
  ariaLabel,
  onChange,
  onClear
}: {
  value?: string
  placeholder: string
  ariaLabel: string
  onChange: (value: string | undefined) => void
  onClear: () => void
}): ReactElement {
  return (
    <div className="flex w-max min-w-full shrink-0 flex-nowrap items-center gap-1.5">
      <CalendarDateEditPopover
        value={value}
        label={ariaLabel}
        onValueChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="h-7 max-w-full border-border"
      />
      {value ? (
        <WorkspaceIconButton
          aria-label={`Clear ${ariaLabel.toLowerCase()}`}
          title={`Clear ${ariaLabel.toLowerCase()}`}
          icon={<X size={14} />}
          className="h-7 w-7"
          onClick={onClear}
        />
      ) : null}
    </div>
  )
}

function TaskTimeValue({
  value,
  ariaLabel,
  onChange
}: {
  value?: string
  ariaLabel: string
  onChange: (value: string | undefined) => void
}): ReactElement {
  return (
    <CalendarTimeEditPopover
      value={value}
      label={ariaLabel}
      onValueChange={onChange}
      placeholder="Set time"
      aria-label={ariaLabel}
      className="h-7 w-28"
    />
  )
}

function TaskReminderEditor({
  task,
  onChange
}: {
  task: CalendarTask
  onChange: (reminders: TaskReminder[]) => void
}): ReactElement {
  const [open, setOpen] = useState(false)
  const [newValue, setNewValue] = useState(30)
  const [newType, setNewType] = useState<TaskReminder['type']>('minutes')
  const reminders = useMemo(() => task.reminders ?? [], [task.reminders])
  const enabledCount = reminders.filter((reminder) => reminder.enabled).length
  const formatReminder = (reminder: TaskReminder): string =>
    `${reminder.value} ${reminder.value === 1 ? reminder.type.slice(0, -1) : reminder.type}`

  const addReminder = (): void => {
    onChange([
      ...reminders,
      {
        id: `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type: newType,
        value: Math.max(1, newValue),
        enabled: true
      }
    ])
    setNewValue(30)
    setNewType('minutes')
  }

  return (
    <>
      <div className="flex w-max min-w-full flex-wrap items-center gap-1.5">
        {reminders.map((reminder) => (
          <span
            key={reminder.id}
            className={`inline-flex items-center gap-1 rounded-[var(--radius-control)] border px-2 py-1 text-xs ${
              reminder.enabled
                ? 'border-ring bg-muted text-foreground'
                : 'border-border bg-muted text-muted-foreground'
            }`}
          >
            {reminder.enabled ? (
              <BellRing size={12} aria-hidden="true" />
            ) : (
              <Bell size={12} aria-hidden="true" />
            )}
            {formatReminder(reminder)}
            <WorkspaceIconButton
              aria-label={`Remove ${formatReminder(reminder)} reminder`}
              title={`Remove ${formatReminder(reminder)} reminder`}
              icon={<X size={12} />}
              className="h-5 w-5"
              onClick={() => onChange(reminders.filter((item) => item.id !== reminder.id))}
            />
          </span>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 rounded-[var(--radius-button-pill)] text-xs"
          onClick={() => setOpen(true)}
        >
          {enabledCount > 0 ? `${enabledCount} active` : 'Add reminder'}
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogShell>
            <DialogShellHeader
              context="Task"
              title="Task reminders"
              closeLabel="Close reminders"
              onClose={() => setOpen(false)}
            />
            <DialogBody>
              <DialogDescription className="mb-3">
                Manage notifications for this task.
              </DialogDescription>
              <div className="space-y-3">
                {reminders.length > 0 ? (
                  <div className="space-y-1.5">
                    {reminders.map((reminder) => (
                      <div
                        key={reminder.id}
                        className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-xs"
                      >
                        <button
                          type="button"
                          className="flex items-center gap-1.5 rounded-[var(--radius-control)] px-1 text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() =>
                            onChange(
                              reminders.map((item) =>
                                item.id === reminder.id ? { ...item, enabled: !item.enabled } : item
                              )
                            )
                          }
                        >
                          {reminder.enabled ? <BellRing size={12} /> : <Bell size={12} />}
                          {formatReminder(reminder)}
                        </button>
                        <WorkspaceIconButton
                          aria-label={`Remove ${formatReminder(reminder)} reminder`}
                          title={`Remove ${formatReminder(reminder)} reminder`}
                          icon={<X size={12} />}
                          className="h-6 w-6"
                          onClick={() =>
                            onChange(reminders.filter((item) => item.id !== reminder.id))
                          }
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No reminders yet.</p>
                )}
                <div className="border-t border-border pt-3">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">Add reminder</div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={999}
                      value={newValue}
                      aria-label="Reminder amount"
                      onChange={(event) =>
                        setNewValue(Math.max(1, Number(event.target.value) || 1))
                      }
                      className="h-8 w-20 text-xs"
                    />
                    <SelectionPopover
                      selectionMode="single"
                      value={newType}
                      options={[
                        { value: 'minutes', label: 'minutes' },
                        { value: 'hours', label: 'hours' },
                        { value: 'days', label: 'days' }
                      ]}
                      onValueChange={(value) => setNewType(value as TaskReminder['type'])}
                      label="Reminder unit"
                      searchPlaceholder="Search reminder units"
                      triggerProps={{
                        className: 'h-8 flex-1 text-xs',
                        'aria-label': 'Reminder unit'
                      }}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={addReminder}>
                      <Check size={14} /> Add
                    </Button>
                  </div>
                </div>
              </div>
            </DialogBody>
            <DialogShellFooter>
              <DialogActionButton
                onClick={() => setOpen(false)}
                title="Done"
                aria-label="Done"
                icon={<Check />}
                label="Done"
                tone="accent"
              />
            </DialogShellFooter>
          </DialogShell>
        </DialogContent>
      </Dialog>
    </>
  )
}
