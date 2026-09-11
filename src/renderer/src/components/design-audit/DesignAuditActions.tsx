import * as React from 'react'

import {
  ActionButtonGroup,
  Button,
  ButtonGroup,
  Kbd,
  Shortcut,
  TabToggleGroup,
  TabToggleGroupItem,
  ToggleGroup,
  ToggleGroupItem
} from '../ui'
import type { ButtonProps } from '../ui'
import { ArrowRight, Check, Link2, Plus, Settings2 } from '../ui/icons'
import { WorkspaceTextFade } from '../ui/workspace-text-fade'

export type DesignAuditActionsTabId = 'button' | 'button-groups' | 'toggle-groups' | 'keyboard'

export interface DesignAuditActionsProps {
  tabId: DesignAuditActionsTabId
}

type ButtonVariant = NonNullable<ButtonProps['variant']>
type ButtonSize = NonNullable<ButtonProps['size']>
type ButtonShape = NonNullable<ButtonProps['shape']>
type ButtonGroupVariant = 'default' | 'outline' | 'ghost'
type ControlSize = 'sm' | 'default' | 'lg'
type ToggleVariant = 'default' | 'outline'

const BUTTON_VARIANTS = [
  { value: 'default', label: 'Default' },
  { value: 'accent', label: 'Accent' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'outline', label: 'Outline' },
  { value: 'ghost', label: 'Ghost' },
  { value: 'muted', label: 'Muted' },
  { value: 'destructive', label: 'Destructive' },
  { value: 'rowAction', label: 'Row action' },
  { value: 'link', label: 'Link' }
] as const satisfies readonly { value: ButtonVariant; label: string }[]

const BUTTON_SIZES = ['sm', 'default', 'lg', 'icon'] as const satisfies readonly ButtonSize[]
const BUTTON_SHAPES = ['default', 'pill'] as const satisfies readonly ButtonShape[]
const BUTTON_GROUP_VARIANTS = [
  'default',
  'outline',
  'ghost'
] as const satisfies readonly ButtonGroupVariant[]
const CONTROL_SIZES = ['sm', 'default', 'lg'] as const satisfies readonly ControlSize[]
const TOGGLE_VARIANTS = ['default', 'outline'] as const satisfies readonly ToggleVariant[]

const TAB_META: Record<DesignAuditActionsTabId, { label: string; description: string }> = {
  button: {
    label: 'Button',
    description: 'Action hierarchy, density, shape, and composition states.'
  },
  'button-groups': {
    label: 'Button groups',
    description: 'Related actions with shared density, focus, and divider treatments.'
  },
  'toggle-groups': {
    label: 'Toggle groups',
    description: 'Single, multiple, tab-like, selected, disabled, and indicator states.'
  },
  keyboard: {
    label: 'Keyboard hints',
    description: 'Compact keyboard affordances for commands and shortcut guidance.'
  }
}

interface ActionPageFrameProps {
  tabId: DesignAuditActionsTabId
  children: React.ReactNode
}

function ActionPageFrame({ tabId, children }: ActionPageFrameProps): React.ReactElement {
  const meta = TAB_META[tabId]

  return (
    <section
      id={`design-audit-${tabId}`}
      data-testid={`design-audit-section:${tabId}`}
      aria-labelledby={`design-audit-${tabId}-heading`}
      className="min-w-0 space-y-10 pb-8"
    >
      <header className="max-w-3xl space-y-2">
        <h2
          id={`design-audit-${tabId}-heading`}
          className="text-2xl font-semibold tracking-tight text-foreground"
        >
          {meta.label}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">{meta.description}</p>
      </header>
      {children}
    </section>
  )
}

interface SpecimenSectionProps {
  id: string
  title: string
  description?: string
  component?: string
  children: React.ReactNode
}

