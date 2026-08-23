import type { ResourceWriteInput, ResourceWritePreview } from './types'

export function hashResourceContent(content: string): string {
  let hash = 2166136261
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}-${content.length.toString(16)}`
}

export function buildResourceWritePreview(
  input: ResourceWriteInput,
  existingContent: string | null
): ResourceWritePreview {
  const nextContent =
    input.operation === 'append' && existingContent !== null
      ? `${existingContent}${input.content}`
      : input.content
  const existingHash = existingContent === null ? undefined : hashResourceContent(existingContent)
  const warning =
    input.operation === 'create' && existingContent !== null
      ? 'The target already exists and will not be overwritten by a create action.'
      : input.expectedHash && existingHash && input.expectedHash !== existingHash
        ? 'The source changed since the preview was generated.'
        : undefined
  return {
    targetPath: input.targetPath,
    operation: input.operation,
    contentLength: input.content.length,
    existing: existingContent !== null,
    ...(existingHash ? { existingHash } : {}),
    nextHash: hashResourceContent(nextContent),
    requiresConfirmation: true,
    ...(warning ? { warning } : {})
  }
}

export function isPathWithinRoot(targetPath: string, authorizedRoot: string): boolean {
  const normalizedTarget = targetPath.replace(/\\/g, '/').replace(/\/+$/, '')
  const normalizedRoot = authorizedRoot.replace(/\\/g, '/').replace(/\/+$/, '')
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}/`)
}
