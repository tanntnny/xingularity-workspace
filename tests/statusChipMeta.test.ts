import { describe, expect, it } from 'vitest'

import {
  CALENDAR_TASK_TYPE_VALUES,
  TASK_STATUS_VALUES,
  type ProjectUpdateStatus,
  type SubscriptionReviewFlag,
  type SubscriptionStatus,
  type TaskPriority
} from '../src/shared/types'
import { RESOURCE_STATES } from '../src/shared/resourceDomain'
import type { RunStatus } from '../src/shared/scheduleTypes'
import {
  CALENDAR_TASK_TYPE_CHIP_OPTIONS,
  NO_PROJECT_VALUE,
  PROJECT_FAVORITE_CHIP_ITEMS,
  PROJECT_FAVORITE_CHIP_OPTIONS,
  PROJECT_UPDATE_CHIP_ITEMS,
  PROJECT_UPDATE_CHIP_OPTIONS,
  PROJECT_UPDATE_NO_UPDATE_CHIP_ITEM,
  PROJECT_STATE_CHIP_ITEMS,
  PROJECT_STATE_CHIP_OPTIONS,
  RESOURCE_STATE_CHIP_ITEMS,
  RUN_STATUS_CHIP_ITEMS,
  SUBSCRIPTION_REVIEW_CHIP_ITEMS,
  SUBSCRIPTION_STATUS_CHIP_ITEMS,
  SUBSCRIPTION_USAGE_CHIP_ITEMS,
  TASK_PRIORITY_CHIP_ITEMS,
  TASK_STATUS_CHIP_OPTIONS,
  getProjectChipOptions,
  getTagChipItem
} from '../src/renderer/src/lib/statusChipMeta'
import { getTagColorIndex } from '../src/renderer/src/utils/tagColor'
import { ProjectUpdateStatusIcon } from '../src/renderer/src/components/ProjectUpdateStatusIcon'
import { TASK_STATUS_META } from '../src/renderer/src/lib/taskStatus'
import {
  AntennaBars3,
  AntennaBars4,
  AntennaBars5,
  ArchiveOutline,
  ChartLine,
  CircleDashed,
  CircleDotted,
  ExclamationMark,
  FolderOff,
  Hexagon,
  Star,
  StarOutline,
  TrendingDown
} from '../src/renderer/src/components/ui/icons'

const priorities: TaskPriority[] = ['low', 'medium', 'high']
const subscriptionStatuses: SubscriptionStatus[] = ['active', 'paused', 'cancelled', 'archived']
const reviewFlags: SubscriptionReviewFlag[] = ['none', 'review', 'unused', 'duplicate', 'expensive']
const usageReviewStates = ['not-reviewed', 'keep', 'cancel', 'snooze']
const projectFavoriteStates = ['favorite', 'not-favorite']
const projectStates = ['active', 'archived']
const runStatuses: RunStatus[] = ['idle', 'running', 'success', 'error', 'review', 'cancelled']
const projectUpdateStatuses: ProjectUpdateStatus[] = ['on-track', 'at-risk', 'off-track']

