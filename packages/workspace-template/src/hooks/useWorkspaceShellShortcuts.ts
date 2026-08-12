import { useEffect } from 'react'

function isWorkspaceShortcutOverlayTarget(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) {
    return false
  }

  return Boolean(target.closest('[role="dialog"], [aria-modal="true"]'))
}

export interface WorkspaceShellShortcutBindings {
  enabled: boolean
  hasRightPanel: boolean
  onOpenSearchPalette: () => void
  onOpenCommandPalette: () => void
  onToggleRightPanel: () => void
  onToggleFocusMode: () => void
  onRunUndo: () => void
  onRunRedo: () => void
  onNavigateToPage: (page: string) => void
  isPageAvailable: (page: string) => boolean
  isTypingTarget: (target: EventTarget | null) => boolean
}

export function useWorkspaceShellShortcuts({
  enabled,
  hasRightPanel,
  onOpenSearchPalette,
  onOpenCommandPalette,
  onToggleRightPanel,
  onToggleFocusMode,
  onRunUndo,
  onRunRedo,
  onNavigateToPage,
  isPageAvailable,
  isTypingTarget
}: WorkspaceShellShortcutBindings): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!enabled) {
        return
      }

      const isModifierPressed = event.metaKey || event.ctrlKey
      const isSearchPalette =
        isModifierPressed && !event.shiftKey && event.key.toLowerCase() === 'p'
      if (isSearchPalette) {
        event.preventDefault()
        onOpenSearchPalette()
        return
      }

      const isCommandPalette =
        isModifierPressed && event.shiftKey && event.key.toLowerCase() === 'p'
      if (isCommandPalette) {
        event.preventDefault()
        onOpenCommandPalette()
        return
      }

      const typingTarget = isTypingTarget(event.target)
      const isRightPanelShortcut =
        event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'b'
      if (isRightPanelShortcut) {
        if (!hasRightPanel || typingTarget || isWorkspaceShortcutOverlayTarget(event.target)) {
          return
        }
        event.preventDefault()
        onToggleRightPanel()
        return
      }

      if (!isModifierPressed) {
        return
      }

      const isFocusModeShortcut =
        !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'f'

      if (isFocusModeShortcut) {
        event.preventDefault()
        onToggleFocusMode()
        return
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
        return
      }

      const normalizedKey = event.key.length === 1 ? event.key.toLowerCase() : event.key
      const pageByCode: Partial<Record<string, string>> = {
        Digit1: 'notes',
        Digit2: 'projects',
        Digit3: 'calendar',
        Digit4: 'schedules',
        KeyI: 'agentHistory',
        Comma: 'settings'
      }
      const pageByKey: Partial<Record<string, string>> = {
        '1': 'notes',
        '2': 'projects',
        '3': 'calendar',
        '4': 'schedules',
        i: 'agentHistory',
        ',': 'settings'
      }
      const nextPage = pageByKey[normalizedKey] ?? pageByCode[event.code]
      if (nextPage && isPageAvailable(nextPage)) {
        event.preventDefault()
        onNavigateToPage(nextPage)
      }
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [
    enabled,
    hasRightPanel,
    isPageAvailable,
    isTypingTarget,
    onNavigateToPage,
    onOpenCommandPalette,
    onOpenSearchPalette,
    onRunRedo,
    onRunUndo,
    onToggleFocusMode,
    onToggleRightPanel
  ])
}
