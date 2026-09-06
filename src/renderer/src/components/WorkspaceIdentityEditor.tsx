import type { ReactElement, Ref } from 'react'

import type { ProjectIconStyle } from '../../../shared/types'
import { cn } from '../lib/utils'
import { ProjectIconPicker } from './ProjectIconPicker'
import { Input } from './ui/input'

export interface WorkspaceIdentityEditorProps {
  name: string
  icon: ProjectIconStyle
  onNameChange: (name: string) => void
  onNameCommit: () => void
  onIconChange: (icon: ProjectIconStyle) => void
  entityLabel?: string
  testIdPrefix?: string
  nameInputRef?: Ref<HTMLInputElement>
  inputClassName?: string
}

export function WorkspaceIdentityEditor({
  name,
  icon,
  onNameChange,
  onNameCommit,
  onIconChange,
  entityLabel = 'view',
  testIdPrefix = 'workspace-view',
  nameInputRef,
  inputClassName
}: WorkspaceIdentityEditorProps): ReactElement {
  const label = `${entityLabel[0]?.toUpperCase() ?? ''}${entityLabel.slice(1)}`

  return (
    <div data-testid={`${testIdPrefix}-identity`}>
      <div className="space-y-3" data-testid={`${testIdPrefix}-header`}>
        <div className="flex items-center gap-3" data-testid={`${testIdPrefix}-icon-row`}>
          <ProjectIconPicker
            icon={icon}
            onChange={onIconChange}
            entityLabel={entityLabel}
            testId={`${testIdPrefix}-icon-trigger`}
            iconOptionTestIdPrefix={`${testIdPrefix}-icon-option`}
          />
        </div>
        <Input
          ref={nameInputRef}
          data-testid={`${testIdPrefix}-name-row`}
          id={`${testIdPrefix}-name`}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          onBlur={onNameCommit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onNameCommit()
            }
          }}
          className={cn(
            'h-auto border-0 bg-transparent px-0 text-3xl font-bold shadow-none focus-visible:ring-0',
            inputClassName
          )}
          aria-label={`${label} name`}
        />
      </div>
    </div>
  )
}
