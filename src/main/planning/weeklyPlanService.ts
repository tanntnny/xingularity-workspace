import { randomUUID } from 'node:crypto'
import {
  CreateWeeklyPlanPriorityInput,
  CreateWeeklyPlanWeekInput,
  DeleteWeeklyPlanWeekInput,
  ReorderWeeklyPlanPrioritiesInput,
  UpdateWeeklyPlanPriorityInput,
  UpdateWeeklyPlanWeekInput,
  UpsertWeeklyPlanReviewInput,
  WeeklyPlanPriority,
  WeeklyPlanState,
  WeeklyPlanWeek
} from '../../shared/types'
import { WeeklyPlanStore } from './weeklyPlanStore'

const MAX_PRIORITIES_PER_WEEK = 7

export class WeeklyPlanService {
  private store: WeeklyPlanStore | null = null
  private mutationQueue: Promise<void> = Promise.resolve()

  handleVaultChange(vaultRoot: string | null): void {
    this.store = vaultRoot ? new WeeklyPlanStore(vaultRoot) : null
  }

  async getState(): Promise<WeeklyPlanState> {
    await this.mutationQueue
    return this.assertStore().read()
  }

  async createWeek(input: CreateWeeklyPlanWeekInput): Promise<WeeklyPlanState> {
    return this.enqueueMutation(async () => {
      return this.assertStore().update((state) => {
        const nowIso = new Date().toISOString()
        const startDate = sanitizeIsoDate(input.startDate)
        const endDate = sanitizeIsoDate(input.endDate ?? addDaysIso(startDate, 6))

        if (state.weeks.some((week) => week.startDate === startDate)) {
          throw new Error(`Week already exists for ${startDate}`)
        }

        const newWeek: WeeklyPlanWeek = {
          id: randomUUID(),
          startDate,
          endDate: normalizeDateOrder(startDate, endDate),
          focus: input.focus?.trim() || undefined,
          createdAt: nowIso,
          updatedAt: nowIso
        }

        const weeks = [...state.weeks, newWeek].sort((a, b) => a.startDate.localeCompare(b.startDate))
        return { ...state, weeks }
      })
    })
  }

  async updateWeek(input: UpdateWeeklyPlanWeekInput): Promise<WeeklyPlanState> {
    return this.enqueueMutation(async () => {
      return this.assertStore().update((state) => {
        const index = state.weeks.findIndex((week) => week.id === input.id)
        if (index === -1) {
          throw new Error(`Week not found: ${input.id}`)
        }
        const nowIso = new Date().toISOString()
        const current = state.weeks[index]

        let nextStart = current.startDate
        let nextEnd = current.endDate

        if (input.startDate) {
          nextStart = sanitizeIsoDate(input.startDate)
          if (input.endDate) {
            nextEnd = sanitizeIsoDate(input.endDate)
          } else {
            const span = Math.max(diffDays(current.startDate, current.endDate), 0)
            nextEnd = addDaysIso(nextStart, span)
          }
        } else if (input.endDate) {
          nextEnd = sanitizeIsoDate(input.endDate)
        }

        const nextWeek: WeeklyPlanWeek = {
          ...current,
          startDate: nextStart,
          endDate: normalizeDateOrder(nextStart, nextEnd),
          focus: normalizeOptional(input.focus, current.focus),
          updatedAt: nowIso
        }

        const weeks = [...state.weeks]
        weeks[index] = nextWeek
        weeks.sort((a, b) => a.startDate.localeCompare(b.startDate))
        return { ...state, weeks }
      })
    })
  }

  async deleteWeek(input: DeleteWeeklyPlanWeekInput): Promise<WeeklyPlanState> {
    return this.enqueueMutation(async () => {
      return this.assertStore().update((state) => {
        const exists = state.weeks.some((week) => week.id === input.id)
        if (!exists) {
          throw new Error(`Week not found: ${input.id}`)
        }
        const weeks = state.weeks.filter((week) => week.id !== input.id)
        const priorities = state.priorities.filter((priority) => priority.weekId !== input.id)
        const reviews = state.reviews.filter((review) => review.weekId !== input.id)
        return { weeks, priorities, reviews }
      })
    })
  }

