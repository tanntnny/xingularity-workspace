import * as React from 'react'

import { SelectionMenu, type SelectionMenuOption } from './selection-menu'
import { cn } from '../../lib/utils'

type SelectOptionElement = React.ReactElement<{
  children?: React.ReactNode
  value?: string | number
  disabled?: boolean
}>

interface SelectProps {
  children?: React.ReactNode
  className?: string
  contentClassName?: string
  value?: string | number
  defaultValue?: string | number
  disabled?: boolean
  id?: string
  title?: string
  autoFocus?: boolean
  tabIndex?: number
  'aria-label'?: string
  onChange?: React.ChangeEventHandler<HTMLSelectElement>
}

function flattenOptionLabel(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }

  if (Array.isArray(node)) {
    return node.map((item) => flattenOptionLabel(item)).join('')
  }

  if (React.isValidElement(node)) {
    return flattenOptionLabel((node as SelectOptionElement).props.children)
  }

  return ''
}

function buildSelectOptions(children: React.ReactNode): SelectionMenuOption[] {
  return React.Children.toArray(children)
    .filter((child): child is SelectOptionElement => React.isValidElement(child))
    .map((child) => {
      const optionValue = child.props.value ?? flattenOptionLabel(child.props.children)

      return {
        value: String(optionValue),
        label: child.props.children,
        disabled: Boolean(child.props.disabled)
      }
    })
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      className,
      contentClassName,
      children,
      onChange,
      value,
      defaultValue,
      disabled,
      id,
      title,
      autoFocus,
      tabIndex,
      'aria-label': ariaLabel
    },
    ref
  ) => {
    const options = React.useMemo(() => buildSelectOptions(children), [children])
    const firstValue = options[0]?.value ?? ''
    const isControlled = value !== undefined
    const initialValue =
      defaultValue !== undefined ? String(defaultValue) : String(value ?? firstValue)
    const [internalValue, setInternalValue] = React.useState(initialValue)

    React.useEffect(() => {
      if (isControlled) {
        setInternalValue(String(value ?? ''))
      }
    }, [isControlled, value])

    const resolvedValue = isControlled ? String(value ?? '') : internalValue

    const handleValueChange = (nextValue: string): void => {
      if (!isControlled) {
        setInternalValue(nextValue)
      }

      if (!onChange) {
        return
      }

      const target = { value: nextValue } as HTMLSelectElement
      const event = {
        target,
        currentTarget: target
      } as React.ChangeEvent<HTMLSelectElement>

      onChange(event)
    }

    return (
      <SelectionMenu
        ref={ref}
        value={resolvedValue}
        onValueChange={handleValueChange}
        options={options}
        variant="field"
        id={id}
        disabled={disabled}
        title={title}
        autoFocus={autoFocus}
        tabIndex={tabIndex}
        aria-label={ariaLabel}
        className={cn('w-full', className)}
        contentClassName={contentClassName}
      />
    )
  }
)

Select.displayName = 'Select'

export { Select }
