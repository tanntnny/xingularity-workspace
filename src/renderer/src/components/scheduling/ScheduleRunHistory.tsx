import type { ReactElement } from 'react'
import { Clock3, Copy } from '../ui/icons'
import {
  Badge,
  Button,
  CollapsibleWorkspacePanelSection,
  EmptyState,
  WorkspaceListRail,
  WorkspaceListRailItem
} from '../ui'
import type { RunStatus, ScheduleRunRecord, ScriptAction } from '../../../../shared/scheduleTypes'
import type { ScheduleRunHistoryListProps, ScheduleRunHistoryProps } from './types'

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
    <WorkspaceListRailItem
      onClick={onSelect}
      active={selected}
      data-testid={`scheduling-run:${run.id}`}
      trailing={<Badge tone={statusTone(run.status)}>{run.status}</Badge>}
      description={`${run.proposedActions.length} proposed · ${run.appliedActions.length} applied${
        run.actionErrors && run.actionErrors.length > 0
          ? ` · ${run.actionErrors.length} failed`
          : ''
      }`}
    >
      {formatDateTime(run.startedAt)}
    </WorkspaceListRailItem>
  )
}

export function ScheduleRunHistoryList({
  runs,
  selectedRunId,
  onSelect
}: ScheduleRunHistoryListProps): ReactElement {
  return (
    <CollapsibleWorkspacePanelSection
      heading="Run history"
      data-testid="scheduling-run-history-list"
    >
      <WorkspaceListRail
        aria-label="Automation run history"
        className="h-auto min-h-0 p-3"
        emptyState={
          <EmptyState
            icon={Clock3}
            title="No runs yet"
            description="Run this automation to see its output and proposed actions here."
          />
        }
      >
        {runs.map((run) => (
          <RunListItem
            key={run.id}
            run={run}
            selected={run.id === selectedRunId}
            onSelect={() => onSelect(run.id)}
          />
        ))}
      </WorkspaceListRail>
    </CollapsibleWorkspacePanelSection>
  )
}

export function ScheduleRunHistory({
  runs,
  selectedRunId,
  actionBusyRunId,
  onApply,
  onDismiss
}: ScheduleRunHistoryProps): ReactElement {
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null
  const canReview = selectedRun?.status === 'review' && selectedRun.proposedActions.length > 0

  return (
    <section
      className="flex min-h-full min-w-0 flex-col gap-6 p-2"
      data-testid="scheduling-run-history"
      aria-labelledby="scheduling-run-history-heading"
    >
      <header className="shrink-0">
        <h1
          id="scheduling-run-history-heading"
          className="text-2xl font-semibold tracking-tight text-foreground"
        >
          Run history
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Inspect output and approve proposed workspace changes.
        </p>
      </header>

      {runs.length === 0 ? (
        <EmptyState
          icon={Clock3}
          title="No runs yet"
          description="Run this automation to see its output and proposed actions here."
        />
      ) : selectedRun ? (
        <article className="min-w-0 space-y-6" aria-label={`${selectedRun.status} run details`}>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-panel-border pb-4">
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

          {selectedRun.actionErrors && selectedRun.actionErrors.length > 0 ? (
            <div className="rounded-md border border-warning-border bg-warning-muted p-3 text-sm text-warning-muted-foreground">
              <p className="font-semibold">Action errors</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {selectedRun.actionErrors.map((error, index) => (
                  <li key={`${error}:${index}`}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {selectedRun.proposedActions.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Proposed actions
              </p>
              <ul className="mt-2 divide-y divide-border border-y border-border text-sm">
                {selectedRun.proposedActions.map((action, index) => (
                  <li key={`${action.type}:${index}`} className="py-3">
                    {actionLabel(action)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-4 border-t border-panel-border pt-4 md:grid-cols-2">
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Standard output
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 rounded-full"
                  aria-label="Copy stdout"
                  title="Copy stdout"
                  data-testid="scheduling-copy-stdout"
                  onClick={() => void navigator.clipboard.writeText(selectedRun.stdout)}
                >
                  <Copy aria-hidden="true" />
                </Button>
              </div>
              <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-md bg-background p-3 font-mono text-xs text-foreground">
                {selectedRun.stdout || 'No stdout'}
              </pre>
            </div>
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Error output
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 rounded-full"
                  aria-label="Copy stderr"
                  title="Copy stderr"
                  data-testid="scheduling-copy-stderr"
                  onClick={() => void navigator.clipboard.writeText(selectedRun.stderr)}
                >
                  <Copy aria-hidden="true" />
                </Button>
              </div>
              <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-md bg-background p-3 font-mono text-xs text-foreground">
                {selectedRun.stderr || 'No stderr'}
              </pre>
            </div>
          </div>
        </article>
      ) : null}
    </section>
  )
}
