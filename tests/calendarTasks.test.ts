import { describe, expect, it } from 'vitest'
import { CalendarTask, Project } from '../src/shared/types'
import {
  buildCalendarEvents,
  buildMilestoneCalendarEvents,
  buildWeeklyCalendarEntries,
  layoutWeeklyAllDayItems,
  normalizeCalendarTasks
} from '../src/renderer/src/lib/calendarTasks'

function makeTask(overrides: Partial<CalendarTask> = {}): CalendarTask {
  return {
    id: 'task-1',
    title: 'Task',
    completed: false,
    createdAt: '2026-03-17T00:00:00.000Z',
    priority: 'medium',
    reminders: [],
    ...overrides
  }
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    name: 'Project',
    summary: '',
    status: 'on-track',
    updatedAt: '2026-03-17T00:00:00.000Z',
    progress: 0,
    milestones: [],
    icon: {
      shape: 'circle',
      variant: 'filled',
      color: '#000000'
    },
    ...overrides
  }
}

describe('normalizeCalendarTasks', () => {
  it('collapses duplicate ids and keeps the latest task data', () => {
    const tasks = normalizeCalendarTasks([
      makeTask({ id: 'task-a', title: 'Old title', date: '2026-03-17' }),
      makeTask({ id: 'task-b', title: 'Other task', date: '2026-03-18' }),
      makeTask({ id: 'task-a', title: 'New title', date: '2026-03-19' })
    ])

    expect(tasks).toHaveLength(2)
    expect(tasks.map((task) => task.id)).toEqual(['task-a', 'task-b'])
    expect(tasks[0]).toMatchObject({
      id: 'task-a',
      title: 'New title',
      date: '2026-03-19'
    })
  })

  it('preserves first-seen ordering while removing duplicates', () => {
    const tasks = normalizeCalendarTasks([
      makeTask({ id: 'task-a', title: 'A-1' }),
      makeTask({ id: 'task-b', title: 'B-1' }),
      makeTask({ id: 'task-a', title: 'A-2' }),
      makeTask({ id: 'task-c', title: 'C-1' }),
      makeTask({ id: 'task-b', title: 'B-2' })
    ])

    expect(tasks.map((task) => `${task.id}:${task.title}`)).toEqual([
      'task-a:A-2',
      'task-b:B-2',
      'task-c:C-1'
    ])
  })
})

describe('buildCalendarEvents', () => {
  it('returns one scheduled event per unique task id', () => {
    const events = buildCalendarEvents([
      makeTask({ id: 'task-a', title: 'Draft', date: '2026-03-17' }),
      makeTask({ id: 'task-a', title: 'Final', date: '2026-03-18' }),
      makeTask({ id: 'task-b', title: 'Multi-day', date: '2026-03-20', endDate: '2026-03-22' }),
      makeTask({ id: 'task-c', title: 'Unscheduled' })
    ])

    expect(events).toEqual([
      {
        id: 'task-a',
        title: 'Final',
        start: '2026-03-18',
        end: undefined,
        allDay: true,
        extendedProps: {
          source: 'task',
          taskId: 'task-a',
          taskType: undefined,
          priority: 'medium'
        }
      },
      {
        id: 'task-b',
        title: 'Multi-day',
        start: '2026-03-20',
        end: '2026-03-23',
        allDay: true,
        extendedProps: {
          source: 'task',
          taskId: 'task-b',
          taskType: undefined,
          priority: 'medium'
        }
      }
    ])
  })
})

describe('buildMilestoneCalendarEvents', () => {
  it('builds read-only calendar events from milestone due dates', () => {
    const events = buildMilestoneCalendarEvents([
      makeProject({
        id: 'project-alpha',
        milestones: [
          {
            id: 'milestone-a',
            title: 'Alpha launch',
            dueDate: '2026-04-02',
            description: '',
            collapsed: false,
            priority: 'medium',
            status: 'pending',
            subtasks: []
          }
        ]
      })
    ])

    expect(events).toEqual([
      {
        id: 'calendar-milestone:project-alpha:milestone-a',
        title: 'Alpha launch',
        start: '2026-04-02',
        allDay: true,
        editable: true,
        startEditable: true,
        durationEditable: false,
        extendedProps: {
          source: 'milestone',
          projectId: 'project-alpha',
          projectName: 'Project',
          projectIcon: {
            shape: 'circle',
            variant: 'filled',
            color: '#000000'
          },
          milestoneId: 'milestone-a',
          milestoneDescription: '',
          milestoneDueDate: '2026-04-02',
          milestoneStatus: 'pending',
          milestoneCompletedSubtaskCount: 0,
          milestoneSubtaskCount: 0,
          milestoneProgressPercent: 0,
          completed: false
        }
      }
    ])
  })

  it('uses a namespaced id distinct from normal task ids', () => {
    const taskEvents = buildCalendarEvents([
      makeTask({
        id: 'task-a',
        title: 'Normal task',
        date: '2026-04-02'
      })
    ])
    const milestoneEvents = buildMilestoneCalendarEvents([
      makeProject({
        id: 'project-alpha',
        milestones: [
          {
            id: 'milestone-a',
            title: 'Alpha launch',
            dueDate: '2026-04-02',
            description: '',
            collapsed: false,
            priority: 'medium',
            status: 'pending',
            subtasks: []
          }
        ]
      })
    ])

    expect(taskEvents[0].id).not.toEqual(milestoneEvents[0].id)
  })

  it('skips milestones without a due date', () => {
    const events = buildMilestoneCalendarEvents([
      makeProject({
        id: 'project-alpha',
        milestones: [
          {
            id: 'milestone-a',
            title: 'Alpha launch',
            description: '',
            collapsed: false,
            priority: 'medium',
            status: 'pending',
            subtasks: []
          }
        ]
      })
    ])

    expect(events).toEqual([])
  })
})

