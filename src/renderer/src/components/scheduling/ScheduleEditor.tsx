import type { ReactElement } from 'react'
import { Field, Input } from '../ui'
import type { ScheduleEditorProps } from './types'
import { ScheduleCodeEditor } from './ScheduleCodeEditor'

export function ScheduleEditor({
  draft,
  onChange,
  onTriggerChange
}: ScheduleEditorProps): ReactElement {
  const showCron = draft.trigger.type === 'cron'

  return (
    <div className="flex h-full min-h-0 flex-col gap-5" data-testid="scheduling-editor">
      <div className="shrink-0 space-y-3">
        <Input
          id="scheduling-name"
          value={draft.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Morning planning"
          className="h-auto border-0 bg-transparent px-0 text-3xl font-semibold shadow-none focus-visible:ring-0"
          aria-label="Automation name"
          data-testid="scheduling-name"
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5">
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

        <ScheduleCodeEditor
          code={draft.code}
          runtime={draft.runtime}
          onChange={(code) => onChange({ code })}
        />
      </div>
    </div>
  )
}
