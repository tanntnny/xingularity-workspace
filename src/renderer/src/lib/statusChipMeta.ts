import { createElement, type ReactElement } from 'react'

import type {
  CalendarTaskType,
  Project,
  ProjectState,
  ProjectUpdateStatus,
  ResourceState,
  SubscriptionReviewFlag,
  SubscriptionStatus,
  TaskPriority,
  TaskStatus
} from '../../../shared/types'
import {
  CALENDAR_TASK_TYPE_VALUES,
  TASK_STATUS_VALUES,
  formatCalendarTaskType
} from '../../../shared/types'
import { RESOURCE_STATES } from '../../../shared/resourceDomain'
import type { RunStatus } from '../../../shared/scheduleTypes'
import { TaskStatusIcon } from '../components/TaskStatusIcon'
import {
  AlertCircle,
  AntennaBars3,
  AntennaBars4,
  AntennaBars5,
  Archive,
  ArchiveOutline,
  CheckCircle2,
  ChartLine,
  CircleDashed,
  CircleDotted,
  Circle,
  Clock,
  CreditCard,
  ExclamationMark,
  FolderOff,
  GitBranch,
  HardDrive,
  Hexagon,
  Inbox,
  Loader2,
  Play,
  Shield,
  Star,
  StarOutline,
  Tag,
  TrendingDown,
  XCircle,
  type FilledIcon
} from '../components/ui/icons'
import { NoteShapeIcon } from '../components/NoteShapeIcon'
import { ProjectUpdateStatusIcon } from '../components/ProjectUpdateStatusIcon'
import type { StatusChipItem } from '../components/ui/status-chip'
import type { StatusChipOption } from '../components/ui/status-chip-select'
import { getTagColorIndex } from '../utils/tagColor'
import { TASK_STATUS_META, getTaskStatus } from './taskStatus'

function icon(Icon: FilledIcon): ReactElement {
  return createElement(Icon, { 'aria-hidden': true, size: 16 })
}

function projectUpdateIcon(Icon: FilledIcon): ReactElement {
  return createElement(ProjectUpdateStatusIcon, { icon: Icon })
}

function token(domain: string, value: string): string {
  return `var(--status-chip-${domain}-${value}-icon)`
}

export const NO_PROJECT_VALUE = '__none__'

const NO_PROJECT_CHIP_OPTION: StatusChipOption = {
  value: NO_PROJECT_VALUE,
  label: 'No project',
  icon: icon(FolderOff),
  iconColorToken: 'var(--muted-foreground)',
  mutedTrigger: true
}

export function getProjectChipOptions(projects: readonly Project[]): readonly StatusChipOption[] {
  return [
    NO_PROJECT_CHIP_OPTION,
    ...projects.map((project) => ({
      value: project.id,
      label: project.name,
      icon: createElement(NoteShapeIcon, { icon: project.icon, size: 18 }),
      iconColorToken: project.icon.color
    }))
  ]
}

export const TASK_STATUS_CHIP_OPTIONS: readonly (StatusChipItem & { value: TaskStatus })[] =
  TASK_STATUS_VALUES.map((value) => ({
    value,
    label: TASK_STATUS_META[value].label,
    icon: createElement(TaskStatusIcon, { status: value, size: 16 }),
    iconColorToken: TASK_STATUS_META[value].iconColorToken
  }))

const TASK_PRIORITY_ICONS: Record<TaskPriority, ReactElement> = {
  low: icon(AntennaBars3),
  medium: icon(AntennaBars4),
  high: icon(AntennaBars5)
}

export const TASK_PRIORITY_CHIP_ITEMS: Record<TaskPriority, StatusChipItem> = {
  low: {
    label: 'Low',
    icon: TASK_PRIORITY_ICONS.low,
    iconColorToken: token('task-priority', 'low')
  },
  medium: {
    label: 'Medium',
    icon: TASK_PRIORITY_ICONS.medium,
    iconColorToken: token('task-priority', 'medium')
  },
  high: {
    label: 'High',
    icon: TASK_PRIORITY_ICONS.high,
    iconColorToken: token('task-priority', 'high')
  }
}

const CALENDAR_TASK_TYPE_ICONS: Record<CalendarTaskType, ReactElement> = {
  meeting: icon(Hexagon),
  assignment: icon(Hexagon),
  review: icon(Hexagon),
  personal: icon(Hexagon),
  'deep-work': icon(Hexagon),
  errand: icon(Hexagon),
  'follow-up': icon(Hexagon),
  other: icon(Hexagon)
}

