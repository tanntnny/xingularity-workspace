import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'

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

const REVEAL_ITEM_CLASS = 'scroll-reveal-item'

export function useStaggeredScrollReveal(
  itemIds: string[],
  {
    baseDelayMs = 32,
    maxStaggerSteps = 8,
    threshold = 0.16,
    rootMargin = '0px 0px -10% 0px',
    resetKey
  }: StaggeredScrollRevealOptions = {}
): {
  containerRef: (node: HTMLElement | null) => void
  getRevealItemProps: (itemId: string) => RevealItemProps
} {
  const [containerNode, setContainerNode] = useState<HTMLElement | null>(null)
  const itemNodesRef = useRef(new Map<string, HTMLElement>())
  const revealedIdsRef = useRef(new Set<string>())
  const revealIndexRef = useRef(0)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const itemKey = useMemo(() => itemIds.join('||'), [itemIds])

  const applyHiddenState = useCallback((node: HTMLElement): void => {
    node.dataset.revealed = 'false'
    node.style.removeProperty('--scroll-reveal-delay')
  }, [])

  const applyRevealedState = useCallback(
    (node: HTMLElement): void => {
      const delay = (revealIndexRef.current % maxStaggerSteps) * baseDelayMs
      revealIndexRef.current += 1
      node.style.setProperty('--scroll-reveal-delay', `${delay}ms`)
      node.dataset.revealed = 'true'
    },
    [baseDelayMs, maxStaggerSteps]
  )

  const containerRef = useCallback((node: HTMLElement | null): void => {
    setContainerNode(node)
  }, [])

  const getRevealItemProps = useCallback(
    (itemId: string): RevealItemProps => ({
      ref: (node: HTMLElement | null): void => {
        const previousNode = itemNodesRef.current.get(itemId)
        if (previousNode && observerRef.current) {
          observerRef.current.unobserve(previousNode)
        }

        if (!node) {
          itemNodesRef.current.delete(itemId)
          return
        }

        itemNodesRef.current.set(itemId, node)

        if (revealedIdsRef.current.has(itemId)) {
          node.dataset.revealed = 'true'
          return
        }

        applyHiddenState(node)
        observerRef.current?.observe(node)
      },
      className: REVEAL_ITEM_CLASS,
      style: {}
    }),
    [applyHiddenState]
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const activeIds = new Set(itemIds)
    revealedIdsRef.current.forEach((itemId) => {
      if (!activeIds.has(itemId)) {
        revealedIdsRef.current.delete(itemId)
      }
    })

    itemNodesRef.current.forEach((node, itemId) => {
      if (!activeIds.has(itemId)) {
        observerRef.current?.unobserve(node)
        itemNodesRef.current.delete(itemId)
      }
    })
  }, [itemKey, itemIds])

  useEffect(() => {
    revealedIdsRef.current.clear()
    revealIndexRef.current = 0

    itemNodesRef.current.forEach((node) => {
      applyHiddenState(node)
    })
  }, [applyHiddenState, resetKey])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (!('IntersectionObserver' in window)) {
      itemIds.forEach((itemId) => {
        const node = itemNodesRef.current.get(itemId)
        if (!node || revealedIdsRef.current.has(itemId)) {
          return
        }
        revealedIdsRef.current.add(itemId)
        applyRevealedState(node)
      })
      return
    }

    observerRef.current?.disconnect()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return
          }

          const node = entry.target as HTMLElement
          const itemId = node.dataset.revealId
          if (!itemId || revealedIdsRef.current.has(itemId)) {
            observerRef.current?.unobserve(node)
            return
          }

          revealedIdsRef.current.add(itemId)
          applyRevealedState(node)
          observerRef.current?.unobserve(node)
        })
      },
      {
        root: containerNode,
        threshold,
        rootMargin
      }
    )

    itemIds.forEach((itemId) => {
      const node = itemNodesRef.current.get(itemId)
      if (!node) {
        return
      }

      node.dataset.revealId = itemId

      if (revealedIdsRef.current.has(itemId)) {
        node.dataset.revealed = 'true'
        observerRef.current?.unobserve(node)
        return
      }

      applyHiddenState(node)
      observerRef.current?.observe(node)
    })

    return () => {
      observerRef.current?.disconnect()
    }
  }, [applyHiddenState, applyRevealedState, containerNode, itemIds, rootMargin, threshold])

  return { containerRef, getRevealItemProps }
}
