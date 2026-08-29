import type { ResourceLabel } from '../../../shared/types'

export interface ResourceLabelDraft {
  id: string
  key: string
  value: string
}

export function createResourceLabelDrafts(labels: readonly ResourceLabel[]): ResourceLabelDraft[] {
  return labels.map((label, index) => ({
    id: `resource-label-${index}`,
    key: label.key,
    value: label.value
  }))
}
