import { addDays } from 'date-fns'
import { type DateRange } from 'react-day-picker'
import { type ReactElement, type ReactNode, useState } from 'react'

import { AlertCircle, CheckCircle2, ChevronDown, Circle, Clock } from '../ui/icons'
import {
  Button,
  Calendar,
  CalendarDateEditPopover,
  CalendarTimeEditPopover,
  Checkbox,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  DatePicker,
  DatePickerISO,
  Field,
  Input,
  Label,
  ResponsivePicker,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  SelectionCounter,
  SelectionCheckbox,
  SelectionPopover,
  StatusChipSelect,
  Switch,
  Textarea
} from '../ui'
import type { StatusChipOption } from '../ui/status-chip-select'

export type DesignAuditFormsTabId = 'inputs' | 'selection' | 'dates'

type AuditCheckedState = boolean | 'indeterminate'

const AUDIT_REFERENCE_DATE = new Date(2026, 7, 15, 12)

const STATUS_OPTIONS: readonly StatusChipOption[] = [
  {
    value: 'draft',
    label: 'Draft',
    icon: <Circle aria-hidden="true" />,
    iconColorToken: 'var(--muted-foreground)'
  },
  {
    value: 'in-review',
    label: 'In review',
    icon: <Clock aria-hidden="true" />,
    iconColorToken: 'var(--warning)'
  },
  {
    value: 'approved',
    label: 'Approved',
    icon: <CheckCircle2 aria-hidden="true" />,
    iconColorToken: 'var(--success)'
  },
  {
    value: 'blocked',
    label: 'Blocked by a deliberately long status label for overflow review',
    icon: <AlertCircle aria-hidden="true" />,
    iconColorToken: 'var(--destructive)',
    mutedTrigger: true,
    searchText: 'blocked long status overflow'
  }
]

const SELECTION_OPTIONS: readonly {
  value: string
  label: string
  disabled?: boolean
}[] = [
  { value: 'workspace', label: 'Workspace' },
  { value: 'project', label: 'Project' },
  { value: 'notebook', label: 'Notebook' },
  {
    value: 'archive',
    label: 'Archived workspace (disabled option)',
    disabled: true
  }
] as const

const RESPONSIVE_PICKER_OPTIONS = [
  { value: 'all', label: 'All workspaces' },
  { value: 'active', label: 'Active workspaces' },
  { value: 'shared', label: 'Shared with me' },
  { value: 'recent', label: 'Recently opened' }
] as const

