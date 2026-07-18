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
  onCreateWorkspaceTab: () => void
  onCloseActiveWorkspaceTab: () => void
  onSelectWorkspaceTab: (index: number) => void
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
    onCreateWorkspaceTab,
    onCloseActiveWorkspaceTab,
    onSelectWorkspaceTab,
    onNavigateToPage,
    isPageAvailable,
    isTypingTarget
  }: WorkspaceShellShortcutBindings
): boolean {
  const isModifierPressed = event.metaKey || event.ctrlKey
  const isCloseWorkspaceTab =
    isModifierPressed && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'w'
  if (isCloseWorkspaceTab) {
    event.preventDefault()
    onCloseActiveWorkspaceTab()
    return true
  }

  if (!enabled) {
    return false
  }

  const isCreateWorkspaceTab =
    isModifierPressed && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 't'
  if (isCreateWorkspaceTab) {
    event.preventDefault()
    onCreateWorkspaceTab()
    return true
  }

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

  const tabNumber =
    !event.altKey && !event.shiftKey && /^Digit[1-9]$/.test(event.code)
      ? Number(event.code.slice(-1))
      : null
  if (tabNumber !== null) {
    event.preventDefault()
    onSelectWorkspaceTab(tabNumber - 1)
    return true
  }

  const pageByCode: Partial<Record<string, string>> = {
    KeyI: 'agentHistory',
    Comma: 'settings'
  }
  const pageByKey: Partial<Record<string, string>> = {
    i: 'agentHistory',
    ',': 'settings'
  }
  const normalizedKey = event.key.length === 1 ? event.key.toLowerCase() : event.key
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
  onCreateWorkspaceTab,
  onCloseActiveWorkspaceTab,
  onSelectWorkspaceTab,
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
        onCreateWorkspaceTab,
        onCloseActiveWorkspaceTab,
        onSelectWorkspaceTab,
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
    onCloseActiveWorkspaceTab,
    onCreateWorkspaceTab,
    onToggleFocusMode,
    onToggleProjectsView,
    onToggleRightPanel,
    onSelectWorkspaceTab
  ])
}