export const CALENDAR_TASK_TYPE_CHIP_OPTIONS: readonly (StatusChipItem & {
  value: CalendarTaskType
})[] = CALENDAR_TASK_TYPE_VALUES.map((value) => ({
  value,
  label: formatCalendarTaskType(value),
  icon: CALENDAR_TASK_TYPE_ICONS[value],
  iconColorToken: token('calendar-task-type', value)
}))

export function getCalendarTaskTypeChipItem(taskType?: CalendarTaskType): StatusChipItem {
  const resolvedTaskType = taskType ?? 'assignment'
  return (
    CALENDAR_TASK_TYPE_CHIP_OPTIONS.find((option) => option.value === resolvedTaskType) ??
    CALENDAR_TASK_TYPE_CHIP_OPTIONS[1]
  )
}

export function getTaskStatusChipItem(
  status?: TaskStatus,
  completed = false
): StatusChipItem & { value: TaskStatus } {
  const resolvedStatus = getTaskStatus(status, completed)
  return (
    TASK_STATUS_CHIP_OPTIONS.find((option) => option.value === resolvedStatus) ??
    TASK_STATUS_CHIP_OPTIONS[0]
  )
}

export function getTaskPriorityChipItem(priority?: TaskPriority): StatusChipItem {
  return TASK_PRIORITY_CHIP_ITEMS[priority ?? 'low']
}

export function getTagChipItem(tag: string): StatusChipItem {
  return {
    label: tag,
    icon: icon(Tag),
    iconColorToken: token('tag', String(getTagColorIndex(tag)))
  }
}

export const PROJECT_STATE_CHIP_ITEMS: Record<ProjectState, StatusChipItem> = {
  active: {
    label: 'Active',
    icon: icon(CircleDotted),
    iconColorToken: token('project-state', 'active')
  },
  archived: {
    label: 'Archived',
    icon: icon(ArchiveOutline),
    iconColorToken: token('project-state', 'archived')
  }
}

export const PROJECT_STATE_CHIP_OPTIONS: readonly StatusChipOption[] = [
  { value: 'active', ...PROJECT_STATE_CHIP_ITEMS.active },
  { value: 'archived', ...PROJECT_STATE_CHIP_ITEMS.archived }
]

export type ProjectFavoriteChipKey = 'favorite' | 'not-favorite'

export const PROJECT_FAVORITE_CHIP_ITEMS: Record<ProjectFavoriteChipKey, StatusChipItem> = {
  favorite: {
    label: 'Favorite',
    icon: icon(Star),
    iconColorToken: token('project-favorite', 'favorite')
  },
  'not-favorite': {
    label: 'Not favorite',
    icon: icon(StarOutline),
    iconColorToken: token('project-favorite', 'not-favorite')
  }
}

export const PROJECT_FAVORITE_CHIP_OPTIONS: readonly StatusChipOption[] = [
  { value: 'favorite', ...PROJECT_FAVORITE_CHIP_ITEMS.favorite },
  { value: 'not-favorite', ...PROJECT_FAVORITE_CHIP_ITEMS['not-favorite'] }
]

export type ProjectHealthChipKey =
  | 'on-track'
  | 'needs-attention'
  | 'dependency-cycle'
  | 'blocked'
  | 'overdue'

export const PROJECT_HEALTH_CHIP_ITEMS: Record<ProjectHealthChipKey, StatusChipItem> = {
  'on-track': {
    label: 'On track',
    icon: icon(CheckCircle2),
    iconColorToken: token('project-health', 'on-track')
  },
  'needs-attention': {
    label: 'Needs attention',
    icon: icon(AlertCircle),
    iconColorToken: token('project-health', 'needs-attention')
  },
  'dependency-cycle': {
    label: 'Dependency cycle',
    icon: icon(GitBranch),
    iconColorToken: token('project-health', 'dependency-cycle')
  },
  blocked: {
    label: 'Blocked',
    icon: icon(XCircle),
    iconColorToken: token('project-health', 'blocked')
  },
  overdue: {
    label: 'Overdue',
    icon: icon(Clock),
    iconColorToken: token('project-health', 'overdue')
  }
}

