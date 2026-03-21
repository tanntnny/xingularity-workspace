import type { MouseEvent as ReactMouseEvent } from 'react'
import type { NativeMenuItemDescriptor, NativeMenuPosition } from '../../../shared/types'

function getUiApi() {
  return (window as Window & { vaultApi?: { ui?: { platform?: string; showNativeMenu?: unknown } } })
    .vaultApi?.ui
}

export function canUseNativeMenus(): boolean {
  return getUiApi()?.platform === 'darwin' && typeof getUiApi()?.showNativeMenu === 'function'
}

export function getMouseMenuPosition(
  event: MouseEvent | ReactMouseEvent<HTMLElement>
): NativeMenuPosition {
  return {
    x: Math.round(event.clientX),
    y: Math.round(event.clientY)
  }
}

export function getElementMenuPosition(
  element: HTMLElement,
  align: 'start' | 'end' = 'end'
): NativeMenuPosition {
  const rect = element.getBoundingClientRect()
  return {
    x: Math.round(align === 'start' ? rect.left : rect.right),
    y: Math.round(rect.bottom)
  }
}

export async function showNativeMenu(
  items: NativeMenuItemDescriptor[],
  position: NativeMenuPosition
): Promise<string | null> {
  const uiApi = getUiApi()
  if (uiApi?.platform !== 'darwin' || typeof uiApi.showNativeMenu !== 'function') {
    return null
  }

  return uiApi.showNativeMenu(
    items,
    position
  ) as Promise<string | null>
}
