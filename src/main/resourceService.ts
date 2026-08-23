import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type {
  Project,
  ResourceHealth,
  ResourceInput,
  ResourcePreview,
  ResourceRef,
  ResourceRelation,
  ResourceRelationType
} from '../shared/types'
import {
  inferExternalProduct,
  inferProviderFromUri,
  inferResourceKind,
  normalizeResourceInput,
  resourceHealthFromError
} from '../shared/resourceDomain'
import { ResourceStore } from './resourceStore'
import type { ResourceStoreSnapshot } from './resourceStore'

const TEXT_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/xml',
  'text/xml'
])
const MAX_PREVIEW_BYTES = 200_000

export class ResourceService {
  private readonly deviceId = `mac-${os.hostname()}`
  private readonly store: ResourceStore

  constructor(vaultRoot: string) {
    this.store = new ResourceStore(vaultRoot)
  }

  list(): Promise<ResourceStoreSnapshot> {
    return this.store.read()
  }

  async migrateProjects(
    projects: readonly Project[]
  ): Promise<import('../shared/resourceDomain').ResourceMigrationResult> {
    return this.store.migrateProjects(projects)
  }

  async add(input: ResourceInput): Promise<ResourceRef> {
    const resource = normalizeResourceInput(input)
    if (resource.provider === 'filesystem') {
      const filePath = filePathFromUri(resource.canonicalUri)
      if (!filePath) throw new Error('A filesystem resource requires a valid local path')
      const now = new Date().toISOString()
      let updated: ResourceRef
      try {
        const stats = await fs.stat(filePath)
        updated = {
          ...resource,
          kind: stats.isDirectory() ? 'local-folder' : 'local-file',
          state: 'available' as const,
          lastSeenAt: now,
          sourceModifiedAt: stats.mtime.toISOString(),
          metadata: {
            ...(resource.metadata ?? {}),
            sizeBytes: stats.size,
            isDirectory: stats.isDirectory()
          }
        }
      } catch (error) {
        const state = resourceHealthFromError(error)
        updated = {
          ...resource,
          state,
          lastSeenAt: now,
          metadata: {
            ...(resource.metadata ?? {}),
            unavailableReason: error instanceof Error ? error.message : String(error)
          }
        }
      }
      await this.store.upsert(updated)
      await this.store.setLocator({
        resourceId: updated.id,
        deviceId: this.deviceId,
        provider: 'filesystem',
        path: filePath,
        observedName: path.basename(filePath),
        observedParent: path.dirname(filePath),
        updatedAt: now
      })
      return updated
    }
    return this.store.upsert(resource)
  }

  async update(
    resourceId: string,
    input: { canonicalUri?: string; title?: string }
  ): Promise<ResourceRef> {
    const snapshot = await this.store.read()
    const existing = snapshot.resources.find((resource) => resource.id === resourceId)
    if (!existing) throw new Error(`Resource not found: ${resourceId}`)

    const canonicalUri = input.canonicalUri?.trim() || existing.canonicalUri
    const provider =
      existing.type === 'notebook' ? 'xingularity' : inferProviderFromUri(canonicalUri)
    const normalized = normalizeResourceInput({
      type: existing.type,
      provider,
      kind: existing.type === 'notebook' ? 'notebook' : inferResourceKind(provider, canonicalUri),
      canonicalUri,
      title: input.title?.trim() || existing.title,
      externalProduct:
        existing.type === 'external'
          ? inferExternalProduct(canonicalUri, existing.mimeType)
          : undefined,
      mimeType: existing.mimeType,
      sourceOfTruth: existing.sourceOfTruth,
      access: existing.access,
      projectId: undefined,
      metadata: existing.metadata
    })

    return this.store.update(resourceId, {
      ...normalized,
      id: resourceId,
      projectIds: existing.projectIds,
      createdAt: existing.createdAt,
      state: 'unindexed'
    })
  }

