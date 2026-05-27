import { Command } from 'lucide-react'
import { HTMLAttributes, ReactElement, ReactNode } from 'react'
import { cn } from '../../lib/utils'

export type ShortcutKey = string

type ShortcutDefinition = {
  ariaLabel: string
  label: ReactNode
}

const SHORTCUT_DEFINITIONS: Record<string, ShortcutDefinition> = {
  alt: { ariaLabel: 'Option', label: 'Opt' },
  backspace: { ariaLabel: 'Backspace', label: '⌫' },
  cmd: {
    ariaLabel: 'Command',
    label: <Command className="h-2.5 w-2.5" aria-hidden="true" />
  },
  command: {
    ariaLabel: 'Command',
    label: <Command className="h-2.5 w-2.5" aria-hidden="true" />
  },
  control: { ariaLabel: 'Control', label: 'Ctrl' },
  ctrl: { ariaLabel: 'Control', label: 'Ctrl' },
  delete: { ariaLabel: 'Delete', label: '⌦' },
  down: { ariaLabel: 'Down Arrow', label: '↓' },
  enter: { ariaLabel: 'Enter', label: 'Enter' },
  esc: { ariaLabel: 'Escape', label: 'Esc' },
  escape: { ariaLabel: 'Escape', label: 'Esc' },
  left: { ariaLabel: 'Left Arrow', label: '←' },
  meta: {
    ariaLabel: 'Command',
    label: <Command className="h-2.5 w-2.5" aria-hidden="true" />
  },
  opt: { ariaLabel: 'Option', label: 'Opt' },
  option: { ariaLabel: 'Option', label: 'Opt' },
  return: { ariaLabel: 'Enter', label: 'Enter' },
  right: { ariaLabel: 'Right Arrow', label: '→' },
  shift: { ariaLabel: 'Shift', label: 'Shift' },
  space: { ariaLabel: 'Space', label: 'Space' },
  tab: { ariaLabel: 'Tab', label: 'Tab' },
  up: { ariaLabel: 'Up Arrow', label: '↑' }
}

const formatShortcutLabel = (key: ShortcutKey): string =>
  key.length === 1 ? key.toUpperCase() : key.replace(/[-_]/g, ' ')

export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>): ReactElement {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded border border-[var(--line)] bg-[var(--panel-2)] px-1.5 text-[10px] font-medium leading-none text-[var(--muted)] whitespace-nowrap',
        className
      )}
      {...props}
    />
  )
}

function ShortcutSymbol({
  className,
  keyName
}: {
  className?: string
  keyName: ShortcutKey
}): ReactElement {
  const normalized = keyName.trim().toLowerCase()
  const shortcut = SHORTCUT_DEFINITIONS[normalized]

  if (shortcut) {
    return (
      <span
        aria-label={shortcut.ariaLabel}
        className={cn(
          'inline-flex min-w-[0.5rem] items-center justify-center text-[0.9em] leading-none [&_svg]:shrink-0',
          className
        )}
      >
        {shortcut.label}
      </span>
    )
  }

  return (
    <span
      aria-label={keyName}
      className={cn(
        'inline-flex min-w-[0.5rem] items-center justify-center text-[0.9em] leading-none',
        className
      )}
    >
      {formatShortcutLabel(keyName)}
    </span>
  )
}

export function Shortcut({
  className,
  keyClassName,
  keys,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  keyClassName?: string
  keys?: readonly ShortcutKey[]
}): ReactElement | null {
  if (!keys?.length) {
    return null
  }

  return (
    <Kbd className={cn('gap-0.5 px-1.25', className)} {...props}>
      {keys.map((key, index) => (
        <ShortcutSymbol key={`${key}-${index}`} keyName={key} className={keyClassName} />
      ))}
    </Kbd>
  )
}
