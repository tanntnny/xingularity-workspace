import { createElement, forwardRef, type SVGAttributes } from 'react'
import type { IconNode } from '@tabler/icons-react'
import type { ProjectIconVariant } from '../../../../shared/types'
import { cn } from '../../lib/utils'

export interface ProjectIconSvgProps extends Omit<
  SVGAttributes<SVGSVGElement>,
  'color' | 'stroke' | 'title'
> {
  iconNode: IconNode
  glyph: string
  variant: ProjectIconVariant
  size?: number | string
  color?: string
  stroke?: number | string
  title?: string
}

export const ProjectIconSvg = forwardRef<SVGSVGElement, ProjectIconSvgProps>(
  (
    {
      iconNode,
      glyph,
      variant,
      size = 24,
      color = 'currentColor',
      stroke = 2,
      className,
      title,
      children,
      ...props
    },
    ref
  ) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn('tabler-icon', `icon-tabler-${glyph}`, className)}
      {...(variant === 'filled'
        ? { fill: color, stroke: 'none' }
        : {
            fill: 'none',
            stroke: color,
            strokeWidth: stroke,
            strokeLinecap: 'round',
            strokeLinejoin: 'round'
          })}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {iconNode.map(([element, attributes], index) =>
        createElement(element as string, {
          ...attributes,
          key: `${glyph}:${variant}:${index}`
        })
      )}
      {children}
    </svg>
  )
)

ProjectIconSvg.displayName = 'ProjectIconSvg'
