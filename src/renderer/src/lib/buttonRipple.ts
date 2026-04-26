const BUTTON_RIPPLE_DURATION_MS = 520
const BUTTON_RIPPLE_SELECTOR = 'button:not([disabled]):not([data-no-ripple])'

declare global {
  interface Window {
    __xingularityButtonRippleCleanup__?: () => void
  }
}

function resolveRippleButton(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) {
    return null
  }

  if (target.closest('[data-no-ripple-scope]')) {
    return null
  }

  const button = target.closest<HTMLButtonElement>(BUTTON_RIPPLE_SELECTOR)
  if (!button || button.getAttribute('aria-disabled') === 'true') {
    return null
  }

  return button
}

export function triggerButtonRipple(
  button: HTMLButtonElement,
  origin?: { clientX: number; clientY: number }
): void {
  const rect = button.getBoundingClientRect()
  const rippleX = origin ? origin.clientX - rect.left : rect.width / 2
  const rippleY = origin ? origin.clientY - rect.top : rect.height / 2

  button.style.setProperty('--ripple-x', `${rippleX}px`)
  button.style.setProperty('--ripple-y', `${rippleY}px`)
  button.classList.remove('is-rippling')
  window.clearTimeout(Number(button.dataset.rippleTimer))

  window.requestAnimationFrame(() => {
    button.classList.add('is-rippling')
    button.dataset.rippleTimer = String(
      window.setTimeout(() => {
        button.classList.remove('is-rippling')
        delete button.dataset.rippleTimer
      }, BUTTON_RIPPLE_DURATION_MS)
    )
  })
}

export function installGlobalButtonRipple(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => undefined
  }

  window.__xingularityButtonRippleCleanup__?.()

  const handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType !== 'touch' && event.pointerType !== 'pen') {
      return
    }

    const button = resolveRippleButton(event.target)
    if (!button) {
      return
    }

    triggerButtonRipple(button, {
      clientX: event.clientX,
      clientY: event.clientY
    })
  }

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || (event.key !== 'Enter' && event.key !== ' ')) {
      return
    }

    const button = resolveRippleButton(event.target)
    if (!button) {
      return
    }

    triggerButtonRipple(button)
  }

  document.addEventListener('pointerdown', handlePointerDown, true)
  document.addEventListener('keydown', handleKeyDown, true)

  const cleanup = (): void => {
    document.removeEventListener('pointerdown', handlePointerDown, true)
    document.removeEventListener('keydown', handleKeyDown, true)
    if (window.__xingularityButtonRippleCleanup__ === cleanup) {
      delete window.__xingularityButtonRippleCleanup__
    }
  }

  window.__xingularityButtonRippleCleanup__ = cleanup
  return cleanup
}
