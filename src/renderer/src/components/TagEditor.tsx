import { useEffect, useId, useRef, useState, type ReactElement } from 'react'
import { normalizeTag } from '../../../shared/noteTags'
import { TagChip } from './TagChip'
import { Plus } from './ui/icons'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { cn } from '../lib/utils'

export interface TagEditorProps {
  value: string[]
  onChange: (tags: string[]) => void
  onFind?: (tag: string) => void
  label?: string
  inputPlaceholder?: string
  testId?: string
  className?: string
}

export function TagEditor({
  value,
  onChange,
  onFind,
  label = 'Tags',
  inputPlaceholder = 'tag name',
  testId,
  className
}: TagEditorProps): ReactElement {
  const [isAdding, setIsAdding] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const labelId = useId()
  const errorId = useId()

  useEffect(() => {
    if (!isAdding) return

    const frameId = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frameId)
  }, [isAdding])

  const closeInput = (): void => {
    setIsAdding(false)
    setInputValue('')
    setError(null)
  }

  const handleAdd = (): void => {
    const normalized = normalizeTag(inputValue)
    if (!normalized) {
      setError('Use letters, numbers, dash, underscore, or a namespace colon.')
      return
    }

    if (value.includes(normalized)) {
      setError(`Tag #${normalized} already exists.`)
      return
    }

    onChange([...value, normalized])
    setInputValue('')
    setError(null)
    setIsAdding(true)
  }

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      data-testid={testId}
      className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}
    >
      <span id={labelId} className="sr-only">
        {label}
      </span>
      {value.map((tag) => (
        <TagChip
          key={tag}
          tag={tag}
          onClick={onFind}
          onRemove={(nextTag) => onChange(value.filter((item) => item !== nextTag))}
        />
      ))}
      {isAdding ? (
        <div className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(event) => {
              setInputValue(event.target.value)
              if (error) setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.stopPropagation()
                handleAdd()
              } else if (event.key === 'Escape') {
                event.preventDefault()
                closeInput()
              }
            }}
            onBlur={closeInput}
            placeholder={inputPlaceholder}
            aria-label="Add tag"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            autoFocus
            className="h-7 w-32 rounded-md border-primary px-2.5 py-1 text-sm caret-primary"
          />
          {error ? (
            <span id={errorId} role="alert" className="basis-full text-xs text-destructive">
              {error}
            </span>
          ) : null}
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            setError(null)
            setIsAdding(true)
          }}
          title="Add tag"
          aria-label="Add tag"
          className="h-7 w-7 rounded-md border border-dashed border-border bg-card p-1 text-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Plus size={16} aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}
