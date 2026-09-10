import { Fragment, type ReactElement, type ReactNode } from 'react'

import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger
} from './context-menu'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from './dropdown-menu'
import { cn } from '../../lib/utils'

export type ActionMenuVariant = 'context' | 'dropdown'

export interface ActionMenuItemDefinition {
  id: string
  label: ReactNode
  icon?: ReactNode
  trailing?: ReactNode
  shortcut?: ReactNode
  disabled?: boolean
  destructive?: boolean
  testId?: string
  contextTestId?: string
  dropdownTestId?: string
  className?: string
  submenuClassName?: string
  onSelect?: (event: Event) => void
  submenu?: readonly ActionMenuItemDefinition[]
}

export interface ActionMenuGroup {
  id: string
  items: readonly ActionMenuItemDefinition[]
}

export interface ActionMenuItemsProps {
  groups: readonly ActionMenuGroup[]
  variant: ActionMenuVariant
}

function ActionMenuLabel({ children }: { children: ReactNode }): ReactElement {
  const isTextLabel = typeof children === 'string' || typeof children === 'number'

  return <span className={cn('min-w-0 flex-1', isTextLabel && 'truncate')}>{children}</span>
}

export function ActionMenuItems({ groups, variant }: ActionMenuItemsProps): ReactElement {
  const visibleGroups = groups.filter((group) => group.items.length > 0)

  return (
    <>
      {visibleGroups.map((group, groupIndex) => (
        <Fragment key={group.id}>
          {groupIndex > 0 ? <MenuSeparator variant={variant} /> : null}
          {group.items.map((item) => (
            <ActionMenuItem key={item.id} item={item} variant={variant} />
          ))}
        </Fragment>
      ))}
    </>
  )
}

function ActionMenuItem({
  item,
  variant
}: {
  item: ActionMenuItemDefinition
  variant: ActionMenuVariant
}): ReactElement {
  if (item.submenu) {
    return <ActionMenuSubmenu item={item} variant={variant} />
  }

  const className = item.className

  if (variant === 'context') {
    return (
      <ContextMenuItem
        data-testid={item.contextTestId ?? item.testId}
        disabled={item.disabled}
        destructive={item.destructive}
        className={className}
        onSelect={item.onSelect}
      >
        {item.icon}
        <ActionMenuLabel>{item.label}</ActionMenuLabel>
        {item.trailing}
        {item.shortcut ? <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut> : null}
      </ContextMenuItem>
    )
  }

  return (
    <DropdownMenuItem
      data-testid={item.dropdownTestId ?? item.testId}
      disabled={item.disabled}
      destructive={item.destructive}
      className={className}
      onSelect={item.onSelect}
    >
      {item.icon}
      <ActionMenuLabel>{item.label}</ActionMenuLabel>
      {item.trailing}
      {item.shortcut ? <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut> : null}
    </DropdownMenuItem>
  )
}

function ActionMenuSubmenu({
  item,
  variant
}: {
  item: ActionMenuItemDefinition
  variant: ActionMenuVariant
}): ReactElement {
  const className = item.className

  if (variant === 'context') {
    return (
      <ContextMenuSub>
        <ContextMenuSubTrigger
          data-testid={item.contextTestId ?? item.testId}
          disabled={item.disabled}
          destructive={item.destructive}
          className={className}
        >
          {item.icon}
          <ActionMenuLabel>{item.label}</ActionMenuLabel>
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className={item.submenuClassName}>
          <ActionMenuItems
            variant="context"
            groups={[{ id: `${item.id}:items`, items: item.submenu ?? [] }]}
          />
        </ContextMenuSubContent>
      </ContextMenuSub>
    )
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        data-testid={item.dropdownTestId ?? item.testId}
        disabled={item.disabled}
        destructive={item.destructive}
        className={className}
      >
        {item.icon}
        <ActionMenuLabel>{item.label}</ActionMenuLabel>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className={item.submenuClassName}>
        <ActionMenuItems
          variant="dropdown"
          groups={[{ id: `${item.id}:items`, items: item.submenu ?? [] }]}
        />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

function MenuSeparator({ variant }: { variant: ActionMenuVariant }): ReactElement {
  return variant === 'context' ? <ContextMenuSeparator /> : <DropdownMenuSeparator />
}
