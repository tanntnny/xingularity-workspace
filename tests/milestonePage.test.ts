import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ProjectMilestonesPanel } from '../src/renderer/src/components/ProjectMilestonesPanel'
import { MilestonePageContent } from '../src/renderer/src/pages/MilestonePage'
import type { CalendarTask, Project, ProjectMilestone } from '../src/shared/types'

const milestone: ProjectMilestone = {
  id: 'milestone-1',
  title: 'Launch',
  endDate: '2026-08-31',
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z'
}

const project: Project = {
  id: 'project-1',
  name: 'Alpha Project',
  description: '',
  summary: '',
  state: 'active',
  updatedAt: '2026-08-20T00:00:00.000Z',
  icon: { variant: 'filled', color: '#2563eb' },
  milestones: [milestone]
}

const task: CalendarTask = {
  id: 'task-1',
  title: 'Plan launch',
  projectId: project.id,
  milestoneId: milestone.id,
  tags: [],
  completed: true,
  status: 'completed',
  createdAt: '2026-08-20T00:00:00.000Z',
  priority: 'medium',
  reminders: []
}

describe('milestone workspace surfaces', () => {
  it('renders right-panel milestone rows with aligned end-date and progress columns', () => {
    const markup = renderToStaticMarkup(
      createElement(ProjectMilestonesPanel, {
        project,
        tasks: [task],
        onCreateMilestone: () => undefined,
        onOpenMilestone: () => undefined
      })
    )

    expect(markup).toContain('data-testid="project-milestones-panel"')
    expect(markup).toContain('table-fixed')
    expect(markup).toContain('data-testid="project-milestones-table"')
    expect(markup).not.toContain('<thead')
    expect(markup).toContain('data-testid="project-milestone-panel-row:milestone-1"')
    expect(markup).toContain('aria-label="Open milestone: Launch"')
    expect(markup).toContain('data-testid="project-milestone-end-date:milestone-1"')
    expect(markup).toContain('>Aug 31</span>')
    expect(markup).toContain('data-testid="project-milestone-panel-progress-ring:milestone-1"')
    expect(markup).toContain('>100%</span>')
    expect(markup).toContain('aria-label="Add milestone"')
  })

  it('renders the centered milestone dialog content with its task context', () => {
    const markup = renderToStaticMarkup(
      createElement(MilestonePageContent, {
        project,
        milestone,
        tasks: [task],
        endDate: milestone.endDate ?? '',
        dialogTitle: milestone.title,
        onEndDateChange: () => undefined,
        onCreateTask: () => undefined,
        isCreatingTask: false,
        onOpenTask: () => undefined,
        onUpdateTask: () => undefined,
        onDeleteTask: () => undefined
      })
    )

    expect(markup).toContain('data-testid="milestone-page-content"')
    expect(markup).toContain('data-testid="milestone-dialog-context"')
    expect(markup).toContain('data-testid="milestone-dialog-progress-ring"')
    expect(markup).toContain('data-testid="milestone-dialog-end-date-group"')
    expect(markup).toContain('data-testid="milestone-page-task-list"')
    expect(markup).toContain('data-testid="project-task-row:task-1"')
    expect(markup).toContain('data-testid="milestone-page-add-task"')
  })
})
