import { HTMLAttributes, ReactElement, ReactNode } from 'react'
import { cn } from '../../lib/utils'

export type ShortcutKey = string

type ShortcutDefinition = {
  ariaLabel: string
  label: ReactNode
}

const SHORTCUT_DEFINITIONS: Record<string, ShortcutDefinition> = {
  alt: {
    ariaLabel: 'Option',
    label: '⌥'
  },
  backspace: { ariaLabel: 'Backspace', label: '⌫' },
  cmd: {
    ariaLabel: 'Command',
    label: '⌘'
  },
  command: {
    ariaLabel: 'Command',
    label: '⌘'
  },
  control: { ariaLabel: 'Control', label: '⌃' },
  ctrl: { ariaLabel: 'Control', label: '⌃' },
  delete: { ariaLabel: 'Delete', label: '⌦' },
  down: { ariaLabel: 'Down Arrow', label: '↓' },
  enter: { ariaLabel: 'Enter', label: 'Enter' },
  esc: { ariaLabel: 'Escape', label: 'Esc' },
  escape: { ariaLabel: 'Escape', label: 'Esc' },
  left: { ariaLabel: 'Left Arrow', label: '←' },
  meta: {
    ariaLabel: 'Command',
    label: '⌘'
  },
  opt: {
    ariaLabel: 'Option',
    label: '⌥'
  },
  option: {
    ariaLabel: 'Option',
    label: '⌥'
  },
  return: { ariaLabel: 'Enter', label: '↵' },
  right: { ariaLabel: 'Right Arrow', label: '→' },
  shift: { ariaLabel: 'Shift', label: 'Shift' },
  space: { ariaLabel: 'Space', label: 'Space' },
  tab: {
    ariaLabel: 'Tab',
    label: '⇥'
  },
  up: { ariaLabel: 'Up Arrow', label: '↑' }
}

const formatShortcutLabel = (key: ShortcutKey): string =>
  key.length === 1 ? key.toUpperCase() : key.replace(/[-_]/g, ' ')

export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>): ReactElement {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded-[var(--radius-control)] border border-border bg-muted px-1.5 text-xs font-medium leading-none text-muted-foreground whitespace-nowrap',
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
          'inline-flex min-w-[0.5rem] items-center justify-center text-xs leading-none [&_svg]:shrink-0',
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
        'inline-flex min-w-[0.5rem] items-center justify-center text-xs leading-none',
        className
      )}
    >
      {formatShortcutLabel(keyName)}
    </span>
  )
}

type ShortcutProps = HTMLAttributes<HTMLElement> & {
  [key: `data-${string}`]: string | number | undefined
  keyClassName?: string
  keys?: readonly ShortcutKey[]
}

export function Shortcut({
  className,
  keyClassName,
  keys,
  ...props
}: ShortcutProps): ReactElement | null {
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
