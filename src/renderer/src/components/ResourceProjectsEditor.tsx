import { useId, type ReactElement } from 'react'

import type { Project } from '../../../shared/types'
import { cn } from '../lib/utils'
import { getProjectChipOptions, NO_PROJECT_VALUE } from '../lib/statusChipMeta'
import { StatusChipSelect } from './ui/status-chip-select'
import type { StatusChipSurface } from './ui/status-chip'

interface ResourceProjectsEditorProps {
  value: readonly string[]
  projects: readonly Project[]
  onChange: (projectIds: string[]) => void
  label?: string
  testId?: string
  className?: string
  surface?: StatusChipSurface
}

export function ResourceProjectsEditor({
  value,
  projects,
  onChange,
  label = 'Projects',
  testId = 'resource-projects-editor',
  className,
  surface = 'pill'
}: ResourceProjectsEditorProps): ReactElement {
  const labelId = useId()
  const projectOptions = getProjectChipOptions(projects)
  const selectedProjectId = value[0] ?? NO_PROJECT_VALUE

  const handleValueChange = (projectId: string): void => {
    onChange(projectId === NO_PROJECT_VALUE ? [] : [projectId])
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
      <StatusChipSelect
        value={selectedProjectId}
        options={projectOptions}
        onValueChange={handleValueChange}
        label={label}
        surface={surface}
        wrapLabel
        title={label}
        aria-label={`${label} selection`}
        data-testid={`${testId}-trigger`}
        className="max-w-full justify-start rounded-[var(--radius-button-pill)]"
      />
    </div>
  )
}
