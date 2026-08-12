import {
  EXCALIDRAW_FILE_EXTENSION,
  stripNotebookFileExtension
} from '../../../shared/excalidrawFile'
import { withNoteExtension } from '../../../shared/noteDocument'

export type NotebookRenameKind = 'note' | 'excalidraw' | 'folder'

export function buildRenamedNotebookPath(
  relPath: string,
  nextName: string,
  kind: NotebookRenameKind
): string | null {
  const trimmed = nextName.trim()
  if (!trimmed || trimmed === '.' || trimmed === '..' || /[\\/]/.test(trimmed)) {
    return null
  }

  const slashIndex = relPath.lastIndexOf('/')
  const parentDir = slashIndex >= 0 ? relPath.slice(0, slashIndex) : ''
  const normalizedName =
    kind === 'note'
      ? withNoteExtension(trimmed)
      : kind === 'excalidraw'
        ? `${stripDrawingExtensions(trimmed)}${EXCALIDRAW_FILE_EXTENSION}`
        : trimmed
  const nextRelPath = parentDir ? `${parentDir}/${normalizedName}` : normalizedName

  return nextRelPath === relPath ? null : nextRelPath
}

function stripDrawingExtensions(value: string): string {
  let baseName = value

  while (true) {
    const nextBaseName = stripNotebookFileExtension(baseName)
    if (nextBaseName === baseName) {
      return baseName
    }

    baseName = nextBaseName
  }
}
