import { useCallback, type CSSProperties } from 'react'

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
  void itemIds
  void options

  const containerRef = useCallback((): void => undefined, [])
  const getRevealItemProps = useCallback((itemId: string): RevealItemProps => {
    void itemId
    return {
      ref: () => undefined,
      className: '',
      style: {}
    }
  }, [])

  return { containerRef, getRevealItemProps }
}
