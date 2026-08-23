import fs from 'node:fs/promises'
import path from 'node:path'
import type {
  Project,
  ResourceInput,
  ResourceLocator,
  ResourceRef,
  ResourceRelation
} from '../shared/types'
import {
  migrateProjectResources,
  normalizeResourceInput,
  normalizeResourceRef,
  normalizeResourceRelation,
  RESOURCE_SCHEMA_VERSION,
  type ResourceMigrationResult
} from '../shared/resourceDomain'
import {
  getVaultLocatorsPath,
  getVaultRelationsPath,
  getVaultResourcesDir,
  getVaultResourcesPath
} from './vaultData'

interface ResourceFilePayload {
  version: typeof RESOURCE_SCHEMA_VERSION
  resources: ResourceRef[]
}

interface RelationFilePayload {
  version: typeof RESOURCE_SCHEMA_VERSION
  relations: ResourceRelation[]
}

interface LocatorFilePayload {
  version: typeof RESOURCE_SCHEMA_VERSION
  locators: ResourceLocator[]
}

export interface ResourceStoreSnapshot {
  resources: ResourceRef[]
  relations: ResourceRelation[]
  locators: ResourceLocator[]
}

export class ResourceStore {
  constructor(private readonly vaultRoot: string) {}

  async read(): Promise<ResourceStoreSnapshot> {
    const [resources, relations, locators] = await Promise.all([
      readJson<ResourceFilePayload>(getVaultResourcesPath(this.vaultRoot)),
      readJson<RelationFilePayload>(getVaultRelationsPath(this.vaultRoot)),
      readJson<LocatorFilePayload>(getVaultLocatorsPath(this.vaultRoot))
    ])

    return {
      resources: Array.isArray(resources?.resources)
        ? resources.resources.flatMap((resource) => {
            const normalized = normalizeResourceRef(resource)
            return normalized ? [normalized] : []
          })
        : [],
      relations: Array.isArray(relations?.relations)
        ? relations.relations.flatMap((relation) => {
            const normalized = normalizeResourceRelation(relation)
            return normalized ? [normalized] : []
          })
        : [],
      locators: Array.isArray(locators?.locators)
        ? locators.locators.flatMap((locator) => (isLocator(locator) ? [locator] : []))
        : []
    }
  }

  async write(snapshot: ResourceStoreSnapshot): Promise<void> {
    await fs.mkdir(getVaultResourcesDir(this.vaultRoot), { recursive: true })
    await Promise.all([
      writeJsonAtomically(getVaultResourcesPath(this.vaultRoot), {
        version: RESOURCE_SCHEMA_VERSION,
        resources: snapshot.resources
      } satisfies ResourceFilePayload),
      writeJsonAtomically(getVaultRelationsPath(this.vaultRoot), {
        version: RESOURCE_SCHEMA_VERSION,
        relations: snapshot.relations
      } satisfies RelationFilePayload),
      writeJsonAtomically(getVaultLocatorsPath(this.vaultRoot), {
        version: RESOURCE_SCHEMA_VERSION,
        locators: snapshot.locators
      } satisfies LocatorFilePayload)
    ])
  }

  async migrateProjects(projects: readonly Project[]): Promise<ResourceMigrationResult> {
    const current = await this.read()
    const migration = migrateProjectResources(projects, current.resources, current.relations)
    const nextSnapshot = {
      resources: migration.resources,
      relations: migration.relations,
      locators: current.locators
    }
    if (
      migration.migrated > 0 ||
      migration.resources.length !== current.resources.length ||
      migration.relations.length !== current.relations.length
    ) {
      await this.write(nextSnapshot)
    }
    return migration
  }

  async upsert(input: ResourceInput | ResourceRef): Promise<ResourceRef> {
    const current = await this.read()
    const next = isResourceRef(input) ? normalizeResourceRef(input) : normalizeResourceInput(input)
    if (!next) throw new Error('Invalid resource')
    const existing = current.resources.find(
      (resource) => resource.id === next.id || resource.canonicalUri === next.canonicalUri
    )
    const merged: ResourceRef = existing
      ? {
          ...existing,
          ...next,
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
          projectIds: mergeStrings(existing.projectIds, next.projectIds)
        }
      : next
    await this.write({
      ...current,
      resources: [merged, ...current.resources.filter((resource) => resource.id !== merged.id)]
    })
    return merged
  }

  async update(resourceId: string, patch: Partial<ResourceRef>): Promise<ResourceRef> {
    const current = await this.read()
    const existing = current.resources.find((resource) => resource.id === resourceId)
    if (!existing) throw new Error(`Resource not found: ${resourceId}`)
    const updated = normalizeResourceRef({
      ...existing,
      ...patch,
      id: existing.id,
      updatedAt: new Date().toISOString()
    })
    if (!updated) throw new Error(`Invalid resource update: ${resourceId}`)
    await this.write({
      ...current,
      resources: current.resources.map((resource) =>
        resource.id === resourceId ? updated : resource
      )
    })
    return updated
  }

  async remove(resourceId: string): Promise<void> {
    const current = await this.read()
    await this.write({
      resources: current.resources.filter((resource) => resource.id !== resourceId),
      relations: current.relations.filter(
        (relation) => relation.fromId !== resourceId && relation.toId !== resourceId
      ),
      locators: current.locators.filter((locator) => locator.resourceId !== resourceId)
    })
  }

  async relate(relation: ResourceRelation): Promise<ResourceRelation> {
    const current = await this.read()
    const normalized = normalizeResourceRelation(relation)
    if (!normalized) throw new Error('Invalid resource relation')
    const relations = [
      normalized,
      ...current.relations.filter((candidate) => candidate.id !== normalized.id)
    ]
    await this.write({ ...current, relations })
    return normalized
  }

  async unrelate(relationId: string): Promise<void> {
    const current = await this.read()
    await this.write({
      ...current,
      relations: current.relations.filter((relation) => relation.id !== relationId)
    })
  }

  async setLocator(locator: ResourceLocator): Promise<void> {
    if (!isLocator(locator)) throw new Error('Invalid resource locator')
    const current = await this.read()
    await this.write({
      ...current,
      locators: [
        locator,
        ...current.locators.filter(
          (item) => item.resourceId !== locator.resourceId || item.deviceId !== locator.deviceId
        )
      ]
    })
  }
}

function isResourceRef(input: ResourceInput | ResourceRef): input is ResourceRef {
  return typeof (input as ResourceRef).id === 'string'
}

function mergeStrings(
  left: readonly string[] | undefined,
  right: readonly string[] | undefined
): string[] | undefined {
  const values = Array.from(new Set([...(left ?? []), ...(right ?? [])]))
  return values.length ? values : undefined
}

function isLocator(value: unknown): value is ResourceLocator {
  if (!value || typeof value !== 'object') return false
  const locator = value as Partial<ResourceLocator>
  return (
    typeof locator.resourceId === 'string' &&
    typeof locator.deviceId === 'string' &&
    (locator.provider === 'filesystem' || locator.provider === 'google-drive') &&
    typeof locator.updatedAt === 'string'
  )
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(`[ResourceStore] Failed to read ${filePath}`, error)
    }
    return null
  }
}

async function writeJsonAtomically(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.tmp-${process.pid}`
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), 'utf-8')
  await fs.rename(tempPath, filePath)
}
