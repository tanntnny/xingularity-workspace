import type { NativeMenuItemDescriptor } from '../../../shared/types'
import type { ActionMenuGroup, ActionMenuItemDefinition } from '../components/ui/action-menu'
import { Copy, FolderInput, Link, Pencil, Trash2 } from '../components/ui/icons'
import { Shortcut } from '../components/ui/kbd'

export interface NoteMenuActions {
  onDelete: () => void
  onRename?: () => void
  onDuplicate?: () => void
  onMoveTo?: (folder: string) => void
  onCopyLink?: () => void
}

export function getNoteMenuGroups(
  actions: NoteMenuActions,
  moveFolders: readonly string[] = []
): ActionMenuGroup[] {
  const editingItems: ActionMenuItemDefinition[] = []
  const organizationItems: ActionMenuItemDefinition[] = []

  if (actions.onRename) {
    editingItems.push({
      id: 'rename',
      label: 'Rename',
      icon: <Pencil aria-hidden="true" />,
      onSelect: actions.onRename
    })
  }

  if (actions.onDuplicate) {
    editingItems.push({
      id: 'duplicate',
      label: 'Duplicate',
      icon: <Copy aria-hidden="true" />,
      onSelect: actions.onDuplicate
    })
  }

  if (actions.onMoveTo && moveFolders.length > 0) {
    organizationItems.push({
      id: 'move',
      label: 'Move to…',
      icon: <FolderInput aria-hidden="true" />,
      submenu: moveFolders.map((folder) => ({
        id: `move:${folder}`,
        label: folder,
        onSelect: () => actions.onMoveTo?.(folder)
      }))
    })
  }

  if (actions.onCopyLink) {
    organizationItems.push({
      id: 'copy-link',
      label: 'Copy link',
      icon: <Link aria-hidden="true" />,
      onSelect: actions.onCopyLink
    })
  }

  return [
    { id: 'editing', items: editingItems },
    { id: 'organization', items: organizationItems },
    {
      id: 'destructive',
      items: [
        {
          id: 'delete',
          label: 'Delete',
          icon: <Trash2 aria-hidden="true" />,
          destructive: true,
          shortcut: <Shortcut keys={['cmd', 'backspace']} />,
          onSelect: actions.onDelete
        }
      ]
    }
  ]
}

export function buildNoteNativeMenuItems(options: {
  canRename?: boolean
  canDuplicate?: boolean
  canCopyLink?: boolean
  moveFolders?: readonly string[]
}): NativeMenuItemDescriptor[] {
  const editingItems: NativeMenuItemDescriptor[] = []
  const organizationItems: NativeMenuItemDescriptor[] = []

  if (options.canRename) {
    editingItems.push({ id: 'rename', label: 'Rename' })
  }
  if (options.canDuplicate) {
    editingItems.push({ id: 'duplicate', label: 'Duplicate' })
  }
  if (options.moveFolders && options.moveFolders.length > 0) {
    organizationItems.push({
      type: 'submenu',
      label: 'Move to…',
      submenu: options.moveFolders.map((folder) => ({
        id: `move:${folder}`,
        label: folder
      }))
    })
  }
  if (options.canCopyLink) {
    organizationItems.push({ id: 'copy-link', label: 'Copy link' })
  }

  const groups: NativeMenuItemDescriptor[][] = [
    editingItems,
    organizationItems,
    [{ id: 'delete', label: 'Delete', accelerator: 'Command+Backspace' }]
  ]

  return groups.reduce<NativeMenuItemDescriptor[]>((items, group) => {
    if (group.length === 0) {
      return items
    }
    if (items.length > 0) {
      items.push({ type: 'separator' })
    }
    items.push(...group)
    return items
  }, [])
}
