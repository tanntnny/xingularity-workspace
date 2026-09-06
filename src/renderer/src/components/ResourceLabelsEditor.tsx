import { useEffect, useId, useRef, useState, type ReactElement } from 'react'

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
import { ChevronDown, Plus, TagOutline, X } from './ui/icons'
import { ResponsivePicker } from './ui/responsive-picker'
import { SelectionPopover, type SelectionPopoverOption } from './ui/selection-popover'
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
  const labelId = useId()
  const [open, setOpen] = useState(false)
  const [labelPickerOpen, setLabelPickerOpen] = useState(false)

  useEffect(() => {
    if (!error) return
    const frame = window.requestAnimationFrame(() => {
      setOpen(true)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [error])

  const addDraft = (key: string): void => {
    if (drafts.length >= RESOURCE_LABEL_LIMIT) return
    const nextKey = normalizeResourceLabelKey(key)
    if (!nextKey) return
    const id = `resource-label-${nextId.current++}`
    onChange([...drafts, { id, key: nextKey, value: '' }])
  }

  const updateDraft = (id: string, patch: Partial<Omit<ResourceLabelDraft, 'id'>>): void => {
    onChange(drafts.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)))
  }

  const removeDraft = (id: string): void => {
    onChange(drafts.filter((draft) => draft.id !== id))
  }

  const removeLabel = (key: string): void => {
    onChange(drafts.filter((draft) => draft.key.trim() !== key))
  }

  const addLabel = (key: string): void => {
    addDraft(key)
    setLabelPickerOpen(false)
  }

  const handleLabelSelectionChange = (value: string): void => {
    if (value) addLabel(value)
  }

  const labelOptions: SelectionPopoverOption[] = (() => {
    const valueCounts = new Map<string, number>()

    for (const draft of drafts) {
      const key = draft.key.trim()
      if (!key) continue
      if (!valueCounts.has(key)) valueCounts.set(key, 0)
      if (draft.value.trim()) valueCounts.set(key, (valueCounts.get(key) ?? 0) + 1)
    }

    return Array.from(valueCounts.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, valueCount]) => ({
        value: key,
        label: (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="min-w-0 flex-1 truncate">{key}</span>
            <Badge
              variant="neutral"
              aria-label={`${valueCount} ${valueCount === 1 ? 'value' : 'values'}`}
              className="h-5 min-w-5 shrink-0 justify-center px-1 text-[11px]"
            >
              {valueCount}
            </Badge>
          </span>
        ),
        searchText: key,
        action: {
          label: `Remove ${key} label`,
          icon: <X size={14} aria-hidden="true" />,
          onSelect: () => removeLabel(key)
        }
      }))
  })()

  const handleLabelCreate = (key: string): void => {
    addLabel(key)
  }

  const getValueOptions = (key: string): SelectionPopoverOption[] => {
    const values = new Set(
      drafts
        .filter((draft) => draft.key.trim() === key)
        .map((draft) => draft.value.trim())
        .filter(Boolean)
    )

    return Array.from(values)
      .sort((left, right) => left.localeCompare(right))
      .map((value) => ({
        value,
        label: value,
        searchText: value
      }))
  }

  const completeCount = drafts.filter((draft) => draft.key.trim() && draft.value.trim()).length
  const atLabelLimit = drafts.length >= RESOURCE_LABEL_LIMIT
  const trigger = (
    <StatusChip
      as="button"
      item={{
        label,
        icon: <TagOutline aria-hidden="true" />,
        iconColorToken: 'var(--muted-foreground)'
      }}
      counter={completeCount}
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
          <div className="space-y-2">
            {drafts.map((draft) => {
              const keyError =
                draft.key.trim() && !normalizeResourceLabelKey(draft.key)
                  ? 'Use letters, numbers, dots, dashes, or underscores.'
                  : undefined
              const valueError =
                draft.value.length > RESOURCE_LABEL_VALUE_MAX_LENGTH
                  ? `Keep values to ${RESOURCE_LABEL_VALUE_MAX_LENGTH} characters or fewer.`
                  : undefined
              const valueErrorId = valueError ? `${draft.id}-value-error` : undefined

              return (
                <div
                  key={draft.id}
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-2"
                >
                  <div className="min-h-9 min-w-0 px-3 py-2">
                    <span
                      className="block min-w-0 truncate text-sm font-medium text-foreground"
                      data-testid={`${draft.id}-key`}
                    >
                      {draft.key || 'Unnamed label'}
                    </span>
                    {keyError ? (
                      <p
                        id={`${draft.id}-key-error`}
                        role="alert"
                        className="mt-1 text-xs font-medium text-destructive"
                      >
                        {keyError}
                      </p>
                    ) : null}
                  </div>
                  <Field error={valueError} errorId={valueErrorId} className="min-w-0">
                    <SelectionPopover
                      selectionMode="single"
                      value={draft.value}
                      options={getValueOptions(draft.key.trim())}
                      onValueChange={(value) => updateDraft(draft.id, { value })}
                      onCreate={(value) => updateDraft(draft.id, { value })}
                      getCreateValue={(query) => query.trim() || null}
                      createLabel={(value) => `Create value “${value}”`}
                      label="Values"
                      searchPlaceholder="Search or create values"
                      testId={`${draft.id}-value-popover`}
                    >
                      <Button
                        id={`${draft.id}-value-trigger`}
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`${draft.value ? 'Edit' : 'Set'} value for ${draft.key || 'label'}`}
                        aria-invalid={valueError ? true : undefined}
                        aria-describedby={valueErrorId}
                        data-testid={`${draft.id}-value-trigger`}
                        className={cn(
                          'h-9 w-full min-w-0 justify-between gap-2 px-3 text-left font-normal',
                          !draft.value && 'text-muted-foreground'
                        )}
                      >
                        <span className="min-w-0 truncate">{draft.value || 'Set value'}</span>
                        <ChevronDown size={14} aria-hidden="true" />
                      </Button>
                    </SelectionPopover>
                  </Field>
                  <WorkspaceIconButton
                    type="button"
                    aria-label={`Remove ${draft.key || 'empty'} label`}
                    title={`Remove ${draft.key || 'empty'} label`}
                    borderless
                    icon={<X size={14} aria-hidden="true" />}
                    className="size-8"
                    onClick={() => removeDraft(draft.id)}
                  />
                </div>
              )
            })}
            <SelectionPopover
              selectionMode="single"
              value=""
              options={labelOptions}
              onValueChange={handleLabelSelectionChange}
              onCreate={handleLabelCreate}
              getCreateValue={(query) => normalizeResourceLabelKey(query)}
              createLabel={(value) => `Create label “${value}”`}
              createError="Use letters, numbers, dots, dashes, or underscores."
              label="Labels"
              searchPlaceholder="Search or create labels"
              testId={`${testId}-add-popover`}
              open={labelPickerOpen}
              onOpenChange={setLabelPickerOpen}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1.5 hover:bg-surface-subtle-hover focus-visible:bg-surface-subtle-hover"
                disabled={atLabelLimit}
                data-testid={`${testId}-add`}
                data-responsive-picker-input="true"
                aria-label={
                  atLabelLimit ? `Label limit reached (${RESOURCE_LABEL_LIMIT})` : 'Add label'
                }
              >
                <Plus size={14} aria-hidden="true" />
                {atLabelLimit ? `Label limit reached (${RESOURCE_LABEL_LIMIT})` : 'Add label'}
              </Button>
            </SelectionPopover>
          </div>
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
