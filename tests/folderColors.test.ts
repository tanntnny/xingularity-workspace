import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  FOLDER_COLOR_PALETTE,
  normalizeFolderColors,
  removeFolderColors,
  remapFolderColors
} from '../src/shared/folderColors'
import { NotebookFolderIcon } from '../src/renderer/src/components/ui/notebook-folder-icon'
import {
  buildFolderColorNativeMenuItems,
  createFolderColorMenuItem,
  parseFolderColorAction
} from '../src/renderer/src/lib/folderColorMenu'

describe('folder colors', () => {
  it('normalizes supported colors and rejects unsafe or unsupported entries', () => {
    expect(
      normalizeFolderColors({
        'Projects\\Alpha': FOLDER_COLOR_PALETTE[0].toUpperCase(),
        '/absolute': FOLDER_COLOR_PALETTE[1],
        '../outside': FOLDER_COLOR_PALETTE[2],
        'Projects/./Drafts': FOLDER_COLOR_PALETTE[3],
        unsupported: '#ffffff'
      })
    ).toEqual({ 'Projects/Alpha': FOLDER_COLOR_PALETTE[0] })
  })

  it('remaps nested colors with a folder rename or move', () => {
    const colors = {
      Projects: FOLDER_COLOR_PALETTE[0],
      'Projects/Alpha': FOLDER_COLOR_PALETTE[1],
      Other: FOLDER_COLOR_PALETTE[2]
    }

    expect(remapFolderColors(colors, 'Projects', 'Archive')).toEqual({
      Archive: FOLDER_COLOR_PALETTE[0],
      'Archive/Alpha': FOLDER_COLOR_PALETTE[1],
      Other: FOLDER_COLOR_PALETTE[2]
    })
  })

  it('removes a folder color and all descendant colors', () => {
    expect(
      removeFolderColors(
        {
          Archive: FOLDER_COLOR_PALETTE[0],
          'Archive/Alpha': FOLDER_COLOR_PALETTE[1],
          'Archive-legacy': FOLDER_COLOR_PALETTE[2],
          Other: FOLDER_COLOR_PALETTE[3]
        },
        ['Archive']
      )
    ).toEqual({
      'Archive-legacy': FOLDER_COLOR_PALETTE[2],
      Other: FOLDER_COLOR_PALETTE[3]
    })
  })

  it('renders the supplied closed and open folder geometry with a derived back tone', () => {
    const closed = renderToStaticMarkup(
      createElement(NotebookFolderIcon, { variant: 'closed', color: FOLDER_COLOR_PALETTE[0] })
    )
    const open = renderToStaticMarkup(
      createElement(NotebookFolderIcon, { variant: 'open', color: FOLDER_COLOR_PALETTE[0] })
    )

    expect(closed).toContain('viewBox="0 0 36 36"')
    expect(closed).toContain('linearGradient')
    expect(closed).toContain(`stop-color="${FOLDER_COLOR_PALETTE[0]}"`)
    expect(closed).toContain('d="M30 10')
    expect(open).toContain('d="M32.336 12')
    expect(open).not.toContain('d="M30 10')
  })

  it('uses a gray duotone and gradient when no folder color is assigned', () => {
    const markup = renderToStaticMarkup(createElement(NotebookFolderIcon))

    expect(markup).toContain('fill="#4b5563"')
    expect(markup).toContain('stop-color="#bec2ca"')
    expect(markup).toContain('stop-color="#9ca3af"')
  })

  it('builds renderer and native color controls with reset support', () => {
    const menu = createFolderColorMenuItem({
      testIdPrefix: 'folder-color:Archive',
      selectedColor: FOLDER_COLOR_PALETTE[0],
      onChange: () => undefined
    })
    const nativeItems = buildFolderColorNativeMenuItems(FOLDER_COLOR_PALETTE[0])

    expect(menu.label).toBe('Color')
    expect(menu.submenuClassName).toContain('grid-cols-4')
    expect(menu.submenu).toHaveLength(FOLDER_COLOR_PALETTE.length + 1)
    expect(menu.submenu?.[0]?.className).toContain('justify-center')
    expect(menu.submenu?.[FOLDER_COLOR_PALETTE.length]?.className).toContain('col-span-4')
    expect(parseFolderColorAction(`set-folder-color:${FOLDER_COLOR_PALETTE[0].slice(1)}`)).toBe(
      FOLDER_COLOR_PALETTE[0]
    )
    expect(parseFolderColorAction('reset-folder-color')).toBeNull()
    expect(nativeItems[0]?.submenu).toHaveLength(FOLDER_COLOR_PALETTE.length + 1)
  })
})
