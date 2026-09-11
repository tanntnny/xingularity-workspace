import { useEffect, useState, type ReactElement } from 'react'
import type { CalendarTask, TaskRecurrenceDraft } from '../../../shared/types'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogShell,
  DialogShellFooter,
  DialogShellHeader
} from './ui/dialog'
import { Repeat, X } from './ui/icons'
import { WorkspaceIconButton } from './ui/document-workspace'
import { WorkspaceTextFade } from './ui/workspace-text-fade'

const DEFAULT_RRULE = 'FREQ=WEEKLY;BYDAY=MO'
const DEFAULT_HORIZON = 6

export interface TaskRecurrenceEditorProps {
  task: CalendarTask
  iconOnly?: boolean
  onChange: (recurrence: TaskRecurrenceDraft | null) => void | Promise<void>
}

export function TaskRecurrenceEditor({
  task,
  iconOnly = false,
  onChange
}: TaskRecurrenceEditorProps): ReactElement {
  const [open, setOpen] = useState(false)
  const [rrule, setRrule] = useState(task.recurrence?.rrule ?? DEFAULT_RRULE)
  const [horizon, setHorizon] = useState(task.recurrence?.horizon ?? DEFAULT_HORIZON)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setRrule(task.recurrence?.rrule ?? DEFAULT_RRULE)
      setHorizon(task.recurrence?.horizon ?? DEFAULT_HORIZON)
    }
  }, [open, task.recurrence?.horizon, task.recurrence?.rrule])

  const openEditor = (): void => {
    setRrule(task.recurrence?.rrule ?? DEFAULT_RRULE)
    setHorizon(task.recurrence?.horizon ?? DEFAULT_HORIZON)
    setError(null)
    setOpen(true)
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      await onChange({
        rrule: rrule.trim(),
        horizon,
        timezone: task.recurrence?.timezone
      })
      setOpen(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError))
    } finally {
      setSaving(false)
    }
  }

  const disable = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      await onChange(null)
      setOpen(false)
    } catch (disableError) {
      setError(disableError instanceof Error ? disableError.message : String(disableError))
    } finally {
      setSaving(false)
    }
  }

  const summary = task.recurrence
    ? `${task.recurrence.generated ? 'Series' : 'Repeating'} · ${task.recurrence.horizon} ahead`
    : 'Does not repeat'
  const triggerLabel = task.recurrence ? 'Edit task recurrence' : 'Set task to repeat'

  return (
    <>
      {iconOnly ? (
        <WorkspaceIconButton
          icon={<Repeat />}
          active={Boolean(task.recurrence)}
          onClick={openEditor}
          aria-label={triggerLabel}
          title={triggerLabel}
          borderless
          data-testid="task-recurrence-trigger"
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 max-w-full rounded-[var(--radius-button-pill)] text-xs"
          onClick={openEditor}
          data-testid="task-recurrence-trigger"
        >
          <Repeat size={14} aria-hidden="true" />
          <WorkspaceTextFade className="min-w-0 flex-1">{summary}</WorkspaceTextFade>
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogShell>
            <DialogShellHeader
              context="Task"
              title="Repeating task"
              closeLabel="Close repeating task editor"
              onClose={() => setOpen(false)}
            />
            <DialogBody>
              <DialogDescription className="mb-4">
                The task stays as a normal record. Xingularity keeps the next future occurrences
                materialized and preserves completed or manually edited occurrences.
              </DialogDescription>
              <div className="space-y-4">
                <label className="block space-y-1.5" htmlFor={`task-rrule-${task.id}`}>
                  <span className="text-xs font-medium text-foreground">RRULE</span>
                  <Input
                    id={`task-rrule-${task.id}`}
                    value={rrule}
                    onChange={(event) => setRrule(event.target.value)}
                    placeholder="FREQ=WEEKLY;BYDAY=MO"
                    aria-describedby={`task-rrule-help-${task.id}`}
                    data-testid="task-recurrence-rrule-input"
                  />
                  <span
                    id={`task-rrule-help-${task.id}`}
                    className="block text-xs text-muted-foreground"
                  >
                    Use standard RRULE syntax, for example FREQ=DAILY or FREQ=MONTHLY;BYMONTHDAY=1.
                  </span>
                </label>
                <label className="block space-y-1.5" htmlFor={`task-horizon-${task.id}`}>
                  <span className="text-xs font-medium text-foreground">
                    Future occurrences to keep ready
                  </span>
                  <Input
                    id={`task-horizon-${task.id}`}
                    type="number"
                    min={1}
                    max={52}
                    value={horizon}
                    onChange={(event) => setHorizon(Number(event.target.value) || 1)}
                    data-testid="task-recurrence-horizon-input"
                  />
                </label>
                {error ? (
                  <p className="text-xs text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            </DialogBody>
            <DialogShellFooter className="flex-row items-center justify-between gap-2">
              <div>
                {task.recurrence ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground"
                    onClick={() => void disable()}
                    disabled={saving}
                    data-testid="task-recurrence-disable"
                  >
                    <X size={14} aria-hidden="true" />
                    Turn off repeating
                  </Button>
                ) : null}
              </div>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                onClick={() => void save()}
                disabled={saving}
                data-testid="task-recurrence-save"
              >
                {saving ? 'Saving…' : 'Save repeating task'}
              </Button>
            </DialogShellFooter>
          </DialogShell>
        </DialogContent>
      </Dialog>
    </>
  )
}
