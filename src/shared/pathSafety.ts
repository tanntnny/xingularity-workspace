import path from 'node:path'

export function normalizeRelativePath(input: string): string {
  const normalized = input.replace(/\\/g, '/').replace(/^\/+/, '')
  return path.posix.normalize(normalized)
}

export function assertSafeRelativePath(input: string): string {
  if (input.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(input)) {
    throw new Error('Invalid path outside vault boundaries')
  }
  const rel = normalizeRelativePath(input)
  if (rel === '.' || rel === '' || rel.startsWith('../') || path.posix.isAbsolute(rel)) {
    throw new Error('Invalid path outside vault boundaries')
  }
  return rel
}

export function ensureWithinBase(basePath: string, targetPath: string): void {
  const relative = path.relative(basePath, targetPath)
  if (relative === '' || relative === '.') {
    return
  }
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path traversal denied')
  }
}

export function joinSafe(basePath: string, relPath: string): string {
  const safeRel = assertSafeRelativePath(relPath)
  const targetPath = path.resolve(basePath, safeRel)
  ensureWithinBase(basePath, targetPath)
  return targetPath
}
