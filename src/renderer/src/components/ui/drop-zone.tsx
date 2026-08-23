import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const dropZoneVariants = cva(
  'relative transition-[background-color,border-color,box-shadow] duration-150 ease-out data-[drag-over=true]:bg-[var(--drop-zone-active-bg)]',
  {
    variants: {
      variant: {
        surface: 'rounded-md',
        indicator: 'pointer-events-none',
        timed: 'rounded-none',
        row: 'rounded-md data-[drag-over=true]:shadow-sm',
        content: 'rounded-none'
      }
    },
    defaultVariants: {
      variant: 'surface'
    }
  }
)

export type DropZoneProps<T extends React.ElementType = 'div'> = VariantProps<
  typeof dropZoneVariants
> & {
  active?: boolean
  disabled?: boolean
  tone?: 'default' | 'calendar' | 'calendar-unscheduled'
  as?: T
  className?: string
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'className' | 'aria-disabled'>

type DropZoneComponent = <T extends React.ElementType = 'div'>(
  props: DropZoneProps<T> & { ref?: React.Ref<HTMLElement> }
) => React.ReactElement | null

const DropZoneImpl = <T extends React.ElementType = 'div'>(
  {
    as,
    active = false,
    disabled = false,
    tone = 'default',
    variant,
    className,
    style,
    ...props
  }: DropZoneProps<T>,
  ref: React.ForwardedRef<HTMLElement>
): React.ReactElement => {
  const Component = (as ?? 'div') as React.ElementType
  const isActive = active && !disabled
  const isCalendarTone = tone === 'calendar' || tone === 'calendar-unscheduled'

  return (
    <Component
      ref={ref}
      data-drag-over={isActive ? 'true' : 'false'}
      data-drop-zone-variant={variant ?? 'surface'}
      data-drop-zone-tone={tone}
      aria-disabled={disabled || undefined}
      className={cn(
        dropZoneVariants({ variant }),
        variant === 'content' || variant === 'row' || isCalendarTone
          ? 'border-0'
          : 'border border-[var(--drop-zone-border)] data-[drag-over=true]:border-[var(--drop-zone-active-border)]',
        className
      )}
      style={{
        ...style,
        ...(isActive && tone === 'calendar'
          ? { background: 'var(--calendar-drop-zone-active-bg)' }
          : isActive && tone === 'calendar-unscheduled'
            ? { background: 'var(--calendar-drop-zone-active-bg)' }
            : {})
      }}
      {...props}
    />
  )
}

export const DropZone = React.forwardRef(DropZoneImpl) as DropZoneComponent
