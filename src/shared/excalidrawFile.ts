import type { ExcalidrawSessionScene, StoredExcalidrawFileDocument } from './types'

export const EXCALIDRAW_FILE_EXTENSION = '.excalidraw'
const EXCALIDRAW_FILE_VERSION = 1

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isExcalidrawPath(relPath: string): boolean {
  return relPath.toLowerCase().endsWith(EXCALIDRAW_FILE_EXTENSION)
}

export function stripNotebookFileExtension(relPath: string): string {
  return relPath.replace(/\.(md|xnote|excalidraw)$/i, '')
}

export function withExcalidrawExtension(relPath: string): string {
  return isExcalidrawPath(relPath)
    ? relPath
    : `${stripNotebookFileExtension(relPath)}${EXCALIDRAW_FILE_EXTENSION}`
}

export function createEmptyExcalidrawScene(): ExcalidrawSessionScene {
  return {
    type: 'excalidraw',
    version: 2,
    source: 'https://excalidraw.com',
    elements: [],
    appState: {
      viewBackgroundColor: 'transparent'
    },
    files: {}
  }
}

export function createEmptyExcalidrawFileDocument(): StoredExcalidrawFileDocument {
  return {
    version: EXCALIDRAW_FILE_VERSION,
    scene: createEmptyExcalidrawScene()
  }
}

export function normalizeExcalidrawFileDocument(
  document: StoredExcalidrawFileDocument
): StoredExcalidrawFileDocument {
  return {
    version: EXCALIDRAW_FILE_VERSION,
    scene: normalizeExcalidrawScene(document.scene)
  }
}

export function normalizeExcalidrawScene(scene: ExcalidrawSessionScene): ExcalidrawSessionScene {
  return {
    type: typeof scene.type === 'string' ? scene.type : 'excalidraw',
    version: typeof scene.version === 'number' ? scene.version : 2,
    source: typeof scene.source === 'string' ? scene.source : 'https://excalidraw.com',
    elements: Array.isArray(scene.elements) ? scene.elements : [],
    appState: isRecord(scene.appState) || scene.appState === null ? scene.appState : {},
    files: isRecord(scene.files) ? scene.files : {}
  }
}

export function parseStoredExcalidrawFileDocument(raw: string): StoredExcalidrawFileDocument {
  const parsed = JSON.parse(raw) as unknown
  if (!isRecord(parsed)) {
    throw new Error('Invalid Excalidraw file document')
  }

  return {
    version: EXCALIDRAW_FILE_VERSION,
    scene: normalizeExcalidrawScene({
      type: typeof parsed.scene === 'object' && parsed.scene ? (parsed.scene as ExcalidrawSessionScene).type : undefined,
      version:
        typeof parsed.scene === 'object' && parsed.scene
          ? (parsed.scene as ExcalidrawSessionScene).version
          : undefined,
      source:
        typeof parsed.scene === 'object' && parsed.scene
          ? (parsed.scene as ExcalidrawSessionScene).source
          : undefined,
      elements:
        typeof parsed.scene === 'object' && parsed.scene && Array.isArray((parsed.scene as ExcalidrawSessionScene).elements)
          ? (parsed.scene as ExcalidrawSessionScene).elements
          : [],
      appState:
        typeof parsed.scene === 'object' && parsed.scene
          ? ((parsed.scene as ExcalidrawSessionScene).appState ?? {})
          : {},
      files:
        typeof parsed.scene === 'object' && parsed.scene
          ? ((parsed.scene as ExcalidrawSessionScene).files ?? {})
          : {}
    })
  }
}

export function serializeStoredExcalidrawFileDocument(
  document: StoredExcalidrawFileDocument
): string {
  return JSON.stringify(normalizeExcalidrawFileDocument(document), null, 2)
}