const PROJECT_UPDATE_TASK_STATUS_MAP: Record<ProjectUpdateStatus, TaskStatus> = {
  'on-track': 'completed',
  'at-risk': 'in-progress',
  'off-track': 'canceled'
}

function projectUpdateIconColorToken(status: ProjectUpdateStatus): string {
  return TASK_STATUS_META[PROJECT_UPDATE_TASK_STATUS_MAP[status]].iconColorToken
}

const PROJECT_UPDATE_NO_UPDATE_COLOR_TOKEN = 'var(--muted-foreground)'

export const PROJECT_UPDATE_CHIP_ITEMS: Record<ProjectUpdateStatus, StatusChipItem> = {
  'on-track': {
    label: 'On track',
    icon: projectUpdateIcon(ChartLine),
    iconColorToken: projectUpdateIconColorToken('on-track'),
    labelColorToken: projectUpdateIconColorToken('on-track')
  },
  'at-risk': {
    label: 'At risk',
    icon: projectUpdateIcon(ExclamationMark),
    iconColorToken: projectUpdateIconColorToken('at-risk'),
    labelColorToken: projectUpdateIconColorToken('at-risk')
  },
  'off-track': {
    label: 'Off track',
    icon: projectUpdateIcon(TrendingDown),
    iconColorToken: projectUpdateIconColorToken('off-track'),
    labelColorToken: projectUpdateIconColorToken('off-track')
  }
}

export const PROJECT_UPDATE_NO_UPDATE_CHIP_ITEM: StatusChipItem = {
  label: 'No update',
  icon: icon(CircleDashed),
  iconColorToken: PROJECT_UPDATE_NO_UPDATE_COLOR_TOKEN,
  labelColorToken: PROJECT_UPDATE_NO_UPDATE_COLOR_TOKEN
}

export function getProjectUpdateStatusChipItem(
  status: ProjectUpdateStatus | undefined
): StatusChipItem {
  return status ? PROJECT_UPDATE_CHIP_ITEMS[status] : PROJECT_UPDATE_NO_UPDATE_CHIP_ITEM
}

export const PROJECT_UPDATE_CHIP_OPTIONS: readonly StatusChipOption[] = [
  { value: 'on-track', ...PROJECT_UPDATE_CHIP_ITEMS['on-track'] },
  { value: 'at-risk', ...PROJECT_UPDATE_CHIP_ITEMS['at-risk'] },
  { value: 'off-track', ...PROJECT_UPDATE_CHIP_ITEMS['off-track'] }
]

type FleetingNoteTriageState = 'inbox' | 'in-progress' | 'converted' | 'archived'

export const FLEETING_NOTE_TRIAGE_CHIP_ITEMS: Record<FleetingNoteTriageState, StatusChipItem> = {
  inbox: { label: 'Inbox', icon: icon(Inbox), iconColorToken: token('capture-triage', 'inbox') },
  'in-progress': {
    label: 'In progress',
    icon: icon(Loader2),
    iconColorToken: token('capture-triage', 'in-progress')
  },
  converted: {
    label: 'Converted',
    icon: icon(CheckCircle2),
    iconColorToken: token('capture-triage', 'converted')
  },
  archived: {
    label: 'Archived',
    icon: icon(Archive),
    iconColorToken: token('capture-triage', 'archived')
  }
}

export const SUBSCRIPTION_STATUS_CHIP_ITEMS: Record<SubscriptionStatus, StatusChipItem> = {
  active: {
    label: 'Active',
    icon: icon(CreditCard),
    iconColorToken: token('subscription-status', 'active')
  },
  paused: {
    label: 'Paused',
    icon: icon(CreditCard),
    iconColorToken: token('subscription-status', 'paused')
  },
  cancelled: {
    label: 'Cancelled',
    icon: icon(XCircle),
    iconColorToken: token('subscription-status', 'cancelled')
  },
  archived: {
    label: 'Archived',
    icon: icon(Archive),
    iconColorToken: token('subscription-status', 'archived')
  }
}

export const SUBSCRIPTION_REVIEW_CHIP_ITEMS: Record<SubscriptionReviewFlag, StatusChipItem> = {
  none: {
    label: 'No review',
    icon: icon(CheckCircle2),
    iconColorToken: token('subscription-review', 'none')
  },
  review: {
    label: 'Review',
    icon: icon(AlertCircle),
    iconColorToken: token('subscription-review', 'review')
  },
  unused: {
    label: 'Unused',
    icon: icon(AlertCircle),
    iconColorToken: token('subscription-review', 'unused')
  },
  duplicate: {
    label: 'Duplicate',
    icon: icon(GitBranch),
    iconColorToken: token('subscription-review', 'duplicate')
  },
  expensive: {
    label: 'Expensive',
    icon: icon(AlertCircle),
    iconColorToken: token('subscription-review', 'expensive')
  }
}

