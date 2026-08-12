import { createElement, ReactElement } from 'react'
import type { ProjectIconStyle } from '../../../shared/types'
import { resolveProjectIconGlyph } from '../../../shared/projectIcons'
import { cn } from '../lib/utils'
import { getProjectIconComponent } from '../lib/projectIconCatalog'

interface NoteShapeIconProps {
  icon: ProjectIconStyle
  size?: number | string
  className?: string
}

const PROJECT_ICON_GLYPH_RATIO = 0.58

export function NoteShapeIcon({ icon, size = 16, className }: NoteShapeIconProps): ReactElement {
  const ProjectIcon = getProjectIconComponent(resolveProjectIconGlyph(icon))
  const glyphSize =
    typeof size === 'number'
      ? Math.max(1, Math.round(size * PROJECT_ICON_GLYPH_RATIO))
      : `${PROJECT_ICON_GLYPH_RATIO}em`

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md border',
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: icon.color,
        borderColor: icon.color
      }}
    >
      {createElement(ProjectIcon, {
        size: glyphSize,
        style: { width: glyphSize, height: glyphSize },
        color: 'var(--icon-on-color)',
        'aria-hidden': true
      })}
    </span>
  )
}