describe('semantic status chip metadata', () => {
  it('covers every task, priority, calendar type, resource, and scheduling value', () => {
    expect(TASK_STATUS_CHIP_OPTIONS.map((option) => option.value)).toEqual(TASK_STATUS_VALUES)
    expect(Object.keys(TASK_PRIORITY_CHIP_ITEMS)).toEqual(priorities)
    expect(CALENDAR_TASK_TYPE_CHIP_OPTIONS.map((option) => option.value)).toEqual(
      CALENDAR_TASK_TYPE_VALUES
    )
    expect(Object.keys(RESOURCE_STATE_CHIP_ITEMS)).toEqual(RESOURCE_STATES)
    expect(Object.keys(RUN_STATUS_CHIP_ITEMS)).toEqual(runStatuses)
  })

  it('covers subscription and project update values', () => {
    expect(Object.keys(SUBSCRIPTION_STATUS_CHIP_ITEMS)).toEqual(subscriptionStatuses)
    expect(Object.keys(SUBSCRIPTION_REVIEW_CHIP_ITEMS)).toEqual(reviewFlags)
    expect(Object.keys(SUBSCRIPTION_USAGE_CHIP_ITEMS)).toEqual(usageReviewStates)
    expect(Object.keys(PROJECT_FAVORITE_CHIP_ITEMS)).toEqual(projectFavoriteStates)
    expect(PROJECT_FAVORITE_CHIP_OPTIONS.map((option) => option.value)).toEqual(
      projectFavoriteStates
    )
    expect(Object.keys(PROJECT_UPDATE_CHIP_ITEMS)).toEqual(projectUpdateStatuses)
    expect(PROJECT_UPDATE_CHIP_OPTIONS.map((option) => option.value)).toEqual(projectUpdateStatuses)
  })

  it('uses filled and outline star icons for favorite states', () => {
    expect((PROJECT_FAVORITE_CHIP_ITEMS.favorite.icon as { type?: unknown }).type).toBe(Star)
    expect((PROJECT_FAVORITE_CHIP_ITEMS['not-favorite'].icon as { type?: unknown }).type).toBe(
      StarOutline
    )
  })

  it('uses ordered outlined status icons for project updates', () => {
    const expectedIcons = {
      'on-track': ChartLine,
      'at-risk': ExclamationMark,
      'off-track': TrendingDown
    } as const

    for (const status of projectUpdateStatuses) {
      const itemIcon = PROJECT_UPDATE_CHIP_ITEMS[status].icon as {
        type?: unknown
        props?: { icon?: unknown }
      }

      expect(itemIcon.type).toBe(ProjectUpdateStatusIcon)
      expect(itemIcon.props?.icon).toBe(expectedIcons[status])
    }

    expect(PROJECT_UPDATE_CHIP_ITEMS['on-track'].iconColorToken).toBe(
      TASK_STATUS_META.completed.iconColorToken
    )
    expect(PROJECT_UPDATE_CHIP_ITEMS['at-risk'].iconColorToken).toBe(
      TASK_STATUS_META['in-progress'].iconColorToken
    )
    expect(PROJECT_UPDATE_CHIP_ITEMS['off-track'].iconColorToken).toBe(
      TASK_STATUS_META.canceled.iconColorToken
    )

    for (const status of projectUpdateStatuses) {
      expect(PROJECT_UPDATE_CHIP_ITEMS[status].labelColorToken).toBe(
        PROJECT_UPDATE_CHIP_ITEMS[status].iconColorToken
      )
    }
  })

  it('uses a muted dashed circle for projects without an update', () => {
    expect(PROJECT_UPDATE_NO_UPDATE_CHIP_ITEM.label).toBe('No update')
    expect((PROJECT_UPDATE_NO_UPDATE_CHIP_ITEM.icon as { type?: unknown }).type).toBe(CircleDashed)
    expect(PROJECT_UPDATE_NO_UPDATE_CHIP_ITEM.iconColorToken).toBe('var(--muted-foreground)')
    expect(PROJECT_UPDATE_NO_UPDATE_CHIP_ITEM.labelColorToken).toBe('var(--muted-foreground)')
  })

  it('uses neutral outline icons for project state selection', () => {
    expect(PROJECT_STATE_CHIP_OPTIONS.map((option) => option.value)).toEqual(projectStates)
    expect((PROJECT_STATE_CHIP_ITEMS.active.icon as { type?: unknown }).type).toBe(CircleDotted)
    expect((PROJECT_STATE_CHIP_ITEMS.archived.icon as { type?: unknown }).type).toBe(ArchiveOutline)
    expect(PROJECT_STATE_CHIP_ITEMS.active.iconColorToken).toBe(
      'var(--status-chip-project-state-active-icon)'
    )
    expect(PROJECT_STATE_CHIP_ITEMS.archived.iconColorToken).toBe(
      'var(--status-chip-project-state-archived-icon)'
    )
  })

  it('assigns dynamic tags to their deterministic icon token family', () => {
    const item = getTagChipItem('Release')
    const colorIndex = getTagColorIndex('Release')

    expect(item.label).toBe('Release')
    expect(item.iconColorToken).toBe(`var(--status-chip-tag-${colorIndex}-icon)`)
  })

  it('uses the shared hexagon icon with a semantic token for every task type', () => {
    for (const option of CALENDAR_TASK_TYPE_CHIP_OPTIONS) {
      expect((option.icon as { type?: unknown }).type).toBe(Hexagon)
      expect(option.iconColorToken).toBe(
        `var(--status-chip-calendar-task-type-${option.value}-icon)`
      )
    }
  })

  it('uses ordered antenna bars with semantic foreground tokens for task priorities', () => {
    const expectedIcons = {
      low: AntennaBars3,
      medium: AntennaBars4,
      high: AntennaBars5
    } as const

    for (const priority of priorities) {
      const item = TASK_PRIORITY_CHIP_ITEMS[priority]
      expect((item.icon as { type?: unknown }).type).toBe(expectedIcons[priority])
      expect(item.iconColorToken).toBe(`var(--status-chip-task-priority-${priority}-icon)`)
    }
  })

  it('builds project options with a stable no-project value and project identity icons', () => {
    const options = getProjectChipOptions([
      {
        id: 'project-1',
        name: 'Launch project',
        summary: '',
        state: 'active',
        updatedAt: '2026-08-12T00:00:00.000Z',
        icon: {
          set: 'tabler',
          glyph: 'rocket',
          variant: 'filled',
          color: '#0ea5e9'
        }
      }
    ])

    expect(options.map((option) => option.value)).toEqual([NO_PROJECT_VALUE, 'project-1'])
    expect(options.map((option) => option.label)).toEqual(['No project', 'Launch project'])
    expect((options[0]?.icon as { type?: unknown }).type).toBe(FolderOff)
    expect(options[0]?.iconColorToken).toBe('var(--muted-foreground)')
    expect(options[0]?.mutedTrigger).toBe(true)
    expect(options[1]?.iconColorToken).toBe('#0ea5e9')
    expect(options[1]?.mutedTrigger).toBeUndefined()
  })
})
