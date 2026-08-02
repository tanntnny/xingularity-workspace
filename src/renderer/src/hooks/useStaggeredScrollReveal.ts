import { useCallback, useEffect, useRef, type CSSProperties } from 'react'

interface StaggeredScrollRevealOptions {
  baseDelayMs?: number
  maxStaggerSteps?: number
  threshold?: number
  rootMargin?: string
  resetKey?: string | number | boolean
}

interface RevealItemProps {
  ref: (node: HTMLElement | null) => void
  className: string
  style: CSSProperties
}

export function useStaggeredScrollReveal(
  itemIds: string[],
  options: StaggeredScrollRevealOptions = {}
): {
  containerRef: (node: HTMLElement | null) => void
  getRevealItemProps: (itemId: string) => RevealItemProps
} {
  const {
    baseDelayMs = 24,
    maxStaggerSteps = 8,
    threshold = 0.08,
    rootMargin = '0px 0px -8% 0px',
    resetKey
  } = options
  const itemIdsRef = useRef(itemIds)
  const itemNodesRef = useRef(new Map<string, HTMLElement>())
  const observerRef = useRef<IntersectionObserver | null>(null)
  const containerNodeRef = useRef<HTMLElement | null>(null)
  const revealFrameRef = useRef<number | null>(null)

  useEffect(() => {
    itemIdsRef.current = itemIds
  }, [itemIds])

  const revealNode = useCallback((node: HTMLElement): void => {
    node.dataset.motionReveal = 'revealed'
  }, [])

  const observeItems = useCallback((): void => {
    const observer = observerRef.current
    if (!observer) {
      itemNodesRef.current.forEach(revealNode)
      return
    }

    itemNodesRef.current.forEach((node) => {
      node.dataset.motionReveal = 'pending'
      observer.observe(node)
    })
  }, [revealNode])

  const containerRef = useCallback(
    (node: HTMLElement | null): void => {
      if (containerNodeRef.current === node) {
        return
      }

      observerRef.current?.disconnect()
      observerRef.current = null
      containerNodeRef.current = node

      if (!node) {
        return
      }

      if (typeof IntersectionObserver === 'undefined') {
        itemNodesRef.current.forEach(revealNode)
        return
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              revealNode(entry.target as HTMLElement)
              observerRef.current?.unobserve(entry.target)
            }
          })
        },
        { threshold, rootMargin }
      )
      observeItems()
    },
    [observeItems, revealNode, rootMargin, threshold]
  )

  const setItemRef = useCallback(
    (itemId: string, node: HTMLElement | null): void => {
      const previousNode = itemNodesRef.current.get(itemId)
      if (previousNode && previousNode !== node) {
        observerRef.current?.unobserve(previousNode)
      }

      if (!node) {
        itemNodesRef.current.delete(itemId)
        return
      }

      itemNodesRef.current.set(itemId, node)
      node.dataset.motionReveal = 'pending'
      if (observerRef.current) {
        observerRef.current.observe(node)
      } else if (typeof IntersectionObserver === 'undefined') {
        revealNode(node)
      }
    },
    [revealNode]
  )

  useEffect(() => {
    observerRef.current?.disconnect()
    itemNodesRef.current.forEach((node) => {
      node.dataset.motionReveal = 'pending'
    })

    if (revealFrameRef.current !== null) {
      window.cancelAnimationFrame(revealFrameRef.current)
    }

    revealFrameRef.current = window.requestAnimationFrame(() => {
      revealFrameRef.current = null
      observeItems()
    })

    return () => {
      if (revealFrameRef.current !== null) {
        window.cancelAnimationFrame(revealFrameRef.current)
        revealFrameRef.current = null
      }
    }
  }, [observeItems, resetKey])

  useEffect(
    () => () => {
      observerRef.current?.disconnect()
      observerRef.current = null
    },
    []
  )

  const getRevealItemProps = useCallback(
    (itemId: string): RevealItemProps => {
      const itemIndex = Math.max(0, itemIdsRef.current.indexOf(itemId))
      const staggerStep = Math.min(itemIndex, maxStaggerSteps)
      return {
        ref: (node) => setItemRef(itemId, node),
        className: 'motion-staggered-reveal',
        style: {
          '--motion-reveal-delay': `${staggerStep * baseDelayMs}ms`
        } as CSSProperties
      }
    },
    [baseDelayMs, maxStaggerSteps, setItemRef]
  )

  return { containerRef, getRevealItemProps }
}
