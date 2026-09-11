import { useState, type ReactElement } from 'react'
import { ChevronDown, JavaScript, Python, Shield } from '../ui/icons'
import {
  Button,
  Checkbox,
  CollapsibleWorkspacePanelSection,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SelectionPopover,
  Switch,
  WorkspaceTextFade
} from '../ui'
import type {
  RuntimeType,
  SchedulePermission,
  TriggerConfig,
  TriggerType
} from '../../../../shared/scheduleTypes'
import type { SchedulePropertiesPanelProps } from './types'
import { ScheduleSecretsDialog } from './ScheduleSecretsDialog'

const PERMISSION_OPTIONS: Array<{
  value: SchedulePermission
  label: string
  description: string
}> = [
  {
    value: 'network',
    label: 'Network access',
    description: 'Allow requests to external services.'
  },
  {
    value: 'readNotes',
    label: 'Read notes',
    description: 'Allow the script to inspect workspace notes.'
  },
  { value: 'createTasks', label: 'Create tasks', description: 'Allow task.create actions.' },
  { value: 'updateTasks', label: 'Update tasks', description: 'Allow task.update actions.' },
  {
    value: 'useSecrets',
    label: 'Use secrets',
    description: 'Allow access to explicitly configured secret values.'
  },
  { value: 'createNotes', label: 'Create notes', description: 'Allow note.create actions.' }
]

const LOCAL_TIMEZONE = 'local'
const FALLBACK_TIMEZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Africa/Cairo',
  'Asia/Dubai',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland'
]

function getSupportedTimezones(): string[] {
  const intl = Intl as typeof Intl & {
    supportedValuesOf?: (key: 'timeZone') => string[]
  }
  const supported = intl.supportedValuesOf?.('timeZone') ?? FALLBACK_TIMEZONES

  return Array.from(new Set(['UTC', ...supported])).sort((a, b) => a.localeCompare(b))
}

const SUPPORTED_TIMEZONES = getSupportedTimezones()

function formatTimezoneLabel(timezone: string): string {
  if (timezone === LOCAL_TIMEZONE) {
    const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return localTimezone ? `Local timezone (${localTimezone})` : 'Local timezone'
  }

  return timezone.replace(/_/g, ' ')
}

function createTrigger(type: TriggerType): TriggerConfig {
  if (type === 'daily') {
    return { type, time: '09:00', timezone: 'local' }
  }

  if (type === 'every') {
    return { type, intervalMinutes: 60 }
  }

  if (type === 'cron') {
    return { type, expression: '0 9 * * *' }
  }

  return { type }
}

function SchedulePropertyRow({
  label,
  testId,
  children
}: {
  label: string
  testId: string
  children: ReactElement
}): ReactElement {
  return (
    <div
      className="grid grid-cols-[minmax(5.5rem,auto)_minmax(0,1fr)] items-start gap-2 px-3 py-2"
      data-testid={testId}
    >
      <WorkspaceTextFade className="pt-1 text-sm font-medium text-muted-foreground">
        {label}
      </WorkspaceTextFade>
      <div className="min-w-0 max-w-full overflow-x-auto text-xs" data-testid={`${testId}-value`}>
        <div className="flex w-max min-w-full flex-nowrap items-start justify-start gap-1">
          {children}
        </div>
      </div>
    </div>
  )
}

function getPermissionSummary(permissions: SchedulePermission[]): string {
  if (permissions.length === 0) {
    return 'None selected'
  }

  return `${permissions.length} selected`
}

function RuntimeValue({ runtime }: { runtime: RuntimeType }): ReactElement {
  const Icon = runtime === 'javascript' ? JavaScript : Python
  const label = runtime === 'javascript' ? 'JavaScript' : 'Python'
  const iconClassName =
    runtime === 'javascript'
      ? 'shrink-0 text-[#b88600] dark:text-[#f7df1e]'
      : 'shrink-0 text-[#3776ab] dark:text-[#4b9cd3]'

  return (
    <span className="inline-flex min-w-0 items-center gap-2 whitespace-nowrap">
      <Icon
        size={14}
        className={iconClassName}
        aria-hidden="true"
        data-testid={`scheduling-runtime-icon-${runtime}`}
      />
      <WorkspaceTextFade>{label}</WorkspaceTextFade>
    </span>
  )
}