function AuditSection({
  tabId,
  heading,
  description,
  children
}: {
  tabId: DesignAuditFormsTabId
  heading: string
  description: string
  children: ReactNode
}): ReactElement {
  return (
    <section
      data-testid={`design-audit-section:${tabId}`}
      className="space-y-6 border-b border-border/60 pb-8 last:border-b-0"
    >
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{heading}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

function ComponentSpecimen({
  id,
  heading,
  description,
  children
}: {
  id: string
  heading: string
  description: string
  children: ReactNode
}): ReactElement {
  return (
    <article
      data-testid={`design-audit-component:${id}`}
      className="min-w-0 space-y-5 rounded-xl border border-border/70 bg-transparent p-5"
    >
      <div>
        <h3 className="font-semibold text-foreground">{heading}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </article>
  )
}

function VariantLabel({ children }: { children: ReactNode }): ReactElement {
  return <p className="mb-2 text-xs font-medium text-muted-foreground">{children}</p>
}

function FieldAndLabelSpecimen(): ReactElement {
  const [fieldValue, setFieldValue] = useState('A labeled field')
  const [explicitLabelValue, setExplicitLabelValue] = useState('An explicit label')

  return (
    <ComponentSpecimen
      id="field"
      heading="Field and Label"
      description="Field owns label, description, error, and required messaging while Label stays available for custom control layouts."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Field
          label={
            <span>
              Workspace name <span aria-hidden="true">*</span>
            </span>
          }
          htmlFor="design-audit-field-required"
          description="Required field with a supporting description."
          data-testid="design-audit-variant:field:description"
        >
          <Input
            id="design-audit-field-required"
            value={fieldValue}
            onChange={(event) => setFieldValue(event.currentTarget.value)}
            required
            aria-required="true"
          />
        </Field>

        <div className="grid gap-1.5" data-testid="design-audit-variant:field:label">
          <Label htmlFor="design-audit-explicit-label">Explicit Label</Label>
          <Input
            id="design-audit-explicit-label"
            value={explicitLabelValue}
            onChange={(event) => setExplicitLabelValue(event.currentTarget.value)}
            aria-describedby="design-audit-explicit-label-description"
          />
          <p id="design-audit-explicit-label-description" className="text-sm text-muted-foreground">
            Compose Label directly when the surrounding layout is not a standard Field.
          </p>
        </div>

        <Field
          label="Project slug"
          htmlFor="design-audit-field-error"
          error="Use lowercase letters, numbers, and hyphens."
          errorId="design-audit-field-error-message"
          data-testid="design-audit-variant:field:error"
        >
          <Input
            id="design-audit-field-error"
            defaultValue="Project / 01"
            aria-invalid="true"
            aria-describedby="design-audit-field-error-message"
          />
        </Field>

        <Field
          label="Optional note"
          htmlFor="design-audit-field-optional"
          data-testid="design-audit-variant:field:plain"
        >
          <Input id="design-audit-field-optional" placeholder="No note yet" />
        </Field>
      </div>
    </ComponentSpecimen>
  )
}

function InputSpecimen(): ReactElement {
  const [emptyValue, setEmptyValue] = useState('')
  const [filledValue, setFilledValue] = useState('A filled value')
  const [readOnlyValue] = useState('Read-only value')

  return (
    <ComponentSpecimen
      id="input"
      heading="Input"
      description="Every local input variant, radius, focus radius, and common editing state is shown on the document canvas."
    >
      <div className="space-y-6">
        <div>
          <VariantLabel>Variants</VariantLabel>
          <div className="grid gap-4 md:grid-cols-3">
            {(['default', 'ghost', 'plain'] as const).map((variant) => (
              <Field
                key={variant}
                label={`${variant[0].toUpperCase()}${variant.slice(1)} variant`}
                htmlFor={`design-audit-input-variant-${variant}`}
                data-testid={`design-audit-variant:input:${variant}`}
              >
                <Input
                  id={`design-audit-input-variant-${variant}`}
                  variant={variant}
                  radius="default"
                  focusRadius="control"
                  defaultValue={variant === 'plain' ? 'Plain text' : 'A design-system value'}
                />
              </Field>
            ))}
          </div>
        </div>

        <div>
          <VariantLabel>Radii</VariantLabel>
          <div className="grid gap-4 md:grid-cols-3">
            {(['default', 'control', 'pill'] as const).map((radius) => (
              <Field
                key={radius}
                label={`${radius[0].toUpperCase()}${radius.slice(1)} radius`}
                htmlFor={`design-audit-input-radius-${radius}`}
                data-testid={`design-audit-variant:input:${radius}-radius`}
              >
                <Input
                  id={`design-audit-input-radius-${radius}`}
                  radius={radius}
                  focusRadius={radius}
                  defaultValue="Radius sample"
                />
              </Field>
            ))}
          </div>
        </div>

        <div>
          <VariantLabel>Focus radius</VariantLabel>
          <div className="grid gap-4 md:grid-cols-3">
            {(['default', 'control', 'pill'] as const).map((focusRadius) => (
              <Field
                key={focusRadius}
                label={`${focusRadius[0].toUpperCase()}${focusRadius.slice(1)} focus radius`}
                htmlFor={`design-audit-input-focus-${focusRadius}`}
                data-testid={`design-audit-variant:input:focus-${focusRadius}`}
              >
                <Input
                  id={`design-audit-input-focus-${focusRadius}`}
                  radius="control"
                  focusRadius={focusRadius}
                  placeholder="Focus me"
                />
              </Field>
            ))}
          </div>
        </div>

        <div>
          <VariantLabel>Editing states</VariantLabel>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field
              label="Empty"
              htmlFor="design-audit-input-empty"
              data-testid="design-audit-variant:input:empty"
            >
              <Input
                id="design-audit-input-empty"
                value={emptyValue}
                onChange={(event) => setEmptyValue(event.currentTarget.value)}
                placeholder="Start typing"
              />
            </Field>
            <Field
              label="Filled"
              htmlFor="design-audit-input-filled"
              data-testid="design-audit-variant:input:filled"
            >
              <Input
                id="design-audit-input-filled"
                value={filledValue}
                onChange={(event) => setFilledValue(event.currentTarget.value)}
              />
            </Field>
            <Field
              label="Disabled"
              htmlFor="design-audit-input-disabled"
              data-testid="design-audit-variant:input:disabled"
            >
              <Input id="design-audit-input-disabled" defaultValue="Unavailable" disabled />
            </Field>
            <Field
              label="Read-only"
              htmlFor="design-audit-input-readonly"
              data-testid="design-audit-variant:input:read-only"
            >
              <Input
                id="design-audit-input-readonly"
                value={readOnlyValue}
                readOnly
                aria-readonly="true"
              />
            </Field>
          </div>
        </div>
      </div>
    </ComponentSpecimen>
  )
}

function TextareaSpecimen(): ReactElement {
  const [textareaValue, setTextareaValue] = useState('A multiline design note.')

  return (
    <ComponentSpecimen
      id="textarea"
      heading="Textarea"
      description="Empty, filled, disabled, read-only, and visibly focused multiline states remain aligned with Input."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Field
          label="Empty"
          htmlFor="design-audit-textarea-empty"
          data-testid="design-audit-variant:textarea:empty"
        >
          <Textarea id="design-audit-textarea-empty" placeholder="Write a note" />
        </Field>
        <Field
          label="Filled"
          htmlFor="design-audit-textarea-filled"
          data-testid="design-audit-variant:textarea:filled"
        >
          <Textarea
            id="design-audit-textarea-filled"
            value={textareaValue}
            onChange={(event) => setTextareaValue(event.currentTarget.value)}
          />
        </Field>
        <Field
          label="Disabled"
          htmlFor="design-audit-textarea-disabled"
          data-testid="design-audit-variant:textarea:disabled"
        >
          <Textarea
            id="design-audit-textarea-disabled"
            defaultValue="This content cannot be edited."
            disabled
          />
        </Field>
        <Field
          label="Read-only"
          htmlFor="design-audit-textarea-readonly"
          data-testid="design-audit-variant:textarea:read-only"
        >
          <Textarea
            id="design-audit-textarea-readonly"
            defaultValue="This is a preserved multiline value."
            readOnly
            aria-readonly="true"
          />
        </Field>
        <Field
          label="Focused"
          htmlFor="design-audit-textarea-focused"
          data-testid="design-audit-variant:textarea:focused"
        >
          <Textarea
            id="design-audit-textarea-focused"
            defaultValue="The focus treatment is pinned for visual comparison."
            className="border-foreground ring-4 ring-border"
          />
        </Field>
      </div>
    </ComponentSpecimen>
  )
}

function CheckboxSpecimen(): ReactElement {
  const [checkboxValues, setCheckboxValues] = useState<Record<string, AuditCheckedState>>({
    unchecked: false,
    checked: true,
    mixed: 'indeterminate',
    disabled: false,
    'disabled-checked': true
  })

  const checkboxExamples = [
    { id: 'unchecked', label: 'Unchecked' },
    { id: 'checked', label: 'Checked' },
    { id: 'mixed', label: 'Mixed / indeterminate' },
    { id: 'disabled', label: 'Disabled' },
    { id: 'disabled-checked', label: 'Disabled checked' }
  ] as const

  return (
    <ComponentSpecimen
      id="checkbox"
      heading="Checkbox"
      description="Checked, unchecked, indeterminate, and disabled states use explicit labels and local state."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {checkboxExamples.map((example) => {
          const inputId = `design-audit-checkbox-${example.id}`
          const disabled = example.id.startsWith('disabled')

          return (
            <div
              key={example.id}
              className="flex items-center gap-3 rounded-lg border border-border/70 p-3"
              data-testid={`design-audit-variant:checkbox:${example.id}`}
            >
              <Checkbox
                id={inputId}
                checked={checkboxValues[example.id]}
                disabled={disabled}
                onCheckedChange={(checked) => {
                  setCheckboxValues((current) => ({ ...current, [example.id]: checked }))
                }}
                data-testid={`design-audit-control:checkbox:${example.id}`}
              />
              <Label htmlFor={inputId}>{example.label}</Label>
            </div>
          )
        })}
      </div>
    </ComponentSpecimen>
  )
}

function SwitchSpecimen(): ReactElement {
  const [switchValues, setSwitchValues] = useState({
    checked: true,
    unchecked: false,
    disabled: false,
    'disabled-checked': true
  })

  const switchExamples = [
    { id: 'checked', label: 'Checked' },
    { id: 'unchecked', label: 'Unchecked' },
    { id: 'disabled', label: 'Disabled' },
    { id: 'disabled-checked', label: 'Disabled checked' }
  ] as const

  return (
    <ComponentSpecimen
      id="switch"
      heading="Switch"
      description="Binary and disabled switch states are presented with a connected Label for keyboard and screen-reader review."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {switchExamples.map((example) => {
          const inputId = `design-audit-switch-${example.id}`
          const disabled = example.id.startsWith('disabled')

          return (
            <div
              key={example.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3"
              data-testid={`design-audit-variant:switch:${example.id}`}
            >
              <Label htmlFor={inputId}>{example.label}</Label>
              <Switch
                id={inputId}
                checked={switchValues[example.id]}
                disabled={disabled}
                onCheckedChange={(checked) => {
                  setSwitchValues((current) => ({ ...current, [example.id]: checked }))
                }}
                aria-label={`${example.label} switch`}
                data-testid={`design-audit-control:switch:${example.id}`}
              />
            </div>
          )
        })}
      </div>
    </ComponentSpecimen>
  )
}

function InputsTab(): ReactElement {
  return (
    <AuditSection
      tabId="inputs"
      heading="Inputs and fields"
      description="Compare the app's text-entry and binary form primitives in their common content, focus, and unavailable states."
    >
      <div className="space-y-6">
        <FieldAndLabelSpecimen />
        <InputSpecimen />
        <TextareaSpecimen />
        <div className="grid gap-6 xl:grid-cols-2">
          <CheckboxSpecimen />
          <SwitchSpecimen />
        </div>
      </div>
    </AuditSection>
  )
}

function SelectSpecimen(): ReactElement {
  const [selectedValue, setSelectedValue] = useState('workspace')

  return (
    <ComponentSpecimen
      id="select"
      heading="Select"
      description="Grouped options, a disabled option, and long labels exercise the native Radix select surface."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Field
          label="Grouped options"
          htmlFor="design-audit-select-grouped"
          data-testid="design-audit-variant:select:grouped"
        >
          <Select value={selectedValue} onValueChange={setSelectedValue}>
            <SelectTrigger
              id="design-audit-select-grouped"
              aria-label="Grouped workspace options"
              data-testid="design-audit-control:select:grouped"
            >
              <SelectValue placeholder="Choose a workspace" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Workspace</SelectLabel>
                <SelectItem value="workspace">Workspace</SelectItem>
                <SelectItem value="project">Project</SelectItem>
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>Other destinations</SelectLabel>
                <SelectItem value="notebook">Notebook</SelectItem>
                <SelectItem value="archive" disabled>
                  Archived workspace (disabled)
                </SelectItem>
                <SelectItem value="long">
                  A deliberately long select option for truncation review
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Disabled select"
          htmlFor="design-audit-select-disabled"
          data-testid="design-audit-variant:select:disabled"
        >
          <Select disabled value="workspace">
            <SelectTrigger
              id="design-audit-select-disabled"
              aria-label="Disabled workspace select"
              data-testid="design-audit-control:select:disabled"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="workspace">Workspace</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Selected value"
          htmlFor="design-audit-select-selected"
          data-testid="design-audit-variant:select:selected"
        >
          <Select value={selectedValue} onValueChange={setSelectedValue}>
            <SelectTrigger
              id="design-audit-select-selected"
              aria-label="Selected workspace value"
              data-testid="design-audit-control:select:selected"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SELECTION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </ComponentSpecimen>
  )
}

function SelectionPopoverSpecimen(): ReactElement {
  const [singleValue, setSingleValue] = useState('workspace')
  const [multipleValues, setMultipleValues] = useState<string[]>(['project'])
  const [searchValue, setSearchValue] = useState('notebook')
  const [createdValues, setCreatedValues] = useState<string[]>([])
  const [groupedProject, setGroupedProject] = useState('roadmap')
  const [groupedPeople, setGroupedPeople] = useState('design')

  const multipleTriggerLabel =
    multipleValues.length > 0 ? `${multipleValues.length} selected` : 'Select workspaces'
  const createdTriggerLabel =
    createdValues.length > 0 ? createdValues.join(', ') : 'Search or create a label'

  return (
    <ComponentSpecimen
      id="selection-popover"
      heading="SelectionPopover"
      description="Single, multiple, searchable, empty, disabled, grouped, long-label, and create flows are all local and safe to exercise."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Field
          label="Single selection"
          htmlFor="design-audit-selection-single"
          description="Search is available when the popover opens."
          data-testid="design-audit-variant:selection-popover:single"
        >
          <SelectionPopover
            selectionMode="single"
            value={singleValue}
            options={SELECTION_OPTIONS}
            onValueChange={setSingleValue}
            label="Workspace"
            searchPlaceholder="Search workspaces"
            loop
            triggerProps={{
              id: 'design-audit-selection-single',
              'aria-label': 'Single workspace selection',
              'data-testid': 'design-audit-control:selection-popover:single'
            }}
            testId="design-audit-selection-popover-single-content"
          />
        </Field>

        <Field
          label="Multiple selection"
          htmlFor="design-audit-selection-multiple"
          data-testid="design-audit-variant:selection-popover:multiple"
        >
          <SelectionPopover
            selectionMode="multiple"
            value={multipleValues}
            options={SELECTION_OPTIONS}
            onValueChange={setMultipleValues}
            label="Workspace facets"
            searchPlaceholder="Search facets"
            testId="design-audit-selection-popover-multiple-content"
          >
            <Button
              id="design-audit-selection-multiple"
              variant="outline"
              className="w-full justify-between"
              aria-label="Multiple workspace selection"
              data-testid="design-audit-control:selection-popover:multiple"
            >
              <span className="min-w-0 truncate text-left">{multipleTriggerLabel}</span>
              <ChevronDown aria-hidden="true" />
            </Button>
          </SelectionPopover>
        </Field>

        <Field
          label="Searchable"
          htmlFor="design-audit-selection-search"
          data-testid="design-audit-variant:selection-popover:searchable"
        >
          <SelectionPopover
            selectionMode="single"
            value={searchValue}
            options={[
              ...SELECTION_OPTIONS,
              { value: 'calendar', label: 'Calendar and scheduling' },
              { value: 'resources', label: 'Resources and references' }
            ]}
            onValueChange={setSearchValue}
            label="Destination"
            searchPlaceholder="Search destinations"
            selectOnTab
            triggerProps={{
              id: 'design-audit-selection-search',
              'aria-label': 'Searchable destination selection',
              'data-testid': 'design-audit-control:selection-popover:searchable'
            }}
            testId="design-audit-selection-popover-search-content"
          />
        </Field>

        <Field
          label="Empty state"
          htmlFor="design-audit-selection-empty"
          description="Open the control to review the no-results message."
          data-testid="design-audit-variant:selection-popover:empty"
        >
          <SelectionPopover
            selectionMode="single"
            value=""
            options={[]}
            onValueChange={() => undefined}
            label="saved views"
            placeholder="No saved views"
            triggerProps={{
              id: 'design-audit-selection-empty',
              'aria-label': 'Empty saved views selection',
              'data-testid': 'design-audit-control:selection-popover:empty'
            }}
            testId="design-audit-selection-popover-empty-content"
          />
        </Field>

        <Field
          label="Disabled option"
          htmlFor="design-audit-selection-disabled"
          data-testid="design-audit-variant:selection-popover:disabled-option"
        >
          <SelectionPopover
            selectionMode="single"
            value={singleValue}
            options={SELECTION_OPTIONS}
            onValueChange={setSingleValue}
            label="Workspace"
            triggerProps={{
              id: 'design-audit-selection-disabled',
              'aria-label': 'Selection with disabled option',
              'data-testid': 'design-audit-control:selection-popover:disabled-option'
            }}
            testId="design-audit-selection-popover-disabled-content"
          />
        </Field>

        <Field
          label="Long label"
          htmlFor="design-audit-selection-long"
          data-testid="design-audit-variant:selection-popover:long-label"
        >
          <SelectionPopover
            selectionMode="single"
            value="long"
            options={[
              {
                value: 'long',
                label:
                  'A deliberately long selection option that wraps without breaking the popover layout',
                wrapLabel: true
              },
              { value: 'short', label: 'Short option' }
            ]}
            onValueChange={() => undefined}
            label="Long option"
            triggerProps={{
              id: 'design-audit-selection-long',
              'aria-label': 'Long label selection',
              'data-testid': 'design-audit-control:selection-popover:long-label'
            }}
            testId="design-audit-selection-popover-long-content"
          />
        </Field>

        <fieldset
          className="space-y-4 rounded-lg border border-border/70 p-4 md:col-span-2"
          data-testid="design-audit-variant:selection-popover:grouped"
        >
          <legend className="px-1 text-sm font-medium text-foreground">Grouped controls</legend>
          <p className="text-sm leading-6 text-muted-foreground">
            Keep related searchable selections together with a semantic fieldset when the option
            data belongs to separate collections.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Projects" htmlFor="design-audit-selection-projects">
              <SelectionPopover
                selectionMode="single"
                value={groupedProject}
                options={[
                  { value: 'roadmap', label: 'Product roadmap' },
                  { value: 'launch', label: 'Launch planning' }
                ]}
                onValueChange={setGroupedProject}
                label="Projects"
                triggerProps={{
                  id: 'design-audit-selection-projects',
                  'aria-label': 'Grouped project selection',
                  'data-testid': 'design-audit-control:selection-popover:grouped-projects'
                }}
              />
            </Field>
            <Field label="People" htmlFor="design-audit-selection-people">
              <SelectionPopover
                selectionMode="single"
                value={groupedPeople}
                options={[
                  { value: 'design', label: 'Design team' },
                  { value: 'engineering', label: 'Engineering team' }
                ]}
                onValueChange={setGroupedPeople}
                label="People"
                triggerProps={{
                  id: 'design-audit-selection-people',
                  'aria-label': 'Grouped people selection',
                  'data-testid': 'design-audit-control:selection-popover:grouped-people'
                }}
              />
            </Field>
          </div>
        </fieldset>

        <Field
          label="Create action"
          htmlFor="design-audit-selection-create"
          description="Type a new value and press Enter to create it."
          data-testid="design-audit-variant:selection-popover:create-action"
        >
          <SelectionPopover
            selectionMode="multiple"
            value={createdValues}
            options={[
              { value: 'design', label: 'Design' },
              { value: 'review', label: 'Review' }
            ]}
            onValueChange={setCreatedValues}
            onCreate={(value) => {
              setCreatedValues((current) =>
                current.includes(value) ? current : [...current, value]
              )
            }}
            getCreateValue={(query) => {
              const value = query.trim().toLowerCase().replace(/\s+/g, '-')
              return value || null
            }}
            createLabel={(value) => `Create “${value}”`}
            label="Labels"
            searchPlaceholder="Search or create labels"
            testId="design-audit-selection-popover-create-content"
          >
            <Button
              id="design-audit-selection-create"
              variant="outline"
              className="w-full justify-between"
              aria-label="Create or select labels"
              data-testid="design-audit-control:selection-popover:create-action"
            >
              <span className="min-w-0 truncate text-left">{createdTriggerLabel}</span>
              <ChevronDown aria-hidden="true" />
            </Button>
          </SelectionPopover>
        </Field>
      </div>
    </ComponentSpecimen>
  )
}

function ResponsivePickerSpecimen(): ReactElement {
  const [singleValue, setSingleValue] = useState('all')
  const [multipleValues, setMultipleValues] = useState<string[]>(['active'])
  const [singleOpen, setSingleOpen] = useState(false)
  const [multipleOpen, setMultipleOpen] = useState(false)

  const toggleMultipleValue = (value: string): void => {
    setMultipleValues((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    )
  }

  return (
    <ComponentSpecimen
      id="responsive-picker"
      heading="ResponsivePicker"
      description="The same accessible picker content can render as a desktop popover or mobile sheet, with single and multiple selection examples."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div data-testid="design-audit-variant:responsive-picker:single">
          <VariantLabel>Single selection · adaptive surface</VariantLabel>
          <ResponsivePicker
            open={singleOpen}
            onOpenChange={setSingleOpen}
            trigger={
              <Button
                variant="outline"
                className="w-full justify-between"
                aria-label="Open single responsive picker"
                data-testid="design-audit-control:responsive-picker:single"
              >
                <span>
                  {RESPONSIVE_PICKER_OPTIONS.find((option) => option.value === singleValue)?.label}
                </span>
                <ChevronDown aria-hidden="true" />
              </Button>
            }
            title="Choose a workspace view"
            description="The picker adapts its surface to the available viewport."
            testId="design-audit-responsive-picker-single-content"
            ariaLabel="Single workspace view picker"
          >
            <Command className="min-h-0 rounded-none bg-transparent" shouldFilter>
              <CommandInput
                placeholder="Search workspace views"
                aria-label="Search workspace views"
                data-responsive-picker-input="true"
              />
              <CommandList className="max-h-64 px-2 pb-2">
                <CommandEmpty>No workspace views found.</CommandEmpty>
                <CommandGroup heading="Workspace views">
                  {RESPONSIVE_PICKER_OPTIONS.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => {
                        setSingleValue(option.value)
                        setSingleOpen(false)
                      }}
                      aria-selected={singleValue === option.value}
                      data-testid={`design-audit-control:responsive-picker:single:${option.value}`}
                      className="min-h-9 cursor-pointer text-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
                    >
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {singleValue === option.value ? (
                        <CheckCircle2 aria-hidden="true" className="text-primary" />
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </ResponsivePicker>
        </div>

        <div data-testid="design-audit-variant:responsive-picker:multiple">
          <VariantLabel>Multiple selection · clearable</VariantLabel>
          <ResponsivePicker
            open={multipleOpen}
            onOpenChange={setMultipleOpen}
            trigger={
              <Button
                variant="outline"
                className="w-full justify-between"
                aria-label="Open multiple responsive picker"
                data-testid="design-audit-control:responsive-picker:multiple"
              >
                <span className="min-w-0 flex-1 truncate">
                  {multipleValues.length > 0 ? 'Workspace views' : 'Select workspace views'}
                </span>
                <SelectionCounter count={multipleValues.length} />
                <ChevronDown aria-hidden="true" />
              </Button>
            }
            title="Filter workspace views"
            description="Select one or more views, then clear them from the picker header."
            selectedCount={multipleValues.length}
            onClear={() => setMultipleValues([])}
            clearLabel="Clear views"
            clearTestId="design-audit-control:responsive-picker:clear"
            testId="design-audit-responsive-picker-multiple-content"
            ariaLabel="Multiple workspace view picker"
          >
            <Command className="min-h-0 rounded-none bg-transparent" shouldFilter>
              <CommandInput
                placeholder="Search workspace views"
                aria-label="Search workspace views"
                data-responsive-picker-input="true"
              />
              <CommandList className="max-h-64 px-2 pb-2">
                <CommandEmpty>No workspace views found.</CommandEmpty>
                <CommandGroup heading="Workspace views">
                  {RESPONSIVE_PICKER_OPTIONS.map((option) => {
                    const selected = multipleValues.includes(option.value)

                    return (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        onSelect={() => toggleMultipleValue(option.value)}
                        aria-checked={selected}
                        data-checked={selected ? 'true' : 'false'}
                        data-testid={`design-audit-control:responsive-picker:multiple:${option.value}`}
                        className="group min-h-9 cursor-pointer rounded-sm text-foreground transition-colors hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
                      >
                        <SelectionCheckbox checked={selected} />
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </ResponsivePicker>
        </div>
      </div>
    </ComponentSpecimen>
  )
}

function StatusChipSelectSpecimen(): ReactElement {
  const [statusValue, setStatusValue] = useState('in-review')

  return (
    <ComponentSpecimen
      id="status-chip-select"
      heading="StatusChipSelect"
      description="Searchable status selection keeps the status icon, semantic color, surface, and overflow behavior together."
    >
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {(['none', 'pill', 'attention', 'hover', 'hover-pill'] as const).map((surface) => (
          <Field
            key={surface}
            label={`${surface === 'none' ? 'None' : surface} surface`}
            htmlFor={`design-audit-status-chip-${surface}`}
            data-testid={`design-audit-variant:status-chip-select:${surface}`}
          >
            <StatusChipSelect
              id={`design-audit-status-chip-${surface}`}
              label={`${surface} status`}
              value={statusValue}
              options={STATUS_OPTIONS}
              onValueChange={setStatusValue}
              surface={surface}
              data-testid={`design-audit-control:status-chip-select:${surface}`}
            />
          </Field>
        ))}
        <Field
          label="Bare icon trigger"
          htmlFor="design-audit-status-chip-bare"
          description="The underlying list remains searchable."
          data-testid="design-audit-variant:status-chip-select:bare"
        >
          <StatusChipSelect
            id="design-audit-status-chip-bare"
            label="Bare status"
            value={statusValue}
            options={STATUS_OPTIONS}
            onValueChange={setStatusValue}
            variant="bare"
            showValue={false}
            data-testid="design-audit-control:status-chip-select:bare"
          />
        </Field>
        <Field
          label="Wrapped, muted label"
          htmlFor="design-audit-status-chip-wrapped"
          data-testid="design-audit-variant:status-chip-select:wrap-muted"
        >
          <StatusChipSelect
            id="design-audit-status-chip-wrapped"
            label="Wrapped status"
            value="blocked"
            options={STATUS_OPTIONS}
            onValueChange={setStatusValue}
            surface="pill"
            wrapLabel
            mutedLabel
            data-testid="design-audit-control:status-chip-select:wrap-muted"
          />
        </Field>
        <Field
          label="Disabled"
          htmlFor="design-audit-status-chip-disabled"
          data-testid="design-audit-variant:status-chip-select:disabled"
        >
          <StatusChipSelect
            id="design-audit-status-chip-disabled"
            label="Disabled status"
            value="approved"
            options={STATUS_OPTIONS}
            onValueChange={setStatusValue}
            surface="pill"
            disabled
            data-testid="design-audit-control:status-chip-select:disabled"
          />
        </Field>
      </div>
    </ComponentSpecimen>
  )
}

function SelectionTab(): ReactElement {
  return (
    <AuditSection
      tabId="selection"
      heading="Selection controls"
      description="Review the app's select, searchable popover, responsive picker, and semantic status selection patterns with realistic local data."
    >
      <div className="space-y-6">
        <SelectSpecimen />
        <SelectionPopoverSpecimen />
        <ResponsivePickerSpecimen />
        <StatusChipSelectSpecimen />
      </div>
    </AuditSection>
  )
}

function CalendarSpecimen(): ReactElement {
  const [singleDate, setSingleDate] = useState<Date | undefined>(AUDIT_REFERENCE_DATE)
  const [multipleDates, setMultipleDates] = useState<Date[]>([
    AUDIT_REFERENCE_DATE,
    addDays(AUDIT_REFERENCE_DATE, 4)
  ])
  const [range, setRange] = useState<DateRange | undefined>({
    from: AUDIT_REFERENCE_DATE,
    to: addDays(AUDIT_REFERENCE_DATE, 6)
  })
  const disabledDate = addDays(AUDIT_REFERENCE_DATE, 2)

  return (
    <ComponentSpecimen
      id="calendar"
      heading="Calendar"
      description="Single, range, and multiple modes expose selected, outside-day, and disabled-day behavior using the shared calendar primitive."
    >
      <div className="grid gap-6 xl:grid-cols-3">
        <div
          className="min-w-0 rounded-xl border border-border/70 p-3"
          data-testid="design-audit-variant:calendar:single"
        >
          <VariantLabel>Single · selected and disabled day</VariantLabel>
          <Calendar
            mode="single"
            selected={singleDate}
            onSelect={setSingleDate}
            defaultMonth={AUDIT_REFERENCE_DATE}
            disabled={[disabledDate]}
            aria-label="Single date calendar"
          />
        </div>
        <div
          className="min-w-0 rounded-xl border border-border/70 p-3"
          data-testid="design-audit-variant:calendar:multiple"
        >
          <VariantLabel>Multiple · selected and outside days</VariantLabel>
          <Calendar
            mode="multiple"
            selected={multipleDates}
            onSelect={(dates) => setMultipleDates(dates ?? [])}
            defaultMonth={AUDIT_REFERENCE_DATE}
            aria-label="Multiple date calendar"
          />
        </div>
        <div
          className="min-w-0 rounded-xl border border-border/70 p-3"
          data-testid="design-audit-variant:calendar:range"
        >
          <VariantLabel>Range · no outside days</VariantLabel>
          <Calendar
            mode="range"
            selected={range}
            onSelect={setRange}
            defaultMonth={AUDIT_REFERENCE_DATE}
            showOutsideDays={false}
            aria-label="Date range calendar"
          />
        </div>
      </div>
    </ComponentSpecimen>
  )
}

function CalendarDateEditSpecimen(): ReactElement {
  const [selectedDate, setSelectedDate] = useState<string | undefined>('2026-08-20')
  const [emptyDate, setEmptyDate] = useState<string | undefined>()
  const [statusChipDate, setStatusChipDate] = useState<string | undefined>('2026-08-25')

  return (
    <ComponentSpecimen
      id="calendar-date-edit-popover"
      heading="CalendarDateEditPopover"
      description="Button and status-chip triggers cover selected, empty, invalid, and disabled date editing states."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Field
          label="Selected date · button trigger"
          htmlFor="design-audit-date-selected"
          data-testid="design-audit-variant:calendar-date-edit-popover:selected"
        >
          <CalendarDateEditPopover
            id="design-audit-date-selected"
            label="Selected date"
            value={selectedDate}
            onValueChange={setSelectedDate}
            data-testid="design-audit-control:calendar-date-edit-popover:selected"
          />
        </Field>
        <Field
          label="Empty date"
          htmlFor="design-audit-date-empty"
          data-testid="design-audit-variant:calendar-date-edit-popover:empty"
        >
          <CalendarDateEditPopover
            id="design-audit-date-empty"
            label="Empty date"
            value={emptyDate}
            onValueChange={setEmptyDate}
            placeholder="Set a date"
            data-testid="design-audit-control:calendar-date-edit-popover:empty"
          />
        </Field>
        <Field
          label="Status-chip trigger"
          htmlFor="design-audit-date-status-chip"
          data-testid="design-audit-variant:calendar-date-edit-popover:status-chip-trigger"
        >
          <CalendarDateEditPopover
            id="design-audit-date-status-chip"
            label="Status-chip date"
            value={statusChipDate}
            onValueChange={setStatusChipDate}
            triggerStyle="status-chip"
            data-testid="design-audit-control:calendar-date-edit-popover:status-chip-trigger"
          />
        </Field>
        <Field
          label="Invalid value"
          htmlFor="design-audit-date-error"
          error="Type an invalid value and press Enter inside the editor to see the inline error."
          errorId="design-audit-date-error-message"
          data-testid="design-audit-variant:calendar-date-edit-popover:error"
        >
          <CalendarDateEditPopover
            id="design-audit-date-error"
            label="Invalid date"
            value="not-a-date"
            onValueChange={() => undefined}
            aria-invalid="true"
            aria-describedby="design-audit-date-error-message"
            data-testid="design-audit-control:calendar-date-edit-popover:error"
          />
        </Field>
        <Field
          label="Disabled"
          htmlFor="design-audit-date-disabled"
          data-testid="design-audit-variant:calendar-date-edit-popover:disabled"
        >
          <CalendarDateEditPopover
            id="design-audit-date-disabled"
            label="Disabled date"
            value="2026-08-22"
            onValueChange={() => undefined}
            disabled
            data-testid="design-audit-control:calendar-date-edit-popover:disabled"
          />
        </Field>
        <div
          className="flex items-end gap-2 text-sm text-muted-foreground"
          data-testid="design-audit-variant:calendar-date-edit-popover:without-icon"
        >
          <CalendarDateEditPopover
            label="Date without icon"
            value={selectedDate}
            onValueChange={setSelectedDate}
            showIcon={false}
            size="sm"
            data-testid="design-audit-control:calendar-date-edit-popover:without-icon"
          />
          <span>Icon can be omitted for compact rows.</span>
        </div>
      </div>
    </ComponentSpecimen>
  )
}

function CalendarTimeEditSpecimen(): ReactElement {
  const [selectedTime, setSelectedTime] = useState<string | undefined>('09:30')
  const [emptyTime, setEmptyTime] = useState<string | undefined>()

  return (
    <ComponentSpecimen
      id="calendar-time-edit-popover"
      heading="CalendarTimeEditPopover"
      description="Selected, empty, with-icon, without-icon, invalid, and disabled time states use the compact time editor."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Field
          label="Selected · with icon"
          htmlFor="design-audit-time-selected"
          data-testid="design-audit-variant:calendar-time-edit-popover:selected"
        >
          <CalendarTimeEditPopover
            id="design-audit-time-selected"
            label="Selected time"
            value={selectedTime}
            onValueChange={setSelectedTime}
            data-testid="design-audit-control:calendar-time-edit-popover:selected"
          />
        </Field>
        <Field
          label="Empty · without icon"
          htmlFor="design-audit-time-empty"
          data-testid="design-audit-variant:calendar-time-edit-popover:empty"
        >
          <CalendarTimeEditPopover
            id="design-audit-time-empty"
            label="Empty time"
            value={emptyTime}
            onValueChange={setEmptyTime}
            showIcon={false}
            placeholder="Choose time"
            data-testid="design-audit-control:calendar-time-edit-popover:empty"
          />
        </Field>
        <Field
          label="Invalid value"
          htmlFor="design-audit-time-error"
          error="Type an invalid time and press Enter inside the editor to see the inline error."
          errorId="design-audit-time-error-message"
          data-testid="design-audit-variant:calendar-time-edit-popover:error"
        >
          <CalendarTimeEditPopover
            id="design-audit-time-error"
            label="Invalid time"
            value="25:00"
            onValueChange={() => undefined}
            aria-invalid="true"
            aria-describedby="design-audit-time-error-message"
            data-testid="design-audit-control:calendar-time-edit-popover:error"
          />
        </Field>
        <Field
          label="Disabled"
          htmlFor="design-audit-time-disabled"
          data-testid="design-audit-variant:calendar-time-edit-popover:disabled"
        >
          <CalendarTimeEditPopover
            id="design-audit-time-disabled"
            label="Disabled time"
            value="17:00"
            onValueChange={() => undefined}
            disabled
            data-testid="design-audit-control:calendar-time-edit-popover:disabled"
          />
        </Field>
      </div>
    </ComponentSpecimen>
  )
}

function DatePickerSpecimen(): ReactElement {
  const [date, setDate] = useState<Date | undefined>(AUDIT_REFERENCE_DATE)
  const [isoDate, setIsoDate] = useState('2026-08-28')
  const [emptyIsoDate, setEmptyIsoDate] = useState('')

  return (
    <ComponentSpecimen
      id="date-picker"
      heading="DatePicker"
      description="Date-object and ISO-string values demonstrate the two application-facing picker APIs, including an empty placeholder."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div
          className="grid gap-1.5"
          role="group"
          aria-labelledby="design-audit-date-picker-label"
          data-testid="design-audit-variant:date-picker:default"
        >
          <Label id="design-audit-date-picker-label">Date value</Label>
          <DatePicker
            date={date}
            onDateChange={setDate}
            placeholder="Pick a date"
            className="w-full"
          />
          <p className="text-sm text-muted-foreground">Date object state</p>
        </div>
        <div
          className="grid gap-1.5"
          role="group"
          aria-labelledby="design-audit-date-picker-iso-label"
          data-testid="design-audit-variant:date-picker:iso-value"
        >
          <Label id="design-audit-date-picker-iso-label">ISO value</Label>
          <DatePickerISO
            value={isoDate}
            onChange={setIsoDate}
            aria-label="ISO date picker"
            displayFormat="MMM d, yyyy"
            className="w-full"
          />
          <DatePickerISO
            value={emptyIsoDate}
            onChange={setEmptyIsoDate}
            aria-label="Empty ISO date picker"
            placeholder="No ISO date"
            showIcon={false}
            className="w-full"
          />
        </div>
      </div>
    </ComponentSpecimen>
  )
}

function DatesTab(): ReactElement {
  return (
    <AuditSection
      tabId="dates"
      heading="Dates and pickers"
      description="Review calendar selection modes and the compact date/time editing controls used across workspace properties."
    >
      <div className="space-y-6">
        <CalendarSpecimen />
        <CalendarDateEditSpecimen />
        <CalendarTimeEditSpecimen />
        <DatePickerSpecimen />
      </div>
    </AuditSection>
  )
}

export function DesignAuditForms({ tabId }: { tabId: DesignAuditFormsTabId }): ReactElement {
  if (tabId === 'inputs') {
    return <InputsTab />
  }

  if (tabId === 'selection') {
    return <SelectionTab />
  }

  return <DatesTab />
}
