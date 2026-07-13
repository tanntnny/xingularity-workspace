export function createWarpNewTabUri(folderPath: string): string {
  const uri = new URL('warp://action/new_tab')
  uri.searchParams.set('path', folderPath)
  return uri.toString()
}
