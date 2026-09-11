import { PROJECT_ICON_COLORS } from './projectIcons'

export type FolderColor = string
export type FolderColorMap = Record<string, FolderColor>

export const FOLDER_COLOR_PALETTE = PROJECT_ICON_COLORS

export const DEFAULT_FOLDER_ICON_COLORS = {
  back: '#4b5563',
  front: '#9ca3af'
} as const

const MAX_FOLDER_COLOR_PATH_LENGTH = 512
const MAX_FOLDER_COLOR_ENTRIES = 1000

export function normalizeFolderPath(value: string): string {
  return value
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
}

export function isSafeFolderPath(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  const rawPath = value.trim().replace(/\\/g, '/')
  const normalized = normalizeFolderPath(rawPath)
  if (
    !rawPath ||
    rawPath.startsWith('/') ||
    rawPath.endsWith('/') ||
    /^[A-Za-z]:\//.test(rawPath) ||
    !normalized ||
    normalized.length > MAX_FOLDER_COLOR_PATH_LENGTH ||
    normalized.startsWith('/')
  ) {
    return false
  }

  return normalized
    .split('/')
    .every((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
}

export function normalizeFolderColor(value: unknown): FolderColor | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return FOLDER_COLOR_PALETTE.find((color) => color.toLowerCase() === normalized) ?? null
}

export function normalizeFolderColors(value: unknown): FolderColorMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const normalized: FolderColorMap = {}
  for (const [rawPath, rawColor] of Object.entries(value).slice(0, MAX_FOLDER_COLOR_ENTRIES)) {
    if (!isSafeFolderPath(rawPath)) {
      continue
    }
    const relPath = normalizeFolderPath(rawPath)
    const color = normalizeFolderColor(rawColor)
    if (!color) {
      continue
    }

    normalized[relPath] = color
  }

  return normalized
}

export function remapFolderColors(
  colors: FolderColorMap,
  fromPath: string,
  toPath: string
): FolderColorMap {
  if (!isSafeFolderPath(fromPath) || !isSafeFolderPath(toPath)) {
    return { ...colors }
  }

  const normalizedFromPath = normalizeFolderPath(fromPath)
  const normalizedToPath = normalizeFolderPath(toPath)

  const next: FolderColorMap = {}
  for (const [relPath, color] of Object.entries(colors)) {
    const nextPath =
      relPath === normalizedFromPath
        ? normalizedToPath
        : relPath.startsWith(`${normalizedFromPath}/`)
          ? `${normalizedToPath}${relPath.slice(normalizedFromPath.length)}`
          : relPath
    next[nextPath] = color
  }

  return next
}

export function removeFolderColors(
  colors: FolderColorMap,
  folderPaths: readonly string[]
): FolderColorMap {
  const normalizedPaths = folderPaths.filter(isSafeFolderPath).map(normalizeFolderPath)

  if (normalizedPaths.length === 0) {
    return { ...colors }
  }

  return Object.fromEntries(
    Object.entries(colors).filter(
      ([relPath]) =>
        !normalizedPaths.some(
          (folderPath) => relPath === folderPath || relPath.startsWith(`${folderPath}/`)
        )
    )
  )
}