function PermissionPopover({
  permissions,
  onTogglePermission
}: {
  permissions: SchedulePermission[]
  onTogglePermission: (permission: SchedulePermission, enabled: boolean) => void
}): ReactElement {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 rounded-[var(--radius-button-pill)] text-xs"
          aria-label="Configure permissions"
          data-testid="scheduling-permissions-trigger"
        >
          <WorkspaceTextFade className="min-w-0 flex-1">
            {getPermissionSummary(permissions)}
          </WorkspaceTextFade>
          <ChevronDown aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 p-3"
        data-testid="scheduling-permissions-popover"
      >
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Permissions</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Select the capabilities this automation can use.
            </p>
          </div>
          <div className="space-y-1">
            {PERMISSION_OPTIONS.map((option) => {
              const checked = permissions.includes(option.value)
              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => onTogglePermission(option.value, value === true)}
                    aria-label={option.label}
                    data-testid={`scheduling-permission:${option.value}`}
                  />
                  <span className="min-w-0">
                    <WorkspaceTextFade className="text-sm font-medium">
                      {option.label}
                    </WorkspaceTextFade>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function SchedulePropertiesPanel({
  draft,
  secretNames,
  onChange,
  onEnabledChange,
  onTriggerChange,
  onTogglePermission,
  onSaveSecret,
  onDeleteSecret
}: SchedulePropertiesPanelProps): ReactElement {
  const dailyTrigger = draft.trigger.type === 'daily' ? draft.trigger : null
  const showCron = draft.trigger.type === 'cron'
  const [secretsDialogOpen, setSecretsDialogOpen] = useState(false)
  const secretRefs = draft.secretRefs ?? []
  const selectedTimezone = dailyTrigger?.timezone ?? LOCAL_TIMEZONE
  const timezoneOptions = Array.from(
    new Set(
      selectedTimezone === LOCAL_TIMEZONE
        ? [LOCAL_TIMEZONE, ...SUPPORTED_TIMEZONES]
        : [LOCAL_TIMEZONE, selectedTimezone, ...SUPPORTED_TIMEZONES]
    )
  )

  const onToggleSecretRef = (name: string, enabled: boolean): void => {
    const nextRefs = enabled
      ? Array.from(new Set([...secretRefs, name]))
      : secretRefs.filter((item) => item !== name)
    onChange({ secretRefs: nextRefs })
  }

  return (
    <>
      <CollapsibleWorkspacePanelSection
        data-testid="scheduling-properties-panel"
        heading="Automation properties"
      >
        <div data-testid="scheduling-property-rows">
          <SchedulePropertyRow label="Runtime" testId="scheduling-property-runtime">
            <SelectionPopover
              selectionMode="single"
              value={draft.runtime}
              options={[
                {
                  value: 'python',
                  label: <RuntimeValue runtime="python" />,
                  searchText: 'python'
                },
                {
                  value: 'javascript',
                  label: <RuntimeValue runtime="javascript" />,
                  searchText: 'javascript'
                }
              ]}
              onValueChange={(value) => onChange({ runtime: value as RuntimeType })}
              label="Runtime"
              searchPlaceholder="Search runtimes"
              triggerProps={{
                id: 'scheduling-runtime',
                'data-testid': 'scheduling-runtime',
                'aria-label': 'Runtime',
                className: 'h-7 w-fit min-w-40 text-xs'
              }}
            />
          </SchedulePropertyRow>
          <SchedulePropertyRow label="Frequency" testId="scheduling-property-frequency">
            <SelectionPopover
              selectionMode="single"
              value={draft.trigger.type}
              options={[
                { value: 'manual', label: 'Manually' },
                { value: 'daily', label: 'Daily' },
                { value: 'every', label: 'At an interval' },
                { value: 'on_app_start', label: 'When app starts' },
                ...(showCron ? [{ value: 'cron', label: 'Cron (legacy)' }] : [])
              ]}
              onValueChange={(value) => onTriggerChange(createTrigger(value as TriggerType))}
              label="Frequency"
              searchPlaceholder="Search frequencies"
              triggerProps={{
                id: 'scheduling-trigger',
                'data-testid': 'scheduling-trigger',
                'aria-label': 'Frequency',
                className: 'h-7 w-fit min-w-40 text-xs'
              }}
            />
          </SchedulePropertyRow>
          {dailyTrigger ? (
            <>
              <SchedulePropertyRow label="Time" testId="scheduling-property-time">
                <Input
                  id="scheduling-daily-time"
                  data-testid="scheduling-daily-time"
                  type="time"
                  value={dailyTrigger.time ?? '09:00'}
                  onChange={(event) =>
                    onTriggerChange({ ...dailyTrigger, time: event.target.value })
                  }
                  className="h-7 w-fit min-w-40 text-xs"
                />
              </SchedulePropertyRow>
              <SchedulePropertyRow label="Timezone" testId="scheduling-property-timezone">
                <SelectionPopover
                  selectionMode="single"
                  value={selectedTimezone}
                  options={timezoneOptions.map((timezone) => ({
                    value: timezone,
                    label: formatTimezoneLabel(timezone),
                    searchText: `${timezone} ${formatTimezoneLabel(timezone)}`
                  }))}
                  onValueChange={(value) => onTriggerChange({ ...dailyTrigger, timezone: value })}
                  label="Timezone"
                  searchPlaceholder="Search timezones"
                  triggerProps={{
                    id: 'scheduling-timezone',
                    'data-testid': 'scheduling-timezone',
                    'aria-label': 'Timezone',
                    className: 'h-7 w-fit min-w-40 text-xs'
                  }}
                />
              </SchedulePropertyRow>
            </>
          ) : null}
          <SchedulePropertyRow label="Enabled" testId="scheduling-property-enabled">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <Switch
                checked={draft.enabled}
                onCheckedChange={onEnabledChange}
                aria-label="Enable automation"
                data-testid="scheduling-enabled"
              />
              <span>{draft.enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          </SchedulePropertyRow>
          <SchedulePropertyRow label="Permissions" testId="scheduling-property-permissions">
            <PermissionPopover
              permissions={draft.permissions}
              onTogglePermission={onTogglePermission}
            />
          </SchedulePropertyRow>
          <SchedulePropertyRow label="Secrets" testId="scheduling-property-secrets">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-[var(--radius-button-pill)] text-xs"
                onClick={() => setSecretsDialogOpen(true)}
                data-testid="scheduling-manage-secrets"
              >
                <Shield aria-hidden="true" />
                Manage secrets
              </Button>
              {secretRefs.length > 0 ? (
                <span
                  className="text-xs text-muted-foreground"
                  data-testid="scheduling-secret-reference-count"
                >
                  {`${secretRefs.length} attached`}
                </span>
              ) : null}
            </div>
          </SchedulePropertyRow>
          {draft.permissions.includes('useSecrets') && secretRefs.length === 0 ? (
            <p
              className="px-3 pb-2 text-xs text-destructive"
              data-testid="scheduling-secrets-error"
            >
              Attach at least one configured secret before saving this automation.
            </p>
          ) : null}
          <SchedulePropertyRow label="Output" testId="scheduling-property-output">
            <SelectionPopover
              selectionMode="single"
              value={draft.outputMode}
              options={[
                { value: 'review_before_apply', label: 'Review before apply' },
                { value: 'auto_apply', label: 'Auto apply' }
              ]}
              onValueChange={(value) =>
                onChange({ outputMode: value as 'auto_apply' | 'review_before_apply' })
              }
              label="Output mode"
              searchPlaceholder="Search output modes"
              triggerProps={{
                id: 'scheduling-output-mode',
                'data-testid': 'scheduling-output-mode',
                'aria-label': 'Output mode',
                className: 'h-7 w-fit min-w-40 text-xs'
              }}
            />
          </SchedulePropertyRow>
        </div>
      </CollapsibleWorkspacePanelSection>

      <ScheduleSecretsDialog
        open={secretsDialogOpen}
        onOpenChange={setSecretsDialogOpen}
        secretNames={secretNames}
        secretRefs={secretRefs}
        onToggleSecretRef={onToggleSecretRef}
        onSaveSecret={onSaveSecret}
        onDeleteSecret={onDeleteSecret}
      />
    </>
  )
}
