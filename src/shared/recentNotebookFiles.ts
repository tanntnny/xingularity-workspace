export const MAX_RECENT_NOTEBOOK_PATHS = 5

export function normalizeRecentNotebookPaths(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<string>()
  const paths: string[] = []

  for (const item of value) {
    if (typeof item !== 'string') {
      continue
    }

    const relPath = item.trim()
    if (!relPath || seen.has(relPath)) {
      continue
    }

    seen.add(relPath)
    paths.push(relPath)

    if (paths.length === MAX_RECENT_NOTEBOOK_PATHS) {
      break
    }
  }

  return paths
}

export function rememberRecentNotebookPath(paths: readonly string[], relPath: string): string[] {
  return normalizeRecentNotebookPaths([relPath, ...paths])
}

export function remapRecentNotebookPaths(
  paths: readonly string[],
  fromRelPath: string,
  toRelPath: string
): string[] {
  return normalizeRecentNotebookPaths(
    paths.map((relPath) => {
      if (relPath === fromRelPath) {
        return toRelPath
      }

      const nestedPrefix = `${fromRelPath}/`
      return relPath.startsWith(nestedPrefix)
        ? `${toRelPath}/${relPath.slice(nestedPrefix.length)}`
        : relPath
    })
  )
}

export function removeRecentNotebookPaths(
  paths: readonly string[],
  removedRelPaths: readonly string[]
): string[] {
  return normalizeRecentNotebookPaths(
    paths.filter(
      (relPath) =>
        !removedRelPaths.some(
          (removedRelPath) => relPath === removedRelPath || relPath.startsWith(`${removedRelPath}/`)
        )
    )
  )
}
