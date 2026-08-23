import type { ReactElement } from 'react'

import type { NoteOutlineItem } from '../lib/noteOutline'
import { cn } from '../lib/utils'

interface NoteOutlinePanelProps {
  items: readonly NoteOutlineItem[]
  onJumpToIndex: (index: number) => void
}

export function NoteOutlinePanel({ items, onJumpToIndex }: NoteOutlinePanelProps): ReactElement {
  return (
    <nav aria-label="Note headings" data-testid="note-outline-list" className="min-w-0 p-1">
      {items.length > 0 ? (
        <ol className="space-y-0.5">
          {items.map((item, index) => (
            <li key={`${item.id}:${index}`}>
              <button
                type="button"
                aria-label={`Jump to heading: ${item.label}`}
                title={item.label}
                data-testid={`note-outline-item:${index}`}
                className={cn(
                  'flex w-full min-w-0 items-start gap-2 rounded-[var(--radius-button)] py-2 pr-3 text-left text-sm text-foreground transition-colors',
                  'hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
                style={{
                  paddingLeft: `${0.75 + Math.max(0, Math.min(item.level, 6) - 1) * 0.75}rem`
                }}
                onClick={() => onJumpToIndex(index)}
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-[10px] font-semibold uppercase text-muted-foreground"
                >
                  H{item.level}
                </span>
                <span className="min-w-0 flex-1 break-words">{item.label}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : <></>}
    </nav>
  )
}
