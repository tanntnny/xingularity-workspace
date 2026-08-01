import type { ReactElement } from 'react'
import type { TaskStatus } from '../../../shared/types'
import { TASK_STATUS_META, getTaskStatus } from '../lib/taskStatus'

export function TaskStatusIcon({
  status,
  completed,
  size = 16,
  className = ''
}: {
  status?: TaskStatus
  completed?: boolean
  size?: number
  className?: string
}): ReactElement {
  const resolved = getTaskStatus(status, completed)
  const meta = TASK_STATUS_META[resolved]
  const Icon = meta.Icon

  return <Icon size={size} className={`${meta.className} ${className}`} aria-hidden="true" />
}
