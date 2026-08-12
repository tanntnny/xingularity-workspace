import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ScheduleEditor } from '../src/renderer/src/components/scheduling/ScheduleEditor'
import { SchedulingViewTabs } from '../src/renderer/src/components/scheduling/SchedulingViewTabs'
import {
  SchedulingPage,
  SchedulingWorkspaceProvider
} from '../src/renderer/src/pages/SchedulingPage'
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
  activeView: 'automation' | 'history'
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
  })

  it('renders the history view without the automation editor', () => {
    const markup = renderToStaticMarkup(
      createElement(SchedulingContentTest, { activeView: 'history' })
    )

    expect(markup).toContain('data-testid="scheduling-run-history"')
    expect(markup).not.toContain('data-testid="scheduling-editor"')
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
    expect(markup).toContain('>Automation</button>')
    expect(markup).toContain('>History</button>')
    expect(markup).toContain('aria-selected="true"')
  })

  it('keeps Add task and Add note as explicit editor actions', () => {
    const markup = renderToStaticMarkup(
      createElement(ScheduleEditor, {
        draft,
        isNew: true,
        isDirty: false,
        isSaving: false,
        isRunning: false,
        onChange: () => undefined,
        onEnabledChange: () => undefined,
        onTriggerChange: () => undefined,
        onTogglePermission: () => undefined,
        onInsertTemplate: () => undefined,
        onSave: () => undefined,
        onRun: () => undefined,
        onDelete: () => undefined
      })
    )

    expect(markup).toContain('data-testid="scheduling-add-task-template"')
    expect(markup).toContain('>Add task</button>')
    expect(markup).toContain('data-testid="scheduling-add-note-template"')
    expect(markup).toContain('>Add note</button>')
    expect(markup).toContain('Review before apply')
  })
})
