import type { ReactElement } from 'react'

import type { NoteOutlineItem } from '../lib/noteOutline'
import { cn } from '../lib/utils'

interface NoteOutlinePanelProps {
  items: readonly NoteOutlineItem[]
  onJumpToIndex: (index: number) => void
}

const MAX_NOTE_OUTLINE_LEVEL = 6
const NOTE_OUTLINE_BASE_INDENT_REM = 0.75
const NOTE_OUTLINE_INDENT_STEP_REM = 0.75

function clampNoteOutlineLevel(level: number): number {
  return Math.max(1, Math.min(level, MAX_NOTE_OUTLINE_LEVEL))
}

export function NoteOutlinePanel({ items, onJumpToIndex }: NoteOutlinePanelProps): ReactElement {
  return (
    <nav aria-label="Note headings" data-testid="note-outline-list" className="min-w-0 p-1">
      {items.length > 0 ? (
        <ol className="space-y-0.5">
          {items.map((item, index) => {
            const level = clampNoteOutlineLevel(item.level)
            const indentDepth = level - 1
            const outlineIndentRem =
              NOTE_OUTLINE_BASE_INDENT_REM + indentDepth * NOTE_OUTLINE_INDENT_STEP_REM

            return (
              <li key={`${item.id}:${index}`}>
                <button
                  type="button"
                  aria-label={`Jump to heading: ${item.label}`}
                  title={item.label}
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
              </li>
            )
          })}
        </ol>
      ) : (
        <></>
      )}
    </nav>
  )
}
