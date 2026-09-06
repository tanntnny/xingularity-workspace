import { describe, expect, it, vi } from 'vitest'
import {
  handleCommandEnterAction,
  handleCommandEnterSubmit,
  isCommandEnterShortcut,
  type CommandEnterKeyState
} from '../src/renderer/src/lib/formShortcuts'

const keyState = (overrides: Partial<CommandEnterKeyState> = {}): CommandEnterKeyState => ({
  key: 'Enter',
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  isComposing: false,
  ...overrides
})

const keyboardEvent = (overrides: Partial<CommandEnterKeyState> = {}): Record<string, unknown> => ({
  ...keyState(overrides),
  nativeEvent: { isComposing: overrides.isComposing ?? false },
  preventDefault: vi.fn(),
  stopPropagation: vi.fn()
})

describe('form keyboard shortcuts', () => {
  it('recognizes Command and Control Enter without consuming modified variants', () => {
    expect(isCommandEnterShortcut(keyState({ metaKey: true }))).toBe(true)
    expect(isCommandEnterShortcut(keyState({ ctrlKey: true }))).toBe(true)
    expect(isCommandEnterShortcut(keyState())).toBe(false)
    expect(isCommandEnterShortcut(keyState({ metaKey: true, shiftKey: true }))).toBe(false)
    expect(isCommandEnterShortcut(keyState({ ctrlKey: true, altKey: true }))).toBe(false)
    expect(isCommandEnterShortcut(keyState({ metaKey: true, isComposing: true }))).toBe(false)
  })

  it('submits a form through its enabled submitter', () => {
    const submitter = { disabled: false }
    const requestSubmit = vi.fn()
    const event = {
      ...keyboardEvent({ metaKey: true }),
      currentTarget: {
        querySelectorAll: () => [submitter],
        querySelector: () => submitter,
        requestSubmit
      }
    } as unknown as React.KeyboardEvent<HTMLFormElement>

    handleCommandEnterSubmit(event)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(event.stopPropagation).toHaveBeenCalledOnce()
    expect(requestSubmit).toHaveBeenCalledWith(submitter)
  })

  it('does not submit when every submitter is disabled', () => {
    const submitter = { disabled: true }
    const requestSubmit = vi.fn()
    const event = {
      ...keyboardEvent({ ctrlKey: true }),
      currentTarget: {
        querySelectorAll: () => [submitter],
        querySelector: () => submitter,
        requestSubmit
      }
    } as unknown as React.KeyboardEvent<HTMLFormElement>

    handleCommandEnterSubmit(event)

    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(event.stopPropagation).not.toHaveBeenCalled()
    expect(requestSubmit).not.toHaveBeenCalled()
  })

  it('runs an action for a non-form editor surface', () => {
    const action = vi.fn()
    const event = keyboardEvent({ metaKey: true }) as unknown as React.KeyboardEvent<HTMLElement>

    handleCommandEnterAction(event, action)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(event.stopPropagation).toHaveBeenCalledOnce()
    expect(action).toHaveBeenCalledOnce()
  })
})
