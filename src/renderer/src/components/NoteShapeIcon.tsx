import type { CSSProperties, ReactElement } from 'react'
import type { ProjectIconStyle } from '../../../shared/types'
import { resolveProjectIconGlyph } from '../../../shared/projectIcons'
import { cn } from '../lib/utils'
import { getProjectIconCatalogEntry } from '../lib/projectIconCatalog'
import { ProjectIconSvg } from './ui/project-icon'

export type ProjectIconSurface = 'none' | 'subtle'

interface NoteShapeIconProps {
  icon: ProjectIconStyle
  size?: number | string
  className?: string
  surface?: ProjectIconSurface
}

const PROJECT_ICON_SURFACE_GLYPH_RATIO = 0.6

export function NoteShapeIcon({
  icon,
  size = 18,
  className,
  surface = 'none'
}: NoteShapeIconProps): ReactElement {
  const catalogEntry = getProjectIconCatalogEntry(resolveProjectIconGlyph(icon), icon.variant)
  const glyphSize =
    surface === 'subtle'
      ? typeof size === 'number'
        ? Math.max(1, Math.round(size * PROJECT_ICON_SURFACE_GLYPH_RATIO))
        : `${PROJECT_ICON_SURFACE_GLYPH_RATIO}em`
      : size

  const iconStyle = {
    '--project-icon-color': icon.color,
    width: size,
    height: size
  } as CSSProperties

  return (
    <span
      aria-hidden="true"
      data-project-icon-surface={surface}
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        surface === 'subtle' && 'project-icon-surface rounded-[var(--radius-button)]',
        className
      )}
      style={iconStyle}
    >
      <ProjectIconSvg
        iconNode={catalogEntry.iconNode}
        glyph={catalogEntry.glyph}
        variant={catalogEntry.variant}
        size={glyphSize}
        style={{
          color: 'var(--project-icon-color)'
        }}
        color="var(--project-icon-color)"
        aria-hidden="true"
      />
    </span>
  )
}
