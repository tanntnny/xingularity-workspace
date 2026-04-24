import { ReactElement } from 'react'
import { ArrowLeft, Download } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '../components/ui/breadcrumb'
import {
  DocumentWorkspace,
  DocumentWorkspaceMain,
  DocumentWorkspaceMainContent,
  DocumentWorkspaceMainHeader,
  WorkspaceActionButton,
  WorkspaceHeaderActions,
  WorkspaceHeaderActionGroup,
  WorkspaceHeaderActionDivider
} from '../components/ui/document-workspace'

export const SCHEDULE_DOCUMENTATION_MARKDOWN = `# Schedule API Guide

Schedules let you save automations and execute them manually or from a trigger.

## Renderer schedule API

The renderer-facing schedule API is exposed as:

\`\`\`ts
vaultApi.schedules
\`\`\`

Available methods:

\`\`\`ts
listJobs(): Promise<ScheduleJob[]>
saveJob(input: ScheduleJobInput): Promise<ScheduleJob>
deleteJob(id: string): Promise<void>
runNow(id: string): Promise<ScheduleRunRecord>
listRuns(jobId: string): Promise<ScheduleRunRecord[]>
applyActions(runId: string): Promise<void>
dismissRun(runId: string): Promise<void>
\`\`\`

## Core job fields

- \`name\`: label shown in the schedules UI.
- \`enabled\`: whether trigger-based execution is active.
- \`trigger\`: one of \`manual\`, \`daily\`, \`every\`, \`cron\`, or \`on_app_start\`.
- \`runtime\`: \`javascript\` or \`python\`.
- \`code\`: the script source.
- \`permissions\`: capabilities granted to the script.
- \`outputMode\`: \`review_before_apply\` or \`auto_apply\`.

## Trigger config shape

\`\`\`ts
type TriggerConfig =
  | { type: 'manual' }
  | { type: 'daily'; time: string; timezone?: string }
  | { type: 'every'; intervalMinutes: number }
  | { type: 'cron'; expression: string }
  | { type: 'on_app_start' }
\`\`\`

## Script output contract

Schedules do not directly mutate workspace data from script code. Scripts emit action objects that Xingularity reviews or applies.

Supported action types:

- \`task.create\`
- \`task.update\`
- \`note.create\`
- \`note.append\`
- \`calendar.event.create\`

## JavaScript example

\`\`\`js
beacon.emit([
  {
    type: 'task.create',
    title: 'Daily review',
    date: new Date().toISOString().slice(0, 10),
    priority: 'medium',
    automationSource: 'daily-review',
    automationSourceKey: new Date().toISOString().slice(0, 10) + ':daily-review'
  }
])
\`\`\`

## Python example

\`\`\`py
import json
from datetime import date

today = date.today().isoformat()

print(json.dumps({
  "actions": [
    {
      "type": "note.create",
      "name": "Automation Log",
      "body": f"Run completed on {today}",
      "automationSource": "automation-log",
      "automationSourceKey": today
    }
  ]
}))
\`\`\`

## Run lifecycle

1. Save a schedule definition.
2. Run it manually or let its trigger fire.
3. Inspect stdout, stderr, and generated actions in Run History.
4. If output mode is review-first, approve with \`applyActions\` or reject with \`dismissRun\`.

## Permission model

Grant only the permissions your script needs:

- \`network\`
- \`readNotes\`
- \`createNotes\`
- \`updateNotes\`
- \`createTasks\`
- \`updateTasks\`
- \`createCalendarItems\`
- \`updateProjects\`
- \`useSecrets\`

## Recommended usage pattern

1. Start with a manual trigger.
2. Use review mode until the generated actions are stable.
3. Add deterministic \`automationSource\` and \`automationSourceKey\` values to avoid duplicate writes.
4. Move to daily, cron, or interval triggers only after validating the output.
`

interface ScheduleDocumentationPageProps {
  onBack: () => void
  onDownload: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }): ReactElement {
  return (
    <section className="workspace-subtle-surface space-y-3 rounded-[24px] p-6 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
      </div>
      <div className="space-y-3 text-sm leading-7 text-[var(--muted)]">{children}</div>
    </section>
  )
}

function CodeBlock({ code, language }: { code: string; language: string }): ReactElement {
  return (
    <pre className="workspace-subtle-surface overflow-x-auto rounded-2xl p-4 text-xs leading-6 text-[var(--text)]">
      <code data-language={language}>{code}</code>
    </pre>
  )
}

