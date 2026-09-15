export interface CommandPaletteFolderBreadcrumb {
  label: string
  path: string | null
}

export function getCommandPaletteFolderBreadcrumbs(
  relPath: string
): CommandPaletteFolderBreadcrumb[] {
  const folderSegments = relPath.split('/').slice(0, -1).filter(Boolean)
  if (folderSegments.length === 0) {
    return [{ label: 'Vault', path: null }]
  }

  return folderSegments.map((label, index) => ({
    label,
    path: folderSegments.slice(0, index + 1).join('/')
  }))
}
