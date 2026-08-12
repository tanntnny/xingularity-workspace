import type { ReactElement } from 'react'
import { Clock3 } from '../ui/icons'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState } from '../ui'
import type { RunStatus, ScheduleRunRecord, ScriptAction } from '../../../../shared/scheduleTypes'
import type { ScheduleRunHistoryProps } from './types'

function formatDateTime(value: string | undefined): string {
  if (!value) {
    return 'In progress'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString()
}

function statusTone(status: RunStatus): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'success') {
    return 'success'
  }

  if (status === 'review') {
    return 'warning'
  }

  if (status === 'error' || status === 'cancelled') {
    return 'danger'
  }

  return 'neutral'
}

function actionLabel(action: ScriptAction): string {
  if (action.type === 'task.create') {
    return `Create task: ${action.title}`
  }

  if (action.type === 'note.create') {
    return `Create note: ${action.name}`
  }

  if (action.type === 'note.append') {
    return `Append to note: ${action.name}`
  }

  if (action.type === 'task.update') {
    return `Update task: ${action.automationSourceKey}`
  }

  return `Create calendar event: ${action.title}`
}

function RunListItem({
  run,
  selected,
  onSelect
}: {
  run: ScheduleRunRecord
  selected: boolean
  onSelect: () => void
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      data-testid={`scheduling-run:${run.id}`}
      className={`w-full rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        selected ? 'border-primary bg-accent' : 'border-border bg-card hover:bg-accent/60'
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{formatDateTime(run.startedAt)}</span>
        <Badge tone={statusTone(run.status)}>{run.status}</Badge>
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">
        {run.proposedActions.length} proposed · {run.appliedActions.length} applied
      </span>
    </button>
  )
}

export function ScheduleRunHistory({
  runs,
  selectedRunId,
  actionBusyRunId,
  onSelect,
  onApply,
  onDismiss
}: ScheduleRunHistoryProps): ReactElement {
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null
  const canReview = selectedRun?.status === 'review' && selectedRun.proposedActions.length > 0

  return (
    <Card data-testid="scheduling-run-history">
      <CardHeader>
        <CardTitle>Run history</CardTitle>
        <p className="text-sm text-muted-foreground">
          Inspect output and approve proposed workspace changes.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {runs.length === 0 ? (
          <EmptyState
            icon={Clock3}
            title="No runs yet"
            description="Run this automation to see its output and proposed actions here."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(12rem,0.45fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              {runs.map((run) => (
                <RunListItem
                  key={run.id}
                  run={run}
                  selected={selectedRun?.id === run.id}
                  onSelect={() => onSelect(run.id)}
                />
              ))}
            </div>
            {selectedRun ? (
              <div className="min-w-0 space-y-4 rounded-md border border-border bg-muted/30 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{selectedRun.status} run</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Started {formatDateTime(selectedRun.startedAt)} · ended{' '}
                      {formatDateTime(selectedRun.endedAt)}
                    </p>
                  </div>
                  {canReview ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onApply(selectedRun.id)}
                        disabled={actionBusyRunId === selectedRun.id}
                      >
                        Apply actions
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onDismiss(selectedRun.id)}
                        disabled={actionBusyRunId === selectedRun.id}
                      >
                        Dismiss
                      </Button>
                    </div>
                  ) : null}
                </div>

                {selectedRun.errorMessage ? (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {selectedRun.errorMessage}
                  </p>
                ) : null}

                {selectedRun.proposedActions.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Proposed actions
                    </p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {selectedRun.proposedActions.map((action, index) => (
                        <li
                          key={`${action.type}:${index}`}
                          className="rounded border border-border p-3"
                        >
                          {actionLabel(action)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Standard output
                    </p>
                    <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-md bg-background p-3 font-mono text-xs text-foreground">
                      {selectedRun.stdout || 'No stdout'}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Error output
                    </p>
                    <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-md bg-background p-3 font-mono text-xs text-foreground">
                      {selectedRun.stderr || 'No stderr'}
                    </pre>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
