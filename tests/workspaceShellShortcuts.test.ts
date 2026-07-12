import { describe, expect, it, vi } from 'vitest'
import {
  dispatchWorkspaceShellShortcut,
  type WorkspaceShellShortcutBindings
} from '../src/renderer/src/hooks/useWorkspaceShellShortcuts'

function createBindings(
  overrides: Partial<WorkspaceShellShortcutBindings> = {}
): WorkspaceShellShortcutBindings {
  return {
    enabled: true,
    hasRightPanel: true,
    activePage: 'notes',
    onOpenSearchPalette: vi.fn(),
    onOpenCommandPalette: vi.fn(),
    onToggleRightPanel: vi.fn(),
    onToggleFocusMode: vi.fn(),
    onRunUndo: vi.fn(),
    onRunRedo: vi.fn(),
    onToggleProjectsView: vi.fn(),
    onToggleCalendarView: vi.fn(),
    onNavigateToPage: vi.fn(),
    isPageAvailable: () => true,
    isTypingTarget: () => false,
    ...overrides
  }
}

function createEvent(overrides: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key: '',
    code: '',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    target: null,
    preventDefault: vi.fn(),
    ...overrides
  } as KeyboardEvent
}

describe('dispatchWorkspaceShellShortcut', () => {
  it('navigates to notebooks for Cmd+1', () => {
    const bindings = createBindings()
    const event = createEvent({ key: '1', code: 'Digit1', metaKey: true })

    const handled = dispatchWorkspaceShellShortcut(event, bindings)

    expect(handled).toBe(true)
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(bindings.onNavigateToPage).toHaveBeenCalledWith('notes')
  })

  it('navigates to weekly plan for Cmd+4', () => {
    const bindings = createBindings()
    const event = createEvent({ key: '4', code: 'Digit4', metaKey: true })

    const handled = dispatchWorkspaceShellShortcut(event, bindings)

    expect(handled).toBe(true)
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(bindings.onNavigateToPage).toHaveBeenCalledWith('weeklyPlan')
  })

  it('toggles the projects view for Option+Tab on the projects page', () => {
    const bindings = createBindings({ activePage: 'projects' })
    const event = createEvent({ key: 'Tab', code: 'Tab', altKey: true })

    const handled = dispatchWorkspaceShellShortcut(event, bindings)

    expect(handled).toBe(true)
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(bindings.onToggleProjectsView).toHaveBeenCalledOnce()
    expect(bindings.onToggleCalendarView).not.toHaveBeenCalled()
  })

  it('toggles the calendar view for Option+Tab on the calendar page', () => {
    const bindings = createBindings({ activePage: 'calendar' })
    const event = createEvent({ key: 'Tab', code: 'Tab', altKey: true })

    const handled = dispatchWorkspaceShellShortcut(event, bindings)

    expect(handled).toBe(true)
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(bindings.onToggleCalendarView).toHaveBeenCalledOnce()
    expect(bindings.onToggleProjectsView).not.toHaveBeenCalled()
  })

  it('does not consume Option+Tab on unrelated pages', () => {
    const bindings = createBindings({ activePage: 'notes' })
    const event = createEvent({ key: 'Tab', code: 'Tab', altKey: true })

    const handled = dispatchWorkspaceShellShortcut(event, bindings)

    expect(handled).toBe(false)
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(bindings.onToggleProjectsView).not.toHaveBeenCalled()
    expect(bindings.onToggleCalendarView).not.toHaveBeenCalled()
  })

  it('does not navigate pages while typing in an editable target', () => {
    const typingTarget = { kind: 'input' }
    const bindings = createBindings({
      isTypingTarget: (target) => target === typingTarget
    })
    const event = createEvent({
      key: '2',
      code: 'Digit2',
      metaKey: true,
      target: typingTarget as EventTarget
    })

    const handled = dispatchWorkspaceShellShortcut(event, bindings)

    expect(handled).toBe(false)
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(bindings.onNavigateToPage).not.toHaveBeenCalled()
  })
})
