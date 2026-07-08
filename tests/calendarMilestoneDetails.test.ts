import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  CalendarMilestoneCard,
  type CalendarMilestoneDetails
} from '../src/renderer/src/components/CalendarMilestoneDetails'

function makeMilestone(
  overrides: Partial<CalendarMilestoneDetails> = {}
): CalendarMilestoneDetails {
  return {
    title: 'Launch',
    projectId: 'project-alpha',
    projectName: 'Alpha Project',
    projectIcon: {
      shape: 'circle',
      variant: 'filled',
      color: '#000000'
    },
    milestoneId: 'milestone-launch',
    milestoneDescription: 'Ship the release candidate',
    milestoneDueDate: '2026-07-08',
    milestoneStatus: 'in-progress',
    completed: false,
    ...overrides
  }
}

describe('CalendarMilestoneCard', () => {
  it('renders the milestone title before the project metadata row', () => {
    const markup = renderToStaticMarkup(
      createElement(CalendarMilestoneCard, {
        milestone: makeMilestone()
      })
    )

    expect(markup).toContain('data-testid="calendar-milestone-card"')
    expect(markup).toContain('Launch')
    expect(markup).toContain('data-testid="calendar-milestone-project"')
    expect(markup).toContain('Alpha Project')
    expect(markup).toContain('data-testid="calendar-milestone-progress"')
    expect(markup).toContain('0% complete')
    expect(markup.indexOf('Launch')).toBeLessThan(markup.indexOf('Alpha Project'))
  })
})
