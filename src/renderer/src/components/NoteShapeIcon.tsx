import { ReactElement } from 'react'
import {
  BookOpen,
  Briefcase,
  FlaskConical,
  FolderKanban,
  Lightbulb,
  Package,
  Rocket,
  Target
} from 'lucide-react'
import { ProjectIconStyle } from '../../../shared/types'
import { resolveProjectIconGlyph, resolveProjectIconSet } from '../../../shared/projectIcons'
import { cn } from '../lib/utils'

interface NoteShapeIconProps {
  icon: ProjectIconStyle
  size?: number
  className?: string
}

export function NoteShapeIcon({ icon, size = 16, className }: NoteShapeIconProps): ReactElement {
  const iconSet = resolveProjectIconSet(icon)
  const iconGlyph = resolveProjectIconGlyph(icon)
  const isFilled = icon.variant === 'filled'
  const glyphColor = isFilled ? '#ffffff' : icon.color
  const backgroundColor = isFilled ? icon.color : `${icon.color}1f`
  const borderColor = icon.color
  const glyphSize = Math.max(10, Math.round(size * 0.58))

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[35%] border',
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor,
        borderColor
      }}
    >
      {iconSet === 'shape' ? (
        <svg width={glyphSize} height={glyphSize} viewBox="0 0 24 24" fill="none">
          {iconGlyph === 'circle' ? <circle cx="12" cy="12" r="6" fill={glyphColor} /> : null}
          {iconGlyph === 'square' ? (
            <rect x="6" y="6" width="12" height="12" rx="2.5" fill={glyphColor} />
          ) : null}
          {iconGlyph === 'triangle' ? <polygon points="12,6 18,18 6,18" fill={glyphColor} /> : null}
          {iconGlyph === 'diamond' ? (
            <polygon points="12,5 19,12 12,19 5,12" fill={glyphColor} />
          ) : null}
          {iconGlyph === 'hex' ? (
            <polygon points="8,6.5 16,6.5 20,12 16,17.5 8,17.5 4,12" fill={glyphColor} />
          ) : null}
        </svg>
      ) : (
        renderLucideGlyph(String(iconGlyph), glyphSize, glyphColor)
      )}
    </span>
  )
}

function renderLucideGlyph(name: string, size: number, color: string): ReactElement {
  const props = {
    size,
    color,
    strokeWidth: 2.1
  }

  if (name === 'folder-kanban') {
    return <FolderKanban {...props} />
  }
  if (name === 'rocket') {
    return <Rocket {...props} />
  }
  if (name === 'lightbulb') {
    return <Lightbulb {...props} />
  }
  if (name === 'target') {
    return <Target {...props} />
  }
  if (name === 'book-open') {
    return <BookOpen {...props} />
  }
  if (name === 'package') {
    return <Package {...props} />
  }
  if (name === 'flask-conical') {
    return <FlaskConical {...props} />
  }

  return <Briefcase {...props} />
}
