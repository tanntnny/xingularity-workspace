import { ReactElement } from 'react'
import {
  BookOpen,
  Briefcase,
  Calendar,
  Camera,
  FlaskConical,
  FolderKanban,
  Globe,
  Lightbulb,
  Megaphone,
  Monitor,
  Package,
  PenTool,
  Rocket,
  Shield,
  Sparkles,
  Target,
  type FilledIcon
} from './ui/icons'
import { ProjectIconStyle, ProjectIconSymbol } from '../../../shared/types'
import { resolveProjectIconGlyph } from '../../../shared/projectIcons'
import { cn } from '../lib/utils'

interface NoteShapeIconProps {
  icon: ProjectIconStyle
  size?: number
  className?: string
}

const PROJECT_ICON_COMPONENTS: Record<ProjectIconSymbol, FilledIcon> = {
  briefcase: Briefcase,
  'folder-kanban': FolderKanban,
  rocket: Rocket,
  lightbulb: Lightbulb,
  target: Target,
  'book-open': BookOpen,
  package: Package,
  'flask-conical': FlaskConical,
  sparkles: Sparkles,
  'pen-tool': PenTool,
  monitor: Monitor,
  megaphone: Megaphone,
  globe: Globe,
  shield: Shield,
  camera: Camera,
  calendar: Calendar
}

export function NoteShapeIcon({ icon, size = 16, className }: NoteShapeIconProps): ReactElement {
  const iconGlyph = resolveProjectIconGlyph(icon) as ProjectIconSymbol
  const ProjectIcon = PROJECT_ICON_COMPONENTS[iconGlyph] ?? Briefcase
  const glyphSize = Math.max(10, Math.round(size * 0.58))

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
      <ProjectIcon size={glyphSize} color="#ffffff" aria-hidden="true" />
    </span>
  )
}
