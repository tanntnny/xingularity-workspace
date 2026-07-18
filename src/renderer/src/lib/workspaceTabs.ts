export function getNextActiveWorkspaceTabId(
  tabIds: readonly string[],
  closingTabId: string
): string | null {
  const closingIndex = tabIds.indexOf(closingTabId)
  if (closingIndex < 0) {
    return null
  }

  return tabIds[closingIndex + 1] ?? tabIds[closingIndex - 1] ?? null
}
