import { describe, expect, it } from 'vitest'
import type { CalendarTask } from '../src/shared/types'
import { duplicateTaskRecord } from '../src/shared/taskDuplication'

const sourceTask: CalendarTask = {
  id: 'task-source',
  title: 'Prepare launch plan',
  description: 'Write the launch checklist',
  projectId: 'project-1',
  milestoneId: 'milestone-1',
  tags: ['launch', 'planning'],
  date: '2026-09-08',
  endDate: '2026-09-09',
  completed: true,
  status: 'completed',
  createdAt: '2026-09-01T09:00:00.000Z',
  priority: 'high',
  taskType: 'assignment',
  reminders: [{ id: 'reminder-source', type: 'hours', value: 2, enabled: true }],
  time: '10:00',
  endTime: '11:30',
  weeklyHeightMode: 'duration',
  automationSource: 'schedule',
  automationSourceKey: 'schedule-1',
  updatedAt: '2026-09-02T09:00:00.000Z',
  dependencyIds: ['task-dependency'],
  parentTaskId: 'task-parent',
  estimateMinutes: 90
}

describe('duplicateTaskRecord', () => {
  it('creates a fresh actionable copy without mutating the source', () => {
    const duplicate = duplicateTaskRecord(sourceTask, {
      id: 'task-copy',
      now: '2026-09-05T12:00:00.000Z',
      reminderId: () => 'reminder-copy'
    })

    expect(duplicate).toMatchObject({
      id: 'task-copy',
      title: 'Prepare launch plan (copy)',
      description: sourceTask.description,
      projectId: sourceTask.projectId,
      milestoneId: sourceTask.milestoneId,
      tags: sourceTask.tags,
      date: sourceTask.date,
      endDate: sourceTask.endDate,
      time: sourceTask.time,
      endTime: sourceTask.endTime,
      weeklyHeightMode: sourceTask.weeklyHeightMode,
      priority: sourceTask.priority,
      taskType: sourceTask.taskType,
      dependencyIds: sourceTask.dependencyIds,
      parentTaskId: sourceTask.parentTaskId,
      estimateMinutes: sourceTask.estimateMinutes,
      completed: false,
      status: 'pending',
      createdAt: '2026-09-05T12:00:00.000Z',
      updatedAt: '2026-09-05T12:00:00.000Z'
    })
    expect(duplicate.automationSource).toBeUndefined()
    expect(duplicate.automationSourceKey).toBeUndefined()
    expect(duplicate.reminders).toEqual([
      { id: 'reminder-copy', type: 'hours', value: 2, enabled: true }
    ])
    expect(duplicate.tags).not.toBe(sourceTask.tags)
    expect(duplicate.reminders).not.toBe(sourceTask.reminders)
    expect(duplicate.dependencyIds).not.toBe(sourceTask.dependencyIds)
    expect(sourceTask.completed).toBe(true)
    expect(sourceTask.status).toBe('completed')
  })

  it('replaces the complete schedule when a schedule override is supplied', () => {
    const duplicate = duplicateTaskRecord(sourceTask, {
      id: 'task-copy',
      now: '2026-09-05T12:00:00.000Z',
      schedule: {
        date: '2026-09-12',
        endDate: null,
        time: '14:00',
        endTime: '15:00',
        weeklyHeightMode: null
      }
    })

    expect(duplicate.date).toBe('2026-09-12')
    expect(duplicate.endDate).toBeUndefined()
    expect(duplicate.time).toBe('14:00')
    expect(duplicate.endTime).toBe('15:00')
    expect(duplicate.weeklyHeightMode).toBeUndefined()
  })

  it('creates an unscheduled copy from an empty schedule override', () => {
    const duplicate = duplicateTaskRecord(sourceTask, {
      id: 'task-copy',
      now: '2026-09-05T12:00:00.000Z',
      schedule: {}
    })

    expect(duplicate.date).toBeUndefined()
    expect(duplicate.endDate).toBeUndefined()
    expect(duplicate.time).toBeUndefined()
    expect(duplicate.endTime).toBeUndefined()
    expect(duplicate.weeklyHeightMode).toBeUndefined()
  })
})
