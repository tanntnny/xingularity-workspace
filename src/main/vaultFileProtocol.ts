import fs from 'node:fs/promises'
import path from 'node:path'

export const VAULT_FILE_MAX_SIZE_BYTES = 10 * 1024 * 1024

const MIME_TYPES: Readonly<Record<string, string>> = {
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
}

const ERROR_BODY = 'Vault file unavailable'

export interface VaultFileProtocolScope {
  vaultRoot: string
  attachmentRoots: readonly string[]
}

export type VaultFileProtocolScopeAccessor = () =>
  | VaultFileProtocolScope
  | null
  | Promise<VaultFileProtocolScope | null>

interface VaultFileProtocolError {
  status: number
}

function protocolError(status: number): Error & VaultFileProtocolError {
  return Object.assign(new Error(ERROR_BODY), { status })
}

function isProtocolError(error: unknown): error is VaultFileProtocolError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number'
  )
}

function isWithinRoot(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(path.resolve(rootPath), path.resolve(candidatePath))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function hasTraversalSegment(value: string): boolean {
  return value
    .replace(/\\/g, '/')
    .split('/')
    .some((segment) => segment === '..')
}

/**
 * Parse without allowing URL dot-segment normalization to hide traversal.
 * The URL constructor normalizes `..` before exposing `pathname`.
 */
export function parseVaultFileRequestPath(requestUrl: string): string {
  if (typeof requestUrl !== 'string' || !/^vault-file:/i.test(requestUrl)) {
    throw protocolError(400)
  }

  const remainder = requestUrl.slice('vault-file:'.length)
  if (!remainder.startsWith('//')) {
    throw protocolError(400)
  }

  const withoutQuery = remainder.slice(2).split(/[?#]/, 1)[0] ?? ''
  const firstSlash = withoutQuery.indexOf('/')
  const authority = firstSlash >= 0 ? withoutQuery.slice(0, firstSlash) : withoutQuery
  const rawPath = firstSlash >= 0 ? withoutQuery.slice(firstSlash) : ''
  const combinedPath = authority ? `/${authority}${rawPath}` : rawPath

  if (!combinedPath || hasTraversalSegment(combinedPath)) {
    throw protocolError(400)
  }

  let decodedPath: string
  try {
    decodedPath = decodeURIComponent(combinedPath)
  } catch {
    throw protocolError(400)
  }

  if (
    decodedPath.includes('\0') ||
    hasTraversalSegment(decodedPath) ||
    (!path.isAbsolute(decodedPath) && !path.win32.isAbsolute(decodedPath))
  ) {
    throw protocolError(400)
  }

  if (process.platform === 'win32' && /^\\[a-zA-Z]:[\\/]/.test(decodedPath)) {
    decodedPath = decodedPath.slice(1)
  }

  return path.normalize(decodedPath)
}

function getMimeType(filePath: string): string {
  const mimeType = MIME_TYPES[path.extname(filePath).toLowerCase()]
  if (!mimeType) {
    throw protocolError(415)
  }
  return mimeType
}

function errorResponse(status: number): Response {
  return new Response(ERROR_BODY, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff'
    }
  })
}

async function realPathOrError(targetPath: string, status: number): Promise<string> {
  try {
    return await fs.realpath(targetPath)
  } catch {
    throw protocolError(status)
  }
}

async function readVaultFile(
  requestUrl: string,
  scope: VaultFileProtocolScope | null,
  maxBytes: number
): Promise<Response> {
  if (!scope || scope.attachmentRoots.length === 0) {
    throw protocolError(403)
  }

  const requestedPath = parseVaultFileRequestPath(requestUrl)
  const vaultRoot = await realPathOrError(scope.vaultRoot, 403)
  const attachmentRoots = await Promise.all(
    scope.attachmentRoots.map((root) => realPathOrError(root, 403))
  )

  if (attachmentRoots.some((root) => !isWithinRoot(vaultRoot, root))) {
    throw protocolError(403)
  }

  const lexicalAttachmentRoots = scope.attachmentRoots.map((root) => path.resolve(root))
  if (!lexicalAttachmentRoots.some((root) => isWithinRoot(root, requestedPath))) {
    throw protocolError(403)
  }

  let fileHandle: fs.FileHandle | null = null
  try {
    // Open first, then validate the path that backs the descriptor. This keeps
    // the bytes tied to the checked descriptor instead of reopening a path
    // after validation.
    fileHandle = await fs.open(requestedPath, 'r')
    const stats = await fileHandle.stat()
    if (!stats.isFile()) {
      throw protocolError(404)
    }

    const resolvedPath = await realPathOrError(requestedPath, 404)
    if (
      !isWithinRoot(vaultRoot, resolvedPath) ||
      !attachmentRoots.some((root) => isWithinRoot(root, resolvedPath))
    ) {
      throw protocolError(403)
    }

    const resolvedStats = await fs.stat(resolvedPath)
    if (stats.dev !== resolvedStats.dev || stats.ino !== resolvedStats.ino) {
      throw protocolError(403)
    }

    const mimeType = getMimeType(resolvedPath)
    if (stats.size > maxBytes) {
      throw protocolError(413)
    }

    const data = await fileHandle.readFile()
    if (data.byteLength > maxBytes) {
      throw protocolError(413)
    }

    return new Response(data, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Length': String(data.byteLength),
        'Content-Type': mimeType,
        'X-Content-Type-Options': 'nosniff'
      }
    })
  } catch (error) {
    if (isProtocolError(error)) {
      throw error
    }
    throw protocolError(404)
  } finally {
    await fileHandle?.close().catch(() => undefined)
  }
}

export function createVaultFileProtocolHandler(
  getScope: VaultFileProtocolScopeAccessor,
  options: { maxBytes?: number } = {}
): (request: { url: string }) => Promise<Response> {
  const maxBytes = options.maxBytes ?? VAULT_FILE_MAX_SIZE_BYTES
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error('Vault file size limit must be a positive safe integer')
  }

  return async (request) => {
    try {
      return await readVaultFile(request.url, await getScope(), maxBytes)
    } catch (error) {
      return errorResponse(isProtocolError(error) ? error.status : 404)
    }
  }
}
