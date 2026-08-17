import { RefObject, useCallback, useEffect, useRef } from 'react'

const CALENDAR_DRAG_AUTO_SCROLL_EDGE_PX = 64
const CALENDAR_DRAG_AUTO_SCROLL_MAX_STEP_PX = 18

interface UseCalendarDragAutoScrollOptions {
  rootRef: RefObject<HTMLElement | null>
}

export function useCalendarDragAutoScroll({ rootRef }: UseCalendarDragAutoScrollOptions): {
  start: () => void
  stop: () => void
} {
  const isDraggingRef = useRef(false)
  const dragClientYRef = useRef<number | null>(null)
  const autoScrollFrameRef = useRef<number | null>(null)
  const stepAutoScrollRef = useRef<() => void>(() => undefined)

  const stop = useCallback((): void => {
    isDraggingRef.current = false
    dragClientYRef.current = null
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current)
      autoScrollFrameRef.current = null
    }
  }, [])

  const findScrollContainer = useCallback((): HTMLElement | null => {
    let candidate = rootRef.current

    while (candidate && candidate !== document.body) {
      const styles = window.getComputedStyle(candidate)
      if (
        /(auto|scroll|overlay)/.test(styles.overflowY) &&
        candidate.scrollHeight > candidate.clientHeight
      ) {
        return candidate
      }
      candidate = candidate.parentElement
    }

    return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : null
  }, [rootRef])

  const stepAutoScroll = useCallback((): void => {
    const clientY = dragClientYRef.current
    const scrollContainer = findScrollContainer()
    if (!isDraggingRef.current || clientY === null || !scrollContainer) {
      autoScrollFrameRef.current = null
      return
    }

    const rect = scrollContainer.getBoundingClientRect()
    let delta = 0

    if (clientY < rect.top + CALENDAR_DRAG_AUTO_SCROLL_EDGE_PX) {
      const distance = rect.top + CALENDAR_DRAG_AUTO_SCROLL_EDGE_PX - clientY
      delta = -Math.min(CALENDAR_DRAG_AUTO_SCROLL_MAX_STEP_PX, Math.max(4, distance * 0.35))
    } else if (clientY > rect.bottom - CALENDAR_DRAG_AUTO_SCROLL_EDGE_PX) {
      const distance = clientY - (rect.bottom - CALENDAR_DRAG_AUTO_SCROLL_EDGE_PX)
      delta = Math.min(CALENDAR_DRAG_AUTO_SCROLL_MAX_STEP_PX, Math.max(4, distance * 0.35))
    }

    if (delta !== 0) {
      const maxScrollTop = scrollContainer.scrollHeight - scrollContainer.clientHeight
      scrollContainer.scrollTop = Math.max(
        0,
        Math.min(maxScrollTop, scrollContainer.scrollTop + delta)
      )
    }

    autoScrollFrameRef.current = window.requestAnimationFrame(() => stepAutoScrollRef.current())
  }, [findScrollContainer])

  useEffect(() => {
    stepAutoScrollRef.current = stepAutoScroll
  }, [stepAutoScroll])

  const start = useCallback((): void => {
    isDraggingRef.current = true
  }, [])

  const handleDragOver = useCallback(
    (event: DragEvent): void => {
      const root = rootRef.current
      const target = event.target
      const isInsideCalendar = root && target instanceof Node && root.contains(target)
      if (!isDraggingRef.current && !isInsideCalendar) {
        return
      }

      isDraggingRef.current = true
      dragClientYRef.current = event.clientY
      if (autoScrollFrameRef.current === null) {
        autoScrollFrameRef.current = window.requestAnimationFrame(() => stepAutoScrollRef.current())
      }
    },
    [rootRef]
  )

  useEffect(() => {
    window.addEventListener('dragover', handleDragOver, true)
    window.addEventListener('drop', stop, true)
    window.addEventListener('dragend', stop, true)

    return () => {
      window.removeEventListener('dragover', handleDragOver, true)
      window.removeEventListener('drop', stop, true)
      window.removeEventListener('dragend', stop, true)
      stop()
    }
  }, [handleDragOver, stop])

  return { start, stop }
}