export type SubscriptionUsageChipKey = 'not-reviewed' | 'keep' | 'cancel' | 'snooze'

export const SUBSCRIPTION_USAGE_CHIP_ITEMS: Record<SubscriptionUsageChipKey, StatusChipItem> = {
  'not-reviewed': {
    label: 'Not reviewed',
    icon: icon(Circle),
    iconColorToken: token('subscription-usage', 'not-reviewed')
  },
  keep: {
    label: 'Keep',
    icon: icon(CheckCircle2),
    iconColorToken: token('subscription-usage', 'keep')
  },
  cancel: {
    label: 'Cancel',
    icon: icon(XCircle),
    iconColorToken: token('subscription-usage', 'cancel')
  },
  snooze: {
    label: 'Snooze',
    icon: icon(Clock),
    iconColorToken: token('subscription-usage', 'snooze')
  }
}

const RESOURCE_STATE_LABELS: Record<ResourceState, string> = {
  available: 'Available',
  stale: 'Stale',
  moved: 'Moved',
  offline: 'Offline',
  'permission-denied': 'Permission denied',
  'reauthorization-required': 'Reauthorization required',
  missing: 'Missing',
  conflict: 'Conflict',
  unindexed: 'Unindexed'
}

const RESOURCE_STATE_ICONS: Record<ResourceState, ReactElement> = {
  available: icon(HardDrive),
  stale: icon(Clock),
  moved: icon(HardDrive),
  offline: icon(HardDrive),
  'permission-denied': icon(Shield),
  'reauthorization-required': icon(Shield),
  missing: icon(AlertCircle),
  conflict: icon(GitBranch),
  unindexed: icon(HardDrive)
}

export const RESOURCE_STATE_CHIP_ITEMS: Record<ResourceState, StatusChipItem> = Object.fromEntries(
  RESOURCE_STATES.map((state) => [
    state,
    {
      label: RESOURCE_STATE_LABELS[state],
      icon: RESOURCE_STATE_ICONS[state],
      iconColorToken: token('resource-state', state)
    }
  ])
) as Record<ResourceState, StatusChipItem>

export type ScheduleJobChipStatus = 'disabled' | 'error' | 'review' | 'success' | 'ready'

export const SCHEDULE_JOB_STATUS_CHIP_ITEMS: Record<ScheduleJobChipStatus, StatusChipItem> = {
  disabled: {
    label: 'Disabled',
    icon: icon(Circle),
    iconColorToken: token('schedule-job', 'disabled')
  },
  error: {
    label: 'Error',
    icon: icon(AlertCircle),
    iconColorToken: token('schedule-job', 'error')
  },
  review: {
    label: 'Needs review',
    icon: icon(AlertCircle),
    iconColorToken: token('schedule-job', 'review')
  },
  success: {
    label: 'Healthy',
    icon: icon(CheckCircle2),
    iconColorToken: token('schedule-job', 'success')
  },
  ready: { label: 'Ready', icon: icon(Play), iconColorToken: token('schedule-job', 'ready') }
}

const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  idle: 'Idle',
  running: 'Running',
  success: 'Success',
  error: 'Error',
  review: 'Needs review',
  cancelled: 'Cancelled'
}

const RUN_STATUS_ICONS: Record<RunStatus, ReactElement> = {
  idle: icon(Circle),
  running: icon(Loader2),
  success: icon(CheckCircle2),
  error: icon(AlertCircle),
  review: icon(AlertCircle),
  cancelled: icon(XCircle)
}

export const RUN_STATUS_CHIP_ITEMS: Record<RunStatus, StatusChipItem> = Object.fromEntries(
  Object.keys(RUN_STATUS_LABELS).map((status) => [
    status,
    {
      label: RUN_STATUS_LABELS[status as RunStatus],
      icon: RUN_STATUS_ICONS[status as RunStatus],
      iconColorToken: token('run-status', status)
    }
  ])
) as Record<RunStatus, StatusChipItem>