function SpecimenSection({
  id,
  title,
  description,
  component,
  children
}: SpecimenSectionProps): React.ReactElement {
  return (
    <section
      id={`design-audit-${id}`}
      data-testid={component ? `design-audit-component:${component}` : undefined}
      aria-labelledby={`design-audit-${id}-heading`}
      className="space-y-4 border-b border-border/70 pb-8 last:border-b-0"
    >
      <header className="max-w-3xl space-y-1">
        <h3 id={`design-audit-${id}-heading`} className="text-base font-semibold text-foreground">
          {title}
        </h3>
        {description ? (
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  )
}

function ActionStatus({ message }: { message: string }): React.ReactElement {
  return (
    <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
      {message}
    </p>
  )
}

function DesignAuditButton(): React.ReactElement {
  const [lastAction, setLastAction] = React.useState('Activate a button to preview its feedback.')

  const announce = (label: string): void => {
    setLastAction(`${label} activated.`)
  }

  return (
    <ActionPageFrame tabId="button">
      <SpecimenSection
        id="button-variants"
        title="Variants"
        description="All local Button variants use the same control height, focus ring, and typography contract."
        component="button"
      >
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {BUTTON_VARIANTS.map(({ value, label }) => (
            <div
              key={value}
              data-testid={`design-audit-variant:button:${value}`}
              className="flex min-w-0 items-center justify-between gap-3 border-b border-border/50 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:px-4 sm:first-of-type:pl-0 xl:nth-[3n]:border-r-0"
            >
              <WorkspaceTextFade className="min-w-0 text-sm text-muted-foreground">
                {label}
              </WorkspaceTextFade>
              {value === 'link' ? (
                <Button variant="link" asChild>
                  <a
                    href="#design-audit-button-composition"
                    onClick={() => announce('Link button')}
                  >
                    <Link2 aria-hidden="true" />
                    <WorkspaceTextFade>Link</WorkspaceTextFade>
                  </a>
                </Button>
              ) : (
                <Button type="button" variant={value} onClick={() => announce(`${label} button`)}>
                  {value === 'rowAction' ? <Settings2 aria-hidden="true" /> : null}
                  {value === 'rowAction' ? 'Open' : label}
                </Button>
              )}
            </div>
          ))}
        </div>
      </SpecimenSection>

      <SpecimenSection
        id="button-sizes"
        title="Sizes"
        description="The icon size is reserved for a single, labeled action; the other sizes preserve the same reading order."
      >
        <div
          className="flex flex-wrap items-center gap-3"
          data-testid="design-audit-component:button-sizes"
        >
          {BUTTON_SIZES.map((size) => (
            <div
              key={size}
              data-testid={`design-audit-variant:button:size-${size}`}
              className="flex flex-col items-center gap-2"
            >
              {size === 'icon' ? (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="Open settings"
                  title="Open settings"
                  onClick={() => announce('Icon button')}
                >
                  <Settings2 aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size={size}
                  variant="secondary"
                  onClick={() => announce(`${size} button`)}
                >
                  {size === 'default' ? 'Default' : size === 'sm' ? 'Small' : 'Large'}
                </Button>
              )}
              <span className="text-xs text-muted-foreground">{size}</span>
            </div>
          ))}
        </div>
      </SpecimenSection>

      <SpecimenSection
        id="button-shapes"
        title="Shapes and states"
        description="Shape is an independent Button axis. Disabled controls remain in the layout while removing interaction."
      >
        <div className="flex flex-wrap items-center gap-3">
          {BUTTON_SHAPES.map((shape) => (
            <div
              key={shape}
              data-testid={`design-audit-variant:button:shape-${shape}`}
              className="flex flex-col items-center gap-2"
            >
              <Button
                type="button"
                variant="secondary"
                shape={shape}
                onClick={() => announce(`${shape} shape button`)}
              >
                {shape === 'default' ? 'Default radius' : 'Pill shape'}
              </Button>
              <span className="text-xs text-muted-foreground">shape={shape}</span>
            </div>
          ))}
          <div
            data-testid="design-audit-variant:button:disabled"
            className="flex flex-col items-center gap-2"
          >
            <Button type="button" variant="destructive" disabled>
              Disabled
            </Button>
            <span className="text-xs text-muted-foreground">disabled</span>
          </div>
        </div>
      </SpecimenSection>

      <SpecimenSection
        id="button-composition"
        title="Icon, link, and action composition"
        description="Icons are decorative when paired with a visible label. Icon-only actions carry a name and title for assistive technology and pointer discovery."
      >
        <div
          data-testid="design-audit-component:button-composition"
          className="flex flex-wrap items-center gap-3"
        >
          <div
            data-testid="design-audit-variant:button:leading-icon"
            className="flex flex-col items-center gap-2"
          >
            <Button type="button" onClick={() => announce('Leading icon button')}>
              <Plus aria-hidden="true" />
              Create
            </Button>
            <span className="text-xs text-muted-foreground">leading icon</span>
          </div>
          <div
            data-testid="design-audit-variant:button:trailing-icon"
            className="flex flex-col items-center gap-2"
          >
            <Button
              type="button"
              variant="outline"
              onClick={() => announce('Trailing icon button')}
            >
              Continue
              <ArrowRight aria-hidden="true" />
            </Button>
            <span className="text-xs text-muted-foreground">trailing icon</span>
          </div>
          <div
            data-testid="design-audit-variant:button:icon-only"
            className="flex flex-col items-center gap-2"
          >
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Confirm changes"
              title="Confirm changes"
              onClick={() => announce('Icon-only button')}
            >
              <Check aria-hidden="true" />
            </Button>
            <span className="text-xs text-muted-foreground">icon only</span>
          </div>
          <div
            data-testid="design-audit-variant:button:as-child-link"
            className="flex flex-col items-center gap-2"
          >
            <Button variant="link" asChild>
              <a href="#design-audit-button-composition" onClick={() => announce('As-child link')}>
                <WorkspaceTextFade>Read the link behavior note</WorkspaceTextFade>
                <Link2 aria-hidden="true" />
              </a>
            </Button>
            <span className="text-xs text-muted-foreground">asChild + link</span>
          </div>
        </div>
      </SpecimenSection>
      <ActionStatus message={lastAction} />
    </ActionPageFrame>
  )
}

function GroupButtons({
  size,
  announce
}: {
  size: ControlSize
  announce: (label: string) => void
}): React.ReactElement {
  return (
    <>
      <Button type="button" size={size} onClick={() => announce(`${size} group primary action`)}>
        New
      </Button>
      <Button
        type="button"
        size={size}
        variant="outline"
        onClick={() => announce(`${size} group secondary action`)}
      >
        Edit
      </Button>
      <Button
        type="button"
        size={size}
        variant="ghost"
        onClick={() => announce(`${size} group tertiary action`)}
      >
        More
      </Button>
    </>
  )
}

function DesignAuditButtonGroups(): React.ReactElement {
  const [lastAction, setLastAction] = React.useState(
    'Activate a grouped action to preview its feedback.'
  )

  const announce = (label: string): void => {
    setLastAction(`${label} activated.`)
  }

  return (
    <ActionPageFrame tabId="button-groups">
      <SpecimenSection
        id="button-group"
        title="ButtonGroup variants and sizes"
        description="ButtonGroup provides a shared visual container for related actions. Each local variant is shown at every supported size."
        component="button-group"
      >
        <div className="grid gap-6 xl:grid-cols-3">
          {BUTTON_GROUP_VARIANTS.map((variant) => (
            <div
              key={variant}
              data-testid={`design-audit-variant:button-group:${variant}`}
              className="min-w-0 space-y-3"
            >
              <h4 className="text-sm font-medium capitalize text-foreground">{variant}</h4>
              <div className="space-y-3">
                {CONTROL_SIZES.map((size) => (
                  <div key={size} className="flex min-w-0 items-center gap-3">
                    <span className="w-14 shrink-0 text-xs text-muted-foreground">{size}</span>
                    <ButtonGroup
                      variant={variant}
                      size={size}
                      aria-label={`${variant} ${size} button group`}
                      data-testid={`design-audit-variant:button-group:${variant}:${size}`}
                    >
                      <GroupButtons size={size} announce={announce} />
                    </ButtonGroup>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SpecimenSection>

      <SpecimenSection
        id="action-button-group"
        title="ActionButtonGroup focus and dividers"
        description="The action group is useful for compact adjacent actions. Focus glow is opt-in, and dividers can be removed when the group already has another boundary."
        component="action-button-group"
      >
        <div className="grid gap-6 xl:grid-cols-2">
          {(['none', 'glow'] as const).map((focusWithin) => (
            <div
              key={focusWithin}
              data-testid={`design-audit-variant:action-button-group:focus-${focusWithin}`}
              className="space-y-3"
            >
              <h4 className="text-sm font-medium text-foreground">focusWithin={focusWithin}</h4>
              <div className="flex flex-wrap gap-3">
                {CONTROL_SIZES.map((size) => (
                  <ActionButtonGroup
                    key={size}
                    focusWithin={focusWithin}
                    size={size}
                    aria-label={`${focusWithin} focus ${size} action group`}
                    data-testid={`design-audit-variant:action-button-group:focus-${focusWithin}:${size}`}
                  >
                    <Button
                      type="button"
                      size={size}
                      variant="ghost"
                      onClick={() => announce(`${focusWithin} focus ${size} primary action`)}
                    >
                      <Plus aria-hidden="true" />
                      Add
                    </Button>
                    <Button
                      type="button"
                      size={size}
                      variant="ghost"
                      onClick={() => announce(`${focusWithin} focus ${size} settings action`)}
                    >
                      <Settings2 aria-hidden="true" />
                      Configure
                    </Button>
                  </ActionButtonGroup>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3 border-t border-border/50 pt-6">
          <h4 className="text-sm font-medium text-foreground">Divider behavior</h4>
          <div className="flex flex-wrap gap-3">
            {[true, false].map((dividers) => (
              <div
                key={String(dividers)}
                data-testid={`design-audit-variant:action-button-group:dividers-${dividers ? 'on' : 'off'}`}
                className="flex flex-col items-start gap-2"
              >
                <ActionButtonGroup
                  dividers={dividers}
                  size="default"
                  aria-label={`Action group with dividers ${dividers ? 'on' : 'off'}`}
                >
                  <Button
                    type="button"
                    size="default"
                    variant="ghost"
                    onClick={() => announce(`Dividers ${dividers ? 'on' : 'off'} first action`)}
                  >
                    First
                  </Button>
                  <Button
                    type="button"
                    size="default"
                    variant="ghost"
                    onClick={() => announce(`Dividers ${dividers ? 'on' : 'off'} second action`)}
                  >
                    Second
                  </Button>
                </ActionButtonGroup>
                <span className="text-xs text-muted-foreground">
                  dividers={dividers ? 'true' : 'false'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </SpecimenSection>
      <ActionStatus message={lastAction} />
    </ActionPageFrame>
  )
}

interface ToggleItemSpec {
  value: string
  label: React.ReactNode
  disabled?: boolean
  testId?: string
}

interface SingleToggleSpecimenProps {
  variant: ToggleVariant
  size: ControlSize
  items: readonly ToggleItemSpec[]
  testId: string
  ariaLabel: string
  selectionIndicatorAnimated?: boolean
  onSelectionChange?: (value: string) => void
}

function SingleToggleSpecimen({
  variant,
  size,
  items,
  testId,
  ariaLabel,
  selectionIndicatorAnimated = true,
  onSelectionChange
}: SingleToggleSpecimenProps): React.ReactElement {
  const [value, setValue] = React.useState(items[0]?.value ?? '')

  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(nextValue) => {
        if (!nextValue) return
        setValue(nextValue)
        onSelectionChange?.(nextValue)
      }}
      variant={variant}
      size={size}
      selectionIndicatorAnimated={selectionIndicatorAnimated}
      aria-label={ariaLabel}
      data-testid={testId}
    >
      {items.map((item) => (
        <ToggleGroupItem
          key={item.value}
          value={item.value}
          disabled={item.disabled}
          data-testid={item.testId}
        >
          {item.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

interface MultipleToggleSpecimenProps {
  items: readonly ToggleItemSpec[]
  testId: string
  ariaLabel: string
  variant: ToggleVariant
  size: ControlSize
  onSelectionChange?: (value: readonly string[]) => void
}

function MultipleToggleSpecimen({
  items,
  testId,
  ariaLabel,
  variant,
  size,
  onSelectionChange
}: MultipleToggleSpecimenProps): React.ReactElement {
  const [values, setValues] = React.useState<string[]>(items.slice(0, 2).map((item) => item.value))

  return (
    <ToggleGroup
      type="multiple"
      value={values}
      onValueChange={(nextValues) => {
        setValues(nextValues)
        onSelectionChange?.(nextValues)
      }}
      variant={variant}
      size={size}
      aria-label={ariaLabel}
      data-testid={testId}
    >
      {items.map((item) => (
        <ToggleGroupItem
          key={item.value}
          value={item.value}
          disabled={item.disabled}
          data-testid={item.testId}
        >
          {item.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

const TOGGLE_ITEMS: readonly ToggleItemSpec[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'activity', label: 'Activity' },
  { value: 'disabled', label: 'Disabled', disabled: true }
]

const TOGGLE_STATE_ITEMS: readonly ToggleItemSpec[] = [
  {
    value: 'overview',
    label: 'Overview',
    testId: 'design-audit-variant:toggle-group:selected'
  },
  { value: 'activity', label: 'Activity' },
  {
    value: 'disabled',
    label: 'Disabled',
    disabled: true,
    testId: 'design-audit-variant:toggle-group:disabled'
  }
]

const MULTIPLE_TOGGLE_ITEMS: readonly ToggleItemSpec[] = [
  { value: 'bold', label: 'Bold' },
  { value: 'italic', label: 'Italic' },
  { value: 'underline', label: 'Underline' },
  { value: 'unavailable', label: 'Unavailable', disabled: true }
]

function DesignAuditToggleGroups(): React.ReactElement {
  const [lastSelection, setLastSelection] = React.useState('Select a toggle to preview its state.')

  const announce = (value: string): void => {
    setLastSelection(`Selected ${value}.`)
  }

  return (
    <ActionPageFrame tabId="toggle-groups">
      <SpecimenSection
        id="toggle-group-variants"
        title="ToggleGroup variants and selection modes"
        description="Single selection keeps one value active; multiple selection exposes independent pressed states. Disabled items stay discoverable but cannot be changed."
        component="toggle-group"
      >
        <div className="grid gap-6 xl:grid-cols-2">
          {TOGGLE_VARIANTS.map((variant) => (
            <div
              key={variant}
              data-testid={`design-audit-variant:toggle-group:${variant}`}
              className="space-y-3"
            >
              <h4 className="text-sm font-medium capitalize text-foreground">{variant} variant</h4>
              <div className="flex flex-wrap gap-3">
                <SingleToggleSpecimen
                  variant={variant}
                  size="default"
                  items={variant === 'default' ? TOGGLE_STATE_ITEMS : TOGGLE_ITEMS}
                  testId={`design-audit-variant:toggle-group:${variant}:single`}
                  ariaLabel={`${variant} single selection`}
                  onSelectionChange={announce}
                />
                <MultipleToggleSpecimen
                  variant={variant}
                  size="default"
                  items={MULTIPLE_TOGGLE_ITEMS}
                  testId={`design-audit-variant:toggle-group:${variant}:multiple`}
                  ariaLabel={`${variant} multiple selection`}
                  onSelectionChange={(values) => announce(values.join(', ') || 'nothing')}
                />
              </div>
            </div>
          ))}
        </div>
      </SpecimenSection>

      <SpecimenSection
        id="toggle-group-sizes"
        title="ToggleGroup sizes"
        description="Every local item size uses the same selected and disabled behavior."
      >
        <div className="flex flex-wrap items-end gap-5">
          {CONTROL_SIZES.map((size) => (
            <div
              key={size}
              data-testid={`design-audit-variant:toggle-group:size-${size}`}
              className="space-y-2"
            >
              <p className="text-xs text-muted-foreground">size={size}</p>
              <SingleToggleSpecimen
                variant="outline"
                size={size}
                items={TOGGLE_ITEMS}
                testId={`design-audit-variant:toggle-group:size-${size}:preview`}
                ariaLabel={`${size} toggle group`}
                onSelectionChange={announce}
              />
            </div>
          ))}
        </div>
      </SpecimenSection>

      <SpecimenSection
        id="toggle-group-indicator"
        title="Selection indicator motion"
        description="Single groups can animate the selection indicator or render the same geometry without motion. Reduced-motion preferences are handled by the primitive."
      >
        <div className="flex flex-wrap items-end gap-5">
          <div
            data-testid="design-audit-variant:toggle-group:animated-indicator"
            className="space-y-2"
          >
            <p className="text-xs text-muted-foreground">selectionIndicatorAnimated=true</p>
            <SingleToggleSpecimen
              variant="default"
              size="default"
              items={TOGGLE_ITEMS.slice(0, 2)}
              testId="design-audit-variant:toggle-group:animated-indicator:preview"
              ariaLabel="Animated selection indicator"
              selectionIndicatorAnimated
              onSelectionChange={announce}
            />
          </div>
          <div
            data-testid="design-audit-variant:toggle-group:static-indicator"
            className="space-y-2"
          >
            <p className="text-xs text-muted-foreground">selectionIndicatorAnimated=false</p>
            <SingleToggleSpecimen
              variant="outline"
              size="default"
              items={TOGGLE_ITEMS.slice(0, 2)}
              testId="design-audit-variant:toggle-group:static-indicator:preview"
              ariaLabel="Static selection indicator"
              selectionIndicatorAnimated={false}
              onSelectionChange={announce}
            />
          </div>
        </div>
      </SpecimenSection>

      <SpecimenSection
        id="tab-toggle-group"
        title="TabToggleGroup"
        description="Tab-like controls expose the selected tab to assistive technology while keeping long labels scrollable."
        component="tab-toggle-group"
      >
        <TabToggleSpecimen onSelectionChange={announce} />
      </SpecimenSection>
      <ActionStatus message={lastSelection} />
    </ActionPageFrame>
  )
}

function TabToggleSpecimen({
  onSelectionChange
}: {
  onSelectionChange: (value: string) => void
}): React.ReactElement {
  const [value, setValue] = React.useState('overview')

  const handleValueChange = (nextValue: string): void => {
    setValue(nextValue)
    onSelectionChange(nextValue)
  }

  return (
    <div className="min-w-0 space-y-3">
      <TabToggleGroup
        value={value}
        onValueChange={handleValueChange}
        aria-label="Audit tab toggle group"
        className="w-full"
        data-testid="design-audit-component:tab-toggle-group"
      >
        <TabToggleGroupItem
          value="overview"
          data-testid="design-audit-variant:tab-toggle-group:selected"
        >
          Overview
        </TabToggleGroupItem>
        <TabToggleGroupItem
          value="activity"
          data-testid="design-audit-variant:tab-toggle-group:idle"
        >
          Activity
        </TabToggleGroupItem>
        <TabToggleGroupItem
          value="unavailable"
          disabled
          data-testid="design-audit-variant:tab-toggle-group:disabled"
        >
          Unavailable
        </TabToggleGroupItem>
        <TabToggleGroupItem
          value="long-label"
          className="max-w-52"
          data-testid="design-audit-variant:tab-toggle-group:long-label"
        >
          A long tab label that remains readable
        </TabToggleGroupItem>
      </TabToggleGroup>
      <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
        Active tab: <span className="font-medium text-foreground">{value}</span>
      </p>
    </div>
  )
}

function DesignAuditKeyboard(): React.ReactElement {
  return (
    <ActionPageFrame tabId="keyboard">
      <SpecimenSection
        id="keyboard-hints"
        title="Kbd and Shortcut"
        description="Use Kbd for one visible key and Shortcut for a platform-aware sequence of keys."
        component="keyboard"
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <div
            data-testid="design-audit-variant:keyboard:single-key"
            className="flex items-center justify-between gap-4 border-b border-border/50 pb-3 sm:border-b-0"
          >
            <dt className="text-sm text-muted-foreground">Single key</dt>
            <dd>
              <Kbd aria-label="Escape">Esc</Kbd>
            </dd>
          </div>
          <div
            data-testid="design-audit-variant:keyboard:modifier-chord"
            className="flex items-center justify-between gap-4 border-b border-border/50 pb-3 sm:border-b-0"
          >
            <dt className="text-sm text-muted-foreground">Modifier chord</dt>
            <dd>
              <Shortcut
                keys={['cmd', 'k']}
                data-testid="design-audit-variant:shortcut:modifier-chord"
              />
            </dd>
          </div>
          <div
            data-testid="design-audit-variant:keyboard:alternative-key"
            className="flex items-center justify-between gap-4 border-b border-border/50 pb-3 sm:border-b-0"
          >
            <dt className="text-sm text-muted-foreground">Alternative key names</dt>
            <dd>
              <Shortcut
                keys={['option', 'tab']}
                data-testid="design-audit-variant:shortcut:alternative"
              />
            </dd>
          </div>
          <div
            data-testid="design-audit-variant:keyboard:long-shortcut"
            className="flex items-center justify-between gap-4"
          >
            <dt className="text-sm text-muted-foreground">Long shortcut</dt>
            <dd>
              <Shortcut
                keys={['cmd', 'shift', 'option', 'p']}
                data-testid="design-audit-variant:shortcut:long"
              />
            </dd>
          </div>
        </dl>
      </SpecimenSection>

      <SpecimenSection
        id="keyboard-guidance"
        title="Accessible guidance"
        description="Shortcut symbols include an accessible name for each key. Pair keyboard hints with a visible action label instead of relying on the glyph alone."
      >
        <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-4">
          <Button
            type="button"
            variant="outline"
            aria-describedby="design-audit-keyboard-action-help"
          >
            Open command palette
          </Button>
          <Shortcut keys={['cmd', 'k']} aria-label="Command K" />
          <p id="design-audit-keyboard-action-help" className="sr-only">
            Press Command K to open the command palette.
          </p>
        </div>
      </SpecimenSection>
    </ActionPageFrame>
  )
}

export function DesignAuditActions({ tabId }: DesignAuditActionsProps): React.ReactElement {
  switch (tabId) {
    case 'button':
      return <DesignAuditButton />
    case 'button-groups':
      return <DesignAuditButtonGroups />
    case 'toggle-groups':
      return <DesignAuditToggleGroups />
    case 'keyboard':
      return <DesignAuditKeyboard />
  }
}
