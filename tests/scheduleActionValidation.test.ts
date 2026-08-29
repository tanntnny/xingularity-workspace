import { describe, expect, it } from 'vitest'
import { parseScriptActions } from '../src/main/scheduleActionValidation'

describe('schedule task date validation', () => {
  it('accepts an end-date-only task.create action', () => {
    const result = parseScriptActions([
      {
        type: 'task.create',
        title: 'Submit report',
        endDate: '2026-08-20',
        automationSource: 'test',
        automationSourceKey: 'deadline-only'
      }
    ])

    expect(result.error).toBeUndefined()
    expect(result.actions[0]).toMatchObject({
      type: 'task.create',
      endDate: '2026-08-20'
    })
  })

  it('accepts task.update endDate changes and clearing', () => {
    const result = parseScriptActions([
      {
        type: 'task.update',
        endDate: null,
        automationSource: 'test',
        automationSourceKey: 'deadline-only'
      }
    ])

    expect(result.error).toBeUndefined()
    expect(result.actions[0]).toMatchObject({ endDate: null })
  })

  it('accepts task endTime changes and clearing', () => {
    const result = parseScriptActions([
      {
        type: 'task.create',
        title: 'Submit report',
        endTime: '23:59',
        automationSource: 'test',
        automationSourceKey: 'deadline-time'
      },
      {
        type: 'task.update',
        endTime: null,
        automationSource: 'test',
        automationSourceKey: 'deadline-time'
      }
    ])

    expect(result.error).toBeUndefined()
    expect(result.actions).toMatchObject([
      { type: 'task.create', endTime: '23:59' },
      { type: 'task.update', endTime: null }
    ])
  })
})
