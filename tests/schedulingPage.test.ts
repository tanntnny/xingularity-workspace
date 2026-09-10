import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ScheduleEditor } from '../src/renderer/src/components/scheduling/ScheduleEditor'
import { ScheduleJobList } from '../src/renderer/src/components/scheduling/ScheduleJobList'
import { SchedulePropertiesPanel } from '../src/renderer/src/components/scheduling/SchedulePropertiesPanel'
import { ScheduleRunHistory } from '../src/renderer/src/components/scheduling/ScheduleRunHistory'
import { SchedulingBreadcrumb } from '../src/renderer/src/components/scheduling/SchedulingBreadcrumb'
import { SchedulingViewTabs } from '../src/renderer/src/components/scheduling/SchedulingViewTabs'
import {
  PYTHON_TRUST_DESCRIPTION,
  PYTHON_TRUST_TITLE,
  SchedulingPythonTrustPopover
} from '../src/renderer/src/components/scheduling/SchedulingPythonTrustPopover'
import {
  SchedulingAddAutomationButton,
  SchedulingPage,
  SchedulingRightPanel,
  SchedulingTopbarActions,
  SchedulingWorkspaceProvider
} from '../src/renderer/src/pages/SchedulingPage'
import { SchedulingApiGuidePage } from '../src/renderer/src/pages/SchedulingApiGuidePage'
import type { RendererVaultApi } from '../src/shared/types'

const draft = {
  name: 'Daily planning',
  enabled: false,
  trigger: { type: 'manual' as const },
  runtime: 'python' as const,
  code: 'print("hello")',
  permissions: ['createTasks' as const],
  outputMode: 'review_before_apply' as const
}

const dailyDraft = {
  ...draft,
  trigger: { type: 'daily' as const, time: '08:30', timezone: 'local' as const }
}

function SchedulingEmptyStateTest(): ReactElement {
  return createElement(
    SchedulingWorkspaceProvider,
    {
      enabled: false,
      vaultApi: undefined,
      pushToast: () => undefined
    },
    createElement(SchedulingPage, { activeView: 'automation' })
  )
}

function SchedulingContentTest({
  activeView
}: {
  activeView: 'list' | 'automation' | 'history'
}): ReactElement {
  return createElement(
    SchedulingWorkspaceProvider,
    {
      enabled: false,
      vaultApi: {} as RendererVaultApi,
      pushToast: () => undefined
    },
    createElement(SchedulingPage, { activeView })
  )
}