  async refresh(resourceId: string): Promise<ResourceHealth> {
    const snapshot = await this.store.read()
    const resource = snapshot.resources.find((candidate) => candidate.id === resourceId)
    if (!resource) throw new Error(`Resource not found: ${resourceId}`)
    const checkedAt = new Date().toISOString()
    if (resource.provider === 'google-drive') {
      const next = await this.store.update(resourceId, {
        lastSeenAt: checkedAt,
        state: 'reauthorization-required'
      })
      return {
        resourceId: next.id,
        state: next.state,
        checkedAt,
        message: 'Connect Google Drive to refresh this resource'
      }
    }
    if (resource.provider === 'web') {
      try {
        const response = await fetch(resource.canonicalUri, { method: 'HEAD' })
        const next = await this.store.update(resourceId, {
          lastSeenAt: checkedAt,
          state: response.ok ? 'available' : 'stale'
        })
        return { resourceId: next.id, state: next.state, checkedAt }
      } catch (error) {
        const state = resourceHealthFromError(error)
        await this.store.update(resourceId, { lastSeenAt: checkedAt, state })
        return {
          resourceId,
          state,
          checkedAt,
          message: error instanceof Error ? error.message : String(error)
        }
      }
    }
    if (resource.provider !== 'filesystem') {
      const next = await this.store.update(resourceId, {
        lastSeenAt: checkedAt,
        state: 'available'
      })
      return { resourceId: next.id, state: next.state, checkedAt }
    }
    try {
      const filePath = filePathFromUri(resource.canonicalUri)
      if (!filePath) throw new Error('Invalid file URI')
      const stats = await fs.stat(filePath)
      const next = await this.store.update(resourceId, {
        lastSeenAt: checkedAt,
        sourceModifiedAt: stats.mtime.toISOString(),
        kind: stats.isDirectory() ? 'local-folder' : 'local-file',
        state: 'available',
        metadata: {
          ...(resource.metadata ?? {}),
          sizeBytes: stats.size,
          isDirectory: stats.isDirectory()
        }
      })
      return {
        resourceId: next.id,
        state: next.state,
        checkedAt,
        locator: snapshot.locators.find((item) => item.resourceId === resourceId)
      }
    } catch (error) {
      const state = resourceHealthFromError(error)
      await this.store.update(resourceId, { lastSeenAt: checkedAt, state })
      return {
        resourceId,
        state,
        checkedAt,
        message: error instanceof Error ? error.message : String(error),
        locator: snapshot.locators.find((item) => item.resourceId === resourceId)
      }
    }
  }

  async locate(resourceId: string, nextPath: string): Promise<ResourceRef> {
    const snapshot = await this.store.read()
    const existing = snapshot.resources.find((resource) => resource.id === resourceId)
    if (!existing) throw new Error(`Resource not found: ${resourceId}`)
    const canonicalUri = nextPath.startsWith('file://')
      ? nextPath
      : `file://${encodeURI(path.resolve(nextPath))}`
    let kind: ResourceRef['kind'] = existing.kind
    try {
      kind = (await fs.stat(filePathFromUri(canonicalUri) ?? path.resolve(nextPath))).isDirectory()
        ? 'local-folder'
        : 'local-file'
    } catch {
      // Keep the existing kind until the next health refresh resolves the target.
    }
    const resource = await this.store.update(resourceId, {
      canonicalUri,
      provider: 'filesystem',
      kind,
      state: 'unindexed',
      updatedAt: new Date().toISOString()
    })
    await this.store.setLocator({
      resourceId,
      deviceId: this.deviceId,
      provider: 'filesystem',
      path: filePathFromUri(canonicalUri) ?? path.resolve(nextPath),
      observedName: path.basename(nextPath),
      observedParent: path.dirname(nextPath),
      updatedAt: new Date().toISOString()
    })
    return resource
  }

