import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'

import {
  normalizeResourceLabelKey,
  RESOURCE_LABEL_LIMIT,
  RESOURCE_LABEL_VALUE_MAX_LENGTH
} from '../../../shared/resourceDomain'
import { cn } from '../lib/utils'
import type { ResourceLabelDraft } from '../lib/resourceLabels'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Field } from './ui/field'
import { Input } from './ui/input'
import { Plus, TagOutline, X } from './ui/icons'
import { ResponsivePicker } from './ui/responsive-picker'
import { WorkspaceIconButton } from './ui/document-workspace'
import { StatusChip, type StatusChipSurface } from './ui/status-chip'

interface ResourceLabelsEditorProps {
  drafts: readonly ResourceLabelDraft[]
  onChange: (drafts: ResourceLabelDraft[]) => void
  error?: string | null
  label?: string
  testId?: string
  className?: string
  surface?: StatusChipSurface
}

export function ResourceLabelsEditor({
  drafts,
  onChange,
  error,
  label = 'Labels',
  testId = 'resource-labels-editor',
  className,
  surface = 'pill'
}: ResourceLabelsEditorProps): ReactElement {
  const nextId = useRef(drafts.length)
  const firstInputRef = useRef<HTMLInputElement>(null)
  const labelId = useId()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!error) return
    const frame = window.requestAnimationFrame(() => {
      setOpen(true)
      firstInputRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [error])

  const addDraft = (): void => {
    if (drafts.length >= RESOURCE_LABEL_LIMIT) return
    const id = `resource-label-${nextId.current++}`
    onChange([...drafts, { id, key: '', value: '' }])
  }

  const updateDraft = (id: string, patch: Partial<Omit<ResourceLabelDraft, 'id'>>): void => {
    onChange(drafts.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)))
  }

  const removeDraft = (id: string): void => {
    onChange(drafts.filter((draft) => draft.id !== id))
  }

  const handleValueKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    draft: ResourceLabelDraft,
    index: number
  ): void => {
    if (event.key !== 'Enter' || index !== drafts.length - 1) return
    if (!draft.key.trim() || !draft.value.trim()) return

    event.preventDefault()
    addDraft()
  }

  const completeCount = drafts.filter((draft) => draft.key.trim() && draft.value.trim()).length
  const atLabelLimit = drafts.length >= RESOURCE_LABEL_LIMIT
  const trigger = (
    <StatusChip
      as="button"
      item={{
        label: (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span>{label}</span>
            {completeCount > 0 ? (
              <Badge variant="neutral" className="h-5 min-w-5 justify-center px-1 text-[11px]">
                {completeCount}
              </Badge>
            ) : null}
          </span>
        ),
        icon: <TagOutline aria-hidden="true" />,
        iconColorToken: 'var(--muted-foreground)'
      }}
      type="button"
      surface={surface}
      className="max-w-full justify-start rounded-[var(--radius-button-pill)]"
      title={label}
      aria-label={`${label} selection`}
      data-testid={`${testId}-trigger`}
    />
  )

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
      <ResponsivePicker
        trigger={trigger}
        title={label}
        description="Use stable keys and values to make resources easier to filter."
        selectedCount={completeCount}
        onClear={() => onChange([])}
        clearLabel="Clear labels"
        testId={`${testId}-popover`}
        ariaLabel={`${label} editor`}
        open={open}
        onOpenChange={setOpen}
        contentClassName="w-[min(38rem,calc(100vw-1rem))]"
      >
        <fieldset className="space-y-3 p-3">
          <legend className="sr-only">{label}</legend>
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">
              Enter a key and value. Press Enter in the last value to add another row.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1.5"
              onClick={addDraft}
              disabled={atLabelLimit}
              data-testid={`${testId}-add`}
            >
              <Plus size={14} aria-hidden="true" />
              {atLabelLimit ? `Label limit reached (${RESOURCE_LABEL_LIMIT})` : 'Add label'}
            </Button>
          </div>
          {drafts.length === 0 ? (
            <div className="rounded-[var(--radius-button)] border border-dashed border-border/70 px-3 py-4 text-center">
              <p className="text-sm font-medium text-foreground">No labels yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add metadata such as <code className="font-mono">status=active</code> or{' '}
                <code className="font-mono">owner=amy</code>.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={addDraft}
              >
                Add your first label
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {drafts.map((draft, index) => {
                const keyError =
                  draft.key.trim() && !normalizeResourceLabelKey(draft.key)
                    ? 'Use letters, numbers, dots, dashes, or underscores.'
                    : undefined
                const valueError =
                  draft.value.length > RESOURCE_LABEL_VALUE_MAX_LENGTH
                    ? `Keep values to ${RESOURCE_LABEL_VALUE_MAX_LENGTH} characters or fewer.`
                    : undefined

                return (
                  <div
                    key={draft.id}
                    className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start"
                  >
                    <Field
                      label="Key"
                      htmlFor={`${draft.id}-key`}
                      error={keyError}
                      errorId={keyError ? `${draft.id}-key-error` : undefined}
                      className="min-w-0"
                    >
                      <Input
                        ref={index === 0 ? firstInputRef : undefined}
                        id={`${draft.id}-key`}
                        value={draft.key}
                        onChange={(event) => updateDraft(draft.id, { key: event.target.value })}
                        placeholder="status"
                        autoComplete="off"
                        aria-invalid={keyError ? true : undefined}
                        aria-describedby={keyError ? `${draft.id}-key-error` : undefined}
                        data-testid={`${draft.id}-key`}
                        data-responsive-picker-input={index === 0 ? 'true' : undefined}
                      />
                    </Field>
                    <Field
                      label="Value"
                      htmlFor={`${draft.id}-value`}
                      error={valueError}
                      errorId={valueError ? `${draft.id}-value-error` : undefined}
                      className="min-w-0"
                    >
                      <Input
                        id={`${draft.id}-value`}
                        value={draft.value}
                        onChange={(event) => updateDraft(draft.id, { value: event.target.value })}
                        onKeyDown={(event) => handleValueKeyDown(event, draft, index)}
                        placeholder="active"
                        autoComplete="off"
                        aria-invalid={valueError ? true : undefined}
                        aria-describedby={valueError ? `${draft.id}-value-error` : undefined}
                        data-testid={`${draft.id}-value`}
                      />
                    </Field>
                    <WorkspaceIconButton
                      type="button"
                      label={`Remove ${draft.key || 'empty'} label`}
                      aria-label={`Remove ${draft.key || 'empty'} label`}
                      title={`Remove ${draft.key || 'empty'} label`}
                      icon={<X size={14} aria-hidden="true" />}
                      className="h-8 w-fit shrink-0 sm:mt-6 sm:w-8"
                      onClick={() => removeDraft(draft.id)}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </fieldset>
      </ResponsivePicker>
      {error ? (
        <p role="alert" className="basis-full text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