  async addPriority(input: CreateWeeklyPlanPriorityInput): Promise<WeeklyPlanState> {
    return this.enqueueMutation(async () => {
      return this.assertStore().update((state) => {
        const week = assertWeek(state, input.weekId)
        const weekPriorities = state.priorities
          .filter((priority) => priority.weekId === week.id)
          .sort((a, b) => a.order - b.order)
        if (weekPriorities.length >= MAX_PRIORITIES_PER_WEEK) {
          throw new Error('Weekly priorities are limited to seven items')
        }

        const nowIso = new Date().toISOString()
        const priority: WeeklyPlanPriority = {
          id: randomUUID(),
          weekId: week.id,
          title: input.title.trim() || 'Untitled Priority',
          status: 'planned',
          order: weekPriorities.length ? weekPriorities[weekPriorities.length - 1]!.order + 1 : 1,
          linkedProjectId: input.linkedProjectId?.trim() || undefined,
          linkedMilestoneId: input.linkedMilestoneId?.trim() || undefined,
          linkedSubtaskId: input.linkedSubtaskId?.trim() || undefined,
          linkedTaskId: input.linkedTaskId?.trim() || undefined,
          createdAt: nowIso,
          updatedAt: nowIso
        }

        return { ...state, priorities: [...state.priorities, priority] }
      })
    })
  }

  async updatePriority(input: UpdateWeeklyPlanPriorityInput): Promise<WeeklyPlanState> {
    return this.enqueueMutation(async () => {
      return this.assertStore().update((state) => {
        const index = state.priorities.findIndex((priority) => priority.id === input.id)
        if (index === -1) {
          throw new Error(`Priority not found: ${input.id}`)
        }
        const nowIso = new Date().toISOString()
        const current = state.priorities[index]
        const nextStatus = input.status ?? current.status
        const priority: WeeklyPlanPriority = {
          ...current,
          title: input.title?.trim() ? input.title.trim() : current.title,
          status: nextStatus,
          linkedProjectId: normalizeLink(input.linkedProjectId, current.linkedProjectId),
          linkedMilestoneId: normalizeLink(input.linkedMilestoneId, current.linkedMilestoneId),
          linkedSubtaskId: normalizeLink(input.linkedSubtaskId, current.linkedSubtaskId),
          linkedTaskId: normalizeLink(input.linkedTaskId, current.linkedTaskId),
          updatedAt: nowIso
        }
        const priorities = [...state.priorities]
        priorities[index] = priority
        return { ...state, priorities }
      })
    })
  }

  async deletePriority(priorityId: string): Promise<WeeklyPlanState> {
    return this.enqueueMutation(async () => {
      return this.assertStore().update((state) => {
        const priority = state.priorities.find((item) => item.id === priorityId)
        if (!priority) {
          throw new Error(`Priority not found: ${priorityId}`)
        }
        const priorities = state.priorities
          .filter((item) => item.id !== priorityId)
          .map((item) =>
            item.weekId === priority.weekId && item.order > priority.order
              ? { ...item, order: item.order - 1 }
              : item
          )
        return { ...state, priorities }
      })
    })
  }

