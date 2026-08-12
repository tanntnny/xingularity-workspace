import type { ReactElement } from 'react'
import { Play, Save, Shield, Terminal, Trash2 } from '../ui/icons'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea
} from '../ui'
import type {
  RuntimeType,
  SchedulePermission,
  TriggerConfig,
  TriggerType
} from '../../../../shared/scheduleTypes'
import type { ScheduleEditorProps } from './types'

const PERMISSION_OPTIONS: Array<{
  value: SchedulePermission
  label: string
  description: string
}> = [
  {
    value: 'network',
    label: 'Network access',
    description: 'Allow requests to external services.'
  },
  {
    value: 'readNotes',
    label: 'Read notes',
    description: 'Allow the script to inspect workspace notes.'
  },
  { value: 'createTasks', label: 'Create tasks', description: 'Allow task.create actions.' },
  { value: 'createNotes', label: 'Create notes', description: 'Allow note.create actions.' }
]

function createTrigger(type: TriggerType): TriggerConfig {
  if (type === 'daily') {
    return { type, time: '09:00', timezone: 'local' }
  }

  if (type === 'every') {
    return { type, intervalMinutes: 60 }
  }

  if (type === 'cron') {
    return { type, expression: '0 9 * * *' }
  }

  return { type }
}

export function ScheduleEditor({
  draft,
  isNew,
  isDirty,
  isSaving,
  isRunning,
  onChange,
  onEnabledChange,
  onTriggerChange,
  onTogglePermission,
  onInsertTemplate,
  onSave,
  onRun,
  onDelete
}: ScheduleEditorProps): ReactElement {
  const showCron = draft.trigger.type === 'cron'

  return (
    <Card data-testid="scheduling-editor">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{isNew ? 'New automation' : 'Edit automation'}</CardTitle>
            <CardDescription className="mt-2">
              Define when the script runs, what it can do, and how its output is handled.
            </CardDescription>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Switch
              checked={draft.enabled}
              onCheckedChange={onEnabledChange}
              aria-label="Enable automation"
              data-testid="scheduling-enabled"
            />
            {draft.enabled ? 'Enabled' : 'Disabled'}
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{draft.runtime === 'python' ? 'Python' : 'JavaScript'}</Badge>
          <Badge variant="outline">
            {draft.outputMode === 'auto_apply' ? 'Auto apply' : 'Review before apply'}
          </Badge>
          {isDirty ? <Badge tone="warning">Unsaved changes</Badge> : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <Field label="Name" htmlFor="scheduling-name">
          <Input
            id="scheduling-name"
            value={draft.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="Morning planning"
            data-testid="scheduling-name"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Runtime" htmlFor="scheduling-runtime">
            <Select
              value={draft.runtime}
              onValueChange={(value) => onChange({ runtime: value as RuntimeType })}
            >
              <SelectTrigger id="scheduling-runtime" data-testid="scheduling-runtime">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="python">Python</SelectItem>
                <SelectItem value="javascript">JavaScript (legacy)</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Run" htmlFor="scheduling-trigger">
            <Select
              value={draft.trigger.type}
              onValueChange={(value) => onTriggerChange(createTrigger(value as TriggerType))}
            >
              <SelectTrigger id="scheduling-trigger" data-testid="scheduling-trigger">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manually</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="every">At an interval</SelectItem>
                <SelectItem value="on_app_start">When app starts</SelectItem>
                {showCron ? <SelectItem value="cron">Cron (legacy)</SelectItem> : null}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {draft.trigger.type === 'daily' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Time" htmlFor="scheduling-daily-time">
              <Input
                id="scheduling-daily-time"
                type="time"
                value={draft.trigger.time ?? '09:00'}
                onChange={(event) =>
                  onTriggerChange({ ...draft.trigger, time: event.target.value })
                }
              />
            </Field>
            <Field label="Timezone" htmlFor="scheduling-timezone">
              <Input id="scheduling-timezone" value="Local timezone" readOnly />
            </Field>
          </div>
        ) : null}

        {draft.trigger.type === 'every' ? (
          <Field label="Interval in minutes" htmlFor="scheduling-interval">
            <Input
              id="scheduling-interval"
              type="number"
              min={1}
              value={draft.trigger.intervalMinutes ?? 60}
              onChange={(event) =>
                onTriggerChange({
                  ...draft.trigger,
                  intervalMinutes: Math.max(1, Number(event.target.value) || 1)
                })
              }
            />
          </Field>
        ) : null}

        {showCron ? (
          <Field
            label="Cron expression"
            htmlFor="scheduling-cron"
            description="Existing cron jobs remain available for compatibility. New automations use the simpler schedule options."
          >
            <Input
              id="scheduling-cron"
              value={draft.trigger.expression ?? ''}
              onChange={(event) =>
                onTriggerChange({ ...draft.trigger, expression: event.target.value })
              }
            />
          </Field>
        ) : null}

        <Field
          label="Python code"
          htmlFor="scheduling-code"
          description={
            draft.runtime === 'python'
              ? 'The script should print JSON in the form {"actions": [...]}.'
              : 'JavaScript jobs are retained for existing automations and use the same action protocol.'
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onInsertTemplate('task')}
                disabled={draft.runtime !== 'python'}
                data-testid="scheduling-add-task-template"
              >
                Add task
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onInsertTemplate('note')}
                disabled={draft.runtime !== 'python'}
                data-testid="scheduling-add-note-template"
              >
                Add note
              </Button>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Terminal aria-hidden="true" />
              Stdout action protocol
            </span>
          </div>
          <Textarea
            value={draft.code}
            onChange={(event) => onChange({ code: event.target.value })}
            spellCheck={false}
            className="min-h-[300px] font-mono text-xs leading-5"
            id="scheduling-code"
            data-testid="scheduling-code"
          />
        </Field>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Permissions</legend>
          <p className="text-sm text-muted-foreground">
            Keep permissions narrow. Actions outside this list are ignored by the runner.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {PERMISSION_OPTIONS.map((option) => {
              const checked = draft.permissions.includes(option.value)
              return (
                <label
                  key={option.value}
                  className="flex items-start gap-3 rounded-md border border-border bg-card p-3"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => onTogglePermission(option.value, value === true)}
                    aria-label={option.label}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <Field
          label="Output handling"
          htmlFor="scheduling-output-mode"
          description="Review mode keeps proposed tasks and notes pending until you approve them."
        >
          <Select
            value={draft.outputMode}
            onValueChange={(value) =>
              onChange({ outputMode: value as 'auto_apply' | 'review_before_apply' })
            }
          >
            <SelectTrigger id="scheduling-output-mode" data-testid="scheduling-output-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="review_before_apply">Review before apply</SelectItem>
              <SelectItem value="auto_apply">Auto apply</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </CardContent>

      <CardFooter className="flex flex-wrap justify-between gap-2 border-t pt-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onSave} disabled={isSaving} data-testid="scheduling-save">
            <Save aria-hidden="true" />
            {isSaving ? 'Saving…' : 'Save automation'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onRun}
            disabled={isRunning || isSaving}
            data-testid="scheduling-run-now"
          >
            <Play aria-hidden="true" />
            {isRunning ? 'Running…' : 'Run now'}
          </Button>
        </div>
        {!isNew ? (
          <Button type="button" variant="ghost" onClick={onDelete} data-testid="scheduling-delete">
            <Trash2 aria-hidden="true" />
            Delete
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Shield aria-hidden="true" />
            Disabled until you enable it
          </span>
        )}
      </CardFooter>
    </Card>
  )
}
