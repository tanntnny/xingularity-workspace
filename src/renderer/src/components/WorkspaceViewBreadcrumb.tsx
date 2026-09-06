import { useRef, useState, type ReactElement } from 'react'

import type { ProjectIconStyle, WorkspaceView } from '../../../shared/types'
import { WorkspaceIdentityEditor } from './WorkspaceIdentityEditor'
import {
  Breadcrumb,
  BreadcrumbButton,
  BreadcrumbItem,
  BreadcrumbLabel,
  BreadcrumbList,
  BreadcrumbSeparator
} from './ui/breadcrumb'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

export type WorkspaceViewIdentityUpdate = {
  name?: string
  icon?: ProjectIconStyle
}

export interface WorkspaceViewBreadcrumbProps {
  view: WorkspaceView
  onUpdateView: (update: WorkspaceViewIdentityUpdate) => void
}

export function WorkspaceViewBreadcrumb({
  view,
  onUpdateView
}: WorkspaceViewBreadcrumbProps): ReactElement {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(view.name)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const commitName = (): void => {
    const nextName = name.trim()
    if (nextName && nextName !== view.name) {
      setName(nextName)
      onUpdateView({ name: nextName })
    } else if (!nextName) {
      setName(view.name)
    } else {
      setName(nextName)
    }
  }

  const handleOpenChange = (nextOpen: boolean): void => {
    setOpen(nextOpen)
    if (nextOpen) {
      setName(view.name)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <Breadcrumb data-testid="workspace-view-breadcrumb">
        <BreadcrumbList className="text-muted-foreground">
          <BreadcrumbItem>
            <BreadcrumbLabel className="text-sm">View</BreadcrumbLabel>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="text-muted-foreground" />
          <BreadcrumbItem>
            <PopoverTrigger asChild>
              <BreadcrumbButton
                data-testid="workspace-view-breadcrumb-trigger"
                aria-label={`Edit view: ${view.name}`}
                aria-haspopup="dialog"
                aria-expanded={open}
                className="max-w-[320px] truncate text-sm font-semibold text-foreground"
              >
                <span className="block truncate">{view.name}</span>
              </BreadcrumbButton>
            </PopoverTrigger>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PopoverContent
        data-testid="workspace-view-edit-popover"
        aria-label="Edit view"
        align="start"
        sideOffset={8}
        className="w-[min(24rem,calc(100vw-1rem))] p-3"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          nameInputRef.current?.focus()
        }}
        onInteractOutside={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest('[data-icon-picker-content]')
          ) {
            event.preventDefault()
          }
        }}
      >
        <WorkspaceIdentityEditor
          name={name}
          icon={view.icon}
          onNameChange={setName}
          onNameCommit={commitName}
          onIconChange={(icon) => onUpdateView({ icon })}
          entityLabel="view"
          testIdPrefix="workspace-view"
          nameInputRef={nameInputRef}
          inputClassName="h-9 rounded-md border-input bg-transparent px-3 text-base font-medium shadow-none focus-visible:ring-1"
        />
      </PopoverContent>
    </Popover>
  )
}
