import { Check, Palette } from '../components/ui/icons'
import type { ActionMenuItemDefinition } from '../components/ui/action-menu'
import type { NativeMenuItemDescriptor } from '../../../shared/types'
import {
  FOLDER_COLOR_PALETTE,
  normalizeFolderColor,
  type FolderColor
} from '../../../shared/folderColors'

export interface FolderColorMenuOptions {
  testIdPrefix: string
  selectedColor?: FolderColor | null
  onChange: (color: FolderColor | null) => void
}

export function createFolderColorMenuItem({
  testIdPrefix,
  selectedColor,
  onChange
}: FolderColorMenuOptions): ActionMenuItemDefinition {
  const currentColor = normalizeFolderColor(selectedColor)
  const colorItems = FOLDER_COLOR_PALETTE.map((color) => ({
    id: `set-folder-color:${color.slice(1)}`,
    label: <span className="sr-only">Set folder color to {color.toUpperCase()}</span>,
    icon: (
      <span
        aria-hidden="true"
        className="size-5 shrink-0 rounded-md border border-black/20 shadow-sm"
        style={{ backgroundColor: color }}
      >
        {currentColor === color ? <Check className="size-3 text-white drop-shadow" /> : null}
      </span>
    ),
    className: 'justify-center p-1.5 [&>span:last-child]:flex-none',
    contextTestId: `${testIdPrefix}-option:${color.slice(1)}-context`,
    dropdownTestId: `${testIdPrefix}-option:${color.slice(1)}-dropdown`,
    onSelect: () => onChange(color)
  }))

  return {
    id: 'folder-color',
    label: 'Color',
    icon: <Palette aria-hidden="true" />,
    contextTestId: `${testIdPrefix}-context`,
    dropdownTestId: `${testIdPrefix}-dropdown`,
    submenuClassName: 'grid grid-cols-4 gap-1 p-2',
    submenu: [
      ...colorItems,
      {
        id: 'reset-folder-color',
        label: 'Reset to default',
        trailing: currentColor ? null : <Check aria-hidden="true" />,
        className: 'col-span-4 mt-1 justify-center border-t border-border pt-2',
        contextTestId: `${testIdPrefix}-reset-context`,
        dropdownTestId: `${testIdPrefix}-reset-dropdown`,
        onSelect: () => onChange(null)
      }
    ]
  }
}

export function buildFolderColorNativeMenuItems(
  selectedColor?: FolderColor | null
): NativeMenuItemDescriptor[] {
  const currentColor = normalizeFolderColor(selectedColor)
  return [
    {
      type: 'submenu',
      label: 'Color',
      submenu: [
        ...FOLDER_COLOR_PALETTE.map((color) => ({
          id: `set-folder-color:${color.slice(1)}`,
          type: 'checkbox' as const,
          label: color.toUpperCase(),
          checked: currentColor === color
        })),
        {
          id: 'reset-folder-color',
          type: 'checkbox',
          label: 'Reset to default',
          checked: !currentColor
        }
      ]
    }
  ]
}

export function parseFolderColorAction(actionId: string): FolderColor | null | undefined {
  if (actionId === 'reset-folder-color') {
    return null
  }

  if (!actionId.startsWith('set-folder-color:')) {
    return undefined
  }

  return normalizeFolderColor(`#${actionId.slice('set-folder-color:'.length)}`)
}