  async reorderPriorities(input: ReorderWeeklyPlanPrioritiesInput): Promise<WeeklyPlanState> {
    return this.enqueueMutation(async () => {
      return this.assertStore().update((state) => {
        const week = assertWeek(state, input.weekId)
        const current = state.priorities.filter((priority) => priority.weekId === week.id)
        if (current.length !== input.priorityIds.length) {
          throw new Error('Priority reorder payload mismatch')
        }
        const idSet = new Set(input.priorityIds)
        for (const priority of current) {
          if (!idSet.has(priority.id)) {
            throw new Error('Priority reorder payload missing items')
          }
        }
        const orderMap = new Map<string, number>()
        input.priorityIds.forEach((id, index) => orderMap.set(id, index + 1))

        const priorities = state.priorities.map((priority) =>
          priority.weekId === week.id && orderMap.has(priority.id)
            ? { ...priority, order: orderMap.get(priority.id)!, updatedAt: new Date().toISOString() }
            : priority
        )
        return { ...state, priorities }
      })
    })
  }

  async upsertReview(input: UpsertWeeklyPlanReviewInput): Promise<WeeklyPlanState> {
    return this.enqueueMutation(async () => {
      return this.assertStore().update((state) => {
        const week = assertWeek(state, input.weekId)
        const nowIso = new Date().toISOString()
        const reviews = [...state.reviews]
        const index = input.reviewId
          ? reviews.findIndex((review) => review.id === input.reviewId)
          : reviews.findIndex((review) => review.weekId === week.id)

        if (index >= 0) {
          reviews[index] = {
            ...reviews[index],
            wins: normalizeOptional(input.wins, reviews[index].wins),
            misses: normalizeOptional(input.misses, reviews[index].misses),
            blockers: normalizeOptional(input.blockers, reviews[index].blockers),
            nextWeek: normalizeOptional(input.nextWeek, reviews[index].nextWeek),
            updatedAt: nowIso
          }
        } else {
          reviews.push({
            id: randomUUID(),
            weekId: week.id,
            wins: input.wins?.trim() || undefined,
            misses: input.misses?.trim() || undefined,
            blockers: input.blockers?.trim() || undefined,
            nextWeek: input.nextWeek?.trim() || undefined,
            createdAt: nowIso,
            updatedAt: nowIso
          })
        }

        return { ...state, reviews }
      })
    })
  }

  private enqueueMutation(action: () => Promise<WeeklyPlanState>): Promise<WeeklyPlanState> {
    const run = this.mutationQueue.then(action, action)
    this.mutationQueue = run.then(() => undefined).catch(() => undefined)
    return run
  }

  private assertStore(): WeeklyPlanStore {
    if (!this.store) {
      throw new Error('No vault selected')
    }
    return this.store
  }
}

function sanitizeIsoDate(value: string): string {
  return formatIsoDate(parseIsoDate(value))
}

function parseIsoDate(value: string): Date {
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) {
    return new Date()
  }
  return parsed
}

function formatIsoDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDaysIso(start: string, days: number): string {
  const date = parseIsoDate(start)
  date.setUTCDate(date.getUTCDate() + days)
  return formatIsoDate(date)
}

function diffDays(startIso: string, endIso: string): number {
  const start = parseIsoDate(startIso)
  const end = parseIsoDate(endIso)
  return Math.max(Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)), 0)
}

function normalizeOptional<T>(nextValue: T | null | undefined, currentValue: T | undefined): T | undefined {
  if (nextValue === undefined) {
    return currentValue
  }
  if (nextValue === null) {
    return undefined
  }
  if (typeof nextValue === 'string') {
    const trimmed = nextValue.trim()
    return trimmed ? (trimmed as unknown as T) : undefined
  }
  return nextValue
}

function normalizeLink(nextValue: string | null | undefined, currentValue: string | undefined): string | undefined {
  if (nextValue === undefined) {
    return currentValue
  }
  if (nextValue === null) {
    return undefined
  }
  return nextValue.trim() || undefined
}

function normalizeDateOrder(start: string, end: string): string {
  return end < start ? start : end
}

function assertWeek(state: WeeklyPlanState, weekId: string): WeeklyPlanWeek {
  const week = state.weeks.find((item) => item.id === weekId)
  if (!week) {
    throw new Error(`Week not found: ${weekId}`)
  }
  return week
}
