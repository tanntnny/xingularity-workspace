import { describe, expect, it } from 'vitest'

import {
  menuItemDestructiveClassName,
  menuSubtriggerDestructiveClassName
} from '../src/renderer/src/components/ui/menu-variants'

describe('menu destructive variants', () => {
  it('uses the standard foreground and hover treatment for items', () => {
    expect(menuItemDestructiveClassName).toContain('hover:!bg-surface-subtle-hover')
    expect(menuItemDestructiveClassName).toContain('focus:!bg-surface-subtle-hover')
    expect(menuItemDestructiveClassName).toContain('[&>svg]:!text-muted-foreground')
    expect(menuItemDestructiveClassName).not.toContain('text-destructive')
  })

  it('uses the standard foreground and hover treatment for submenu triggers', () => {
    expect(menuSubtriggerDestructiveClassName).toContain(
      'data-[state=open]:!bg-surface-subtle-hover'
    )
    expect(menuSubtriggerDestructiveClassName).toContain('[&_svg]:!text-muted-foreground')
    expect(menuSubtriggerDestructiveClassName).not.toContain('text-destructive')
  })
})
