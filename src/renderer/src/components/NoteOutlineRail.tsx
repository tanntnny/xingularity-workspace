import { ReactElement } from 'react'
import type { NoteOutlineItem } from '../lib/noteOutline'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { cn } from '../lib/utils'

interface NoteOutlineRailProps {
  items: NoteOutlineItem[]
  onJumpToIndex: (index: number) => void
}

function getOutlineIndent(level: number): number {
  return Math.max(0, Math.min(level, 6) - 1) * 6
}

function getOutlineTone(level: number): string {
  switch (level) {
    case 1:
      return 'opacity-100'
    case 2:
      return 'opacity-90'
    case 3:
      return 'opacity-80'
    default:
      return 'opacity-65'
  }
}

export function NoteOutlineRail({
  items,
  onJumpToIndex
}: NoteOutlineRailProps): ReactElement | null {
  if (items.length === 0) {
    return null
  }

  return (
    <aside
      className="hidden w-12 shrink-0 lg:flex lg:justify-end"
      aria-label="Note outline"
      data-testid="note-outline-rail"
    >
      <TooltipProvider delayDuration={120}>
        <div className="sticky top-5 flex max-h-full w-8 flex-col items-stretch justify-start gap-1.5 py-1">
          {items.map((item, index) => {
            const indent = getOutlineIndent(item.level)

            return (
              <Tooltip key={`${item.id}:${index}`}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Jump to heading level ${item.level}: ${item.label}`}
                    className="group flex h-5 w-full items-center rounded-full"
                    data-testid={`note-outline-rod:${index}`}
                    onClick={() => onJumpToIndex(index)}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'block h-px w-full rounded-full bg-[var(--line-strong)] transition-[background-color,height,opacity,transform]',
                        'group-hover:h-0.5 group-hover:bg-[var(--accent)] group-hover:opacity-100 group-hover:translate-x-0.5',
                        'group-focus-visible:h-0.5 group-focus-visible:bg-[var(--accent)] group-focus-visible:opacity-100 group-focus-visible:translate-x-0.5',
                        getOutlineTone(item.level)
                      )}
                      style={{ marginLeft: `${indent}px` }}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-64 text-left">
                  <span className="font-semibold text-[var(--accent)]">H{item.level}</span>
                  <span className="ml-2">{item.label}</span>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </TooltipProvider>
    </aside>
  )
}
