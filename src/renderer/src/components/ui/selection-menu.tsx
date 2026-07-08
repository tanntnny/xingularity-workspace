import * as React from 'react'
import { ChevronDown } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './dropdown-menu'
import { cn } from '../../lib/utils'

export interface SelectionMenuOption {
  value: string
  label: React.ReactNode
  disabled?: boolean
  icon?: React.ReactNode
}

type SelectionMenuVariant = 'toolbar' | 'field'

interface SelectionMenuProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'value' | 'onChange'
> {
  value: string
  onValueChange?: (value: string) => void
  options: readonly SelectionMenuOption[]
  variant?: SelectionMenuVariant
  icon?: React.ReactNode
  placeholder?: React.ReactNode
  selectedLabel?: React.ReactNode
  align?: 'start' | 'center' | 'end'
  contentClassName?: string
  itemClassName?: string
  fullWidth?: boolean
}

function setRef<T>(ref: React.ForwardedRef<T>, value: T | null): void {
  if (typeof ref === 'function') {
    ref(value)
    return
  }

  if (ref) {
    ref.current = value
  }
}

const selectionTriggerVariants: Record<SelectionMenuVariant, string> = {
  toolbar: 'selection-trigger selection-trigger-toolbar h-8 max-w-full min-w-0 rounded-lg text-sm',
  field: 'selection-trigger selection-trigger-field h-8 w-full rounded-lg text-sm'
}

const selectionMenuContentClassName = 'selection-menu-content min-w-[12rem] rounded-lg p-1.5'
const selectionMenuItemClassName =
  'selection-menu-item flex min-h-8 items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--text)]'

const SelectionMenu = React.forwardRef<HTMLButtonElement, SelectionMenuProps>(
  (
    {
      value,
      onValueChange,
      options,
      variant = 'field',
      icon,
      placeholder,
      selectedLabel,
      align = 'start',
      className,
      contentClassName,
      itemClassName,
      disabled,
      fullWidth = variant === 'field',
      type = 'button',
      ...props
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false)
    const [triggerNode, setTriggerNode] = React.useState<HTMLButtonElement | null>(null)
    const [triggerWidth, setTriggerWidth] = React.useState<number | null>(null)

    const selectedOption = options.find((option) => option.value === value) ?? null

    React.useEffect(() => {
      if (!triggerNode) {
        return
      }

      const updateWidth = (): void => {
        setTriggerWidth(triggerNode.offsetWidth)
      }

      updateWidth()

      if (typeof ResizeObserver === 'undefined') {
        return
      }

      const observer = new ResizeObserver(updateWidth)
      observer.observe(triggerNode)
      return (): void => {
        observer.disconnect()
      }
    }, [triggerNode])

    const mergedRef = React.useCallback(
      (node: HTMLButtonElement | null) => {
        setTriggerNode(node)
        setRef(ref, node)
      },
      [ref]
    )

    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            ref={mergedRef}
            type={type}
            data-no-ripple
            data-open={open}
            disabled={disabled}
            className={cn(selectionTriggerVariants[variant], fullWidth && 'w-full', className)}
            {...props}
          >
            <span className="selection-trigger-main flex min-w-0 flex-1 items-center gap-2 px-3">
              {icon ? <span className="selection-trigger-icon shrink-0">{icon}</span> : null}
              <span className="truncate text-left">
                {selectedLabel ?? selectedOption?.label ?? placeholder ?? value}
              </span>
            </span>
            <span className="selection-trigger-chevron-segment flex h-full w-8 shrink-0 items-center justify-center border-l">
              <ChevronDown
                className={cn(
                  'selection-trigger-chevron h-4 w-4 shrink-0 transition-transform duration-150',
                  open && 'rotate-180'
                )}
                aria-hidden="true"
              />
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={align}
          className={cn(selectionMenuContentClassName, contentClassName)}
          style={
            triggerWidth
              ? ({
                  minWidth: `${triggerWidth}px`
                } as React.CSSProperties)
              : undefined
          }
        >
          {options.map((option) => {
            const isSelected = option.value === value

            return (
              <DropdownMenuItem
                key={option.value}
                disabled={option.disabled}
                role="menuitemradio"
                aria-checked={isSelected}
                className={cn(selectionMenuItemClassName, itemClassName)}
                onSelect={() => onValueChange?.(option.value)}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  {option.icon ? (
                    <span className="shrink-0 text-[var(--muted)]">{option.icon}</span>
                  ) : null}
                  <span className="truncate">{option.label}</span>
                </span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
)

SelectionMenu.displayName = 'SelectionMenu'
export { SelectionMenu }
