import { useState, type ReactElement } from 'react'

import { getTaskGroupLabel, TASK_GROUP_BY_OPTIONS, type TaskGroupBy } from '../lib/taskRows'
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command'
import { Rows3 } from './ui/icons'
import { ResponsivePicker } from './ui/responsive-picker'
import { WorkspaceIconButton } from './ui/document-workspace'
import { WorkspaceTextFade } from './ui/workspace-text-fade'

export interface TaskGroupByPopoverProps {
  value: TaskGroupBy
  onChange: (value: TaskGroupBy) => void
}

export function TaskGroupByPopover({ value, onChange }: TaskGroupByPopoverProps): ReactElement {
  const [open, setOpen] = useState(false)
  const isGrouped = value !== 'none'
  const groupLabel = getTaskGroupLabel(value)

  return (
    <ResponsivePicker
      open={open}
      onOpenChange={setOpen}
      trigger={
        <WorkspaceIconButton
          label={isGrouped ? `Group: ${groupLabel}` : 'Group by'}
          counter={isGrouped ? 1 : 0}
          icon={<Rows3 aria-hidden="true" />}
          active={isGrouped}
          bordered
          aria-label={isGrouped ? `Group tasks by ${groupLabel}` : 'Group tasks'}
          data-testid="task-group-by-trigger"
        />
      }
      title="Group tasks"
      description="Choose one field to organize the task table."
      selectedCount={isGrouped ? 1 : 0}
      onClear={() => onChange('none')}
      clearLabel="Clear grouping"
      clearTestId="task-group-by-clear"
      testId="task-group-by"
      ariaLabel="Task grouping options"
      contentClassName="w-[min(24rem,calc(100vw-1rem))]"
    >
      <Command className="min-h-0 rounded-none bg-transparent" shouldFilter>
        <CommandInput
          placeholder="Search grouping options"
          aria-label="Search task grouping options"
          data-responsive-picker-input="true"
        />
        <CommandList className="max-h-[min(24rem,calc(70vh-10rem))] overscroll-contain px-2 pb-2">
          <CommandGroup heading="Group by" className="px-0 py-1 [&_[cmdk-group-heading]]:px-2">
            {TASK_GROUP_BY_OPTIONS.map((option) => {
              const selected = option.value === value

              return (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.value}`}
                  onSelect={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  aria-label={`Group tasks by ${option.label}${selected ? ', selected' : ''}`}
                  aria-checked={selected}
                  data-checked={selected ? 'true' : 'false'}
                  data-testid={`task-group-by-option:${option.value}`}
                  className="min-h-9 cursor-pointer rounded-[var(--radius-control)] px-2 text-sm text-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
                >
                  <WorkspaceTextFade className="min-w-0 flex-1">{option.label}</WorkspaceTextFade>
                  {selected ? <span className="text-xs text-primary">Selected</span> : null}
                </CommandItem>
              )
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </ResponsivePicker>
  )
}
