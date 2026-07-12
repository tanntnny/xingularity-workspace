import { useEffect } from 'react'

export interface WorkspaceShellShortcutBindings {
  enabled: boolean
  hasRightPanel: boolean
  activePage: string
  onOpenSearchPalette: () => void
  onOpenCommandPalette: () => void
  onToggleRightPanel: () => void
  onToggleFocusMode: () => void
  onRunUndo: () => void
  onRunRedo: () => void
  onToggleProjectsView: () => void
  onToggleCalendarView: () => void
  onNavigateToPage: (page: string) => void
  isPageAvailable: (page: string) => boolean
  isTypingTarget: (target: EventTarget | null) => boolean
}

type WorkspaceShellShortcutEvent = Pick<
  KeyboardEvent,
  'altKey' | 'code' | 'ctrlKey' | 'key' | 'metaKey' | 'preventDefault' | 'shiftKey' | 'target'
>

export function dispatchWorkspaceShellShortcut(
  event: WorkspaceShellShortcutEvent,
  {
    enabled,
    hasRightPanel,
    activePage,
    onOpenSearchPalette,
    onOpenCommandPalette,
    onToggleRightPanel,
    onToggleFocusMode,
    onRunUndo,
    onRunRedo,
    onToggleProjectsView,
    onToggleCalendarView,
    onNavigateToPage,
    isPageAvailable,
    isTypingTarget
  }: WorkspaceShellShortcutBindings
): boolean {
  if (!enabled) {
    return false
  }

  const isModifierPressed = event.metaKey || event.ctrlKey
  const isSearchPalette = isModifierPressed && !event.shiftKey && event.key.toLowerCase() === 'p'
  if (isSearchPalette) {
    event.preventDefault()
    onOpenSearchPalette()
    return true
  }

  const isCommandPalette = isModifierPressed && event.shiftKey && event.key.toLowerCase() === 'p'
  if (isCommandPalette) {
    event.preventDefault()
    onOpenCommandPalette()
    return true
  }

  const isRightPanelShortcut = event.altKey && event.key.toLowerCase() === 'b'
  if (isRightPanelShortcut) {
    if (!hasRightPanel) {
      return false
    }
    event.preventDefault()
    onToggleRightPanel()
    return true
  }

  const typingTarget = isTypingTarget(event.target)
  const isViewToggleShortcut =
    event.altKey &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    (event.key === 'Tab' || event.code === 'Tab')

  if (isViewToggleShortcut) {
    if (typingTarget) {
      return false
    }

    if (activePage === 'projects') {
      event.preventDefault()
      onToggleProjectsView()
      return true
    }

    if (activePage === 'calendar') {
      event.preventDefault()
      onToggleCalendarView()
      return true
    }

    return false
  }

  if (!isModifierPressed) {
    return false
  }

  const isFocusModeShortcut = !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'f'

  if (isFocusModeShortcut) {
    event.preventDefault()
    onToggleFocusMode()
    return true
  }

  const isUndoShortcut = !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'z'
  const isRedoShortcut = !event.altKey && event.shiftKey && event.key.toLowerCase() === 'z'

  if ((isUndoShortcut || isRedoShortcut) && !typingTarget) {
    event.preventDefault()
    if (isUndoShortcut) {
      onRunUndo()
    } else {
      onRunRedo()
    }
    return true
  }

  const normalizedKey = event.key.length === 1 ? event.key.toLowerCase() : event.key
  const pageByCode: Partial<Record<string, string>> = {
    Digit1: 'notes',
    Digit2: 'projects',
    Digit3: 'calendar',
    Digit4: 'weeklyPlan',
    Digit5: 'schedules',
    KeyI: 'agentHistory',
    Comma: 'settings'
  }
  const pageByKey: Partial<Record<string, string>> = {
    '1': 'notes',
    '2': 'projects',
    '3': 'calendar',
    '4': 'weeklyPlan',
    '5': 'schedules',
    i: 'agentHistory',
    ',': 'settings'
  }
  const nextPage = pageByKey[normalizedKey] ?? pageByCode[event.code]
  if (nextPage && isPageAvailable(nextPage) && !typingTarget) {
    event.preventDefault()
    onNavigateToPage(nextPage)
    return true
  }

  return false
}

export function useWorkspaceShellShortcuts({
  enabled,
  hasRightPanel,
  activePage,
  onOpenSearchPalette,
  onOpenCommandPalette,
  onToggleRightPanel,
  onToggleFocusMode,
  onRunUndo,
  onRunRedo,
  onToggleProjectsView,
  onToggleCalendarView,
  onNavigateToPage,
  isPageAvailable,
  isTypingTarget
}: WorkspaceShellShortcutBindings): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      dispatchWorkspaceShellShortcut(event, {
        enabled,
        hasRightPanel,
        activePage,
        onOpenSearchPalette,
        onOpenCommandPalette,
        onToggleRightPanel,
        onToggleFocusMode,
        onRunUndo,
        onRunRedo,
        onToggleProjectsView,
        onToggleCalendarView,
        onNavigateToPage,
        isPageAvailable,
        isTypingTarget
      })
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [
    activePage,
    enabled,
    hasRightPanel,
    isPageAvailable,
    isTypingTarget,
    onNavigateToPage,
    onOpenCommandPalette,
    onOpenSearchPalette,
    onRunRedo,
    onRunUndo,
    onToggleCalendarView,
    onToggleFocusMode,
    onToggleProjectsView,
    onToggleRightPanel
  ])
}
