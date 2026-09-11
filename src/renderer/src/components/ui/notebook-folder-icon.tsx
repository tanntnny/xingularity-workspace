import * as React from 'react'

import {
  DEFAULT_FOLDER_ICON_COLORS,
  type FolderColor,
  normalizeFolderColor
} from '../../../../shared/folderColors'
import { cn } from '../../lib/utils'

export type NotebookFolderIconVariant = 'closed' | 'open'

export interface NotebookFolderIconProps extends Omit<
  React.SVGAttributes<SVGSVGElement>,
  'color' | 'height' | 'width' | 'viewBox'
> {
  variant?: NotebookFolderIconVariant
  size?: number | string
  color?: FolderColor | null
}

const CLOSED_FOLDER_PATH =
  'M0 29a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4V12a4 4 0 0 0-4-4h-9c-3.562 0-3-5-8.438-5H4a4 4 0 0 0-4 4v22z'
const CLOSED_FOLDER_FRONT_PATH =
  'M30 10h-6.562C18 10 18.562 15 15 15H6a4 4 0 0 0-4 4v10a1 1 0 1 1-2 0a4 4 0 0 0 4 4h26a4 4 0 0 0 4-4V14a4 4 0 0 0-4-4z'
const OPEN_FOLDER_FRONT_PATH =
  'M32.336 12h-6.562c-5.438 0-5.383 5-8.945 5h-9c-2.209 0-4.182 1.791-4.406 4l-.493 3.874L2.406 29l-.02-.002c-.116.607-.672.999-1.3.999c-.643 0-1.106-.507-1.074-1.144C.01 28.903 0 28.95 0 29a3.989 3.989 0 0 0 3.4 3.939c.177.038.371.061.6.061h26c2.209 0 4.182-1.791 4.406-4l1.523-13c.225-2.209-1.384-4-3.593-4z'

interface FolderIconColors {
  back: string
  frontStart: string
  frontEnd: string
}

function getNotebookFolderIconColors(color?: string | null): FolderIconColors {
  const normalizedColor = normalizeFolderColor(color)
  if (!normalizedColor) {
    return {
      back: DEFAULT_FOLDER_ICON_COLORS.back,
      frontStart: lightenHex(DEFAULT_FOLDER_ICON_COLORS.front, 0.12),
      frontEnd: DEFAULT_FOLDER_ICON_COLORS.front
    }
  }

  const { hue, saturation, lightness } = rgbToHsl(normalizedColor)
  return {
    back: hslToHex(hue, Math.max(0, saturation - 0.18), Math.max(0.12, lightness - 0.2667)),
    frontStart: lightenHex(normalizedColor, 0.12),
    frontEnd: normalizedColor
  }
}

export const NotebookFolderIcon = React.forwardRef<SVGSVGElement, NotebookFolderIconProps>(
  ({ variant = 'closed', size = 24, color, className, ...props }, ref) => {
    const colors = getNotebookFolderIconColors(color)
    const gradientId = `notebook-folder-front-${React.useId().replace(/:/g, '')}`

    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 36 36"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        fill="none"
        className={cn('shrink-0', className)}
        aria-hidden="true"
        {...props}
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="18"
            y1="6"
            x2="18"
            y2="33"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor={colors.frontStart} />
            <stop offset="1" stopColor={colors.frontEnd} />
          </linearGradient>
        </defs>
        <path fill={colors.back} d={CLOSED_FOLDER_PATH} />
        <path
          fill={`url(#${gradientId})`}
          d={variant === 'open' ? OPEN_FOLDER_FRONT_PATH : CLOSED_FOLDER_FRONT_PATH}
        />
      </svg>
    )
  }
)

NotebookFolderIcon.displayName = 'NotebookFolderIcon'

function rgbToHsl(color: string): { hue: number; saturation: number; lightness: number } {
  const red = Number.parseInt(color.slice(1, 3), 16) / 255
  const green = Number.parseInt(color.slice(3, 5), 16) / 255
  const blue = Number.parseInt(color.slice(5, 7), 16) / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  const lightness = (max + min) / 2

  if (delta === 0) {
    return { hue: 0, saturation: 0, lightness }
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  let hue = 0
  if (max === red) {
    hue = ((green - blue) / delta) % 6
  } else if (max === green) {
    hue = (blue - red) / delta + 2
  } else {
    hue = (red - green) / delta + 4
  }

  return {
    hue: (hue * 60 + 360) % 360,
    saturation,
    lightness
  }
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const hueSector = hue / 60
  const second = chroma * (1 - Math.abs((hueSector % 2) - 1))
  const match = lightness - chroma / 2
  const [red, green, blue] =
    hueSector < 1
      ? [chroma, second, 0]
      : hueSector < 2
        ? [second, chroma, 0]
        : hueSector < 3
          ? [0, chroma, second]
          : hueSector < 4
            ? [0, second, chroma]
            : hueSector < 5
              ? [second, 0, chroma]
              : [chroma, 0, second]

  return `#${[red, green, blue]
    .map((channel) =>
      Math.round((channel + match) * 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`
}

function lightenHex(color: string, amount: number): string {
  const { hue, saturation, lightness } = rgbToHsl(color)
  return hslToHex(hue, saturation, Math.min(0.96, lightness + amount))
}