export function ScheduleDocumentationPage({
  onBack,
  onDownload
}: ScheduleDocumentationPageProps): ReactElement {
  return (
    <DocumentWorkspace>
      <DocumentWorkspaceMain className="border-r-0">
        <DocumentWorkspaceMainHeader
          breadcrumb={
            <Breadcrumb>
              <BreadcrumbList className="text-[var(--muted)]">
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-sm text-[var(--muted)]">Schedules</BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-[var(--line-strong)]" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-sm font-semibold text-[var(--text)]">
                    Schedule API Guide
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          }
          actions={
            <WorkspaceHeaderActions>
              <WorkspaceHeaderActionGroup>
                <WorkspaceActionButton
                  onClick={onBack}
                  icon={<ArrowLeft size={14} />}
                  label="Back to schedules"
                />
              </WorkspaceHeaderActionGroup>
              <WorkspaceHeaderActionDivider />
              <WorkspaceHeaderActionGroup>
                <WorkspaceActionButton
                  onClick={onDownload}
                  icon={<Download size={14} />}
                  label="Download .md"
                />
              </WorkspaceHeaderActionGroup>
            </WorkspaceHeaderActions>
          }
        />
        <DocumentWorkspaceMainContent className="overflow-y-auto">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-6">
            <section className="workspace-subtle-surface rounded-[28px] px-6 py-7 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                Standalone Documentation
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)]">
                Schedule API Guide
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                This page documents the schedule feature as an app-level API surface: job shape,
                trigger config, available renderer methods, emitted action contracts, and the
                review/apply lifecycle.
              </p>
            </section>

            <Section title="Renderer entry point">
              <p>
                The schedule feature is available from the renderer through the Electron bridge.
              </p>
              <CodeBlock
                language="ts"
                code={`const schedules = window.vaultApi?.schedules

const jobs = await schedules.listJobs()
const runs = await schedules.listRuns(jobId)`}
              />
            </Section>

            <Section title="Available methods">
              <CodeBlock
                language="ts"
                code={`listJobs(): Promise<ScheduleJob[]>
saveJob(input: ScheduleJobInput): Promise<ScheduleJob>
deleteJob(id: string): Promise<void>
runNow(id: string): Promise<ScheduleRunRecord>
listRuns(jobId: string): Promise<ScheduleRunRecord[]>
applyActions(runId: string): Promise<void>
dismissRun(runId: string): Promise<void>`}
              />
            </Section>

            <Section title="Job definition">
              <ul className="space-y-2">
                <li>
                  <span className="font-medium text-[var(--text)]">name</span>: user-facing job
                  label.
                </li>
                <li>
                  <span className="font-medium text-[var(--text)]">enabled</span>: whether
                  non-manual triggers are active.
                </li>
                <li>
                  <span className="font-medium text-[var(--text)]">trigger</span>: scheduling
                  strategy.
                </li>
                <li>
                  <span className="font-medium text-[var(--text)]">runtime</span>: script runtime,
                  either JavaScript or Python.
                </li>
                <li>
                  <span className="font-medium text-[var(--text)]">permissions</span>: explicit
                  capabilities granted to the script.
                </li>
                <li>
                  <span className="font-medium text-[var(--text)]">outputMode</span>: review-first
                  or auto-apply execution.
                </li>
              </ul>
              <CodeBlock
                language="ts"
                code={`type TriggerConfig =
  | { type: 'manual' }
  | { type: 'daily'; time: string; timezone?: string }
  | { type: 'every'; intervalMinutes: number }
  | { type: 'cron'; expression: string }
  | { type: 'on_app_start' }`}
              />
            </Section>

            <Section title="Emitted action types">
              <p>
                Scripts emit action objects instead of mutating workspace state directly. The
                current action contract supports:
              </p>
              <ul className="space-y-2">
                <li>
                  <code>task.create</code>
                </li>
                <li>
                  <code>task.update</code>
                </li>
                <li>
                  <code>note.create</code>
                </li>
                <li>
                  <code>note.append</code>
                </li>
                <li>
                  <code>calendar.event.create</code>
                </li>
              </ul>
            </Section>

            <Section title="JavaScript runtime example">
              <CodeBlock
                language="js"
                code={`beacon.emit([
  {
    type: 'task.create',
    title: 'Daily review',
    date: new Date().toISOString().slice(0, 10),
    priority: 'medium',
    automationSource: 'daily-review',
    automationSourceKey: new Date().toISOString().slice(0, 10) + ':daily-review'
  }
])`}
              />
            </Section>

            <Section title="Python runtime example">
              <CodeBlock
                language="py"
                code={`import json
from datetime import date

today = date.today().isoformat()

print(json.dumps({
  "actions": [
    {
      "type": "note.create",
      "name": "Automation Log",
      "body": f"Run completed on {today}",
      "automationSource": "automation-log",
      "automationSourceKey": today
    }
  ]
}))`}
              />
            </Section>

            <Section title="Operational guidance">
              <ol className="space-y-2">
                <li>Build and test with the manual trigger first.</li>
                <li>Use review mode until the script output is stable.</li>
                <li>Inspect stdout, stderr, and proposed actions in Run History.</li>
                <li>Use deterministic automation keys to avoid duplicate writes.</li>
                <li>Grant only the permissions the script actually needs.</li>
              </ol>
            </Section>
          </div>
        </DocumentWorkspaceMainContent>
      </DocumentWorkspaceMain>
    </DocumentWorkspace>
  )
}
