import { type CSSProperties, ReactElement, useRef, useState } from 'react'
import type { NoteOutlineItem } from '../lib/noteOutline'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

interface NoteOutlineRailProps {
  items: NoteOutlineItem[]
  onJumpToIndex: (index: number) => void
}

const OUTLINE_PROXIMITY_RADIUS_PX = 36
const OUTLINE_MAX_OPACITY_BOOST = 0.28
const OUTLINE_MAX_ACCENT_MIX = 100
const OUTLINE_ROD_TRANSITION = 'background-color 140ms ease-out, opacity 140ms ease-out'

function getOutlineIndent(level: number): number {
  return Math.max(0, Math.min(level, 6) - 1) * 6
}

function getOutlineOpacity(level: number): number {
  switch (level) {
    case 1:
      return 1
    case 2:
      return 0.9
    case 3:
      return 0.8
    default:
      return 0.65
  }
}

function getOutlineTopSpacing(level: number): number {
  switch (Math.max(1, Math.min(level, 6))) {
    case 1:
      return 10
    case 2:
      return 2
    case 3:
      return 0
    case 4:
      return 0
    case 5:
      return 0
    default:
      return 0
  }
}

function getOutlineProximityStrength(
  pointerClientY: number | null,
  buttonElement: HTMLButtonElement | null
): number {
  if (pointerClientY === null || !buttonElement) {
    return 0
  }

  const rect = buttonElement.getBoundingClientRect()
  const buttonCenterY = rect.top + rect.height / 2
  const distance = Math.abs(pointerClientY - buttonCenterY)
  return Math.max(0, Math.min(1, 1 - distance / OUTLINE_PROXIMITY_RADIUS_PX))
}

function getOutlineRodStyle(input: {
  indent: number
  level: number
  pointerClientY: number | null
  buttonElement: HTMLButtonElement | null
}): CSSProperties {
  const { indent, level, pointerClientY, buttonElement } = input
  const proximityStrength = getOutlineProximityStrength(pointerClientY, buttonElement)
  const opacity = Math.min(
    1,
    getOutlineOpacity(level) + proximityStrength * OUTLINE_MAX_OPACITY_BOOST
  )
  const accentMix = Math.round(proximityStrength * OUTLINE_MAX_ACCENT_MIX)

  return {
    marginLeft: `${indent}px`,
    height: '1px',
    opacity,
    backgroundColor: `color-mix(in srgb, var(--accent) ${accentMix}%, var(--line-strong))`,
    transition: OUTLINE_ROD_TRANSITION
  }
}

export function NoteOutlineRail({
  items,
  onJumpToIndex
}: NoteOutlineRailProps): ReactElement | null {
  const [pointerClientY, setPointerClientY] = useState<number | null>(null)
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])

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
        <div
          className="sticky top-5 flex max-h-full w-8 flex-col items-stretch justify-start gap-0 py-1"
          onPointerEnter={(event) => {
            setPointerClientY(event.clientY)
          }}
          onPointerMove={(event) => {
            setPointerClientY(event.clientY)
          }}
          onPointerLeave={() => {
            setPointerClientY(null)
          }}
        >
          {items.map((item, index) => {
            const indent = getOutlineIndent(item.level)
            const marginTop = index === 0 ? 0 : getOutlineTopSpacing(item.level)
            const rodStyle = getOutlineRodStyle({
              indent,
              level: item.level,
              pointerClientY,
              buttonElement: buttonRefs.current[index] ?? null
            })

            return (
              <Tooltip key={`${item.id}:${index}`}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    ref={(node) => {
                      buttonRefs.current[index] = node
                    }}
                    aria-label={`Jump to heading level ${item.level}: ${item.label}`}
                    className="group flex h-3 w-full items-center rounded-full"
                    data-testid={`note-outline-rod:${index}`}
                    onClick={() => onJumpToIndex(index)}
                    style={{ marginTop: `${marginTop}px` }}
                  >
                    <span
                      aria-hidden="true"
                      className="block w-full rounded-full"
                      style={rodStyle}
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
