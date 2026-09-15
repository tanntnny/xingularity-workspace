import * as React from 'react'

import type { NoteOutlineItem } from '../lib/noteOutline'
import { cn } from '../lib/utils'
import { TooltipButton } from './ui/tooltip'

interface NoteOutlinePanelProps {
  items: readonly NoteOutlineItem[]
  onJumpToIndex: (index: number) => void
}

const MAX_NOTE_OUTLINE_LEVEL = 6
const NOTE_OUTLINE_BASE_INDENT_REM = 0.75
const NOTE_OUTLINE_INDENT_STEP_REM = 0.75
const NOTE_OUTLINE_VIRTUALIZATION_THRESHOLD = 200
const NOTE_OUTLINE_ROW_HEIGHT_PX = 38
const NOTE_OUTLINE_OVERSCAN_ROWS = 8
const NOTE_OUTLINE_INITIAL_RENDER_ROWS = 24

function clampNoteOutlineLevel(level: number): number {
  return Math.max(1, Math.min(level, MAX_NOTE_OUTLINE_LEVEL))
}

export function NoteOutlinePanel({
  items,
  onJumpToIndex
}: NoteOutlinePanelProps): React.ReactElement {
  const navRef = React.useRef<HTMLElement | null>(null)
  const [virtualRange, setVirtualRange] = React.useState({
    start: 0,
    end: NOTE_OUTLINE_INITIAL_RENDER_ROWS
  })
  const isVirtualized = items.length > NOTE_OUTLINE_VIRTUALIZATION_THRESHOLD

  React.useLayoutEffect(() => {
    if (!isVirtualized) {
      return
    }

    const nav = navRef.current
    const scrollPort = nav?.closest<HTMLElement>('[data-workspace-scrollport="true"]')
    if (!nav || !scrollPort) {
      return
    }

    let frameId: number | null = null
    const updateRange = (): void => {
      frameId = null
      const navRect = nav.getBoundingClientRect()
      const scrollPortRect = scrollPort.getBoundingClientRect()
      const navTop = navRect.top - scrollPortRect.top + scrollPort.scrollTop
      const viewportTop = Math.max(0, scrollPort.scrollTop - navTop)
      const viewportBottom = viewportTop + scrollPort.clientHeight
      const start = Math.max(
        0,
        Math.floor(viewportTop / NOTE_OUTLINE_ROW_HEIGHT_PX) - NOTE_OUTLINE_OVERSCAN_ROWS
      )
      const end = Math.min(
        items.length,
        Math.ceil(viewportBottom / NOTE_OUTLINE_ROW_HEIGHT_PX) + NOTE_OUTLINE_OVERSCAN_ROWS
      )

      setVirtualRange((current) =>
        current.start === start && current.end === end ? current : { start, end }
      )
    }
    const scheduleRangeUpdate = (): void => {
      if (frameId === null) {
        frameId = window.requestAnimationFrame(updateRange)
      }
    }

    updateRange()
    scrollPort.addEventListener('scroll', scheduleRangeUpdate, { passive: true })
    window.addEventListener('resize', scheduleRangeUpdate)

    return () => {
      scrollPort.removeEventListener('scroll', scheduleRangeUpdate)
      window.removeEventListener('resize', scheduleRangeUpdate)
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [isVirtualized, items.length])

  const renderItem = (item: NoteOutlineItem, index: number): React.ReactElement => {
    const level = clampNoteOutlineLevel(item.level)
    const indentDepth = level - 1
    const outlineIndentRem =
      NOTE_OUTLINE_BASE_INDENT_REM + indentDepth * NOTE_OUTLINE_INDENT_STEP_REM

    return (
      <li
        key={`${item.id}:${index}`}
        aria-setsize={isVirtualized ? items.length : undefined}
        aria-posinset={isVirtualized ? index + 1 : undefined}
        style={
          isVirtualized
            ? {
                position: 'absolute',
                top: index * NOTE_OUTLINE_ROW_HEIGHT_PX,
                left: 0,
                right: 0,
                height: NOTE_OUTLINE_ROW_HEIGHT_PX
              }
            : undefined
        }
      >
        <TooltipButton label={item.label}>
          <button
            type="button"
            aria-label={`Jump to heading: ${item.label}`}
            data-testid={`note-outline-item:${index}`}
            className={cn(
              'relative flex w-full min-w-0 items-center rounded-[var(--radius-button)] py-2 pr-3 text-left text-sm text-foreground transition-colors',
              'hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
            style={{ paddingLeft: `${outlineIndentRem}rem` }}
            onClick={() => onJumpToIndex(index)}
          >
            {indentDepth > 0 ? (
              <span className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
                {Array.from({ length: indentDepth }, (_, guideIndex) => (
                  <span
                    key={guideIndex}
                    data-testid={`note-outline-indent-guide:${index}:${guideIndex}`}
                    className="absolute inset-y-0 w-[var(--border-width)] bg-border opacity-80"
                    style={{
                      left: `${outlineIndentRem - (guideIndex + 0.5) * NOTE_OUTLINE_INDENT_STEP_REM}rem`
                    }}
                  />
                ))}
              </span>
            ) : null}
            <span className="relative z-10 flex min-w-0 flex-1 items-center gap-2">
              <span
                aria-hidden="true"
                className="shrink-0 text-[10px] font-semibold uppercase text-muted-foreground"
              >
                H{level}
              </span>
              <span className="workspace-text-fade block max-w-full min-w-0 flex-1">
                {item.label}
              </span>
            </span>
          </button>
        </TooltipButton>
      </li>
    )
  }

  const start = Math.min(virtualRange.start, Math.max(0, items.length - 1))
  const end = Math.max(start + 1, Math.min(items.length, virtualRange.end))
  const renderedItems = isVirtualized
    ? items.slice(start, end).map((item, offset) => renderItem(item, start + offset))
    : items.map(renderItem)

  return (
    <nav
      ref={navRef}
      aria-label="Note headings"
      data-testid="note-outline-list"
      className="min-w-0 p-1"
    >
      {items.length > 0 ? (
        <ol
          className={isVirtualized ? 'relative' : 'space-y-0.5'}
          style={isVirtualized ? { height: items.length * NOTE_OUTLINE_ROW_HEIGHT_PX } : undefined}
        >
          {renderedItems}
        </ol>
      ) : null}
    </nav>
  )
}