describe('Scheduling page UI', () => {
  it('renders the scheduling empty state without a vault API', () => {
    const markup = renderToStaticMarkup(createElement(SchedulingEmptyStateTest))

    expect(markup).toContain('data-testid="scheduling-page"')
    expect(markup).toContain('Scheduling needs an open vault')
  })

  it('renders the automation view without run history', () => {
    const markup = renderToStaticMarkup(
      createElement(SchedulingContentTest, { activeView: 'automation' })
    )

    expect(markup).toContain('data-testid="scheduling-editor"')
    expect(markup).not.toContain('data-testid="scheduling-run-history"')
    expect(markup).not.toContain(PYTHON_TRUST_TITLE)
    expect(markup).not.toContain(PYTHON_TRUST_DESCRIPTION)
  })

  it('renders the automation list as the scheduling landing view', () => {
    const markup = renderToStaticMarkup(
      createElement(SchedulingContentTest, { activeView: 'list' as const })
    )

    expect(markup).toContain('data-testid="scheduling-job-list"')
    expect(markup).not.toContain('data-testid="scheduling-editor"')
    expect(markup).not.toContain('data-testid="scheduling-run-history"')
  })

  it('renders automations as a table', () => {
    const markup = renderToStaticMarkup(
      createElement(ScheduleJobList, {
        jobs: [
          {
            id: 'daily-planning',
            name: 'Daily planning',
            enabled: true,
            trigger: { type: 'daily', time: '09:00', timezone: 'local' },
            runtime: 'python',
            code: 'print("hello")',
            permissions: ['createTasks'],
            outputMode: 'review_before_apply',
            createdAt: '2026-08-15T09:00:00.000Z',
            updatedAt: '2026-08-15T09:00:00.000Z',
            lastRunAt: '2026-08-15T10:00:00.000Z',
            lastStatus: 'success'
          }
        ],
        selectedJobId: 'daily-planning',
        loading: false,
        onSelect: () => undefined,
        onCreate: () => undefined,
        onRunJob: () => undefined,
        onRequestDeleteJob: () => undefined,
        isRunning: false
      })
    )

    expect(markup).not.toContain('Manage the automations that run in this vault.')
    expect(markup).not.toContain('1 automation')
    expect(markup).toContain('aria-label="Automations"')
    expect(markup).toContain('data-testid="scheduling-job-menu:daily-planning"')
    expect(markup).toContain('<th')
    expect(markup).toContain('cursor-pointer rounded-xl border-0 bg-transparent hover:bg-muted')
    expect(markup).toContain('data-[state=selected]:bg-muted')
    expect(markup).toContain('[&amp;_tr]:border-0')
    expect(markup).toContain('rounded-xl')
    expect(markup).toContain('border-separate border-spacing-y-1')
    expect(markup).toContain('--status-chip-schedule-job-success-icon')
    expect(markup).toContain('rounded-l-xl')
    expect(markup).toContain('rounded-r-xl')
    expect(markup).not.toContain('hover:underline')
    expect(markup).toContain('>Daily planning</span>')
    expect(markup).toContain('>Daily at 09:00</span></td>')
    expect(markup).not.toContain('CollapsibleWorkspacePanelSection')
  })

  it('renders the history view without the automation editor', () => {
    const markup = renderToStaticMarkup(
      createElement(SchedulingContentTest, { activeView: 'history' })
    )

    expect(markup).toContain('data-testid="scheduling-run-history"')
    expect(markup).toContain('id="scheduling-run-history-heading"')
    expect(markup).toContain('>Run history</h1>')
    expect(markup).not.toContain('data-testid="scheduling-editor"')
  })

  it('renders icon-only rounded copy controls for stdout and stderr', () => {
    const markup = renderToStaticMarkup(
      createElement(ScheduleRunHistory, {
        runs: [
          {
            id: 'run-1',
            jobId: 'daily-planning',
            startedAt: '2026-08-15T09:00:00.000Z',
            endedAt: '2026-08-15T09:00:01.000Z',
            status: 'success',
            stdout: 'created task',
            stderr: '',
            proposedActions: [],
            appliedActions: []
          }
        ],
        selectedRunId: 'run-1',
        actionBusyRunId: null,
        onApply: () => undefined,
        onDismiss: () => undefined
      })
    )

    expect(markup).toContain('data-testid="scheduling-copy-stdout"')
    expect(markup).toContain('data-testid="scheduling-copy-stderr"')
    expect(markup).toContain('aria-label="Copy stdout"')
    expect(markup).toContain('aria-label="Copy stderr"')
    expect(markup).toContain('rounded-full')
  })

  it('renders the accessible Automation and History tab menu', () => {
    const markup = renderToStaticMarkup(
      createElement(SchedulingViewTabs, {
        value: 'history',
        onValueChange: () => undefined
      })
    )

    expect(markup).toContain('data-testid="scheduling-view-tabs"')
    expect(markup).toContain('aria-label="Scheduling view"')
    expect(markup).toContain('data-testid="scheduling-view-tab:automation"')
    expect(markup).toContain('data-testid="scheduling-view-tab:history"')
    expect(markup).toContain('id="scheduling-view-tab-automation"')
    expect(markup).toContain('id="scheduling-view-tab-history"')
    expect(markup).toContain('aria-controls="scheduling-view-panel"')
    expect(markup).not.toContain('data-testid="scheduling-view-tab-icon:automation"')
    expect(markup).not.toContain('data-testid="scheduling-view-tab-icon:history"')
    expect(markup).toContain('<span>Automation</span>')
    expect(markup).toContain('<span>History</span>')
    expect(markup).toContain('aria-selected="true"')
    expect(markup).not.toContain('data-testid="scheduling-review-count:history"')
  })

  it('renders the pending review count on the History tab', () => {
    const markup = renderToStaticMarkup(
      createElement(SchedulingViewTabs, {
        value: 'automation',
        reviewCount: 2,
        onValueChange: () => undefined
      })
    )

    expect(markup).toContain('data-testid="scheduling-review-count:history"')
    expect(markup).toContain('aria-label="History, 2 automations need review"')
    expect(markup).toContain('>2</span>')
  })

  it('renders clickable scheduling breadcrumb ancestors', () => {
    const markup = renderToStaticMarkup(
      createElement(SchedulingBreadcrumb, {
        value: 'history',
        automationName: 'Morning planning',
        onNavigate: () => undefined
      })
    )

    expect(markup).toContain('data-testid="scheduling-breadcrumb"')
    expect(markup).toContain('data-testid="scheduling-breadcrumb:scheduling"')
    expect(markup).toContain('>Scheduling</span>')
    expect(markup).toContain('tabler-icon-bolt')
    expect(markup).not.toContain('List of Automation')
    expect(markup).not.toContain('>Automation</span>')
    expect(markup).not.toContain('>History</span>')
    expect(markup).toContain('>Morning planning</span>')
  })

  it('renders Add automation as a workspace header action', () => {
    const markup = renderToStaticMarkup(
      createElement(
        SchedulingWorkspaceProvider,
        {
          enabled: false,
          vaultApi: {} as RendererVaultApi,
          pushToast: () => undefined
        },
        createElement(SchedulingAddAutomationButton)
      )
    )

    expect(markup).toContain('data-testid="scheduling-add-automation"')
    expect(markup).toContain('aria-label="Add automation"')
    expect(markup).toContain('<span>Add automation</span>')
    expect(markup).toContain('bg-accent')
  })

  it('renders save before the accent Run now action in the topbar', () => {
    const markup = renderToStaticMarkup(
      createElement(
        SchedulingWorkspaceProvider,
        {
          enabled: false,
          vaultApi: {} as RendererVaultApi,
          pushToast: () => undefined
        },
        createElement(SchedulingTopbarActions, { activeView: 'automation' })
      )
    )

    expect(markup.indexOf('data-testid="scheduling-topbar-save"')).toBeLessThan(
      markup.indexOf('data-testid="scheduling-topbar-run"')
    )
    const saveButton = markup.match(/<button[^>]*data-testid="scheduling-topbar-save"[^>]*>/)?.[0]
    const runButton = markup.match(/<button[^>]*data-testid="scheduling-topbar-run"[^>]*>/)?.[0]

    expect(saveButton).toContain('bg-transparent')
    expect(saveButton).toContain('text-muted-foreground')
    expect(runButton).toContain('bg-accent')
    expect(markup).toContain('>Run now</span>')
  })

  it('does not render detail actions from the schedules list topbar', () => {
    const markup = renderToStaticMarkup(
      createElement(
        SchedulingWorkspaceProvider,
        {
          enabled: false,
          vaultApi: {} as RendererVaultApi,
          pushToast: () => undefined
        },
        createElement(SchedulingTopbarActions, { activeView: 'list' })
      )
    )

    expect(markup).not.toContain('data-testid="scheduling-topbar-save"')
    expect(markup).not.toContain('data-testid="scheduling-topbar-run"')
    expect(markup).not.toContain('data-testid="scheduling-topbar-api-guide"')
  })

  it('renders the Python trust guidance as an icon-only attention control', () => {
    const markup = renderToStaticMarkup(
      createElement(SchedulingPythonTrustPopover, { vaultRoot: '/vaults/demo' })
    )

    expect(markup).toContain('data-testid="scheduling-python-trust-trigger"')
    expect(markup).toContain('aria-label="Read local Python trust guidance"')
    expect(markup).toContain('data-testid="scheduling-python-trust-attention"')
    expect(markup).toContain('Review Python safety')
    expect(markup).toContain('bg-warning-muted')
    expect(markup).toContain('data-testid="scheduling-python-trust-dismiss"')
    expect(PYTHON_TRUST_TITLE).toBe('Local Python trust boundary')
    expect(PYTHON_TRUST_DESCRIPTION).toBe(
      'Python runs as a local process with the same OS access as the app. Keep code trusted, request only the permissions it needs, and review proposed actions.'
    )
  })

  it('renders the code editor without the automation properties panel', () => {
    const markup = renderToStaticMarkup(
      createElement(ScheduleEditor, {
        draft,
        onChange: () => undefined,
        onTriggerChange: () => undefined
      })
    )

    expect(markup).toContain('data-testid="scheduling-code-editor"')
    expect(markup).toContain('class="flex h-full min-h-0 flex-col gap-5"')
    expect(markup).toContain(
      'class="scheduling-code-editor flex min-h-0 min-w-0 flex-1 flex-col gap-2"'
    )
    expect(markup).toContain('class="scheduling-code-editor-surface min-h-0 min-w-0 flex-1"')
    expect(markup).not.toContain('data-testid="scheduling-save-changes"')
    expect(markup).not.toContain('The script should print JSON')
    expect(markup).not.toContain('data-testid="scheduling-add-task-template"')
    expect(markup).not.toContain('data-testid="scheduling-add-note-template"')
    expect(markup).toContain('aria-label="Automation name"')
    expect(markup).not.toContain('data-testid="scheduling-properties-panel"')
    expect(markup).not.toContain('data-testid="scheduling-property-runtime"')
    expect(markup).not.toContain('Edit automation')
    expect(markup).not.toContain(
      'Define when the script runs, what it can do, and how its output is handled.'
    )
    expect(markup).not.toContain('>Python</span>')
    expect(markup).not.toContain('>Review before apply</span>')
    expect(markup).not.toContain('data-testid="scheduling-daily-time"')
    expect(markup).not.toContain('data-testid="scheduling-timezone"')
  })

  it('renders automation properties as a stacked project-style panel', () => {
    const markup = renderToStaticMarkup(
      createElement(SchedulePropertiesPanel, {
        draft,
        secretNames: [],
        onChange: () => undefined,
        onEnabledChange: () => undefined,
        onTriggerChange: () => undefined,
        onTogglePermission: () => undefined,
        onSaveSecret: async () => undefined,
        onDeleteSecret: async () => undefined
      })
    )
    const javascriptMarkup = renderToStaticMarkup(
      createElement(SchedulePropertiesPanel, {
        draft: { ...draft, runtime: 'javascript' as const },
        secretNames: [],
        onChange: () => undefined,
        onEnabledChange: () => undefined,
        onTriggerChange: () => undefined,
        onTogglePermission: () => undefined,
        onSaveSecret: async () => undefined,
        onDeleteSecret: async () => undefined
      })
    )
    const dailyMarkup = renderToStaticMarkup(
      createElement(SchedulePropertiesPanel, {
        draft: dailyDraft,
        secretNames: [],
        onChange: () => undefined,
        onEnabledChange: () => undefined,
        onTriggerChange: () => undefined,
        onTogglePermission: () => undefined,
        onSaveSecret: async () => undefined,
        onDeleteSecret: async () => undefined
      })
    )

    expect(markup).toContain('data-testid="scheduling-properties-panel"')
    expect(markup).toContain('Automation properties')
    expect(markup).toContain('data-testid="scheduling-property-rows"')
    expect(markup).toContain('data-testid="scheduling-property-runtime"')
    expect(markup).toContain('data-testid="scheduling-runtime-icon-python"')
    expect(markup).toContain('text-[#3776ab]')
    expect(javascriptMarkup).toContain('data-testid="scheduling-runtime-icon-javascript"')
    expect(javascriptMarkup).toContain('text-[#b88600]')
    expect(markup).toContain('data-testid="scheduling-property-frequency"')
    expect(markup).toContain('>Frequency</span>')
    expect(markup).not.toContain('>Run Frequency</span>')
    expect(markup).not.toContain('data-testid="scheduling-property-time"')
    expect(dailyMarkup).toContain('data-testid="scheduling-property-time"')
    expect(dailyMarkup).toContain('data-testid="scheduling-daily-time"')
    expect(dailyMarkup).toContain('data-testid="scheduling-property-timezone"')
    expect(dailyMarkup).toContain('id="scheduling-timezone"')
    expect(dailyMarkup).not.toContain('readonly')
    expect(markup).toContain('data-testid="scheduling-property-enabled"')
    expect(markup).toContain('data-testid="scheduling-property-permissions"')
    expect(markup).toContain('data-testid="scheduling-permissions-trigger"')
    expect(markup).toContain('data-testid="scheduling-manage-secrets"')
    expect(markup).not.toContain('None attached')
    expect(markup).toContain('data-testid="scheduling-property-output"')
    expect(markup).toContain('>Output</span>')
    expect(markup).not.toContain('>Output handling</span>')
    expect(markup).toContain('data-testid="scheduling-output-mode"')
    expect(markup).toContain('grid-cols-[minmax(5.5rem,auto)_minmax(0,1fr)]')
  })

  it('renders automation properties as the only automation right-panel content', () => {
    const markup = renderToStaticMarkup(
      createElement(
        SchedulingWorkspaceProvider,
        {
          enabled: false,
          vaultApi: {} as RendererVaultApi,
          pushToast: () => undefined
        },
        createElement(SchedulingRightPanel, { activeView: 'automation' })
      )
    )

    expect(markup).toContain('data-testid="scheduling-properties-panel"')
    expect(markup).not.toContain('data-testid="scheduling-job-list"')
    expect(markup).not.toContain('data-testid="scheduling-run-history-list"')
  })

  it('renders the history run list as the only history right-panel content', () => {
    const markup = renderToStaticMarkup(
      createElement(
        SchedulingWorkspaceProvider,
        {
          enabled: false,
          vaultApi: {} as RendererVaultApi,
          pushToast: () => undefined
        },
        createElement(SchedulingRightPanel, { activeView: 'history' })
      )
    )

    expect(markup).toContain('data-testid="scheduling-run-history-list"')
    expect(markup).not.toContain('data-testid="scheduling-job-list"')
    expect(markup).not.toContain('data-testid="scheduling-properties-panel"')
  })

  it('renders the scheduling API guide page', () => {
    const markup = renderToStaticMarkup(createElement(SchedulingApiGuidePage))

    expect(markup).toContain('data-testid="scheduling-api-guide-page"')
    expect(markup).toContain('Automation API guide')
    expect(markup).toContain('data-testid="scheduling-api-contract"')
    expect(markup).toContain('beacon.emit')
    expect(markup).toContain('print(json.dumps')
    expect(markup).toContain('calendar.event.create')
  })
})