  async preview(resourceId: string, allowContent = false): Promise<ResourcePreview> {
    const snapshot = await this.store.read()
    const resource = snapshot.resources.find((candidate) => candidate.id === resourceId)
    if (!resource) throw new Error(`Resource not found: ${resourceId}`)
    if (resource.provider !== 'filesystem') {
      return { resourceId, kind: resource.kind, mimeType: resource.mimeType, truncated: false }
    }
    const filePath = filePathFromUri(resource.canonicalUri)
    if (!filePath)
      return {
        resourceId,
        kind: resource.kind,
        mimeType: resource.mimeType,
        truncated: false,
        error: 'Invalid file URI'
      }
    try {
      const stats = await fs.stat(filePath)
      const result: ResourcePreview = {
        resourceId,
        kind: resource.kind,
        mimeType: resource.mimeType,
        sizeBytes: stats.size,
        modifiedAt: stats.mtime.toISOString(),
        truncated: false
      }
      if (
        !allowContent ||
        stats.isDirectory() ||
        stats.size > MAX_PREVIEW_BYTES ||
        !isTextResource(resource)
      )
        return result
      result.text = await fs.readFile(filePath, 'utf-8')
      result.truncated = result.text.length >= MAX_PREVIEW_BYTES
      if (result.truncated) result.text = result.text.slice(0, MAX_PREVIEW_BYTES)
      return result
    } catch (error) {
      return {
        resourceId,
        kind: resource.kind,
        mimeType: resource.mimeType,
        truncated: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async relate(input: {
    type: ResourceRelationType
    fromId: string
    fromKind: string
    toId: string
    toKind: string
    confidence?: ResourceRelation['confidence']
    createdBy?: ResourceRelation['createdBy']
  }): Promise<ResourceRelation> {
    const relation = await this.store.relate({
      ...input,
      id: `${input.type}:${input.fromKind}:${input.fromId}:${input.toKind}:${input.toId}`,
      fromKind: input.fromKind as ResourceRelation['fromKind'],
      toKind: input.toKind as ResourceRelation['toKind'],
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy ?? 'user',
      confidence: input.confidence ?? 'confirmed'
    })
    if (input.type === 'project_contains_resource' && input.toKind === 'resource') {
      const snapshot = await this.store.read()
      const resource = snapshot.resources.find((candidate) => candidate.id === input.toId)
      if (resource) {
        await this.store.update(resource.id, {
          projectIds: Array.from(new Set([...(resource.projectIds ?? []), input.fromId]))
        })
      }
    }
    return relation
  }

  async detachFromProject(projectId: string, resourceId: string): Promise<void> {
    const snapshot = await this.store.read()
    const relationIds = snapshot.relations
      .filter(
        (relation) =>
          relation.type === 'project_contains_resource' &&
          relation.fromId === projectId &&
          relation.toId === resourceId
      )
      .map((relation) => relation.id)

    for (const relationId of relationIds) {
      await this.store.unrelate(relationId)
    }

    const resource = snapshot.resources.find((candidate) => candidate.id === resourceId)
    if (resource) {
      await this.store.update(resourceId, {
        projectIds: resource.projectIds?.filter((id) => id !== projectId)
      })
    }
  }

  async contextForProject(
    projectId: string
  ): Promise<import('../shared/types').ResourceContextBundle> {
    const snapshot = await this.store.read()
    const resourceIds = new Set(
      snapshot.relations
        .filter(
          (relation) =>
            relation.fromId === projectId && relation.type === 'project_contains_resource'
        )
        .map((relation) => relation.toId)
    )
    const resources = snapshot.resources.filter(
      (resource) => resource.projectIds?.includes(projectId) || resourceIds.has(resource.id)
    )
    return {
      projectId,
      generatedAt: new Date().toISOString(),
      resources,
      relations: snapshot.relations.filter(
        (relation) =>
          resourceIds.has(relation.fromId) ||
          resourceIds.has(relation.toId) ||
          relation.fromId === projectId
      ),
      citations: resources.map((resource) => ({
        resourceId: resource.id,
        uri: resource.canonicalUri,
        title: resource.title,
        observedAt: resource.lastSeenAt
      })),
      allowedActions: ['open', 'reveal', 'refresh', 'create-task', 'create-note']
    }
  }
}

function filePathFromUri(value: string): string | null {
  if (!value.startsWith('file://')) return null
  try {
    return decodeURIComponent(new URL(value).pathname)
  } catch {
    return null
  }
}

function isTextResource(resource: ResourceRef): boolean {
  if (resource.mimeType && TEXT_MIME_TYPES.has(resource.mimeType)) return true
  return /\.(md|markdown|txt|json|csv|xml)$/i.test(resource.canonicalUri)
}
