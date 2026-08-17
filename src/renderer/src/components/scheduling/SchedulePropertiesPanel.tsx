import { type ReactElement } from 'react'
import { ChevronDown, JavaScript, Python } from '../ui/icons'
import {
  Button,
  Checkbox,
  CollapsibleWorkspacePanelSection,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch
} from '../ui'
import type {
  RuntimeType,
  SchedulePermission,
  TriggerConfig,
  TriggerType
} from '../../../../shared/scheduleTypes'
import type { SchedulePropertiesPanelProps } from './types'

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
      <span className="pt-1 text-sm font-medium text-muted-foreground">{label}</span>
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
    <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap">
      <Icon
        size={14}
        className={iconClassName}
        aria-hidden="true"
        data-testid={`scheduling-runtime-icon-${runtime}`}
      />
      <span className="truncate">{label}</span>
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
          <span>{getPermissionSummary(permissions)}</span>
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
                  className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-accent"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => onTogglePermission(option.value, value === true)}
                    aria-label={option.label}
                    data-testid={`scheduling-permission:${option.value}`}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{option.label}</span>
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
  onChange,
  onEnabledChange,
  onTriggerChange,
  onTogglePermission
}: SchedulePropertiesPanelProps): ReactElement {
  const dailyTrigger = draft.trigger.type === 'daily' ? draft.trigger : null
  const showCron = draft.trigger.type === 'cron'

  return (
    <CollapsibleWorkspacePanelSection
      data-testid="scheduling-properties-panel"
      heading="Automation properties"
    >
      <div data-testid="scheduling-property-rows">
        <SchedulePropertyRow label="Runtime" testId="scheduling-property-runtime">
          <Select
            value={draft.runtime}
            onValueChange={(value) => onChange({ runtime: value as RuntimeType })}
          >
            <SelectTrigger
              id="scheduling-runtime"
              data-testid="scheduling-runtime"
              className="h-7 w-fit min-w-40 text-xs"
            >
              <SelectValue asChild>
                <RuntimeValue runtime={draft.runtime} />
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="python">
                <RuntimeValue runtime="python" />
              </SelectItem>
              <SelectItem value="javascript">
                <RuntimeValue runtime="javascript" />
              </SelectItem>
            </SelectContent>
          </Select>
        </SchedulePropertyRow>
        <SchedulePropertyRow label="Frequency" testId="scheduling-property-frequency">
          <Select
            value={draft.trigger.type}
            onValueChange={(value) => onTriggerChange(createTrigger(value as TriggerType))}
          >
            <SelectTrigger
              id="scheduling-trigger"
              data-testid="scheduling-trigger"
              className="h-7 w-fit min-w-40 text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manually</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="every">At an interval</SelectItem>
              <SelectItem value="on_app_start">When app starts</SelectItem>
              {showCron ? <SelectItem value="cron">Cron (legacy)</SelectItem> : null}
            </SelectContent>
          </Select>
        </SchedulePropertyRow>
        {dailyTrigger ? (
          <>
            <SchedulePropertyRow label="Time" testId="scheduling-property-time">
              <Input
                id="scheduling-daily-time"
                data-testid="scheduling-daily-time"
                type="time"
                value={dailyTrigger.time ?? '09:00'}
                onChange={(event) => onTriggerChange({ ...dailyTrigger, time: event.target.value })}
                className="h-7 w-fit min-w-40 text-xs"
              />
            </SchedulePropertyRow>
            <SchedulePropertyRow label="Timezone" testId="scheduling-property-timezone">
              <Input
                id="scheduling-timezone"
                data-testid="scheduling-timezone"
                value="Local timezone"
                readOnly
                className="h-7 w-fit min-w-40 text-xs"
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
        <SchedulePropertyRow label="Output" testId="scheduling-property-output">
          <Select
            value={draft.outputMode}
            onValueChange={(value) =>
              onChange({ outputMode: value as 'auto_apply' | 'review_before_apply' })
            }
          >
            <SelectTrigger
              id="scheduling-output-mode"
              data-testid="scheduling-output-mode"
              className="h-7 w-fit min-w-40 text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="review_before_apply">Review before apply</SelectItem>
              <SelectItem value="auto_apply">Auto apply</SelectItem>
            </SelectContent>
          </Select>
        </SchedulePropertyRow>
      </div>
    </CollapsibleWorkspacePanelSection>
  )
}
