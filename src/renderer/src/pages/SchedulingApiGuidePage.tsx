import type { ReactElement } from 'react'
import { BookOpen } from '../components/ui/icons'
import { WorkspacePage, WorkspacePageHeader, WorkspaceSectionCard } from '../components/workspace'

const PYTHON_EXAMPLE = `import json

actions = [
    {
        "type": "task.create",
        "title": "Review inbox",
        "endDate": "2026-08-20",
        "tags": ["automation"],
        "automationSource": "daily-planning",
        "automationSourceKey": "2026-08-13:review-inbox"
    }
]

print(json.dumps({"actions": actions}))`

const JAVASCRIPT_EXAMPLE = `beacon.emit({
  type: 'task.create',
  title: 'Review inbox',
  endDate: '2026-08-20',
  tags: ['automation'],
  automationSource: 'daily-planning',
  automationSourceKey: '2026-08-13:review-inbox'
})`

const ACTION_TYPES = [
  ['task.create', 'Create a task'],
  ['task.update', 'Update a task'],
  ['note.create', 'Create a note'],
  ['note.append', 'Append to an existing note'],
  ['calendar.event.create', 'Create a calendar event']
] as const

export function SchedulingApiGuidePage(): ReactElement {
  return (
    <WorkspacePage data-testid="scheduling-api-guide-page">
      <WorkspacePageHeader
        eyebrow="Scheduling"
        heading="Automation API guide"
        description="Use the action contract below to connect a script to tasks, notes, and calendar events."
        icon={<BookOpen size={30} className="text-primary" aria-hidden="true" />}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <WorkspaceSectionCard data-testid="scheduling-api-contract">
          <h2 className="text-lg font-semibold text-foreground">API contract</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Python scripts print one JSON object with an <code>actions</code> array. JavaScript
            scripts submit the same action objects with <code>beacon.emit</code>. A task may use
            <code> endDate</code> without <code>date</code> to represent a deadline-only task.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-muted/50 p-4 text-sm leading-6 text-foreground">
            <code>{`{"actions": [{"type": "task.create", "title": "Review inbox"}]}`}</code>
          </pre>
        </WorkspaceSectionCard>

        <WorkspaceSectionCard>
          <h2 className="text-lg font-semibold text-foreground">Supported actions</h2>
          <ul className="mt-4 space-y-3">
            {ACTION_TYPES.map(([type, description]) => (
              <li key={type} className="flex items-start gap-3 text-sm">
                <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                  {type}
                </code>
                <span className="text-muted-foreground">{description}</span>
              </li>
            ))}
          </ul>
        </WorkspaceSectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <WorkspaceSectionCard>
          <h2 className="text-lg font-semibold text-foreground">Python</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Write the action list to stdout as the final JSON line.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-muted/50 p-4 text-sm leading-6 text-foreground">
            <code>{PYTHON_EXAMPLE}</code>
          </pre>
        </WorkspaceSectionCard>

        <WorkspaceSectionCard>
          <h2 className="text-lg font-semibold text-foreground">JavaScript</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Emit one action or an array of actions through the provided runtime API.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-muted/50 p-4 text-sm leading-6 text-foreground">
            <code>{JAVASCRIPT_EXAMPLE}</code>
          </pre>
        </WorkspaceSectionCard>
      </div>

      <WorkspaceSectionCard>
        <h2 className="text-lg font-semibold text-foreground">Action fields</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Keep credentials out of job code and stdout. Use the network permission for external
          requests and update-task permission for reconciliation jobs.
        </p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="font-mono text-sm text-foreground">type</dt>
            <dd className="mt-1 text-sm leading-6 text-muted-foreground">
              Selects the action handler from the supported list.
            </dd>
          </div>
          <div>
            <dt className="font-mono text-sm text-foreground">automationSource</dt>
            <dd className="mt-1 text-sm leading-6 text-muted-foreground">
              Identifies the automation that produced the action.
            </dd>
          </div>
          <div>
            <dt className="font-mono text-sm text-foreground">automationSourceKey</dt>
            <dd className="mt-1 text-sm leading-6 text-muted-foreground">
              Gives repeated runs a stable key for deduplication and updates.
            </dd>
          </div>
          <div>
            <dt className="font-mono text-sm text-foreground">date / endDate</dt>
            <dd className="mt-1 text-sm leading-6 text-muted-foreground">
              Use both for a date range, or use <code>endDate</code> alone for a deadline that
              appears on that calendar day.
            </dd>
          </div>
        </dl>
      </WorkspaceSectionCard>
    </WorkspacePage>
  )
}
