import { describe, expect, it } from 'vitest'
import {
  createAppErrorEvent,
  formatAppErrorDetails,
  formatAppErrorSource,
  mergeAppErrorStacks,
  normalizeAppError
} from '../src/shared/appErrors'

describe('app error helpers', () => {
  it('normalizes Error instances with stack traces', () => {
    const error = new Error('boom')
    error.stack = 'Error: boom\n    at test'

    expect(normalizeAppError(error)).toEqual({
      message: 'boom',
      stack: 'Error: boom\n    at test'
    })
  })

  it('serializes unknown values into readable messages', () => {
    expect(normalizeAppError({ reason: 'bad input' })).toEqual({
      message: '{"reason":"bad input"}'
    })
    expect(createAppErrorEvent('renderer', 'fatal message')).toEqual({
      source: 'renderer',
      message: 'fatal message',
      stack: undefined,
      channel: undefined
    })
  })

  it('merges stack sections and formats details for display', () => {
    const event = createAppErrorEvent('ipc', new Error('Save failed'), {
      channel: 'files:write-note',
      stack: mergeAppErrorStacks('Error: Save failed', 'Component stack')
    })

    expect(formatAppErrorSource(event.source)).toBe('IPC')
    expect(formatAppErrorDetails(event)).toBe(
      [
        'Source: IPC',
        'Channel: files:write-note',
        'Message: Save failed',
        '',
        'Error: Save failed',
        '',
        'Component stack'
      ].join('\n')
    )
  })
})
