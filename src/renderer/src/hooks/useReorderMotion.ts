import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

export type ReorderMotionRef = (node: HTMLElement | null) => void

export interface ReorderMotionOptions {
  enabled?: boolean
  duration?: number
  easing?: string
}

const defaultEasing = 'cubic-bezier(0.22, 1, 0.36, 1)'

export function useReorderMotion(
  itemIds: readonly string[],
  { enabled = true, duration = 180, easing = defaultEasing }: ReorderMotionOptions = {}
): (itemId: string) => ReorderMotionRef {
  const nodesRef = useRef(new Map<string, HTMLElement>())
  const itemRefsRef = useRef(new Map<string, ReorderMotionRef>())
  const previousRectsRef = useRef(new Map<string, DOMRect>())
  const animationsRef = useRef(new Map<string, Animation>())

  const getItemRef = useCallback((itemId: string): ReorderMotionRef => {
    const existingRef = itemRefsRef.current.get(itemId)
    if (existingRef) {
      return existingRef
    }

    const itemRef: ReorderMotionRef = (node) => {
      if (node) {
        nodesRef.current.set(itemId, node)
      } else {
        nodesRef.current.delete(itemId)
      }
    }
    itemRefsRef.current.set(itemId, itemRef)
    return itemRef
  }, [])

  useLayoutEffect(() => {
    const activeIds = new Set(itemIds)
    nodesRef.current.forEach((_node, itemId) => {
      if (!activeIds.has(itemId)) {
        nodesRef.current.delete(itemId)
      }
    })
    animationsRef.current.forEach((animation) => animation.cancel())
    animationsRef.current.clear()

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const nextRects = new Map<string, DOMRect>()

    itemIds.forEach((itemId) => {
      const node = nodesRef.current.get(itemId)
      if (!node) {
        return
      }

      const nextRect = node.getBoundingClientRect()
      nextRects.set(itemId, nextRect)
      const previousRect = previousRectsRef.current.get(itemId)
      const offsetY = previousRect ? previousRect.top - nextRect.top : 0
      if (
        enabled &&
        !prefersReducedMotion &&
        Math.abs(offsetY) > 0.5 &&
        typeof node.animate === 'function'
      ) {
        const animation = node.animate(
          [{ transform: `translate3d(0, ${offsetY}px, 0)` }, { transform: 'translate3d(0, 0, 0)' }],
          {
            duration,
            easing,
            fill: 'both'
          }
        )
        animationsRef.current.set(itemId, animation)
        animation.onfinish = () => {
          if (animationsRef.current.get(itemId) === animation) {
            animationsRef.current.delete(itemId)
          }
        }
      }
    })

    previousRectsRef.current = nextRects
  }, [duration, easing, enabled, itemIds])

  useEffect(
    () => () => {
      animationsRef.current.forEach((animation) => animation.cancel())
      animationsRef.current.clear()
      nodesRef.current.clear()
      previousRectsRef.current.clear()
    },
    []
  )

  return getItemRef
}
