import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

export const COMMAND_ENTER_ARIA_KEYSHORTCUT = 'Meta+Enter Control+Enter'

export interface CommandEnterKeyState {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  isComposing?: boolean
}

export function isCommandEnterShortcut(event: CommandEnterKeyState): boolean {
  return (
    event.key === 'Enter' &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    !event.isComposing
  )
}

function isCommandEnterEvent(event: ReactKeyboardEvent<HTMLElement>): boolean {
  return isCommandEnterShortcut({
    key: event.key,
    metaKey: event.metaKey,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    isComposing: event.nativeEvent.isComposing
  })
}

function getEnabledSubmitter(form: HTMLFormElement): HTMLButtonElement | HTMLInputElement | null {
  const submitters = Array.from(
    form.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
      'button:not([type]), button[type="submit"], input[type="submit"]'
    )
  )

  if (submitters.length === 0) {
    return null
  }

  return submitters.find((submitter) => !submitter.disabled) ?? null
}

export function handleCommandEnterSubmit(event: ReactKeyboardEvent<HTMLFormElement>): void {
  if (!isCommandEnterEvent(event)) {
    return
  }

  const submitter = getEnabledSubmitter(event.currentTarget)
  const hasSubmitter = event.currentTarget.querySelector(
    'button:not([type]), button[type="submit"], input[type="submit"]'
  )

  if (hasSubmitter && !submitter) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  if (submitter) {
    event.currentTarget.requestSubmit(submitter)
  } else {
    event.currentTarget.requestSubmit()
  }
}

export function handleCommandEnterAction(
  event: ReactKeyboardEvent<HTMLElement>,
  action: () => void | Promise<void>
): void {
  if (!isCommandEnterEvent(event)) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  void action()
}
