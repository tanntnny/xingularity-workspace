import { KeyboardEvent, ReactElement, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Input } from './ui/input'
import { cn } from '../lib/utils'

type DisplayAs = 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'div'

interface InlineEditableTextProps {
  value: string
  onCommit: (nextValue: string) => void | Promise<void>
  displayAs?: DisplayAs
  displayClassName?: string
  inputClassName?: string
  title?: string
  placeholder?: string
  allowEmpty?: boolean
  normalize?: (value: string) => string
  renderDisplay?: (value: string) => ReactNode
  editToken?: number
}

const defaultDisplayClassName = 'cursor-text text-inherit transition-colors hover:text-primary'
const defaultInputClassName = 'm-0 min-w-0 flex-1 border-0 bg-transparent text-inherit outline-none'

export function InlineEditableText({
  value,
  onCommit,
  displayAs = 'span',
  displayClassName,
  inputClassName,
  title = 'Click to edit',
  placeholder,
  allowEmpty = false,
  normalize,
  renderDisplay,
  editToken = 0
}: InlineEditableTextProps): ReactElement {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const handledEditTokenRef = useRef(0)
  const [isEditing, setIsEditing] = useState(false)
  const [draftValue, setDraftValue] = useState(value)
  const [isCommitting, setIsCommitting] = useState(false)

  const normalizeValue = useMemo(() => normalize ?? ((next: string) => next.trim()), [normalize])

  useEffect(() => {
    if (!isEditing) {
      setDraftValue(value)
    }
  }, [value, isEditing])

  useEffect(() => {
    if (editToken <= 0 || editToken === handledEditTokenRef.current) {
      return
    }

    handledEditTokenRef.current = editToken
    setDraftValue(value)
    setIsEditing(true)
  }, [editToken, value])

  useEffect(() => {
    if (!isEditing) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isEditing])

  const cancel = (): void => {
    setDraftValue(value)
    setIsEditing(false)
  }

  const commit = async (): Promise<void> => {
    if (isCommitting) {
      return
    }

    const nextValue = normalizeValue(draftValue)
    const currentValue = normalizeValue(value)

    if (!allowEmpty && nextValue.length === 0) {
      cancel()
      return
    }

    if (nextValue === currentValue) {
      setIsEditing(false)
      return
    }

    try {
      setIsCommitting(true)
      await onCommit(nextValue)
      setIsEditing(false)
    } finally {
      setIsCommitting(false)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void commit()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
    }
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type="text"
        value={draftValue}
        onChange={(event) => setDraftValue(event.target.value)}
        onBlur={() => {
          void commit()
        }}
        onKeyDown={handleKeyDown}
        disabled={isCommitting}
        placeholder={placeholder}
        autoFocus
        className={inputClassName ?? defaultInputClassName}
      />
    )
  }

  const beginEditing = (): void => {
    setDraftValue(value)
    setIsEditing(true)
  }

  const displayButton = (
    <button
      type="button"
      className={cn(
        'inline max-w-full appearance-none border-0 bg-transparent p-0 text-left font-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        displayClassName ?? defaultDisplayClassName
      )}
      onClick={beginEditing}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return
        }

        event.preventDefault()
        beginEditing()
      }}
      title={title}
      aria-label={value || placeholder || title}
    >
      {renderDisplay ? renderDisplay(value) : value || placeholder}
    </button>
  )

  if (displayAs === 'span') {
    return displayButton
  }

  const DisplayTag = displayAs
  return <DisplayTag>{displayButton}</DisplayTag>
}
