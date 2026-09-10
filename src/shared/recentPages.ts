export const MAX_RECENT_PAGE_TARGETS = 5

export type RecentPageTarget =
  | { kind: 'note'; path: string }
  | { kind: 'drawing'; path: string }
  | { kind: 'project'; projectId: string }
  | { kind: 'view'; viewId: string }

function targetKey(target: RecentPageTarget): string {
  switch (target.kind) {
    case 'note':
    case 'drawing':
      return `${target.kind}:${target.path}`
    case 'project':
      return `${target.kind}:${target.projectId}`
    case 'view':
      return `${target.kind}:${target.viewId}`
  }
}

export function getRecentPageTargetId(target: RecentPageTarget): string {
  return targetKey(target)
}

function normalizeTarget(value: unknown): RecentPageTarget | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const candidate = value as Record<string, unknown>
  if (candidate.kind === 'note' || candidate.kind === 'drawing') {
    return typeof candidate.path === 'string' && candidate.path.trim()
      ? { kind: candidate.kind, path: candidate.path.trim() }
      : null
  }

  if (candidate.kind === 'project') {
    return typeof candidate.projectId === 'string' && candidate.projectId.trim()
      ? { kind: 'project', projectId: candidate.projectId.trim() }
      : null
  }

  if (candidate.kind === 'view') {
    return typeof candidate.viewId === 'string' && candidate.viewId.trim()
      ? { kind: 'view', viewId: candidate.viewId.trim() }
      : null
  }

  return null
}

export function normalizeRecentPageTargets(value: unknown): RecentPageTarget[] {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<string>()
  const targets: RecentPageTarget[] = []

  for (const item of value) {
    const target = normalizeTarget(item)
    if (!target) {
      continue
    }

    const key = targetKey(target)
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    targets.push(target)
    if (targets.length === MAX_RECENT_PAGE_TARGETS) {
      break
    }
  }

  return targets
}

export function rememberRecentPageTarget(
  targets: readonly RecentPageTarget[],
  target: RecentPageTarget
): RecentPageTarget[] {
  return normalizeRecentPageTargets([target, ...targets])
}

export function remapRecentPageTargets(
  targets: readonly RecentPageTarget[],
  fromPath: string,
  toPath: string
): RecentPageTarget[] {
  return normalizeRecentPageTargets(
    targets.map((target) => {
      if (target.kind !== 'note' && target.kind !== 'drawing') {
        return target
      }

      if (target.path === fromPath) {
        return { ...target, path: toPath }
      }

      const nestedPrefix = `${fromPath}/`
      return target.path.startsWith(nestedPrefix)
        ? { ...target, path: `${toPath}/${target.path.slice(nestedPrefix.length)}` }
        : target
    })
  )
}

export function removeRecentPageTargets(
  targets: readonly RecentPageTarget[],
  removedPaths: readonly string[]
): RecentPageTarget[] {
  return normalizeRecentPageTargets(
    targets.filter(
      (target) =>
        (target.kind !== 'note' && target.kind !== 'drawing') ||
        !removedPaths.some(
          (removedPath) =>
            target.path === removedPath || target.path.startsWith(`${removedPath}/`)
        )
    )
  )
}
