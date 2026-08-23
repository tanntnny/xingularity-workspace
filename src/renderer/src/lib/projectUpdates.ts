import type { ProjectUpdate } from '../../../shared/types'

export function getLatestProjectUpdate(
  updates: readonly ProjectUpdate[] | undefined
): ProjectUpdate | null {
  return (
    updates?.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
  )
}