describe('buildWeeklyCalendarEntries', () => {
  it('maps single-day timed tasks into timed weekly entries', () => {
    const { timedTasks, allDayItems } = buildWeeklyCalendarEntries(
      [
        makeTask({
          id: 'task-timed',
          title: 'Standup',
          date: '2026-04-14',
          time: '09:30',
          endTime: '10:15'
        })
      ],
      '2026-04-12'
    )

    expect(timedTasks).toEqual([
      {
        task: makeTask({
          id: 'task-timed',
          title: 'Standup',
          date: '2026-04-14',
          time: '09:30',
          endTime: '10:15'
        }),
        date: '2026-04-14',
        startMinutes: 570,
        durationMinutes: 45
      }
    ])
    expect(allDayItems).toEqual([])
  })

  it('defaults timed tasks without an end time to one hour', () => {
    const { timedTasks } = buildWeeklyCalendarEntries(
      [
        makeTask({
          id: 'task-timed',
          title: 'Check-in',
          date: '2026-04-14',
          time: '13:00'
        })
      ],
      '2026-04-12'
    )

    expect(timedTasks[0]).toMatchObject({
      date: '2026-04-14',
      startMinutes: 780,
      durationMinutes: 60
    })
  })

  it('keeps untimed and multi-day tasks as single weekly all-day spans', () => {
    const { timedTasks, allDayItems } = buildWeeklyCalendarEntries(
      [
        makeTask({
          id: 'task-untimed',
          title: 'Inbox clean-up',
          date: '2026-04-14'
        }),
        makeTask({
          id: 'task-span',
          title: 'Offsite',
          date: '2026-04-13',
          endDate: '2026-04-15',
          time: '09:00',
          endTime: '17:00'
        })
      ],
      '2026-04-12'
    )

    expect(timedTasks).toEqual([])
    expect(
      allDayItems.map((item) => `${item.source}:${item.startDate}:${item.endDate}:${item.title}`)
    ).toEqual(['task:2026-04-13:2026-04-15:Offsite', 'task:2026-04-14:2026-04-14:Inbox clean-up'])
  })

  it('includes milestone events in the weekly all-day collection', () => {
    const milestoneEvents = buildMilestoneCalendarEvents([
      makeProject({
        id: 'project-alpha',
        milestones: [
          {
            id: 'milestone-a',
            title: 'Launch',
            dueDate: '2026-04-16',
            description: '',
            collapsed: false,
            priority: 'medium',
            status: 'pending',
            subtasks: []
          }
        ]
      })
    ])

    const { allDayItems } = buildWeeklyCalendarEntries([], '2026-04-12', milestoneEvents)

    expect(allDayItems).toEqual([
      {
        id: 'calendar-milestone:project-alpha:milestone-a:2026-04-16',
        source: 'milestone',
        startDate: '2026-04-16',
        endDate: '2026-04-16',
        title: 'Launch',
        projectId: 'project-alpha',
        projectName: 'Project',
        projectIcon: {
          shape: 'circle',
          variant: 'filled',
          color: '#000000'
        },
        milestoneId: 'milestone-a',
        milestoneDescription: '',
        milestoneDueDate: '2026-04-16',
        milestoneStatus: 'pending',
        milestoneCompletedSubtaskCount: 0,
        milestoneSubtaskCount: 0,
        milestoneProgressPercent: 0,
        completed: false
      }
    ])
  })
})

describe('layoutWeeklyAllDayItems', () => {
  it('packs a continuous multi-day task into a single spanning row', () => {
    const layouts = layoutWeeklyAllDayItems(
      [
        {
          id: 'task-span',
          source: 'task',
          startDate: '2026-07-06',
          endDate: '2026-07-07',
          title: 'Trip'
        },
        {
          id: 'task-single',
          source: 'task',
          startDate: '2026-07-06',
          endDate: '2026-07-06',
          title: 'Prep'
        }
      ],
      '2026-07-05'
    )

    expect(layouts).toEqual([
      expect.objectContaining({
        id: 'task-span',
        row: 0,
        columnStart: 1,
        columnSpan: 2
      }),
      expect.objectContaining({
        id: 'task-single',
        row: 1,
        columnStart: 1,
        columnSpan: 1
      })
    ])
  })
})
